const supabase = require('../config/supabase');

async function obtenerPosteoPendiente() {
    const { data, error } = await supabase
        .from('posteos')
        .select('*, productos(nombre)')
        .eq('estado', 'pendiente')
        .limit(1)
        .maybeSingle();
    
    if (error) throw error;
    return data;
}

module.exports = { obtenerPosteoPendiente };