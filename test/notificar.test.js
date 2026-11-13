const test = require('node:test');
const assert = require('node:assert/strict');
const { crearNotificador } = require('../scripts/notificar');

function setup(posts, sendPhoto) {
  const db = { from: () => ({ select: () => ({ eq: async () => ({ data: posts, error: null }) }) }) };
  return crearNotificador({ db, api: { sendPhoto }, chatId: 'chat-ficticio' });
}

test('envía texto_final una sola vez por proceso y procesa todas las propuestas', async () => {
  const llamadas = [];
  const enviar = setup([
    { id: 1, texto_final: 'Texto de prueba', imagen_url: 'https://example.invalid/1.jpg' },
    { id: 2, texto_final: 'Otra propuesta', imagen_url: 'https://example.invalid/2.jpg' },
  ], async (...args) => llamadas.push(args));
  await enviar(); await enviar();
  assert.equal(llamadas.length, 2);
  assert.match(llamadas[0][2].caption, /Texto de prueba/);
  assert.ok(llamadas[0][2].reply_markup);
});

test('reintenta un envío fallido sin bloquear otros', async () => {
  let intentos = 0;
  const enviar = setup([{ id: 1, texto_final: 'Prueba', imagen_url: 'imagen' }], async () => {
    if (++intentos === 1) throw new Error('error ficticio');
  });
  await enviar(); await enviar(); await enviar();
  assert.equal(intentos, 2);
});
