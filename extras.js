/* ============================================================================
   EXTRAS.JS — Añadidos a OSTIKEC sin modificar el código original
   ============================================================================
   Contenido:
     1. Botón en la pantalla 2 (creador) para gestionar Negocios/Servicios.
     2. Modal con dos campos y lista de combinaciones guardadas.
     3. Exportar e importar combinaciones (archivo .json).
     4. Extensión del ticket (nombre del negocio y datos del servicio).
     5. Modal con la información del creador (al pulsar OSTIKEC).
     6. Teléfono emisor añadido al QR y mostrado al validar.
     7. Selector de etiquetas (Ticket/Asiento e ID Servicio) por negocio.
     8. Ojo para mostrar/ocultar la licencia en la pantalla de login.
     9. Modal de confirmación al pulsar "Cerrar sesión".
    10. Modal de Términos y Condiciones (se cierra solo con "Aceptar").
    11. Modal del Manual de uso (solo para creadores).

   Requiere que se cargue DESPUÉS del script principal de index.html.
   ============================================================================ */

(function () {
  'use strict';

  /* ============================================================
     CONSTANTES
     ============================================================ */
  const CLAVE_NEGOCIOS       = 'ostikec_negocios';
  const CLAVE_NEGOCIO_ACTIVO = 'ostikec_negocio_activo';
  const CLAVE_ETIQUETAS      = 'ostikec_etiquetas_por_negocio';
  const CLAVE_SESION         = 'ostikec_sesion';

  const FIRMA_ARCHIVO   = 'OSTIKEC_NEGOCIOS';
  const VERSION_FORMATO = 1;

  const OPCIONES_ETIQUETAS = [
    'No. Ticket',
    'No. Asiento',
    'No. Factura',
    'No. Servicio',
    'No. Orden',
    'Referencia',
    'Código',
    'Precio',
    'ID Servicio',
    'Otro'
  ];

  const DEFAULT_A = 'No. Asiento';
  const DEFAULT_I = 'ID Servicio';
  const MAX_OTRO  = 20;

  /* ============================================================
     ALMACENAMIENTO — NEGOCIOS
     ============================================================ */
  function leerNegocios() {
    try {
      const bruto = localStorage.getItem(CLAVE_NEGOCIOS);
      if (!bruto) return [];
      const arr = JSON.parse(bruto);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function guardarNegocios(lista) {
    try { localStorage.setItem(CLAVE_NEGOCIOS, JSON.stringify(lista)); } catch (e) {}
  }

  function leerActivoId() {
    try { return localStorage.getItem(CLAVE_NEGOCIO_ACTIVO) || ''; } catch (e) { return ''; }
  }

  function guardarActivoId(id) {
    try { localStorage.setItem(CLAVE_NEGOCIO_ACTIVO, id || ''); } catch (e) {}
  }

  function obtenerNegocioActivo() {
    const id = leerActivoId();
    if (!id) return null;
    return leerNegocios().find(n => n.id === id) || null;
  }

  function nuevoId() {
    return 'neg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  }

  /* ============================================================
     ALMACENAMIENTO — ETIQUETAS POR NEGOCIO
     ============================================================ */
  function leerMapaEtiquetas() {
    try {
      const bruto = localStorage.getItem(CLAVE_ETIQUETAS);
      if (!bruto) return {};
      const obj = JSON.parse(bruto);
      return (obj && typeof obj === 'object') ? obj : {};
    } catch (e) { return {}; }
  }

  function guardarMapaEtiquetas(mapa) {
    try { localStorage.setItem(CLAVE_ETIQUETAS, JSON.stringify(mapa)); } catch (e) {}
  }

  function obtenerConfiguracionActual() {
    const activoId = leerActivoId();
    const mapa = leerMapaEtiquetas();
    const config = (activoId && mapa[activoId]) ? mapa[activoId] : {};
    return {
      a: config.a || DEFAULT_A,
      aOtro: config.aOtro || '',
      i: config.i || DEFAULT_I,
      iOtro: config.iOtro || ''
    };
  }

  function guardarConfiguracionActual(config) {
    const activoId = leerActivoId();
    if (!activoId) return;
    const mapa = leerMapaEtiquetas();
    mapa[activoId] = config;
    guardarMapaEtiquetas(mapa);
  }

  function obtenerLabelMostrable(config, campo) {
    const valor = config[campo];
    if (valor === 'Otro') {
      const custom = (config[campo + 'Otro'] || '').trim();
      return custom || (campo === 'a' ? DEFAULT_A : DEFAULT_I);
    }
    return valor || (campo === 'a' ? DEFAULT_A : DEFAULT_I);
  }

  /* ============================================================
     BOTONES EN LA BARRA SUPERIOR DEL CREADOR
     ============================================================ */
  function crearBotonNegocios() {
    const barraDer = document.querySelector('#pantallaCreador .barra-der');
    if (!barraDer) return;
    if (document.getElementById('btnNegocios')) return;

    const btn = document.createElement('button');
    btn.id = 'btnNegocios';
    btn.className = 'btn-icono';
    btn.title = 'Negocios y servicios';
    btn.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round">' +
      '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>' +
      '<path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>' +
      '</svg>';

    const btnLector = document.getElementById('btnAbrirLector');
    if (btnLector) {
      barraDer.insertBefore(btn, btnLector);
    } else {
      barraDer.appendChild(btn);
    }

    btn.addEventListener('click', abrirModalNegocios);
  }

  /* ============================================================
     MODAL DE NEGOCIOS
     ============================================================ */
  function crearModalNegocios() {
    if (document.getElementById('modalNegocios')) return;

    const modal = document.createElement('div');
    modal.id = 'modalNegocios';
    modal.className = 'modal';
    modal.innerHTML =
      '<div class="modal-caja">' +
        '<div class="modal-cabecera">' +
          '<h3>Negocios y servicios</h3>' +
          '<button id="btnCerrarNegocios" class="btn-cerrar">✕</button>' +
        '</div>' +
        '<div class="modal-cuerpo">' +
          '<div class="neg-form">' +
            '<label for="negNombre">Nombre de la Institución</label>' +
            '<input id="negNombre" type="text" placeholder="Ej. Teatro Nacional" autocomplete="off">' +
            '<label for="negServicio">Datos del Servicio</label>' +
            '<input id="negServicio" type="text" placeholder="Ej. Función de las 8:00 PM - Sala A" autocomplete="off">' +
            '<button id="btnGuardarNegocio" class="btn btn-acento" style="margin-top:6px;">' +
              'Guardar combinación' +
            '</button>' +
          '</div>' +
          '<h4 class="neg-lista-titulo">Combinaciones guardadas</h4>' +
          '<div id="negLista" class="neg-lista"></div>' +
          '<div id="negVacio" class="neg-vacio">Todavía no hay combinaciones guardadas.</div>' +
          '<div class="acciones" style="margin-top:16px;">' +
            '<button id="btnExportarNeg" class="btn btn-secundario">Exportar</button>' +
            '<button id="btnImportarNeg" class="btn btn-acento">Importar</button>' +
          '</div>' +
          '<input id="negInputArchivo" type="file" accept=".json,application/json,text/plain" style="display:none">' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    document.getElementById('btnCerrarNegocios').addEventListener('click', cerrarModalNegocios);
    document.getElementById('btnGuardarNegocio').addEventListener('click', guardarNuevaCombinacion);
    document.getElementById('btnExportarNeg').addEventListener('click', exportarNegocios);
    document.getElementById('btnImportarNeg').addEventListener('click', function () {
      document.getElementById('negInputArchivo').click();
    });
    document.getElementById('negInputArchivo').addEventListener('change', function () {
      if (this.files && this.files.length > 0) {
        importarNegocios(this.files[0]);
        this.value = '';
      }
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal) cerrarModalNegocios();
    });
  }

  function abrirModalNegocios() {
    crearModalNegocios();
    document.getElementById('negNombre').value = '';
    document.getElementById('negServicio').value = '';
    renderizarListaNegocios();
    document.getElementById('modalNegocios').classList.add('visible');
  }

  function cerrarModalNegocios() {
    const m = document.getElementById('modalNegocios');
    if (m) m.classList.remove('visible');
  }

  /* ============================================================
     GUARDAR / LISTAR / BORRAR / SELECCIONAR
     ============================================================ */
  function guardarNuevaCombinacion() {
    const nombre   = document.getElementById('negNombre').value.trim();
    const servicio = document.getElementById('negServicio').value.trim();

    if (!nombre || !servicio) {
      alert('Debe completar el nombre de la institución y los datos del servicio.');
      return;
    }

    const lista = leerNegocios();
    const nuevo = { id: nuevoId(), nombre: nombre, servicio: servicio };
    lista.push(nuevo);
    guardarNegocios(lista);
    guardarActivoId(nuevo.id);

    document.getElementById('negNombre').value = '';
    document.getElementById('negServicio').value = '';
    renderizarListaNegocios();
    actualizarSelectoresEtiquetas();
  }

  function borrarNegocio(id) {
    let lista = leerNegocios();
    lista = lista.filter(n => n.id !== id);
    guardarNegocios(lista);
    if (leerActivoId() === id) guardarActivoId('');
    renderizarListaNegocios();
    actualizarSelectoresEtiquetas();
  }

  function seleccionarNegocio(id) {
    guardarActivoId(id);
    renderizarListaNegocios();
    actualizarSelectoresEtiquetas();
  }

  function renderizarListaNegocios() {
    const cont  = document.getElementById('negLista');
    const vacio = document.getElementById('negVacio');
    const lista = leerNegocios();
    const activoId = leerActivoId();

    cont.innerHTML = '';

    if (lista.length === 0) {
      vacio.style.display = 'block';
      return;
    }
    vacio.style.display = 'none';

    lista.forEach(function (n) {
      const item = document.createElement('div');
      item.className = 'neg-item' + (n.id === activoId ? ' activo' : '');

      const texto = document.createElement('div');
      texto.className = 'neg-item-texto';

      const nombreEl = document.createElement('div');
      nombreEl.className = 'neg-item-nombre';
      nombreEl.textContent = n.nombre;

      const servicioEl = document.createElement('div');
      servicioEl.className = 'neg-item-servicio';
      servicioEl.textContent = n.servicio;

      texto.appendChild(nombreEl);
      texto.appendChild(servicioEl);

      const btnBorrar = document.createElement('button');
      btnBorrar.className = 'neg-item-borrar';
      btnBorrar.type = 'button';
      btnBorrar.textContent = '✕';
      btnBorrar.title = 'Eliminar';
      btnBorrar.addEventListener('click', function (e) {
        e.stopPropagation();
        if (confirm('¿Eliminar esta combinación?')) borrarNegocio(n.id);
      });

      item.appendChild(texto);
      item.appendChild(btnBorrar);
      item.addEventListener('click', function () { seleccionarNegocio(n.id); });

      cont.appendChild(item);
    });
  }

  /* ============================================================
     EXPORTAR E IMPORTAR
     ============================================================ */
  function descargarBlob(blob, nombreArchivo) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }

  function exportarNegocios() {
    const lista = leerNegocios();
    if (lista.length === 0) {
      alert('No hay combinaciones guardadas para exportar.');
      return;
    }

    const contenido = {
      firma: FIRMA_ARCHIVO,
      version: VERSION_FORMATO,
      fecha: new Date().toISOString(),
      negocios: lista,
      etiquetas: leerMapaEtiquetas()
    };

    const json = JSON.stringify(contenido, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const fecha = new Date();
    const dos = n => String(n).padStart(2, '0');
    const nombreArchivo = 'ostikec_negocios_'
      + fecha.getFullYear() + dos(fecha.getMonth() + 1) + dos(fecha.getDate())
      + '_' + dos(fecha.getHours()) + dos(fecha.getMinutes()) + '.json';

    try {
      const archivo = new File([blob], nombreArchivo, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        navigator.share({ files: [archivo], title: 'Negocios Ostikec' })
          .catch(function () { descargarBlob(blob, nombreArchivo); });
        return;
      }
    } catch (e) {}

    descargarBlob(blob, nombreArchivo);
  }

  function importarNegocios(archivo) {
    const lector = new FileReader();

    lector.onload = function (e) {
      let datos;
      try { datos = JSON.parse(e.target.result); }
      catch (err) { alert('El archivo no tiene un formato válido.'); return; }

      let lista;
      let etiquetasImportadas = null;
      if (Array.isArray(datos)) {
        lista = datos;
      } else if (datos && Array.isArray(datos.negocios)) {
        lista = datos.negocios;
        if (datos.etiquetas && typeof datos.etiquetas === 'object') {
          etiquetasImportadas = datos.etiquetas;
        }
      } else {
        alert('El archivo no contiene combinaciones reconocibles.');
        return;
      }

      if (lista.length === 0) {
        alert('El archivo no tiene combinaciones para importar.');
        return;
      }

      const actuales = leerNegocios();
      let agregados = 0;
      let duplicados = 0;

      lista.forEach(function (n) {
        if (!n || typeof n.nombre !== 'string' || typeof n.servicio !== 'string') return;
        const nombre   = n.nombre.trim();
        const servicio = n.servicio.trim();
        if (!nombre || !servicio) return;

        const yaExiste = actuales.some(function (a) {
          return a.nombre === nombre && a.servicio === servicio;
        });
        if (yaExiste) { duplicados++; return; }

        actuales.push({ id: nuevoId(), nombre: nombre, servicio: servicio });
        agregados++;
      });

      guardarNegocios(actuales);

      if (etiquetasImportadas) {
        const mapaActual = leerMapaEtiquetas();
        Object.keys(etiquetasImportadas).forEach(function (k) {
          if (!mapaActual[k]) mapaActual[k] = etiquetasImportadas[k];
        });
        guardarMapaEtiquetas(mapaActual);
      }

      renderizarListaNegocios();
      actualizarSelectoresEtiquetas();

      let mensaje = 'Se importaron ' + agregados + ' combinación(es).';
      if (duplicados > 0) mensaje += '\nSe omitieron ' + duplicados + ' por estar duplicadas.';
      alert(mensaje);
    };

    lector.onerror = function () { alert('No se pudo leer el archivo.'); };
    lector.readAsText(archivo);
  }

  /* ============================================================
     MODAL: INFORMACIÓN DEL CREADOR
     ============================================================ */
  function crearModalInfo() {
    if (document.getElementById('modalInfo')) return;

    const modal = document.createElement('div');
    modal.id = 'modalInfo';
    modal.className = 'modal';
    modal.innerHTML =
      '<div class="modal-caja">' +
        '<div class="modal-cabecera">' +
          '<h3>Información</h3>' +
          '<button id="btnCerrarInfo" class="btn-cerrar">✕</button>' +
        '</div>' +
        '<div class="modal-cuerpo">' +
          '<div class="info-creador">' +
            '<p class="info-titulo">OSTIKEC</p>' +
            '<p class="info-autor">Desarrollada por Osmani Tito Corrioso</p>' +
            '<p class="info-grupo">&copy; OSTICOR 2026</p>' +
            '<p class="info-derechos">Todos los derechos reservados</p>' +
            '<p class="info-aviso">No puede utilizar ni compartir la apk sin la licencia y la autorización del creador</p>' +
            '<p class="info-contacto">Contacto: osmanitito94@zoho.com</p>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    document.getElementById('btnCerrarInfo').addEventListener('click', function () {
      modal.classList.remove('visible');
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.classList.remove('visible');
    });
  }

  function abrirModalInfo() {
    crearModalInfo();
    document.getElementById('modalInfo').classList.add('visible');
  }

  function instalarBotonInfo() {
    ['pantallaCreador', 'pantallaValidador'].forEach(function (idPantalla) {
      const pantalla = document.getElementById(idPantalla);
      if (!pantalla) return;
      const titulo = pantalla.querySelector('.barra-titulo');
      if (!titulo) return;
      if (titulo.dataset.infoInstalada === '1') return;
      titulo.dataset.infoInstalada = '1';
      titulo.addEventListener('click', abrirModalInfo);
    });
  }

  /* ============================================================
     INYECCIÓN Y CONTROL DE LOS DESPLEGABLES DE ETIQUETAS
     ============================================================ */
  function crearSelectEtiqueta(campo) {
    const select = document.createElement('select');
    select.className = 'select-etiqueta';
    select.id = 'selEtiqueta_' + campo;

    OPCIONES_ETIQUETAS.forEach(function (opt) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    });

    return select;
  }

  function crearInputOtro(campo) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input-otro';
    input.id = 'inputOtro_' + campo;
    input.maxLength = MAX_OTRO;
    input.placeholder = 'Escriba la etiqueta (máx. ' + MAX_OTRO + ')';
    input.autocomplete = 'off';
    input.style.display = 'none';
    return input;
  }

  function inyectarSelectoresEtiquetas() {
    if (!document.getElementById('selEtiqueta_a')) {
      const labelA = document.querySelector('#pantallaCreador label[for="inAsiento"]');
      if (labelA && labelA.parentNode) {
        const selectA = crearSelectEtiqueta('a');
        const inputA  = crearInputOtro('a');
        labelA.parentNode.insertBefore(selectA, labelA);
        labelA.parentNode.insertBefore(inputA, labelA);
        labelA.style.display = 'none';

        selectA.addEventListener('change', function () { onCambioEtiqueta('a'); });
        inputA.addEventListener('input', function () {
          const custom = this.value.replace(/[^\wáéíóúÁÉÍÓÚñÑ.\- ]/g, '').substring(0, MAX_OTRO);
          if (custom !== this.value) this.value = custom;
          guardarConfigDesdeUI();
        });
      }
    }

    if (!document.getElementById('selEtiqueta_i')) {
      const labelI = document.querySelector('#pantallaCreador label[for="inIdServicio"]');
      if (labelI && labelI.parentNode) {
        const selectI = crearSelectEtiqueta('i');
        const inputI  = crearInputOtro('i');
        labelI.parentNode.insertBefore(selectI, labelI);
        labelI.parentNode.insertBefore(inputI, labelI);
        labelI.style.display = 'none';

        selectI.addEventListener('change', function () { onCambioEtiqueta('i'); });
        inputI.addEventListener('input', function () {
          const custom = this.value.replace(/[^\wáéíóúÁÉÍÓÚñÑ.\- ]/g, '').substring(0, MAX_OTRO);
          if (custom !== this.value) this.value = custom;
          guardarConfigDesdeUI();
        });
      }
    }
  }

  function onCambioEtiqueta(campo) {
    const select = document.getElementById('selEtiqueta_' + campo);
    const inputOtro = document.getElementById('inputOtro_' + campo);
    if (!select || !inputOtro) return;

    if (select.value === 'Otro') {
      inputOtro.style.display = 'block';
      inputOtro.focus();
    } else {
      inputOtro.style.display = 'none';
      inputOtro.value = '';
    }

    guardarConfigDesdeUI();
  }

  function guardarConfigDesdeUI() {
    const selectA = document.getElementById('selEtiqueta_a');
    const selectI = document.getElementById('selEtiqueta_i');
    const inputA  = document.getElementById('inputOtro_a');
    const inputI  = document.getElementById('inputOtro_i');
    if (!selectA || !selectI || !inputA || !inputI) return;

    const config = {
      a: selectA.value,
      aOtro: selectA.value === 'Otro' ? inputA.value.trim() : '',
      i: selectI.value,
      iOtro: selectI.value === 'Otro' ? inputI.value.trim() : ''
    };
    guardarConfiguracionActual(config);
  }

  function actualizarSelectoresEtiquetas() {
    inyectarSelectoresEtiquetas();

    const config = obtenerConfiguracionActual();
    const selectA = document.getElementById('selEtiqueta_a');
    const selectI = document.getElementById('selEtiqueta_i');
    const inputA  = document.getElementById('inputOtro_a');
    const inputI  = document.getElementById('inputOtro_i');
    if (!selectA || !selectI || !inputA || !inputI) return;

    selectA.value = config.a;
    if (config.a === 'Otro') {
      inputA.style.display = 'block';
      inputA.value = config.aOtro || '';
    } else {
      inputA.style.display = 'none';
      inputA.value = '';
    }

    selectI.value = config.i;
    if (config.i === 'Otro') {
      inputI.style.display = 'block';
      inputI.value = config.iOtro || '';
    } else {
      inputI.style.display = 'none';
      inputI.value = '';
    }
  }

  /* ============================================================
     ENVOLVER TEXTO
     ============================================================ */
  function envolverTexto(ctx, texto, anchoMaximo) {
    const palabras = String(texto).split(' ');
    const lineas = [];
    let actual = '';
    for (const palabra of palabras) {
      const prueba = actual ? actual + ' ' + palabra : palabra;
      if (ctx.measureText(prueba).width > anchoMaximo && actual) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = prueba;
      }
    }
    if (actual) lineas.push(actual);
    return lineas;
  }

  /* ============================================================
     SOBRESCRIBIR dibujarTicket
     ============================================================ */
  function instalarExtensionTicket() {
    if (typeof window.dibujarTicket !== 'function') return;

    const original = window.dibujarTicket;

    window.dibujarTicket = function (datos, textoQR) {
      const configActual = obtenerConfiguracionActual();
      const labelA = obtenerLabelMostrable(configActual, 'a').toUpperCase();
      const labelI = obtenerLabelMostrable(configActual, 'i').toUpperCase();

      const originalCelda = window.dibujarCelda;
      if (typeof originalCelda === 'function') {
        window.dibujarCelda = function (ctx, etiqueta, valor, x, y, ancho) {
          let nuevaEtiqueta = etiqueta;
          if (etiqueta === 'TICKET/ASIENTO') nuevaEtiqueta = labelA;
          else if (etiqueta === 'ID SERVICIO') nuevaEtiqueta = labelI;
          return originalCelda.call(this, ctx, nuevaEtiqueta, valor, x, y, ancho);
        };
      }

      try {
        original.call(this, datos, textoQR);
      } finally {
        if (typeof originalCelda === 'function') {
          window.dibujarCelda = originalCelda;
        }
      }

      const neg = obtenerNegocioActivo();
      if (!neg) return;

      const cv  = document.getElementById('canvasTicket');
      const ctx = cv.getContext('2d');
      const W   = cv.width;

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';

      const xDer = W - 45;
      const anchoMax = 240;
      const lineasNom = envolverTexto(ctx, neg.nombre.toUpperCase(), anchoMax);

      let yNom = 55;
      lineasNom.slice(0, 2).forEach(function (linea) {
        ctx.fillText(linea, xDer, yNom);
        yNom += 26;
      });
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#16324f';
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const xCentro   = W / 2;
      const anchoServ = W - 100;
      const lineasServ = envolverTexto(ctx, neg.servicio.toUpperCase(), anchoServ);

      let yServ = 985;
      lineasServ.slice(0, 3).forEach(function (linea) {
        ctx.fillText(linea, xCentro, yServ);
        yServ += 24;
      });
      ctx.restore();
    };
  }

  /* ============================================================
     ENVOLVER mostrarResultadoValidacion
     ============================================================ */
  (function () {
    if (typeof window.mostrarResultadoValidacion !== 'function') return;
    const originalValidacion = window.mostrarResultadoValidacion;
    window.mostrarResultadoValidacion = function (esValido, datos, error) {
      if (esValido && datos) {
        const tablaOriginal = document.getElementById('tablaDatos');
        originalValidacion.call(this, esValido, datos, error);
        if (tablaOriginal) {
          const filas = tablaOriginal.querySelectorAll('tr');
          if (filas.length >= 5) {
            filas[3].children[0].textContent = 'Campo 4';
            filas[4].children[0].textContent = 'Campo 5';
          }
          if (datos.e) {
            tablaOriginal.innerHTML +=
              '<tr><td>Emitido por</td><td>' + datos.e + '</td></tr>';
          }
        }
      } else {
        originalValidacion.call(this, esValido, datos, error);
      }
    };
  })();

  /* ============================================================
     ENVOLVER mostrarResultadoValidador
     ============================================================ */
  (function () {
    if (typeof window.mostrarResultadoValidador !== 'function') return;
    const originalValidador = window.mostrarResultadoValidador;
    window.mostrarResultadoValidador = function (resultado) {
      originalValidador.call(this, resultado);
      if (resultado && resultado.valido && resultado.datos) {
        const tabla = document.getElementById('tablaDatos3');
        if (tabla) {
          const filas = tabla.querySelectorAll('tr');
          if (filas.length >= 5) {
            filas[3].children[0].textContent = 'Campo 4';
            filas[4].children[0].textContent = 'Campo 5';
          }
          if (resultado.datos.e) {
            tabla.innerHTML +=
              '<tr><td>Emitido por</td><td>' + resultado.datos.e + '</td></tr>';
          }
        }
      }
    };
  })();

  /* ============================================================
     AÑADIR TELÉFONO EMISOR AL CONTENIDO DEL QR
     ============================================================ */
  (function () {
    if (typeof window.construirContenidoQR !== 'function') return;
    const originalContenido = window.construirContenidoQR;
    window.construirContenidoQR = function (datos) {
      try {
        const sesion = JSON.parse(localStorage.getItem(CLAVE_SESION) || '{}');
        if (sesion && sesion.tel) {
          datos.e = sesion.tel;
        }
      } catch (err) {}
      return originalContenido.call(this, datos);
    };
  })();

  /* ============================================================
     OJO PARA MOSTRAR/OCULTAR LA LICENCIA
     ============================================================ */
  function inyectarOjoLicencia() {
    if (document.getElementById('btnOjoLicencia')) return;
    const input = document.getElementById('loginLicencia');
    if (!input || !input.parentNode) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'btnOjoLicencia';
    btn.className = 'btn-ojo-licencia';
    btn.title = 'Mostrar u ocultar la licencia';

    const SVG_OJO =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round">' +
      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
      '<circle cx="12" cy="12" r="3"/>' +
      '</svg>';

    const SVG_OJO_TACHADO =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round">' +
      '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>' +
      '<line x1="1" y1="1" x2="23" y2="23"/>' +
      '</svg>';

    btn.innerHTML = SVG_OJO;
    input.parentNode.appendChild(btn);

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = SVG_OJO_TACHADO;
      } else {
        input.type = 'password';
        btn.innerHTML = SVG_OJO;
      }
    });
  }

  /* ============================================================
     MODAL DE CONFIRMACIÓN AL SALIR
     ============================================================ */
  function crearModalConfirmSalida() {
    if (document.getElementById('modalConfirmSalida')) return;

    const modal = document.createElement('div');
    modal.id = 'modalConfirmSalida';
    modal.className = 'modal';
    modal.innerHTML =
      '<div class="modal-caja">' +
        '<div class="modal-cabecera">' +
          '<h3>Confirmar salida</h3>' +
        '</div>' +
        '<div class="modal-cuerpo">' +
          '<p class="confirm-texto">' +
            '¿Confirmas que quieres volver a la pantalla inicial? ' +
            'Debes conocer el número de teléfono y la licencia para poder hacerlo.' +
          '</p>' +
          '<div class="acciones" style="margin-top:0;">' +
            '<button id="btnCancelarSalida" type="button" class="btn btn-secundario">Cancelar</button>' +
            '<button id="btnAceptarSalida" type="button" class="btn btn-acento">Aceptar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    document.getElementById('btnCancelarSalida').addEventListener('click', function () {
      modal.classList.remove('visible');
    });

    document.getElementById('btnAceptarSalida').addEventListener('click', function () {
      modal.classList.remove('visible');
      if (typeof window.cerrarSesion === 'function') {
        window.cerrarSesion();
      }
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.classList.remove('visible');
    });
  }

  function abrirModalConfirmSalida() {
    crearModalConfirmSalida();
    document.getElementById('modalConfirmSalida').classList.add('visible');
  }

  function interceptarBotonesSalir() {
    ['btnSalirCreador', 'btnSalirValidador'].forEach(function (idBoton) {
      const btn = document.getElementById(idBoton);
      if (!btn) return;
      if (btn.dataset.salidaInterceptada === '1') return;

      /* Clonamos el botón para eliminar el listener original de cerrarSesion */
      const clon = btn.cloneNode(true);
      clon.dataset.salidaInterceptada = '1';
      btn.parentNode.replaceChild(clon, btn);

      clon.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        abrirModalConfirmSalida();
      });
    });
  }

  /* ============================================================
     MODAL DE TÉRMINOS Y CONDICIONES
     (Solo se cierra al pulsar "Aceptar")
     ============================================================ */
  function crearModalTerminos() {
    if (document.getElementById('modalTerminos')) return;

    const modal = document.createElement('div');
    modal.id = 'modalTerminos';
    modal.className = 'modal';
    modal.innerHTML =
      '<div class="modal-caja">' +
        '<div class="modal-cabecera">' +
          '<h3>Términos y Condiciones</h3>' +
        '</div>' +
        '<div class="modal-cuerpo">' +
          '<div class="terminos-texto">' +

            '<h4>1. Aceptación</h4>' +
            '<p>Al instalar y utilizar OSTIKEC, usted acepta estos términos en su totalidad. Si no está de acuerdo, no utilice la aplicación.</p>' +

            '<h4>2. Titularidad</h4>' +
            '<p>OSTIKEC es una aplicación desarrollada y propiedad de Osmani Tito Corrioso (Grupo OSTICOR). Todos los derechos están reservados.</p>' +

            '<h4>3. Uso autorizado</h4>' +
            '<p>La aplicación se distribuye únicamente bajo licencia personal otorgada por el desarrollador. El número de teléfono, el número de licencia y cualquier credencial de acceso son estrictamente personales e intransferibles.</p>' +

            '<h4>4. Prohibiciones</h4>' +
            '<p>Queda terminantemente prohibido:</p>' +
            '<ul>' +
              '<li>Utilizar, copiar o distribuir la aplicación sin autorización expresa del desarrollador.</li>' +
              '<li>Compartir la licencia o el número de teléfono con terceros.</li>' +
              '<li>Realizar ingeniería inversa, modificar o redistribuir el software.</li>' +
              '<li>Utilizar la aplicación para actividades ilícitas o fraudulentas.</li>' +
            '</ul>' +

            '<h4>5. Supervisión y bloqueo</h4>' +
            '<p>El desarrollador podrá recibir informes periódicos sobre accesos y tickets generados. En caso de detectarse uso indebido, la licencia podrá ser revocada sin previo aviso y el dispositivo bloqueado de forma automática.</p>' +

            '<h4>6. Datos</h4>' +
            '<p>La aplicación almacena información localmente en su dispositivo y envía informes agregados al desarrollador. No se recopilan datos personales con fines publicitarios.</p>' +

            '<h4>7. Responsabilidad</h4>' +
            '<p>El desarrollador no se hace responsable de daños derivados del uso indebido de la aplicación, ni de la pérdida de datos por causas ajenas a su control.</p>' +

            '<h4>8. Contacto</h4>' +
            '<p>Para soporte, ampliación de licencia o denuncia de uso indebido: osmanitito94@zoho.com</p>' +

            '<p style="margin-top:16px; font-weight:700; color:#16324f;">Al continuar utilizando OSTIKEC, usted reconoce haber leído y aceptado estos términos.</p>' +

          '</div>' +
          '<button id="btnAceptarTerminos" type="button" class="btn btn-acento" style="margin-top:16px;">Aceptar</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    /* Único modo de cierre: pulsar "Aceptar" */
    document.getElementById('btnAceptarTerminos').addEventListener('click', function () {
      modal.classList.remove('visible');
    });
    /* No hay listener de backdrop ni botón X: solo se cierra con Aceptar */
  }

  function abrirModalTerminos() {
    crearModalTerminos();
    document.getElementById('modalTerminos').classList.add('visible');
  }

  function inyectarAvisoTerminos() {
    if (document.getElementById('terminosAviso')) return;
    const pantallaLogin = document.getElementById('pantallaLogin');
    if (!pantallaLogin) return;

    const loginWrap = pantallaLogin.querySelector('.login-wrap');
    if (!loginWrap) return;

    const subtitulos = loginWrap.querySelectorAll('p.subtitulo');
    let copyrightEl = null;
    subtitulos.forEach(function (el) {
      if (el.textContent.indexOf('OSTICOR') !== -1) copyrightEl = el;
    });
    if (!copyrightEl) return;

    const p = document.createElement('p');
    p.id = 'terminosAviso';
    p.className = 'terminos-aviso';
    p.innerHTML = 'Al utilizar OSTIKEC aceptas los ' +
      '<a href="#" id="linkTerminos">Términos y Condiciones</a>';

    copyrightEl.parentNode.insertBefore(p, copyrightEl.nextSibling);

    document.getElementById('linkTerminos').addEventListener('click', function (e) {
      e.preventDefault();
      abrirModalTerminos();
    });
  }

  /* ============================================================
     MODAL DEL MANUAL DE USO (solo creadores)
     ============================================================ */
  function crearBotonManual() {
    const barraDer = document.querySelector('#pantallaCreador .barra-der');
    if (!barraDer) return;
    if (document.getElementById('btnManual')) return;

    const btn = document.createElement('button');
    btn.id = 'btnManual';
    btn.className = 'btn-icono';
    btn.title = 'Manual de uso';
    btn.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round">' +
      '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>' +
      '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' +
      '</svg>';

    const btnNeg = document.getElementById('btnNegocios');
    const btnLector = document.getElementById('btnAbrirLector');
    const ref = btnNeg || btnLector;
    if (ref) {
      barraDer.insertBefore(btn, ref);
    } else {
      barraDer.appendChild(btn);
    }

    btn.addEventListener('click', abrirModalManual);
  }

  function crearModalManual() {
    if (document.getElementById('modalManual')) return;

    const modal = document.createElement('div');
    modal.id = 'modalManual';
    modal.className = 'modal';
    modal.innerHTML =
      '<div class="modal-caja">' +
        '<div class="modal-cabecera">' +
          '<h3>Manual de uso</h3>' +
          '<button id="btnCerrarManual" class="btn-cerrar">✕</button>' +
        '</div>' +
        '<div class="modal-cuerpo">' +
          '<div class="manual-texto">' +

            '<div class="manual-intro">' +
              'OSTIKEC es mucho más que un generador de tickets con código QR. ' +
              'Es una herramienta diseñada para dar confianza a tus clientes y ' +
              'profesionalizar la operación de tu negocio, sin necesidad de internet ' +
              'y sin complicaciones técnicas. Ideal para eventos, teatros, viajes, ' +
              'clases, rifas, facturación sencilla y cualquier servicio que requiera ' +
              'un comprobante electrónico verificable.' +
            '</div>' +

            '<h4>1. Generar un ticket</h4>' +
            '<ul>' +
              '<li>Completa los datos: Fecha, Nombre, Teléfono y los dos campos configurables.</li>' +
              '<li>Pulsa "Crear Ostikec" y aparecerá el ticket con su código QR.</li>' +
              '<li>Puedes descargarlo como imagen o compartirlo directamente por WhatsApp u otras aplicaciones.</li>' +
            '</ul>' +

            '<h4>2. Modales de negocio</h4>' +
            '<ul>' +
              '<li>Cada negocio puede tener su nombre, sus datos de servicio y sus propias etiquetas personalizadas.</li>' +
              '<li>Puedes guardar varios negocios y cambiar entre ellos con un toque.</li>' +
              '<li>Se pueden exportar e importar como archivo para pasarlos a otro dispositivo.</li>' +
            '</ul>' +

            '<h4>3. Validar un ticket</h4>' +
            '<ul>' +
              '<li>Con una licencia de tipo Validador, entra y pulsa "Escanear código QR".</li>' +
              '<li>Apunta la cámara al código del ticket. También puedes subir una imagen del código.</li>' +
              '<li>La app verificará si es auténtico y mostrará sus datos.</li>' +
            '</ul>' +

            '<h4>4. Seguridad de la aplicación</h4>' +

            '<p><b>Código QR cifrado:</b> cada ticket lleva sus datos cifrados y firmados digitalmente. ' +
            'Si alguien intenta alterar un dato o falsificar un ticket, la firma no coincidirá y la ' +
            'validación fallará.</p>' +

            '<p><b>Registro del emisor:</b> cada ticket guarda internamente el teléfono del dispositivo ' +
            'que lo emitió. Al validarlo, se muestra el número emisor junto a los datos. Así, aunque ' +
            'alguien genere un ticket parecido desde otra cuenta, quedará registrado su propio teléfono.</p>' +

            '<p><b>Supervisión periódica:</b> el desarrollador recibe informes periódicos sobre nuevos ' +
            'accesos y tickets generados. Si tu licencia es robada o compartida sin autorización, será ' +
            'detectada en las revisiones periódicas y la licencia podrá ser bloqueada automáticamente. ' +
            'En ese caso, contacta al desarrollador para recibir una nueva licencia.</p>' +

            '<p><b>Revocación remota:</b> el desarrollador puede revocar cualquier licencia de forma ' +
            'remota. Una licencia revocada dejará de funcionar en el dispositivo en cuanto este se ' +
            'conecte a internet.</p>' +

            '<h4>5. Licencia personal</h4>' +
            '<p>Tu número de teléfono y tu licencia son personales e intransferibles. No los compartas ' +
            'con nadie. Si compartes tu licencia, tanto tú como la persona que la use podríais perder ' +
            'el acceso.</p>' +

            '<h4>6. Contacto</h4>' +
            '<p>Para soporte o para reportar un uso indebido: <b>osmanitito94@zoho.com</b></p>' +

          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    document.getElementById('btnCerrarManual').addEventListener('click', function () {
      modal.classList.remove('visible');
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.classList.remove('visible');
    });
  }

  function abrirModalManual() {
    crearModalManual();
    document.getElementById('modalManual').classList.add('visible');
  }

  /* ============================================================
     ARRANQUE
     ============================================================ */
  window.addEventListener('DOMContentLoaded', function () {

    if (document.getElementById('pantallaLogin')) {
      inyectarOjoLicencia();
      inyectarAvisoTerminos();
    }

    if (document.getElementById('pantallaCreador') || document.getElementById('pantallaValidador')) {
      instalarBotonInfo();
    }

    if (document.getElementById('pantallaCreador')) {
      crearBotonNegocios();
      crearModalNegocios();
      crearBotonManual();
      instalarExtensionTicket();
      actualizarSelectoresEtiquetas();
    }

    interceptarBotonesSalir();

  });

})();