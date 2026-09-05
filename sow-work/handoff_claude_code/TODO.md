# Pendientes — Diagnóstico Share of Wallet

Organizados por quién puede resolverlos. Lo que puede avanzar Claude Code de forma autónoma está marcado `[libre]`; lo que necesita una decisión de negocio de alguien en Banco BASE está marcado `[bloqueado — decisión de negocio]`.

## Bloqueantes reales (no avanzar sin esto)

- [ ] `[bloqueado — decisión de negocio]` **Fuente real de clientes.** `listarClientesFicticios()` en `Sidebar_UI.gs` regresa una lista fija de ejemplo. Opciones a decidir con Kevin: (a) hoja "Clientes" que él cargue con el universo de 372 clientes de Share of Wallet, (b) lectura directa desde Salesforce vía API/conector. Mientras no se decida, **no conectar a datos reales de clientes.**
- [ ] `[bloqueado — decisión de negocio]` **Validación de seguridad/TI.** Confirmar que un Web App de Apps Script (HtmlService) dentro del dominio corporativo de BASE cumple la restricción de que los datos de clientes no salgan del entorno de Banco BASE — la misma restricción que ya se aplicó a Google Sheets. No es una decisión técnica que Claude Code pueda resolver solo.
- [ ] `[bloqueado — decisión de negocio]` **Umbrales del árbol de prioridad** dentro de `clasificarPrioridad()` (`prototipo_entregables_sow.gs`). Los usados hoy son ilustrativos — validar con Gustavo, Julián y Nico antes de tratarlos como reglas reales.

## Mejoras técnicas de libre iniciativa

- [ ] `[libre]` Probar el sidebar dentro de un Google Sheet real (todavía no se ha corrido fuera del entorno de desarrollo) — validar que `mostrarPanelDiagnostico()` abre correctamente, que `google.script.run` se comunica sin errores, y que la hoja "Respuestas" se crea/llena bien la primera vez.
- [ ] `[libre]` Migrar `TABLA_REGLAS` (hoy hardcodeada en `prototipo_entregables_sow.gs`) a una hoja de Google Sheets tipo "Reglas" (producto | condición | umbral | texto de oportunidad | pregunta de guion) para que Gustavo/Julián puedan ajustar criterios sin pedir un despliegue de código cada vez. Ya está sugerido en el diseño original — falta construirlo.
- [ ] `[libre]` Agregar control de permisos al menú/sidebar más allá de "cualquiera con acceso de edición a la hoja" — por ejemplo, restringir a una lista de correos de asesores autorizados usando `Session.getActiveUser().getEmail()`.
- [ ] `[libre]` Manejo de errores más robusto en `Sidebar.html` — hoy `withFailureHandler` solo muestra `err.message`; podría distinguir entre error de red, error de validación de campos, y error del motor de reglas.
- [ ] `[libre]` Portar la paleta oficial de BASE (Amarillo #F5A800, Negro #000000, Gris #707272 — ver vault sección 12) también a los PDFs generados por `generarPDFAsesor()`/`generarGuionConversacion()` — hoy el `.gs` genera el contenido pero sin estilos de color reales, solo estructura (títulos/negritas).
- [ ] `[libre]` Insertar el logo oficial de BASE (archivo de imagen, no redibujado) en los PDFs generados — reglas de uso ya documentadas en el vault sección 12 (zona de protección, versiones permitidas, nunca rotar/sombrear).
- [ ] `[libre]` Validación de campos en `Sidebar.html` antes de permitir "Ver resultado y generar entregables" (hoy se puede enviar con selects vacíos).

## Pendiente de reuniones/personas específicas (no técnico, pero afecta el diseño)

- [ ] Número final exacto de reactivos del formulario y su redacción — Gustavo/Julián, por correo (compromiso que Kevin asumió el 4 sept).
- [ ] Si se involucran los seis líderes de cada uno (Gustavo/Julián) en la definición del formulario — no tocado en la reunión del 4 sept.
- [ ] Confirmación interna de Kevin sobre el catálogo de servicios de Banco BASE recopilado (vault sección 15.3) antes de usarlo para nuevas reglas.

---

**Regla de oro al modificar `prototipo_entregables_sow.gs`:** correr `ejecutarPruebasMotorReglas()` (o su espejo `node test_motor_reglas.js` si se está iterando localmente) antes y después de cualquier cambio. Las 10 pruebas deben seguir pasando — si agregas una regla o una rama de prioridad nueva, agrega también su prueba correspondiente en `ejecutarPruebasMotorReglas()`.
