/**
 * Arnés de pruebas LOCAL (Node.js) del FLUJO DE PREGUNTAS (Sidebar_UI.gs).
 *
 * Correr con:  node test_flujo_dialogos.js
 *
 * Por qué existe: `test_motor_reglas.js` prueba el motor (qué oportunidad y
 * qué prioridad). Este archivo prueba lo otro — que las preguntas se hagan
 * bien: que se pueda regresar a la pregunta anterior, que un Cancelar
 * accidental no borre todo lo capturado, que dos clientes escritos distinto
 * no se dupliquen, y que un nombre de empresa raro no rompa el cuadro de
 * resultado.
 *
 * Cómo funciona: se carga el Sidebar_UI.gs REAL (ver apps_script_sandbox.js)
 * y se le conecta una "hoja falsa" y un "asesor falso" que contesta según un
 * guion escrito de antemano. Así se puede recorrer el flujo completo sin
 * abrir Google Sheets.
 *
 * DATOS FICTICIOS: todos los nombres de empresa que aparecen en este archivo
 * son inventados para las pruebas. No hay ningún dato de un cliente real.
 *
 * OJO — esto NO sustituye probar en el Sheet real: aquí se verifica la lógica
 * del flujo, no que los cuadros de diálogo de Google se vean bien ni que los
 * PDF se generen. Eso se prueba a mano (ver COMO_PROBARLO.md).
 */

const { cargarArchivosGs } = require('./apps_script_sandbox');

let pasadas = 0;
let fallidas = 0;

function assert(condicion, mensaje) {
  if (condicion) {
    pasadas++;
    console.log(`  OK   - ${mensaje}`);
  } else {
    fallidas++;
    console.log(`  FAIL - ${mensaje}`);
  }
}

function escenario(nombre, fn) {
  console.log(`\nEscenario: ${nombre}`);
  try {
    fn();
  } catch (e) {
    fallidas++;
    console.log(`  FAIL - el escenario tronó: ${e.message}`);
  }
}

// ============================================================
// DOBLES: el "asesor falso" que contesta los cuadros de diálogo
// ============================================================

/**
 * @param {Array} guion  Respuestas en orden. Para un cuadro de texto:
 *                       { boton: 'OK', texto: 'lo que escribe' }.
 *                       Para una pregunta de botones: { boton: 'YES' }.
 * Los avisos informativos (ui.alert con un solo botón OK) no consumen guion:
 * el asesor solo los lee y les da Aceptar.
 */
function crearAsesorFalso(guion) {
  const Button = { OK: 'OK', CANCEL: 'CANCEL', CLOSE: 'CLOSE', YES: 'YES', NO: 'NO' };
  const ButtonSet = { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO', YES_NO_CANCEL: 'YES_NO_CANCEL' };

  let i = 0;
  const avisos = [];
  const preguntas = [];

  function siguiente(mensaje) {
    if (i >= guion.length) {
      throw new Error('El guion se quedó sin respuestas. Última pregunta: ' + mensaje);
    }
    preguntas.push(mensaje);
    return guion[i++];
  }

  return {
    Button: Button,
    ButtonSet: ButtonSet,
    avisos: avisos,
    preguntas: preguntas,
    respuestasUsadas: function () { return i; },

    prompt: function (titulo, mensaje) {
      const paso = siguiente(mensaje);
      return {
        getSelectedButton: function () { return paso.boton || Button.OK; },
        getResponseText: function () { return paso.texto === undefined ? '' : paso.texto; },
      };
    },

    alert: function (titulo, mensaje, botones) {
      // Un solo botón = aviso informativo, no una pregunta.
      if (botones === undefined || botones === ButtonSet.OK) {
        avisos.push(String(mensaje === undefined ? titulo : mensaje));
        return Button.OK;
      }
      return siguiente(mensaje).boton;
    },
  };
}

/** Hoja de cálculo falsa: guarda las filas en memoria. */
function crearHojaFalsa(filas) {
  return {
    filas: filas,
    getLastRow: function () { return filas.length; },
    getDataRange: function () { return { getValues: function () { return filas; } }; },
    appendRow: function (fila) { filas.push(fila); },
    getRange: function (fila) {
      return {
        setValues: function (valores) { filas[fila - 1] = valores[0]; },
        setFontWeight: function () { return this; },
      };
    },
    setFrozenRows: function () {},
  };
}

function crearLibroFalso(hojas) {
  return {
    getSheetByName: function (nombre) { return hojas[nombre] || null; },
    insertSheet: function (nombre) { hojas[nombre] = crearHojaFalsa([]); return hojas[nombre]; },
    getSheets: function () { return Object.keys(hojas).map(function (n) { return hojas[n]; }); },
  };
}

/** Carga los dos .gs reales en un contexto limpio para cada escenario. */
function cargarProyecto() {
  return cargarArchivosGs(['prototipo_entregables_sow.gs', 'Sidebar_UI.gs'], {
    SpreadsheetApp: {
      getUi: function () { throw new Error('No debería pedir la UI real en las pruebas.'); },
      flush: function () {},
    },
  });
}

// ============================================================
// 1. UTILIDADES DE TEXTO
// ============================================================

escenario('normalizarTexto_ deja comparables mayúsculas, acentos y espacios', () => {
  const p = cargarProyecto();
  const normalizar = p.leer('normalizarTexto_');
  assert(normalizar('ACEROS  del Nórte') === 'aceros del norte', 'quita acentos, mayúsculas y espacios de sobra');
  assert(normalizar('  Aceros del Norte  ') === 'aceros del norte', 'recorta los espacios de las orillas');
  assert(normalizar(null) === '' && normalizar(undefined) === '', 'no truena con valores vacíos');
});

escenario('escaparHtml_ evita que un nombre raro rompa el cuadro de resultado', () => {
  const p = cargarProyecto();
  const escapar = p.leer('escaparHtml_');
  const escapado = escapar('Aceros & Cía <script>alert("x")</script>');
  // Se revisa caracter por caracter: basta con que se escape uno de menos
  // para que un nombre de empresa pueda romper (o inyectar) el cuadro.
  assert(escapado.indexOf('<') === -1, 'no deja pasar ningún < sin escapar');
  assert(escapado.indexOf('>') === -1, 'no deja pasar ningún > sin escapar');
  assert(escapado.indexOf('"') === -1, 'no deja pasar ninguna comilla doble sin escapar');
  assert(escapado.indexOf('&lt;script&gt;') !== -1, 'la etiqueta queda convertida en texto inofensivo');
  assert(escapar('a & b') === 'a &amp; b', 'convierte & en &amp;');
  assert(escapar("O'Brien") === 'O&#39;Brien', 'convierte la comilla simple');
});

escenario('normalizarNombreDeBanco_ reconoce a BASE escrito de varias formas', () => {
  const p = cargarProyecto();
  const normalizarBanco = p.leer('normalizarNombreDeBanco_');
  // Si esto fallara, el sistema trataría a BASE como competencia y detectaría
  // una oportunidad falsa contra nuestro propio banco.
  assert(normalizarBanco('Banco BASE') === 'BASE', '"Banco BASE" (de la lista) → BASE');
  assert(normalizarBanco('base') === 'BASE', '"base" escrito a mano → BASE');
  assert(normalizarBanco('BANCO BASE S.A.') === 'BASE', '"BANCO BASE S.A." → BASE');
  assert(normalizarBanco('Santander') === 'Santander', 'otro banco se guarda tal cual');
});

escenario('filtrarClientesPorTexto_ busca sin importar acentos ni mayúsculas', () => {
  const p = cargarProyecto();
  const filtrar = p.leer('filtrarClientesPorTexto_');
  const normalizar = p.leer('normalizarTexto_');
  const clientes = ['Aceros del Norte', 'Autopartes García', 'Textiles Bajío'].map(function (n) {
    return { nombre: n, clave: normalizar(n) };
  });
  assert(filtrar(clientes, 'ACEROS').length === 1, 'encuentra escribiendo en mayúsculas');
  assert(filtrar(clientes, 'garcia')[0].nombre === 'Autopartes García', 'encuentra sin escribir el acento');
  assert(filtrar(clientes, 'zzz').length === 0, 'no inventa resultados');
});

escenario('formatearFecha_ aguanta celdas vacías o con basura', () => {
  const p = cargarProyecto();
  const formatear = p.leer('formatearFecha_');
  assert(formatear(new Date(2026, 8, 4)) === '04/09/2026', 'formatea una fecha normal');
  assert(formatear('') === '' && formatear(null) === '', 'devuelve vacío si no hay fecha');
  assert(formatear('no es una fecha') === '', 'no truena con texto que no es fecha');
});

// ============================================================
// 2. CUADROS DE DIÁLOGO
// ============================================================

escenario('Un cuadro de texto vacío se vuelve a preguntar (no cancela todo)', () => {
  const p = cargarProyecto();
  const pedirTexto = p.leer('pedirTexto_');
  // Antes, dejar el cuadro vacío abortaba el diagnóstico completo.
  const ui = crearAsesorFalso([{ boton: 'OK', texto: '   ' }, { boton: 'OK', texto: 'Aceros del Norte' }]);
  const resultado = pedirTexto(ui, 'Nombre del cliente:', {});
  assert(resultado === 'Aceros del Norte', 'insiste hasta que hay una respuesta');
  assert(ui.avisos.length === 1, 'avisa una vez que el dato no puede quedar vacío');
});

escenario('Un dato opcional sí puede quedar vacío', () => {
  const p = cargarProyecto();
  const pedirTexto = p.leer('pedirTexto_');
  const ui = crearAsesorFalso([{ boton: 'OK', texto: '' }]);
  assert(pedirTexto(ui, '¿Algo pendiente?', { permitirVacio: true }) === '', 'acepta la respuesta vacía');
});

escenario('Cancelar por accidente NO borra lo ya capturado', () => {
  const p = cargarProyecto();
  const pedirTexto = p.leer('pedirTexto_');
  // Cancelar → "No, seguir contestando" → contesta normal.
  const ui = crearAsesorFalso([
    { boton: 'CANCEL' },
    { boton: 'NO' },
    { boton: 'OK', texto: 'Aceros del Norte' },
  ]);
  assert(pedirTexto(ui, 'Nombre:', {}) === 'Aceros del Norte', 'se puede regresar a la pregunta y seguir');
});

escenario('Cancelar y confirmar sí sale del diagnóstico', () => {
  const p = cargarProyecto();
  const pedirTexto = p.leer('pedirTexto_');
  const ui = crearAsesorFalso([{ boton: 'CANCEL' }, { boton: 'YES' }]);
  assert(pedirTexto(ui, 'Nombre:', {}) === null, 'devuelve null = salir sin guardar');
});

escenario('La lista numerada rechaza respuestas que no son un número', () => {
  const p = cargarProyecto();
  const pedirOpcion = p.leer('pedirOpcion_');
  const ui = crearAsesorFalso([
    { boton: 'OK', texto: '2 bancos' }, // antes esto se colaba como un "2"
    { boton: 'OK', texto: '9' },        // fuera de rango
    { boton: 'OK', texto: '2' },
  ]);
  assert(pedirOpcion(ui, 'Elige:', ['BBVA', 'Santander'], false) === 'Santander', 'solo acepta un número de la lista');
  assert(ui.avisos.length === 2, 'avisa las dos veces que la respuesta no servía');
});

escenario('Escribir 0 regresa a la pregunta anterior', () => {
  const p = cargarProyecto();
  const pedirOpcion = p.leer('pedirOpcion_');
  const VOLVER = p.leer('VOLVER');
  const ui = crearAsesorFalso([{ boton: 'OK', texto: '0' }]);
  assert(pedirOpcion(ui, 'Elige:', ['A', 'B'], true) === VOLVER, 'el 0 significa volver');
});

escenario('El 0 NO significa volver en la primera pregunta', () => {
  const p = cargarProyecto();
  const pedirOpcion = p.leer('pedirOpcion_');
  const ui = crearAsesorFalso([{ boton: 'OK', texto: '0' }, { boton: 'OK', texto: '1' }]);
  assert(pedirOpcion(ui, 'Elige:', ['A', 'B'], false) === 'A', 'sin pregunta anterior, el 0 es inválido');
});

escenario('"Otro (especifica)" abre un cuadro de texto libre', () => {
  const p = cargarProyecto();
  const pedirOpcionConOtro = p.leer('pedirOpcionConOtro_');
  const ui = crearAsesorFalso([
    { boton: 'OK', texto: '3' }, // la opción "Otro" queda al final
    { boton: 'OK', texto: 'Arrendadora' },
  ]);
  assert(pedirOpcionConOtro(ui, 'Giro:', ['Comercializadora', 'Manufactura'], false) === 'Arrendadora',
    'guarda lo que el asesor escribió');
});

// ============================================================
// 3. RECORRIDO DE LAS PREGUNTAS (ida y vuelta)
// ============================================================

function pasoDeGuion(clave, respuestas, extra) {
  let n = 0;
  const paso = {
    clave: clave,
    llamadas: 0,
    preguntar: function () {
      paso.llamadas++;
      if (n >= respuestas.length) throw new Error('El paso ' + clave + ' se quedó sin respuestas');
      return respuestas[n++];
    },
  };
  return Object.assign(paso, extra || {});
}

escenario('Volver salta los pasos que no aplican', () => {
  const p = cargarProyecto();
  const recorrerPasos = p.leer('recorrerPasos_');
  const VOLVER = p.leer('VOLVER');

  // B solo aplica si A === 'sí'. Se contesta A='no' (B se salta), y desde C se
  // pide volver: debe regresar a A, NUNCA a la pregunta B que no aplicaba.
  const pasoA = pasoDeGuion('A', ['no', 'sí']);
  const pasoB = pasoDeGuion('B', ['valorB'], {
    aplica: function (datos) { return datos.A === 'sí'; },
    valorSiNoAplica: '',
  });
  const pasoC = pasoDeGuion('C', [VOLVER, 'valorC']);

  const datos = recorrerPasos(null, [pasoA, pasoB, pasoC]);

  assert(pasoA.llamadas === 2, 'al volver desde C, se vuelve a preguntar A');
  assert(pasoB.llamadas === 1, 'B solo se preguntó cuando ya aplicaba');
  assert(datos.A === 'sí' && datos.B === 'valorB' && datos.C === 'valorC', 'quedan las respuestas correctas');
});

escenario('Un paso que no aplica guarda su valor por omisión', () => {
  const p = cargarProyecto();
  const recorrerPasos = p.leer('recorrerPasos_');
  const pasoA = pasoDeGuion('A', ['no']);
  const pasoB = pasoDeGuion('B', [], {
    aplica: function (datos) { return datos.A === 'sí'; },
    valorSiNoAplica: '',
  });
  const datos = recorrerPasos(null, [pasoA, pasoB]);
  assert(datos.B === '', 'el banco del crédito queda vacío si no hay crédito');
  assert(pasoB.llamadas === 0, 'no se le pregunta al asesor algo que no aplica');
});

escenario('Salir a media captura no devuelve datos a medias', () => {
  const p = cargarProyecto();
  const recorrerPasos = p.leer('recorrerPasos_');
  const pasoA = pasoDeGuion('A', ['valorA']);
  const pasoB = pasoDeGuion('B', [null]); // el asesor confirmó que quiere salir
  assert(recorrerPasos(null, [pasoA, pasoB]) === null, 'devuelve null, no un objeto incompleto');
});

escenario('Pedir volver en la primera pregunta no rompe el recorrido', () => {
  const p = cargarProyecto();
  const recorrerPasos = p.leer('recorrerPasos_');
  const VOLVER = p.leer('VOLVER');
  // En la primera pregunta no hay a donde volver: debe volver a preguntar,
  // nunca salirse de la lista de pasos y tronar.
  const pasoA = pasoDeGuion('A', [VOLVER, 'valorA']);
  const datos = recorrerPasos(null, [pasoA]);
  assert(datos !== null && datos.A === 'valorA', 'vuelve a preguntar y sigue adelante');
  assert(pasoA.llamadas === 2, 'se pregunto dos veces');
});

escenario('El cuadro de resultado escapa el nombre del cliente', () => {
  const p = cargarProyecto();
  let htmlGenerado = '';
  p.contexto.HtmlService = {
    createHtmlOutput: function (html) {
      htmlGenerado = html;
      return { setWidth: function () { return this; }, setHeight: function () { return this; } };
    },
  };
  p.contexto.SpreadsheetApp = { getUi: function () { return { showModalDialog: function () {} }; } };

  const mostrarResultado = p.leer('mostrarResultadoEnDialogo_');
  mostrarResultado(
    {
      prioridadCliente: { prioridad: 1, etiqueta: 'Prioridad 1', motivo: 'motivo' },
      oportunidades: [{ producto: 'Divisas / Cambios', justificacion: 'Cambios con <b>otro</b> banco' }],
      pdfAsesor: { getUrl: function () { return 'https://example.test/a'; } },
      guion: { getUrl: function () { return 'https://example.test/b'; } },
    },
    { nombre: 'Aceros & Cia <script>alert(1)</script>', pendiente: 'nada <b>' },
    ''
  );

  assert(htmlGenerado.indexOf('<script>alert(1)</script>') === -1, 'no inserta el script del nombre tal cual');
  assert(htmlGenerado.indexOf('Aceros &amp; Cia') !== -1, 'el nombre aparece escapado');
  assert(htmlGenerado.indexOf('Cambios con &lt;b&gt;otro&lt;/b&gt; banco') !== -1, 'la justificacion tambien va escapada');
});

// ============================================================
// 4. FLUJO COMPLETO, CONECTADO AL MOTOR REAL
// ============================================================

escenario('Captura completa de una visita y clasificación real del cliente', () => {
  const p = cargarProyecto();
  p.contexto.obtenerClientesRegistrados_ = function () { return []; }; // base vacía
  p.contexto.mostrarHistorialCliente_ = function () {};

  const capturar = p.leer('capturarDatosDeVisita_');
  const evaluarReglas = p.leer('evaluarReglas');
  const clasificarPrioridad = p.leer('clasificarPrioridad');
  const TABLA_REGLAS = p.leer('TABLA_REGLAS');

  const ui = crearAsesorFalso([
    { boton: 'OK', texto: 'Comercializadora Ficticia SA de CV' }, // nombre
    { boton: 'OK', texto: '1' },   // giro: Comercializadora
    { boton: 'OK', texto: '2' },   // captación: BBVA
    { boton: 'OK', texto: '3' },   // cambios: Santander
    { boton: 'YES' },              // ¿crédito con otro banco? sí
    { boton: 'OK', texto: '3' },   // banco del crédito (sin BASE en la lista): Banorte
    { boton: 'YES' },              // ¿recibe cotizaciones? sí
    { boton: 'NO' },               // ¿capturar montos? no
    { boton: 'OK', texto: 'Enviar comparativo de divisas' }, // pendiente
  ]);

  const datos = capturar(ui);

  assert(datos !== null, 'la captura terminó bien');
  assert(datos.nombre === 'Comercializadora Ficticia SA de CV', 'guarda el nombre del cliente');
  assert(datos.bancoPrincipalCaptacion === 'BBVA', 'guarda el banco de captación');
  assert(datos.bancoCambios === 'Santander', 'guarda el banco de cambios');
  assert(datos.bancoCredito === 'Banorte', 'guarda el banco del crédito');
  assert(datos.capturarMontos === undefined, 'no manda al motor la pregunta auxiliar de montos');
  assert(datos.pendiente === 'Enviar comparativo de divisas', 'guarda el pendiente');

  // Y ahora el motor real, con los datos que produjo el flujo real.
  const prioridad = clasificarPrioridad(datos);
  const oportunidades = evaluarReglas(datos, TABLA_REGLAS);
  assert(prioridad.prioridad === 1, 'bancos repartidos (Santander vs Banorte) → Prioridad 1');
  assert(oportunidades.length === 3, 'detecta Divisas, Crédito y Captación');
  assert(!oportunidades.some(function (o) { return o.producto === 'Comercio exterior'; }),
    'sin montos capturados, no inventa comercio exterior');
});

escenario('Capturar los montos habilita la oportunidad de comercio exterior', () => {
  const p = cargarProyecto();
  p.contexto.obtenerClientesRegistrados_ = function () { return []; };
  p.contexto.mostrarHistorialCliente_ = function () {};

  const capturar = p.leer('capturarDatosDeVisita_');
  const evaluarReglas = p.leer('evaluarReglas');
  const TABLA_REGLAS = p.leer('TABLA_REGLAS');

  const ui = crearAsesorFalso([
    { boton: 'OK', texto: 'Manufacturas Ficticias SA' },
    { boton: 'OK', texto: '2' },   // giro: Manufactura
    { boton: 'OK', texto: '1' },   // captación: Banco BASE
    { boton: 'OK', texto: '1' },   // cambios: Banco BASE
    { boton: 'NO' },               // sin crédito con otro banco
    { boton: 'NO' },               // no recibe cotizaciones
    { boton: 'YES' },              // sí capturar montos
    { boton: 'OK', texto: '' },            // compra divisas: no lo sabe
    { boton: 'OK', texto: '' },            // vende divisas: no lo sabe
    { boton: 'OK', texto: 'USD 80,000' },  // exporta
    { boton: 'OK', texto: 'USD 120,000' }, // importa
    { boton: 'OK', texto: '' },            // sin pendiente
  ]);

  const datos = capturar(ui);
  assert(datos.bancoPrincipalCaptacion === 'BASE', '"Banco BASE" se traduce al valor que espera el motor');
  assert(datos.montoExportacionMensual === 'USD 80,000', 'guarda el monto de exportación');

  const oportunidades = evaluarReglas(datos, TABLA_REGLAS);
  assert(oportunidades.length === 1 && oportunidades[0].producto === 'Comercio exterior',
    'la única brecha es comercio exterior (todo lo demás ya está con BASE)');
});

escenario('El flujo permite regresar y corregir una respuesta', () => {
  const p = cargarProyecto();
  p.contexto.obtenerClientesRegistrados_ = function () { return []; };
  p.contexto.mostrarHistorialCliente_ = function () {};
  const capturar = p.leer('capturarDatosDeVisita_');

  const ui = crearAsesorFalso([
    { boton: 'OK', texto: 'Cliente Ficticio SA' },
    { boton: 'OK', texto: '1' },   // giro
    { boton: 'OK', texto: '2' },   // captación: BBVA
    { boton: 'OK', texto: '0' },   // ← se equivocó: vuelve a la captación
    { boton: 'OK', texto: '4' },   // captación corregida: Banorte
    { boton: 'OK', texto: '3' },   // cambios: Santander
    { boton: 'NO' },               // sin crédito
    { boton: 'NO' },               // sin cotizaciones
    { boton: 'NO' },               // sin montos
    { boton: 'OK', texto: '' },    // sin pendiente
  ]);

  const datos = capturar(ui);
  assert(datos.bancoPrincipalCaptacion === 'Banorte', 'se quedó la respuesta corregida, no la primera');
});

// ============================================================
// 5. MEMORIA DE CLIENTES (hoja "Clientes")
// ============================================================

escenario('El mismo cliente escrito distinto NO se duplica', () => {
  const p = cargarProyecto();
  const actualizarRegistroCliente = p.leer('actualizarRegistroCliente_');

  const hojaClientes = crearHojaFalsa([
    ['Cliente', 'Última visita', 'Prioridad', 'Etiqueta', 'Pendiente', 'Giro', 'Banco captación', 'Banco cambios'],
    ['Aceros del Norte', new Date(2026, 7, 1), 3, 'Prioridad 3 — rutina normal', 'nada', 'Manufactura', 'BBVA', 'BBVA'],
  ]);
  const libro = crearLibroFalso({ Clientes: hojaClientes });

  actualizarRegistroCliente(
    libro,
    { nombre: 'ACEROS  DEL NÓRTE', pendiente: 'Enviar cotización', giro: 'Manufactura', bancoPrincipalCaptacion: 'BBVA', bancoCambios: 'Santander' },
    { prioridadCliente: { prioridad: 1, etiqueta: 'Prioridad 1 — ataque directo' } }
  );

  assert(hojaClientes.filas.length === 2, 'no agrega un renglón repetido');
  assert(hojaClientes.filas[1][0] === 'Aceros del Norte', 'conserva el nombre como se escribió la primera vez');
  assert(hojaClientes.filas[1][2] === 1, 'actualiza la prioridad del cliente');
  assert(hojaClientes.filas[1][4] === 'Enviar cotización', 'actualiza el pendiente');
});

escenario('Un cliente que no existía sí se agrega', () => {
  const p = cargarProyecto();
  const actualizarRegistroCliente = p.leer('actualizarRegistroCliente_');
  const hojaClientes = crearHojaFalsa([
    ['Cliente', 'Última visita', 'Prioridad', 'Etiqueta', 'Pendiente', 'Giro', 'Banco captación', 'Banco cambios'],
  ]);
  const libro = crearLibroFalso({ Clientes: hojaClientes });

  actualizarRegistroCliente(
    libro,
    { nombre: 'Textiles Ficticios SA', pendiente: '', giro: 'Manufactura', bancoPrincipalCaptacion: 'HSBC', bancoCambios: 'HSBC' },
    { prioridadCliente: { prioridad: 2, etiqueta: 'Prioridad 2 — cliente disputado' } }
  );

  assert(hojaClientes.filas.length === 2, 'agrega el renglón del cliente nuevo');
  assert(hojaClientes.filas[1][0] === 'Textiles Ficticios SA', 'con su nombre');
});

escenario('Avisa cuando el cliente "nuevo" en realidad ya existía', () => {
  const p = cargarProyecto();
  const normalizar = p.leer('normalizarTexto_');
  p.contexto.mostrarHistorialCliente_ = function () {};
  const pedirNombreDeClienteNuevo = p.leer('pedirNombreDeClienteNuevo_');

  const registrados = [{ nombre: 'Aceros del Norte', clave: normalizar('Aceros del Norte') }];
  const ui = crearAsesorFalso([{ boton: 'OK', texto: 'aceros del norte' }]);

  const elegido = pedirNombreDeClienteNuevo(ui, registrados, false);
  assert(elegido === 'Aceros del Norte', 'reutiliza el cliente que ya estaba registrado');
  assert(ui.avisos.some(function (a) { return a.indexOf('Ya tenías registrado') !== -1; }),
    'se lo explica al asesor en lugar de duplicar en silencio');
});

escenario('La hoja "Clientes" se repone sola si alguien la borra', () => {
  const p = cargarProyecto();
  const asegurarHoja = p.leer('asegurarHoja_');
  const ENCABEZADO_CLIENTES = p.leer('ENCABEZADO_CLIENTES');
  const libro = crearLibroFalso({}); // sin ninguna hoja

  const hoja = asegurarHoja(libro, 'Clientes', ENCABEZADO_CLIENTES);
  assert(hoja !== null && hoja.filas.length === 1, 'crea la hoja con su encabezado');
  assert(hoja.filas[0][0] === 'Cliente', 'el encabezado es el correcto');
});

// ============================================================
// 6. BÚSQUEDA CUANDO YA HAY MUCHOS CLIENTES
// ============================================================

escenario('Con muchos clientes se busca por nombre, no por número', () => {
  const p = cargarProyecto();
  const normalizar = p.leer('normalizarTexto_');
  const buscarClienteRegistrado = p.leer('buscarClienteRegistrado_');

  // 20 clientes: antes, del 16 en adelante eran inalcanzables (se cortaba en 15).
  const registrados = [];
  for (let i = 1; i <= 20; i++) {
    const nombre = 'Cliente Ficticio ' + (i < 10 ? '0' + i : i);
    registrados.push({ nombre: nombre, clave: normalizar(nombre) });
  }
  registrados.push({ nombre: 'Aceros del Norte', clave: normalizar('Aceros del Norte') });

  const ui = crearAsesorFalso([
    { boton: 'OK', texto: 'aceros' }, // busca
    { boton: 'OK', texto: '1' },      // lo elige de los resultados
  ]);

  assert(buscarClienteRegistrado(ui, registrados) === 'Aceros del Norte',
    'se puede llegar a un cliente que antes quedaba fuera de la lista');
});

escenario('Si la búsqueda no encuentra nada, se puede intentar otra vez', () => {
  const p = cargarProyecto();
  const normalizar = p.leer('normalizarTexto_');
  const buscarClienteRegistrado = p.leer('buscarClienteRegistrado_');

  const registrados = [];
  for (let i = 1; i <= 20; i++) {
    const nombre = 'Cliente Ficticio ' + i;
    registrados.push({ nombre: nombre, clave: normalizar(nombre) });
  }

  const ui = crearAsesorFalso([
    { boton: 'OK', texto: 'zzzz' },  // no existe
    { boton: 'OK', texto: 'Ficticio 7' },
    { boton: 'OK', texto: '1' },
  ]);

  assert(buscarClienteRegistrado(ui, registrados) === 'Cliente Ficticio 7', 'deja corregir la búsqueda');
  assert(ui.avisos.some(function (a) { return a.indexOf('No encontré') !== -1; }), 'avisa que no encontró nada');
});

// ============================================================
// 7. GOBERNANZA
// ============================================================

escenario('El catálogo de bancos respeta el contrato con el motor', () => {
  const p = cargarProyecto();
  const BANCOS_COMUNES = p.leer('BANCOS_COMUNES');
  const VALOR_MOTOR_BASE = p.leer('VALOR_MOTOR_BASE');
  const NOMBRE_VISIBLE_BASE = p.leer('NOMBRE_VISIBLE_BASE');

  assert(VALOR_MOTOR_BASE === 'BASE', 'el motor sigue esperando el texto exacto BASE');
  assert(BANCOS_COMUNES[0] === NOMBRE_VISIBLE_BASE, 'Banco BASE aparece primero en la lista');
  assert(BANCOS_COMUNES.indexOf('BASE') === -1, 'la lista muestra "Banco BASE", no el valor interno');
});

console.log(`\n---\nResultado: ${pasadas} pruebas OK, ${fallidas} fallidas.`);
if (fallidas > 0) process.exit(1);
