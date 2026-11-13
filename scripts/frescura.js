// Si usas el archivo de configuración que creamos:
const supabase = require('../src/config/supabase');

async function envejecerProductos() {
    // Bajamos 0.1 de frescura a todos los productos cada vez que corre
    const { data, error } = await supabase.rpc('envejecer_frescura'); 
    // Si no querés usar funciones SQL, lo hacemos simple:
    const { data: productos } = await supabase.from('productos').select('id, score_frescura');
    
    for (const p of productos) {
        await supabase.from('productos')
            .update({ score_frescura: Math.max(0, p.score_frescura - 0.05) })
            .eq('id', p.id);
    }
    console.log("📉 Frescura actualizada.");
}