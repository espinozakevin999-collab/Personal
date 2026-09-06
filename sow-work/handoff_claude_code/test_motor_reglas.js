/**
 * Arnés de pruebas LOCAL (Node.js) del motor de reglas.
 *
 * Correr con:  node test_motor_reglas.js
 *
 * QUÉ CAMBIÓ: antes este archivo traía una COPIA pegada a mano de
 * TABLA_REGLAS / evaluarReglas() / clasificarPrioridad(). Esa copia podía
 * quedarse atrás sin que nadie lo notara — las pruebas en verde mientras el
 * archivo real ya decía otra cosa. Ahora se carga `prototipo_entregables_sow.gs`
 * tal cual (ver apps_script_sandbox.js), así que lo que se prueba aquí es
 * exactamente el código que se sube a Apps Script. No hay copia que mantener.
 *
 * Estas pruebas cubren SOLO la lógica pura (reglas y prioridad). No tocan
 * Drive ni Docs — la generación de PDF se prueba en el Sheet real corriendo
 * `probarPrototipo()`.
 */

const { cargarArchivosGs } = require('./apps_script_sandbox');

const proyecto = cargarArchivosGs(['prototipo_entregables_sow.gs']);
const TABLA_REGLAS = proyecto.leer('TABLA_REGLAS');
const evaluarReglas = proyecto.leer('evaluarReglas');
const clasificarPrioridad = proyecto.leer('clasificarPrioridad');

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
  fn();
}

escenario('Sin brechas, sin comparación → Prioridad 3', () => {
  const r = { nombre: 'A', bancoCambios: 'BASE', tieneCreditoOtroBanco: false, recibeCotizacionesOtrosBancos: false };
  assert(evaluarReglas(r, TABLA_REGLAS).length === 0, 'no debe detectar oportunidades');
  assert(clasificarPrioridad(r).prioridad === 3, 'debe ser prioridad 3');
});

escenario('Brecha alta, bancos repartidos → Prioridad 1', () => {
  const r = { nombre: 'B', bancoCambios: 'Santander', tieneCreditoOtroBanco: true, bancoCredito: 'Banorte' };
  const op = evaluarReglas(r, TABLA_REGLAS);
  assert(op.some((o) => o.producto === 'Divisas / Cambios'), 'debe detectar Divisas/Cambios');
  assert(op.some((o) => o.producto === 'Crédito'), 'debe detectar Crédito');
  assert(clasificarPrioridad(r).prioridad === 1, 'debe ser prioridad 1 (bancos repartidos)');
});

escenario('Brecha alta, mismo banco concentra crédito y cambios → Prioridad 2', () => {
  const r = { nombre: 'C', bancoCambios: 'Santander', tieneCreditoOtroBanco: true, bancoCredito: 'Santander' };
  assert(clasificarPrioridad(r).prioridad === 2, 'debe ser prioridad 2 (concentrado, oferta integral)');
});

escenario('Sin brecha con BASE pero cliente disputado → Prioridad 2', () => {
  const r = { nombre: 'D', bancoCambios: 'BASE', tieneCreditoOtroBanco: false, recibeCotizacionesOtrosBancos: true };
  assert(clasificarPrioridad(r).prioridad === 2, 'debe ser prioridad 2 (disputado)');
});

escenario('Datos incompletos no debe tronar', () => {
  const r = { nombre: 'E', bancoPrincipalCaptacion: 'Santander' };
  const op = evaluarReglas(r, TABLA_REGLAS);
  assert(op.length === 1 && op[0].producto === 'Captación', 'debe detectar solo Captación');
  const prio = clasificarPrioridad(r);
  assert(prio && prio.prioridad >= 1, 'clasificarPrioridad no debe tronar con datos incompletos');
});

escenario('Reproducción del error reportado (evaluarReglas sin argumentos)', () => {
  try {
    evaluarReglas(undefined, undefined);
    assert(false, 'debía tronar al llamar evaluarReglas() sin argumentos');
  } catch (e) {
    // Se compara por nombre y no con `instanceof`: el error nace dentro del
    // sandbox donde se carga el .gs, y ahi TypeError es una clase distinta a la
    // de este archivo, asi que `instanceof` daria falso aunque el error sea el mismo.
    assert(e.name === 'TypeError', `reproduce el mismo tipo de error visto antes: "${e.message}"`);
  }
});

// ---- Pruebas nuevas de esta auditoría ----

escenario('Crédito que ya está con BASE no es una oportunidad', () => {
  // El flujo de preguntas permite responder "sí tiene crédito" y luego elegir
  // BASE. Antes de este arreglo, el PDF le decía al asesor que comparara ese
  // crédito "contra condiciones BASE" — compitiendo contra su propio banco.
  const r = { nombre: 'F', bancoCambios: 'BASE', tieneCreditoOtroBanco: true, bancoCredito: 'BASE', recibeCotizacionesOtrosBancos: false };
  const op = evaluarReglas(r, TABLA_REGLAS);
  assert(!op.some((o) => o.producto === 'Crédito'), 'no debe reportar Crédito como oportunidad');
  assert(clasificarPrioridad(r).prioridad === 3, 'todo con BASE y sin cotizaciones → prioridad 3');
});

escenario('Guarda de gobernanza sobre TABLA_REGLAS', () => {
  // Regla no negociable: NO se agregan productos nuevos (Inversiones,
  // Coberturas, BASEinet) hasta que Gustavo/Julián definan sus preguntas de
  // descubrimiento. Esta prueba falla en automático si alguien los agrega.
  assert(
    TABLA_REGLAS.map((regla) => regla.producto).join('|') ===
      'Divisas / Cambios|Crédito|Comercio exterior|Captación',
    'la tabla trae solo los 4 productos aprobados, en el orden acordado'
  );
});

console.log(`\n---\nResultado: ${pasadas} pruebas OK, ${fallidas} fallidas.`);
if (fallidas > 0) process.exit(1);
