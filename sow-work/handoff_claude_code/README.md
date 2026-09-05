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
│    ├─ "Abrir panel de diagnóstico"        → Sidebar.html (HtmlService)
│    └─ "Ejecutar autopruebas del motor"    → ejecutarPruebasMotorReglas()
│
├─ Sidebar.html
│    → el asesor busca/elige cliente, responde preguntas
│    → google.script.run.guardarRespuestaYGenerar(respuesta)
│
├─ Sidebar_UI.gs
│    ├─ guardarEnHojaRespuestas(datos)   → hoja "Respuestas" (1 fila por visita)
│    ├─ guardarRespuestaYGenerar(datos)  → llama generarEntregables() (no duplica lógica)
│    └─ listarClientesFicticios()        → ⚠️ PLACEHOLDER, ver sección 4
│
└─ prototipo_entregables_sow.gs  (el motor real — NO tocar su lógica sin correr las pruebas después)
     ├─ TABLA_REGLAS            → reglas de oportunidad por producto
     ├─ evaluarReglas()         → motor de reglas → lista de oportunidades
     ├─ clasificarPrioridad()   → árbol de prioridad del cliente (back-end, no lo ve el cliente)
     ├─ generarPDFAsesor() / generarGuionConversacion()  → Docs → PDF → Drive
     ├─ generarEntregables()    → orquestador, punto de entrada único
     └─ ejecutarPruebasMotorReglas()  → 10 pruebas automatizadas, sin tocar Drive/Docs
```

Principio de diseño a mantener: **una sola fuente de verdad para la lógica de negocio.** `Sidebar_UI.gs` nunca debe reimplementar reglas — siempre llama a `generarEntregables()`. Si agregas una vía nueva de entrada (por ejemplo un trigger automático, o una integración con Salesforce), que también pase por esa misma función.

## 3. Archivos incluidos en este paquete

| Archivo | Qué es | Estado |
|---|---|---|
| `prototipo_entregables_sow.gs` | Motor de reglas + árbol de prioridad + generación de PDFs | Funcional, probado (10/10 pruebas) |
| `Sidebar_UI.gs` | Menú + backend del sidebar | Funcional, no probado aún dentro de un Sheet real |
| `Sidebar.html` | Interfaz del sidebar (HtmlService) | Funcional, campos verificados contra el motor |
| `test_motor_reglas.js` | Espejo local en Node del motor de reglas, para probar lógica sin abrir Apps Script | Todas las pruebas pasan (`node test_motor_reglas.js`) |
| `TODO.md` | Pendientes priorizados, con su origen (quién lo pidió / en qué reunión) | — |
| `PROMPT.md` | Prompt sugerido para pegarle a Claude Code y arrancar la siguiente sesión de trabajo | — |
| `RACI_PROPUESTA.md` | Propuesta de responsabilidades sobre la herramienta (quién decide qué) — para compartir con Nico/Gustavo/Julián, ellos deciden la versión final | Borrador |
| `EMAILS_BORRADOR.md` | Borradores de correo para Nico, Gustavo y Julián pidiendo retroalimentación del primer entregable | Borrador |

**Instalación:** los tres archivos `.gs`/`.html` deben vivir en el **mismo proyecto de Apps Script** (Apps Script comparte funciones entre archivos `.gs` automáticamente, sin imports). El nombre `Sidebar.html` debe quedar exactamente así — `mostrarPanelDiagnostico()` lo busca por ese nombre literal.

## 4. Lo que Claude Code NO debe inventar por su cuenta

Estas decisiones son de negocio y las define gente específica en Banco BASE — no de Claude Code, ni siquiera si "tiene sentido técnicamente":

- **Fuente real de clientes** (`listarClientesFicticios()`): candidatos son una hoja "Clientes" que Kevin cargue, o lectura directa de Salesforce — Kevin decide cuál.
- **Umbrales del árbol de prioridad** dentro de `clasificarPrioridad()`: siguen siendo ilustrativos, pendientes de validar con Gustavo, Julián y Nico.
- **Nuevas reglas de producto** (Inversiones, Coberturas, BASEinet, Previsión social): hace falta que Gustavo/Julián definan las preguntas de descubrimiento correspondientes primero — no agregar reglas nuevas solo porque el catálogo público de servicios de BASE las lista.
- **Cualquier conexión a datos reales de clientes**: bloqueada hasta que seguridad/TI de Banco BASE valide que el Web App de Apps Script no saca información del entorno corporativo.

Ver `TODO.md` para el detalle y el resto de pendientes técnicos que sí son de libre iniciativa.
