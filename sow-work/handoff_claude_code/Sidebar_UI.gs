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
    .addItem('Abrir panel de diagnóstico (panel visual)', 'mostrarPanelDiagnostico')
    .addItem('Generar entregables por preguntas (opción segura)', 'generarEntregablesConDialogos')
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
// GENERAR POR PREGUNTAS — respaldo confiable (sin sidebar)
// ============================================================

/**
 * Por qué existe esta opción: el panel visual (Sidebar.html) se comunica
 * con el servidor usando `google.script.run`, un puente que en algunos
 * equipos falla con "PERMISSION_DENIED al leer del almacenamiento" — un
 * bloqueo del NAVEGADOR (prevención de rastreo/cookies de terceros en
 * Edge o Chrome), no un error de este código ni de los permisos de la
 * hoja. `probarPrototipo()` corrido directo desde el editor genera los
 * PDFs sin problema, lo que confirma que el motor y los permisos de
 * Drive/Docs están bien — el puente del sidebar es lo único que falla.
 *
 * Esta opción usa únicamente los cuadros de diálogo nativos de Sheets
 * (`ui.prompt` / `ui.alert`), el mismo mecanismo que ya usa "Ejecutar
 * autopruebas del motor" y que nunca ha fallado. No duplica lógica de
 * negocio: guarda la respuesta y llama a generarEntregables() igual que
 * el sidebar.
 */
function generarEntregablesConDialogos() {
  const ui = SpreadsheetApp.getUi();

  const nombre = pedirTexto(ui, 'Diagnóstico Share of Wallet — Paso 1 de 6',
    'Nombre del cliente (puede ser uno de los ejemplos ficticios o cualquier nombre):');
  if (nombre === null) return;
  if (!nombre) { ui.alert('Necesitas escribir un nombre de cliente. Vuelve a intentarlo.'); return; }

  const giro = pedirOpcion(ui, 'Paso 2 de 6 — Giro del negocio',
    ['Comercializadora', 'Manufactura', 'Comercio exterior', 'Servicios', 'Otro']);
  if (giro === null) return;

  const bancoPrincipalCaptacion = pedirTexto(ui, 'Paso 3 de 6',
    '¿Con qué banco tiene su captación principal?');
  if (bancoPrincipalCaptacion === null) return;

  const bancoCambios = pedirTexto(ui, 'Paso 4 de 6',
    '¿Con qué banco hace sus operaciones de cambios (compra/venta de divisas)?');
  if (bancoCambios === null) return;

  const tieneCredito = pedirSiNo(ui, 'Paso 5 de 6', '¿Tiene crédito vigente con otro banco?');
  if (tieneCredito === null) return;

  let bancoCredito = '';
  if (tieneCredito) {
    bancoCredito = pedirTexto(ui, 'Paso 5 de 6', '¿Con qué banco tiene ese crédito?');
    if (bancoCredito === null) return;
  }

  const recibeCotizaciones = pedirSiNo(ui, 'Paso 6 de 6',
    '¿Recibe cotizaciones o reportes de mercado de otro banco?');
  if (recibeCotizaciones === null) return;

  const datos = {
    nombre: nombre,
    giro: giro,
    bancoPrincipalCaptacion: bancoPrincipalCaptacion,
    bancoCambios: bancoCambios,
    tieneCreditoOtroBanco: tieneCredito,
    bancoCredito: bancoCredito,
    recibeCotizacionesOtrosBancos: recibeCotizaciones,
  };

  guardarEnHojaRespuestas(datos);
  const resultado = generarEntregables(datos);
  mostrarResultadoEnDialogo(resultado);
}

/** Cuadro con dos botones (OK/Cancelar) y una respuesta de texto libre. null = canceló. */
function pedirTexto(ui, titulo, mensaje) {
  const r = ui.prompt(titulo, mensaje, ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return null;
  return r.getResponseText().trim();
}

/** Cuadro Sí/No. Regresa true, false, o null si canceló. */
function pedirSiNo(ui, titulo, mensaje) {
  const r = ui.alert(titulo, mensaje, ui.ButtonSet.YES_NO_CANCEL);
  if (r === ui.Button.YES) return true;
  if (r === ui.Button.NO) return false;
  return null;
}

/**
 * Simula un menú de opciones con cuadros de diálogo nativos (que no
 * soportan listas desplegables): numera las opciones y valida que el
 * asesor escriba un número dentro del rango. Reintenta si se equivoca.
 */
function pedirOpcion(ui, titulo, opciones) {
  const listaTexto = opciones.map((op, i) => (i + 1) + '. ' + op).join('\n');
  while (true) {
    const r = ui.prompt(titulo, 'Escribe el número de la opción:\n' + listaTexto, ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return null;
    const indice = parseInt(r.getResponseText().trim(), 10) - 1;
    if (indice >= 0 && indice < opciones.length) return opciones[indice];
    ui.alert('Escribe solo el número de la lista (por ejemplo, 1).');
  }
}

/**
 * Muestra el resultado (prioridad + oportunidades + enlaces a los PDFs)
 * en un diálogo modal. Se construye el HTML en el servidor y se manda
 * ya armado — no necesita ningún google.script.run de vuelta, así que
 * no depende del puente que falla en algunos navegadores.
 */
function mostrarResultadoEnDialogo(resultado) {
  const p = resultado.prioridadCliente;
  let filas = '';
  resultado.oportunidades.forEach(function (op) {
    filas += '<div style="border-left:3px solid #F5A800;padding:8px 10px;margin-bottom:8px;background:#FAFAFA;">' +
      '<b>' + op.producto + '</b><br><span style="color:#707272;font-size:12px;">' + op.justificacion + '</span></div>';
  });
  if (resultado.oportunidades.length === 0) {
    filas = '<p style="color:#707272;">No se detectaron brechas con los datos capturados.</p>';
  }

  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial, sans-serif;padding:4px 2px;">' +
    '<div style="color:#F5A800;font-weight:bold;font-size:11px;letter-spacing:0.5px;">BANCO BASE · ORQUESTACIÓN COMERCIAL</div>' +
    '<h2 style="margin:4px 0 12px;">Entregables generados</h2>' +
    '<div style="background:' + (p.prioridad === 1 ? '#FCE9BF' : '#F5F5F5') + ';border-radius:6px;padding:10px;margin-bottom:14px;">' +
    '<b>' + p.etiqueta + '</b><br><span style="font-size:12px;color:#333;">' + p.motivo + '</span></div>' +
    '<div style="font-weight:bold;font-size:12px;margin-bottom:6px;">Oportunidades detectadas</div>' +
    filas +
    '<div style="margin-top:14px;">' +
    '<a href="' + resultado.pdfAsesor.getUrl() + '" target="_blank" style="display:block;background:#F5A800;color:#000;text-decoration:none;text-align:center;padding:9px;border-radius:6px;font-weight:bold;margin-bottom:8px;">Abrir PDF del asesor</a>' +
    '<a href="' + resultado.guion.getUrl() + '" target="_blank" style="display:block;border:1px solid #D1D1D2;color:#000;text-decoration:none;text-align:center;padding:9px;border-radius:6px;">Abrir guion de conversación</a>' +
    '</div></div>'
  ).setWidth(420).setHeight(480);
  SpreadsheetApp.getUi().showModalDialog(html, 'Diagnóstico Share of Wallet');
}

// ============================================================
// DATOS PARA LA UI
// ============================================================

/**
 * TODO: reemplazar por una fuente real (hoja "Clientes" con el universo
 * de 372 clientes de Share of Wallet, o lectura directa de Salesforce)
 * una vez que esté decidida. Por ahora regresa ejemplos ficticios para
 * poder probar el flujo completo de punta a punta.
 *
 * Todos los nombres son inventados (marcados "ficticio"/"ejemplo") — no
 * corresponden a ningún cliente real de BASE. Se regresan ya ordenados
 * alfabéticamente para que la lista en el sidebar sea fácil de recorrer.
 */
function listarClientesFicticios() {
  const clientes = [
    'Aceros del Norte Ficticio SA de CV',
    'Comercializadora Ejemplo SA de CV',
    'Distribuidora Modelo SA de CV',
    'Envases y Empaques de Prueba SA de CV',
    'Grupo Industrial Ficticio SA de CV',
    'Herramientas del Bajío Ejemplo SA de CV',
    'Importadora Ficticia del Pacífico SA de CV',
    'Logística y Transportes de Muestra SA de CV',
    'Manufacturas Ejemplo del Centro SA de CV',
    'Refaccionaria Ficticia Monterrey SA de CV',
  ];
  return clientes.sort(function (a, b) {
    return a.localeCompare(b, 'es');
  });
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
