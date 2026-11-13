const { Bot, InlineKeyboard } = require('grammy');

// La deduplicación dura solo mientras este proceso permanezca activo.
function crearNotificador({ db, api, chatId, enviados = new Set() }) {
    let ejecutando = false;
    return async function enviarNotificaciones() {
        if (ejecutando) return;
        ejecutando = true;
        try {
            const { data: posts, error } = await db.from('posteos')
                .select('id, texto_final, imagen_url, productos(nombre)')
                .eq('estado', 'pendiente');
            if (error) throw error;
            for (const post of posts || []) {
                if (enviados.has(post.id)) continue;
                if (!post.texto_final || !post.imagen_url) {
                    console.error(`Propuesta ${post.id} incompleta; queda pendiente.`);
                    continue;
                }
                const teclado = new InlineKeyboard()
                    .text('✅ Aprobar', `aprobar_${post.id}`)
                    .text('❌ Rechazar', `rechazar_${post.id}`);
                try {
                    // Sin Markdown: el contenido generado puede incluir caracteres especiales.
                    await api.sendPhoto(chatId, post.imagen_url, {
                        caption: `📝 PROPUESTA DE POSTEO\n\n${post.texto_final}\n\n¿Deseas publicar esto?`,
                        reply_markup: teclado,
                    });
                    enviados.add(post.id);
                } catch (errorEnvio) {
                    console.error(`No se pudo enviar la propuesta ${post.id}; se reintentará.`);
                }
            }
        } catch (error) {
            console.error('No se pudieron consultar las propuestas pendientes.');
        } finally {
            ejecutando = false;
        }
    };
}

if (require.main === module) {
    const supabase = require('../src/config/supabase');
    const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
    const enviar = crearNotificador({ db: supabase, api: bot.api, chatId: process.env.TELEGRAM_CHAT_ID });
    enviar();
    setInterval(enviar, 5 * 60 * 1000);
}

module.exports = { crearNotificador };
