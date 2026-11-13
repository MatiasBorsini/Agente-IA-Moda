const supabase = require('../config/supabase');

// Arriba de todo en tu postController.js sumá esto:
const metaService = require('../services/metaService');

const approvePost = async (ctx) => {
    const postId = ctx.match[1];
    
    try {
        await ctx.editMessageReplyMarkup({ reply_markup: null });
        await ctx.answerCallbackQuery({ text: "🚀 Conectando con Instagram..." });

        // 1. Actualizamos en Supabase
        const { error } = await supabase
            .from('posteos')
            .update({ estado: 'aprobado' })
            .eq('id', postId);
            
        if (error) throw error;

        // 2. 🔥 EXCLUSIVO: Disparamos la publicación real en Meta
        // Si falla, va a saltar directo al catch y no va a mentirle al usuario
        await metaService.publicarEnInstagram(postId);

        // 3. Si todo salió bien, recién ahí editamos el diseño en Telegram
        const textoOriginal = ctx.callbackQuery.message.caption || "";
        const entidadesOriginales = ctx.callbackQuery.message.caption_entities || [];

        await ctx.editMessageCaption({
            caption: `✅ **[APROBADO Y PUBLICADO EN REDES]**\n\n${textoOriginal}`,
            parse_mode: "Markdown",
            caption_entities: entidadesOriginales 
        });

    } catch (error) {
        console.error("🔴 Error en approvePost:", error.message);
        await ctx.answerCallbackQuery({ 
            text: `❌ Falló la publicación: ${error.message}`, 
            show_alert: true 
        });
    }
};

const rejectPost = async (ctx) => {
    const postId = ctx.match[1];
    
    try {
        // Borramos los botones al toque para evitar que sigan interactuando
        await ctx.editMessageReplyMarkup({ reply_markup: null });
        await ctx.answerCallbackQuery({ text: "🗑️ Posteo rechazado" });

        const { error } = await supabase
            .from('posteos')
            .update({ estado: 'rechazado' })
            .eq('id', postId);

        if (error) throw error;

        await ctx.editMessageCaption({
            caption: `❌ **Posteo #${postId} rechazado y archivado.**`,
            parse_mode: "Markdown"
        });

    } catch (error) {
        console.error("🔴 Error en rejectPost:", error.message);
        await ctx.answerCallbackQuery({ text: "❌ Error al rechazar.", show_alert: true });
    }
};

module.exports = { approvePost, rejectPost };