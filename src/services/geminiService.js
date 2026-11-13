const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function analizarProducto(input) {
  try {
    // Mantenemos tu modelo 2.0 Flash
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

    let imageBase64;

    if (typeof input === "string" && input.startsWith("http")) {
      const response = await fetch(input);
      const buffer = await response.arrayBuffer();
      imageBase64 = Buffer.from(buffer).toString("base64");
    } else {
      imageBase64 = input.toString("base64");
    }

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: "image/jpeg",
      },
    };

    // Prompt adaptado a Argentina y corregido para evitar errores de vocabulario
    const prompt = `Actuá como un experto en e-commerce de Argentina. Mirá esta foto y extraé la información técnica.
    
    REGLAS CRÍTICAS DE IDIOMA (USAR TERMINOLOGÍA ARGENTINA):
    1. CHALINA: Accesorio de cuello de tela liviana, seda, viscosa o hilo fino. Es para media estación.
    2. BUFANDA: Accesorio de cuello de lana gruesa o tejido pesado, exclusivamente para invierno.
    3. RUANA: Prenda grande y pesada que cubre hombros y espalda, similar a un poncho pero abierta. Suele ser de lana o paño

    - Usar "Remera" en lugar de "Camiseta".
    - Usar "Campera" en lugar de "Chaqueta".
    - Usar "Medias" en lugar de "Calcetines".
    - Usar "Zapatillas" en lugar de "Tenis".

    Extraé:
    1. Nombre exacto del producto (usando las reglas de arriba).
    2. Categoría.
    4. Descripción de 10 palabras con tono (no uses palabras genéricas como canchera , etc).
    
    Respondé ÚNICAMENTE en formato JSON puro:
    {"producto": "nombre", "categoria": "cat", "descripcion": "desc"}`;

    const result = await model.generateContent([prompt, imagePart]);
    const textoRespuesta = result.response.text();
    
    const jsonLimpio = textoRespuesta.replace(/```json|```/g, "").trim();
    const datos = JSON.parse(jsonLimpio);
    if (!datos || typeof datos.producto !== 'string' || !datos.producto.trim() ||
        typeof datos.descripcion !== 'string' || typeof datos.categoria !== 'string') {
      throw new Error('La respuesta de IA no contiene los datos esperados');
    }
    return datos;
  } catch (error) {
    console.error("Error al analizar en geminiService.js:", error);
    return null;
  }
}

module.exports = { analizarProducto };
