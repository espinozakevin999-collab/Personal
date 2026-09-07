/**
 * SIDEBAR_UI.gs — Menú + panel lateral (HtmlService) del diagnóstico
 * Banco BASE | Orquestación comercial
 *
 * Este archivo NO reemplaza prototipo_entregables_sow.gs — lo envuelve con
 * una interfaz dentro de Sheets. Toda la lógica de negocio (qué oportunidad
 * se detecta y qué prioridad se asigna) sigue viviendo en ese otro archivo;
 * aquí solo se pregunta, se guarda y se muestra.
 *
 * NOTA DE DISEÑO (7 sept 2026): el menú nativo de Sheets NO se puede
 * estilizar (chrome propio de Google — sin color, sin iconos, sin jerarquía
 * visual). Por eso el "menú con opciones" del mockup vive DENTRO del panel
 * (Sidebar.html, paso 0). El menú de Sheets es solo la puerta de entrada.
 *
 * Flujo:
 *   Menú "Diagnóstico Share of Wallet" → Abrir panel de diagnóstico
 *     → Sidebar.html: pantalla de opciones → elige/registra cliente →
 *       responde preguntas → ve el resultado
 *     → guardarRespuestaYGenerar(): corre generarEntregables() (motor real,
 *       sin duplicar lógica) y luego guarda la visita.
 *
 * ORDEN DE LAS OPERACIONES (importa): primero se generan los PDF y después
 * se guarda. Si la generación falla, no queda una fila a medias; si falla el
 * guardado, los PDF igual se entregan con un aviso. Las dos hojas se
 * escriben juntas bajo un mismo candado (LockService), para que dos asesores
 * trabajando al mismo tiempo no se pisen.
 *
 * BASE DE DATOS SEGURA: las respuestas y el registro de clientes se guardan
 * en un Google Sheet APARTE (no en esta hoja de prueba), que se crea solo la
 * primera vez. Ver obtenerBaseDeDatosSegura_().
 *
 * LIMITACIÓN CONOCIDA (pendiente de decisión, no es un error): el archivo de
 * base de datos lo crea y lo POSEE la primera persona que use la
 * herramienta. Si van a usarla varios asesores y necesitan ver el mismo
 * historial, hay que compartir ese archivo con ellos.
 *
 * Requiere que este archivo, Sidebar.html y prototipo_entregables_sow.gs
 * vivan en el MISMO proyecto de Apps Script. El archivo HTML debe llamarse
 * exactamente "Sidebar" — mostrarPanelDiagnostico() lo busca por ese nombre.
 *
 * DATOS FICTICIOS: todos los clientes que aparezcan aquí y en el historial
 * son inventados. No conectar datos reales de clientes hasta pasar por el
 * proceso de seguridad/TI de Banco BASE (vault, secciones 12 y 14).
 */

const TITULO_DIALOGO = 'Diagnóstico Share of Wallet';

// ============================================================
// MENÚ (solo la puerta de entrada — la experiencia vive en el panel)
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(TITULO_DIALOGO)
    .addItem('Abrir panel de diagnóstico', 'mostrarPanelDiagnostico')
    .addSeparator()
    .addItem('Abrir la base de datos de clientes', 'abrirBaseDeDatosDeClientes')
    .addItem('Reconectar la base de datos (solo si algo falla)', 'reconectarBaseDeDatosDeClientes')
    .addSeparator()
    .addItem('Ejecutar autopruebas del motor', 'ejecutarPruebasMotorReglasConAlerta')
    .addToUi();
}

function mostrarPanelDiagnostico() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle(TITULO_DIALOGO);
  SpreadsheetApp.getUi().showSidebar(html);
}

/** Autoprueba desde el MENÚ nativo (muestra un alert de Sheets). */
function ejecutarPruebasMotorReglasConAlerta() {
  const ui = SpreadsheetApp.getUi();
  const resumen = correrAutopruebasDesdeSidebar();
  ui.alert(TITULO_DIALOGO, resumen.mensaje, ui.ButtonSet.OK);
}

/**
 * Misma autoprueba, pensada para llamarse DESDE el panel.
 *
 * ejecutarPruebasMotorReglas() (en prototipo_entregables_sow.gs) escribe su
 * resultado en el registro pero no lo devuelve, así que antes el panel decía
 * "✓ completas" aunque una prueba hubiera fallado. Aquí se lee el registro de
 * esta misma ejecución para reportar el conteo real.
 */
function correrAutopruebasDesdeSidebar() {
  ejecutarPruebasMotorReglas();

  const registro = Logger.getLog() || '';
  const conteo = registro.match(/(\d+)\s+pruebas OK,\s+(\d+)\s+fallidas/);

  if (!conteo) {
    return {
      todoBien: true,
      mensaje: 'Autopruebas ejecutadas. Revisa Ver → Registro de ejecución en el editor de Apps Script para el detalle.',
    };
  }

  const pasadas = parseInt(conteo[1], 10);
  const fallidas = parseInt(conteo[2], 10);
  return {
    todoBien: fallidas === 0,
    mensaje: fallidas === 0
      ? 'Autopruebas completas: ' + pasadas + ' pruebas OK, ninguna falló. El motor está sano.'
      : 'Atención: ' + fallidas + ' prueba(s) fallaron de ' + (pasadas + fallidas) +
        '. No uses los resultados hasta revisarlo — avísale a quien da soporte.',
  };
}

// ============================================================
// CATÁLOGO DE BANCOS
// ============================================================

/**
 * Nombre con el que el motor identifica a Banco BASE. evaluarReglas() y
 * clasificarPrioridad() comparan contra este texto EXACTO.
 */
const VALOR_MOTOR_BASE = 'BASE';

/**
 * Formas en que alguien podría escribir "Banco BASE" en el cuadro de "Otro".
 * Sin esto, el sistema trataría a BASE como competencia y detectaría una
 * oportunidad falsa contra nuestro propio banco.
 */
const ESCRITURAS_DE_BASE = ['base', 'banco base', 'banco base sa', 'banco base s.a.'];

/** "Banco BASE", "base", "BANCO BASE S.A." → 'BASE'. Lo demás, tal cual. */
function normalizarNombreDeBanco_(nombre) {
  return ESCRITURAS_DE_BASE.indexOf(normalizarTexto_(nombre)) !== -1 ? VALOR_MOTOR_BASE : nombre;
}

// ============================================================
// DATOS PARA EL PANEL
// ============================================================

/**
 * Clientes ya registrados, con su memoria (última visita, cómo quedó y qué
 * pendiente dejó). Es lo que alimenta el buscador del paso 1 y la pantalla
 * de historial.
 */
function listarClientes() {
  const hoja = asegurarHoja_(obtenerBaseDeDatosSegura_(), HOJA_CLIENTES, ENCABEZADO_CLIENTES);
  const valores = hoja.getDataRange().getValues();

  const clientes = [];
  const clavesVistas = {};
  for (let i = 1; i < valores.length; i++) {
    const nombre = String(valores[i][0] === null || valores[i][0] === undefined ? '' : valores[i][0]).trim();
    if (!nombre) continue;
    const clave = normalizarTexto_(nombre);
    if (clavesVistas[clave]) continue; // filas repetidas de versiones anteriores
    clavesVistas[clave] = true;
    clientes.push({
      nombre: nombre,
      ultimaVisita: formatearFecha_(valores[i][1]),
      etiqueta: valores[i][3] ? String(valores[i][3]) : '',
      pendiente: valores[i][4] ? String(valores[i][4]) : '',
    });
  }

  return clientes.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
}

// ============================================================
// GUARDAR + GENERAR (lo llama Sidebar.html vía google.script.run)
// ============================================================

/**
 * Punto de entrada único que llama el panel al presionar "Ver resultado y
 * generar entregables". Reutiliza generarEntregables() (definida en
 * prototipo_entregables_sow.gs) para no duplicar el motor de reglas ni el
 * árbol de prioridad.
 */
function guardarRespuestaYGenerar(datosFormulario) {
  const datos = limpiarDatosDelFormulario_(datosFormulario);

  // 1. Primero se generan los documentos. Si esto truena, no se guardó nada.
  const resultado = generarEntregables(datos);

  // 2. Después se guarda la visita. Si falla, los PDF igual se entregan.
  let avisoGuardado = '';
  try {
    guardarVisita_(datos, resultado);
  } catch (e) {
    avisoGuardado =
      'Los dos documentos sí se generaron y los puedes abrir aquí abajo, pero no se pudo guardar ' +
      'esta visita en la base de datos. ' + mensajeAmigableDeError_(e, 'al guardar');
  }

  return {
    pdfUrl: resultado.pdfAsesor.getUrl(),
    guionUrl: resultado.guion.getUrl(),
    oportunidades: resultado.oportunidades,
    prioridad: resultado.prioridadCliente,
    avisoGuardado: avisoGuardado,
  };
}

/**
 * Normaliza lo que llega del panel antes de dárselo al motor. El panel ya
 * manda el valor correcto, pero esto protege por si alguien escribe "Banco
 * BASE" a mano en el cuadro de "Otro (especifica)".
 */
function limpiarDatosDelFormulario_(datos) {
  const limpio = {};
  Object.keys(datos || {}).forEach(function (clave) {
    const valor = datos[clave];
    limpio[clave] = (typeof valor === 'string') ? valor.trim() : valor;
  });

  ['bancoPrincipalCaptacion', 'bancoCambios', 'bancoCredito'].forEach(function (clave) {
    if (limpio[clave]) limpio[clave] = normalizarNombreDeBanco_(limpio[clave]);
  });

  if (limpio.tieneCreditoOtroBanco !== true) limpio.bancoCredito = '';
  return limpio;
}

// ============================================================
// BASE DE DATOS SEGURA (hoja de cálculo aparte)
// ============================================================

const NOMBRE_BASE_DATOS_SOW = 'Base de datos — Diagnóstico Share of Wallet (prototipo, datos ficticios)';
const PROPIEDAD_ID_BASE_DATOS_SOW = 'ID_BASE_DATOS_SOW';

const HOJA_RESPUESTAS = 'Respuestas';
const HOJA_CLIENTES = 'Clientes';

const ENCABEZADO_RESPUESTAS = [
  'Marca temporal', 'Cliente', 'Giro', 'Banco captación', 'Banco cambios',
  'Tiene crédito otro banco', 'Banco crédito', 'Recibe cotizaciones otros bancos',
  'Compra divisas al mes', 'Vende divisas al mes', 'Exporta al mes', 'Importa al mes',
  'Pendiente',
];

const ENCABEZADO_CLIENTES = [
  'Cliente', 'Última visita', 'Prioridad', 'Etiqueta', 'Pendiente',
  'Giro', 'Banco captación', 'Banco cambios',
];

/** El libro se guarda en memoria durante la ejecución para no reabrirlo. */
let libroBaseDeDatosEnMemoria_ = null;

/**
 * Devuelve el libro de la base de datos segura, creándolo la primera vez.
 *
 * Si el identificador guardado ya no se puede abrir, NO se crea otra base en
 * silencio: eso le partiría el historial en dos a quien no tiene acceso al
 * archivo original, sin que se entere.
 */
function obtenerBaseDeDatosSegura_() {
  if (libroBaseDeDatosEnMemoria_) return libroBaseDeDatosEnMemoria_;

  const propiedades = PropertiesService.getScriptProperties();
  const id = propiedades.getProperty(PROPIEDAD_ID_BASE_DATOS_SOW);

  if (id) {
    let libro;
    try {
      libro = SpreadsheetApp.openById(id);
    } catch (e) {
      throw new Error(
        'No se pudo abrir la base de datos de clientes.\n\n' +
        'Puede ser que el archivo se haya borrado, o que lo haya creado otra persona ' +
        'y todavía no lo comparta contigo.\n\n' +
        'Qué hacer: pide que te compartan ese archivo, o usa el menú "' + TITULO_DIALOGO +
        ' → Reconectar la base de datos" para empezar una base nueva y vacía.\n\n' +
        'Identificador del archivo: ' + id
      );
    }
    asegurarEstructura_(libro);
    libroBaseDeDatosEnMemoria_ = libro;
    return libro;
  }

  // Bajo candado: si dos asesores abren el panel al mismo tiempo, solo se
  // crea una base y el segundo reutiliza la del primero.
  libroBaseDeDatosEnMemoria_ = conCandado_(function () {
    const idReciente = propiedades.getProperty(PROPIEDAD_ID_BASE_DATOS_SOW);
    if (idReciente) return SpreadsheetApp.openById(idReciente);
    return crearBaseDeDatosSegura_(propiedades);
  });
  return libroBaseDeDatosEnMemoria_;
}

/**
 * El identificador se guarda HASTA QUE el archivo quedó bien armado. Si la
 * creación falla a medio camino, se descarta el archivo incompleto y no queda
 * ninguna propiedad apuntando a él.
 */
function crearBaseDeDatosSegura_(propiedades) {
  const libro = SpreadsheetApp.create(NOMBRE_BASE_DATOS_SOW);
  try {
    libro.getSheets()[0].setName(HOJA_RESPUESTAS);
    asegurarEstructura_(libro);
  } catch (e) {
    try {
      DriveApp.getFileById(libro.getId()).setTrashed(true);
    } catch (errorDeLimpieza) {
      // Lo importante es no guardar el identificador de un archivo incompleto.
    }
    throw e;
  }
  propiedades.setProperty(PROPIEDAD_ID_BASE_DATOS_SOW, libro.getId());
  return libro;
}

/** Crea las hojas que falten. Si alguien borra una, se repone sola. */
function asegurarEstructura_(libro) {
  asegurarHoja_(libro, HOJA_RESPUESTAS, ENCABEZADO_RESPUESTAS);
  asegurarHoja_(libro, HOJA_CLIENTES, ENCABEZADO_CLIENTES);
}

function asegurarHoja_(libro, nombre, encabezado) {
  let hoja = libro.getSheetByName(nombre);
  if (!hoja) hoja = libro.insertSheet(nombre);
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(encabezado);
    hoja.getRange(1, 1, 1, encabezado.length).setFontWeight('bold');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

/** Ejecuta algo con candado de script, para que dos asesores no se pisen. */
function conCandado_(funcion) {
  const candado = LockService.getScriptLock();
  try {
    candado.waitLock(30000);
  } catch (e) {
    throw new Error('Otra persona está guardando en este momento. Espera unos segundos y vuelve a intentarlo.');
  }
  try {
    return funcion();
  } finally {
    candado.releaseLock();
  }
}

/**
 * Guarda la visita: una fila nueva en "Respuestas" (histórico) y el renglón
 * del cliente en "Clientes" (la memoria). Las dos escrituras van juntas
 * dentro del mismo candado para que nunca quede una sin la otra.
 */
function guardarVisita_(datos, resultado) {
  const libro = obtenerBaseDeDatosSegura_();
  conCandado_(function () {
    agregarFilaDeRespuesta_(libro, datos);
    actualizarRegistroCliente_(libro, datos, resultado);
    SpreadsheetApp.flush();
  });
}

/** Hoja "Respuestas" — una fila por visita. */
function agregarFilaDeRespuesta_(libro, datos) {
  asegurarHoja_(libro, HOJA_RESPUESTAS, ENCABEZADO_RESPUESTAS).appendRow([
    new Date(),
    datos.nombre || '',
    datos.giro || '',
    datos.bancoPrincipalCaptacion || '',
    datos.bancoCambios || '',
    datos.tieneCreditoOtroBanco === true,
    datos.bancoCredito || '',
    datos.recibeCotizacionesOtrosBancos === true,
    datos.montoCompraDivisasMensual || '',
    datos.montoVentaDivisasMensual || '',
    datos.montoExportacionMensual || '',
    datos.montoImportacionMensual || '',
    datos.pendiente || '',
  ]);
}

/**
 * Hoja "Clientes" — un renglón por cliente, no por visita. La búsqueda del
 * renglón ignora mayúsculas y acentos, y se conserva el nombre tal como se
 * escribió la primera vez: así el mismo cliente no acaba repartido en varios
 * renglones por diferencias de escritura.
 */
function actualizarRegistroCliente_(libro, datos, resultado) {
  const hoja = asegurarHoja_(libro, HOJA_CLIENTES, ENCABEZADO_CLIENTES);
  const valores = hoja.getDataRange().getValues();
  const clave = normalizarTexto_(datos.nombre);

  let fila = -1;
  let nombreYaGuardado = datos.nombre;
  for (let i = 1; i < valores.length; i++) {
    if (normalizarTexto_(valores[i][0]) === clave) {
      fila = i + 1;
      nombreYaGuardado = valores[i][0];
      break;
    }
  }

  const registro = [
    nombreYaGuardado,
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

// ============================================================
// UTILIDADES DE TEXTO (sin dependencias de Google — fáciles de probar)
// ============================================================

/**
 * Deja un texto comparable: sin acentos, en minúsculas y con los espacios de
 * sobra colapsados. Es lo que permite que "ACEROS  del Nórte" y
 * "aceros del norte" se reconozcan como el mismo cliente.
 */
function normalizarTexto_(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fecha en dd/mm/aaaa, tolerante a celdas vacías o con texto no reconocible. */
function formatearFecha_(valor) {
  if (!valor) return '';
  const fecha = (valor instanceof Date) ? valor : new Date(valor);
  if (isNaN(fecha.getTime())) return '';
  return Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

/** Traduce un error técnico a algo que un asesor pueda entender y accionar. */
function mensajeAmigableDeError_(error, momento) {
  const detalle = (error && error.message) ? error.message : String(error);

  if (detalle.indexOf('base de datos de clientes') !== -1) return detalle;

  let explicacion = 'Algo falló ' + momento + '.';
  if (/permis|permiss|access|autoriza/i.test(detalle)) {
    explicacion = 'Google no dio permiso ' + momento + '. Cierra y vuelve a abrir la hoja, ' +
      'y acepta los permisos que te pida.';
  } else if (/limit|quota|cuota|exceeded/i.test(detalle)) {
    explicacion = 'Google puso un límite temporal ' + momento + '. Espera unos minutos y ' +
      'vuelve a intentarlo.';
  } else if (/lock|candado/i.test(detalle)) {
    explicacion = 'Otra persona está guardando en este momento. Espera unos segundos y ' +
      'vuelve a intentarlo.';
  }

  return explicacion + '\n\nDetalle técnico (para quien da soporte):\n' + detalle;
}

// ============================================================
// OPCIONES DE MENÚ PARA LA BASE DE DATOS
// ============================================================

/**
 * Da el enlace de la base de datos. Sirve para revisar el historial y, sobre
 * todo, para compartirla con otro asesor (ver la limitación en la cabecera).
 */
function abrirBaseDeDatosDeClientes() {
  const ui = SpreadsheetApp.getUi();
  try {
    const libro = obtenerBaseDeDatosSegura_();
    const html = HtmlService.createHtmlOutput(
      '<div style="font-family:Arial, sans-serif;padding:6px 4px;">' +
      '<p style="font-size:13px;color:#333;">Aquí se guardan las visitas y el historial de cada cliente. ' +
      'Los datos son ficticios (esto es un prototipo).</p>' +
      '<p style="font-size:12px;color:#707272;">Si otro asesor va a usar la herramienta, ' +
      'compártele este archivo para que vean el mismo historial.</p>' +
      '<a href="' + libro.getUrl() + '" target="_blank" style="display:block;background:#F5A800;' +
      'color:#000;text-decoration:none;text-align:center;padding:9px;border-radius:6px;font-weight:bold;">Abrir la base de datos</a>' +
      '</div>'
    ).setWidth(400).setHeight(220);
    ui.showModalDialog(html, 'Base de datos de clientes');
  } catch (e) {
    ui.alert(TITULO_DIALOGO, mensajeAmigableDeError_(e, 'al abrir la base de datos'), ui.ButtonSet.OK);
  }
}

/**
 * Salida de emergencia: olvida el archivo actual y crea una base nueva.
 * Solo tiene sentido cuando la herramienta ya avisó que no puede abrirla.
 */
function reconectarBaseDeDatosDeClientes() {
  const ui = SpreadsheetApp.getUi();

  const confirmacion = ui.alert(TITULO_DIALOGO,
    'Esto crea una base de datos nueva y vacía.\n\n' +
    'El historial que ya tenías NO se borra: se queda en el archivo anterior, pero esta ' +
    'herramienta dejará de leerlo.\n\n' +
    'Úsalo solo si la herramienta te está diciendo que no puede abrir la base de datos.\n\n' +
    '¿Quieres continuar?',
    ui.ButtonSet.YES_NO);
  if (confirmacion !== ui.Button.YES) return;

  try {
    PropertiesService.getScriptProperties().deleteProperty(PROPIEDAD_ID_BASE_DATOS_SOW);
    libroBaseDeDatosEnMemoria_ = null;
    obtenerBaseDeDatosSegura_();
    ui.alert(TITULO_DIALOGO,
      'Listo. Se creó una base de datos nueva y vacía.\n\n' +
      'Puedes verla en el menú → "Abrir la base de datos de clientes".',
      ui.ButtonSet.OK);
  } catch (e) {
    ui.alert(TITULO_DIALOGO, mensajeAmigableDeError_(e, 'al reconectar la base de datos'), ui.ButtonSet.OK);
  }
}
