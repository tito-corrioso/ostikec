/* ============================================================================
   EXTRAS2.JS — Módulo adicional de OSTIKEC
   ============================================================================
   Contenido:
     21. Filtro de tickets por rango de fechas.
     1.  Plantillas base del ticket.
     3.  Bloque de firma al pie del ticket.
     10. Filtros por negocio y por nombre.
     14. Marcar tickets como usados.
     5.  Reinicio periódico de numeración.
     15. Aviso de respaldo mensual.
     19. PIN del panel.
     2.  Vista previa mini del ticket.

   Requiere que extras.js se cargue ANTES y exponga window.OSTIKEC.
   ============================================================================ */

(function () {
  'use strict';

  /* ============================================================
     CONSTANTES
     ============================================================ */
  const CLAVE_FILTRO          = 'ostikec_filtro_fechas';
  const CLAVE_FIRMA           = 'ostikec_firma_config';
  const CLAVE_REINICIO        = 'ostikec_numeracion_reinicio';
  const CLAVE_RESPALDO        = 'ostikec_ultimo_respaldo';
  const CLAVE_PIN_CONFIG      = 'ostikec_pin_panel';
  const CLAVE_PIN_INTENTOS    = 'ostikec_pin_intentos';
  const DIAS_RESPALDO         = 30;
  const PIN_LONGITUD          = 4;
  const MAX_INTENTOS_PIN      = 3;
  const MINUTOS_BLOQUEO_PIN   = 5;

  const RANGOS = [
    { valor: 'todo',          etiqueta: 'Todo el historial' },
    { valor: 'hoy',           etiqueta: 'Hoy' },
    { valor: 'semana',        etiqueta: 'Esta semana (desde el lunes)' },
    { valor: 'mes',           etiqueta: 'Este mes' },
    { valor: 'personalizado', etiqueta: 'Rango personalizado' }
  ];

  const MODOS_REINICIO = [
    { valor: 'nunca', etiqueta: 'Nunca (correlativo continuo)' },
    { valor: 'mes',   etiqueta: 'Cada mes' },
    { valor: 'anio',  etiqueta: 'Cada año' }
  ];

  const PLANTILLAS = {
    estandar: {
      nombre: 'Estándar',
      descripcion: 'Azul OSTIKEC + dorado',
      estilo: {
        colorCinta: '#16324f',
        colorFondo: '#ffffff',
        colorAcento: '#f2a900',
        fuente: 'Arial',
        orientacion: 'vertical'
      }
    },
    factura: {
      nombre: 'Factura',
      descripcion: 'Formal, blanco y negro',
      estilo: {
        colorCinta: '#1f2937',
        colorFondo: '#ffffff',
        colorAcento: '#64748b',
        fuente: 'Courier New',
        orientacion: 'vertical'
      }
    },
    evento: {
      nombre: 'Evento',
      descripcion: 'Morado y rosa',
      estilo: {
        colorCinta: '#6b21a8',
        colorFondo: '#fffbeb',
        colorAcento: '#db2777',
        fuente: 'Arial',
        orientacion: 'vertical'
      }
    },
    recibo: {
      nombre: 'Recibo',
      descripcion: 'Verde formal',
      estilo: {
        colorCinta: '#166534',
        colorFondo: '#ffffff',
        colorAcento: '#16a34a',
        fuente: 'Helvetica',
        orientacion: 'vertical'
      }
    }
  };

  /* Estado de sesión: si el usuario ya introdujo el PIN en esta sesión */
  let pinVerificadoEnSesion = false;

  /* Timer para el debounce de la vista previa */
  let timerVistaPrevia = null;

  function OST() { return window.OSTIKEC; }

  /* ============================================================
     FILTRO COMBINADO
     ============================================================ */
  function leerFiltro() {
    return Object.assign(
      {
        rango: 'todo',
        desde: '',
        hasta: '',
        negocioId: '',
        nombre: '',
        soloNoUsados: false
      },
      OST().leerJSON(CLAVE_FILTRO, {})
    );
  }

  function guardarFiltro(filtro) {
    OST().guardarJSON(CLAVE_FILTRO, filtro);
  }

  function parsearFechaDDMMAA(texto, finDelDia) {
    if (!texto) return null;
    const limpio = String(texto).trim();
    const partes = limpio.split('/');
    if (partes.length !== 3) return null;

    const dia  = parseInt(partes[0], 10);
    const mes  = parseInt(partes[1], 10) - 1;
    let anio   = parseInt(partes[2], 10);

    if (isNaN(dia) || isNaN(mes) || isNaN(anio)) return null;
    if (anio < 100) anio += 2000;
    if (mes < 0 || mes > 11 || dia < 1 || dia > 31) return null;

    const fecha = new Date(anio, mes, dia);
    if (fecha.getFullYear() !== anio ||
        fecha.getMonth() !== mes ||
        fecha.getDate() !== dia) return null;

    if (finDelDia) fecha.setHours(23, 59, 59, 999);
    else fecha.setHours(0, 0, 0, 0);

    return fecha.getTime();
  }

  function rangoDeFechas(filtro) {
    const ahora = Date.now();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    switch (filtro.rango) {
      case 'hoy': {
        const fin = new Date(hoy);
        fin.setHours(23, 59, 59, 999);
        return { desde: hoy.getTime(), hasta: fin.getTime() };
      }
      case 'semana': {
        const diaSemana = hoy.getDay();
        const diasDesdeLunes = (diaSemana + 6) % 7;
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - diasDesdeLunes);
        lunes.setHours(0, 0, 0, 0);
        return { desde: lunes.getTime(), hasta: ahora };
      }
      case 'mes': {
        const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        primero.setHours(0, 0, 0, 0);
        return { desde: primero.getTime(), hasta: ahora };
      }
      case 'personalizado': {
        const desde = parsearFechaDDMMAA(filtro.desde, false);
        const hasta = parsearFechaDDMMAA(filtro.hasta, true);
        if (desde === null || hasta === null || desde > hasta) return null;
        return { desde: desde, hasta: hasta };
      }
      case 'todo':
      default:
        return null;
    }
  }

  function crearPredicadoFiltro() {
    const filtro = leerFiltro();
    const rango = rangoDeFechas(filtro);
    const nombreBuscado = (filtro.nombre || '').trim().toLowerCase();

    return function (h) {
      if (rango) {
        if (!h.fecha) return false;
        const t = new Date(h.fecha).getTime();
        if (t < rango.desde || t > rango.hasta) return false;
      }
      if (filtro.negocioId && h.negId !== filtro.negocioId) return false;
      if (nombreBuscado) {
        const nombreTicket = String(h.n || '').toLowerCase();
        if (nombreTicket.indexOf(nombreBuscado) === -1) return false;
      }
      if (filtro.soloNoUsados && h.usado === true) return false;
      return true;
    };
  }

  function historialFiltrado() {
    const historial = OST().leerHistorial();
    const pasa = crearPredicadoFiltro();
    return historial.filter(pasa);
  }

  function historialFiltradoConIndices() {
    const historial = OST().leerHistorial();
    const pasa = crearPredicadoFiltro();
    const resultado = [];
    historial.forEach(function (h, i) {
      if (pasa(h)) resultado.push({ indice: i, item: h });
    });
    return resultado;
  }

  /* ============================================================
     INYECCIÓN DE CONTROLES DE FILTRO
     ============================================================ */
  function inyectarSelectorFiltro() {
    const secciones = document.querySelectorAll('.panel-seccion[data-seccion="historial"]');
    if (secciones.length === 0) return;

    const filtro = leerFiltro();
    const negocios = OST().leerNegocios();

    secciones.forEach(function (seccion) {
      if (seccion.querySelector('.filtro-rango')) return;

      const cuerpo = seccion.querySelector('.panel-seccion-cuerpo');
      if (!cuerpo) return;

      const opcionesNegocio = negocios.map(function (n) {
        return '<option value="' + n.id + '"' +
          (n.id === filtro.negocioId ? ' selected' : '') + '>' +
          (n.nombre || '(Sin nombre)') + '</option>';
      }).join('');

      const htmlFiltro =
        '<div class="filtro-rango">' +
          '<label class="filtro-rango-label">Filtrar por fecha de emisión</label>' +
          '<select class="filtro-rango-select" id="selFiltroRango">' +
            RANGOS.map(function (r) {
              return '<option value="' + r.valor + '"' +
                (r.valor === filtro.rango ? ' selected' : '') + '>' +
                r.etiqueta + '</option>';
            }).join('') +
          '</select>' +
          '<div class="filtro-rango-fechas' +
            (filtro.rango === 'personalizado' ? ' visible' : '') +
            '" id="filtroRangoFechas">' +
            '<input type="text" id="inpFiltroDesde" placeholder="Desde DD/MM/AA" maxlength="8" value="' +
              (filtro.desde || '') + '">' +
            '<input type="text" id="inpFiltroHasta" placeholder="Hasta DD/MM/AA" maxlength="8" value="' +
              (filtro.hasta || '') + '">' +
          '</div>' +

          '<div class="filtro-extra-campo" style="margin-top:10px;">' +
            '<label class="filtro-rango-label">Filtrar por negocio</label>' +
            '<select class="filtro-rango-select" id="selFiltroNegocio">' +
              '<option value="">Todos los negocios</option>' +
              opcionesNegocio +
            '</select>' +
          '</div>' +

          '<div class="filtro-extra-campo">' +
            '<label class="filtro-rango-label">Buscar por nombre</label>' +
            '<input type="text" class="filtro-rango-input" id="inpFiltroNombre" ' +
              'placeholder="Ej. Juan" maxlength="40" value="' +
              (filtro.nombre || '').replace(/"/g, '&quot;') + '">' +
          '</div>' +

          '<label class="filtro-extra-check">' +
            '<input type="checkbox" id="chkSoloNoUsados"' +
              (filtro.soloNoUsados ? ' checked' : '') + '>' +
            'Solo tickets no usados' +
          '</label>' +

          '<div class="filtro-rango-info" id="filtroInfo"></div>' +
        '</div>';

      cuerpo.insertAdjacentHTML('afterbegin', htmlFiltro);

      const selRango = document.getElementById('selFiltroRango');
      const selNegocio = document.getElementById('selFiltroNegocio');
      const inpNombre = document.getElementById('inpFiltroNombre');
      const chkNoUsados = document.getElementById('chkSoloNoUsados');
      const divFechas = document.getElementById('filtroRangoFechas');
      const inpDesde = document.getElementById('inpFiltroDesde');
      const inpHasta = document.getElementById('inpFiltroHasta');

      if (selRango) {
        selRango.addEventListener('change', function () {
          const f = leerFiltro();
          f.rango = this.value;
          guardarFiltro(f);
          if (divFechas) divFechas.classList.toggle('visible', this.value === 'personalizado');
          actualizarInfo();
          actualizarListaVisual();
        });
      }

      if (selNegocio) {
        selNegocio.addEventListener('change', function () {
          const f = leerFiltro();
          f.negocioId = this.value;
          guardarFiltro(f);
          actualizarInfo();
          actualizarListaVisual();
        });
      }

      if (inpNombre) {
        inpNombre.addEventListener('input', function () {
          const f = leerFiltro();
          f.nombre = this.value;
          guardarFiltro(f);
          actualizarInfo();
          actualizarListaVisual();
        });
      }

      if (chkNoUsados) {
        chkNoUsados.addEventListener('change', function () {
          const f = leerFiltro();
          f.soloNoUsados = this.checked;
          guardarFiltro(f);
          actualizarInfo();
          actualizarListaVisual();
        });
      }

      [inpDesde, inpHasta].forEach(function (inp) {
        if (!inp) return;
        inp.addEventListener('input', function () {
          let v = this.value.replace(/\D/g, '').substring(0, 6);
          if (v.length > 2) v = v.substring(0, 2) + '/' + v.substring(2);
          if (v.length > 5) v = v.substring(0, 5) + '/' + v.substring(5);
          this.value = v;

          const f = leerFiltro();
          if (inp.id === 'inpFiltroDesde') f.desde = v;
          else f.hasta = v;
          guardarFiltro(f);

          actualizarInfo();
          actualizarListaVisual();
        });
      });

      actualizarInfo();
    });
  }

  function actualizarInfo() {
    const info = document.getElementById('filtroInfo');
    if (!info) return;

    const filtro = leerFiltro();
    const activos = [];

    if (filtro.rango && filtro.rango !== 'todo') {
      if (filtro.rango === 'personalizado') {
        const desde = filtro.desde ? parsearFechaDDMMAA(filtro.desde, false) : null;
        const hasta = filtro.hasta ? parsearFechaDDMMAA(filtro.hasta, true) : null;
        if (!desde || !hasta) {
          info.textContent = 'Complete ambas fechas en formato DD/MM/AA para aplicar el filtro.';
          return;
        }
        if (desde > hasta) {
          info.textContent = 'La fecha "desde" no puede ser posterior a la fecha "hasta".';
          return;
        }
      }
      const etiquetaRango = RANGOS.find(r => r.valor === filtro.rango);
      activos.push('Fecha: ' + (etiquetaRango ? etiquetaRango.etiqueta : filtro.rango));
    }

    if (filtro.negocioId) {
      const neg = OST().leerNegocios().find(n => n.id === filtro.negocioId);
      activos.push('Negocio: ' + (neg ? neg.nombre : 'desconocido'));
    }

    if (filtro.nombre && filtro.nombre.trim()) {
      activos.push('Nombre contiene "' + filtro.nombre.trim() + '"');
    }

    if (filtro.soloNoUsados) {
      activos.push('Solo no usados');
    }

    const total = historialFiltrado().length;

    if (activos.length === 0) {
      info.textContent = 'Se incluirán todos los tickets del historial (' + total + ').';
      return;
    }

    info.textContent = 'Filtros activos — ' + activos.join(' · ') +
      ' (' + total + ' ticket' + (total === 1 ? '' : 's') + ' coinciden).';
  }

  /* ============================================================
     INTERCEPTOR DE LOS BOTONES DE EXPORTACIÓN
     ============================================================ */
  function instalarInterceptorExportacion() {
    const btnPDF = document.getElementById('btnExportarPDF');
    const btnXLS = document.getElementById('btnExportarExcel');

    if (btnPDF && btnPDF.dataset.filtroInstalado !== '1') {
      const clon = btnPDF.cloneNode(true);
      clon.dataset.filtroInstalado = '1';
      btnPDF.parentNode.replaceChild(clon, btnPDF);
      clon.addEventListener('click', function () { exportarConFiltro('pdf'); });
    }

    if (btnXLS && btnXLS.dataset.filtroInstalado !== '1') {
      const clon = btnXLS.cloneNode(true);
      clon.dataset.filtroInstalado = '1';
      btnXLS.parentNode.replaceChild(clon, btnXLS);
      clon.addEventListener('click', function () { exportarConFiltro('excel'); });
    }
  }

  function exportarConFiltro(tipo) {
    const historial = historialFiltrado();
    if (historial.length === 0) {
      alert('No hay tickets que coincidan con los filtros activos.');
      return;
    }
    if (tipo === 'pdf') exportarFiltradoPDF(historial);
    else exportarFiltradoExcel(historial);
  }

  function calcularEtiquetaFiltros() {
    const filtro = leerFiltro();
    const partes = [];

    const rango = rangoDeFechas(filtro);
    if (rango) {
      const desde = new Date(rango.desde).toLocaleDateString('es-ES');
      const hasta = new Date(rango.hasta).toLocaleDateString('es-ES');
      partes.push('Fecha: ' + desde + ' → ' + hasta);
    } else {
      partes.push('Fecha: Todo el historial');
    }

    if (filtro.negocioId) {
      const neg = OST().leerNegocios().find(n => n.id === filtro.negocioId);
      partes.push('Negocio: ' + (neg ? neg.nombre : 'desconocido'));
    }

    if (filtro.nombre && filtro.nombre.trim()) {
      partes.push('Nombre contiene: ' + filtro.nombre.trim());
    }

    if (filtro.soloNoUsados) {
      partes.push('Solo no usados');
    }

    return partes.join(' · ');
  }

  function exportarFiltradoPDF(historial) {
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
      alert('La librería PDF no está disponible.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFillColor(22, 50, 79);
    doc.rect(0, 0, 210, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('OSTIKEC', 14, 13);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Historial de tickets generados', 14, 20);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(8);
    doc.text('Fecha de exportación: ' + OST().fechaHoraExportacionLocal(), 14, 41);

    const etiquetaFiltros = calcularEtiquetaFiltros();
    const lineasFiltros = doc.splitTextToSize('Filtros: ' + etiquetaFiltros, 180);
    doc.text(lineasFiltros, 14, 46);

    const yTotal = 46 + lineasFiltros.length * 4;
    doc.text('Total de tickets: ' + historial.length, 14, yTotal + 2);

    const startY = yTotal + 10;
    const rowH = 7;
    const cols = [
      { x: 14,  label: 'No. Ticket'      },
      { x: 32,  label: 'Fecha Servicio'  },
      { x: 54,  label: 'Nombre'          },
      { x: 90,  label: 'Teléfono'        },
      { x: 112, label: 'Campo 4'         },
      { x: 132, label: 'Campo 5'         },
      { x: 152, label: 'Negocio'         },
      { x: 178, label: 'Emitido por'     }
    ];

    doc.setFillColor(240, 244, 248);
    doc.rect(10, startY - 5, 190, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(22, 50, 79);
    cols.forEach(c => doc.text(c.label, c.x, startY));

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(7);

    const negocios = OST().leerNegocios();
    let y = startY + rowH;
    const pageH = 280;

    historial.forEach(function (h) {
      if (y > pageH) { doc.addPage(); y = 20; }
      const neg = h.negId
        ? (negocios.find(n => n.id === h.negId) || {}).nombre || '—'
        : '—';
      const nombreMostrar = (h.usado ? '✓ ' : '') + (h.n || '');
      const fila = [
        h.no || '', h.f || '', nombreMostrar, h.t || '',
        h.a  || '', h.i || '', neg,           h.e || ''
      ];
      const limites = [10, 14, 20, 12, 12, 12, 16, 14];
      fila.forEach(function (valor, j) {
        doc.text(String(valor).substring(0, limites[j]), cols[j].x, y);
      });
      doc.setDrawColor(230, 230, 230);
      doc.line(10, y + 2, 200, y + 2);
      y += rowH;
    });

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('OSTIKEC © OSTICOR 2026 — Contacto: osmanitito94@zoho.com',
      105, 290, { align: 'center' });

    doc.save('ostikec_historial_' + Date.now() + '.pdf');
  }

  function exportarFiltradoExcel(historial) {
    if (typeof window.XLSX === 'undefined') {
      alert('La librería Excel no está disponible.');
      return;
    }

    const filas = [];
    filas.push(['OSTIKEC — Historial de tickets generados']);
    filas.push(['Fecha de exportación: ' + OST().fechaHoraExportacionLocal()]);
    filas.push(['Filtros: ' + calcularEtiquetaFiltros()]);
    filas.push(['Total de tickets: ' + historial.length]);
    filas.push([]);
    filas.push([
      'No. Ticket', 'Fecha del Servicio', 'Nombre', 'Teléfono',
      'Campo 4', 'Campo 5', 'Negocio', 'Emitido por', 'Usado'
    ]);

    const negocios = OST().leerNegocios();
    historial.forEach(function (h) {
      const neg = h.negId
        ? (negocios.find(n => n.id === h.negId) || {}).nombre || ''
        : '';
      filas.push([
        h.no || '', h.f || '', h.n || '', h.t || '',
        h.a  || '', h.i || '', neg,       h.e || '',
        h.usado ? 'Sí' : 'No'
      ]);
    });

    const ws1 = XLSX.utils.aoa_to_sheet(filas);
    ws1['!cols'] = [
      { wch: 14 }, { wch: 18 }, { wch: 24 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 8 }
    ];

    const resumen = {};
    historial.forEach(function (h) {
      const neg = h.negId
        ? (negocios.find(n => n.id === h.negId) || {}).nombre || 'Sin negocio'
        : 'Sin negocio';
      resumen[neg] = (resumen[neg] || 0) + 1;
    });
    const filasResumen = [['Negocio', 'Tickets']];
    Object.keys(resumen).forEach(k => filasResumen.push([k, resumen[k]]));
    const ws2 = XLSX.utils.aoa_to_sheet(filasResumen);
    ws2['!cols'] = [{ wch: 30 }, { wch: 10 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Historial');
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');
    XLSX.writeFile(wb, 'ostikec_historial_' + Date.now() + '.xlsx');
  }

  /* ============================================================
     ACTUALIZACIÓN DE LA LISTA VISUAL DEL HISTORIAL
     ============================================================ */
  function actualizarListaVisual() {
    const listas = document.querySelectorAll(
      '.panel-seccion[data-seccion="historial"] .panel-historial-lista'
    );
    if (listas.length === 0) return;

    const filtrados = historialFiltradoConIndices();
    const ultimos = filtrados.slice(-8).reverse();

    listas.forEach(function (lista) {
      if (ultimos.length === 0) {
        lista.innerHTML =
          '<div class="panel-historial-vacio">Sin tickets en el rango seleccionado.</div>';
        return;
      }

      lista.innerHTML = ultimos.map(function (entrada) {
        const h = entrada.item;
        const idxReal = entrada.indice;
        const usado = h.usado === true;
        const fechaTxt = h.fecha
          ? new Date(h.fecha).toLocaleString('es-ES',
              { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
          : '';
        return '<div class="panel-historial-item' + (usado ? ' marcado' : '') + '">' +
          '<button type="button" class="h-check' + (usado ? ' activo' : '') +
            '" data-toggle-usado="' + idxReal + '" title="Marcar como usado">✓</button>' +
          '<span class="h-nombre">' + (h.n || '—') + '</span>' +
          '<span class="h-fecha">' + fechaTxt + '</span>' +
          '<button type="button" class="h-btn" data-duplicar-filtrado="' +
            idxReal + '">Duplicar</button>' +
        '</div>';
      }).join('');

      lista.querySelectorAll('[data-toggle-usado]').forEach(function (b) {
        b.addEventListener('click', function () {
          const idx = parseInt(this.dataset.toggleUsado, 10);
          toggleUsado(idx);
        });
      });

      lista.querySelectorAll('[data-duplicar-filtrado]').forEach(function (b) {
        b.addEventListener('click', function () {
          const idx = parseInt(this.dataset.duplicarFiltrado, 10);
          OST().duplicarTicketDelHistorial(idx);
        });
      });
    });
  }

  function toggleUsado(indice) {
    const historial = OST().leerHistorial();
    if (indice < 0 || indice >= historial.length) return;
    historial[indice].usado = !historial[indice].usado;
    OST().guardarHistorial(historial);
    actualizarListaVisual();
    actualizarInfo();
  }

  /* ============================================================
     PLANTILLAS BASE DEL TICKET
     ============================================================ */
  function detectarPlantillaActual() {
    const estilo = OST().obtenerEstiloActual();
    for (const clave in PLANTILLAS) {
      const p = PLANTILLAS[clave].estilo;
      if (estilo.colorCinta === p.colorCinta &&
          estilo.colorFondo === p.colorFondo &&
          estilo.colorAcento === p.colorAcento &&
          estilo.fuente === p.fuente) {
        return clave;
      }
    }
    return null;
  }

  function aplicarPlantilla(clave) {
    const p = PLANTILLAS[clave];
    if (!p) return;
    OST().actualizarEstiloParcial(p.estilo);
    OST().construirContenidoPanel();
    regenerarTicketAhora();
  }

  function inyectarControlesPlantillas() {
    const secciones = document.querySelectorAll('.panel-seccion[data-seccion="estilo"]');
    if (secciones.length === 0) return;

    const actual = detectarPlantillaActual();

    secciones.forEach(function (seccion) {
      if (seccion.querySelector('.plantillas-grid')) return;

      const cuerpo = seccion.querySelector('.panel-seccion-cuerpo');
      if (!cuerpo) return;

      const htmlPlantillas =
        '<label class="panel-label">Plantilla base</label>' +
        '<div class="plantillas-grid">' +
          Object.keys(PLANTILLAS).map(function (clave) {
            const p = PLANTILLAS[clave];
            const activa = (clave === actual) ? ' activa' : '';
            return '<button type="button" class="plantilla-boton' + activa +
              '" data-plantilla="' + clave + '">' +
              '<div class="plantilla-muestra">' +
                '<span style="background:' + p.estilo.colorCinta + '"></span>' +
                '<span style="background:' + p.estilo.colorAcento + '"></span>' +
                '<span style="background:' + p.estilo.colorFondo +
                  '; border:1px solid #e2e8f0;"></span>' +
              '</div>' +
              '<div class="plantilla-nombre">' + p.nombre + '</div>' +
              '<div class="plantilla-desc">' + p.descripcion + '</div>' +
            '</button>';
          }).join('') +
        '</div>';

      cuerpo.insertAdjacentHTML('afterbegin', htmlPlantillas);

      cuerpo.querySelectorAll('[data-plantilla]').forEach(function (b) {
        b.addEventListener('click', function () {
          aplicarPlantilla(this.dataset.plantilla);
        });
      });
    });
  }

  /* ============================================================
     BLOQUE DE FIRMA
     ============================================================ */
  function leerFirmaConfig() {
    return Object.assign(
      { activa: false, texto: 'Firma' },
      OST().leerJSON(CLAVE_FIRMA, {})
    );
  }

  function guardarFirmaConfig(cfg) {
    OST().guardarJSON(CLAVE_FIRMA, cfg);
  }

  function inyectarControlesFirma() {
    const secciones = document.querySelectorAll('.panel-seccion[data-seccion="estilo"]');
    if (secciones.length === 0) return;

    const firma = leerFirmaConfig();

    secciones.forEach(function (seccion) {
      if (seccion.querySelector('.firma-config')) return;

      const cuerpo = seccion.querySelector('.panel-seccion-cuerpo');
      if (!cuerpo) return;

      const botonAplicar = cuerpo.querySelector('#btnAplicarEstilo');
      const filaDestino = botonAplicar ? botonAplicar.closest('.panel-fila') : null;

      const htmlFirma =
        '<div class="firma-config">' +
          '<label class="panel-switch">Bloque de firma al pie del ticket ' +
            '<input type="checkbox" id="chkFirma"' +
              (firma.activa ? ' checked' : '') + '></label>' +
          '<label class="panel-label" style="margin-top:8px;">Texto de la firma</label>' +
          '<input type="text" id="inpFirmaTexto" maxlength="20" value="' +
            (firma.texto || 'Firma').replace(/"/g, '&quot;') +
            '" placeholder="Ej. Firma / Sello">' +
        '</div>';

      if (filaDestino) {
        filaDestino.insertAdjacentHTML('beforebegin', htmlFirma);
      } else {
        cuerpo.insertAdjacentHTML('beforeend', htmlFirma);
      }

      const chk = document.getElementById('chkFirma');
      const inp = document.getElementById('inpFirmaTexto');

      if (chk) {
        chk.addEventListener('change', function () {
          const cfg = leerFirmaConfig();
          cfg.activa = this.checked;
          guardarFirmaConfig(cfg);
          regenerarTicketAhora();
          programarRedibujoVistaPrevia();
        });
      }

      if (inp) {
        inp.addEventListener('input', function () {
          const cfg = leerFirmaConfig();
          cfg.texto = this.value || 'Firma';
          guardarFirmaConfig(cfg);
          regenerarTicketAhora();
          programarRedibujoVistaPrevia();
        });
      }
    });
  }

  function regenerarTicketAhora() {
    const zona = document.getElementById('zonaResultado');
    if (!zona || zona.classList.contains('oculto')) return;

    const datos = {
      f: (document.getElementById('inFecha') || {}).value ? document.getElementById('inFecha').value.trim() : '',
      n: (document.getElementById('inNombre') || {}).value ? document.getElementById('inNombre').value.trim() : '',
      t: (document.getElementById('inTelefono') || {}).value ? document.getElementById('inTelefono').value.trim() : '',
      a: (document.getElementById('inAsiento') || {}).value ? document.getElementById('inAsiento').value.trim() : '',
      i: (document.getElementById('inIdServicio') || {}).value ? document.getElementById('inIdServicio').value.trim() : ''
    };
    if (!datos.f || !datos.n || !datos.t || !datos.a || !datos.i) return;

    try {
      const textoQR = window.construirContenidoQR(datos);
      window.dibujarTicket(datos, textoQR);
    } catch (e) {}
  }

  /* Programa un redibujo de la vista previa con debounce */
  function programarRedibujoVistaPrevia() {
    if (timerVistaPrevia) clearTimeout(timerVistaPrevia);
    timerVistaPrevia = setTimeout(dibujarVistaPrevia, 80);
  }

  /* ============================================================
     EXTENSIÓN DE dibujarTicket — Bloque de firma
     ============================================================ */
  function instalarWrapperFirma() {
    if (typeof window.dibujarTicket !== 'function') return;
    if (window.dibujarTicket.__ostikecFirmaInstalada) return;

    const original = window.dibujarTicket;

    const wrapper = function (datos, textoQR) {
      original.call(this, datos, textoQR);

      const firma = leerFirmaConfig();
      if (!firma.activa) return;

      const cv = document.getElementById('canvasTicket');
      if (!cv) return;

      const estilo = OST().obtenerEstiloActual();
      const colorMarco = estilo.colorCinta || '#16324f';
      const W = cv.width;
      const H = cv.height;

      const ALTURA_FIRMA = 100;
      const ALTURA_MARCO = 12;
      const GROSOR_MARCO = 6;

      const nuevoH = H + ALTURA_FIRMA;

      const cvTemp = document.createElement('canvas');
      cvTemp.width = W;
      cvTemp.height = nuevoH;
      const ctx = cvTemp.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, nuevoH);
      ctx.drawImage(cv, 0, 0);

      ctx.fillStyle = estilo.colorFondo || '#ffffff';
      ctx.fillRect(ALTURA_MARCO + GROSOR_MARCO / 2,
                   H - ALTURA_MARCO - 1,
                   W - 2 * (ALTURA_MARCO + GROSOR_MARCO / 2),
                   ALTURA_MARCO + 1);

      ctx.strokeStyle = colorMarco;
      ctx.lineWidth = GROSOR_MARCO;
      ctx.beginPath();
      ctx.moveTo(ALTURA_MARCO, H - ALTURA_MARCO);
      ctx.lineTo(ALTURA_MARCO, nuevoH - ALTURA_MARCO);
      ctx.moveTo(W - ALTURA_MARCO, H - ALTURA_MARCO);
      ctx.lineTo(W - ALTURA_MARCO, nuevoH - ALTURA_MARCO);
      ctx.stroke();

      const margenFirma = 90;
      const yLinea = H + ALTURA_FIRMA / 2 + 8;

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(margenFirma, yLinea);
      ctx.lineTo(W - margenFirma, yLinea);
      ctx.stroke();

      const textoFirma = (firma.texto || 'Firma').toUpperCase();
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 14px ' + (estilo.fuente || 'Arial') + ', sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(textoFirma, W / 2, yLinea - 6);

      ctx.strokeStyle = colorMarco;
      ctx.lineWidth = GROSOR_MARCO;
      ctx.beginPath();
      ctx.moveTo(ALTURA_MARCO, nuevoH - ALTURA_MARCO);
      ctx.lineTo(W - ALTURA_MARCO, nuevoH - ALTURA_MARCO);
      ctx.stroke();

      cv.width = W;
      cv.height = nuevoH;
      cv.getContext('2d').drawImage(cvTemp, 0, 0);
    };

    wrapper.__ostikecFirmaInstalada = true;
    window.dibujarTicket = wrapper;
  }

  /* ============================================================
     REINICIO DE NUMERACIÓN
     ============================================================ */
  function leerConfigReinicio() {
    return Object.assign(
      { modo: 'nunca', ultimoReinicio: 0 },
      OST().leerJSON(CLAVE_REINICIO, {})
    );
  }

  function guardarConfigReinicio(cfg) {
    OST().guardarJSON(CLAVE_REINICIO, cfg);
  }

  function inyectarControlesReinicio() {
    const secciones = document.querySelectorAll('.panel-seccion[data-seccion="campos"]');
    if (secciones.length === 0) return;

    const config = leerConfigReinicio();

    secciones.forEach(function (seccion) {
      if (seccion.querySelector('.numeracion-reinicio-config')) return;

      const cuerpo = seccion.querySelector('.panel-seccion-cuerpo');
      if (!cuerpo) return;

      const htmlReinicio =
        '<div class="numeracion-reinicio-config">' +
          '<label class="panel-label">Reiniciar numeración</label>' +
          '<select class="panel-select" id="selReinicioNumeracion">' +
            MODOS_REINICIO.map(function (m) {
              return '<option value="' + m.valor + '"' +
                (m.valor === config.modo ? ' selected' : '') + '>' +
                m.etiqueta + '</option>';
            }).join('') +
          '</select>' +
          '<p class="numeracion-reinicio-hint">' +
            'El contador se reiniciará automáticamente al empezar el próximo periodo. ' +
            'Afecta solo al negocio activo.' +
          '</p>' +
        '</div>';

      cuerpo.insertAdjacentHTML('beforeend', htmlReinicio);

      const sel = document.getElementById('selReinicioNumeracion');
      if (sel) {
        sel.addEventListener('change', function () {
          const cfg = leerConfigReinicio();
          cfg.modo = this.value;
          if (this.value !== 'nunca' && !cfg.ultimoReinicio) {
            cfg.ultimoReinicio = Date.now();
          }
          guardarConfigReinicio(cfg);
        });
      }
    });
  }

  /* ============================================================
     BANNER DE RESPALDO MENSUAL
     ============================================================ */
  function leerUltimoRespaldo() {
    const v = OST().leerJSON(CLAVE_RESPALDO, null);
    if (typeof v === 'number' && v > 0) return v;
    return null;
  }

  function guardarUltimoRespaldo() {
    OST().guardarJSON(CLAVE_RESPALDO, Date.now());
  }

  function diasDesdeUltimoRespaldo() {
    const ultimo = leerUltimoRespaldo();
    if (!ultimo) return null;
    const diff = Date.now() - ultimo;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  function exportarRespaldoCompleto() {
    try {
      const paquete = {
        firma: 'OSTIKEC_CONFIG',
        version: 2,
        fecha: new Date().toISOString(),
        negocios: OST().leerNegocios(),
        negocioActivo: OST().leerActivoId(),
        etiquetas: OST().leerMapaEtiquetas(),
        estilos: OST().leerMapaEstilos(),
        historial: OST().leerHistorial(),
        numeracion: OST().leerMapaNumeracion(),
        seguridad: OST().leerSeguridad(),
        apariencia: OST().leerApariencia(),
        campos: OST().leerCamposConfig()
      };
      const json = JSON.stringify(paquete, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const fecha = new Date();
      const dos = n => String(n).padStart(2, '0');
      const nombreArchivo = 'ostikec_respaldo_'
        + fecha.getFullYear() + dos(fecha.getMonth() + 1) + dos(fecha.getDate())
        + '_' + dos(fecha.getHours()) + dos(fecha.getMinutes()) + '.json';

      try {
        const archivo = new File([blob], nombreArchivo, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
          navigator.share({ files: [archivo], title: 'Respaldo Ostikec' })
            .catch(function () { descargarRespaldoDirecto(blob, nombreArchivo); });
          return;
        }
      } catch (e) {}

      descargarRespaldoDirecto(blob, nombreArchivo);
    } catch (e) {
      alert('No se pudo generar el respaldo: ' + e.message);
    }
  }

  function descargarRespaldoDirecto(blob, nombreArchivo) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function inyectarBannerRespaldo() {
    if (document.getElementById('bannerRespaldo')) return;

    const pantallaCreador = document.getElementById('pantallaCreador');
    if (!pantallaCreador) return;

    const dias = diasDesdeUltimoRespaldo();
    if (dias === null || dias < DIAS_RESPALDO) {
      if (dias === null) guardarUltimoRespaldo();
      return;
    }

    const barraSuperior = pantallaCreador.querySelector('.barra-superior');
    const main = pantallaCreador.querySelector('main');
    if (!barraSuperior || !main) return;

    const banner = document.createElement('div');
    banner.id = 'bannerRespaldo';
    banner.className = 'banner-respaldo';
    banner.innerHTML =
      '<div class="banner-respaldo-texto">' +
        'Han pasado <b>' + dias + ' días</b> desde su último respaldo. ' +
        'Le recomendamos hacer uno.' +
      '</div>' +
      '<div class="banner-respaldo-botones">' +
        '<button type="button" class="banner-respaldo-btn banner-respaldo-btn-primario" id="btnBannerRespaldoAhora">' +
          'Hacer respaldo' +
        '</button>' +
        '<button type="button" class="banner-respaldo-btn banner-respaldo-btn-secundario" id="btnBannerRespaldoLuego">' +
          'Más tarde' +
        '</button>' +
      '</div>' +
      '<button type="button" class="banner-respaldo-cerrar" id="btnBannerRespaldoNoRecordar">' +
        'No volver a recordar' +
      '</button>';

    barraSuperior.parentNode.insertBefore(banner, main);

    document.getElementById('btnBannerRespaldoAhora').addEventListener('click', function () {
      exportarRespaldoCompleto();
      guardarUltimoRespaldo();
      setTimeout(function () {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
      }, 150);
    });

    document.getElementById('btnBannerRespaldoLuego').addEventListener('click', function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    });

    document.getElementById('btnBannerRespaldoNoRecordar').addEventListener('click', function () {
      OST().guardarJSON(CLAVE_RESPALDO, Date.now() + (100 * 365 * 24 * 60 * 60 * 1000));
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    });
  }

  /* ============================================================
     PIN DEL PANEL
     ============================================================ */
  function leerConfigPin() {
    return Object.assign(
      { activo: false, hash: '' },
      OST().leerJSON(CLAVE_PIN_CONFIG, {})
    );
  }

  function guardarConfigPin(cfg) {
    OST().guardarJSON(CLAVE_PIN_CONFIG, cfg);
  }

  function leerIntentosPin() {
    return Object.assign(
      { fallos: 0, bloqueadoHasta: 0 },
      OST().leerJSON(CLAVE_PIN_INTENTOS, {})
    );
  }

  function guardarIntentosPin(cfg) {
    OST().guardarJSON(CLAVE_PIN_INTENTOS, cfg);
  }

  function resetearIntentosPin() {
    guardarIntentosPin({ fallos: 0, bloqueadoHasta: 0 });
  }

  /* Intercepta el botón flotante para pedir PIN antes de abrir el panel */
  function interceptarBotonFlotante() {
    const btn = document.getElementById('btnFlotanteMenu');
    if (!btn) return;
    if (btn.dataset.pinInterceptado === '1') return;

    const clon = btn.cloneNode(true);
    clon.dataset.pinInterceptado = '1';
    btn.parentNode.replaceChild(clon, btn);

    clon.addEventListener('click', function (e) {
      e.stopPropagation();
      const cfg = leerConfigPin();

      /* Si no hay PIN configurado o está desactivado, abrir directamente */
      if (!cfg.activo || !cfg.hash) {
        OST().abrirPanelFlotante();
        return;
      }

      /* Si ya se verificó en esta sesión, abrir directamente */
      if (pinVerificadoEnSesion) {
        OST().abrirPanelFlotante();
        return;
      }

      /* Comprobar si está bloqueado */
      const int = leerIntentosPin();
      if (int.bloqueadoHasta > Date.now()) {
        mostrarModalPin(true);
        return;
      }

      mostrarModalPin(false);
    });
  }

  /* Crea el modal de PIN si no existe */
  function crearModalPin() {
    if (document.getElementById('modalPin')) return;

    const modal = document.createElement('div');
    modal.id = 'modalPin';
    modal.className = 'modal';
    modal.innerHTML =
      '<div class="modal-caja">' +
        '<div class="modal-cabecera">' +
          '<h3>Acceso al panel</h3>' +
        '</div>' +
        '<div class="modal-cuerpo">' +
          '<p class="pin-modal-texto">Introduce el PIN para acceder a las opciones.</p>' +
          '<input type="tel" id="inpPinModal" class="pin-modal-input" ' +
            'inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off">' +
          '<div id="pinModalMensaje" class="pin-modal-error"></div>' +
          '<div class="acciones" style="margin-top:16px;">' +
            '<button id="btnPinCancelar" type="button" class="btn btn-secundario">Cancelar</button>' +
            '<button id="btnPinAceptar" type="button" class="btn btn-acento">Aceptar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    const inp = document.getElementById('inpPinModal');

    inp.addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '').substring(0, PIN_LONGITUD);
      if (v !== this.value) this.value = v;
    });

    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        intentarVerificarPin();
      }
    });

    document.getElementById('btnPinCancelar').addEventListener('click', function () {
      modal.classList.remove('visible');
    });

    document.getElementById('btnPinAceptar').addEventListener('click', intentarVerificarPin);
  }

  /* Abre el modal de PIN. Si está bloqueado, muestra cuenta regresiva */
  function mostrarModalPin(bloqueado) {
    crearModalPin();
    const modal = document.getElementById('modalPin');
    const inp = document.getElementById('inpPinModal');
    const msg = document.getElementById('pinModalMensaje');
    const btnAceptar = document.getElementById('btnPinAceptar');

    inp.value = '';
    msg.textContent = '';
    msg.className = 'pin-modal-error';

    if (bloqueado) {
      const int = leerIntentosPin();
      const segundos = Math.ceil((int.bloqueadoHasta - Date.now()) / 1000);
      const minutos = Math.ceil(segundos / 60);
      msg.className = 'pin-modal-bloqueado';
      msg.textContent = 'Bloqueado. Inténtalo de nuevo en ' + minutos +
        ' minuto' + (minutos === 1 ? '' : 's') + '.';
      inp.disabled = true;
      if (btnAceptar) btnAceptar.disabled = true;

      /* Actualizar la cuenta regresiva hasta que expire el bloqueo */
      const intervalo = setInterval(function () {
        if (!modal.classList.contains('visible')) {
          clearInterval(intervalo);
          return;
        }
        const int2 = leerIntentosPin();
        if (int2.bloqueadoHasta <= Date.now()) {
          clearInterval(intervalo);
          /* Reactivar el modal sin cerrarlo */
          msg.className = 'pin-modal-error';
          msg.textContent = 'Ya puedes intentarlo de nuevo.';
          inp.disabled = false;
          if (btnAceptar) btnAceptar.disabled = false;
          inp.focus();
          return;
        }
        const seg = Math.ceil((int2.bloqueadoHasta - Date.now()) / 1000);
        const min = Math.ceil(seg / 60);
        msg.textContent = 'Bloqueado. Inténtalo de nuevo en ' + min +
          ' minuto' + (min === 1 ? '' : 's') + '.';
      }, 5000);
    } else {
      inp.disabled = false;
      if (btnAceptar) btnAceptar.disabled = false;
    }

    modal.classList.add('visible');
    setTimeout(function () { inp.focus(); }, 100);
  }

  /* Verifica el PIN introducido */
  function intentarVerificarPin() {
    const inp = document.getElementById('inpPinModal');
    const msg = document.getElementById('pinModalMensaje');
    if (!inp || !msg) return;

    const pin = inp.value.trim();

    if (pin.length !== PIN_LONGITUD) {
      msg.className = 'pin-modal-error';
      msg.textContent = 'El PIN debe tener ' + PIN_LONGITUD + ' dígitos.';
      return;
    }

    /* Comprobar primero el PIN maestro derivado del usuario */
    const pinMaestro = OST().calcularPinMaestroActual();
    if (pinMaestro && pin === pinMaestro) {
      resetearIntentosPin();
      pinVerificadoEnSesion = true;
      document.getElementById('modalPin').classList.remove('visible');
      setTimeout(function () { OST().abrirPanelFlotante(); }, 100);
      return;
    }

    /* Comprobar contra el hash guardado */
    const cfg = leerConfigPin();
    const hashIntroducido = OST().sha256Hex(pin);

    if (hashIntroducido === cfg.hash) {
      resetearIntentosPin();
      pinVerificadoEnSesion = true;
      document.getElementById('modalPin').classList.remove('visible');
      setTimeout(function () { OST().abrirPanelFlotante(); }, 100);
      return;
    }

    /* Fallo */
    const int = leerIntentosPin();
    int.fallos = (int.fallos || 0) + 1;

    if (int.fallos >= MAX_INTENTOS_PIN) {
      int.bloqueadoHasta = Date.now() + (MINUTOS_BLOQUEO_PIN * 60 * 1000);
      int.fallos = 0;
      guardarIntentosPin(int);
      /* Reactivar el modal en modo bloqueado sin cerrarlo */
      mostrarModalPin(true);
      return;
    }

    guardarIntentosPin(int);
    const restantes = MAX_INTENTOS_PIN - int.fallos;
    msg.className = 'pin-modal-error';
    msg.textContent = 'PIN incorrecto. Te quedan ' + restantes +
      ' intento' + (restantes === 1 ? '' : 's') + '.';
    inp.value = '';
    inp.focus();
  }

  /* Inyecta los controles del PIN en la sección Seguridad */
  function inyectarControlesPin() {
    const secciones = document.querySelectorAll('.panel-seccion[data-seccion="seguridad"]');
    if (secciones.length === 0) return;

    const cfg = leerConfigPin();

    secciones.forEach(function (seccion) {
      if (seccion.querySelector('.pin-config')) return;

      const cuerpo = seccion.querySelector('.panel-seccion-cuerpo');
      if (!cuerpo) return;

      const htmlPin =
        '<div class="pin-config">' +
          '<label class="panel-label">PIN del panel</label>' +
          '<label class="panel-switch">Activar PIN para abrir el panel ' +
            '<input type="checkbox" id="chkPinActivo"' +
              (cfg.activo ? ' checked' : '') + '></label>' +
          '<label class="panel-label" style="margin-top:8px;">Nuevo PIN (4 dígitos)</label>' +
          '<input type="tel" id="inpPinNuevo" inputmode="numeric" maxlength="4" ' +
            'placeholder="••••" autocomplete="off">' +
          '<label class="panel-label">Confirmar PIN</label>' +
          '<input type="tel" id="inpPinConfirmar" inputmode="numeric" maxlength="4" ' +
            'placeholder="••••" autocomplete="off">' +
          '<div class="panel-fila">' +
            '<button type="button" class="panel-btn panel-btn-primario" id="btnGuardarPin">Guardar PIN</button>' +
            '<button type="button" class="panel-btn panel-btn-peligro" id="btnBorrarPin">Borrar PIN</button>' +
          '</div>' +
          '<p class="pin-config-hint">Si olvidas el PIN, puedes recuperar el acceso usando el PIN maestro.</p>' +
         '<div class="pin-aviso-maestro">' +
            '<b>PIN maestro de recuperación:</b> ' +
              (OST().calcularPinMaestroActual() || '——') + '<br>' +
            'Es único para tu cuenta (teléfono + licencia). Anótalo en un lugar seguro. ' +
            'Sirve para desbloquear el panel si olvidas tu PIN personal.' +
          '</div>' +
        '</div>';

      cuerpo.insertAdjacentHTML('beforeend', htmlPin);

      const inpNuevo = document.getElementById('inpPinNuevo');
      const inpConf = document.getElementById('inpPinConfirmar');

      [inpNuevo, inpConf].forEach(function (inp) {
        if (!inp) return;
        inp.addEventListener('input', function () {
          let v = this.value.replace(/\D/g, '').substring(0, PIN_LONGITUD);
          if (v !== this.value) this.value = v;
        });
      });

      /* Interruptor activar/desactivar PIN */
      const chkActivo = document.getElementById('chkPinActivo');
      if (chkActivo) {
        chkActivo.addEventListener('change', function () {
          const c = leerConfigPin();
          if (this.checked && !c.hash) {
            alert('Primero debes configurar un PIN con el botón "Guardar PIN".');
            this.checked = false;
            return;
          }
          c.activo = this.checked;
          guardarConfigPin(c);
          pinVerificadoEnSesion = false;
        });
      }

      /* Botón guardar PIN */
      const btnGuardar = document.getElementById('btnGuardarPin');
      if (btnGuardar) {
        btnGuardar.addEventListener('click', function () {
          const nuevo = (document.getElementById('inpPinNuevo') || {}).value || '';
          const conf  = (document.getElementById('inpPinConfirmar') || {}).value || '';

          if (nuevo.length !== PIN_LONGITUD) {
            alert('El PIN debe tener exactamente ' + PIN_LONGITUD + ' dígitos.');
            return;
          }
          if (nuevo !== conf) {
            alert('Los dos PIN no coinciden.');
            return;
          }
          const pinMaestro = OST().calcularPinMaestroActual();
          if (pinMaestro && nuevo === pinMaestro) {
            alert('Ese PIN coincide con tu PIN maestro de recuperación. Elige uno distinto.');
            return;
          }

          const c = leerConfigPin();
          c.hash = OST().sha256Hex(nuevo);
          c.activo = true;
          guardarConfigPin(c);
          resetearIntentosPin();
          pinVerificadoEnSesion = false;

          document.getElementById('inpPinNuevo').value = '';
          document.getElementById('inpPinConfirmar').value = '';

          OST().construirContenidoPanel();
          alert('PIN configurado correctamente.');
        });
      }

      /* Botón borrar PIN */
      const btnBorrar = document.getElementById('btnBorrarPin');
      if (btnBorrar) {
        btnBorrar.addEventListener('click', function () {
          if (!confirm('¿Borrar el PIN configurado? El panel quedará sin protección.')) return;
          guardarConfigPin({ activo: false, hash: '' });
          resetearIntentosPin();
          pinVerificadoEnSesion = false;
          OST().construirContenidoPanel();
        });
      }
    });
  }

  /* ============================================================
     VISTA PREVIA MINI DEL TICKET
     ============================================================ */
  function inyectarVistaPrevia() {
    const secciones = document.querySelectorAll('.panel-seccion[data-seccion="estilo"]');
    if (secciones.length === 0) return;

    secciones.forEach(function (seccion) {
      if (seccion.querySelector('.vista-previa-contenedor')) return;

      const cuerpo = seccion.querySelector('.panel-seccion-cuerpo');
      if (!cuerpo) return;

      const htmlVistaPrevia =
        '<div class="vista-previa-contenedor">' +
          '<label class="panel-label">Vista previa</label>' +
          '<div class="vista-previa-wrap">' +
            '<canvas id="vistaPreviaTicket"></canvas>' +
          '</div>' +
        '</div>';

      cuerpo.insertAdjacentHTML('afterbegin', htmlVistaPrevia);
    });

    dibujarVistaPrevia();
  }

  function dibujarVistaPrevia() {
    const cv = document.getElementById('vistaPreviaTicket');
    if (!cv) return;

    const estilo = OST().obtenerEstiloActual();
    const fuente = estilo.fuente || 'Arial';
    const esHorizontal = estilo.orientacion === 'horizontal';

    const W = esHorizontal ? 200 : 130;
    const H = esHorizontal ? 130 : 200;

    cv.width = W;
    cv.height = H;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';

    const ctx = cv.getContext('2d');

    /* Fondo y marco */
    ctx.fillStyle = estilo.colorFondo;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = estilo.colorCinta;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    /* Encabezado */
    const alturaEnc = esHorizontal ? 22 : 28;
    ctx.fillStyle = estilo.colorCinta;
    ctx.fillRect(2.5, 2.5, W - 5, alturaEnc);

    /* Logo OT */
    if (estilo.mostrarLogo) {
      const cx = esHorizontal ? 12 : 11;
      const cy = 2.5 + alturaEnc / 2;
      const r = alturaEnc / 2.6;

      ctx.beginPath();
      if (estilo.formaLogo === 'cuadrado') {
        ctx.rect(cx - r, cy - r, r * 2, r * 2);
      } else if (estilo.formaLogo === 'hexagono') {
        for (let i = 0; i < 6; i++) {
          const ang = (Math.PI / 3) * i - Math.PI / 2;
          const px = cx + r * Math.cos(ang);
          const py = cy + r * Math.sin(ang);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      } else {
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = estilo.colorAcento;
      ctx.fill();

      ctx.fillStyle = estilo.colorCinta;
      ctx.font = 'bold ' + Math.round(r * 0.85) + 'px ' + fuente + ', sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('OT', cx, cy + 0.5);
    }

    /* Nombre OSTIKEC y subtítulo */
    const colorTituloEnc = OST().colorDeContraste(estilo.colorCinta);
    const xTitulo = estilo.mostrarLogo ? (esHorizontal ? 22 : 20) : 5;

    ctx.fillStyle = colorTituloEnc;
    ctx.font = 'bold 7px ' + fuente + ', sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('OSTIKEC', xTitulo, 5.5);

    ctx.fillStyle = estilo.colorAcento;
    ctx.font = 'bold 3px ' + fuente + ', sans-serif';
    ctx.fillText('TICKET/SERVICIO/FACTURA', xTitulo, 14);

    /* Nombre del negocio */
    const neg = OST().obtenerNegocioActivo();
    if (neg) {
      ctx.fillStyle = colorTituloEnc;
      ctx.font = 'bold 3.5px ' + fuente + ', sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      const nombreCorto = String(neg.nombre || '').substring(0, 16).toUpperCase();
      ctx.fillText(nombreCorto, W - 4, 4);
    }

    /* Número correlativo */
    const cfgCampos = OST().leerCamposConfig();
    if (cfgCampos.numeracionActiva) {
      ctx.fillStyle = estilo.colorAcento;
      ctx.font = 'bold 4px ' + fuente + ', sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('T-0042', W - 4, 2.5 + alturaEnc - 2);
    }

    /* Cuerpo con datos ficticios */
    const margen = 4;
    const anchoUtil = W - margen * 2;
    let y = 2.5 + alturaEnc + 3;

    function celda(etiqueta, valor, x, yPos, ancho) {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 2.8px ' + fuente + ', sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(etiqueta, x, yPos);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 4.5px ' + fuente + ', sans-serif';
      const valorCorto = String(valor).substring(0, Math.floor(ancho / 2.2));
      ctx.fillText(valorCorto, x, yPos + 3.5);
      return 9.5;
    }

    if (esHorizontal) {
      const anchoIzq = anchoUtil * 0.55;
      let yIzq = y;
      yIzq += celda('NOMBRE', 'Juan Pérez', margen, yIzq, anchoIzq);
      yIzq += celda('FECHA', '15/10/26', margen, yIzq, anchoIzq);
      yIzq += celda('TELÉFONO', '56224466', margen, yIzq, anchoIzq);
      yIzq += celda('ASIENTO', '12', margen, yIzq, anchoIzq);
      yIzq += celda('ID SERVICIO', 'SVC-001', margen, yIzq, anchoIzq);

      const tamQR = Math.min(60, H - 2.5 - alturaEnc - 12);
      const xQR = margen + anchoIzq + 6;
      const yQR = 2.5 + alturaEnc + 4;
      dibujarQRFicticio(ctx, xQR, yQR, tamQR);
    } else {
      y += celda('NOMBRE', 'Juan Pérez', margen, y, anchoUtil);
      y += 1;

      const anchoCol = (anchoUtil - 3) / 2;
      celda('FECHA', '15/10/26', margen, y, anchoCol);
      celda('TELÉFONO', '56224466', margen + anchoCol + 3, y, anchoCol);
      y += 9.5;

      celda('ASIENTO', '12', margen, y, anchoCol);
      celda('ID SERVICIO', 'SVC-001', margen + anchoCol + 3, y, anchoCol);
      y += 9.5;

      if (cfgCampos.activarCorreo) {
        y += celda('CORREO', 'juan@ejemplo.com', margen, y, anchoUtil);
      }

      const tamQR = Math.min(60, H - y - 30);
      const xQR = (W - tamQR) / 2;
      dibujarQRFicticio(ctx, xQR, y + 2, tamQR);
      y += tamQR + 6;

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 2.8px ' + fuente + ', sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('EMITIDO', W / 2 - 1.5, y);

      ctx.fillStyle = estilo.colorCinta;
      ctx.font = 'bold 3.8px ' + fuente + ', sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('15/10/26 14:30', W / 2 + 1.5, y - 1);
    }

    /* Franja de firma si está activa */
    const firma = leerFirmaConfig();
    if (firma.activa && !esHorizontal) {
      const yFirma = H - 18;
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(10, yFirma);
      ctx.lineTo(W - 10, yFirma);
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 2.8px ' + fuente + ', sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText((firma.texto || 'Firma').toUpperCase(), W / 2, yFirma - 2);
    }
  }

  /* Dibuja un QR simulado dentro del canvas pequeño */
  function dibujarQRFicticio(ctx, x, y, tam) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, tam, tam);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, tam, tam);

    ctx.fillStyle = '#1f2937';
    const modulos = 12;
    const lado = tam / modulos;

    for (let f = 0; f < modulos; f++) {
      for (let c = 0; c < modulos; c++) {
        const valor = (f * 7 + c * 3 + f * c + (f ^ c)) % 4;
        if (valor === 0 || valor === 1) {
          ctx.fillRect(x + c * lado, y + f * lado, lado, lado);
        }
      }
    }

    /* Marcadores de posición en las esquinas */
    const tamMarca = Math.floor(tam / 5);

    /* Superior izquierda */
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x, y, tamMarca, tamMarca);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + tamMarca * 0.2, y + tamMarca * 0.2, tamMarca * 0.6, tamMarca * 0.6);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x + tamMarca * 0.35, y + tamMarca * 0.35, tamMarca * 0.3, tamMarca * 0.3);

    /* Superior derecha */
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x + tam - tamMarca, y, tamMarca, tamMarca);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + tam - tamMarca + tamMarca * 0.2, y + tamMarca * 0.2, tamMarca * 0.6, tamMarca * 0.6);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x + tam - tamMarca + tamMarca * 0.35, y + tamMarca * 0.35, tamMarca * 0.3, tamMarca * 0.3);

    /* Inferior izquierda */
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x, y + tam - tamMarca, tamMarca, tamMarca);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + tamMarca * 0.2, y + tam - tamMarca + tamMarca * 0.2, tamMarca * 0.6, tamMarca * 0.6);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x + tamMarca * 0.35, y + tam - tamMarca + tamMarca * 0.35, tamMarca * 0.3, tamMarca * 0.3);
  }

  /* ============================================================
     OBSERVADOR DEL PANEL
     ============================================================ */
  let observerPanel = null;

  function observarPanel() {
    const panelCuerpo = document.getElementById('panelCuerpo');
    if (!panelCuerpo) return;

    if (observerPanel) observerPanel.disconnect();

    observerPanel = new MutationObserver(function () {
      observerPanel.disconnect();
      setTimeout(function () {
        inyectarSelectorFiltro();
        instalarInterceptorExportacion();
        actualizarListaVisual();
        inyectarControlesPlantillas();
        inyectarControlesFirma();
        inyectarControlesReinicio();
        inyectarControlesPin();
        inyectarVistaPrevia();
        observarPanel();
      }, 15);
    });

    observerPanel.observe(panelCuerpo, { childList: true });

    /* Escuchar cambios en los controles del panel para redibujar la vista previa */
    if (!panelCuerpo.dataset.escuchaEstilo) {
      panelCuerpo.dataset.escuchaEstilo = '1';
      ['input', 'change', 'click'].forEach(function (ev) {
        panelCuerpo.addEventListener(ev, function (e) {
          if (!e.target || !e.target.closest) return;
          const seccionEstilo = e.target.closest('.panel-seccion[data-seccion="estilo"]');
          if (!seccionEstilo) return;
          programarRedibujoVistaPrevia();
        }, true);
      });
    }
  }

  /* ============================================================
     ARRANQUE
     ============================================================ */
  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      if (!window.OSTIKEC) {
        console.warn(
          'extras2.js: window.OSTIKEC no está disponible. ' +
          '¿Se cargó extras.js primero?'
        );
        return;
      }

      instalarWrapperFirma();
      setTimeout(intentarInyectarTodo, 200);

      /* Interceptar el botón flotante. Se intenta varias veces por si el
         botón se crea después de que extras2.js arranque. */
      interceptarBotonFlotante();
      setTimeout(interceptarBotonFlotante, 500);
      setTimeout(interceptarBotonFlotante, 1500);

      /* Resetear la verificación del PIN cada vez que se inicia sesión */
      const btnEntrar = document.getElementById('btnEntrar');
      if (btnEntrar) {
        btnEntrar.addEventListener('click', function () {
          pinVerificadoEnSesion = false;
        });
      }

      /* Banner de respaldo */
      setTimeout(inyectarBannerRespaldo, 500);

      setInterval(function () {
        const panelCuerpo = document.getElementById('panelCuerpo');
        if (!panelCuerpo) return;

        const seccionEstilo    = panelCuerpo.querySelector('.panel-seccion[data-seccion="estilo"]');
        const seccionHistorial = panelCuerpo.querySelector('.panel-seccion[data-seccion="historial"]');
        const seccionCampos    = panelCuerpo.querySelector('.panel-seccion[data-seccion="campos"]');
        const seccionSeguridad = panelCuerpo.querySelector('.panel-seccion[data-seccion="seguridad"]');

        if (seccionEstilo && !seccionEstilo.querySelector('.plantillas-grid')) {
          inyectarControlesPlantillas();
        }
        if (seccionEstilo && !seccionEstilo.querySelector('.firma-config')) {
          inyectarControlesFirma();
        }
        if (seccionEstilo && !seccionEstilo.querySelector('.vista-previa-contenedor')) {
          inyectarVistaPrevia();
        }
        if (seccionHistorial && !seccionHistorial.querySelector('.filtro-rango')) {
          inyectarSelectorFiltro();
          instalarInterceptorExportacion();
          actualizarListaVisual();
        }
        if (seccionCampos && !seccionCampos.querySelector('.numeracion-reinicio-config')) {
          inyectarControlesReinicio();
        }
        if (seccionSeguridad && !seccionSeguridad.querySelector('.pin-config')) {
          inyectarControlesPin();
        }
      }, 400);
    }, 100);
  });

  function intentarInyectarTodo() {
    const panelCuerpo = document.getElementById('panelCuerpo');
    if (!panelCuerpo) return;

    const seccionEstilo    = panelCuerpo.querySelector('.panel-seccion[data-seccion="estilo"]');
    const seccionHistorial = panelCuerpo.querySelector('.panel-seccion[data-seccion="historial"]');
    const seccionCampos    = panelCuerpo.querySelector('.panel-seccion[data-seccion="campos"]');
    const seccionSeguridad = panelCuerpo.querySelector('.panel-seccion[data-seccion="seguridad"]');

    if (seccionEstilo && !seccionEstilo.querySelector('.plantillas-grid')) {
      inyectarControlesPlantillas();
    }
    if (seccionEstilo && !seccionEstilo.querySelector('.firma-config')) {
      inyectarControlesFirma();
    }
    if (seccionEstilo && !seccionEstilo.querySelector('.vista-previa-contenedor')) {
      inyectarVistaPrevia();
    }
    if (seccionHistorial && !seccionHistorial.querySelector('.filtro-rango')) {
      inyectarSelectorFiltro();
      instalarInterceptorExportacion();
      actualizarListaVisual();
    }
    if (seccionCampos && !seccionCampos.querySelector('.numeracion-reinicio-config')) {
      inyectarControlesReinicio();
    }
    if (seccionSeguridad && !seccionSeguridad.querySelector('.pin-config')) {
      inyectarControlesPin();
    }
  }

})();
