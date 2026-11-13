const supabase = require('../config/supabase');

/**
 * Publica un posteo aprobado directamente en el feed de Instagram del cliente
 * @param {string|number} postId - El ID del registro en la tabla 'posteos'
 */
const publicarEnInstagram = async (postId) => {
    try {
        // 1. Traemos toda la info del posteo y los tokens de acceso del cliente desde Supabase
        // Asumo que tenés una relación o guardás el token en una tabla vinculada al cliente
        const { data: posteo, error: errorPosteo } = await supabase
            .from('posteos')
            .select(`
                id,
                texto_final,
                imagen_url,
                cliente_id,
                clientes (
                    instagram_business_id,
                    meta_access_token
                )
            `)
            .eq('id', postId)
            .single();

        if (errorPosteo || !posteo) throw new Error("No se pudo obtener la información del posteo o el cliente.");

        const { instagram_business_id, meta_access_token } = posteo.clientes;
        const urlImagen = posteo.imagen_url;
        const texto = posteo.texto_final;

        if (!instagram_business_id || !meta_access_token) {
            throw new Error(`El cliente #${posteo.cliente_id} no tiene configuradas sus credenciales de Meta.`);
        }

        console.log(`🚀 Iniciando publicación en Instagram para el cliente #${posteo.cliente_id}...`);

        // PASO A: Crear el contenedor del ítem de la red (Media Container)
        const urlContenedor = `https://graph.facebook.com/v19.0/${instagram_business_id}/media`;
        const resContenedor = await fetch(urlContenedor, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_url: urlImagen,
                caption: texto,
                access_token: meta_access_token
            })
        });

        const datosContenedor = await resContenedor.json();
        if (!resContenedor.ok) throw new Error(`Meta Contenedor Error: ${datosContenedor.error?.message || 'Error desconocido'}`);

        const creationId = datosContenedor.id; // Este es el ID del contenedor temporal de la foto

        // PASO B: Publicar el contenedor en el Feed
        const urlPublicar = `https://graph.facebook.com/v19.0/${instagram_business_id}/media_publish`;
        const resPublicar = await fetch(urlPublicar, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creation_id: creationId,
                access_token: meta_access_token
            })
        });

        const datosPublicar = await resPublicar.json();
        if (!resPublicar.ok) throw new Error(`Meta Publish Error: ${datosPublicar.error?.message || 'Error desconocido'}`);

        console.log(`✅ ¡Posteo publicado en Instagram con éxito! ID de Meta: ${datosPublicar.id}`);
        return datosPublicar.id; // Retorna el ID real del post en Instagram

    } catch (error) {
        console.error("🔴 Error crítico en metaService:", error.message);
        throw error; // Re-lanzamos el error para que lo ataje el controlador
    }
};

module.exports = {
    publicarEnInstagram
};