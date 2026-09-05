/**
 * Arnés de pruebas LOCAL (Node.js) para auditar el motor de reglas v3
 * (con la nueva capa de clasificación de prioridad) antes de subir la
 * versión a Apps Script. Espejo exacto de la lógica pura de
 * prototipo_entregables_sow.gs — sin nada de Google (DriveApp/DocumentApp).
 */

// ---- Copia idéntica de la lógica pura del prototipo v3 ----

const TABLA_REGLAS = [
  {
    producto: 'Divisas / Cambios',
    prioridad: 1,
    condicion: (r) => r.bancoCambios && r.bancoCambios !== 'BASE',
    oportunidad: (r) => `Cambios con ${r.bancoCambios}.`,
    preguntaGuion: '¿Con qué banco haces tus cambios?',
  },
  {
    producto: 'Crédito',
    prioridad: 2,
    condicion: (r) => r.tieneCreditoOtroBanco === true,
    oportunidad: (r) => `Crédito con ${r.bancoCredito || 'otro banco'}.`,
    preguntaGuion: '¿Cuánto crédito tienes y con quién?',
  },
  {
    producto: 'Comercio exterior',
    prioridad: 3,
    condicion: (r) => r.montoExportacionMensual || r.montoImportacionMensual,
    oportunidad: (r) => `Exporta/importa.`,
    preguntaGuion: '¿Cuánto exportas/importas al mes?',
  },
  {
    producto: 'Captación',
    prioridad: 4,
    condicion: (r) => r.bancoPrincipalCaptacion && r.bancoPrincipalCaptacion !== 'BASE',
    oportunidad: (r) => `Captación en ${r.bancoPrincipalCaptacion}.`,
    preguntaGuion: '¿Con qué banco tienen su captación principal?',
  },
];

function evaluarReglas(respuesta, tablaReglas) {
  return tablaReglas
    .filter((regla) => regla.condicion(respuesta))
    .map((regla) => ({
      producto: regla.producto,
      prioridad: regla.prioridad,
      justificacion: regla.oportunidad(respuesta),
      pregunta: regla.preguntaGuion,
    }))
    .sort((a, b) => a.prioridad - b.prioridad);
}

function clasificarPrioridad(respuesta) {
  const brechaAlta =
    (respuesta.bancoCambios && respuesta.bancoCambios !== 'BASE') ||
    (respuesta.tieneCreditoOtroBanco === true && respuesta.bancoCredito !== 'BASE');

  if (brechaAlta) {
    const mismoBancoControlaAmbos =
      respuesta.tieneCreditoOtroBanco === true &&
      respuesta.bancoCredito &&
      respuesta.bancoCambios &&
      respuesta.bancoCredito === respuesta.bancoCambios;

    if (!mismoBancoControlaAmbos) {
      return { prioridad: 1, etiqueta: 'Prioridad 1 — ataque directo' };
    }
    return { prioridad: 2, etiqueta: 'Prioridad 2 — requiere oferta integral' };
  }

  if (respuesta.recibeCotizacionesOtrosBancos === true) {
    return { prioridad: 2, etiqueta: 'Prioridad 2 — cliente disputado' };
  }

  return { prioridad: 3, etiqueta: 'Prioridad 3 — rutina normal' };
}

// ---- Arnés de pruebas ----

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
    assert(e instanceof TypeError, `reproduce el mismo tipo de error visto antes: "${e.message}"`);
  }
});

console.log(`\n---\nResultado: ${pasadas} pruebas OK, ${fallidas} fallidas.`);
if (fallidas > 0) process.exit(1);
