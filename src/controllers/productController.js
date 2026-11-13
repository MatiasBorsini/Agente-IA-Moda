// productController.js
const supabase = require('../config/supabase');
const { analizarProducto } = require('../services/geminiService');
const { InlineKeyboard } = require("grammy");
const storageService = require('../services/storageService');
const imageService = require('../services/imageService');


const handlePhoto = async (ctx) => {
    // 1. Traemos el ID del cliente que cargó el middleware checkCredits
    const clienteId = ctx.session.clienteInternoId;

    // 2. EL CANDADO: Si ya hay un análisis en curso, frenamos la ráfaga de fotos
    if (ctx.session.procesando) {
        if (clienteId) {
            try {
                await supabase.rpc('reembolsar_credito', { cliente_id_buscado: clienteId });
                console.log(`🔄 Ráfaga frenada: Crédito devuelto al cliente ${clienteId}`);
            } catch (errorRpc) {
                console.error("❌ Error en RPC al reembolsar por ráfaga:", errorRpc);
            }
        }
        return ctx.reply("⏳ *¡Una imagen a la vez!* Ya estoy procesando una. Por favor, confirmá o cancelá el producto actual antes de mandarme otra foto.");
    }

    try {
        // 3. CERRAMOS LA PUERTA: A partir de acá, el bot está ocupado
        ctx.session.procesando = true;

        if (!clienteId) {
            ctx.session.procesando = false; 
            return ctx.reply("❌ Error de sesión: No se reconoce tu cliente ID. Reiniciá con /start");
        }

        // 4. VALIDACIÓN DE TAMAÑO DE IMAGEN (Evitamos imágenes gigantes)
        const fotoMasGrande = ctx.message.photo[ctx.message.photo.length - 1];
        const LIMITE_TAMANO = 5 * 1024 * 1024; // 5 MB en Bytes
        
        if (fotoMasGrande.file_size > LIMITE_TAMANO) {
            if (clienteId) {
                await supabase.rpc('reembolsar_credito', { cliente_id_buscado: clienteId });
            }
            ctx.session.procesando = false; 
            return ctx.reply("⚠️ La imagen es demasiado pesada (máximo 5MB). Se te devolvió el crédito. Intentá reduciendo la resolución de la cámara.");
        }

        await ctx.reply("📸 Analizando e instalando mejoras en la imagen... por favor esperá.");

        // 5. DESCARGA Y PROCESAMIENTO
        const archivo = await ctx.getFile();
        const urlDescarga = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${archivo.file_path}`;
        
        const respuesta = await fetch(urlDescarga);
        if (!respuesta.ok) throw new Error("Fallo al descargar imagen de Telegram");
        
        const bufferImagenOriginal = Buffer.from(await respuesta.arrayBuffer());

        // =========================================================================
        // 🔥 PASO NUEVO: OPTIMIZAMOS Y HACEMOS CUADRADA LA FOTO CON SHARP
        // =========================================================================
        const bufferOptimizado = await imageService.optimizarParaInstagram(bufferImagenOriginal);
        
        // Subimos el buffer YA OPTIMIZADO al Storage de Supabase
        const urlPublicaFoto = await storageService.subirImagenProducto(bufferOptimizado, clienteId);
        // =========================================================================

        // Llamada al servicio de Gemini (le pasamos el optimizado para ahorrar recursos)
        const analisis = await analizarProducto(bufferOptimizado);

        if (!analisis) {
            throw new Error("La IA no pudo procesar la imagen");
        }

        // Si todo salió bien, reseteamos el contador de errores seguidos
        ctx.session.erroresSeguidos = 0;

        // Guardamos en la sesión los datos para el paso final
        ctx.session.datosTemporales = { 
            ...analisis,
            cliente_id: clienteId, 
            urlFoto: urlPublicaFoto // Guardamos la URL del Storage (.jpg pública)
        };
        
        ctx.session.esperandoNombre = false;

        // Armamos el mensaje para el usuario
        const mensaje = `🔎 *He detectado:*
📦 *Producto:* ${analisis.producto || 'Sin nombre'}
📝 *Descripción:* ${analisis.descripcion || 'Sin descripción'}
👤 *Cliente ID:* ${clienteId}

¿Los datos son correctos?`;

        const teclado = new InlineKeyboard()
            .text("✅ Todo bien", "confirmar_guardado")
            .text("✏️ Editar Nombre", "editar_nombre").row()
            .text("❌ Cancelar", "cancelar_carga");

        await ctx.reply(mensaje.replace(/\*/g, ''), { reply_markup: teclado });

    } catch (error) {
        console.error("🔴 Error en handlePhoto:", error.message);

        // 6. ABRIMOS LA PUERTA POR ERROR: El bot queda libre para reintentar
        ctx.session.procesando = false;
        ctx.session.erroresSeguidos = (ctx.session.erroresSeguidos || 0) + 1;

        if (clienteId) {
            if (ctx.session.erroresSeguidos >= 3) {
                try {
                    await supabase.rpc('reembolsar_credito', { cliente_id_buscado: clienteId });
                    console.log(`🚨 Límite alcanzado. Último reembolso aplicado al cliente ${clienteId}.`);
                } catch (errorRpc) {
                    console.error("❌ Error en RPC de reembolso crítico:", errorRpc);
                }
                return ctx.reply("⚠️ Hubo un error técnico repetitivo. Se te devolvió el crédito, pero el servicio se pausará temporalmente por seguridad. Intentá de nuevo más tarde o contactá a soporte.");
            }

            try {
                await supabase.rpc('reembolsar_credito', { cliente_id_buscado: clienteId });
                console.log(`✅ Crédito reembolsado al cliente ${clienteId}. Fallo: ${ctx.session.erroresSeguidos}/3`);
            } catch (errorRpc) {
                console.error("❌ Error en RPC de reembolso normal:", errorRpc);
            }
        }

        await ctx.reply(`⚠️ Hubo un error al procesar la imagen (Intento ${ctx.session.erroresSeguidos}/3). No se te descontó el crédito, por favor intentá de nuevo.`);
    }
};

// 2. Maneja el cambio de nombre (si el usuario quiere editar)
const handleNewName = async (ctx) => {
    // 1. Validamos que realmente estemos esperando un nombre
    if (!ctx.session.esperandoNombre) return;

    // 2. Si por algún motivo se borró la sesión en el medio, abrimos candado y rebotamos
    if (!ctx.session.datosTemporales) {
        ctx.session.esperandoNombre = false;
        ctx.session.procesando = false; // <-- LIBERAMOS EL BOT
        return ctx.reply("❌ Ocurrió un error con los datos temporales. Por favor, volvé a mandar la foto.");
    }

    const nuevoNombre = ctx.message.text.trim(); // Limpiamos espacios extras
    if (!nuevoNombre || nuevoNombre.length > 200) {
        return ctx.reply('⚠️ Escribí un nombre de entre 1 y 200 caracteres.');
    }
    
    // IMPORTANTE: Mantenemos lo que detectó la IA (como el precio) y actualizamos el producto
    ctx.session.datosTemporales = {
        ...ctx.session.datosTemporales,
        producto: nuevoNombre,
        cliente_id: ctx.session.clienteInternoId, 
        descripcion: null, 
        categoria: null,
        requiereRegeneracion: true 
    };

    ctx.session.esperandoNombre = false;
    const datos = ctx.session.datosTemporales;

    // Quitamos los espacios extras del string para evitar que Markdown se rompa
    const mensaje = `✅ *Nombre actualizado:*
📦 *Producto:* ${datos.producto}
👤 *Cliente:* ${datos.cliente_id}

¿Confirmas el guardado?`;

    const teclado = new InlineKeyboard()
        .text("✅ Confirmar", "confirmar_guardado")
        .text("❌ Cancelar", "cancelar_carga");

    await ctx.reply(mensaje.replace(/\*/g, ''), { reply_markup: teclado });
    
    // NOTA: Acá NO ponemos ctx.session.procesando = false porque el usuario
    // todavía tiene que tocar "Confirmar" o "Cancelar". El bot sigue ocupado.
};

// 3. El guardado final en Supabase
const confirmSave = async (ctx) => {
    const datos = ctx.session.datosTemporales;
    
    // 1. Si el usuario hace doble clic rápido en el botón, evitamos que inserte dos veces
    if (!datos || !datos.cliente_id) {
        // Nos aseguramos de resetear el estado por si quedó colgado
        ctx.session.procesando = false; 
        return ctx.reply("❌ Error: No se encontraron datos activos para guardar o ya fueron procesados.");
    }

    try {
        // Editamos el mensaje actual para quitarle los botones y evitar clics fantasmas
        await ctx.editMessageText("💾 Guardando en la base de datos... por favor esperá.");

        const { error } = await supabase.from('productos').insert([{
            nombre: datos.producto,
            precio: datos.precio || 0,
            detalles: { 
                descripcion: datos.descripcion, 
                categoria: datos.categoria,
                editadoManualmente: datos.requiereRegeneracion || false
            },
            imagen_url: datos.urlFoto, 
            score_frescura: 1.0,
            cliente_id: datos.cliente_id 
        }]);

        if (error) throw error;

        await ctx.reply(`🚀 *¡Producto guardado con éxito!* ya está listo para ser usado.`);
        
        // 2. FLUJO EXITOSO: Limpiamos la memoria y LIBERAMOS EL BOT
        ctx.session.datosTemporales = null;
        ctx.session.esperandoNombre = false;
        ctx.session.procesando = false; // <-- El bot queda libre para la siguiente foto
        ctx.session.erroresSeguidos = 0; // Por las dudas, reseteamos errores

    } catch (e) {
        console.error("🔴 Error en insert de productos:", e.message);
        
        // 3. FLUJO CON ERROR: Abrimos el bot para que el cliente pueda reintentar
        ctx.session.procesando = false; 

        if (ctx.session.clienteInternoId) {
            try {
                await supabase.rpc('reembolsar_credito', { cliente_id_buscado: ctx.session.clienteInternoId });
                console.log(`✅ Crédito reembolsado al cliente ${ctx.session.clienteInternoId} por falla en Insert.`);
            } catch (errorRpc) {
                console.error("❌ Error crítico en RPC de reembolso (confirmSave):", errorRpc);
            }
        }

        ctx.reply("⚠️ Hubo un error técnico al guardar el producto. No se te descontó el crédito, por favor intentá confirmar de nuevo.");
    }
};

// 4. Activa el estado de espera para que el usuario escriba el nuevo nombre
const askNewName = async (ctx) => {
    try {
        // Le avisamos al sistema que el próximo texto es el nombre del producto
        ctx.session.esperandoNombre = true;
        
        // Opcional: Podés editar el mensaje anterior para que no queden los botones viejos dando vueltas
        await ctx.editMessageText("✏️ *Modo edición:* Escribime a continuación el nombre correcto para el producto.");
        
    } catch (error) {
        console.error("🔴 Error en askNewName:", error.message);
        await ctx.reply("⚠️ Hubo un problema al activar la edición. Por favor, intentá tocar el botón de nuevo.");
    }
};

// ACORDATE DE EXPORTARLA AL FINAL DEL ARCHIVO:
module.exports = {
    handlePhoto,
    handleNewName,
    confirmSave,
    askNewName // <-- Sumala acá
};

module.exports = { handlePhoto, handleNewName, askNewName, confirmSave };
