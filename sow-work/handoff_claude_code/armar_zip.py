"""Arma el ZIP para compartir el prototipo.

Correr con:  python armar_zip.py

Hace dos paquetes distintos, porque no le sirve lo mismo a cada quien:

  Diagnostico_SoW_para_probar_<fecha>.zip
      Para Nico, Gustavo y Julian. Solo las instrucciones en lenguaje simple.
      Ellos no instalan nada: abren el enlace de la hoja y prueban.

  Diagnostico_SoW_codigo_<fecha>.zip
      Para quien instale o le de mantenimiento. Codigo, pruebas y notas
      tecnicas.
"""
import datetime
import io
import os
import zipfile

CARPETA = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(CARPETA, 'paquetes')
FECHA = datetime.date.today().isoformat()

PARA_PROBAR = [
    'Instrucciones_Diagnostico_SoW.docx',
    'COMO_PROBARLO.md',
]

CODIGO = [
    'prototipo_entregables_sow.gs',
    'Sidebar_UI.gs',
    'Sidebar.html',
    'apps_script_sandbox.js',
    'test_motor_reglas.js',
    'test_panel.js',
    'vista_previa_panel/host.html',
    'vista_previa_panel/preparar.py',
    'README.md',
    'TODO.md',
    'RACI_PROPUESTA.md',
    'EMAILS_BORRADOR.md',
    'COMO_PROBARLO.md',
    'Instrucciones_Diagnostico_SoW.docx',
]

LEEME = """CONTENIDO DE ESTE PAQUETE
=========================

Prototipo del Diagnostico Share of Wallet - Banco BASE.
Fecha: {fecha}

TODOS LOS DATOS SON FICTICIOS. No hay informacion real de ningun cliente.

Que abrir primero:
  Instrucciones_Diagnostico_SoW.docx  - como probarlo, en lenguaje simple.

No hace falta instalar nada: todo corre dentro de la hoja de Google Sheets
cuyo enlace viene en el correo.

ANTES DE EMPEZAR (1 minuto): usa Google Chrome y revisa en
chrome://settings/cookies que NO tengas activado "Bloquear cookies de
terceros". El panel se comunica con Google por dentro y algunos navegadores
bloquean esa comunicacion por privacidad; si pasa, el panel se ve bien pero
no responde al dar clic.

Cualquier cosa que veas rara, dinosla tal cual.
"""

LEEME_CODIGO = """CONTENIDO DE ESTE PAQUETE (tecnico)
===================================

Prototipo del Diagnostico Share of Wallet - Banco BASE.
Fecha: {fecha}

Empieza por README.md (arquitectura y estado) y TODO.md (pendientes).

INSTALACION
  Los dos .gs y Sidebar.html van en el MISMO proyecto de Apps Script,
  vinculado a la hoja de calculo. El archivo HTML debe llamarse exactamente
  "Sidebar": mostrarPanelDiagnostico() lo busca por ese nombre literal.
  Los .js y vista_previa_panel/ son solo para probar en local; no se suben.

ANTES DE CAMBIAR NADA
  node test_motor_reglas.js   -> 13/13
  node test_panel.js          -> 36/36
  Las dos suites cargan los .gs reales, no una copia.

PENDIENTE IMPORTANTE
  Falta confirmar a mano que el panel responde (ver el bloqueante al inicio
  de TODO.md). Hasta que eso pase, no compartir el paquete de pruebas.

TODOS LOS DATOS SON FICTICIOS.
"""


def armar(nombre, archivos, leeme):
    os.makedirs(SALIDA, exist_ok=True)
    ruta = os.path.join(SALIDA, nombre)
    faltantes = [a for a in archivos if not os.path.exists(os.path.join(CARPETA, a))]
    if faltantes:
        raise SystemExit('Faltan archivos: ' + ', '.join(faltantes))

    with zipfile.ZipFile(ruta, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('LEEME.txt', leeme.format(fecha=FECHA))
        for a in archivos:
            z.write(os.path.join(CARPETA, a), a)
    return ruta, os.path.getsize(ruta)


for nombre, archivos, leeme in [
    ('Diagnostico_SoW_para_probar_%s.zip' % FECHA, PARA_PROBAR, LEEME),
    ('Diagnostico_SoW_codigo_%s.zip' % FECHA, CODIGO, LEEME_CODIGO),
]:
    ruta, tam = armar(nombre, archivos, leeme)
    print('%-45s %6.1f KB  (%d archivos)' % (os.path.basename(ruta), tam / 1024.0, len(archivos) + 1))

print('\nCarpeta: ' + SALIDA)
