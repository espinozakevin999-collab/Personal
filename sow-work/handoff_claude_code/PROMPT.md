Prompt para Claude Code — pégalo tal cual al abrir la carpeta descomprimida del handoff.

---

Estás retomando el desarrollo de un prototipo ya funcional para Banco BASE: un diagnóstico de "Share of Wallet" que corre dentro de Google Sheets + Apps Script. Lee primero `README.md` (arquitectura y decisiones ya tomadas) y `TODO.md` (pendientes clasificados). Hoy el objetivo es un **primer entregable presentable** para compartir por correo con Nico, Gustavo y Julián — no la versión final, una versión honesta de "así se ve y así funciona hoy" para pedir su retroalimentación.

**Reglas de trabajo (no negociables):**
1. No dupliques la lógica de negocio — `Sidebar_UI.gs` siempre llama a `generarEntregables()`, nunca reimplementes `evaluarReglas()`/`clasificarPrioridad()` en otro lugar.
2. No conectes datos reales de clientes ni inventes una fuente de datos real (ver TODO.md — está bloqueado). Usa 2-3 clientes ficticios de ejemplo, marcados explícitamente como tales.
3. No agregues productos nuevos a `TABLA_REGLAS` (Inversiones, Coberturas, BASEinet) — todavía no hay preguntas de descubrimiento definidas para esos por Gustavo/Julián.
4. Antes de cualquier cambio a `prototipo_entregables_sow.gs`, corre `ejecutarPruebasMotorReglas()` (o `node test_motor_reglas.js`); las 10 pruebas deben seguir pasando. Si agregas lógica, agrega su prueba.
5. Explica primero la lógica de cada cambio, después la estructura, y al final el código — comentarios limpios, no excesivos.
6. Lenguaje simple en todo lo que vea alguien de negocio (PDFs, instrucciones, correo) — nada de jerga técnica.

**Tareas de hoy, en este orden:**

1. **Mejorar la apariencia de los PDFs.** `generarPDFAsesor()` y `generarGuionConversacion()` hoy generan contenido correcto pero sin estilo visual real. Aplica la identidad oficial de BASE ya documentada en `README.md`: Amarillo BASE `#F5A800`, Negro `#000000`, Gris `#707272` (títulos en negro bold, la etiqueta de prioridad resaltada en amarillo, texto secundario en gris). Deja un espacio reservado explícito para el logo oficial (no lo redibujes — eso viola las reglas de marca). El resultado debe verse como un documento de banco, no como una hoja de prueba.

2. **Instalar y correr esto en un Google Sheet real.** Crea (o usa) un Sheet de prueba, pega los 3 archivos (`prototipo_entregables_sow.gs`, `Sidebar_UI.gs`, `Sidebar.html` — el nombre debe quedar exactamente así), recarga la hoja, confirma que aparece el menú "Diagnóstico Share of Wallet", corre `ejecutarPruebasMotorReglas()` primero y después el flujo completo del sidebar con 2-3 clientes ficticios. Si algo truena, corrígelo — este paso es el que faltaba validar (ver TODO.md).

3. **Generar 2-3 PDFs de ejemplo ya con buena apariencia** (salida real del sidebar, con los clientes ficticios) — estos son los que se van a compartir para ilustrar cómo se ve el resultado.

4. **Escribir instrucciones de prueba sumamente sencillas e ilustrativas** — un documento corto (`COMO_PROBARLO.md` o similar) en lenguaje simple, con pasos numerados y ejemplos, pensado para que Nico, Gustavo o Julián (que no son técnicos) entiendan qué es esto y, si quieren, lo prueben ellos mismos abriendo el sidebar. Nada de vocabulario de programador.

5. **Armar un ZIP final para compartir por correo** que incluya: los 3 archivos de código, los 2-3 PDFs de ejemplo generados en el paso 3, y el documento de instrucciones del paso 4. Nómbralo de forma clara, ej. `Diagnostico_SoW_Prototipo_[fecha].zip`.

6. **Si crees que hace falta un apoyo visual adicional** (una presentación corta tipo PPT/Canva con 3-4 slides: qué es, cómo se ve, qué sigue) para que quien no abra el ZIP entienda la idea en 30 segundos, prepáralo también — pero solo si de verdad suma, no por inflar el entregable. Si lo haces, mantenlo a 3-4 slides máximo, mismo lenguaje simple.

Al terminar, dime en una lista corta qué generaste, dónde quedó cada archivo, y qué probarías/mejorarías después (ya sabiendo que las decisiones de negocio pendientes — TODO.md — no las resuelves tú).
