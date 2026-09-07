# Pendientes — Diagnóstico Share of Wallet

Organizados por quién puede resolverlos. Lo que puede avanzar Claude Code de forma autónoma está marcado `[libre]`; lo que necesita una decisión de negocio de alguien en Banco BASE está marcado `[bloqueado — decisión de negocio]`.

## Bloqueantes reales (no avanzar sin esto)

- [ ] `[bloqueado — decisión de negocio]` **Fuente real de clientes.** Hoy los clientes se capturan a mano y quedan en la base de datos del prototipo (todos ficticios). Opciones a decidir: (a) una hoja "Clientes" precargada con el universo de 372 clientes de Share of Wallet, (b) lectura directa desde Salesforce vía API/conector. Mientras no se decida, **no conectar a datos reales de clientes.**
- [ ] `[bloqueado — decisión de negocio]` **Validación de seguridad/TI.** Confirmar que este script y su base de datos (un Google Sheet aparte, en el Drive de quien lo usa) cumplen la restricción de que los datos de clientes no salgan del entorno de Banco BASE — la misma restricción que ya se aplicó a Google Sheets. No es una decisión técnica que Claude Code pueda resolver solo.
- [ ] `[bloqueado — decisión de negocio]` **Umbrales del árbol de prioridad** dentro de `clasificarPrioridad()` (`prototipo_entregables_sow.gs`). Los usados hoy son ilustrativos — validar con Gustavo, Julián y Nico antes de tratarlos como reglas reales.
- [ ] `[bloqueado — decisión de negocio]` **Productos nuevos en `TABLA_REGLAS`** (Inversiones, Coberturas, BASEinet). No se agregan hasta que Gustavo/Julián definan sus preguntas de descubrimiento. Hay una prueba automática que falla si alguien los agrega antes (ver `test_motor_reglas.js`).
- [ ] `[bloqueado — decisión de negocio]` **Quiénes van a usar la herramienta.** Si va a ser más de un asesor, hay que compartir el archivo de base de datos con todos (menú → "Abrir la base de datos de clientes"). Ver la nota de propiedad del archivo más abajo.

- [ ] `[BLOQUEANTE — 2 minutos de Kevin]` **El panel no se puede comunicar con Google (PERMISSION_DENIED).** Ya está diagnosticado: **no es un permiso del script ni de la base de datos.** Prueba controlada del 7 de sept, misma función `correrAutopruebasDesdeSidebar`: desde el Editor → *Completada* (1.845 s y 0.934 s); desde el panel → *Fallida, 0 s, tipo "Desconocida"*. Mismo usuario, mismos permisos, misma base. Además falla igual la función de autopruebas, que no toca la base de datos para nada. Lo que falla es el puente entre el panel (un iframe aislado) y el servidor, que el navegador bloquea.
  Qué hacer, en orden: (1) abrir la hoja en una ventana de **incógnito** — ahí hay una sola cuenta de Google y ninguna extensión; (2) si así funciona, la causa es tener **varias cuentas de Google abiertas** (las URLs actuales son `/u/1/`, o sea segunda cuenta) o el bloqueo de **cookies de terceros** (`chrome://settings/cookies`). Mientras tanto el menú sí funciona y sirve como plan B.

## Mejoras técnicas de libre iniciativa

- [ ] `[libre]` Probar el resto del flujo dentro del Google Sheet real. Ya está verificado en vivo que el panel se dibuja bien y que el motor genera los PDF (`probarPrototipo` completa en 9.5 s). Falta ver, desde el panel: que se generen los entregables de punta a punta, y que el archivo de base de datos se cree y se llene bien la primera vez. Depende del bloqueante de arriba.
- [ ] `[libre]` Migrar `TABLA_REGLAS` (hoy dentro de `prototipo_entregables_sow.gs`) a una hoja de Google Sheets tipo "Reglas" (producto | condición | umbral | texto de oportunidad | pregunta de guion) para que Gustavo/Julián puedan ajustar criterios sin pedir un despliegue de código. Ojo: al hacerlo, mantener la prueba de gobernanza que hoy vigila qué productos existen.
- [ ] `[decisión de Kevin]` **Gobernanza de la base de datos.** Hoy la base ya está separada de la hoja: es **otro archivo**, con su propia lista de compartidos, así que tener acceso de edición a la hoja **no** da acceso a los datos de clientes. Ése es el control real y lo aplica Google, no nuestro código. Lo que falta decidir:
  - **Recomendado:** mover ese archivo a una **Unidad compartida** de BASE con acceso por grupo. Resuelve de paso el problema de que hoy el archivo lo posee la primera persona que usó la herramienta.
  - **Descartado por ahora:** lista de correos en el código con `Session.getActiveUser().getEmail()`. Dos razones: (a) no es una barrera real — cualquiera con acceso de edición a la hoja puede abrir Apps Script y editar la lista; (b) **agrega un permiso nuevo de Google**, y aceptar permisos nuevos solo se puede hacer desde el menú o el editor, nunca desde el panel — justo el tipo de fricción que estamos peleando ahora. Vale la pena cuando el panel ya sea estable.
- [ ] `[libre]` Portar la paleta oficial de BASE (Amarillo #F5A800, Negro #000000, Gris #707272) también a los PDF generados por `generarPDFAsesor()` / `generarGuionConversacion()` — hoy el `.gs` ya aplica color a los textos, pero falta revisar cómo se ve impreso.
- [ ] `[libre]` Insertar el logo oficial de BASE (archivo de imagen, no redibujado) en los PDF generados — reglas de uso en el vault sección 12 (zona de protección, versiones permitidas, nunca rotar/sombrear). Hoy solo se reserva el espacio.
- [ ] `[libre]` Guardar también el histórico de prioridad por cliente (hoy la hoja "Clientes" solo conserva la última visita; el histórico completo está en la hoja "Respuestas", pero sin enlazar).

## Pendiente de reuniones/personas específicas (no técnico, pero afecta el diseño)

- [ ] Número final exacto de reactivos del formulario y su redacción — Gustavo/Julián, por correo (compromiso que Kevin asumió el 4 sept).
- [ ] Si se involucran los seis líderes de cada uno (Gustavo/Julián) en la definición del formulario — no tocado en la reunión del 4 sept.
- [ ] Confirmación interna de Kevin sobre el catálogo de servicios de Banco BASE recopilado (vault sección 15.3) antes de usarlo para nuevas reglas.

---

## Reglas de oro al modificar el código

1. **Antes y después de tocar `prototipo_entregables_sow.gs`:** correr `node test_motor_reglas.js` (o `ejecutarPruebasMotorReglas()` dentro de Apps Script). Si agregas una regla o una rama de prioridad nueva, agrega también su prueba.
2. **Antes y después de tocar `Sidebar_UI.gs` o `Sidebar.html`:** correr `node test_panel.js`, y revisar la apariencia con `vista_previa_panel/`.
3. **No duplicar lógica de negocio.** La interfaz siempre llama a `generarEntregables()`; nunca se reimplementa `evaluarReglas()` ni `clasificarPrioridad()` en otro archivo.
4. **Datos ficticios siempre.** Todo cliente que aparezca en el sistema es inventado o está marcado como tal.

Las dos suites de pruebas cargan los archivos `.gs` **reales** (ver `apps_script_sandbox.js`), así que no hay copias que se puedan quedar desactualizadas.
