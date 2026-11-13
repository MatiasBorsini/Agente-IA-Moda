// ./src/services/imageService.js
const sharp = require('sharp');

/**
 * Procesa un buffer de imagen: lo hace cuadrado (1080x1080), 
 * mejora sutilmente la calidad visual y lo comprime en JPEG.
 * @param {Buffer} bufferOriginal - El buffer de la foto descargada de Telegram.
 * @returns {Promise<Buffer>} - El buffer de la imagen optimizada listo para subir.
 */
const optimizarParaInstagram = async (bufferOriginal) => {
    try {
        console.log("🎨 Optimizando y encuadrando imagen para Instagram...");
        
        const imagenProcesada = await sharp(bufferOriginal)
            // 1. Redimensionamos a 1080x1080. 
            // 'contain' hace que la foto entre entera. 
            // Si sobran bordes, los pinta de blanco (podés cambiarlo por negro o gris)
            .resize(1080, 1080, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 } 
            })
            // 2. Un toque sutil de nitidez (sharp) para que resalten los detalles del producto
            .sharpen()
            // 3. Ajuste leve de contraste/brillo si quisieras (opcional, usando .modulate)
            // .modulate({ brightness: 1.02, contrast: 1.05 }) 
            // 4. Lo transformamos a JPEG optimizado para web con calidad 85% (es el balance perfecto peso/calidad)
            .jpeg({ quality: 85, mozjpeg: true })
            .toBuffer();

        return imagenProcesada;
    } catch (error) {
        console.error("🔴 Error en imageService:", error.message);
        // Si por alguna razón falla el procesamiento, devolvemos el original para no romper el flujo
        return bufferOriginal; 
    }
};

module.exports = {
    optimizarParaInstagram
};