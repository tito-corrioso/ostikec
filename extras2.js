/* ============================================================================
   EXTRAS2.JS — Módulo adicional de OSTIKEC
   ============================================================================
   Contenido:
     21. Filtro de tickets por rango de fechas (Todo, Hoy, Semana, Mes,
         Personalizado) aplicado a: exportación PDF, exportación Excel
         y la lista visual del historial del panel.
     1.  Plantillas base del ticket (Estándar, Factura, Evento, Recibo).
     3.  Bloque de firma al pie del ticket.

   Requiere que extras.js se cargue ANTES y exponga window.OSTIKEC.
   ============================================================================ */

(function () {
  'use strict';

  /* ============================================================
     CONSTANTES
     ============================================================ */
  const CLAVE_FILTRO = 'ostikec_filtro_fechas';
  const CLAVE_FIRMA  = 'ostikec_firma_config';

  const RANGOS = [
    { valor: 'todo',          etiqueta: 'Todo el historial' },
    { valor: 'hoy',           etiqueta: 'Hoy' },
    { valor: 'semana',        etiqueta: 'Esta semana (desde el lunes)' },
    { valor: 'mes',           etiqueta: 'Este mes' },
    { valor: 'personalizado', etiqueta: 'Rango personalizado' }
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

  /* ============================================================
     UTILIDADES DE ACCESO A OSTIKEC
     ============================================================ */
  function OST() { return window.OSTIKEC; }

  /* ============================================================
     FILTRO POR RANGO DE FECHAS
     ============================================================ */
  function leerFiltro() {
    return Object.assign(
      { rango: 'todo', desde: '', hasta: '' },
      OST().leerJSON(CLAVE_FILTRO, {})
    );
  }

  function guardarFiltro(filtro) {
    OST().guardarJSON(CLAVE_FILTRO, filtro);
  }

  /* Convierte "DD/MM/AA" a timestamp (ms). Devuelve null si es inválido. */
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

  /* Devuelve { desde, hasta } en ms, o null si no hay filtro activo */
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
        const diaSemana = hoy.getDay();              /* 0=domingo ... 6=sábado */
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

  function historialFiltrado() {
    const historial = OST().leerHistorial();
    const filtro = leerFiltro();
    const rango = rangoDeFechas(filtro);
    if (!rango) return historial;

    return historial.filter(function (h) {
      if (!h.fecha) return false;
      const t = new Date(h.fecha).getTime();
      return t >= rango.desde && t <= rango.hasta;
    });
  }

  /* ============================================================
     SECCIÓN HISTORIAL: INYECCIÓN DEL FILTRO
     ============================================================ */
  function inyectarSelectorFiltro() {
    const secciones = document.querySelectorAll('.panel-seccion[data-seccion="historial"]');
    if (secciones.length === 0) return;

    const filtro = leerFiltro();

    secciones.forEach(function (seccion) {
      if (seccion.querySelector('.filtro-rango')) return;

      const cuerpo = seccion.querySelector('.panel-seccion-cuerpo');
      if (!cuerpo) return;

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
          '<div class="filtro-rango-info" id="filtroInfo"></div>' +
        '</div>';

      cuerpo.insertAdjacentHTML('afterbegin', htmlFiltro);

      const sel = document.getElementById('selFiltroRango');
      const divFechas = document.getElementById('filtroRangoFechas');
      const inpDesde = document.getElementById('inpFiltroDesde');
      const inpHasta = document.getElementById('inpFiltroHasta');

      if (sel) {
        sel.addEventListener('change', function () {
          const f = leerFiltro();
          f.rango = this.value;
          guardarFiltro(f);
          if (divFechas) divFechas.classList.toggle('visible', this.value === 'personalizado');
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

    const rango = rangoDeFechas(filtro);
    if (!rango) {
      info.textContent = 'Se incluirán todos los tickets del historial.';
      return;
    }

    const desde = new Date(rango.desde).toLocaleDateString('es-ES');
    const hasta = new Date(rango.hasta).toLocaleDateString('es-ES');
    const total = historialFiltrado().length;
    info.textContent = 'Filtro activo: ' + desde + ' → ' + hasta +
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
      alert('No hay tickets en el rango de fechas seleccionado.');
      return;
    }
    if (tipo === 'pdf') exportarFiltradoPDF(historial);
    else exportarFiltradoExcel(historial);
  }

  function calcularEtiquetaRango() {
    const filtro = leerFiltro();
    const rango = rangoDeFechas(filtro);
    if (!rango) return 'Todo el historial';
    const desde = new Date(rango.desde).toLocaleDateString('es-ES');
    const hasta = new Date(rango.hasta).toLocaleDateString('es-ES');
    return desde + ' → ' + hasta;
  }

  function exportarFiltradoPDF(historial) {
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
      alert('La librería PDF no está disponible.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFillColor(22, 50, 79);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('OSTIKEC', 14, 13);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Historial de tickets generados', 14, 20);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(9);
    doc.text('Fecha de exportación: ' + OST().fechaHoraExportacionLocal(), 14, 38);
    doc.text('Rango: ' + calcularEtiquetaRango(), 14, 43);
    doc.text('Total de tickets: ' + historial.length, 14, 48);

    const startY = 57;
    const rowH = 7;
    const cols = [
      { x: 14,  label: 'No. Ticket'      },
      { x: 34,  label: 'Fecha Servicio'  },
      { x: 58,  label: 'Nombre'          },
      { x: 92,  label: 'Teléfono'        },
      { x: 114, label: 'Campo 4'         },
      { x: 134, label: 'Campo 5'         },
      { x: 154, label: 'Negocio'         },
      { x: 182, label: 'Emitido por'     }
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
      const fila = [
        h.no || '', h.f || '', h.n || '', h.t || '',
        h.a  || '', h.i || '', neg,       h.e || ''
      ];
      const limites = [12, 14, 20, 12, 12, 12, 16, 14];
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
    filas.push(['Rango: ' + calcularEtiquetaRango()]);
    filas.push(['Total de tickets: ' + historial.length]);
    filas.push([]);
    filas.push([
      'No. Ticket', 'Fecha del Servicio', 'Nombre', 'Teléfono',
      'Campo 4', 'Campo 5', 'Negocio', 'Emitido por'
    ]);

    const negocios = OST().leerNegocios();
    historial.forEach(function (h) {
      const neg = h.negId
        ? (negocios.find(n => n.id === h.negId) || {}).nombre || ''
        : '';
      filas.push([
        h.no || '', h.f || '', h.n || '', h.t || '',
        h.a  || '', h.i || '', neg,       h.e || ''
      ]);
    });

    const ws1 = XLSX.utils.aoa_to_sheet(filas);
    ws1['!cols'] = [
      { wch: 14 }, { wch: 18 }, { wch: 24 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 14 }
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

    function actualizarListaVisual() {
    const listas = document.querySelectorAll(
      '.panel-seccion[data-seccion="historial"] .panel-historial-lista'
    );
    if (listas.length === 0) return;

    /* Filtramos conservando el índice real en el array completo */
    const historialCompleto = OST().leerHistorial();
    const filtro = leerFiltro();
    const rango = rangoDeFechas(filtro);

    const filtradosConIndice = [];
    historialCompleto.forEach(function (h, i) {
      if (!rango) {
        filtradosConIndice.push({ indice: i, item: h });
      } else if (h.fecha) {
        const t = new Date(h.fecha).getTime();
        if (t >= rango.desde && t <= rango.hasta) {
          filtradosConIndice.push({ indice: i, item: h });
        }
      }
    });

    const ultimos = filtradosConIndice.slice(-8).reverse();

    listas.forEach(function (lista) {
      if (ultimos.length === 0) {
        lista.innerHTML =
          '<div class="panel-historial-vacio">Sin tickets en el rango seleccionado.</div>';
        return;
      }

      lista.innerHTML = ultimos.map(function (entrada) {
        const h = entrada.item;
        const idxReal = entrada.indice;
        const fechaTxt = h.fecha
          ? new Date(h.fecha).toLocaleString('es-ES',
              { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
          : '';
        return '<div class="panel-historial-item">' +
          '<span class="h-nombre">' + (h.n || '—') + '</span>' +
          '<span class="h-fecha">' + fechaTxt + '</span>' +
          '<button type="button" class="h-btn" data-duplicar-filtrado="' +
            idxReal + '">Duplicar</button>' +
        '</div>';
      }).join('');

      lista.querySelectorAll('[data-duplicar-filtrado]').forEach(function (b) {
        b.addEventListener('click', function () {
          const idx = parseInt(this.dataset.duplicarFiltrado, 10);
          OST().duplicarTicketDelHistorial(idx);
        });
      });
    });
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

      /* Buscamos el botón "Regenerar ticket" para insertar antes */
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
        });
      }

      if (inp) {
        inp.addEventListener('input', function () {
          const cfg = leerFirmaConfig();
          cfg.texto = this.value || 'Firma';
          guardarFirmaConfig(cfg);
          regenerarTicketAhora();
        });
      }
    });
  }

  /* Regenera el ticket visible actual, si existe */
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

  /* ============================================================
     EXTENSIÓN DE dibujarTicket — Añade el bloque de firma
     Se ejecuta DESPUÉS del dibujo original, ampliando el canvas
     por debajo para insertar la franja de firma sin tapar nada.
     ============================================================ */
  function instalarWrapperFirma() {
    if (typeof window.dibujarTicket !== 'function') return;
    if (window.dibujarTicket.__ostikecFirmaInstalada) return;

    const original = window.dibujarTicket;

    const wrapper = function (datos, textoQR) {
      /* 1) Dibuja el ticket completo original */
      original.call(this, datos, textoQR);

      /* 2) Si la firma no está activa, no hacemos nada */
      const firma = leerFirmaConfig();
      if (!firma.activa) return;

      /* 3) Ampliar el canvas para insertar la franja de firma */
      const cv = document.getElementById('canvasTicket');
      if (!cv) return;

      const estilo = OST().obtenerEstiloActual();
      const colorMarco = estilo.colorCinta || '#16324f';
      const W = cv.width;
      const H = cv.height;

      const ALTURA_FIRMA = 100;
      const ALTURA_MARCO = 12;   /* distancia del marco al borde */
      const GROSOR_MARCO = 6;

      const nuevoH = H + ALTURA_FIRMA;

      /* Canvas temporal */
      const cvTemp = document.createElement('canvas');
      cvTemp.width = W;
      cvTemp.height = nuevoH;
      const ctx = cvTemp.getContext('2d');

      /* Fondo blanco general */
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, nuevoH);

      /* Copiamos el contenido original */
      ctx.drawImage(cv, 0, 0);

      /* Tapamos el borde inferior original del marco (era una línea horizontal
         en y = H - ALTURA_MARCO). Cubrimos desde y = H - ALTURA_MARCO - 1
         hasta y = H, con el fondo del ticket, para borrar esa línea. */
      ctx.fillStyle = estilo.colorFondo || '#ffffff';
      ctx.fillRect(ALTURA_MARCO + GROSOR_MARCO / 2,
                   H - ALTURA_MARCO - 1,
                   W - 2 * (ALTURA_MARCO + GROSOR_MARCO / 2),
                   ALTURA_MARCO + 1);

      /* Redibujamos las líneas verticales del marco desde H - ALTURA_MARCO
         hasta nuevoH - ALTURA_MARCO */
      ctx.strokeStyle = colorMarco;
      ctx.lineWidth = GROSOR_MARCO;
      ctx.beginPath();
      ctx.moveTo(ALTURA_MARCO, H - ALTURA_MARCO);
      ctx.lineTo(ALTURA_MARCO, nuevoH - ALTURA_MARCO);
      ctx.moveTo(W - ALTURA_MARCO, H - ALTURA_MARCO);
      ctx.lineTo(W - ALTURA_MARCO, nuevoH - ALTURA_MARCO);
      ctx.stroke();

      /* Franja de firma: línea horizontal para firmar */
      const margenFirma = 90;
      const anchoLinea = W - margenFirma * 2;
      const yLinea = H + ALTURA_FIRMA / 2 + 8;

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(margenFirma, yLinea);
      ctx.lineTo(W - margenFirma, yLinea);
      ctx.stroke();

      /* Texto encima de la línea */
      const textoFirma = (firma.texto || 'Firma').toUpperCase();
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 14px ' + (estilo.fuente || 'Arial') + ', sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(textoFirma, W / 2, yLinea - 6);

      /* Nuevo borde inferior del marco */
      ctx.strokeStyle = colorMarco;
      ctx.lineWidth = GROSOR_MARCO;
      ctx.beginPath();
      ctx.moveTo(ALTURA_MARCO, nuevoH - ALTURA_MARCO);
      ctx.lineTo(W - ALTURA_MARCO, nuevoH - ALTURA_MARCO);
      ctx.stroke();

      /* Volcar de vuelta al canvas visible */
      cv.width = W;
      cv.height = nuevoH;
      cv.getContext('2d').drawImage(cvTemp, 0, 0);
    };

    wrapper.__ostikecFirmaInstalada = true;
    window.dibujarTicket = wrapper;
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
        observarPanel();
      }, 15);
    });

    observerPanel.observe(panelCuerpo, { childList: true });
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

      /* Instalar el wrapper de firma una sola vez */
      instalarWrapperFirma();

      /* Intento inmediato */
      setTimeout(intentarInyectarTodo, 200);

      /* Chequeo periódico: cada 400 ms comprueba si el panel existe
         y si le faltan controles. Se auto-repara cuando el panel se
         reconstruye (por ejemplo, al cambiar un filtro o un negocio). */
      setInterval(function () {
        const panelCuerpo = document.getElementById('panelCuerpo');
        if (!panelCuerpo) return;

        const seccionEstilo   = panelCuerpo.querySelector('.panel-seccion[data-seccion="estilo"]');
        const seccionHistorial = panelCuerpo.querySelector('.panel-seccion[data-seccion="historial"]');

        if (seccionEstilo && !seccionEstilo.querySelector('.plantillas-grid')) {
          inyectarControlesPlantillas();
        }
        if (seccionEstilo && !seccionEstilo.querySelector('.firma-config')) {
          inyectarControlesFirma();
        }
        if (seccionHistorial && !seccionHistorial.querySelector('.filtro-rango')) {
          inyectarSelectorFiltro();
          instalarInterceptorExportacion();
          actualizarListaVisual();
        }
      }, 400);
    }, 100);
  });

  /* Función auxiliar: intenta inyectar todo lo que falte ahora mismo */
  function intentarInyectarTodo() {
    const panelCuerpo = document.getElementById('panelCuerpo');
    if (!panelCuerpo) return;

    const seccionEstilo = panelCuerpo.querySelector('.panel-seccion[data-seccion="estilo"]');
    const seccionHistorial = panelCuerpo.querySelector('.panel-seccion[data-seccion="historial"]');

    if (seccionEstilo && !seccionEstilo.querySelector('.plantillas-grid')) {
      inyectarControlesPlantillas();
    }
    if (seccionEstilo && !seccionEstilo.querySelector('.firma-config')) {
      inyectarControlesFirma();
    }
    if (seccionHistorial && !seccionHistorial.querySelector('.filtro-rango')) {
      inyectarSelectorFiltro();
      instalarInterceptorExportacion();
      actualizarListaVisual();
    }
  }

})();
