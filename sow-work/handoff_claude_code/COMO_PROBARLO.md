# Cómo probar el Diagnóstico Share of Wallet

Esto es un primer prototipo — no la versión final. La idea es que lo veas y lo pruebes 2-3 minutos y nos digas qué te parece. Todos los clientes que vas a ver son inventados (ficticios), para no usar ningún dato real de un cliente todavía.

## Qué hace

Cuando un asesor visita a un cliente y contesta unas preguntas rápidas (con qué banco hace sus cambios, si tiene crédito en otro banco, etc.), el sistema:

1. Detecta qué productos de BASE le podríamos ofrecer.
2. Le pone una prioridad de seguimiento (1, 2 o 3).
3. Genera automáticamente dos documentos en PDF: uno para el asesor y un guion de preguntas para la próxima llamada o visita.
4. Guarda la visita, para que la próxima vez que busques a ese cliente te recuerde qué quedó pendiente.

Todo pasa dentro de Google Sheets, con las ventanitas normales de Google. No hay ningún panel ni página aparte que abrir.

## Paso 1 — Abrir la hoja de cálculo

Abre el enlace de Google Sheets que viene en este mismo correo. Es una hoja de prueba — no tiene información real.

## Paso 2 — Correr la autoprueba (solo la primera vez)

1. En el menú de arriba de la hoja, busca **"Diagnóstico Share of Wallet"** (está junto a Archivo, Editar, Ver, etc.).
2. Haz clic ahí y luego en **"Ejecutar autopruebas del motor"**.
3. La primera vez, Google te va a pedir permiso para que el script funcione. Es normal — es tu propia hoja, así que puedes aceptar:
   - Elige tu cuenta.
   - Si dice "Google no verificó esta app", haz clic en **Avanzado** y luego en **Ir a "Diagnóstico Share of Wallet - Prototipo" (no seguro)**. Esto pasa porque es un script interno nuestro, no uno público — es seguro aceptarlo.
   - Haz clic en **Permitir**.
4. Te va a salir un mensaje que dice "Autopruebas completas". Eso significa que todo está funcionando bien por dentro.

## Paso 3 — Probar el diagnóstico completo

1. Otra vez en el menú **"Diagnóstico Share of Wallet"**, haz clic en **"Generar diagnóstico"**. Es la única opción para esto — no hay nada más que elegir.
2. Te va a ir preguntando de una en una, en ventanitas:
   - **Qué cliente.** Si ya hay clientes guardados, primero te pregunta si quieres buscar uno de antes o registrar uno nuevo. Si ya son muchos, te deja buscarlo escribiendo una parte del nombre (no importan mayúsculas ni acentos). Al elegir uno ya visitado, te recuerda qué quedó pendiente la vez pasada.
   - **Giro del negocio**, y **con qué banco tiene su captación y sus cambios.** En las listas, escribe solo el número de la opción. Si el banco no está en la lista, elige "Otro (especifica)" y escríbelo.
   - **Si tiene crédito con otro banco** (y con cuál).
   - **Si recibe cotizaciones** de otros bancos.
   - **Si quieres capturar montos aproximados.** Es opcional: si dices que sí, te pregunta cuánto compra y vende de divisas y cuánto exporta e importa al mes. Puedes dejar vacía cualquiera de esas cuatro. Sirven para que los documentos traigan cifras en vez de "N/D".
   - **Si quedó algo pendiente** para la próxima visita.

   Puedes inventar cualquier respuesta — es solo para ver cómo se comporta.
3. **Si te equivocas**, puedes regresar a la pregunta anterior: escribe **0** en las preguntas de lista, o la palabra **volver** en las de escribir. Y si le das a Cancelar sin querer, primero te pregunta qué quieres hacer — no se pierde lo que ya llevabas contestado.
4. Al terminar vas a ver la prioridad del cliente y las oportunidades detectadas, con dos enlaces: uno para abrir el PDF del asesor y otro para el guion de conversación.

> **Nota:** la primera vez que uses "Generar diagnóstico", Google puede tardar unos segundos en crear el archivo donde se guardan los datos. Es normal y solo pasa una vez.

## Dónde quedan guardados los datos

En un archivo de Google Sheets **aparte** (no en esta hoja de prueba), que se crea solo la primera vez. Ahí quedan dos pestañas: una con cada visita y otra con un renglón por cliente.

En el mismo menú tienes dos opciones más:

- **"Abrir la base de datos de clientes"** — para ver ese archivo, o para compartirlo con otro asesor.
- **"Reconectar la base de datos"** — solo se usa si el sistema te avisa que no puede abrirla.

> **Importante si van a usarlo varios asesores:** ese archivo lo crea y lo posee la primera persona que use la herramienta. Si quieren ver todos el mismo historial, hay que compartirlo con los demás (ábrelo con la opción de arriba y compártelo como cualquier hoja de Google).

## Qué nos interesa que nos digas

- ¿Las preguntas te parecen las correctas, o falta/sobra alguna?
- ¿El orden en que se preguntan se siente natural?
- ¿El resultado (prioridad + oportunidades) se entiende bien?
- ¿Cómo se ve el PDF? ¿Le falta o le sobra algo?
- Cualquier otra cosa que veas rara o que no funcione — dínoslo tal cual, así ajustamos.

No hace falta que sepas nada de programación para probarlo — todo se usa con clics, como cualquier otra hoja de cálculo.
