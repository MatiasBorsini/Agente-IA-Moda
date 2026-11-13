// middleware/checkCredits.js
const supabase = require('../config/supabase');

const checkCredits = async (ctx, next) => {
    const chatId = ctx.from.id;
console.log("🔍 Intentando entrar con ID de Telegram:", chatId);
    // Buscamos al cliente por su telegram_id para obtener su ID interno (el 1, 2, 3...)
    const { data: cliente, error: errorBusqueda } = await supabase
        .from('clientes')
        .select('id, creditos_disponibles')
        .eq('telegram_chat_id', chatId)
        .single();

    if (errorBusqueda || !cliente) {
        return ctx.reply("❌ No estás registrado en el sistema.");
    }

    if (cliente.creditos_disponibles <= 0) {
        return ctx.reply("⚠️ No tienes créditos suficientes.");
    }

    // Llamamos a tu función de descuento
    const { error: errorDescuento } = await supabase.rpc('descontar_creditos', {
        cliente_id_buscado: cliente.id,
        cantidad: 1
    });

    if (errorDescuento) {
        return ctx.reply("⚠️ Error al procesar créditos.");
    }

    // PASO CLAVE: Guardamos el ID interno en la sesión para el controlador
    ctx.session.clienteInternoId = cliente.id;

    return next();
};

module.exports = checkCredits;