/**
 * SIDEBAR_UI.gs — Menú del diagnóstico Share of Wallet
 * Banco BASE | Orquestación comercial
 *
 * Este archivo NO reemplaza prototipo_entregables_sow.gs — lo envuelve con
 * una interfaz dentro de Sheets: el asesor ya no necesita abrir el editor de
 * Apps Script para generar los entregables. Toda la lógica de negocio
 * (qué oportunidad se detecta y qué prioridad se asigna) sigue viviendo en
 * ese otro archivo; aquí solo se pregunta, se guarda y se muestra.
 *
 * HISTORIAL — por qué son cuadros de diálogo y no un panel visual (sidebar):
 * la primera versión ofrecía un panel visual (HtmlService) que se comunicaba
 * con el servidor por `google.script.run`. Ese puente falló de forma
 * consistente con "PERMISSION_DENIED al leer del almacenamiento" — confirmado
 * que NO era un problema de permisos ni del motor de reglas
 * (`probarPrototipo()` corrido directo desde el editor genera los PDF sin
 * problema, con la misma función `generarEntregables()`), sino del navegador
 * (prevención de rastreo de Microsoft Edge) bloqueando ese puente específico.
 * Por eso todo el flujo de captura usa únicamente cuadros de diálogo nativos
 * de Sheets (`ui.prompt` / `ui.alert`) — el mismo mecanismo que ya usaba
 * "Ejecutar autopruebas del motor" y que nunca ha fallado.
 *
 * Flujo:
 *   Menú "Diagnóstico Share of Wallet" → Generar diagnóstico
 *     → se hacen las preguntas una por una (se puede volver a la anterior)
 *     → se corre generarEntregables() (motor real, sin duplicar lógica)
 *     → se guarda la visita en la base de datos segura
 *     → se muestra el resultado con los enlaces a los dos PDF.
 *
 * NADA SE GUARDA A MEDIAS: todas las preguntas se contestan primero y las
 * escrituras ocurren juntas al final, bajo un mismo candado (LockService).
 * Si el asesor sale a media captura, no queda ningún rastro en la base.
 *
 * BASE DE DATOS SEGURA:
 * Las respuestas y el registro de clientes se guardan en un Google Sheet
 * APARTE (no en esta hoja de prueba) — ver obtenerBaseDeDatosSegura_(). Se
 * crea sola la primera vez y su identificador queda en las Propiedades del
 * proyecto para reutilizar siempre el mismo archivo.
 *
 * LIMITACIÓN CONOCIDA (pendiente de decisión, no es un error): las
 * Propiedades del proyecto son compartidas por todos los que usan el script,
 * pero el archivo de base de datos lo crea y lo POSEE la primera persona que
 * lo use. Si van a usarla varios asesores y necesitan ver el mismo historial,
 * hay que compartir ese archivo con ellos (menú → "Abrir la base de datos"
 * para obtener el enlace y compartirlo). Con un solo usuario no hace falta
 * nada adicional. Si un segundo asesor entra sin tener acceso, la herramienta
 * ahora lo dice con un mensaje claro en vez de crearle una base vacía por su
 * cuenta y partir el historial en dos sin avisar.
 *
 * Requiere que este archivo y prototipo_entregables_sow.gs vivan en el MISMO
 * proyecto de Apps Script (Apps Script comparte funciones entre archivos .gs
 * automáticamente — no hace falta importar nada).
 *
 * DATOS FICTICIOS: todos los clientes que aparezcan aquí y en el historial
 * son inventados. No conectar datos reales de clientes hasta pasar por el
 * proceso de seguridad/TI de Banco BASE (vault, secciones 12 y 14).
 */

const TITULO_DIALOGO = 'Diagnóstico Share of Wallet';

// ============================================================
// MENÚ
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(TITULO_DIALOGO)
    .addItem('Generar diagnóstico', 'generarEntregablesConDialogos')
    .addSeparator()
    .addItem('Abrir la base de datos de clientes', 'abrirBaseDeDatosDeClientes')
    .addItem('Reconectar la base de datos (solo si algo falla)', 'reconectarBaseDeDatosDeClientes')
    .addSeparator()
    .addItem('Ejecutar autopruebas del motor', 'ejecutarPruebasMotorReglasConAlerta')
    .addToUi();
}

/**
 * Envoltorio de ejecutarPruebasMotorReglas() (vive en
 * prototipo_entregables_sow.gs) para que un asesor sin acceso al editor de
 * Apps Script también pueda correr la autoprueba.
 */
function ejecutarPruebasMotorReglasConAlerta() {
  const ui = SpreadsheetApp.getUi();
  ejecutarPruebasMotorReglas();
  ui.alert(
    TITULO_DIALOGO,
    'Autopruebas completas. Para ver el detalle línea por línea, abre el editor ' +
      'de Apps Script y revisa el Registro de ejecución.',
    ui.ButtonSet.OK
  );
}

// ============================================================
// CATÁLOGOS DE OPCIONES
// ============================================================

/**
 * Nombre con el que el motor de reglas (prototipo_entregables_sow.gs)
 * identifica a Banco BASE. evaluarReglas() y clasificarPrioridad() comparan
 * contra este texto EXACTO para saber si el cliente ya opera con nosotros.
 * No cambiarlo sin revisar el motor.
 */
const VALOR_MOTOR_BASE = 'BASE';

/** Como se le muestra al asesor en las listas de opciones. */
const NOMBRE_VISIBLE_BASE = 'Banco BASE';

/**
 * Bancos más comunes para las preguntas de captación / cambios / crédito.
 * Si falta alguno, el asesor siempre puede usar "Otro (especifica)".
 */
const BANCOS_COMUNES = [
  NOMBRE_VISIBLE_BASE, 'BBVA', 'Santander', 'Banorte', 'HSBC', 'Citibanamex',
  'Scotiabank', 'Inbursa', 'Banco Azteca', 'BanBajío', 'Afirme', 'Multiva',
];

/**
 * Formas en que un asesor podría escribir "Banco BASE" a mano en el cuadro de
 * "Otro (especifica)". Todas se traducen al valor que espera el motor: si no,
 * el sistema trataría a BASE como competencia y detectaría una oportunidad
 * falsa contra nuestro propio banco.
 */
const ESCRITURAS_DE_BASE = ['base', 'banco base', 'banco base sa', 'banco base s.a.'];

const GIROS_COMUNES = ['Comercializadora', 'Manufactura', 'Comercio exterior', 'Servicios'];

const OPCION_OTRO = 'Otro (especifica)';

/** Cuántas opciones caben cómodamente en un cuadro de diálogo. */
const MAX_OPCIONES_EN_LISTA = 12;

// ============================================================
// SEÑALES INTERNAS DEL FLUJO
// ============================================================

/** Lo devuelve una pregunta cuando el asesor pide regresar a la anterior. */
const VOLVER = Object.freeze({ señal: 'volver' });

/** Lo devuelve la búsqueda de clientes cuando ninguno de la lista sirve. */
const REGISTRAR_NUEVO = Object.freeze({ señal: 'registrar-nuevo' });

const OPCION_CLIENTE_EXISTENTE = 'Un cliente que ya visitaste antes';
const OPCION_CLIENTE_NUEVO = 'Un cliente nuevo';
const OPCION_NINGUNO_DE_ESTOS = 'Ninguno de estos — registrar uno nuevo';

// ============================================================
// GENERAR DIAGNÓSTICO — punto de entrada del menú
// ============================================================

/**
 * Orden de las operaciones (importa):
 *   1. preguntar todo   — si el asesor sale aquí, no se guarda nada;
 *   2. generar los PDF  — si esto falla, tampoco se guarda nada;
 *   3. guardar la visita — las dos hojas se escriben juntas, bajo candado;
 *   4. mostrar resultado.
 * Si el paso 3 falla, los PDF ya existen y se muestran igual, avisando que el
 * registro no se pudo guardar: es preferible a perder el trabajo de la visita.
 */
function generarEntregablesConDialogos() {
  const ui = SpreadsheetApp.getUi();

  let datos;
  try {
    datos = capturarDatosDeVisita_(ui);
  } catch (e) {
    ui.alert(TITULO_DIALOGO, mensajeAmigableDeError_(e, 'al preparar el diagnóstico'), ui.ButtonSet.OK);
    return;
  }
  if (datos === null) return; // el asesor salió: no se guardó nada

  let resultado;
  try {
    resultado = generarEntregables(datos);
  } catch (e) {
    ui.alert(TITULO_DIALOGO, mensajeAmigableDeError_(e, 'al generar los documentos'), ui.ButtonSet.OK);
    return;
  }

  let avisoDeGuardado = '';
  try {
    guardarVisita_(datos, resultado);
  } catch (e) {
    avisoDeGuardado =
      'Los dos documentos sí se generaron y los puedes abrir aquí abajo, pero no se pudo ' +
      'guardar esta visita en la base de datos. ' + mensajeAmigableDeError_(e, 'al guardar');
  }

  mostrarResultadoEnDialogo_(resultado, datos, avisoDeGuardado);
}

// ============================================================
// CAPTURA — las preguntas, una por una
// ============================================================

/**
 * Devuelve el objeto de datos listo para el motor, o null si el asesor salió.
 * Las preguntas se declaran como una lista de pasos para poder movernos hacia
 * adelante y hacia atrás sin repetir código.
 */
function capturarDatosDeVisita_(ui) {
  const datos = recorrerPasos_(ui, definirPasosDeVisita_());
  if (datos === null) return null;
  // `capturarMontos` solo sirvió para decidir si preguntar los montos; no es
  // un dato de la visita, así que no se manda al motor ni se guarda.
  delete datos.capturarMontos;
  return datos;
}

/**
 * Los pasos van agrupados por tema, no en orden aleatorio: primero de quién
 * hablamos (cliente y giro), luego dónde tiene su dinero hoy (captación,
 * cambios, crédito), luego qué tan disputado está (cotizaciones), luego los
 * montos —opcionales, porque no siempre se saben— y al final el pendiente,
 * que es lo último que uno anota al salir de una visita.
 */
function definirPasosDeVisita_() {
  return [
    { clave: 'nombre', preguntar: preguntarCliente_ },
    { clave: 'giro', preguntar: preguntarGiro_ },
    { clave: 'bancoPrincipalCaptacion', preguntar: preguntarBancoCaptacion_ },
    { clave: 'bancoCambios', preguntar: preguntarBancoCambios_ },
    { clave: 'tieneCreditoOtroBanco', preguntar: preguntarTieneCredito_ },
    {
      clave: 'bancoCredito',
      preguntar: preguntarBancoCredito_,
      aplica: function (datos) { return datos.tieneCreditoOtroBanco === true; },
      valorSiNoAplica: '',
    },
    { clave: 'recibeCotizacionesOtrosBancos', preguntar: preguntarCotizaciones_ },
    { clave: 'capturarMontos', preguntar: preguntarSiSeCapturanMontos_ },
    { clave: 'montoCompraDivisasMensual', preguntar: preguntarMontoCompraDivisas_, aplica: seCapturanMontos_, valorSiNoAplica: '' },
    { clave: 'montoVentaDivisasMensual', preguntar: preguntarMontoVentaDivisas_, aplica: seCapturanMontos_, valorSiNoAplica: '' },
    { clave: 'montoExportacionMensual', preguntar: preguntarMontoExportacion_, aplica: seCapturanMontos_, valorSiNoAplica: '' },
    { clave: 'montoImportacionMensual', preguntar: preguntarMontoImportacion_, aplica: seCapturanMontos_, valorSiNoAplica: '' },
    { clave: 'pendiente', preguntar: preguntarPendiente_ },
  ];
}

/**
 * Recorre los pasos permitiendo regresar al anterior. Los pasos que no
 * aplican (por ejemplo, el banco del crédito cuando el cliente no tiene
 * crédito) se saltan solos, tanto de ida como de regreso.
 *
 * Devuelve el objeto con las respuestas, o null si el asesor decidió salir.
 */
function recorrerPasos_(ui, pasos) {
  const datos = {};
  let i = 0;

  while (i < pasos.length) {
    const paso = pasos[i];

    if (paso.aplica && !paso.aplica(datos)) {
      datos[paso.clave] = paso.valorSiNoAplica;
      i++;
      continue;
    }

    const anterior = indiceDelPasoAnterior_(pasos, datos, i);
    const respuesta = paso.preguntar(ui, datos, anterior !== -1);

    if (respuesta === null) return null;
    if (respuesta === VOLVER) {
      // Red de seguridad: en la primera pregunta no hay a donde volver. Las
      // preguntas ya no ofrecen esa opcion en ese caso, pero si alguna llegara
      // a devolverla, se vuelve a preguntar en vez de salirse del arreglo.
      if (anterior === -1) continue;
      // Se limpia la respuesta de este paso para que, si al regresar cambia
      // una condición, no quede un dato viejo que ya no corresponde.
      delete datos[paso.clave];
      i = anterior;
      continue;
    }

    datos[paso.clave] = respuesta;
    i++;
  }

  return datos;
}

/** Índice del paso anterior que sí aplica, o -1 si este es el primero. */
function indiceDelPasoAnterior_(pasos, datos, i) {
  for (let j = i - 1; j >= 0; j--) {
    if (!pasos[j].aplica || pasos[j].aplica(datos)) return j;
  }
  return -1;
}

// ---- Cada pregunta ----

function preguntarCliente_(ui, datos, puedeVolver) {
  const registrados = obtenerClientesRegistrados_();

  if (registrados.length === 0) {
    return pedirNombreDeClienteNuevo_(ui, registrados, puedeVolver);
  }

  const modo = pedirOpcion_(ui, '¿Con qué cliente vas a trabajar?',
    [OPCION_CLIENTE_EXISTENTE, OPCION_CLIENTE_NUEVO], puedeVolver);
  if (modo === null || modo === VOLVER) return modo;

  let elegido = (modo === OPCION_CLIENTE_NUEVO)
    ? pedirNombreDeClienteNuevo_(ui, registrados, true)
    : buscarClienteRegistrado_(ui, registrados);

  if (elegido === null) return null;
  // Regresar desde adentro de este paso devuelve a su propia primera pregunta,
  // no al paso anterior del flujo: es lo que el asesor espera.
  if (elegido === VOLVER) return preguntarCliente_(ui, datos, puedeVolver);

  if (elegido === REGISTRAR_NUEVO) {
    elegido = pedirNombreDeClienteNuevo_(ui, registrados, true);
    if (elegido === null) return null;
    if (elegido === VOLVER) return preguntarCliente_(ui, datos, puedeVolver);
    return elegido;
  }

  mostrarHistorialCliente_(ui, elegido);
  return elegido;
}

/**
 * Pide el nombre de un cliente nuevo y avisa si ya existía escrito de otra
 * forma ("ACEROS del Norte" vs "Aceros del norte"): en ese caso se reutiliza
 * el registro que ya estaba, para no partir el historial del mismo cliente
 * en dos renglones distintos.
 */
function pedirNombreDeClienteNuevo_(ui, registrados, puedeVolver) {
  const nombre = pedirTexto_(ui, 'Nombre del cliente (empresa):', { puedeVolver: puedeVolver });
  if (nombre === null || nombre === VOLVER) return nombre;

  const yaRegistrado = buscarPorNombreNormalizado_(registrados, nombre);
  if (yaRegistrado) {
    ui.alert(TITULO_DIALOGO,
      'Ya tenías registrado a «' + yaRegistrado.nombre + '».\n\n' +
      'Se va a actualizar ese mismo cliente en lugar de crear uno repetido.',
      ui.ButtonSet.OK);
    mostrarHistorialCliente_(ui, yaRegistrado.nombre);
    return yaRegistrado.nombre;
  }

  return nombre;
}

/**
 * Elegir un cliente ya registrado. Con pocos clientes se muestra la lista
 * completa; cuando ya son muchos se pide primero un texto de búsqueda (sin
 * importar mayúsculas ni acentos), porque una lista numerada de 40 clientes
 * en un cuadro de diálogo es inservible.
 */
function buscarClienteRegistrado_(ui, registrados) {
  let candidatos = registrados;

  while (true) {
    if (registrados.length > MAX_OPCIONES_EN_LISTA && candidatos === registrados) {
      const texto = pedirTexto_(ui,
        'Tienes ' + registrados.length + ' clientes registrados — son demasiados para una lista.\n\n' +
        'Escribe una parte del nombre del cliente que buscas (por ejemplo: aceros):',
        { puedeVolver: true });
      if (texto === null || texto === VOLVER) return texto;

      const encontrados = filtrarClientesPorTexto_(registrados, texto);
      if (encontrados.length === 0) {
        ui.alert(TITULO_DIALOGO,
          'No encontré ningún cliente que contenga «' + texto + '».\n\n' +
          'Intenta con otra parte del nombre.', ui.ButtonSet.OK);
        continue;
      }
      if (encontrados.length > MAX_OPCIONES_EN_LISTA) {
        ui.alert(TITULO_DIALOGO,
          'Encontré ' + encontrados.length + ' clientes con «' + texto + '» — todavía son muchos.\n\n' +
          'Escribe una parte más específica del nombre.', ui.ButtonSet.OK);
        continue;
      }
      candidatos = encontrados;
    }

    const opciones = candidatos.map(function (cliente) { return cliente.nombre; })
      .concat([OPCION_NINGUNO_DE_ESTOS]);
    const elegido = pedirOpcion_(ui, 'Elige el cliente:', opciones, true);

    if (elegido === null) return null;
    if (elegido === VOLVER) {
      // Si esta lista salió de una búsqueda, "volver" regresa al buscador;
      // si es la lista completa, regresa al paso anterior del flujo.
      if (candidatos !== registrados) { candidatos = registrados; continue; }
      return VOLVER;
    }
    if (elegido === OPCION_NINGUNO_DE_ESTOS) return REGISTRAR_NUEVO;
    return elegido;
  }
}

function preguntarGiro_(ui, datos, puedeVolver) {
  return pedirOpcionConOtro_(ui, 'Giro del negocio:', GIROS_COMUNES, puedeVolver);
}

function preguntarBancoCaptacion_(ui, datos, puedeVolver) {
  return pedirBanco_(ui, '¿Con qué banco tiene su captación principal (donde guarda su dinero)?',
    puedeVolver, { incluirBASE: true });
}

function preguntarBancoCambios_(ui, datos, puedeVolver) {
  return pedirBanco_(ui, '¿Con qué banco hace sus operaciones de cambios (compra y venta de divisas)?',
    puedeVolver, { incluirBASE: true });
}

function preguntarTieneCredito_(ui, datos, puedeVolver) {
  return pedirSiNo_(ui, '¿Tiene un crédito vigente con otro banco?', puedeVolver);
}

function preguntarBancoCredito_(ui, datos, puedeVolver) {
  // Aquí NO se ofrece Banco BASE: la pregunta anterior fue explícitamente
  // "¿con OTRO banco?", así que ofrecerlo solo genera respuestas contradictorias.
  return pedirBanco_(ui, '¿Con qué banco tiene ese crédito?', puedeVolver, { incluirBASE: false });
}

function preguntarCotizaciones_(ui, datos, puedeVolver) {
  return pedirSiNo_(ui, '¿Recibe cotizaciones o reportes de mercado de otro banco?', puedeVolver);
}

function preguntarSiSeCapturanMontos_(ui, datos, puedeVolver) {
  return pedirSiNo_(ui,
    '¿Quieres capturar los montos aproximados del cliente?\n\n' +
    'Son 4 preguntas más (divisas, exportación e importación) y puedes dejar ' +
    'vacía cualquiera. Sirven para que los documentos traigan cifras en lugar de "N/D".',
    puedeVolver);
}

function seCapturanMontos_(datos) {
  return datos.capturarMontos === true;
}

function preguntarMontoCompraDivisas_(ui, datos, puedeVolver) {
  return pedirMontoOpcional_(ui, '¿Cuánto COMPRA de divisas al mes, aproximadamente?', puedeVolver);
}

function preguntarMontoVentaDivisas_(ui, datos, puedeVolver) {
  return pedirMontoOpcional_(ui, '¿Cuánto VENDE de divisas al mes, aproximadamente?', puedeVolver);
}

function preguntarMontoExportacion_(ui, datos, puedeVolver) {
  return pedirMontoOpcional_(ui, '¿Cuánto EXPORTA al mes, aproximadamente?', puedeVolver);
}

function preguntarMontoImportacion_(ui, datos, puedeVolver) {
  return pedirMontoOpcional_(ui, '¿Cuánto IMPORTA al mes, aproximadamente?', puedeVolver);
}

function pedirMontoOpcional_(ui, mensaje, puedeVolver) {
  return pedirTexto_(ui,
    mensaje + '\n\nEjemplo: USD 90,000 — déjalo vacío si no lo sabes.',
    { puedeVolver: puedeVolver, permitirVacio: true });
}

function preguntarPendiente_(ui, datos, puedeVolver) {
  return pedirTexto_(ui,
    '¿Quedó algo pendiente para la próxima visita?\n\n' +
    'Esto es lo que verás la próxima vez que busques a este cliente. ' +
    'Déjalo vacío si no aplica.',
    { puedeVolver: puedeVolver, permitirVacio: true });
}

// ============================================================
// CUADROS DE DIÁLOGO — bloques reutilizables
// ============================================================

/**
 * Qué devuelven todos los `pedir...`:
 *   - el valor contestado;
 *   - VOLVER, si el asesor quiere regresar a la pregunta anterior;
 *   - null, si el asesor confirmó que quiere salir del diagnóstico.
 */

/**
 * Cuando el asesor le da a Cancelar (o cierra el cuadro con la X) NO se tira
 * todo el trabajo de inmediato: se le pregunta qué quiere hacer. Antes, un
 * clic accidental en Cancelar borraba las ocho respuestas ya capturadas sin
 * ningún aviso.
 */
function manejarSalida_(ui, puedeVolver) {
  if (!puedeVolver) {
    const r = ui.alert(TITULO_DIALOGO,
      '¿Quieres salir del diagnóstico? No se va a guardar nada.\n\n' +
      'Sí = salir     ·     No = seguir contestando',
      ui.ButtonSet.YES_NO);
    return r === ui.Button.YES ? 'SALIR' : 'SEGUIR';
  }

  const r = ui.alert(TITULO_DIALOGO,
    '¿Qué quieres hacer?\n\n' +
    'Sí = salir del diagnóstico (no se guarda nada)\n' +
    'No = volver a la pregunta anterior\n' +
    'Cancelar = seguir en esta pregunta',
    ui.ButtonSet.YES_NO_CANCEL);
  if (r === ui.Button.YES) return 'SALIR';
  if (r === ui.Button.NO) return 'VOLVER';
  return 'SEGUIR'; // incluye cerrar con la X: lo más seguro es no perder nada
}

/**
 * Cuadro de texto libre.
 * `opciones.permitirVacio` deja pasar una respuesta vacía (para datos
 * opcionales). Si no está permitido y el asesor deja el cuadro vacío, se le
 * vuelve a preguntar — antes, dejarlo vacío cancelaba TODO el diagnóstico.
 */
function pedirTexto_(ui, mensaje, opciones) {
  opciones = opciones || {};
  const puedeVolver = opciones.puedeVolver === true;
  const permitirVacio = opciones.permitirVacio === true;
  const pie = puedeVolver ? '\n\n(Escribe la palabra volver para regresar a la pregunta anterior.)' : '';

  while (true) {
    const r = ui.prompt(TITULO_DIALOGO, mensaje + pie, ui.ButtonSet.OK_CANCEL);

    if (r.getSelectedButton() !== ui.Button.OK) {
      const accion = manejarSalida_(ui, puedeVolver);
      if (accion === 'SALIR') return null;
      if (accion === 'VOLVER') return VOLVER;
      continue;
    }

    const texto = r.getResponseText().trim();
    if (puedeVolver && normalizarTexto_(texto) === 'volver') return VOLVER;
    if (texto === '' && !permitirVacio) {
      ui.alert(TITULO_DIALOGO,
        'Este dato no puede quedar vacío. Escríbelo y vuelve a dar Aceptar, ' +
        'o usa Cancelar si quieres salir.', ui.ButtonSet.OK);
      continue;
    }
    return texto;
  }
}

/** Pregunta de Sí / No con botones. */
function pedirSiNo_(ui, mensaje, puedeVolver) {
  while (true) {
    const r = ui.alert(TITULO_DIALOGO, mensaje, ui.ButtonSet.YES_NO_CANCEL);
    if (r === ui.Button.YES) return true;
    if (r === ui.Button.NO) return false;

    const accion = manejarSalida_(ui, puedeVolver);
    if (accion === 'SALIR') return null;
    if (accion === 'VOLVER') return VOLVER;
  }
}

/**
 * Los cuadros nativos de Sheets no tienen listas desplegables, así que las
 * opciones se numeran y el asesor escribe el número. El 0 siempre significa
 * "volver", cuando volver es posible.
 */
function pedirOpcion_(ui, mensaje, opciones, puedeVolver) {
  const lista = opciones.map(function (opcion, i) { return (i + 1) + '. ' + opcion; }).join('\n');
  const pie = puedeVolver ? '\n0. ← Volver a la pregunta anterior' : '';

  while (true) {
    const r = ui.prompt(TITULO_DIALOGO,
      mensaje + '\n\n' + lista + pie + '\n\nEscribe solo el número:',
      ui.ButtonSet.OK_CANCEL);

    if (r.getSelectedButton() !== ui.Button.OK) {
      const accion = manejarSalida_(ui, puedeVolver);
      if (accion === 'SALIR') return null;
      if (accion === 'VOLVER') return VOLVER;
      continue;
    }

    const texto = r.getResponseText().trim();
    if (puedeVolver && texto === '0') return VOLVER;

    // Se exige que sean solo dígitos: "2 bancos" no debe colarse como un 2.
    if (/^\d+$/.test(texto)) {
      const indice = parseInt(texto, 10) - 1;
      if (indice >= 0 && indice < opciones.length) return opciones[indice];
    }
    ui.alert(TITULO_DIALOGO,
      'Escribe solo el número de una de las opciones de la lista (por ejemplo: 1).',
      ui.ButtonSet.OK);
  }
}

/**
 * Como pedirOpcion_(), más "Otro (especifica)" al final: si el asesor la
 * elige, se abre un cuadro de texto libre. Así el catálogo nunca bloquea un
 * caso no previsto.
 */
function pedirOpcionConOtro_(ui, mensaje, opciones, puedeVolver) {
  const elegido = pedirOpcion_(ui, mensaje, opciones.concat([OPCION_OTRO]), puedeVolver);
  if (elegido === null || elegido === VOLVER) return elegido;
  if (elegido !== OPCION_OTRO) return elegido;

  const libre = pedirTexto_(ui, 'Escríbelo tal cual:\n\n' + mensaje, { puedeVolver: true });
  if (libre === null) return null;
  // Volver desde el texto libre regresa a la misma lista, no al paso anterior.
  if (libre === VOLVER) return pedirOpcionConOtro_(ui, mensaje, opciones, puedeVolver);
  return libre;
}

/**
 * Pregunta de banco. Traduce cualquier forma de escribir "Banco BASE" al
 * valor exacto que espera el motor de reglas.
 */
function pedirBanco_(ui, mensaje, puedeVolver, opciones) {
  const incluirBASE = !opciones || opciones.incluirBASE !== false;
  const catalogo = incluirBASE
    ? BANCOS_COMUNES
    : BANCOS_COMUNES.filter(function (banco) { return banco !== NOMBRE_VISIBLE_BASE; });

  const elegido = pedirOpcionConOtro_(ui, mensaje, catalogo, puedeVolver);
  if (elegido === null || elegido === VOLVER) return elegido;
  return normalizarNombreDeBanco_(elegido);
}

/**
 * "Banco BASE", "base", "BANCO BASE S.A." → 'BASE' (lo que compara el motor).
 * Cualquier otro banco se guarda tal cual lo escribió el asesor.
 */
function normalizarNombreDeBanco_(nombre) {
  return ESCRITURAS_DE_BASE.indexOf(normalizarTexto_(nombre)) !== -1 ? VALOR_MOTOR_BASE : nombre;
}

// ============================================================
// TEXTO — utilidades sin dependencias de Google (fáciles de probar)
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

/** Busca un cliente sin importar mayúsculas ni acentos. */
function buscarPorNombreNormalizado_(clientes, nombre) {
  const clave = normalizarTexto_(nombre);
  for (let i = 0; i < clientes.length; i++) {
    if (clientes[i].clave === clave) return clientes[i];
  }
  return null;
}

/** Filtra por coincidencia parcial, sin importar mayúsculas ni acentos. */
function filtrarClientesPorTexto_(clientes, texto) {
  const buscado = normalizarTexto_(texto);
  if (buscado === '') return clientes;
  return clientes.filter(function (cliente) { return cliente.clave.indexOf(buscado) !== -1; });
}

/**
 * Escapa un texto para poder meterlo en el HTML del diálogo de resultado.
 * Sin esto, un nombre de empresa con "&" o "<" rompe el cuadro de resultado.
 */
function escaparHtml_(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

  // Los errores que este mismo archivo redacta ya vienen explicados.
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
// RESULTADO
// ============================================================

/**
 * Muestra prioridad, oportunidades y los enlaces a los dos PDF. El HTML se
 * arma completo en el servidor y se manda ya listo — no hace falta ningún
 * `google.script.run` de vuelta, que es justo el puente que fallaba.
 */
function mostrarResultadoEnDialogo_(resultado, datos, avisoDeGuardado) {
  const prioridad = resultado.prioridadCliente;

  let oportunidadesHtml = '';
  if (resultado.oportunidades.length === 0) {
    oportunidadesHtml = '<p style="color:' + COLOR_GRIS_BASE + ';">No se detectaron brechas con los datos capturados.</p>';
  } else {
    resultado.oportunidades.forEach(function (oportunidad) {
      oportunidadesHtml +=
        '<div style="border-left:3px solid ' + COLOR_AMARILLO_BASE + ';padding:8px 10px;margin-bottom:8px;background:#FAFAFA;">' +
        '<b>' + escaparHtml_(oportunidad.producto) + '</b><br>' +
        '<span style="color:' + COLOR_GRIS_BASE + ';font-size:12px;">' + escaparHtml_(oportunidad.justificacion) + '</span></div>';
    });
  }

  const avisoHtml = avisoDeGuardado
    ? '<div style="background:#FFF4E5;border:1px solid ' + COLOR_AMARILLO_BASE + ';border-radius:6px;padding:8px 10px;margin-bottom:14px;font-size:12px;">' +
      escaparHtml_(avisoDeGuardado) + '</div>'
    : '';

  const pendienteHtml = datos.pendiente
    ? '<div style="background:#F5F5F5;border-radius:6px;padding:8px 10px;margin-bottom:14px;font-size:12px;">' +
      '<b>Pendiente para la próxima visita:</b> ' + escaparHtml_(datos.pendiente) + '</div>'
    : '';

  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial, sans-serif;padding:4px 2px;">' +
    '<div style="color:' + COLOR_AMARILLO_BASE + ';font-weight:bold;font-size:11px;letter-spacing:0.5px;">BANCO BASE · ORQUESTACIÓN COMERCIAL</div>' +
    '<h2 style="margin:4px 0 12px;">Documentos generados — ' + escaparHtml_(datos.nombre) + '</h2>' +
    avisoHtml +
    '<div style="background:' + (prioridad.prioridad === 1 ? '#FCE9BF' : '#F5F5F5') + ';border-radius:6px;padding:10px;margin-bottom:14px;">' +
    '<b>' + escaparHtml_(prioridad.etiqueta) + '</b><br>' +
    '<span style="font-size:12px;color:#333;">' + escaparHtml_(prioridad.motivo) + '</span></div>' +
    pendienteHtml +
    '<div style="font-weight:bold;font-size:12px;margin-bottom:6px;">Oportunidades detectadas</div>' +
    oportunidadesHtml +
    '<div style="margin-top:14px;">' +
    '<a href="' + escaparHtml_(resultado.pdfAsesor.getUrl()) + '" target="_blank" style="display:block;background:' + COLOR_AMARILLO_BASE + ';color:#000;text-decoration:none;text-align:center;padding:9px;border-radius:6px;font-weight:bold;margin-bottom:8px;">Abrir el PDF del asesor</a>' +
    '<a href="' + escaparHtml_(resultado.guion.getUrl()) + '" target="_blank" style="display:block;border:1px solid #D1D1D2;color:#000;text-decoration:none;text-align:center;padding:9px;border-radius:6px;">Abrir el guion de conversación</a>' +
    '</div></div>'
  ).setWidth(420).setHeight(560);

  SpreadsheetApp.getUi().showModalDialog(html, TITULO_DIALOGO);
}

// ============================================================
// BASE DE DATOS SEGURA (hoja de cálculo aparte, ver cabecera del archivo)
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

/**
 * El libro se guarda en memoria durante la ejecución: antes se volvía a
 * abrir en cada llamada (cuatro veces por diagnóstico), lo que era lento y
 * multiplicaba las oportunidades de fallar a medio camino.
 */
let libroBaseDeDatosEnMemoria_ = null;

/**
 * Devuelve el libro de la base de datos segura, creándolo la primera vez.
 *
 * Si el identificador guardado ya no se puede abrir, NO se crea otra base en
 * silencio: eso le partiría el historial en dos a quien no tiene acceso al
 * archivo original, sin que se entere. Se explica el problema y se ofrece el
 * menú "Reconectar la base de datos" como decisión consciente.
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
        ' → Reconectar la base de datos" para empezar una base nueva y vacía ' +
        '(el historial anterior no se borra, pero esta herramienta dejaría de leerlo).\n\n' +
        'Identificador del archivo: ' + id
      );
    }
    asegurarEstructura_(libro);
    libroBaseDeDatosEnMemoria_ = libro;
    return libro;
  }

  // Bajo candado: si dos asesores generan su primer diagnóstico al mismo
  // tiempo, solo se crea una base y el segundo reutiliza la del primero.
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
 * ninguna propiedad apuntando a él — así el siguiente intento empieza limpio
 * en lugar de dejar la herramienta rota apuntando a un libro sin hojas.
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
      // Si ni siquiera se puede tirar a la papelera, no se hace nada más:
      // lo importante es no guardar el identificador de un archivo incompleto.
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

/**
 * Ejecuta algo con candado de script, para que dos asesores trabajando al
 * mismo tiempo no se pisen al leer y escribir la hoja "Clientes".
 */
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
 * Guarda la visita: una fila nueva en "Respuestas" (histórico de visitas) y
 * el renglón del cliente en "Clientes" (la memoria). Las dos escrituras van
 * juntas dentro del mismo candado para que nunca quede una sin la otra.
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
 * Hoja "Clientes" — un renglón por cliente, no por visita. Es la memoria que
 * permite buscar a alguien ya visitado y ver qué quedó pendiente.
 *
 * La búsqueda del renglón ignora mayúsculas y acentos, y se conserva el
 * nombre tal como se escribió la primera vez: así el mismo cliente no acaba
 * repartido en varios renglones por diferencias de escritura.
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

/**
 * Clientes ya registrados, ordenados alfabéticamente y sin repetidos.
 * El filtro de repetidos protege el historial creado por versiones
 * anteriores, que sí podían guardar al mismo cliente dos veces.
 */
function obtenerClientesRegistrados_() {
  const hoja = asegurarHoja_(obtenerBaseDeDatosSegura_(), HOJA_CLIENTES, ENCABEZADO_CLIENTES);
  const valores = hoja.getDataRange().getValues();

  const clientes = [];
  const clavesVistas = {};
  for (let i = 1; i < valores.length; i++) {
    const nombre = String(valores[i][0] === null || valores[i][0] === undefined ? '' : valores[i][0]).trim();
    if (!nombre) continue;
    const clave = normalizarTexto_(nombre);
    if (clavesVistas[clave]) continue;
    clavesVistas[clave] = true;
    clientes.push({ nombre: nombre, clave: clave });
  }

  return clientes.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
}

/** Muestra el historial guardado de un cliente antes de volver a visitarlo. */
function mostrarHistorialCliente_(ui, nombre) {
  const hoja = asegurarHoja_(obtenerBaseDeDatosSegura_(), HOJA_CLIENTES, ENCABEZADO_CLIENTES);
  const valores = hoja.getDataRange().getValues();
  const clave = normalizarTexto_(nombre);

  for (let i = 1; i < valores.length; i++) {
    if (normalizarTexto_(valores[i][0]) !== clave) continue;

    const lineas = [];
    const fecha = formatearFecha_(valores[i][1]);
    if (fecha) lineas.push('Última visita: ' + fecha);
    if (valores[i][3]) lineas.push('Cómo quedó la última vez: ' + valores[i][3]);
    lineas.push('Pendiente de la visita anterior: ' + (valores[i][4] ? valores[i][4] : 'ninguno registrado'));

    ui.alert('Historial de ' + valores[i][0], lineas.join('\n'), ui.ButtonSet.OK);
    return;
  }
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
      '<p style="font-size:12px;color:' + COLOR_GRIS_BASE + ';">Si otro asesor va a usar la herramienta, ' +
      'compártele este archivo para que vean el mismo historial.</p>' +
      '<a href="' + escaparHtml_(libro.getUrl()) + '" target="_blank" style="display:block;background:' +
      COLOR_AMARILLO_BASE + ';color:#000;text-decoration:none;text-align:center;padding:9px;border-radius:6px;font-weight:bold;">Abrir la base de datos</a>' +
      '</div>'
    ).setWidth(400).setHeight(220);
    ui.showModalDialog(html, 'Base de datos de clientes');
  } catch (e) {
    ui.alert(TITULO_DIALOGO, mensajeAmigableDeError_(e, 'al abrir la base de datos'), ui.ButtonSet.OK);
  }
}

/**
 * Salida de emergencia: olvida el archivo actual y crea una base nueva.
 * Solo tiene sentido cuando la herramienta ya avisó que no puede abrir la
 * base. Se pide confirmación explícita porque implica dejar de ver el
 * historial anterior.
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
    const libro = obtenerBaseDeDatosSegura_();
    ui.alert(TITULO_DIALOGO,
      'Listo. Se creó una base de datos nueva y vacía.\n\n' +
      'Puedes verla en el menú → "Abrir la base de datos de clientes".',
      ui.ButtonSet.OK);
    Logger.log('Base de datos reconectada: ' + libro.getUrl());
  } catch (e) {
    ui.alert(TITULO_DIALOGO, mensajeAmigableDeError_(e, 'al reconectar la base de datos'), ui.ButtonSet.OK);
  }
}
