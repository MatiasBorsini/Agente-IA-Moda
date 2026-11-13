const { Bot, session } = require('grammy');
const productCtrl = require('./src/controllers/productController');
const postCtrl = require('./src/controllers/postController');
// 1. Importás tu middleware de seguridad
const checkCredits = require('./src/middleware/checkCredits'); 

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

bot.use(session({ 
    initial: () => ({ 
        datosTemporales: null, 
        esperandoNombre: false ,
        erroresSeguidos: 0 ,
        procesando: false
    }) 
}));

// 2. APLICACIÓN DEL FILTRO
// Ponemos checkCredits antes del controlador. 
// Grammy ejecutará checkCredits y, si todo está OK (llama a next()), pasará a handlePhoto.
bot.on("message:photo", checkCredits, productCtrl.handlePhoto);

// BOTONES DE PRODUCTO
bot.callbackQuery("confirmar_guardado", productCtrl.confirmSave);
bot.callbackQuery("editar_nombre", productCtrl.askNewName);
bot.callbackQuery("cancelar_carga", (ctx) => {
    ctx.session.datosTemporales = null;
    ctx.session.esperandoNombre = false;
    ctx.session.procesando = false;
    return ctx.editMessageText("Carga cancelada.");
});

// BOTONES DE POSTEO
bot.callbackQuery(/^aprobar_(\d+)$/, postCtrl.approvePost);
bot.callbackQuery(/^rechazar_(\d+)$/, postCtrl.rejectPost);

// ESCUCHAR TEXTO
bot.on("message:text", productCtrl.handleNewName);

bot.start();