const supabase = require('../src/config/supabase');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function crearPropuestaDePost() {
    console.log("🔍 Buscando productos para generar contenido...");

    const { data: productos, error: errorBusqueda } = await supabase
        .from('productos')
        .select('*')
        .order('score_frescura', { ascending: false })
        .limit(1);

    if (errorBusqueda || !productos?.length) {
        console.log("⚠️ No hay productos disponibles.");
        return;
    }

    const p = productos[0];
    const descripcionValida = p.detalles?.descripcion && !p.detalles.descripcion.includes("Producto:");
    const infoTecnica = descripcionValida ? p.detalles.descripcion : "No disponible (el nombre fue corregido manualmente).";

    console.log(`🤖 Generando copy para: ${p.nombre}...`);

    // Corregimos al modelo estable 1.5-flash
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // REESTRUCTURAMOS EL PROMPT ELIMINANDO EL PRECIO
    const prompt = `Actuá como un Community Manager de un negocio en Villa del Rosario, Córdoba. 
    Escribí un posteo de Instagram basado EXCLUSIVAMENTE en la info que te paso.

    INFO DEL PRODUCTO/SERVICIO:
    - Nombre: ${p.nombre} (Respetá este nombre a rajatabla).
    - Detalles técnicos: ${infoTecnica}

    INSTRUCCIÓN DE SEGURIDAD (CRÍTICO):
    1. Si los "Detalles técnicos" dicen "${infoTecnica}" (no disponible) o si mencionan un producto distinto a "${p.nombre}", IGNORALOS.
    2. En ese caso, usá tu conocimiento para describir qué es y para qué sirve un/a ${p.nombre} de forma profesional y vendedora.

    REGLAS PARA EL TEXTO:
    1. NO uses frases armadas de venta ("canchera", "realzar tu look", "fabuloso", "imperdible") ni tampoco palabras como "cancheras o canchera".
    2. Empezá directo: "Miren lo que entró... 🤩", "Ya tenemos disponible... ✅" o "Si buscabas ${p.nombre}, mirá lo que es esta... 🔥".
    3. Describí para qué sirve o qué tiene de bueno. Si hay data técnica real, usala: ${infoTecnica}. Si no, basate en el producto real.
    4. Si el negocio es técnico (Ferretería/Metalúrgica), hablá de la utilidad o calidad. Si es moda, hablá de la temporada.
    5. CALL TO ACTION (ESTRATEGIA): Como no publicamos precios por la inflación, terminá SIEMPRE invitando al cliente a consultar el precio por mensaje privado (DM) o por WhatsApp.
    6. PREGUNTA FINAL: Hacé una pregunta para generar participación (ej: "¿Te sirve para el laburo?", "¿Qué les parece este modelo?", "¿Ya conocían esta marca?").
    7. Hashtags: 3 o 4 (incluí siempre #VillaDelRosario y el rubro si lo sabés).

    Respondé SOLO con el texto del posteo.`;

    try {
        const result = await model.generateContent(prompt);
        const copyGenerado = result.response.text();

        console.log("🚀 Insertando propuesta en la tabla 'posteos'...");

        // HACEMOS COINCIDIR LAS COLUMNAS CON TU POSTCONTROLLER (texto_final)
        const { error: errorInsert } = await supabase
            .from('posteos')
            .insert([{
                producto_id: p.id,
                texto_final: copyGenerado, // <-- Cambiado de texto_generado a texto_final
                imagen_url: p.imagen_url, // Viene directo de la URL pública de Supabase Storage
                estado: 'pendiente'
            }]);

        if (errorInsert) throw errorInsert;

        // 3. Bajamos la frescura para rotar productos
        await supabase.from('productos').update({ score_frescura: p.score_frescura - 0.2 }).eq('id', p.id);

        console.log("🎉 ¡Propuesta de la IA creada con éxito!");

    } catch (error) {
        if (error.message.includes("429")) {
            console.error("⚠️ Límite de API alcanzado. Esperá un momento.");
        } else {
            console.error("❌ Error en la generación:", error.message);
        }
    }
}

crearPropuestaDePost();