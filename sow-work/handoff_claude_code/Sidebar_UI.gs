/**
 * SIDEBAR_UI.gs — Menú personalizado + sidebar (HtmlService) del diagnóstico
 * Banco BASE | Orquestación comercial
 *
 * Este archivo NO reemplaza prototipo_entregables_sow.gs — lo envuelve con
 * una interfaz real dentro de Sheets: el asesor ya no necesita abrir el
 * editor de Apps Script para generar los entregables. Flujo:
 *
 *   Menú "Diagnóstico Share of Wallet" → Abrir panel de diagnóstico
 *     → Sidebar.html (elige cliente → responde preguntas → ve resultado)
 *     → guardarRespuestaYGenerar() → guarda en hoja "Respuestas" +
 *       corre evaluarReglas()/clasificarPrioridad() (motor real, sin
 *       duplicar lógica) + genera los 2 PDFs.
 *
 * Requiere que este archivo y prototipo_entregables_sow.gs vivan en el
 * MISMO proyecto de Apps Script (Apps Script comparte funciones entre
 * archivos .gs automáticamente — no hace falta importar nada).
 *
 * IMPORTANTE:
 * - `listarClientesFicticios()` regresa una lista fija de ejemplo. Falta
 *   decidir la fuente real (¿hoja "Clientes" cargada por Kevin? ¿lectura
 *   directa de Salesforce?) — ver el checklist de gobernanza del sidebar.
 * - Cualquiera con acceso de EDICIÓN a esta hoja de cálculo puede abrir el
 *   panel y generar entregables — no hay control de permisos adicional
 *   todavía. Ver gobernanza (vault, sección 12/14).
 */

// ============================================================
// MENÚ
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Diagnóstico Share of Wallet')
    .addItem('Abrir panel de diagnóstico', 'mostrarPanelDiagnostico')
    .addSeparator()
    .addItem('Ejecutar autopruebas del motor', 'ejecutarPruebasMotorReglasConAlerta')
    .addToUi();
}

function mostrarPanelDiagnostico() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Diagnóstico Share of Wallet');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Envoltorio de ejecutarPruebasMotorReglas() (ya existe en
 * prototipo_entregables_sow.gs) para que un asesor sin acceso al editor
 * de Apps Script también pueda correr la autoprueba, con un mensaje
 * visible en vez de tener que abrir el Registro de ejecución.
 */
function ejecutarPruebasMotorReglasConAlerta() {
  ejecutarPruebasMotorReglas();
  SpreadsheetApp.getUi().alert(
    'Autopruebas completas. Revisa Ver → Registro de ejecución en el editor de Apps Script para el detalle línea por línea.'
  );
}

// ============================================================
// DATOS PARA LA UI
// ============================================================

/**
 * TODO: reemplazar por una fuente real (hoja "Clientes" con el universo
 * de 372 clientes de Share of Wallet, o lectura directa de Salesforce)
 * una vez que esté decidida. Por ahora regresa ejemplos ficticios para
 * poder probar el flujo completo de punta a punta.
 */
function listarClientesFicticios() {
  return [
    'Comercializadora Ejemplo SA de CV',
    'Grupo Industrial Ficticio SA de CV',
    'Distribuidora Modelo SA de CV',
  ];
}

// ============================================================
// GUARDAR + GENERAR (llamado desde Sidebar.html vía google.script.run)
// ============================================================

/**
 * Punto de entrada único que llama el sidebar al presionar "Generar
 * entregables". Guarda la respuesta cruda en la hoja maestra "Respuestas"
 * y reutiliza generarEntregables() (definida en prototipo_entregables_sow.gs)
 * para no duplicar el motor de reglas ni el árbol de prioridad.
 */
function guardarRespuestaYGenerar(datosFormulario) {
  guardarEnHojaRespuestas(datosFormulario);
  const resultado = generarEntregables(datosFormulario);

  return {
    pdfUrl: resultado.pdfAsesor.getUrl(),
    guionUrl: resultado.guion.getUrl(),
    oportunidades: resultado.oportunidades,
    prioridad: resultado.prioridadCliente,
  };
}

/**
 * Hoja maestra "Respuestas" — una fila por visita (arquitectura ya
 * descrita en el vault, sección 12). Crea la hoja y su encabezado la
 * primera vez que se usa.
 */
function guardarEnHojaRespuestas(datos) {
  const NOMBRE_HOJA = 'Respuestas';
  const libro = SpreadsheetApp.getActive();
  let hoja = libro.getSheetByName(NOMBRE_HOJA);

  if (!hoja) {
    hoja = libro.insertSheet(NOMBRE_HOJA);
    hoja.appendRow([
      'Marca temporal', 'Cliente', 'Giro', 'Banco captación', 'Banco cambios',
      'Tiene crédito otro banco', 'Banco crédito', 'Recibe cotizaciones otros bancos',
    ]);
    hoja.getRange(1, 1, 1, 8).setFontWeight('bold');
  }

  hoja.appendRow([
    new Date(),
    datos.nombre || '',
    datos.giro || '',
    datos.bancoPrincipalCaptacion || '',
    datos.bancoCambios || '',
    datos.tieneCreditoOtroBanco === true,
    datos.bancoCredito || '',
    datos.recibeCotizacionesOtrosBancos === true,
  ]);
}
