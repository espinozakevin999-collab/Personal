/**
 * PROTOTIPO v3 — Entregables 1 y 2 de Share of Wallet (Iniciativa 4)
 * Banco BASE | Orquestación comercial
 *
 * Genera automáticamente, a partir de la respuesta de una visita:
 *   1) PDF para el asesor    — oportunidades detectadas + prioridad del cliente
 *   2) Guion de conversación — preguntas de descubrimiento ancladas a cada oportunidad
 *
 * QUÉ CAMBIÓ EN v3 (vs. v2):
 * - Las preguntas/campos de `respuesta` ya no son inventadas: reflejan lo que
 *   Gustavo y Julián dieron en la reunión real del 4 de sept de 2026 (vault,
 *   sección 14) — preguntas generales del modelo de negocio + las preguntas
 *   específicas de Share of Wallet (exporta/importa, compra/venta de divisas,
 *   con qué banco, crédito vigente, variable de decisión, si recibe
 *   cotizaciones de otros bancos).
 * - Se agrega una capa nueva: `clasificarPrioridad()` — el "árbol de
 *   decisiones" ya NO es el cuestionario que responde el cliente (eso se
 *   descartó en la reunión por ser demasiado largo); ahora es lógica de
 *   BACK-END que combina tres señales (brecha, palanca/facilidad de switch,
 *   competitividad) para decidir qué tan agresivo debe ser el asesor con
 *   ese cliente. Ver la explicación completa en el chat / vault sección 14.1.
 *
 * IMPORTANTE — LEER ANTES DE USAR:
 * - Los datos en `probarPrototipo()` y los UMBRALES dentro de
 *   `clasificarPrioridad()` siguen siendo ILUSTRATIVOS — el contenido de
 *   las preguntas ya es real, pero los cortes exactos de "brecha alta",
 *   etc. todavía no los ha validado Gustavo/Julián/Nico.
 * - Este script NO debe conectarse a datos reales de clientes hasta pasar
 *   por el proceso de seguridad/TI de Banco BASE (ver vault, sección 12).
 *
 * ============================================================
 * QUÉ FUNCIÓN EJECUTAR — MUY IMPORTANTE
 * ============================================================
 * El selector de funciones tiene varias funciones internas que NO debes
 * ejecutar directamente porque necesitan que otra función les pase datos
 * (si las corres solas, truenan con un error de "undefined").
 *
 * Ejecuta SIEMPRE una de estas dos, nunca las funciones internas:
 *   - `ejecutarPruebasMotorReglas` → prueba rápida (no toca Drive/Docs,
 *     corre en segundos, verifica que la lógica esté bien).
 *   - `probarPrototipo` → genera los 2 PDFs reales de ejemplo en tu Drive.
 *
 * Flujo recomendado (loop de auditoría):
 *  1. Ejecuta `ejecutarPruebasMotorReglas` primero. Revisa el Registro de
 *     ejecución: debe decir "TODO OK" al final.
 *  2. Solo si el paso 1 salió limpio, ejecuta `probarPrototipo` y revisa
 *     los PDFs en la carpeta "Prototipo SoW (ficticio)" de tu Drive.
 */

// ============================================================
// 1. CONFIGURACIÓN
// ============================================================

const NOMBRE_CARPETA_PROTOTIPO = 'Prototipo SoW (ficticio)';

// Identidad visual oficial de Banco BASE (ver README.md). El logo NO se
// redibuja aquí — insertarEncabezadoBASE() solo reserva el espacio; el logo
// real se pega a mano antes de enviar un documento final (regla de marca).
const COLOR_AMARILLO_BASE = '#F5A800';
const COLOR_NEGRO_BASE = '#000000';
const COLOR_GRIS_BASE = '#707272';

// Tabla de reglas de OPORTUNIDAD por producto: qué le ofrecemos.
// `prioridad` (menor número = más importante) controla el orden en que
// aparecen dentro del PDF y el guion — es independiente de la prioridad
// DEL CLIENTE (esa la decide clasificarPrioridad(), más abajo).
// Pensada para migrar después a una hoja de Google Sheets ("Reglas") que
// Gustavo/Julián puedan editar sin tocar código — ver vault sección 12.
const TABLA_REGLAS = [
  {
    producto: 'Divisas / Cambios',
    prioridad: 1,
    condicion: (r) => r.bancoCambios && r.bancoCambios !== 'BASE',
    oportunidad: (r) =>
      `El cliente hace sus operaciones de cambios con ${r.bancoCambios}. Reporta ` +
      `~${r.montoCompraDivisasMensual || 'N/D'} de compra y ~${r.montoVentaDivisasMensual || 'N/D'} ` +
      `de venta de divisas al mes (ilustrativo). Oportunidad de originar ese flujo con BASE.`,
    preguntaGuion:
      '¿Con qué banco haces hoy tus operaciones de cambios? ¿Cuánto compras y cuánto vendes de divisas al mes, aproximadamente?',
  },
  {
    producto: 'Crédito',
    prioridad: 2,
    // Se excluye BASE a proposito: si el credito ya esta con BASE no es una
    // brecha, y sin este filtro el PDF le decia al asesor que compitiera contra
    // su propio banco. clasificarPrioridad() ya aplicaba la misma exclusion.
    condicion: (r) => r.tieneCreditoOtroBanco === true && r.bancoCredito !== 'BASE',
    oportunidad: (r) =>
      `El cliente tiene crédito vigente con ${r.bancoCredito || 'otro banco'} a una tasa reportada de ` +
      `${r.tasaCreditoActual || 'N/D'}. Vale la pena comparar contra condiciones BASE.`,
    preguntaGuion: '¿Cuánto tienes de crédito con ese banco? ¿A qué tasa y con qué garantías?',
  },
  {
    producto: 'Comercio exterior',
    prioridad: 3,
    condicion: (r) => (r.montoExportacionMensual || r.montoImportacionMensual),
    oportunidad: (r) =>
      `El cliente reporta ~${r.montoExportacionMensual || 'N/D'} de exportación y ` +
      `~${r.montoImportacionMensual || 'N/D'} de importación al mes (ilustrativo). ` +
      `Confirmar si ese flujo ya pasa por BASE.`,
    preguntaGuion: '¿Cuánto exportas al mes? ¿Cuánto importas al mes?',
  },
  {
    producto: 'Captación',
    prioridad: 4,
    condicion: (r) => r.bancoPrincipalCaptacion && r.bancoPrincipalCaptacion !== 'BASE',
    oportunidad: (r) =>
      `El cliente mantiene su captación principal en ${r.bancoPrincipalCaptacion}. ` +
      `Banco BASE puede ofrecer un rendimiento ilustrativo mayor (cifra de ejemplo — a validar con Gustavo/Julián).`,
    preguntaGuion:
      '¿Con qué banco tienen hoy su cuenta de captación principal? ¿Qué les gusta y qué les duele de ese banco?',
  },
  // TODO: Transaccional y Derivados — no se discutieron en la reunión del
  // 4 de sept; agregar cuando Gustavo/Julián los prioricen (vault sección 6).
];

// ============================================================
// 2. MOTOR DE REGLAS — oportunidades por producto
// ============================================================

/**
 * Evalúa una respuesta de visita contra la tabla de reglas y regresa la
 * lista de oportunidades detectadas —ordenadas por prioridad de producto—,
 * cada una con su justificación y su pregunta de guion asociada.
 *
 * NOTA: esta función espera SIEMPRE sus dos argumentos. No la ejecutes
 * directamente desde el selector de Apps Script.
 */
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

// ============================================================
// 3. ÁRBOL DE DECISIONES DE BACK-END — prioridad DEL CLIENTE
// ============================================================

/**
 * Clasifica al cliente en un nivel de prioridad de seguimiento combinando
 * tres señales (todas derivadas de las preguntas de Share of Wallet que
 * ya se le hacen al cliente — no se necesita capturar nada adicional):
 *
 *   1. Brecha    — ¿la mayoría de sus operaciones relevantes (cambios,
 *                  crédito) están fuera de BASE?
 *   2. Palanca   — ¿sus bancos están repartidos (fácil mover una pieza) o
 *                  concentrados en uno solo (crédito y cambios con el
 *                  mismo banco = más difícil de mover)?
 *   3. Competitividad — ¿ya recibe cotizaciones/reportes de mercado de
 *                  otros bancos? (cliente que compara activamente)
 *
 * IMPORTANTE: los cortes de "brecha alta", etc. son ILUSTRATIVOS —
 * borrador para validar con Gustavo/Julián/Nico, no reglas aprobadas.
 * Ver vault sección 14.1 y 14.7.
 */
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
      return {
        prioridad: 1,
        etiqueta: 'Prioridad 1 — ataque directo',
        motivo:
          'Brecha alta y sus bancos están repartidos (no concentrados en uno solo): es más fácil ' +
          'mover una pieza (ej. solo cambios) sin depender de mover toda la relación bancaria.',
      };
    }
    return {
      prioridad: 2,
      etiqueta: 'Prioridad 2 — requiere oferta integral',
      motivo:
        'Brecha alta, pero un mismo banco concentra crédito y cambios: moverlo requiere una ' +
        'oferta 360° (no solo un producto) para que le convenga romper esa concentración.',
    };
  }

  if (respuesta.recibeCotizacionesOtrosBancos === true) {
    return {
      prioridad: 2,
      etiqueta: 'Prioridad 2 — cliente disputado',
      motivo:
        'Ya trabaja principalmente con BASE, pero recibe cotizaciones de otros bancos — hay que ' +
        'mantener la relación activa para no perder terreno.',
    };
  }

  return {
    prioridad: 3,
    etiqueta: 'Prioridad 3 — rutina normal',
    motivo: 'Sin brecha relevante detectada ni señales de que esté comparando con otros bancos.',
  };
}

// ============================================================
// 4. GENERACIÓN DE DOCUMENTOS
// ============================================================

function obtenerCarpetaPrototipo() {
  const carpetas = DriveApp.getFoldersByName(NOMBRE_CARPETA_PROTOTIPO);
  return carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder(NOMBRE_CARPETA_PROTOTIPO);
}

/**
 * Convierte un Google Doc recién creado a PDF dentro de la carpeta del
 * prototipo, y limpia (trashea) el Doc original para no dejar basura.
 */
function convertirAPdfYLimpiar(doc, nombreArchivo, carpeta) {
  const docId = doc.getId();
  try {
    doc.saveAndClose();
    const pdfBlob = DriveApp.getFileById(docId).getAs('application/pdf');
    const archivoPdf = carpeta.createFile(pdfBlob).setName(nombreArchivo);
    return archivoPdf;
  } finally {
    DriveApp.getFileById(docId).setTrashed(true);
  }
}

/**
 * Encabezado de marca compartido por los dos PDFs: reserva el espacio del
 * logo oficial (recuadro con borde amarillo BASE) sin redibujarlo — el logo
 * real se pega a mano antes de enviar un documento final. Vive aquí, una
 * sola vez, para que ambos generadores de PDF usen el mismo encabezado.
 */
function insertarEncabezadoBASE(body) {
  const recuadroLogo = body.appendTable([['[ Espacio reservado para el logotipo oficial de Banco BASE ]']]);
  recuadroLogo.setBorderColor(COLOR_AMARILLO_BASE);
  const celda = recuadroLogo.getRow(0).getCell(0);
  celda.setBackgroundColor('#FFFFFF');
  celda
    .getChild(0)
    .asParagraph()
    .setForegroundColor(COLOR_GRIS_BASE)
    .setItalic(true)
    .setFontSize(9)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('');
}

/**
 * Entregable 1: PDF para el asesor.
 */
function generarPDFAsesor(cliente, oportunidades, prioridadCliente, carpeta) {
  const doc = DocumentApp.create(`PDF asesor — ${cliente.nombre} (ficticio)`);
  const body = doc.getBody();

  insertarEncabezadoBASE(body);

  body
    .appendParagraph(`Plan de cuenta — ${cliente.nombre}`)
    .setHeading(DocumentApp.ParagraphHeading.TITLE)
    .setBold(true)
    .setForegroundColor(COLOR_NEGRO_BASE);
  body
    .appendParagraph('Datos ficticios — prototipo técnico, no usar con clientes reales.')
    .setItalic(true)
    .setForegroundColor(COLOR_GRIS_BASE);
  body.appendParagraph('');
  body
    .appendParagraph(prioridadCliente.etiqueta)
    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
    .setBold(true)
    .setForegroundColor(COLOR_NEGRO_BASE)
    .setBackgroundColor(COLOR_AMARILLO_BASE);
  // El resaltado amarillo de la etiqueta de arriba se hereda al siguiente
  // párrafo si no se limpia explícitamente (comportamiento del editor de
  // Docs) — por eso aquí se fuerza el fondo de vuelta a blanco.
  body
    .appendParagraph(prioridadCliente.motivo)
    .setItalic(true)
    .setForegroundColor(COLOR_GRIS_BASE)
    .setBackgroundColor('#FFFFFF');
  body.appendParagraph('');

  if (oportunidades.length === 0) {
    body.appendParagraph('No se detectaron brechas con los datos capturados.').setForegroundColor(COLOR_GRIS_BASE);
  } else {
    oportunidades.forEach((op) => {
      body
        .appendParagraph(`${op.producto}`)
        .setHeading(DocumentApp.ParagraphHeading.HEADING2)
        .setBold(true)
        .setForegroundColor(COLOR_NEGRO_BASE);
      body.appendParagraph(op.justificacion).setForegroundColor(COLOR_GRIS_BASE);
      body.appendParagraph(''); // separación visual entre oportunidades
    });
  }

  return convertirAPdfYLimpiar(doc, `PDF asesor — ${cliente.nombre}.pdf`, carpeta);
}

/**
 * Entregable 2: Guion de conversación.
 * Estructura: apertura breve → preguntas generales del modelo de negocio →
 * una pregunta por oportunidad detectada (en orden de prioridad) → cierre.
 */
function generarGuionConversacion(cliente, oportunidades, carpeta) {
  const doc = DocumentApp.create(`Guion — ${cliente.nombre} (ficticio)`);
  const body = doc.getBody();

  insertarEncabezadoBASE(body);

  body
    .appendParagraph(`Guion de conversación — ${cliente.nombre}`)
    .setHeading(DocumentApp.ParagraphHeading.TITLE)
    .setBold(true)
    .setForegroundColor(COLOR_NEGRO_BASE);
  body
    .appendParagraph(
      'Apertura sugerida: agradecer el tiempo y confirmar el objetivo de la visita ' +
        '(revisar cómo Banco BASE puede apoyar su operación). Máximo 4-5 preguntas — evitar que se ' +
        'sienta un interrogatorio (indicación explícita de Julián y Gustavo, reunión 4 sept).'
    )
    .setForegroundColor(COLOR_GRIS_BASE);
  body.appendParagraph('');

  if (oportunidades.length === 0) {
    body
      .appendParagraph('No se detectaron brechas — usar el guion general de seguimiento.')
      .setForegroundColor(COLOR_GRIS_BASE);
  } else {
    oportunidades.forEach((op, i) => {
      body
        .appendParagraph(`${i + 1}. ${op.producto}`)
        .setHeading(DocumentApp.ParagraphHeading.HEADING2)
        .setBold(true)
        .setForegroundColor(COLOR_NEGRO_BASE);
      body.appendParagraph(op.pregunta).setForegroundColor(COLOR_NEGRO_BASE);
    });
  }

  body.appendParagraph('');
  body
    .appendParagraph(
      'Cierre sugerido: pregunta abierta — "¿qué te haría trabajar esto con nosotros?" / "¿cuál es tu ' +
        'variable de decisión para elegir banco?" — y proponer el siguiente paso concreto.'
    )
    .setForegroundColor(COLOR_GRIS_BASE);

  return convertirAPdfYLimpiar(doc, `Guion — ${cliente.nombre}.pdf`, carpeta);
}

// ============================================================
// 5. ORQUESTACIÓN
// ============================================================

/**
 * Punto de entrada único: dada una respuesta de visita, calcula la
 * prioridad del cliente, genera los dos entregables y regresa sus URLs +
 * las oportunidades detectadas (útil para loggear o para alimentar
 * después la acción en Salesforce — entregable 3, fuera de este alcance).
 */
function generarEntregables(respuesta) {
  const carpeta = obtenerCarpetaPrototipo();
  const oportunidades = evaluarReglas(respuesta, TABLA_REGLAS);
  const prioridadCliente = clasificarPrioridad(respuesta);

  const pdfAsesor = generarPDFAsesor(respuesta, oportunidades, prioridadCliente, carpeta);
  const guion = generarGuionConversacion(respuesta, oportunidades, carpeta);

  Logger.log('PDF asesor: ' + pdfAsesor.getUrl());
  Logger.log('Guion: ' + guion.getUrl());
  Logger.log('Prioridad del cliente: ' + JSON.stringify(prioridadCliente, null, 2));
  Logger.log('Oportunidades detectadas: ' + JSON.stringify(oportunidades, null, 2));

  return { pdfAsesor, guion, oportunidades, prioridadCliente };
}

// ============================================================
// 6. GENERAR DOCUMENTOS DE EJEMPLO (ejecutar esta función)
// ============================================================

function probarPrototipo() {
  const respuestaFicticia = {
    nombre: 'Comercializadora Ejemplo SA de CV (ficticio)',
    // -- Modelo de negocio general (preguntas de Gustavo) --
    giro: 'Comercializadora de insumos industriales (ficticio)',
    bancoPrincipalCaptacion: 'BBVA',
    // -- Preguntas específicas de Share of Wallet (preguntas de Julián) --
    montoExportacionMensual: 'USD 80,000 (ilustrativo)',
    montoImportacionMensual: 'USD 120,000 (ilustrativo)',
    montoCompraDivisasMensual: 'USD 90,000 (ilustrativo)',
    montoVentaDivisasMensual: 'USD 60,000 (ilustrativo)',
    bancoCambios: 'Santander',
    tieneCreditoOtroBanco: true,
    bancoCredito: 'Santander', // mismo banco que cambios -> palanca difícil, prioridad 2
    tasaCreditoActual: 'TIIE + 6 (ilustrativo)',
    recibeCotizacionesOtrosBancos: true,
  };

  generarEntregables(respuestaFicticia);
}

/**
 * Segundo cliente ficticio de ejemplo, con un perfil de contraste (sin
 * brechas detectadas, prioridad 3 — "rutina normal"). Reutiliza
 * generarEntregables(), igual que probarPrototipo() — no duplica lógica.
 * Sirve para mostrar cómo se ve el PDF cuando no hay oportunidades.
 */
function probarPrototipoClienteB() {
  const respuestaFicticia = {
    nombre: 'Grupo Industrial Ficticio SA de CV (ficticio)',
    giro: 'Manufactura (ficticio)',
    bancoPrincipalCaptacion: 'BASE',
    bancoCambios: 'BASE',
    tieneCreditoOtroBanco: false,
    recibeCotizacionesOtrosBancos: false,
  };

  generarEntregables(respuestaFicticia);
}

// ============================================================
// 7. AUTOPRUEBAS DEL MOTOR DE REGLAS Y DEL ÁRBOL DE PRIORIDAD
//    (ejecutar esta función primero)
// ============================================================

/**
 * Corre varios escenarios ficticios contra evaluarReglas() y
 * clasificarPrioridad() y compara el resultado contra lo esperado — sin
 * tocar Drive ni Docs. Revisa el Registro de ejecución después de
 * correrla: cada línea dice OK o FALLÓ, y al final un resumen.
 */
function ejecutarPruebasMotorReglas() {
  let pasadas = 0;
  let fallidas = 0;

  function verificar(mensaje, condicion) {
    if (condicion) {
      pasadas++;
      Logger.log('OK   - ' + mensaje);
    } else {
      fallidas++;
      Logger.log('FALLÓ - ' + mensaje);
    }
  }

  // 1. Sin brechas, sin comparación con otros bancos → Prioridad 3
  let r = { nombre: 'Cliente A', bancoCambios: 'BASE', tieneCreditoOtroBanco: false, recibeCotizacionesOtrosBancos: false };
  let op = evaluarReglas(r, TABLA_REGLAS);
  let prio = clasificarPrioridad(r);
  verificar('Sin brechas → 0 oportunidades', op.length === 0);
  verificar('Sin brechas ni comparación → Prioridad 3', prio.prioridad === 3);

  // 2. Brecha alta, bancos repartidos (cambios y crédito con bancos distintos) → Prioridad 1
  r = {
    nombre: 'Cliente B',
    bancoCambios: 'Santander',
    tieneCreditoOtroBanco: true,
    bancoCredito: 'Banorte',
    montoExportacionMensual: 'USD 50,000',
  };
  op = evaluarReglas(r, TABLA_REGLAS);
  prio = clasificarPrioridad(r);
  verificar('Brecha alta detecta oportunidades de Divisas y Crédito', op.some((o) => o.producto === 'Divisas / Cambios') && op.some((o) => o.producto === 'Crédito'));
  verificar('Bancos repartidos (Santander vs. Banorte) → Prioridad 1', prio.prioridad === 1);

  // 3. Brecha alta, mismo banco concentra crédito y cambios → Prioridad 2 (oferta integral)
  r = { nombre: 'Cliente C', bancoCambios: 'Santander', tieneCreditoOtroBanco: true, bancoCredito: 'Santander' };
  prio = clasificarPrioridad(r);
  verificar('Mismo banco concentra crédito y cambios → Prioridad 2 (oferta integral)', prio.prioridad === 2);

  // 4. Sin brecha con BASE, pero ya recibe cotizaciones de otros bancos → Prioridad 2 (disputado)
  r = { nombre: 'Cliente D', bancoCambios: 'BASE', tieneCreditoOtroBanco: false, recibeCotizacionesOtrosBancos: true };
  prio = clasificarPrioridad(r);
  verificar('Sin brecha pero cliente disputado (recibe cotizaciones) → Prioridad 2', prio.prioridad === 2);

  // 5. Datos incompletos (campos faltantes) no debe tronar
  op = evaluarReglas({ nombre: 'Cliente E', bancoPrincipalCaptacion: 'Santander' }, TABLA_REGLAS);
  prio = clasificarPrioridad({ nombre: 'Cliente E', bancoPrincipalCaptacion: 'Santander' });
  verificar('Datos incompletos no truena y detecta solo Captación', op.length === 1 && op[0].producto === 'Captación');
  verificar('Datos incompletos no truena al clasificar prioridad', prio && prio.prioridad >= 1);

  // 6. Reproducción documentada del error original: llamar evaluarReglas
  // sin argumentos (igual que al ejecutarla directo desde el selector).
  let error = null;
  try {
    evaluarReglas(); // sin argumentos, a propósito
  } catch (e) {
    error = e;
  }
  verificar('Llamar evaluarReglas() sin argumentos truena de forma controlada (esto fue lo que viste)', error !== null);

  // 7. Credito marcado como "si" pero el banco es BASE: no es una brecha.
  // Antes se reportaba como oportunidad y el PDF invitaba a competir contra BASE.
  r = { nombre: 'Cliente F', bancoCambios: 'BASE', tieneCreditoOtroBanco: true, bancoCredito: 'BASE', recibeCotizacionesOtrosBancos: false };
  op = evaluarReglas(r, TABLA_REGLAS);
  prio = clasificarPrioridad(r);
  verificar('Credito que ya esta con BASE no se reporta como oportunidad', !op.some((o) => o.producto === 'Crédito'));
  verificar('Todo con BASE y sin cotizaciones de otros bancos -> Prioridad 3', prio.prioridad === 3);

  // 8. Guarda de gobernanza: la tabla de reglas solo puede traer los cuatro
  // productos que Gustavo/Julian ya validaron. Inversiones, Coberturas y
  // BASEinet NO se agregan hasta que existan sus preguntas de descubrimiento.
  verificar(
    'TABLA_REGLAS sigue teniendo solo los 4 productos aprobados',
    TABLA_REGLAS.map((regla) => regla.producto).join('|') ===
      'Divisas / Cambios|Crédito|Comercio exterior|Captación'
  );

  Logger.log('---');
  Logger.log(pasadas + ' pruebas OK, ' + fallidas + ' fallidas.');
  Logger.log(fallidas === 0 ? 'TODO OK — puedes correr probarPrototipo() con confianza.' : 'REVISAR — algo no se comporta como se espera.');
}
