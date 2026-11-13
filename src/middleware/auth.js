// middleware/auth.js
const authMiddleware = async (ctx, next) => {
    const telegramId = ctx.from.id;

    // Buscamos al cliente en Supabase por su ID de Telegram
    const { data: cliente, error } = await supabase
        .from('clientes')
        .select('id, nombre')
        .eq('telegram_chat_id', telegramId)
        .single();

    if (error || !cliente) {
        // Si no está en la tabla, el bot no responde lógica
        return ctx.reply("🚫 No estás autorizado para usar este bot. Contactá al administrador.");
    }

    // Si existe, guardamos su ID interno en la sesión para usarlo en los inserts
    ctx.session.clienteInternoId = cliente.id;
    
    // Dejamos que el bot siga con la función que seguía (next)
    return next();
};

// Aplicar el middleware en tu archivo principal
bot.use(authMiddleware);