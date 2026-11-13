# Agente IA Moda — Automatización de contenido comercial

![JavaScript](https://img.shields.io/badge/JavaScript-ES-efd81d?logo=javascript&logoColor=black) ![Node.js](https://img.shields.io/badge/Node.js-runtime-339933?logo=nodedotjs&logoColor=white) ![Telegram](https://img.shields.io/badge/Telegram-bot-26A5E4?logo=telegram&logoColor=white) ![Supabase](https://img.shields.io/badge/Supabase-datos-3FCF8E?logo=supabase&logoColor=white) ![Gemini](https://img.shields.io/badge/Google-Gemini-8E75B2?logo=googlegemini&logoColor=white)

Prototipo de bot para comercios que ayuda a transformar fotografías de productos en propuestas de texto comercial para Instagram. La persona revisa el producto detectado antes de guardarlo. La generación de la propuesta se ejecuta por separado y requiere revisión humana: la IA puede equivocarse o inventar características.

## Funcionalidades

**Implementadas en código:** recepción de fotos en Telegram; control de cliente y créditos; optimización de imágenes con Sharp; almacenamiento en Supabase; análisis de nombre, categoría y descripción con Gemini; corrección del nombre y confirmación; generación de copy y hashtags mediante un script; notificación con botones de aprobación y rechazo.

**Parciales o por validar:** el proceso requiere varios scripts; no hay editor del copy ni historial consultable desde el bot. El notificador evita reenvíos solo mientras sigue activo; tras reiniciarlo puede volver a enviar propuestas pendientes. La publicación en Meta está implementada pero requiere validar datos, asociación del cliente, permisos y estados; no forma parte de la demostración recomendada.

**Pendiente:** validación integral con servicios reales, persistencia de deduplicación entre reinicios, revisión de seguridad y recuperación de errores de publicación. El proyecto no publica automáticamente una propuesta al generarla; el botón de aprobación intenta publicarla, por lo que no debe usarse durante una demostración segura.

## Tecnologías y arquitectura

JavaScript, Node.js, grammY, Google Generative AI SDK, Supabase JS, Sharp y dotenv. Node.js 22 es una opción para ejecutar el proyecto; las pruebas usan `node:test`.

```text
Usuario → foto en Telegram → bot + validación de créditos
       → Sharp → Supabase Storage → Gemini (análisis)
       → revisión humana → producto en Supabase
       → script independiente → Gemini (copy) → posteo pendiente
       → notificador → Telegram → revisión humana
       → [opcional, sin validar] aprobación → Meta / Instagram
```

El análisis utiliza el modelo configurado `gemini-2.5-flash`; la redacción utiliza `gemini-1.5-flash`. Su disponibilidad depende del proveedor y de la cuenta. Las imágenes se almacenan en un bucket cuya URL se trata como pública: no usar fotografías privadas sin revisar la configuración.

## Requisitos y configuración

- Node.js 22 y npm; bot y chat de Telegram configurados.
- Proyecto Supabase, bucket `imagenes-productos`, tablas `clientes`, `productos`, `posteos` y funciones RPC `descontar_creditos` y `reembolsar_credito` compatibles con las consultas del código. El esquema SQL no está incluido; debe prepararse por separado. Las políticas, permisos y asociaciones deben verificarse en el proyecto propio.
- Acceso a Gemini y modelos configurados. El uso de servicios puede generar costos.
- Para la integración opcional de Meta: cuenta y permisos compatibles, e `instagram_business_id` y `meta_access_token` en el cliente relacionado. No está validada de extremo a extremo.

Variables locales, sin compartir sus valores:

| Variable | Uso |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto Supabase. |
| `SUPABASE_SERVICE_KEY` | Clave privilegiada de servidor; nunca exponerla en clientes ni subirla a Git. |
| `TELEGRAM_BOT_TOKEN` | Token del bot. |
| `TELEGRAM_CHAT_ID` | Destino de las notificaciones. |
| `GEMINI_API_KEY` | Acceso a Gemini. |

## Instalación y ejecución

```powershell
git clone https://github.com/MatiasBorsini/Agente-IA-Moda.git
cd Agente-IA-Moda
npm ci
Copy-Item .env.example .env
```

Completá `.env` localmente con tus propias credenciales. No lo compartas ni lo subas. El enlace de clonación requiere que el repositorio exista y que la cuenta tenga acceso. Prepará los recursos de Supabase antes de iniciar.

```powershell
node bot.js                      # recibe fotos y gestiona las respuestas
node scripts/agente_creador.js   # genera una propuesta y termina
node scripts/notificar.js        # busca al iniciar y cada cinco minutos
```

Ejecutá el bot y el notificador en terminales separadas. Tras confirmar un producto, ejecutá el generador manualmente: el bot no lo inicia por sí solo. El generador selecciona el producto con mayor puntuación de frescura global, sin filtrar por cliente; usá solo datos de prueba controlados. El notificador consulta todos los pendientes, envía una foto por propuesta y reintenta fallos mientras sigue activo. Una propuesta sin imagen o texto queda pendiente. La sesión y la deduplicación son temporales y se pierden al reiniciar; no ejecutar múltiples notificadores simultáneos.

## Pruebas y demostración

`npm test` ejecuta pruebas locales con datos ficticios y mocks, sin servicios externos. No demuestra que las integraciones reales funcionen.

Para una demostración real controlada, utilizá una foto ficticia o autorizada, un cliente y productos de prueba, y servicios configurados. Iniciá los procesos, enviá la foto, revisá la identificación, corregí el nombre si hace falta, confirmá y ejecutá el generador. Mostrá la propuesta recibida sin pulsar **Aprobar**; ese botón intenta publicar en Instagram. Antes comprobá los costos, el modelo disponible y los datos del entorno. Prepará capturas de una ejecución propia sin datos personales como alternativa a depender de la conexión.

## Limitaciones y seguridad

- Gemini puede devolver información incorrecta; verificar descripción y texto antes de usarlos. El prompt puede completar detalles faltantes con conocimiento del modelo.
- No se ha comprobado el flujo completo con servicios reales en esta preparación. La disponibilidad del modelo de generación y la estructura de la base deben verificarse.
- Al aprobar, el código marca el posteo aprobado antes de llamar a Meta; si falla, el estado puede quedar inconsistente. El generador no establece explícitamente `cliente_id` en el posteo, mientras Meta lo necesita. No se validó autorización por propietario en los callbacks.
- Cancelar una carga no reembolsa automáticamente el crédito. Los intentos de reembolso y la persistencia de la sesión necesitan una revisión adicional. Los archivos subidos pueden permanecer en Storage si se cancela o falla el flujo.
- El servicio usa una clave privilegiada; protegé el entorno y revisá accesos, políticas y privacidad de Storage. No uses datos de clientes reales para pruebas sin las medidas adecuadas.
- `scripts/frescura.js` define una función, pero no la ejecuta; no hay un programador de tareas incluido.

## Capturas

Espacio reservado para capturas reales autorizadas del análisis, confirmación y propuesta. No se incluyen imágenes ni conversaciones privadas.

## Autor y uso académico

**Matías Borsini**, estudiante de Desarrollo de Software. Proyecto de automatización presentado como parte de su portafolio profesional y académico.
