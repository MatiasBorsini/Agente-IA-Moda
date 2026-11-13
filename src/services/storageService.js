const supabase = require('../config/supabase');

/**
 * Sube un buffer de imagen al Storage de Supabase y devuelve la URL pública eterna.
 * @param {Buffer} buffer - El archivo de la imagen en memoria.
 * @param {string} clienteId - Para organizar las fotos por carpeta de cliente.
 * @}
 */
const subirImagenProducto = async (buffer, clienteId) => {
    try {
        // Generamos un nombre de archivo único usando la fecha para que no se pisen
        const nombreArchivo = `${clienteId}/${Date.now()}_producto.jpg`;

        // 1. Subimos el Buffer al bucket 'imagenes-productos'
        const { data, error } = await supabase.storage
            .from('imagenes-productos')
            .upload(nombreArchivo, buffer, {
                contentType: 'image/jpeg',
                upsert: true // Si por alguna razón se repite el nombre, lo pisa
            });

        if (error) throw error;

        // 2. Obtenemos la URL pública del archivo que acabamos de subir
        const { data: publicUrlData } = supabase.storage
            .from('imagenes-productos')
            .getPublicUrl(nombreArchivo);

        console.log(`✨ Imagen subida al Storage. URL: ${publicUrlData.publicUrl}`);
        
        return publicUrlData.publicUrl; // Esto devuelve el link real (https://...)

    } catch (error) {
        console.error("🔴 Error en storageService (subirImagenProducto):", error.message);
        throw error;
    }
};

module.exports = { subirImagenProducto };