"""Prepara una copia local del sidebar con un doble de google.script.run,
para poder revisar la apariencia y la navegacion sin instalarlo en Sheets."""
import io
import sys

ORIGEN = sys.argv[1] if len(sys.argv) > 1 else 'sidebar_original.html'
DESTINO = sys.argv[2] if len(sys.argv) > 2 else 'sidebar.html'

STUB = """
  <script>
    // ---- Doble de pruebas de google.script.run (solo para el banco local) ----
    (function () {
      var respuestas = {
        listarClientesFicticios: function () {
          return ['Comercializadora Ejemplo SA de CV',
                  'Grupo Industrial Ficticio SA de CV',
                  'Distribuidora Modelo SA de CV'];
        },
        listarClientes: function () {
          return [
            { nombre: 'Comercializadora Ejemplo SA de CV', etiqueta: 'Prioridad 1 - ataque directo', pendiente: 'Enviar comparativo de divisas', ultimaVisita: '04/09/2026' },
            { nombre: 'Grupo Industrial Ficticio SA de CV', etiqueta: 'Prioridad 3 - rutina normal', pendiente: '', ultimaVisita: '01/09/2026' }
          ];
        },
        correrAutopruebasDesdeSidebar: function () {
          return { todoBien: true, mensaje: 'Autopruebas completas: 15 pruebas OK, ninguna fallo. El motor esta sano.' };
        },
        guardarRespuestaYGenerar: function () {
          return {
            pdfUrl: 'https://example.test/pdf',
            guionUrl: 'https://example.test/guion',
            prioridad: {
              prioridad: 1,
              etiqueta: 'Prioridad 1 - ataque directo',
              motivo: 'Brecha alta y sus bancos estan repartidos: es mas facil mover una pieza sin depender de mover toda la relacion bancaria.'
            },
            oportunidades: [
              { producto: 'Divisas / Cambios', justificacion: 'El cliente hace sus operaciones de cambios con Santander. Reporta ~USD 90,000 de compra y ~USD 60,000 de venta al mes (ilustrativo).' },
              { producto: 'Credito', justificacion: 'El cliente tiene credito vigente con Banorte a una tasa reportada de TIIE + 6 (ilustrativo).' },
              { producto: 'Captacion', justificacion: 'El cliente mantiene su captacion principal en BBVA.' }
            ]
          };
        }
      };

      function Corredor() {
        this._ok = function () {};
        this._error = function () {};
      }
      Corredor.prototype.withSuccessHandler = function (fn) { this._ok = fn; return this; };
      Corredor.prototype.withFailureHandler = function (fn) { this._error = fn; return this; };
      Object.keys(respuestas).forEach(function (nombre) {
        Corredor.prototype[nombre] = function () {
          var args = Array.prototype.slice.call(arguments);
          var self = this;
          setTimeout(function () {
            try { self._ok(respuestas[nombre].apply(null, args)); }
            catch (e) { self._error(e); }
          }, 120);
        };
      });

      window.google = window.google || {};
      window.google.script = window.google.script || {};
      Object.defineProperty(window.google.script, 'run', {
        get: function () { return new Corredor(); }
      });
    })();
  </script>
"""

html = io.open(ORIGEN, encoding='utf-8').read()
marca = '  <script>'
i = html.index(marca)
html = html[:i] + STUB + html[i:]
io.open(DESTINO, 'w', encoding='utf-8').write(html)
print('preparado ->', DESTINO)
