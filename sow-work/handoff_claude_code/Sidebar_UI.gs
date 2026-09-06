/**
 * SIDEBAR_UI.gs — Menú personalizado del diagnóstico
 * Banco BASE | Orquestación comercial
 *
 * Este archivo NO reemplaza prototipo_entregables_sow.gs — lo envuelve con
 * una interfaz real dentro de Sheets: el asesor ya no necesita abrir el
 * editor de Apps Script para generar los entregables.
 *
 * HISTORIAL — por qué es UNA sola opción y no un panel visual (sidebar):
 * la primera versión ofrecía un panel visual (HtmlService) que se
 * comunicaba con el servidor por `google.script.run`. Ese puente falló de
 * forma consistente con "PERMISSION_DENIED al leer del almacenamiento" —
 * confirmado que NO es un problema de permisos ni del motor de reglas
 * (`probarPrototipo()` corrido directo desde el editor genera los PDFs
 * sin problema, con la misma función `generarEntregables()`), sino del
 * navegador (prevención de rastreo/cookies de terceros) bloqueando ese
 * puente específico. Por eso todo el flujo de captura ahora usa
 * únicamente cuadros de diálogo nativos de Sheets (`ui.prompt`/`ui.alert`)
 * — el mismo mecanismo que ya usaba "Ejecutar autopruebas del motor" y
 * que nunca ha fallado. Una sola ruta, simple y confiable.
 *
 * Flujo:
 *   Menú "Diagnóstico Share of Wallet" → Generar diagnóstico
 *     → generarEntregablesConDialogos(): pregunta cliente (nuevo o ya
 *       registrado), giro, bancos, crédito, cotizaciones y pendientes
 *     → guarda en la base de datos segura (hoja aparte, ver abajo) +
 *       corre generarEntregables() (motor real, sin duplicar lógica)
 *     → muestra el resultado en un diálogo con los PDFs.
 *
 * BASE DE DATOS SEGURA:
 * Todas las respuestas y el registro de clientes se guardan en un
 * Google Sheet APARTE (no en esta misma hoja de prueba) — ver
 * obtenerBaseDeDatosSegura_(). Se crea automáticamente la primera vez
 * que alguien genera un diagnóstico y queda privado en el Drive de esa
 * persona (nadie más lo ve a menos que se comparta a propósito). El ID
 * se guarda en las Propiedades del proyecto para reutilizar el mismo
 * archivo siempre.
 *
 * IMPORTANTE — LIMITACIÓN DE HOY: las Propiedades del proyecto son
 * compartidas por todos los que usan este script, pero el archivo de
 * base de datos lo crea y lo posee la PRIMERA persona que lo use. Si
 * más de un asesor va a usar esta herramienta y necesitan ver el mismo
 * historial de clientes, hay que compartir ese archivo con ellos (o
 * decirme quiénes son para configurarlo). Con un solo usuario (como en
 * esta prueba) no hace falta nada adicional.
 *
 * Requiere que este archivo y prototipo_entregables_sow.gs vivan en el
 * MISMO proyecto de Apps Script (Apps Script comparte funciones entre
 * archivos .gs automáticamente — no hace falta importar nada).
 *
 * Todos los nombres de cliente que aparecen en el historial son
 * ficticios/de ejemplo — no hay ningún dato real de cliente. Ver
 * gobernanza (vault, sección 12/14) antes de conectar datos reales.
 */

// ============================================================
// MENÚ
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Diagnóstico Share of Wallet')
    .addItem('Generar diagnóstico', 'generarEntregablesConDialogos')
    .addSeparator()
    .addItem('Ejecutar autopruebas del motor', 'ejecutarPruebasMotorReglasConAlerta')
    .addToUi();
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
// CATÁLOGOS DE OPCIONES
// ============================================================

/**
 * Bancos más comunes para las preguntas de captación/cambios/crédito.
 * "Banco BASE" se traduce internamente al valor exacto 'BASE' porque el
 * motor de reglas (prototipo_entregables_sow.gs) compara contra ese
 * string literal para saber si el cliente ya opera con BASE — ver
 * clasificarPrioridad() y evaluarReglas(). No cambiar ese mapeo sin
 * revisar el motor.
 */
const BANCOS_COMUNES = [
  'Banco BASE', 'BBVA', 'Santander', 'Banorte', 'HSBC', 'Citibanamex',
  'Scotiabank', 'Inbursa', 'Banco Azteca', 'BanBajío', 'Afirme', 'Multiva',
];

const GIROS_COMUNES = ['Comercializadora', 'Manufactura', 'Comercio exterior', 'Servicios'];

const OPCION_OTRO = 'Otro (especifica)';

// ============================================================
// GENERAR DIAGNÓSTICO — flujo por preguntas (única opción)
// ============================================================

function generarEntregablesConDialogos() {
  const ui = SpreadsheetApp.getUi();

  const nombre = elegirONuevoCliente_(ui);
  if (nombre === null) return;

  const giro = pedirOpcionConOtro(ui, 'Diagnóstico Share of Wallet', 'Giro del negocio:', GIROS_COMUNES);
  if (giro === null) return;

  const bancoPrincipalCaptacion = pedirBanco(ui, '¿Con qué banco tiene su captación principal?');
  if (bancoPrincipalCaptacion === null) return;

  const bancoCambios = pedirBanco(ui, '¿Con qué banco hace sus operaciones de cambios (compra/venta de divisas)?');
  if (bancoCambios === null) return;

  const tieneCredito = pedirSiNo(ui, 'Diagnóstico Share of Wallet', '¿Tiene crédito vigente con otro banco?');
  if (tieneCredito === null) return;

  let bancoCredito = '';
  if (tieneCredito) {
    bancoCredito = pedirBanco(ui, '¿Con qué banco tiene ese crédito?');
    if (bancoCredito === null) return;
  }

  const recibeCotizaciones = pedirSiNo(ui, 'Diagnóstico Share of Wallet',
    '¿Recibe cotizaciones o reportes de mercado de otro banco?');
  if (recibeCotizaciones === null) return;

  const pendiente = pedirTexto(ui, 'Diagnóstico Share of Wallet',
    '¿Quedó algo pendiente para la próxima visita? (opcional — deja el cuadro vacío si no aplica)');
  if (pendiente === null) return;

  const datos = {
    nombre: nombre,
    giro: giro,
    bancoPrincipalCaptacion: bancoPrincipalCaptacion,
    bancoCambios: bancoCambios,
    tieneCreditoOtroBanco: tieneCredito,
    bancoCredito: bancoCredito,
    recibeCotizacionesOtrosBancos: recibeCotizaciones,
    pendiente: pendiente,
  };

  guardarEnHojaRespuestas(datos);
  const resultado = generarEntregables(datos);
  actualizarRegistroCliente_(datos, resultado);
  mostrarResultadoEnDialogo(resultado, datos);
}

/**
 * Paso 1: si ya hay clientes registrados en la base de datos segura,
 * pregunta si se busca uno existente (y muestra su historial: última
 * visita, prioridad y pendientes) o si se registra uno nuevo. Con la
 * base de datos vacía, pasa directo a pedir el nombre.
 */
function elegirONuevoCliente_(ui) {
  const registrados = obtenerListaClientesRegistrados_();

  if (registrados.length === 0) {
    const nombre = pedirTexto(ui, 'Diagnóstico Share of Wallet',
      'Nombre del cliente (no hay clientes registrados todavía):');
    if (!nombre) { ui.alert('Necesitas escribir un nombre de cliente. Vuelve a intentarlo.'); return null; }
    return nombre;
  }

  const modo = pedirOpcion(ui, 'Diagnóstico Share of Wallet', '¿Qué quieres hacer?',
    ['Buscar un cliente ya registrado', 'Registrar un cliente nuevo']);
  if (modo === null) return null;

  if (modo === 'Registrar un cliente nuevo') {
    const nombre = pedirTexto(ui, 'Diagnóstico Share of Wallet', 'Nombre del cliente nuevo:');
    if (!nombre) { ui.alert('Necesitas escribir un nombre de cliente. Vuelve a intentarlo.'); return null; }
    return nombre;
  }

  // Máximo 15 en la lista para que el cuadro de diálogo no quede enorme.
  const opciones = registrados.slice(0, 15).concat(['(Ninguno de estos — registrar nuevo)']);
  const elegido = pedirOpcion(ui, 'Diagnóstico Share of Wallet', 'Elige un cliente:', opciones);
  if (elegido === null) return null;

  if (elegido === '(Ninguno de estos — registrar nuevo)') {
    const nombre = pedirTexto(ui, 'Diagnóstico Share of Wallet', 'Nombre del cliente nuevo:');
    if (!nombre) { ui.alert('Necesitas escribir un nombre de cliente. Vuelve a intentarlo.'); return null; }
    return nombre;
  }

  mostrarHistorialCliente_(ui, elegido);
  return elegido;
}

// ============================================================
// CUADROS DE DIÁLOGO — bloques reutilizables
// ============================================================

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
function pedirOpcion(ui, titulo, mensaje, opciones) {
  const listaTexto = opciones.map((op, i) => (i + 1) + '. ' + op).join('\n');
  while (true) {
    const r = ui.prompt(titulo, mensaje + '\n\n' + listaTexto, ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return null;
    const indice = parseInt(r.getResponseText().trim(), 10) - 1;
    if (indice >= 0 && indice < opciones.length) return opciones[indice];
    ui.alert('Escribe solo el número de la lista (por ejemplo, 1).');
  }
}

/**
 * Como pedirOpcion(), pero agrega "Otro (especifica)" al final de la
 * lista; si el asesor la elige, abre un cuadro de texto libre para
 * escribir la respuesta y esa es la que se guarda. Así el catálogo de
 * opciones nunca bloquea un caso no previsto — todo queda mapeado, ya
 * sea con la opción de la lista o con lo que el asesor escriba.
 */
function pedirOpcionConOtro(ui, titulo, mensaje, opciones) {
  const elegido = pedirOpcion(ui, titulo, mensaje, opciones.concat([OPCION_OTRO]));
  if (elegido === null) return null;
  if (elegido === OPCION_OTRO) {
    const libre = pedirTexto(ui, titulo, 'Escríbelo (' + mensaje.replace(':', '') + '):');
    if (!libre) { ui.alert('Necesitas escribir algo. Vuelve a intentarlo.'); return null; }
    return libre;
  }
  return elegido;
}

/**
 * Pregunta de banco con el catálogo BANCOS_COMUNES + "Otro". Traduce
 * "Banco BASE" al valor exacto 'BASE' que espera el motor de reglas.
 */
function pedirBanco(ui, mensaje) {
  const elegido = pedirOpcionConOtro(ui, 'Diagnóstico Share of Wallet', mensaje, BANCOS_COMUNES);
  if (elegido === null) return null;
  return elegido === 'Banco BASE' ? 'BASE' : elegido;
}

// ============================================================
// RESULTADO
// ============================================================

/**
 * Muestra el resultado (prioridad + oportunidades + enlaces a los PDFs)
 * en un diálogo modal. Se construye el HTML en el servidor y se manda
 * ya armado — no necesita ningún google.script.run de vuelta, así que
 * no depende del puente que falla en algunos navegadores.
 */
function mostrarResultadoEnDialogo(resultado, datos) {
  const p = resultado.prioridadCliente;
  let filas = '';
  resultado.oportunidades.forEach(function (op) {
    filas += '<div style="border-left:3px solid #F5A800;padding:8px 10px;margin-bottom:8px;background:#FAFAFA;">' +
      '<b>' + op.producto + '</b><br><span style="color:#707272;font-size:12px;">' + op.justificacion + '</span></div>';
  });
  if (resultado.oportunidades.length === 0) {
    filas = '<p style="color:#707272;">No se detectaron brechas con los datos capturados.</p>';
  }

  const pendienteHtml = datos.pendiente
    ? '<div style="background:#F5F5F5;border-radius:6px;padding:8px 10px;margin-bottom:14px;font-size:12px;">' +
      '<b>Pendiente para la próxima visita:</b> ' + datos.pendiente + '</div>'
    : '';

  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial, sans-serif;padding:4px 2px;">' +
    '<div style="color:#F5A800;font-weight:bold;font-size:11px;letter-spacing:0.5px;">BANCO BASE · ORQUESTACIÓN COMERCIAL</div>' +
    '<h2 style="margin:4px 0 12px;">Entregables generados — ' + datos.nombre + '</h2>' +
    '<div style="background:' + (p.prioridad === 1 ? '#FCE9BF' : '#F5F5F5') + ';border-radius:6px;padding:10px;margin-bottom:14px;">' +
    '<b>' + p.etiqueta + '</b><br><span style="font-size:12px;color:#333;">' + p.motivo + '</span></div>' +
    pendienteHtml +
    '<div style="font-weight:bold;font-size:12px;margin-bottom:6px;">Oportunidades detectadas</div>' +
    filas +
    '<div style="margin-top:14px;">' +
    '<a href="' + resultado.pdfAsesor.getUrl() + '" target="_blank" style="display:block;background:#F5A800;color:#000;text-decoration:none;text-align:center;padding:9px;border-radius:6px;font-weight:bold;margin-bottom:8px;">Abrir PDF del asesor</a>' +
    '<a href="' + resultado.guion.getUrl() + '" target="_blank" style="display:block;border:1px solid #D1D1D2;color:#000;text-decoration:none;text-align:center;padding:9px;border-radius:6px;">Abrir guion de conversación</a>' +
    '</div></div>'
  ).setWidth(420).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html, 'Diagnóstico Share of Wallet');
}

// ============================================================
// BASE DE DATOS SEGURA (hoja de cálculo aparte, ver cabecera del archivo)
// ============================================================

const NOMBRE_BASE_DATOS_SOW = 'Base de datos — Diagnóstico Share of Wallet (prototipo, datos ficticios)';
const PROPIEDAD_ID_BASE_DATOS_SOW = 'ID_BASE_DATOS_SOW';

/**
 * Regresa el libro de la base de datos segura, creándolo la primera vez.
 * El ID queda guardado en las Propiedades del proyecto para no volver a
 * crear un archivo nuevo cada vez. Ver la nota de gobernanza al inicio
 * del archivo sobre compartir este archivo si hay más de un asesor.
 */
function obtenerBaseDeDatosSegura_() {
  const propiedades = PropertiesService.getScriptProperties();
  const id = propiedades.getProperty(PROPIEDAD_ID_BASE_DATOS_SOW);

  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      // El archivo ya no existe o no hay acceso — se crea uno nuevo abajo.
    }
  }

  const libro = SpreadsheetApp.create(NOMBRE_BASE_DATOS_SOW);
  propiedades.setProperty(PROPIEDAD_ID_BASE_DATOS_SOW, libro.getId());
  inicializarBaseDeDatos_(libro);
  return libro;
}

/** Crea las hojas "Respuestas" y "Clientes" con encabezado la primera vez. */
function inicializarBaseDeDatos_(libro) {
  const hojaRespuestas = libro.getSheets()[0];
  hojaRespuestas.setName('Respuestas');
  hojaRespuestas.appendRow([
    'Marca temporal', 'Cliente', 'Giro', 'Banco captación', 'Banco cambios',
    'Tiene crédito otro banco', 'Banco crédito', 'Recibe cotizaciones otros bancos', 'Pendiente',
  ]);
  hojaRespuestas.getRange(1, 1, 1, 9).setFontWeight('bold');

  const hojaClientes = libro.insertSheet('Clientes');
  hojaClientes.appendRow([
    'Cliente', 'Última visita', 'Prioridad', 'Etiqueta', 'Pendiente',
    'Giro', 'Banco captación', 'Banco cambios',
  ]);
  hojaClientes.getRange(1, 1, 1, 8).setFontWeight('bold');
}

/**
 * Hoja "Respuestas" — una fila por visita (arquitectura ya descrita en
 * el vault, sección 12). Vive en la base de datos segura, no en esta
 * hoja de prueba.
 */
function guardarEnHojaRespuestas(datos) {
  const hoja = obtenerBaseDeDatosSegura_().getSheetByName('Respuestas');
  hoja.appendRow([
    new Date(),
    datos.nombre || '',
    datos.giro || '',
    datos.bancoPrincipalCaptacion || '',
    datos.bancoCambios || '',
    datos.tieneCreditoOtroBanco === true,
    datos.bancoCredito || '',
    datos.recibeCotizacionesOtrosBancos === true,
    datos.pendiente || '',
  ]);
}

/**
 * Hoja "Clientes" — un renglón por cliente (no por visita), que se
 * actualiza cada vez que se genera un diagnóstico. Es la "memoria" que
 * permite buscar un cliente ya visitado y ver qué quedó pendiente.
 */
function actualizarRegistroCliente_(datos, resultado) {
  const hoja = obtenerBaseDeDatosSegura_().getSheetByName('Clientes');
  const valores = hoja.getDataRange().getValues();

  let fila = -1;
  for (let i = 1; i < valores.length; i++) {
    if (valores[i][0] === datos.nombre) { fila = i + 1; break; }
  }

  const registro = [
    datos.nombre,
    new Date(),
    resultado.prioridadCliente.prioridad,
    resultado.prioridadCliente.etiqueta,
    datos.pendiente || '',
    datos.giro || '',
    datos.bancoPrincipalCaptacion || '',
    datos.bancoCambios || '',
  ];

  if (fila === -1) {
    hoja.appendRow(registro);
  } else {
    hoja.getRange(fila, 1, 1, registro.length).setValues([registro]);
  }
}

/** Lista de nombres de clientes ya registrados, ordenada alfabéticamente. */
function obtenerListaClientesRegistrados_() {
  const hoja = obtenerBaseDeDatosSegura_().getSheetByName('Clientes');
  const valores = hoja.getDataRange().getValues();
  const nombres = [];
  for (let i = 1; i < valores.length; i++) {
    if (valores[i][0]) nombres.push(valores[i][0]);
  }
  return nombres.sort(function (a, b) { return a.localeCompare(b, 'es'); });
}

/** Muestra en un cuadro de alerta el historial guardado de un cliente. */
function mostrarHistorialCliente_(ui, nombre) {
  const hoja = obtenerBaseDeDatosSegura_().getSheetByName('Clientes');
  const valores = hoja.getDataRange().getValues();

  for (let i = 1; i < valores.length; i++) {
    if (valores[i][0] === nombre) {
      const ultimaVisita = valores[i][1];
      const etiqueta = valores[i][3];
      const pendiente = valores[i][4];
      let mensaje = '';
      if (ultimaVisita) {
        mensaje += 'Última visita: ' + Utilities.formatDate(new Date(ultimaVisita), Session.getScriptTimeZone(), 'dd/MM/yyyy') + '\n';
      }
      if (etiqueta) mensaje += 'Última prioridad: ' + etiqueta + '\n';
      mensaje += 'Pendiente: ' + (pendiente ? pendiente : 'Ninguno registrado');
      ui.alert('Historial de ' + nombre, mensaje, ui.ButtonSet.OK);
      return;
    }
  }
}
