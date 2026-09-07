# Diagnóstico Share of Wallet — Banco BASE
## Paquete de handoff para Claude Code

Este paquete reúne todo lo necesario para que **Claude Code** (corriendo en tu máquina, con acceso real a tu proyecto de Apps Script / Google Sheets) continúe el desarrollo de este prototipo sin perder el contexto de negocio que ya se construyó en esta conversación.

No es un proyecto nuevo: es la continuación de un prototipo ya funcional. Todo lo estratégico (reuniones, decisiones de Gustavo/Julián/Nico, gobernanza, pendientes) vive en el **vault** del Project de Claude ("01 - Banco BASE | Salesforce Analytics" → `claude/vault-orquestacion-comercial.md`). Este README es un resumen técnico para que Claude Code no tenga que leer todo el vault para orientarse — pero si necesita el detalle completo de una decisión de negocio, esa es la fuente de verdad.

---

## 1. Qué es esto (lógica del negocio, resumida)

Banco BASE quiere que cada asesor comercial, al visitar a un cliente, capture unas cuantas preguntas de "Share of Wallet" (con qué banco hace sus cambios, si tiene crédito en otro banco, si recibe cotizaciones de la competencia, etc.) y que el sistema, automáticamente:

1. Detecte **oportunidades** de producto (divisas, crédito, comercio exterior, captación) comparando la respuesta contra una tabla de reglas editable.
2. Clasifique al cliente en una **prioridad de seguimiento** (1/2/3) combinando tres señales: brecha (¿la mayoría de sus operaciones están fuera de BASE?), palanca (¿sus bancos están repartidos o concentrados en uno solo?) y competitividad (¿ya compara activamente con otros bancos?).
3. Genere automáticamente dos entregables en PDF: uno para el asesor (oportunidades + prioridad) y un guion de conversación (preguntas de descubrimiento ancladas a cada oportunidad).

Decisión de arquitectura ya tomada (no renegociable sin hablar con Nico primero): **los datos de clientes no pueden salir del entorno de Banco BASE**. Por eso todo vive en Google Sheets + Apps Script nativo — se descartó explícitamente Supabase, IA externa (Gemini) para generar recomendaciones, y cualquier add-on de Marketplace de terceros que pida permisos amplios sobre Drive.

## 2. Arquitectura actual

```
Google Sheet (proyecto de Apps Script)
│
├─ Menú "Diagnóstico Share of Wallet"  (Sidebar_UI.gs → onOpen())
│    ├─ "Abrir panel de diagnóstico"             → mostrarPanelDiagnostico()
│    ├─ "Abrir la base de datos de clientes"     → abrirBaseDeDatosDeClientes()
│    ├─ "Reconectar la base de datos"            → reconectarBaseDeDatosDeClientes()
│    └─ "Ejecutar autopruebas del motor"         → ejecutarPruebasMotorReglasConAlerta()
│
├─ Sidebar.html   (toda la experiencia visual)
│    paso 0: pantalla de opciones (el "menú" con tarjetas e iconos)
│    paso 1: buscar o registrar cliente (muestra su memoria)
│    paso 2: preguntas + bloque opcional de montos
│    paso 3: resultado con los dos enlaces
│    → google.script.run → listarClientes() / guardarRespuestaYGenerar()
│                          / correrAutopruebasDesdeSidebar()
│
├─ Sidebar_UI.gs   (solo pregunta, guarda y muestra — cero lógica de negocio)
│    ├─ guardarRespuestaYGenerar()   → genera primero, guarda después
│    ├─ listarClientes()             → memoria de clientes para el panel
│    ├─ guardarVisita_()             → "Respuestas" + "Clientes" bajo un candado
│    └─ obtenerBaseDeDatosSegura_()  → Sheet aparte, ID en PropertiesService
│
└─ prototipo_entregables_sow.gs  (el motor real — NO tocar sin correr las pruebas)
     ├─ TABLA_REGLAS            → reglas de oportunidad por producto
     ├─ evaluarReglas()         → motor de reglas → lista de oportunidades
     ├─ clasificarPrioridad()   → árbol de prioridad del cliente
     ├─ generarPDFAsesor() / generarGuionConversacion()  → Docs → PDF → Drive
     ├─ generarEntregables()    → orquestador, punto de entrada único
     └─ ejecutarPruebasMotorReglas()  → autopruebas dentro de Apps Script
```

**Por qué el "menú de opciones" vive dentro del panel:** el menú nativo de Sheets no se puede estilizar (chrome propio de Google — sin color, sin iconos, sin jerarquía visual). Por eso el menú del mockup se reprodujo como pantalla de inicio del panel, que sí es HTML propio. El menú de Sheets es solo la puerta de entrada.

**RIESGO CONOCIDO — el puente `google.script.run`:** el panel se dibuja bien, pero sus llamadas al servidor fallan cuando el navegador bloquea cookies/almacenamiento de terceros para el iframe del panel. Ya pasó en Microsoft Edge (prevención de rastreo) y se reprodujo el 7 de sept en Chrome: `listarClientes` aparece en el registro de ejecuciones como *Fallida, 0 s, tipo Desconocida* — o sea, ni siquiera entró a la función. El motor y los PDF no tienen nada que ver: `probarPrototipo` corre completo en 9.5 s. Antes de dar el panel por bueno hay que verificar la configuración de cookies de terceros (ver COMO_PROBARLO.md).

Principio de diseño a mantener: **una sola fuente de verdad para la lógica de negocio.** `Sidebar_UI.gs` nunca debe reimplementar reglas — siempre llama a `generarEntregables()`. Si agregas una vía nueva de entrada (por ejemplo un trigger automático, o una integración con Salesforce), que también pase por esa misma función.

## 3. Archivos incluidos en este paquete

| Archivo | Qué es | Estado |
|---|---|---|
| `prototipo_entregables_sow.gs` | Motor de reglas + árbol de prioridad + generación de PDFs | Funcional y probado en vivo (`probarPrototipo` completa en 9.5 s) |
| `Sidebar_UI.gs` | Menú, servidor del panel y base de datos de clientes | 36/36 pruebas locales; instalado en vivo |
| `Sidebar.html` | Toda la interfaz del panel (pantalla de opciones + 3 pasos) | Se dibuja correctamente en Sheets real; **falta confirmar el puente al servidor** |
| `apps_script_sandbox.js` | Carga los `.gs` reales dentro de Node para poder probarlos | — |
| `test_motor_reglas.js` | Pruebas del motor (reglas y prioridad) | `node test_motor_reglas.js` → 13/13 |
| `test_panel.js` | Pruebas del servidor del panel (memoria, orden de guardado, autopruebas) | `node test_panel.js` → 36/36 |
| `vista_previa_panel/` | Abre `Sidebar.html` en el navegador con un servidor falso, al ancho real del panel (300 px), para revisar apariencia sin instalarlo | — |
| `COMO_PROBARLO.md` / `Instrucciones_Diagnostico_SoW.docx` | Instrucciones en lenguaje simple para quien va a probarlo | — |
| `TODO.md` | Pendientes priorizados, con su origen | — |
| `PROMPT.md` | Prompt con el que se arrancó una sesión de trabajo anterior | Histórico |
| `RACI_PROPUESTA.md` | Propuesta de responsabilidades sobre la herramienta | Borrador |
| `EMAILS_BORRADOR.md` | Borradores de correo para Nico, Gustavo y Julián | Borrador |

**Instalación:** los dos `.gs` y el `Sidebar.html` deben vivir en el **mismo proyecto de Apps Script**. El archivo HTML debe llamarse exactamente `Sidebar` — `mostrarPanelDiagnostico()` lo busca por ese nombre literal. Los archivos `.js` y la carpeta `vista_previa_panel/` son solo para probar en local y no se suben a Apps Script.

**Cómo probar los cambios antes de subirlos:** `node test_motor_reglas.js` y `node test_panel.js`. Ambas suites cargan los `.gs` **reales** (no una copia), así que no pueden quedarse desactualizadas respecto al código que se sube.

## 4. Lo que Claude Code NO debe inventar por su cuenta

Estas decisiones son de negocio y las define gente específica en Banco BASE — no de Claude Code, ni siquiera si "tiene sentido técnicamente":

- **Fuente real de clientes**: hoy se capturan a mano y quedan en la base de datos del prototipo (todos ficticios). Candidatos son una hoja "Clientes" que Kevin cargue, o lectura directa de Salesforce — Kevin decide cuál.
- **Umbrales del árbol de prioridad** dentro de `clasificarPrioridad()`: siguen siendo ilustrativos, pendientes de validar con Gustavo, Julián y Nico.
- **Nuevas reglas de producto** (Inversiones, Coberturas, BASEinet, Previsión social): hace falta que Gustavo/Julián definan las preguntas de descubrimiento correspondientes primero — no agregar reglas nuevas solo porque el catálogo público de servicios de BASE las lista.
- **Cualquier conexión a datos reales de clientes**: bloqueada hasta que seguridad/TI de Banco BASE valide que este script y su base de datos no sacan información del entorno corporativo.
- **Búsqueda de empresas en internet o cualquier fuente de datos externa**: requiere autorización explícita de Gustavo/Julián antes de siquiera prototiparla.

Ver `TODO.md` para el detalle y el resto de pendientes técnicos que sí son de libre iniciativa.
