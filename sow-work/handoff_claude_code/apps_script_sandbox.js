/**
 * apps_script_sandbox.js — carga un archivo .gs REAL dentro de Node.
 *
 * POR QUÉ EXISTE: antes, `test_motor_reglas.js` traía una copia pegada a mano
 * de la lógica del prototipo. Esa copia podía quedarse atrás sin que nadie se
 * diera cuenta: las pruebas seguían en verde mientras el archivo que de verdad
 * corre en Apps Script ya decía otra cosa. Aquí se carga el archivo .gs tal
 * cual, así que lo que se prueba es exactamente lo que se sube.
 *
 * Cómo funciona: un archivo .gs es JavaScript normal. Lo único que Node no
 * tiene son los servicios de Google (SpreadsheetApp, DriveApp, etc.), y esos
 * solo se usan DENTRO de las funciones, nunca al cargar el archivo. Entonces
 * basta con cargarlo en un contexto que traiga imitaciones ("dobles") de esos
 * servicios, y llamar únicamente a las funciones que se quieren probar.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/** Error que lanzan los dobles cuando se usa un servicio que no se preparó. */
function servicioNoPreparado(nombre) {
  return function () {
    throw new Error(
      'La prueba llamó al servicio de Google "' + nombre + '", que no está ' +
      'preparado en este sandbox. Si la prueba lo necesita de verdad, agrégalo ' +
      'en el parámetro `servicios` de cargarArchivosGs().'
    );
  };
}

/**
 * Dobles mínimos de los servicios de Google. Solo se implementa lo que las
 * pruebas usan de verdad; todo lo demás truena con un mensaje claro en vez de
 * fallar de una forma confusa.
 */
function serviciosBase() {
  return {
    Logger: { log: function () {} },
    console: console,
    Utilities: {
      formatDate: function (fecha, zona, formato) {
        const dd = String(fecha.getDate()).padStart(2, '0');
        const mm = String(fecha.getMonth() + 1).padStart(2, '0');
        const yyyy = fecha.getFullYear();
        // Solo se soporta el formato que usa el código real.
        if (formato !== 'dd/MM/yyyy') throw new Error('Formato no soportado en el sandbox: ' + formato);
        return dd + '/' + mm + '/' + yyyy;
      },
    },
    Session: { getScriptTimeZone: function () { return 'America/Mexico_City'; } },
    SpreadsheetApp: { getUi: servicioNoPreparado('SpreadsheetApp.getUi') },
    DriveApp: { getFoldersByName: servicioNoPreparado('DriveApp.getFoldersByName') },
    DocumentApp: { create: servicioNoPreparado('DocumentApp.create') },
    HtmlService: {
      createHtmlOutput: function (html) {
        return { html: html, setWidth: function () { return this; }, setHeight: function () { return this; } };
      },
    },
    PropertiesService: { getScriptProperties: servicioNoPreparado('PropertiesService.getScriptProperties') },
    LockService: {
      getScriptLock: function () {
        return { waitLock: function () {}, releaseLock: function () {} };
      },
    },
  };
}

/**
 * Carga uno o varios archivos .gs en un mismo contexto (igual que hace Apps
 * Script, que comparte las funciones entre archivos del mismo proyecto).
 *
 * @param {string[]} archivos   Rutas de los .gs, relativas a esta carpeta.
 * @param {object}   servicios  Dobles adicionales o reemplazos.
 * @returns {{leer: function(string): *, contexto: object}}
 *          `leer('NOMBRE')` devuelve cualquier función o constante del archivo
 *          (las constantes de nivel superior no quedan como propiedades del
 *          contexto, por eso se leen evaluando su nombre).
 */
function cargarArchivosGs(archivos, servicios) {
  const contexto = Object.assign(serviciosBase(), servicios || {});
  vm.createContext(contexto);

  archivos.forEach(function (archivo) {
    const ruta = path.join(__dirname, archivo);
    const fuente = fs.readFileSync(ruta, 'utf8');
    vm.runInContext(fuente, contexto, { filename: ruta });
  });

  return {
    contexto: contexto,
    leer: function (nombre) { return vm.runInContext(nombre, contexto); },
  };
}

module.exports = { cargarArchivosGs: cargarArchivosGs };
