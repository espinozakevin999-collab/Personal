# Cómo probar el Diagnóstico Share of Wallet

Esto es un primer prototipo — no la versión final. La idea es que lo veas y lo pruebes 2-3 minutos y nos digas qué te parece. Todos los clientes que vas a ver son inventados (ficticios), para no usar ningún dato real de un cliente todavía.

## Qué hace

Cuando un asesor visita a un cliente y contesta unas preguntas rápidas (con qué banco hace sus cambios, si tiene crédito en otro banco, etc.), el sistema:

1. Detecta qué productos de BASE le podríamos ofrecer.
2. Le pone una prioridad de seguimiento (1, 2 o 3).
3. Genera automáticamente dos documentos en PDF: uno para el asesor y un guion de preguntas para la próxima llamada o visita.

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

1. Otra vez en el menú **"Diagnóstico Share of Wallet"**, haz clic en **"Abrir panel de diagnóstico"**.
2. Se va a abrir un panel a la derecha de la pantalla.
3. Busca y elige uno de los clientes de ejemplo (son ficticios) y da clic en **Continuar**.
4. Contesta las preguntas (giro del negocio, con qué banco tiene su captación, con qué banco hace sus cambios, si tiene crédito con otro banco, si recibe cotizaciones de otros bancos). Puedes inventar cualquier respuesta — es solo para ver cómo se comporta.
5. Haz clic en **"Ver resultado y generar entregables"**.
6. En unos segundos vas a ver la prioridad del cliente y las oportunidades detectadas, con dos enlaces: uno para abrir el PDF del asesor y otro para el guion de conversación.

## Qué nos interesa que nos digas

- ¿Las preguntas te parecen las correctas, o falta/sobra alguna?
- ¿El resultado (prioridad + oportunidades) se entiende bien?
- ¿Cómo se ve el PDF? ¿Le falta o le sobra algo?
- Cualquier otra cosa que veas rara o que no funcione — dínoslo tal cual, así ajustamos.

No hace falta que sepas nada de programación para probarlo — todo se usa con clics, como cualquier otra hoja de cálculo.
