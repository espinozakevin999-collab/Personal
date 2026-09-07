/**
 * Arnés de pruebas LOCAL (Node.js) del SERVIDOR DEL PANEL (Sidebar_UI.gs).
 *
 * Correr con:  node test_panel.js
 *
 * Qué cubre: lo que el panel le pide al servidor — la memoria de clientes,
 * la limpieza de lo que llega del formulario, el orden en que se generan y
 * se guardan las cosas, y el reporte honesto de las autopruebas.
 *
 * Qué NO cubre: la apariencia del panel (eso se revisa abriendo Sidebar.html
 * en el navegador) ni la generación real de PDF (eso se prueba en el Sheet).
 *
 * Se carga el Sidebar_UI.gs REAL (ver apps_script_sandbox.js), así que no hay
 * copia que se pueda quedar desactualizada.
 *
 * DATOS FICTICIOS: todos los nombres de empresa aquí son inventados.
 */

const { cargarArchivosGs } = require('./apps_script_sandbox');

let pasadas = 0;
let fallidas = 0;

function assert(condicion, mensaje) {
  if (condicion) { pasadas++; console.log(`  OK   - ${mensaje}`); }
  else { fallidas++; console.log(`  FAIL - ${mensaje}`); }
}

function escenario(nombre, fn) {
  console.log(`\nEscenario: ${nombre}`);
  try { fn(); } catch (e) { fallidas++; console.log(`  FAIL - el escenario tronó: ${e.message}`); }
}

// ============================================================
// DOBLES
// ============================================================

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

function cargarProyecto(servicios) {
  return cargarArchivosGs(['Sidebar_UI.gs'], servicios || {});
}

// ============================================================
// 1. UTILIDADES DE TEXTO
// ============================================================

escenario('normalizarTexto_ deja comparables mayúsculas, acentos y espacios', () => {
  const p = cargarProyecto();
  const n = p.leer('normalizarTexto_');
  assert(n('ACEROS  del Nórte') === 'aceros del norte', 'quita acentos, mayúsculas y espacios de sobra');
  assert(n(null) === '' && n(undefined) === '', 'no truena con valores vacíos');
});

escenario('normalizarNombreDeBanco_ reconoce a BASE escrito de varias formas', () => {
  const p = cargarProyecto();
  const nb = p.leer('normalizarNombreDeBanco_');
  // Si esto fallara, el sistema trataría a BASE como competencia y detectaría
  // una oportunidad falsa contra nuestro propio banco.
  assert(nb('Banco BASE') === 'BASE', '"Banco BASE" → BASE');
  assert(nb('base') === 'BASE', '"base" escrito a mano → BASE');
  assert(nb('BANCO BASE S.A.') === 'BASE', '"BANCO BASE S.A." → BASE');
  assert(nb('Santander') === 'Santander', 'otro banco se guarda tal cual');
});

escenario('formatearFecha_ aguanta celdas vacías o con basura', () => {
  const p = cargarProyecto();
  const f = p.leer('formatearFecha_');
  assert(f(new Date(2026, 8, 4)) === '04/09/2026', 'formatea una fecha normal');
  assert(f('') === '' && f(null) === '', 'devuelve vacío si no hay fecha');
  assert(f('no es una fecha') === '', 'no truena con texto que no es fecha');
});

// ============================================================
// 2. LIMPIEZA DE LO QUE LLEGA DEL PANEL
// ============================================================

escenario('limpiarDatosDelFormulario_ protege al motor', () => {
  const p = cargarProyecto();
  const limpiar = p.leer('limpiarDatosDelFormulario_');

  const datos = limpiar({
    nombre: '  Aceros Ficticios SA  ',
    bancoCambios: '  banco base  ',
    bancoPrincipalCaptacion: 'BBVA',
    tieneCreditoOtroBanco: true,
    bancoCredito: 'Banorte',
  });
  assert(datos.nombre === 'Aceros Ficticios SA', 'recorta los espacios del nombre');
  assert(datos.bancoCambios === 'BASE', 'traduce "banco base" escrito a mano al valor del motor');
  assert(datos.bancoCredito === 'Banorte', 'conserva el banco del crédito cuando sí hay crédito');
});

escenario('Sin crédito, el banco del crédito se limpia', () => {
  const p = cargarProyecto();
  const limpiar = p.leer('limpiarDatosDelFormulario_');
  // Si el asesor marca "sí", elige banco y luego cambia a "no", el dato viejo
  // no debe colarse al motor.
  const datos = limpiar({ tieneCreditoOtroBanco: false, bancoCredito: 'Santander' });
  assert(datos.bancoCredito === '', 'el banco del crédito queda vacío');
});

// ============================================================
// 3. MEMORIA DE CLIENTES
// ============================================================

escenario('El mismo cliente escrito distinto NO se duplica', () => {
  const p = cargarProyecto();
  const actualizar = p.leer('actualizarRegistroCliente_');

  const hoja = crearHojaFalsa([
    ['Cliente', 'Última visita', 'Prioridad', 'Etiqueta', 'Pendiente', 'Giro', 'Banco captación', 'Banco cambios'],
    ['Aceros del Norte', new Date(2026, 7, 1), 3, 'Prioridad 3 — rutina normal', 'nada', 'Manufactura', 'BBVA', 'BBVA'],
  ]);
  const libro = crearLibroFalso({ Clientes: hoja });

  actualizar(libro,
    { nombre: 'ACEROS  DEL NÓRTE', pendiente: 'Enviar cotización', giro: 'Manufactura', bancoPrincipalCaptacion: 'BBVA', bancoCambios: 'Santander' },
    { prioridadCliente: { prioridad: 1, etiqueta: 'Prioridad 1 — ataque directo' } });

  assert(hoja.filas.length === 2, 'no agrega un renglón repetido');
  assert(hoja.filas[1][0] === 'Aceros del Norte', 'conserva el nombre como se escribió la primera vez');
  assert(hoja.filas[1][2] === 1, 'actualiza la prioridad');
  assert(hoja.filas[1][4] === 'Enviar cotización', 'actualiza el pendiente');
});

escenario('Un cliente nuevo sí se agrega', () => {
  const p = cargarProyecto();
  const actualizar = p.leer('actualizarRegistroCliente_');
  const hoja = crearHojaFalsa([['Cliente', 'Última visita', 'Prioridad', 'Etiqueta', 'Pendiente', 'Giro', 'Banco captación', 'Banco cambios']]);
  const libro = crearLibroFalso({ Clientes: hoja });

  actualizar(libro,
    { nombre: 'Textiles Ficticios SA', pendiente: '', giro: 'Manufactura', bancoPrincipalCaptacion: 'HSBC', bancoCambios: 'HSBC' },
    { prioridadCliente: { prioridad: 2, etiqueta: 'Prioridad 2 — cliente disputado' } });

  assert(hoja.filas.length === 2 && hoja.filas[1][0] === 'Textiles Ficticios SA', 'agrega el renglón del cliente nuevo');
});

escenario('listarClientes entrega la memoria que muestra el panel', () => {
  const p = cargarProyecto();
  const hoja = crearHojaFalsa([
    ['Cliente', 'Última visita', 'Prioridad', 'Etiqueta', 'Pendiente', 'Giro', 'Banco captación', 'Banco cambios'],
    ['Zeta Ficticia SA', new Date(2026, 8, 4), 1, 'Prioridad 1 — ataque directo', 'Enviar comparativo', 'Servicios', 'BBVA', 'Santander'],
    ['Alfa Ficticia SA', new Date(2026, 8, 1), 3, 'Prioridad 3 — rutina normal', '', 'Manufactura', 'BASE', 'BASE'],
    ['alfa  ficticia sa', new Date(2026, 8, 2), 3, 'Prioridad 3 — rutina normal', '', 'Manufactura', 'BASE', 'BASE'],
  ]);
  const libro = crearLibroFalso({ Clientes: hoja });
  p.contexto.obtenerBaseDeDatosSegura_ = function () { return libro; };

  const lista = p.leer('listarClientes')();
  assert(lista.length === 2, 'filtra el renglón repetido que dejaron versiones anteriores');
  assert(lista[0].nombre === 'Alfa Ficticia SA', 'viene ordenado alfabéticamente');
  assert(lista[1].ultimaVisita === '04/09/2026', 'trae la última visita formateada');
  assert(lista[1].pendiente === 'Enviar comparativo', 'trae el pendiente');
});

escenario('La hoja "Clientes" se repone sola si alguien la borra', () => {
  const p = cargarProyecto();
  const asegurar = p.leer('asegurarHoja_');
  const hoja = asegurar(crearLibroFalso({}), 'Clientes', p.leer('ENCABEZADO_CLIENTES'));
  assert(hoja !== null && hoja.filas.length === 1 && hoja.filas[0][0] === 'Cliente', 'crea la hoja con su encabezado');
});

// ============================================================
// 4. ORDEN DE OPERACIONES AL GENERAR
// ============================================================

escenario('Primero se generan los PDF y después se guarda', () => {
  const p = cargarProyecto();
  const orden = [];
  p.contexto.generarEntregables = function () {
    orden.push('generar');
    return {
      pdfAsesor: { getUrl: function () { return 'https://example.test/a'; } },
      guion: { getUrl: function () { return 'https://example.test/b'; } },
      oportunidades: [],
      prioridadCliente: { prioridad: 3, etiqueta: 'Prioridad 3', motivo: 'sin brechas' },
    };
  };
  p.contexto.guardarVisita_ = function () { orden.push('guardar'); };

  const r = p.leer('guardarRespuestaYGenerar')({ nombre: 'Cliente Ficticio SA', tieneCreditoOtroBanco: false });
  assert(orden.join(' → ') === 'generar → guardar', 'el orden evita filas a medias si truena la generación');
  assert(r.pdfUrl === 'https://example.test/a' && r.guionUrl === 'https://example.test/b', 'devuelve los dos enlaces');
  assert(r.avisoGuardado === '', 'sin aviso cuando todo salió bien');
});

escenario('Si falla el guardado, los PDF se entregan igual con aviso', () => {
  const p = cargarProyecto();
  p.contexto.generarEntregables = function () {
    return {
      pdfAsesor: { getUrl: function () { return 'https://example.test/a'; } },
      guion: { getUrl: function () { return 'https://example.test/b'; } },
      oportunidades: [],
      prioridadCliente: { prioridad: 1, etiqueta: 'Prioridad 1', motivo: 'brecha' },
    };
  };
  p.contexto.guardarVisita_ = function () { throw new Error('No tienes permiso para escribir'); };

  const r = p.leer('guardarRespuestaYGenerar')({ nombre: 'Cliente Ficticio SA' });
  assert(r.pdfUrl === 'https://example.test/a', 'no se pierde el trabajo de la visita');
  assert(r.avisoGuardado.indexOf('no se pudo guardar') !== -1, 'avisa que el registro no se guardó');
  assert(r.avisoGuardado.indexOf('permiso') !== -1, 'el aviso explica la causa en lenguaje simple');
});

escenario('Si truena la generación, no se guarda nada', () => {
  const p = cargarProyecto();
  let guardo = false;
  p.contexto.generarEntregables = function () { throw new Error('Drive no responde'); };
  p.contexto.guardarVisita_ = function () { guardo = true; };

  let trono = false;
  try { p.leer('guardarRespuestaYGenerar')({ nombre: 'Cliente Ficticio SA' }); }
  catch (e) { trono = true; }
  assert(trono, 'el error sube para que el panel lo muestre');
  assert(guardo === false, 'no queda una fila a medias en la base de datos');
});

// ============================================================
// 5. REVISIÓN DEL SISTEMA: MOTOR + BASE DE DATOS
// ============================================================

/** Doble de PropertiesService con un almacén en memoria. */
function crearPropiedadesFalsas(inicial) {
  const almacen = Object.assign({}, inicial || {});
  return {
    almacen: almacen,
    getScriptProperties: function () {
      return {
        getProperty: function (k) { return Object.prototype.hasOwnProperty.call(almacen, k) ? almacen[k] : null; },
        setProperty: function (k, v) { almacen[k] = v; return this; },
        deleteProperty: function (k) { delete almacen[k]; return this; },
      };
    },
  };
}

function conMotorSano(p) {
  p.contexto.ejecutarPruebasMotorReglas = function () {};
  p.contexto.Logger = { log: function () {}, getLog: function () { return '13 pruebas OK, 0 fallidas.'; } };
}

escenario('Revisión: motor sano y base ya conectada', () => {
  const p = cargarProyecto();
  conMotorSano(p);
  const props = crearPropiedadesFalsas({ ID_BASE_DATOS_SOW: 'abc123' });
  p.contexto.PropertiesService = props;
  p.contexto.SpreadsheetApp = { openById: function () { return crearLibroFalso({}); } };

  const r = p.leer('correrAutopruebasDesdeSidebar')();
  assert(r.todoBien === true, 'reporta que todo está bien');
  assert(r.motorOk === true && r.baseOk === true, 'marca motor y base en orden');
  assert(r.reconectada === false, 'no reconectó porque no hacía falta');
  assert(r.mensaje.indexOf('13 pruebas OK') !== -1, 'dice cuántas pruebas del motor pasaron');
  assert(r.mensaje.indexOf('conectada correctamente') !== -1, 'dice que la base está conectada');
});

escenario('Revisión: si una prueba del motor falla, NO dice que todo está bien', () => {
  const p = cargarProyecto();
  p.contexto.ejecutarPruebasMotorReglas = function () {};
  p.contexto.Logger = { log: function () {}, getLog: function () { return '11 pruebas OK, 2 fallidas.'; } };
  p.contexto.PropertiesService = crearPropiedadesFalsas({ ID_BASE_DATOS_SOW: 'abc123' });
  p.contexto.SpreadsheetApp = { openById: function () { return crearLibroFalso({}); } };

  // Antes el panel mostraba "OK" pasara lo que pasara, porque la función del
  // motor no devuelve nada: solo escribe en el registro.
  const r = p.leer('correrAutopruebasDesdeSidebar')();
  assert(r.todoBien === false && r.motorOk === false, 'marca que el motor tiene un problema');
  assert(r.mensaje.indexOf('FALLARON 2') !== -1, 'dice cuántas fallaron');
  assert(r.mensaje.toLowerCase().indexOf('no uses los resultados') !== -1, 'le dice al asesor qué hacer');
});

escenario('La base se crea sola la primera vez (no hay historial que perder)', () => {
  const p = cargarProyecto();
  conMotorSano(p);
  const props = crearPropiedadesFalsas({});
  p.contexto.PropertiesService = props;
  let creo = false;
  p.contexto.obtenerBaseDeDatosSegura_ = function () {
    creo = true;
    props.almacen.ID_BASE_DATOS_SOW = 'nueva999';
    return crearLibroFalso({});
  };

  const r = p.leer('diagnosticarBaseDeDatos_')();
  assert(creo === true, 'la crea');
  assert(r.conectada === true && r.reconectada === true, 'queda conectada y avisa que reconectó');
  assert(r.mensaje.indexOf('se creó ahora') !== -1, 'lo explica en lenguaje simple');
});

escenario('Si la base estaba en la papelera, se reconecta sola', () => {
  const p = cargarProyecto();
  const props = crearPropiedadesFalsas({ ID_BASE_DATOS_SOW: 'borrada123' });
  p.contexto.PropertiesService = props;
  p.contexto.SpreadsheetApp = { openById: function () { throw new Error('no existe'); } };
  p.contexto.DriveApp = { getFileById: function () { return { isTrashed: function () { return true; } }; } };
  let creo = false;
  p.contexto.obtenerBaseDeDatosSegura_ = function () { creo = true; return crearLibroFalso({}); };

  const r = p.leer('diagnosticarBaseDeDatos_')();
  assert(creo === true, 'crea una nueva porque la anterior ya no existe');
  assert(r.conectada === true && r.reconectada === true, 'queda conectada');
  assert(props.almacen.ID_BASE_DATOS_SOW === undefined, 'olvida el identificador viejo antes de crear');
});

escenario('Si la base es de otra persona, NO se reconecta sola', () => {
  const p = cargarProyecto();
  const props = crearPropiedadesFalsas({ ID_BASE_DATOS_SOW: 'deOtroAsesor' });
  p.contexto.PropertiesService = props;
  p.contexto.SpreadsheetApp = { openById: function () { throw new Error('sin acceso'); } };
  // Ni siquiera se puede ver el archivo en Drive: es de alguien más.
  p.contexto.DriveApp = { getFileById: function () { throw new Error('sin acceso'); } };
  let creo = false;
  p.contexto.obtenerBaseDeDatosSegura_ = function () { creo = true; return crearLibroFalso({}); };

  // Ésta es la prueba importante: crear una base nueva aquí partiría el
  // historial en dos sin que nadie se entere.
  const r = p.leer('diagnosticarBaseDeDatos_')();
  assert(creo === false, 'NO crea una base nueva a espaldas de nadie');
  assert(r.conectada === false && r.reconectada === false, 'reporta que no quedó conectada');
  assert(props.almacen.ID_BASE_DATOS_SOW === 'deOtroAsesor', 'conserva el vínculo al archivo original');
  assert(r.mensaje.indexOf('comparta') !== -1, 'le dice al asesor que pida acceso');
});

escenario('La revisión reporta la base caída aunque el motor esté sano', () => {
  const p = cargarProyecto();
  conMotorSano(p);
  p.contexto.PropertiesService = crearPropiedadesFalsas({ ID_BASE_DATOS_SOW: 'deOtroAsesor' });
  p.contexto.SpreadsheetApp = { openById: function () { throw new Error('sin acceso'); } };
  p.contexto.DriveApp = { getFileById: function () { throw new Error('sin acceso'); } };

  const r = p.leer('correrAutopruebasDesdeSidebar')();
  assert(r.motorOk === true, 'el motor sigue sano');
  assert(r.baseOk === false && r.todoBien === false, 'pero la revisión no dice que todo está bien');
});

// ============================================================
// 6. MENSAJES DE ERROR QUE SE ENTIENDEN
// ============================================================

escenario('El error del puente del panel se traduce a algo accionable', () => {
  const p = cargarProyecto();
  const mensaje = p.leer('mensajeAmigableDeError_');
  // Esto es lo que ve el asesor cuando el navegador bloquea el panel.
  const texto = mensaje(new Error('Se produjo un error en el servidor al leer desde el almacenamiento. Código de error PERMISSION_DENIED.'), 'al guardar');
  assert(texto.indexOf('PERMISSION_DENIED') === -1, 'no le enseña el código técnico al asesor');
  assert(texto.indexOf('varias cuentas') !== -1, 'menciona la causa más común (varias cuentas abiertas)');
  assert(texto.indexOf('cookies') !== -1, 'menciona la otra causa (cookies de terceros)');
  assert(texto.indexOf('menú') !== -1, 'le ofrece el menú como plan B');
});

console.log(`\n---\nResultado: ${pasadas} pruebas OK, ${fallidas} fallidas.`);
if (fallidas > 0) process.exit(1);
