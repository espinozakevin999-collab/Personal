# Cómo probar el Diagnóstico Share of Wallet

Esto es un primer prototipo — no la versión final. La idea es que lo veas y lo pruebes 2-3 minutos y nos digas qué te parece. Todos los clientes que vas a ver son inventados (ficticios), para no usar ningún dato real de un cliente todavía.

## Qué hace

Cuando un asesor visita a un cliente y contesta unas preguntas rápidas (con qué banco hace sus cambios, si tiene crédito en otro banco, etc.), el sistema:

1. Detecta qué productos de BASE le podríamos ofrecer.
2. Le pone una prioridad de seguimiento (1, 2 o 3).
3. Genera automáticamente dos documentos en PDF: uno para el asesor y un guion de preguntas para la próxima llamada o visita.
4. Guarda la visita, para que la próxima vez que busques a ese cliente te recuerde qué quedó pendiente.

Todo pasa dentro de Google Sheets, en un panel que se abre a la derecha de la pantalla. No hay ninguna página ni programa aparte que instalar.

## Antes de empezar — un ajuste del navegador (1 minuto)

El panel se comunica con Google por dentro, y **algunos navegadores bloquean esa comunicación** por su configuración de privacidad. Si te pasa, el panel se ve bien pero no responde al dar clic.

Para evitarlo, usa **Google Chrome** y revisa esto una sola vez:

1. Abre `chrome://settings/cookies` (cópialo en la barra de direcciones).
2. Asegúrate de **no** tener seleccionado "Bloquear cookies de terceros".
   - Si tu organización te obliga a tenerlo bloqueado, baja a "Sitios que siempre pueden usar cookies", dale a **Agregar**, escribe `[*.]google.com` y marca la casilla de incluir cookies de terceros.
3. Vuelve a cargar la hoja de cálculo.

> Si algo del panel no responde, es casi seguro esto. Avísanos y lo resolvemos.

## Paso 1 — Abrir la hoja de cálculo

Abre el enlace de Google Sheets que viene en este mismo correo. Es una hoja de prueba — no tiene información real.

## Paso 2 — Dar permiso (solo la primera vez)

1. En el menú de arriba busca **"Diagnóstico Share of Wallet"** (está junto a Archivo, Editar, Ver, etc.).
2. Haz clic ahí y luego en **"Ejecutar autopruebas del motor"**.
3. Google te va a pedir permiso para que el script funcione. Es normal — es tu propia hoja, así que puedes aceptar:
   - Elige tu cuenta.
   - Si dice "Google no verificó esta app", haz clic en **Avanzado** y luego en **Ir a "Diagnóstico Share of Wallet - Prototipo" (no seguro)**. Esto pasa porque es un script interno nuestro, no uno público — es seguro aceptarlo.
   - Haz clic en **Permitir**.
4. Te va a salir un mensaje diciendo cuántas pruebas pasaron. Eso significa que todo está funcionando bien por dentro.

## Paso 3 — Abrir el panel y probarlo

1. Otra vez en el menú **"Diagnóstico Share of Wallet"**, haz clic en **"Abrir panel de diagnóstico"**.
2. Se abre un panel a la derecha con **tres opciones**:
   - **Abrir panel de diagnóstico** (la principal, resaltada en amarillo) — capturar una visita.
   - **Ver historial de diagnósticos** — qué prioridad quedó y qué pendiente dejaste en cada cliente.
   - **Ejecutar autopruebas del motor** — la misma revisión del paso anterior.
3. Entra a la primera opción. Te va a pedir:
   - **El cliente.** Escribe un nombre. Si ya lo visitaste antes aparece en la lista con lo que quedó pendiente; si es nuevo, te ofrece usar el nombre que escribiste.
   - **Giro del negocio** y **con qué banco tiene su captación y sus cambios.** Si el banco no está en la lista, elige "Otro (especifica)" y escríbelo.
   - **Si tiene crédito con otro banco** (y con cuál).
   - **Si recibe cotizaciones** de otros bancos.
   - **Datos adicionales (opcional).** Si lo abres, puedes capturar cuánto compra y vende de divisas y cuánto exporta e importa al mes, y qué quedó pendiente. Todo es opcional, pero si lo llenas los documentos salen con cifras en vez de "N/D".

   Puedes inventar cualquier respuesta — es solo para ver cómo se comporta.
4. Dale a **"Ver resultado y generar entregables"**. En unos segundos verás la prioridad del cliente, las oportunidades detectadas y dos enlaces: el PDF del asesor y el guion de conversación.
5. **"Nuevo diagnóstico"** te regresa a las tres opciones del inicio.

> Si no contestaste algo obligatorio, el panel te lo dice y te marca en rojo qué falta. Es a propósito: sin esos datos el resultado no significaría nada.

## Dónde quedan guardados los datos

En un archivo de Google Sheets **aparte** (no en esta hoja de prueba), que se crea solo la primera vez. Ahí quedan dos pestañas: una con cada visita y otra con un renglón por cliente.

En el mismo menú tienes dos opciones más:

- **"Abrir la base de datos de clientes"** — para ver ese archivo, o compartirlo con otro asesor.
- **"Reconectar la base de datos"** — solo se usa si el sistema te avisa que no puede abrirla.

> **Importante si van a usarlo varios asesores:** ese archivo lo crea y lo posee la primera persona que use la herramienta. Si quieren ver todos el mismo historial, hay que compartirlo con los demás.

## Qué nos interesa que nos digas

- ¿Las preguntas te parecen las correctas, o falta/sobra alguna?
- ¿El orden en que se preguntan se siente natural?
- ¿El resultado (prioridad + oportunidades) se entiende bien?
- ¿Cómo se ve el PDF? ¿Le falta o le sobra algo?
- Cualquier otra cosa que veas rara o que no funcione — dínoslo tal cual, así ajustamos.

No hace falta que sepas nada de programación para probarlo — todo se usa con clics, como cualquier otra hoja de cálculo.
