/* ============================================================================
   EXTRAS.JS — Añadidos a OSTIKEC sin modificar el código original
   ============================================================================
   Contenido:
     1. Botón en la pantalla 2 (creador) para gestionar Negocios/Servicios.
     2. Modal con dos campos y lista de combinaciones guardadas.
     3. Botones para EXPORTAR e IMPORTAR las combinaciones (archivo .json).
     4. Al generar un ticket, el nombre del negocio se dibuja en la esquina
        superior derecha, y los datos del servicio debajo de la fecha de emisión.
     5. El texto "OSTIKEC" de la barra superior (pantallas 2 y 3) es pulsable
        y abre un modal con la información del creador.
     6. Añade el número de teléfono emisor al código QR.
     7. NUEVO: Sustituye los labels "Ticket/Asiento" e "ID Servicio" por
        listas desplegables configurables por negocio.

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

  /* Opciones disponibles para los desplegables */
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

  /* Valores por defecto */
  const DEFAULT_A = 'No. Asiento';
  const DEFAULT_I = 'ID Servicio';

  /* Máximo de caracteres para la opción "Otro" */
  const MAX_OTRO = 20;

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

  /* Devuelve la configuración actual (con defaults si no hay) */
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

  /* Devuelve el texto visible final (para el ticket) */
  function obtenerLabelMostrable(config, campo) {
    const valor = config[campo];
    if (valor === 'Otro') {
      const custom = (config[campo + 'Otro'] || '').trim();
      return custom || (campo === 'a' ? DEFAULT_A : DEFAULT_I);
    }
    return valor || (campo === 'a' ? DEFAULT_A : DEFAULT_I);
  }

  /* ============================================================
     BOTÓN EN LA BARRA SUPERIOR DEL CREADOR
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

    /* Recargar los desplegables (defaults para el negocio nuevo) */
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
    /* Actualización inmediata de los desplegables */
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

      /* Importar también las etiquetas si vienen en el archivo */
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
     NUEVO — INYECCIÓN Y CONTROL DE LOS DESPLEGABLES DE ETIQUETAS
     ============================================================ */

  /* Construye un <select> con las opciones disponibles */
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

  /* Construye el <input> que aparece sólo cuando se elige "Otro" */
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

  /* Inyecta los dos selectores donde estaban los labels */
  function inyectarSelectoresEtiquetas() {
    /* --- Campo A (era "Ticket/Asiento") --- */
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

    /* --- Campo I (era "ID Servicio") --- */
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

  /* Se ejecuta al cambiar el <select> */
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

  /* Recoge lo que hay en la UI y lo guarda en localStorage */
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

  /* Refresca los selectores desde el localStorage (para el negocio activo) */
  function actualizarSelectoresEtiquetas() {
    inyectarSelectoresEtiquetas();

    const config = obtenerConfiguracionActual();
    const selectA = document.getElementById('selEtiqueta_a');
    const selectI = document.getElementById('selEtiqueta_i');
    const inputA  = document.getElementById('inputOtro_a');
    const inputI  = document.getElementById('inputOtro_i');
    if (!selectA || !selectI || !inputA || !inputI) return;

    /* Campo A */
    selectA.value = config.a;
    if (config.a === 'Otro') {
      inputA.style.display = 'block';
      inputA.value = config.aOtro || '';
    } else {
      inputA.style.display = 'none';
      inputA.value = '';
    }

    /* Campo I */
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
     - Sustituye las etiquetas "TICKET/ASIENTO" e "ID SERVICIO"
       por las configuradas por el usuario (por negocio).
     - Añade el nombre del negocio arriba a la derecha.
     - Añade los datos del servicio abajo, tras la fecha de emisión.
     ============================================================ */
  function instalarExtensionTicket() {
    if (typeof window.dibujarTicket !== 'function') return;

    const original = window.dibujarTicket;

    window.dibujarTicket = function (datos, textoQR) {

      /* Obtener las etiquetas configuradas para el negocio activo */
      const configActual = obtenerConfiguracionActual();
      const labelA = obtenerLabelMostrable(configActual, 'a').toUpperCase();
      const labelI = obtenerLabelMostrable(configActual, 'i').toUpperCase();

      /* Interceptar temporalmente dibujarCelda para sustituir los labels */
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
        /* Restaurar la función original pase lo que pase */
        if (typeof originalCelda === 'function') {
          window.dibujarCelda = originalCelda;
        }
      }

      /* El resto es exactamente lo que ya hacía: nombre del negocio y datos del servicio */
      const neg = obtenerNegocioActivo();
      if (!neg) return;

      const cv  = document.getElementById('canvasTicket');
      const ctx = cv.getContext('2d');
      const W   = cv.width;

      /* ---- Nombre de la institución: esquina superior derecha ---- */
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

      /* ---- Datos del servicio: debajo de la fecha de emisión ---- */
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
     (pantalla 2 – creador): mostrar "Campo 4" y "Campo 5"
     + "Emitido por"
     ============================================================ */
  (function () {
    if (typeof window.mostrarResultadoValidacion !== 'function') return;
    const originalValidacion = window.mostrarResultadoValidacion;
    window.mostrarResultadoValidacion = function (esValido, datos, error) {
      if (esValido && datos) {
        const tablaOriginal = document.getElementById('tablaDatos');
        originalValidacion.call(this, esValido, datos, error);
        if (tablaOriginal) {
          /* Cambiar los rótulos de las filas 4 y 5 por "Campo 4" y "Campo 5" */
          const filas = tablaOriginal.querySelectorAll('tr');
          if (filas.length >= 5) {
            filas[3].children[0].textContent = 'Campo 4';
            filas[4].children[0].textContent = 'Campo 5';
          }
          /* Añadir la fila del emisor si procede */
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
     (pantalla 3 – validador): mostrar "Campo 4" y "Campo 5"
     + "Emitido por"
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
     ARRANQUE
     ============================================================ */
  window.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('pantallaCreador')) return;

    crearBotonNegocios();
    crearModalNegocios();
    instalarExtensionTicket();
    instalarBotonInfo();

    /* Inyectar los selectores de etiquetas y cargar la config del negocio activo */
    actualizarSelectoresEtiquetas();
  });

})();