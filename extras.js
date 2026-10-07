/* ============================================================================
   EXTRAS.JS — Añadidos a OSTIKEC sin modificar el código original
   ============================================================================
   Secciones:
     1. Constantes
     2. Utilidades generales
     3. Almacenamiento: negocios
     4. Almacenamiento: etiquetas
     5. Almacenamiento: estilo del ticket
     6. Almacenamiento: historial
     7. Almacenamiento: numeración automática
     8. Almacenamiento: seguridad
     9. Almacenamiento: apariencia
    10. Botón negocios
    11. Modal negocios
    12. Guardar/listar/borrar negocios
    13. Exportar/importar negocios
    14. Modal info del creador
    15. Selectores de etiquetas
    16. Interceptar dibujarTicket (con estilo personalizado)
    17. Interceptar mostrarResultadoValidacion
    18. Interceptar mostrarResultadoValidador (modo ciego)
    19. Interceptar construirContenidoQR
    20. Ojo de licencia
    21. Modal confirmar salida
    22. Modal Términos y Condiciones
    23. Modal Manual de uso
    24. Menú flotante (botón + panel)
    25. Sección: Estilo del ticket
    26. Sección: Campos y datos
    27. Sección: Historial y estadísticas
    28. Sección: Seguridad
    29. Sección: Apariencia
    30. Sección: Respaldo
    31. Exportar historial a PDF (jsPDF)
    32. Exportar historial a Excel (SheetJS)
    33. Arranque

   Requiere que se cargue DESPUÉS del script principal de index.html
   y DESPUÉS de jspdf.umd.min.js y xlsx.full.min.js si se quieren
   usar las exportaciones.
   ============================================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. CONSTANTES
     ============================================================ */
  const CLAVE_NEGOCIOS       = 'ostikec_negocios';
  const CLAVE_NEGOCIO_ACTIVO = 'ostikec_negocio_activo';
  const CLAVE_ETIQUETAS      = 'ostikec_etiquetas_por_negocio';
  const CLAVE_SESION         = 'ostikec_sesion';
  const CLAVE_ESTILO         = 'ostikec_estilo_ticket';
  const CLAVE_HISTORIAL      = 'ostikec_historial';
  const CLAVE_NUMERACION     = 'ostikec_numeracion';
  const CLAVE_SEGURIDAD      = 'ostikec_seguridad';
  const CLAVE_APARIENCIA     = 'ostikec_apariencia';
  const CLAVE_MENU_ESTADO    = 'ostikec_menu_estado';
  const CLAVE_LOG_FALLOS     = 'ostikec_log_fallos';

  const FIRMA_ARCHIVO   = 'OSTIKEC_NEGOCIOS';
  const VERSION_FORMATO = 1;
  const MAX_OTRO        = 20;
  const MAX_PIE         = 60;
  const MAX_MARCA_AGUA  = 30;
  const MAX_HISTORIAL   = 500;

  const OPCIONES_ETIQUETAS = [
    'No. Ticket', 'No. Asiento', 'No. Factura', 'No. Servicio',
    'No. Orden', 'Referencia', 'Código', 'Precio', 'ID Servicio', 'Otro'
  ];
  const DEFAULT_A = 'No. Asiento';
  const DEFAULT_I = 'ID Servicio';

  /* Paletas de colores */
  const PALETA_CINTAS = [
    { nombre: 'Azul OSTIKEC', hex: '#16324f' },
    { nombre: 'Negro', hex: '#1f2937' },
    { nombre: 'Rojo', hex: '#991b1b' },
    { nombre: 'Verde', hex: '#166534' },
    { nombre: 'Morado', hex: '#6b21a8' },
    { nombre: 'Naranja', hex: '#c2410c' },
    { nombre: 'Rosa', hex: '#9d174d' },
    { nombre: 'Gris', hex: '#475569' }
  ];
  const PALETA_FONDOS = [
    { nombre: 'Blanco', hex: '#ffffff' },
    { nombre: 'Crema', hex: '#fffbeb' },
    { nombre: 'Gris claro', hex: '#f8fafc' },
    { nombre: 'Celeste', hex: '#f0f9ff' }
  ];
  const PALETA_ACENTOS = [
    { nombre: 'Dorado OSTIKEC', hex: '#f2a900' },
    { nombre: 'Azul', hex: '#2563eb' },
    { nombre: 'Verde', hex: '#16a34a' },
    { nombre: 'Rojo', hex: '#dc2626' },
    { nombre: 'Morado', hex: '#9333ea' },
    { nombre: 'Naranja', hex: '#ea580c' },
    { nombre: 'Rosa', hex: '#db2777' },
    { nombre: 'Gris', hex: '#64748b' }
  ];

  const FUENTES_TICKET = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New'];
  const TAMANOS_QR = [
    { nombre: 'Pequeño', valor: 300 },
    { nombre: 'Mediano', valor: 400 },
    { nombre: 'Grande', valor: 500 }
  ];

  const ESTILO_POR_DEFECTO = {
    colorCinta: '#16324f',
    colorFondo: '#ffffff',
    colorAcento: '#f2a900',
    mostrarLogo: true,
    formaLogo: 'circulo',
    tamanoQR: 400,
    orientacion: 'vertical',
    fuente: 'Arial',
    pie: '',
    marcaAgua: ''
  };

  /* ============================================================
     2. UTILIDADES GENERALES
     ============================================================ */
  function leerJSON(clave, porDefecto) {
    try {
      const bruto = localStorage.getItem(clave);
      if (!bruto) return porDefecto;
      const obj = JSON.parse(bruto);
      return (obj !== null && obj !== undefined) ? obj : porDefecto;
    } catch (e) { return porDefecto; }
  }

  function guardarJSON(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) {}
  }

  function nuevoId() {
    return 'neg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  }

  function normalizarTel(valor) {
    let d = String(valor || '').replace(/\D/g, '');
    if (d.length > 8 && d.indexOf('53') === 0) d = d.substring(2);
    return d;
  }

  /* Devuelve un color de contraste (blanco o negro) según la luminancia */
  function colorDeContraste(hexColor) {
    if (!hexColor || hexColor.length !== 7) return '#ffffff';
    const r = parseInt(hexColor.substr(1, 2), 16) / 255;
    const g = parseInt(hexColor.substr(3, 2), 16) / 255;
    const b = parseInt(hexColor.substr(5, 2), 16) / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.55 ? '#1f2937' : '#ffffff';
  }

  /* ============================================================
     3. ALMACENAMIENTO: NEGOCIOS
     ============================================================ */
  function leerNegocios() {
    const lista = leerJSON(CLAVE_NEGOCIOS, []);
    return Array.isArray(lista) ? lista : [];
  }
  function guardarNegocios(lista) { guardarJSON(CLAVE_NEGOCIOS, lista); }
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

  /* ============================================================
     4. ALMACENAMIENTO: ETIQUETAS
     ============================================================ */
  function leerMapaEtiquetas() {
    const obj = leerJSON(CLAVE_ETIQUETAS, {});
    return (obj && typeof obj === 'object') ? obj : {};
  }
  function guardarMapaEtiquetas(mapa) { guardarJSON(CLAVE_ETIQUETAS, mapa); }

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
     5. ALMACENAMIENTO: ESTILO DEL TICKET
     Se guarda por negocio. Si no hay negocio activo, se usa "_default".
     ============================================================ */
  function leerMapaEstilos() {
    const obj = leerJSON(CLAVE_ESTILO, {});
    return (obj && typeof obj === 'object') ? obj : {};
  }
  function guardarMapaEstilos(mapa) { guardarJSON(CLAVE_ESTILO, mapa); }

  function claveEstiloActual() {
    return leerActivoId() || '_default';
  }

  function obtenerEstiloActual() {
    const mapa = leerMapaEstilos();
    const cfg = mapa[claveEstiloActual()] || {};
    return Object.assign({}, ESTILO_POR_DEFECTO, cfg);
  }

  function guardarEstiloActual(estilo) {
    const mapa = leerMapaEstilos();
    mapa[claveEstiloActual()] = estilo;
    guardarMapaEstilos(mapa);
  }

  function actualizarEstiloParcial(cambios) {
    const estilo = obtenerEstiloActual();
    Object.assign(estilo, cambios);
    guardarEstiloActual(estilo);
  }

  /* ============================================================
     6. ALMACENAMIENTO: HISTORIAL
     ============================================================ */
  function leerHistorial() {
    const lista = leerJSON(CLAVE_HISTORIAL, []);
    return Array.isArray(lista) ? lista : [];
  }
  function guardarHistorial(lista) {
    if (lista.length > MAX_HISTORIAL) lista = lista.slice(-MAX_HISTORIAL);
    guardarJSON(CLAVE_HISTORIAL, lista);
  }
  function agregarAlHistorial(entrada) {
    const lista = leerHistorial();
    lista.push(entrada);
    guardarHistorial(lista);
  }

  /* ============================================================
     7. ALMACENAMIENTO: NUMERACIÓN AUTOMÁTICA
     ============================================================ */
  function leerMapaNumeracion() {
    const obj = leerJSON(CLAVE_NUMERACION, {});
    return (obj && typeof obj === 'object') ? obj : {};
  }
  function guardarMapaNumeracion(mapa) { guardarJSON(CLAVE_NUMERACION, mapa); }

  function siguienteNumero() {
    const clave = leerActivoId() || '_default';
    const mapa = leerMapaNumeracion();
    const actual = parseInt(mapa[clave] || '0', 10) || 0;
    const nuevo = actual + 1;
    mapa[clave] = nuevo;
    guardarMapaNumeracion(mapa);
    return nuevo;
  }

  /* ============================================================
     8. ALMACENAMIENTO: SEGURIDAD
     ============================================================ */
  const SEGURIDAD_POR_DEFECTO = {
    modoCiego: false,
    logFallos: true
  };
  function leerSeguridad() {
    return Object.assign({}, SEGURIDAD_POR_DEFECTO, leerJSON(CLAVE_SEGURIDAD, {}));
  }
  function guardarSeguridad(cfg) { guardarJSON(CLAVE_SEGURIDAD, cfg); }

  function leerLogFallos() {
    const lista = leerJSON(CLAVE_LOG_FALLOS, []);
    return Array.isArray(lista) ? lista : [];
  }
  function agregarFalloLog(motivo) {
    if (!leerSeguridad().logFallos) return;
    const lista = leerLogFallos();
    lista.push({ fecha: new Date().toISOString(), motivo: motivo || '' });
    if (lista.length > 200) lista.splice(0, lista.length - 200);
    guardarJSON(CLAVE_LOG_FALLOS, lista);
  }

  /* ============================================================
     9. ALMACENAMIENTO: APARIENCIA
     ============================================================ */
  function leerApariencia() {
    return Object.assign({ modoOscuro: false }, leerJSON(CLAVE_APARIENCIA, {}));
  }
  function guardarApariencia(cfg) { guardarJSON(CLAVE_APARIENCIA, cfg); }

  function aplicarModoOscuro() {
    const { modoOscuro } = leerApariencia();
    if (modoOscuro) document.body.classList.add('modo-oscuro');
    else document.body.classList.remove('modo-oscuro');
  }

  /* ============================================================
     10. BOTÓN NEGOCIOS
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
    if (btnLector) barraDer.insertBefore(btn, btnLector);
    else barraDer.appendChild(btn);

    btn.addEventListener('click', abrirModalNegocios);
  }

  /* ============================================================
     11. MODAL NEGOCIOS
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
            '<button id="btnGuardarNegocio" class="btn btn-acento" style="margin-top:6px;">Guardar combinación</button>' +
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
     12. GUARDAR / LISTAR / BORRAR / SELECCIONAR NEGOCIOS
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
    refrescarPanelSiAbierto();
  }

  function renderizarListaNegocios() {
    const cont  = document.getElementById('negLista');
    const vacio = document.getElementById('negVacio');
    const lista = leerNegocios();
    const activoId = leerActivoId();
    cont.innerHTML = '';

    if (lista.length === 0) { vacio.style.display = 'block'; return; }
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
     13. EXPORTAR / IMPORTAR NEGOCIOS
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
      etiquetas: leerMapaEtiquetas(),
      estilos: leerMapaEstilos()
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

      let lista, etiquetasImp = null, estilosImp = null;
      if (Array.isArray(datos)) {
        lista = datos;
      } else if (datos && Array.isArray(datos.negocios)) {
        lista = datos.negocios;
        if (datos.etiquetas && typeof datos.etiquetas === 'object') etiquetasImp = datos.etiquetas;
        if (datos.estilos && typeof datos.estilos === 'object') estilosImp = datos.estilos;
      } else {
        alert('El archivo no contiene combinaciones reconocibles.');
        return;
      }
      if (lista.length === 0) {
        alert('El archivo no tiene combinaciones para importar.');
        return;
      }

      const actuales = leerNegocios();
      let agregados = 0, duplicados = 0;

      lista.forEach(function (n) {
        if (!n || typeof n.nombre !== 'string' || typeof n.servicio !== 'string') return;
        const nombre   = n.nombre.trim();
        const servicio = n.servicio.trim();
        if (!nombre || !servicio) return;

        const yaExiste = actuales.some(a => a.nombre === nombre && a.servicio === servicio);
        if (yaExiste) { duplicados++; return; }
        actuales.push({ id: nuevoId(), nombre: nombre, servicio: servicio });
        agregados++;
      });
      guardarNegocios(actuales);

      if (etiquetasImp) {
        const mapaActual = leerMapaEtiquetas();
        Object.keys(etiquetasImp).forEach(k => { if (!mapaActual[k]) mapaActual[k] = etiquetasImp[k]; });
        guardarMapaEtiquetas(mapaActual);
      }
      if (estilosImp) {
        const mapaEst = leerMapaEstilos();
        Object.keys(estilosImp).forEach(k => { if (!mapaEst[k]) mapaEst[k] = estilosImp[k]; });
        guardarMapaEstilos(mapaEst);
      }

      renderizarListaNegocios();
      actualizarSelectoresEtiquetas();
      refrescarPanelSiAbierto();

      let mensaje = 'Se importaron ' + agregados + ' combinación(es).';
      if (duplicados > 0) mensaje += '\nSe omitieron ' + duplicados + ' por estar duplicadas.';
      alert(mensaje);
    };
    lector.onerror = function () { alert('No se pudo leer el archivo.'); };
    lector.readAsText(archivo);
  }

  /* ============================================================
     14. MODAL INFO DEL CREADOR
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
     15. SELECTORES DE ETIQUETAS
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
    guardarConfiguracionActual({
      a: selectA.value,
      aOtro: selectA.value === 'Otro' ? inputA.value.trim() : '',
      i: selectI.value,
      iOtro: selectI.value === 'Otro' ? inputI.value.trim() : ''
    });
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
    if (config.a === 'Otro') { inputA.style.display = 'block'; inputA.value = config.aOtro || ''; }
    else { inputA.style.display = 'none'; inputA.value = ''; }

    selectI.value = config.i;
    if (config.i === 'Otro') { inputI.style.display = 'block'; inputI.value = config.iOtro || ''; }
    else { inputI.style.display = 'none'; inputI.value = ''; }
  }

  /* ============================================================
     16. INTERCEPTAR dibujarTicket CON ESTILO PERSONALIZADO
     Reescribe el layout del ticket respetando el estilo del negocio activo.
     ============================================================ */
  function dibujarTicketPersonalizado(datos, textoQR, estilo) {
    const esHorizontal = estilo.orientacion === 'horizontal';
    const W = esHorizontal ? 1080 : 720;
    const H = esHorizontal ? 720 : 1080;

    const cv = document.getElementById('canvasTicket');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    const fuente = estilo.fuente || 'Arial';

    /* --- Fondo y marco --- */
    ctx.fillStyle = estilo.colorFondo;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = estilo.colorCinta;
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, W - 24, H - 24);

    /* --- Encabezado --- */
    ctx.fillStyle = estilo.colorCinta;
    ctx.fillRect(15, 15, W - 30, 150);

    if (estilo.mostrarLogo) {
      dibujarLogoForma(ctx, 45, 45, 90, estilo);
    }

    const colorTituloEnc = colorDeContraste(estilo.colorCinta);

    /* Título OSTIKEC */
    const xTitulo = estilo.mostrarLogo ? 160 : 45;
    ctx.fillStyle = colorTituloEnc;
    ctx.font = 'bold 44px ' + fuente + ', sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('OSTIKEC', xTitulo, 78);

    /* Subtítulo */
    ctx.fillStyle = estilo.colorAcento;
    ctx.font = 'bold 20px ' + fuente + ', sans-serif';
    ctx.fillText('TICKET/SERVICIO/FACTURA', xTitulo, 118);

    /* --- Nombre del negocio arriba a la derecha --- */
    const neg = obtenerNegocioActivo();
    if (neg) {
      ctx.save();
      ctx.fillStyle = colorTituloEnc;
      ctx.font = 'bold 22px ' + fuente + ', sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      const xDer = W - 45;
      const lineasNom = envolverTexto(ctx, neg.nombre.toUpperCase(), 240);
      let yNom = 55;
      lineasNom.slice(0, 2).forEach(function (linea) {
        ctx.fillText(linea, xDer, yNom);
        yNom += 26;
      });
      ctx.restore();
    }

    /* --- Cuerpo --- */
    const config = obtenerConfiguracionActual();
    const labelA = obtenerLabelMostrable(config, 'a').toUpperCase();
    const labelI = obtenerLabelMostrable(config, 'i').toUpperCase();

    const MARGEN = 40;
    const GAP_COL = 24;
    const ANCHO_UTIL = W - MARGEN * 2;
    const ANCHO_COL = (ANCHO_UTIL - GAP_COL) / 2;
    const tamQR = estilo.tamanoQR || 400;

    let y = 215;

    if (esHorizontal) {
      /* Layout horizontal: campos a la izquierda, QR a la derecha */
      const anchoIzq = Math.floor(ANCHO_UTIL * 0.55);
      const anchoDer = ANCHO_UTIL - anchoIzq - GAP_COL;

      let yIzq = y;
      yIzq += dibujarCelda(ctx, 'NOMBRE', datos.n, MARGEN, yIzq, anchoIzq) + 14;
      yIzq += dibujarCelda(ctx, 'FECHA', datos.f, MARGEN, yIzq, anchoIzq) + 14;
      yIzq += dibujarCelda(ctx, 'TELÉFONO', datos.t, MARGEN, yIzq, anchoIzq) + 14;
      yIzq += dibujarCelda(ctx, labelA, datos.a, MARGEN, yIzq, anchoIzq) + 14;
      yIzq += dibujarCelda(ctx, labelI, datos.i, MARGEN, yIzq, anchoIzq) + 14;

      const xQR = MARGEN + anchoIzq + GAP_COL;
      const tamAjustado = Math.min(tamQR, H - 260);
      const yQR = 215;
      dibujarQR(ctx, textoQR, xQR + (anchoDer - tamAjustado) / 2, yQR, tamAjustado);

      /* Pie */
      const yPie = H - 130;
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(MARGEN, yPie - 15);
      ctx.lineTo(W - MARGEN, yPie - 15);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 14px ' + fuente + ', sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('EMITIDO', W / 2, yPie + 8);
      ctx.fillStyle = estilo.colorCinta;
      ctx.font = 'bold 24px ' + fuente + ', sans-serif';
      ctx.fillText(fechaHoraEmision(), W / 2, yPie + 40);
    } else {
      /* Layout vertical (original) */
      y += dibujarCelda(ctx, 'NOMBRE', datos.n, MARGEN, y, ANCHO_UTIL) + 16;

      const hFecha = alturaCelda(ctx, datos.f, ANCHO_COL);
      const hTel   = alturaCelda(ctx, datos.t, ANCHO_COL);
      const hFila1 = Math.max(hFecha, hTel);
      dibujarCelda(ctx, 'FECHA', datos.f, MARGEN, y, ANCHO_COL);
      dibujarCelda(ctx, 'TELÉFONO', datos.t, MARGEN + ANCHO_COL + GAP_COL, y, ANCHO_COL);
      y += hFila1 + 16;

      const hAsi = alturaCelda(ctx, datos.a, ANCHO_COL);
      const hId  = alturaCelda(ctx, datos.i, ANCHO_COL);
      const hFila2 = Math.max(hAsi, hId);
      dibujarCelda(ctx, labelA, datos.a, MARGEN, y, ANCHO_COL);
      dibujarCelda(ctx, labelI, datos.i, MARGEN + ANCHO_COL + GAP_COL, y, ANCHO_COL);
      y += hFila2 + 16;

      /* Separador */
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(MARGEN, y + 6);
      ctx.lineTo(W - MARGEN, y + 6);
      ctx.stroke();

      /* QR */
      const xQR = (W - tamQR) / 2;
      const yQR = y + 40;
      dibujarQR(ctx, textoQR, xQR, yQR, tamQR);

      /* Pie */
      const yPie = yQR + tamQR + 45;
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(MARGEN, yPie - 20);
      ctx.lineTo(W - MARGEN, yPie - 20);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 14px ' + fuente + ', sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('EMITIDO', W / 2, yPie + 8);

      ctx.fillStyle = estilo.colorCinta;
      ctx.font = 'bold 24px ' + fuente + ', sans-serif';
      ctx.fillText(fechaHoraEmision(), W / 2, yPie + 40);

      /* Pie personalizable */
      if (estilo.pie) {
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 14px ' + fuente + ', sans-serif';
        ctx.fillText(estilo.pie.toUpperCase(), W / 2, yPie + 66);
      }
    }

    /* --- Marca de agua (opcional) --- */
    if (estilo.marcaAgua && estilo.marcaAgua.trim()) {
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = estilo.colorCinta;
      ctx.font = 'bold 80px ' + fuente + ', sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-Math.PI / 6);
      ctx.fillText(estilo.marcaAgua.toUpperCase(), 0, 0);
      ctx.restore();
    }

    /* --- Datos del servicio (nombre del negocio abajo) --- */
    if (neg) {
      ctx.save();
      ctx.fillStyle = estilo.colorCinta;
      ctx.font = 'bold 20px ' + fuente + ', sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const lineasServ = envolverTexto(ctx, neg.servicio.toUpperCase(), W - 100);
      let yServ = H - 80;
      lineasServ.slice(0, 2).forEach(function (linea) {
        ctx.fillText(linea, W / 2, yServ);
        yServ += 22;
      });
      ctx.restore();
    }
  }

  /* Dibuja el logo con la forma elegida */
  function dibujarLogoForma(ctx, x, y, tam, estilo) {
    const cx = x + tam / 2;
    const cy = y + tam / 2;
    const r  = tam / 2;

    ctx.save();
    ctx.beginPath();
    if (estilo.formaLogo === 'cuadrado') {
      const radio = tam * 0.15;
      ctx.moveTo(x + radio, y);
      ctx.lineTo(x + tam - radio, y);
      ctx.quadraticCurveTo(x + tam, y, x + tam, y + radio);
      ctx.lineTo(x + tam, y + tam - radio);
      ctx.quadraticCurveTo(x + tam, y + tam, x + tam - radio, y + tam);
      ctx.lineTo(x + radio, y + tam);
      ctx.quadraticCurveTo(x, y + tam, x, y + tam - radio);
      ctx.lineTo(x, y + radio);
      ctx.quadraticCurveTo(x, y, x + radio, y);
      ctx.closePath();
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
    ctx.lineWidth = Math.max(2, tam * 0.06);
    ctx.strokeStyle = estilo.colorCinta;
    ctx.stroke();

    ctx.fillStyle = estilo.colorCinta;
    ctx.font = 'bold ' + Math.round(tam * 0.48) + 'px ' + (estilo.fuente || 'Arial') + ', sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OT', cx, cy + tam * 0.03);
    ctx.restore();
  }

  /* Reemplaza la función global dibujarTicket */
  function instalarDibujarTicketPersonalizado() {
    window.dibujarTicket = function (datos, textoQR) {
      const estilo = obtenerEstiloActual();
      dibujarTicketPersonalizado(datos, textoQR, estilo);
    };
  }

  /* Envolver texto (copia local, por si acaso) */
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

  function alturaCelda(ctx, valor, ancho) {
    const fuenteActual = ctx.font;
    ctx.font = fuenteActual;
    const lineas = envolverTexto(ctx, valor || '—', ancho);
    return 23 + lineas.length * 30;
  }

  function dibujarCelda(ctx, etiqueta, valor, x, y, ancho) {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(etiqueta, x, y);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 26px Arial, sans-serif';
    const lineas = envolverTexto(ctx, valor || '—', ancho);

    let yL = y + 23;
    for (const linea of lineas) {
      ctx.fillText(linea, x, yL);
      yL += 30;
    }
    return (yL - y);
  }

  /* ============================================================
     17. INTERCEPTAR mostrarResultadoValidacion (pantalla 2)
     ============================================================ */
  (function () {
    if (typeof window.mostrarResultadoValidacion !== 'function') return;
    const original = window.mostrarResultadoValidacion;
    window.mostrarResultadoValidacion = function (esValido, datos, error) {
      if (esValido && datos) {
        const tabla = document.getElementById('tablaDatos');
        original.call(this, esValido, datos, error);
        if (tabla) {
          const filas = tabla.querySelectorAll('tr');
          if (filas.length >= 5) {
            filas[3].children[0].textContent = 'Campo 4';
            filas[4].children[0].textContent = 'Campo 5';
          }
          if (datos.e) {
            tabla.innerHTML += '<tr><td>Emitido por</td><td>' + datos.e + '</td></tr>';
          }
        }
      } else {
        original.call(this, esValido, datos, error);
      }
    };
  })();

  /* ============================================================
     18. INTERCEPTAR mostrarResultadoValidador (pantalla 3)
     Respeta el modo validador ciego.
     ============================================================ */
  (function () {
    if (typeof window.mostrarResultadoValidador !== 'function') return;
    const original = window.mostrarResultadoValidador;
    window.mostrarResultadoValidador = function (resultado) {
      const seguridad = leerSeguridad();
      original.call(this, resultado);

      if (resultado && resultado.valido && resultado.datos) {
        const tabla = document.getElementById('tablaDatos3');
        if (tabla) {
          const filas = tabla.querySelectorAll('tr');
          if (filas.length >= 5) {
            filas[3].children[0].textContent = 'Campo 4';
            filas[4].children[0].textContent = 'Campo 5';
          }
          if (!seguridad.modoCiego && resultado.datos.e) {
            tabla.innerHTML += '<tr><td>Emitido por</td><td>' + resultado.datos.e + '</td></tr>';
          }
        }
      } else if (resultado && !resultado.valido) {
        agregarFalloLog(resultado.error || 'Ticket inválido');
      }
    };
  })();

  /* ============================================================
     19. INTERCEPTAR construirContenidoQR
     ============================================================ */
  (function () {
    if (typeof window.construirContenidoQR !== 'function') return;
    const original = window.construirContenidoQR;
    window.construirContenidoQR = function (datos) {
      try {
        const sesion = JSON.parse(localStorage.getItem(CLAVE_SESION) || '{}');
        if (sesion && sesion.tel) datos.e = sesion.tel;
      } catch (err) {}
      /* Añadir número correlativo si está activado */
      const numeracion = leerNumeracionActiva();
      if (numeracion.activa) {
        datos.no = numeracion.prefijo + String(siguienteNumero()).padStart(4, '0');
      }
      return original.call(this, datos);
    };
  })();

  /* Numeración: lee si está activada y su prefijo */
  function leerNumeracionActiva() {
    const obj = leerJSON('ostikec_numeracion_config', { activa: false, prefijo: 'T-' });
    return obj && typeof obj === 'object' ? obj : { activa: false, prefijo: 'T-' };
  }

  /* ============================================================
     20. OJO DE LICENCIA
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
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
      '<circle cx="12" cy="12" r="3"/></svg>';
    const SVG_OJO_TACHADO =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>' +
      '<line x1="1" y1="1" x2="23" y2="23"/></svg>';

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
     21. MODAL CONFIRMAR SALIDA
     ============================================================ */
  function crearModalConfirmSalida() {
    if (document.getElementById('modalConfirmSalida')) return;
    const modal = document.createElement('div');
    modal.id = 'modalConfirmSalida';
    modal.className = 'modal';
    modal.innerHTML =
      '<div class="modal-caja">' +
        '<div class="modal-cabecera"><h3>Confirmar salida</h3></div>' +
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
      if (typeof window.cerrarSesion === 'function') window.cerrarSesion();
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
     22. MODAL TÉRMINOS Y CONDICIONES
     ============================================================ */
  function crearModalTerminos() {
    if (document.getElementById('modalTerminos')) return;
    const modal = document.createElement('div');
    modal.id = 'modalTerminos';
    modal.className = 'modal';
    modal.innerHTML =
      '<div class="modal-caja">' +
        '<div class="modal-cabecera"><h3>Términos y Condiciones</h3></div>' +
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

    document.getElementById('btnAceptarTerminos').addEventListener('click', function () {
      modal.classList.remove('visible');
    });
  }
  function abrirModalTerminos() {
    crearModalTerminos();
    document.getElementById('modalTerminos').classList.add('visible');
  }
  function inyectarAvisoTerminos() {
    if (document.getElementById('terminosAviso')) return;
    const loginWrap = document.querySelector('#pantallaLogin .login-wrap');
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
     23. MODAL MANUAL DE USO
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
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>' +
      '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';

    const btnNeg = document.getElementById('btnNegocios');
    const ref = btnNeg || document.getElementById('btnAbrirLector');
    if (ref) barraDer.insertBefore(btn, ref);
    else barraDer.appendChild(btn);

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
            '<div class="manual-intro">OSTIKEC es mucho más que un generador de tickets con código QR. Es una herramienta diseñada para dar confianza a tus clientes y profesionalizar la operación de tu negocio, sin necesidad de internet y sin complicaciones técnicas.</div>' +
            '<h4>1. Generar un ticket</h4>' +
            '<ul>' +
              '<li>Completa los datos: Fecha, Nombre, Teléfono y los dos campos configurables.</li>' +
              '<li>Pulsa "Crear Ostikec" y aparecerá el ticket con su código QR.</li>' +
              '<li>Puedes descargarlo como imagen o compartirlo directamente.</li>' +
            '</ul>' +
            '<h4>2. Modales de negocio</h4>' +
            '<ul>' +
              '<li>Cada negocio puede tener su nombre, sus datos de servicio y sus etiquetas personalizadas.</li>' +
              '<li>Puedes guardar varios negocios y cambiar entre ellos con un toque.</li>' +
              '<li>Se pueden exportar e importar como archivo para pasarlos a otro dispositivo.</li>' +
            '</ul>' +
            '<h4>3. Validar un ticket</h4>' +
            '<ul>' +
              '<li>Con una licencia de tipo Validador, entra y pulsa "Escanear código QR".</li>' +
              '<li>Apunta la cámara al código del ticket. También puedes subir una imagen.</li>' +
              '<li>La app verificará si es auténtico y mostrará sus datos.</li>' +
            '</ul>' +
            '<h4>4. Seguridad de la aplicación</h4>' +
            '<p><b>Código QR cifrado:</b> cada ticket lleva sus datos cifrados y firmados. Si alguien intenta alterarlo, la validación fallará.</p>' +
            '<p><b>Registro del emisor:</b> cada ticket guarda el teléfono del dispositivo que lo emitió.</p>' +
            '<p><b>Supervisión periódica:</b> el desarrollador recibe informes periódicos. Si tu licencia es robada, será detectada.</p>' +
            '<p><b>Revocación remota:</b> el desarrollador puede revocar cualquier licencia.</p>' +
            '<h4>5. Licencia personal</h4>' +
            '<p>Tu teléfono y licencia son personales e intransferibles.</p>' +
            '<h4>6. Contacto</h4>' +
            '<p>Soporte: <b>osmanitito94@zoho.com</b></p>' +
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
     24. MENÚ FLOTANTE
     ============================================================ */
  function crearBotonFlotante() {
    if (document.getElementById('btnFlotanteMenu')) return;
    const btn = document.createElement('button');
    btn.id = 'btnFlotanteMenu';
    btn.className = 'btn-flotante-menu';
    btn.title = 'Opciones';
    btn.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="3"/>' +
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    document.body.appendChild(btn);

    btn.addEventListener('click', abrirPanelFlotante);
  }

  function crearPanelFlotante() {
    if (document.getElementById('panelFlotante')) return;

    const fondo = document.createElement('div');
    fondo.id = 'panelFlotanteFondo';
    fondo.className = 'panel-flotante-fondo';
    fondo.addEventListener('click', cerrarPanelFlotante);
    document.body.appendChild(fondo);

    const panel = document.createElement('div');
    panel.id = 'panelFlotante';
    panel.className = 'panel-flotante';
    panel.innerHTML =
      '<div class="panel-flotante-cabecera">' +
        '<h3>Opciones</h3>' +
        '<button id="btnCerrarPanel" class="panel-flotante-cerrar" type="button">✕</button>' +
      '</div>' +
      '<div class="panel-flotante-cuerpo" id="panelCuerpo"></div>';
    document.body.appendChild(panel);

    document.getElementById('btnCerrarPanel').addEventListener('click', cerrarPanelFlotante);
    construirContenidoPanel();
  }

  function abrirPanelFlotante() {
    crearPanelFlotante();
    document.getElementById('panelFlotanteFondo').classList.add('visible');
    document.getElementById('panelFlotante').classList.add('visible');
    /* Aplicar la última sección abierta */
    const ultima = leerJSON(CLAVE_MENU_ESTADO, { abierta: '' });
    if (ultima && ultima.abierta) {
      const sec = document.querySelector('.panel-seccion[data-seccion="' + ultima.abierta + '"]');
      if (sec) sec.classList.add('abierta');
    }
  }

  function cerrarPanelFlotante() {
    const f = document.getElementById('panelFlotanteFondo');
    const p = document.getElementById('panelFlotante');
    if (f) f.classList.remove('visible');
    if (p) p.classList.remove('visible');
  }

  function refrescarPanelSiAbierto() {
    const p = document.getElementById('panelFlotante');
    if (p && p.classList.contains('visible')) {
      construirContenidoPanel();
    }
  }

  /* Acordeón: solo una sección abierta a la vez */
  function instalarAcordeon() {
    const secciones = document.querySelectorAll('.panel-seccion');
    secciones.forEach(function (sec) {
      const titulo = sec.querySelector('.panel-seccion-titulo');
      if (!titulo || titulo.dataset.accInstalado === '1') return;
      titulo.dataset.accInstalado = '1';
      titulo.addEventListener('click', function () {
        const estaAbierta = sec.classList.contains('abierta');
        secciones.forEach(s => s.classList.remove('abierta'));
        if (!estaAbierta) {
          sec.classList.add('abierta');
          guardarJSON(CLAVE_MENU_ESTADO, { abierta: sec.dataset.seccion });
        } else {
          guardarJSON(CLAVE_MENU_ESTADO, { abierta: '' });
        }
      });
    });
  }

  /* ============================================================
     25-30. CONSTRUCCIÓN DEL PANEL (todas las secciones)
     ============================================================ */
  function construirContenidoPanel() {
    const cont = document.getElementById('panelCuerpo');
    if (!cont) return;

    cont.innerHTML =
      construirSeccionEstilo() +
      construirSeccionCampos() +
      construirSeccionHistorial() +
      construirSeccionSeguridad() +
      construirSeccionApariencia() +
      construirSeccionRespaldo();

    instalarAcordeon();
    instalarListenersPanel();
    /* Aplicar la última sección abierta otra vez tras reconstruir */
    const ultima = leerJSON(CLAVE_MENU_ESTADO, { abierta: '' });
    if (ultima && ultima.abierta) {
      const sec = cont.querySelector('.panel-seccion[data-seccion="' + ultima.abierta + '"]');
      if (sec) sec.classList.add('abierta');
    }
  }

  /* --- 25. Sección: Estilo del ticket --- */
  function construirSeccionEstilo() {
    const estilo = obtenerEstiloActual();
    const paletaCinta = PALETA_CINTAS.map(c =>
      '<button type="button" class="panel-color' + (c.hex === estilo.colorCinta ? ' activo' : '') +
      '" data-color-cinta="' + c.hex + '" style="background:' + c.hex + ';" title="' + c.nombre + '"></button>'
    ).join('');
    const paletaFondo = PALETA_FONDOS.map(c =>
      '<button type="button" class="panel-color' + (c.hex === estilo.colorFondo ? ' activo' : '') +
      '" data-color-fondo="' + c.hex + '" style="background:' + c.hex + ';" title="' + c.nombre + '"></button>'
    ).join('');
    const paletaAcento = PALETA_ACENTOS.map(c =>
      '<button type="button" class="panel-color' + (c.hex === estilo.colorAcento ? ' activo' : '') +
      '" data-color-acento="' + c.hex + '" style="background:' + c.hex + ';" title="' + c.nombre + '"></button>'
    ).join('');

    const opcionesForma = ['circulo','cuadrado','hexagono'].map(f => {
      const nombres = { circulo: 'Círculo', cuadrado: 'Cuadrado', hexagono: 'Hexágono' };
      return '<option value="' + f + '"' + (estilo.formaLogo === f ? ' selected' : '') + '>' + nombres[f] + '</option>';
    }).join('');

    const opcionesTamQR = TAMANOS_QR.map(t =>
      '<option value="' + t.valor + '"' + (estilo.tamanoQR === t.valor ? ' selected' : '') + '>' + t.nombre + '</option>'
    ).join('');

    const opcionesFuente = FUENTES_TICKET.map(f =>
      '<option value="' + f + '"' + (estilo.fuente === f ? ' selected' : '') + '>' + f + '</option>'
    ).join('');

    return '' +
      '<div class="panel-seccion" data-seccion="estilo">' +
        '<div class="panel-seccion-titulo">🎨 Estilo del ticket <span class="flecha">▼</span></div>' +
        '<div class="panel-seccion-cuerpo">' +
          '<label class="panel-label">Color de la cinta superior</label>' +
          '<div class="panel-paleta">' + paletaCinta + '</div>' +
          '<label class="panel-label">Color del fondo</label>' +
          '<div class="panel-paleta">' + paletaFondo + '</div>' +
          '<label class="panel-label">Color del acento</label>' +
          '<div class="panel-paleta">' + paletaAcento + '</div>' +
          '<label class="panel-switch">Mostrar logo <input type="checkbox" id="chkMostrarLogo"' + (estilo.mostrarLogo ? ' checked' : '') + '></label>' +
          '<label class="panel-label">Forma del logo</label>' +
          '<select class="panel-select" id="selFormaLogo">' + opcionesForma + '</select>' +
          '<label class="panel-label">Tamaño del QR</label>' +
          '<select class="panel-select" id="selTamQR">' + opcionesTamQR + '</select>' +
          '<label class="panel-label">Orientación del ticket</label>' +
          '<select class="panel-select" id="selOrientacion">' +
            '<option value="vertical"' + (estilo.orientacion === 'vertical' ? ' selected' : '') + '>Vertical</option>' +
            '<option value="horizontal"' + (estilo.orientacion === 'horizontal' ? ' selected' : '') + '>Horizontal</option>' +
          '</select>' +
          '<label class="panel-label">Fuente del ticket</label>' +
          '<select class="panel-select" id="selFuente">' + opcionesFuente + '</select>' +
          '<label class="panel-label">Pie personalizable (máx. ' + MAX_PIE + ')</label>' +
          '<input class="panel-input" id="inpPie" type="text" maxlength="' + MAX_PIE + '" value="' + (estilo.pie || '') + '" placeholder="Ej. Gracias por su compra">' +
          '<label class="panel-label">Marca de agua (máx. ' + MAX_MARCA_AGUA + ')</label>' +
          '<input class="panel-input" id="inpMarcaAgua" type="text" maxlength="' + MAX_MARCA_AGUA + '" value="' + (estilo.marcaAgua || '') + '" placeholder="Ej. COPIA">' +
          '<div class="panel-fila">' +
            '<button type="button" class="panel-btn panel-btn-acento" id="btnAplicarEstilo">Aplicar y regenerar</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* --- 26. Sección: Campos y datos --- */
  function construirSeccionCampos() {
    const cfg = leerJSON('ostikec_campos_config', {
      activarCorreo: false,
      activarDireccion: false,
      activarNotas: false,
      ocultarVacios: false,
      numeracionActiva: false,
      numeracionPrefijo: 'T-',
      fechaEditable: false
    });

    return '' +
      '<div class="panel-seccion" data-seccion="campos">' +
        '<div class="panel-seccion-titulo">📋 Campos y datos <span class="flecha">▼</span></div>' +
        '<div class="panel-seccion-cuerpo">' +
          '<label class="panel-switch">Campo Correo <input type="checkbox" id="chkCorreo"' + (cfg.activarCorreo ? ' checked' : '') + '></label>' +
          '<label class="panel-switch">Campo Dirección <input type="checkbox" id="chkDireccion"' + (cfg.activarDireccion ? ' checked' : '') + '></label>' +
          '<label class="panel-switch">Campo Notas <input type="checkbox" id="chkNotas"' + (cfg.activarNotas ? ' checked' : '') + '></label>' +
          '<label class="panel-switch">Ocultar campos vacíos <input type="checkbox" id="chkOcultarVacios"' + (cfg.ocultarVacios ? ' checked' : '') + '></label>' +
          '<label class="panel-switch">Numeración automática <input type="checkbox" id="chkNumeracion"' + (cfg.numeracionActiva ? ' checked' : '') + '></label>' +
          '<label class="panel-label">Prefijo de numeración</label>' +
          '<input class="panel-input" id="inpPrefijo" type="text" maxlength="6" value="' + (cfg.numeracionPrefijo || 'T-') + '" placeholder="Ej. T-">' +
          '<label class="panel-switch">Permitir editar la fecha <input type="checkbox" id="chkFechaEditable"' + (cfg.fechaEditable ? ' checked' : '') + '></label>' +
          '<div class="panel-fila">' +
            '<button type="button" class="panel-btn panel-btn-primario" id="btnGuardarCampos">Guardar cambios</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* --- 27. Sección: Historial y estadísticas --- */
  function construirSeccionHistorial() {
    const historial = leerHistorial();
    const total = historial.length;

    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
    const inicioSemana = inicioHoy - 6 * 24 * 60 * 60 * 1000;
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).getTime();

    let cHoy = 0, cSemana = 0, cMes = 0;
    historial.forEach(function (h) {
      const t = h.fecha ? new Date(h.fecha).getTime() : 0;
      if (t >= inicioHoy) cHoy++;
      if (t >= inicioSemana) cSemana++;
      if (t >= inicioMes) cMes++;
    });

    /* Últimos 8 items, más recientes primero */
    const ultimos = historial.slice(-8).reverse();
    const htmlUltimos = ultimos.length === 0
      ? '<div class="panel-historial-vacio">Sin tickets registrados aún.</div>'
      : ultimos.map(function (h, i) {
          const idx = historial.length - 1 - i;
          const fechaTxt = h.fecha ? new Date(h.fecha).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
          return '<div class="panel-historial-item">' +
            '<span class="h-nombre">' + (h.n || '—') + '</span>' +
            '<span class="h-fecha">' + fechaTxt + '</span>' +
            '<button type="button" class="h-btn" data-duplicar="' + idx + '">Duplicar</button>' +
          '</div>';
        }).join('');

    return '' +
      '<div class="panel-seccion" data-seccion="historial">' +
        '<div class="panel-seccion-titulo">📊 Historial y estadísticas <span class="flecha">▼</span></div>' +
        '<div class="panel-seccion-cuerpo">' +
          '<div class="panel-contadores">' +
            '<div class="panel-contador"><div class="c-num">' + cHoy + '</div><div class="c-lbl">Hoy</div></div>' +
            '<div class="panel-contador"><div class="c-num">' + cSemana + '</div><div class="c-lbl">7 días</div></div>' +
            '<div class="panel-contador"><div class="c-num">' + cMes + '</div><div class="c-lbl">Mes</div></div>' +
            '<div class="panel-contador"><div class="c-num">' + total + '</div><div class="c-lbl">Total</div></div>' +
          '</div>' +
          '<canvas class="panel-grafico" id="panelGrafico"></canvas>' +
          '<label class="panel-label">Últimos tickets</label>' +
          '<div class="panel-historial-lista">' + htmlUltimos + '</div>' +
          '<div class="panel-fila">' +
            '<button type="button" class="panel-btn panel-btn-secundario" id="btnExportarPDF">Exportar PDF</button>' +
            '<button type="button" class="panel-btn panel-btn-acento" id="btnExportarExcel">Exportar Excel</button>' +
          '</div>' +
          '<div class="panel-fila">' +
            '<button type="button" class="panel-btn panel-btn-peligro" id="btnBorrarHistorial">Borrar historial</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* --- 28. Sección: Seguridad --- */
  function construirSeccionSeguridad() {
    const seg = leerSeguridad();
    const log = leerLogFallos();
    const htmlLog = log.length === 0
      ? '<div class="panel-historial-vacio">Sin validaciones fallidas registradas.</div>'
      : log.slice(-5).reverse().map(function (l) {
          const fechaTxt = l.fecha ? new Date(l.fecha).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
          return '<div class="panel-historial-item"><span class="h-nombre">' + (l.motivo || '—') + '</span><span class="h-fecha">' + fechaTxt + '</span></div>';
        }).join('');

    return '' +
      '<div class="panel-seccion" data-seccion="seguridad">' +
        '<div class="panel-seccion-titulo">🔒 Seguridad <span class="flecha">▼</span></div>' +
        '<div class="panel-seccion-cuerpo">' +
          '<label class="panel-switch">Modo validador ciego <input type="checkbox" id="chkModoCiego"' + (seg.modoCiego ? ' checked' : '') + '></label>' +
          '<p style="font-size:11px;color:#64748b;margin:6px 0 10px 0;">Si está activo, el validador NO verá el teléfono del emisor al validar. Solo verá válido o no válido y los datos básicos.</p>' +
          '<label class="panel-switch">Registrar intentos fallidos <input type="checkbox" id="chkLogFallos"' + (seg.logFallos ? ' checked' : '') + '></label>' +
          '<label class="panel-label">Últimas validaciones fallidas</label>' +
          '<div class="panel-historial-lista">' + htmlLog + '</div>' +
          '<div class="panel-fila">' +
            '<button type="button" class="panel-btn panel-btn-peligro" id="btnBorrarLog">Borrar registro</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* --- 29. Sección: Apariencia --- */
  function construirSeccionApariencia() {
    const ap = leerApariencia();
    return '' +
      '<div class="panel-seccion" data-seccion="apariencia">' +
        '<div class="panel-seccion-titulo">🌙 Apariencia <span class="flecha">▼</span></div>' +
        '<div class="panel-seccion-cuerpo">' +
          '<label class="panel-switch">Modo oscuro <input type="checkbox" id="chkModoOscuro"' + (ap.modoOscuro ? ' checked' : '') + '></label>' +
          '<p style="font-size:11px;color:#64748b;margin:6px 0 0 0;">El modo oscuro solo afecta a la interfaz. El ticket generado siempre es claro para impresión.</p>' +
        '</div>' +
      '</div>';
  }

  /* --- 30. Sección: Respaldo --- */
  function construirSeccionRespaldo() {
    return '' +
      '<div class="panel-seccion" data-seccion="respaldo">' +
        '<div class="panel-seccion-titulo">💾 Respaldo <span class="flecha">▼</span></div>' +
        '<div class="panel-seccion-cuerpo">' +
          '<p style="font-size:12px;color:#475569;margin:0 0 10px 0;">Exporta toda la configuración (negocios, etiquetas, estilos, historial y preferencias) a un solo archivo .json.</p>' +
          '<div class="panel-fila">' +
            '<button type="button" class="panel-btn panel-btn-primario" id="btnExportarConfig">Exportar todo</button>' +
            '<button type="button" class="panel-btn panel-btn-acento" id="btnImportarConfig">Importar todo</button>' +
          '</div>' +
          '<input type="file" id="inputConfigFile" accept=".json" style="display:none">' +
        '</div>' +
      '</div>';
  }

  /* ============================================================
     INSTALACIÓN DE LISTENERS DEL PANEL
     ============================================================ */
  function instalarListenersPanel() {
    /* --- Estilo del ticket --- */
    document.querySelectorAll('[data-color-cinta]').forEach(function (b) {
      b.addEventListener('click', function () {
        actualizarEstiloParcial({ colorCinta: this.dataset.colorCinta });
        construirContenidoPanel();
      });
    });
    document.querySelectorAll('[data-color-fondo]').forEach(function (b) {
      b.addEventListener('click', function () {
        actualizarEstiloParcial({ colorFondo: this.dataset.colorFondo });
        construirContenidoPanel();
      });
    });
    document.querySelectorAll('[data-color-acento]').forEach(function (b) {
      b.addEventListener('click', function () {
        actualizarEstiloParcial({ colorAcento: this.dataset.colorAcento });
        construirContenidoPanel();
      });
    });

    const chkLogo = document.getElementById('chkMostrarLogo');
    if (chkLogo) chkLogo.addEventListener('change', function () {
      actualizarEstiloParcial({ mostrarLogo: this.checked });
    });
    const selForma = document.getElementById('selFormaLogo');
    if (selForma) selForma.addEventListener('change', function () {
      actualizarEstiloParcial({ formaLogo: this.value });
    });
    const selQR = document.getElementById('selTamQR');
    if (selQR) selQR.addEventListener('change', function () {
      actualizarEstiloParcial({ tamanoQR: parseInt(this.value, 10) });
    });
    const selOrient = document.getElementById('selOrientacion');
    if (selOrient) selOrient.addEventListener('change', function () {
      actualizarEstiloParcial({ orientacion: this.value });
    });
    const selFuente = document.getElementById('selFuente');
    if (selFuente) selFuente.addEventListener('change', function () {
      actualizarEstiloParcial({ fuente: this.value });
    });
    const inpPie = document.getElementById('inpPie');
    if (inpPie) inpPie.addEventListener('input', function () {
      actualizarEstiloParcial({ pie: this.value });
    });
    const inpMarca = document.getElementById('inpMarcaAgua');
    if (inpMarca) inpMarca.addEventListener('input', function () {
      actualizarEstiloParcial({ marcaAgua: this.value });
    });

    const btnAplicar = document.getElementById('btnAplicarEstilo');
    if (btnAplicar) btnAplicar.addEventListener('click', function () {
      regenerarTicketVisible();
      alert('Estilo aplicado. El ticket se ha regenerado con los nuevos colores.');
    });

    /* --- Campos y datos --- */
    const camposMap = {
      chkCorreo: 'activarCorreo',
      chkDireccion: 'activarDireccion',
      chkNotas: 'activarNotas',
      chkOcultarVacios: 'ocultarVacios',
      chkNumeracion: 'numeracionActiva',
      chkFechaEditable: 'fechaEditable'
    };
    Object.keys(camposMap).forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', function () {
        const cfg = leerJSON('ostikec_campos_config', {});
        cfg[camposMap[id]] = this.checked;
        guardarJSON('ostikec_campos_config', cfg);
      });
    });
    const inpPrefijo = document.getElementById('inpPrefijo');
    if (inpPrefijo) inpPrefijo.addEventListener('input', function () {
      const cfg = leerJSON('ostikec_campos_config', {});
      cfg.numeracionPrefijo = this.value || 'T-';
      guardarJSON('ostikec_campos_config', cfg);
      /* Actualizar la config de numeración usada por el QR */
      guardarJSON('ostikec_numeracion_config', {
        activa: cfg.numeracionActiva === true,
        prefijo: cfg.numeracionPrefijo || 'T-'
      });
    });
    /* Actualizar también la numeración activa cada vez que se cambia el switch */
    const chkNum = document.getElementById('chkNumeracion');
    if (chkNum) chkNum.addEventListener('change', function () {
      const cfg = leerJSON('ostikec_campos_config', {});
      guardarJSON('ostikec_numeracion_config', {
        activa: this.checked,
        prefijo: cfg.numeracionPrefijo || 'T-'
      });
    });

    const btnGuardarCampos = document.getElementById('btnGuardarCampos');
    if (btnGuardarCampos) btnGuardarCampos.addEventListener('click', function () {
      alert('Cambios guardados.');
    });

    /* --- Historial --- */
    document.querySelectorAll('[data-duplicar]').forEach(function (b) {
      b.addEventListener('click', function () {
        const idx = parseInt(this.dataset.duplicar, 10);
        duplicarTicketDelHistorial(idx);
      });
    });
    const btnPDF = document.getElementById('btnExportarPDF');
    if (btnPDF) btnPDF.addEventListener('click', exportarHistorialPDF);
    const btnXLS = document.getElementById('btnExportarExcel');
    if (btnXLS) btnXLS.addEventListener('click', exportarHistorialExcel);
    const btnBorrarHist = document.getElementById('btnBorrarHistorial');
    if (btnBorrarHist) btnBorrarHist.addEventListener('click', function () {
      if (confirm('¿Borrar todo el historial de tickets? Esta acción no se puede deshacer.')) {
        guardarHistorial([]);
        construirContenidoPanel();
      }
    });

    /* --- Seguridad --- */
    const chkCiego = document.getElementById('chkModoCiego');
    if (chkCiego) chkCiego.addEventListener('change', function () {
      const s = leerSeguridad();
      s.modoCiego = this.checked;
      guardarSeguridad(s);
    });
    const chkLog = document.getElementById('chkLogFallos');
    if (chkLog) chkLog.addEventListener('change', function () {
      const s = leerSeguridad();
      s.logFallos = this.checked;
      guardarSeguridad(s);
    });
    const btnBorrarLog = document.getElementById('btnBorrarLog');
    if (btnBorrarLog) btnBorrarLog.addEventListener('click', function () {
      if (confirm('¿Borrar el registro de validaciones fallidas?')) {
        guardarJSON(CLAVE_LOG_FALLOS, []);
        construirContenidoPanel();
      }
    });

    /* --- Apariencia --- */
    const chkOscuro = document.getElementById('chkModoOscuro');
    if (chkOscuro) chkOscuro.addEventListener('change', function () {
      const ap = leerApariencia();
      ap.modoOscuro = this.checked;
      guardarApariencia(ap);
      aplicarModoOscuro();
    });

    /* --- Respaldo --- */
    const btnExpConfig = document.getElementById('btnExportarConfig');
    if (btnExpConfig) btnExpConfig.addEventListener('click', exportarConfiguracionCompleta);
    const btnImpConfig = document.getElementById('btnImportarConfig');
    if (btnImpConfig) btnImpConfig.addEventListener('click', function () {
      document.getElementById('inputConfigFile').click();
    });
    const inputConfig = document.getElementById('inputConfigFile');
    if (inputConfig) inputConfig.addEventListener('change', function () {
      if (this.files && this.files.length > 0) {
        importarConfiguracionCompleta(this.files[0]);
        this.value = '';
      }
    });

    /* --- Gráfico --- */
    setTimeout(dibujarGraficoHistorial, 30);
  }

  /* ============================================================
     OPERACIONES AUXILIARES DEL PANEL
     ============================================================ */

  /* Regenera el ticket visible con el estilo actual */
  function regenerarTicketVisible() {
    const zona = document.getElementById('zonaResultado');
    if (!zona || zona.classList.contains('oculto')) return;

    const datos = {
      f: document.getElementById('inFecha').value.trim(),
      n: document.getElementById('inNombre').value.trim(),
      t: document.getElementById('inTelefono').value.trim(),
      a: document.getElementById('inAsiento').value.trim(),
      i: document.getElementById('inIdServicio').value.trim()
    };
    if (!datos.f || !datos.n || !datos.t || !datos.a || !datos.i) return;

    try {
      const textoQR = window.construirContenidoQR(datos);
      window.dibujarTicket(datos, textoQR);
    } catch (e) {}
  }

  /* Duplica un ticket del historial rellenando el formulario */
  function duplicarTicketDelHistorial(idx) {
    const historial = leerHistorial();
    if (idx < 0 || idx >= historial.length) return;
    const h = historial[idx];

    if (h.f) document.getElementById('inFecha').value = h.f;
    if (h.n) document.getElementById('inNombre').value = h.n;
    if (h.t) document.getElementById('inTelefono').value = h.t;
    if (h.a) document.getElementById('inAsiento').value = h.a;
    if (h.i) document.getElementById('inIdServicio').value = h.i;

    /* Seleccionar el negocio si aún existe */
    if (h.negId) {
      const existe = leerNegocios().some(n => n.id === h.negId);
      if (existe) {
        guardarActivoId(h.negId);
        renderizarListaNegocios();
        actualizarSelectoresEtiquetas();
      }
    }

    cerrarPanelFlotante();
    alert('Datos del ticket cargados en el formulario. Puedes editarlos o generar uno nuevo.');
  }

  /* Dibuja el gráfico de barras de los últimos 7 días */
  function dibujarGraficoHistorial() {
    const cv = document.getElementById('panelGrafico');
    if (!cv) return;

    const cont = cv.parentNode;
    cv.width = cont.clientWidth || 320;
    cv.height = 120;
    const ctx = cv.getContext('2d');

    /* Calcular conteo por día */
    const conteo = [];
    const hoy = new Date();
    for (let i = 6; i >= 0; i--) {
      const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
      const inicio = dia.getTime();
      const fin = inicio + 24 * 60 * 60 * 1000;
      let c = 0;
      leerHistorial().forEach(function (h) {
        const t = h.fecha ? new Date(h.fecha).getTime() : 0;
        if (t >= inicio && t < fin) c++;
      });
      conteo.push({ fecha: dia, cantidad: c });
    }

    const max = Math.max(1, ...conteo.map(c => c.cantidad));
    const W = cv.width;
    const H = cv.height;
    const padX = 20;
    const padY = 22;
    const anchoBarra = (W - padX * 2) / 7 - 6;
    const alturaMax = H - padY * 2;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    conteo.forEach(function (c, i) {
      const x = padX + i * ((W - padX * 2) / 7) + 3;
      const altura = (c.cantidad / max) * alturaMax;
      const y = H - padY - altura;

      /* Barra */
      ctx.fillStyle = c.cantidad > 0 ? '#16324f' : '#e2e8f0';
      ctx.fillRect(x, y, anchoBarra, altura || 2);

      /* Número arriba */
      if (c.cantidad > 0) {
        ctx.fillStyle = '#16324f';
        ctx.font = 'bold 11px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(c.cantidad), x + anchoBarra / 2, y - 2);
      }

      /* Etiqueta del día */
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const dia = ['D','L','M','M','J','V','S'][c.fecha.getDay()];
      ctx.fillText(dia, x + anchoBarra / 2, H - padY + 4);
    });
  }

  /* ============================================================
     31. EXPORTAR HISTORIAL A PDF (jsPDF)
     ============================================================ */
  function exportarHistorialPDF() {
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
      alert('La librería PDF no está disponible. Asegúrate de haber incluido jspdf.umd.min.js en el index.html.');
      return;
    }
    const historial = leerHistorial();
    if (historial.length === 0) {
      alert('No hay tickets en el historial para exportar.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    /* Cabecera */
    doc.setFillColor(22, 50, 79);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('OSTIKEC', 14, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Historial de tickets generados', 14, 19);

    /* Info */
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(9);
    doc.text('Generado: ' + new Date().toLocaleString('es-ES'), 14, 32);
    doc.text('Total de tickets: ' + historial.length, 14, 37);

    /* Tabla */
    const startY = 45;
    const rowH = 7;
    const cols = [
      { x: 14, ancho: 25, label: 'Fecha' },
      { x: 39, ancho: 45, label: 'Nombre' },
      { x: 84, ancho: 30, label: 'Teléfono' },
      { x: 114, ancho: 30, label: 'Campo 4' },
      { x: 144, ancho: 30, label: 'Campo 5' },
      { x: 174, ancho: 22, label: 'Negocio' }
    ];

    /* Encabezado de tabla */
    doc.setFillColor(240, 244, 248);
    doc.rect(10, startY - 5, 190, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(22, 50, 79);
    cols.forEach(c => doc.text(c.label, c.x, startY));

    /* Filas */
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    let y = startY + rowH;
    const pageH = 280;

    historial.forEach(function (h, i) {
      if (y > pageH) {
        doc.addPage();
        y = 20;
      }

      const neg = h.negId ? (leerNegocios().find(n => n.id === h.negId) || {}).nombre || '—' : '—';
      const fechaTxt = h.fecha ? new Date(h.fecha).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';
      const fila = [fechaTxt, h.n || '—', h.t || '—', h.a || '—', h.i || '—', neg];

      fila.forEach(function (valor, j) {
        const texto = String(valor).substring(0, 30);
        doc.text(texto, cols[j].x, y);
      });

      /* Línea separadora */
      doc.setDrawColor(230, 230, 230);
      doc.line(10, y + 2, 200, y + 2);
      y += rowH;
    });

    /* Pie */
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('OSTIKEC © OSTICOR 2026 — Contacto: osmanitito94@zoho.com', 105, 290, { align: 'center' });

    doc.save('ostikec_historial_' + Date.now() + '.pdf');
  }

  /* ============================================================
     32. EXPORTAR HISTORIAL A EXCEL (SheetJS)
     ============================================================ */
  function exportarHistorialExcel() {
    if (typeof window.XLSX === 'undefined') {
      alert('La librería Excel no está disponible. Asegúrate de haber incluido xlsx.full.min.js en el index.html.');
      return;
    }
    const historial = leerHistorial();
    if (historial.length === 0) {
      alert('No hay tickets en el historial para exportar.');
      return;
    }

    /* Hoja 1: listado completo */
    const datos = historial.map(function (h) {
      const neg = h.negId ? (leerNegocios().find(n => n.id === h.negId) || {}).nombre || '' : '';
      return {
        'Fecha': h.fecha ? new Date(h.fecha).toLocaleString('es-ES') : '',
        'Nombre': h.n || '',
        'Teléfono': h.t || '',
        'Campo 4': h.a || '',
        'Campo 5': h.i || '',
        'Negocio': neg,
        'Emitido por': h.e || ''
      };
    });
    const ws1 = XLSX.utils.json_to_sheet(datos);

    /* Hoja 2: resumen por negocio */
    const resumen = {};
    historial.forEach(function (h) {
      const neg = h.negId ? (leerNegocios().find(n => n.id === h.negId) || {}).nombre || 'Sin negocio' : 'Sin negocio';
      resumen[neg] = (resumen[neg] || 0) + 1;
    });
    const datosResumen = Object.keys(resumen).map(k => ({ 'Negocio': k, 'Tickets': resumen[k] }));
    const ws2 = XLSX.utils.json_to_sheet(datosResumen);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Historial');
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');

    XLSX.writeFile(wb, 'ostikec_historial_' + Date.now() + '.xlsx');
  }

  /* ============================================================
     EXPORTAR / IMPORTAR CONFIGURACIÓN COMPLETA
     ============================================================ */
  function exportarConfiguracionCompleta() {
    const paquete = {
      firma: 'OSTIKEC_CONFIG',
      version: 1,
      fecha: new Date().toISOString(),
      negocios: leerNegocios(),
      negocioActivo: leerActivoId(),
      etiquetas: leerMapaEtiquetas(),
      estilos: leerMapaEstilos(),
      historial: leerHistorial(),
      numeracion: leerMapaNumeracion(),
      seguridad: leerSeguridad(),
      apariencia: leerApariencia(),
      campos: leerJSON('ostikec_campos_config', {}),
      numeracionConfig: leerJSON('ostikec_numeracion_config', {})
    };
    const json = JSON.stringify(paquete, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    descargarBlob(blob, 'ostikec_respaldo_' + Date.now() + '.json');
  }

  function importarConfiguracionCompleta(archivo) {
    const lector = new FileReader();
    lector.onload = function (e) {
      let datos;
      try { datos = JSON.parse(e.target.result); }
      catch (err) { alert('El archivo no tiene un formato válido.'); return; }

      if (!datos || datos.firma !== 'OSTIKEC_CONFIG') {
        alert('El archivo no es un respaldo válido de OSTIKEC.');
        return;
      }
      if (!confirm('¿Reemplazar TODA la configuración actual con la del respaldo? Se perderán los datos actuales.')) return;

      if (Array.isArray(datos.negocios)) guardarNegocios(datos.negocios);
      if (typeof datos.negocioActivo === 'string') guardarActivoId(datos.negocioActivo);
      if (datos.etiquetas) guardarMapaEtiquetas(datos.etiquetas);
      if (datos.estilos) guardarMapaEstilos(datos.estilos);
      if (Array.isArray(datos.historial)) guardarHistorial(datos.historial);
      if (datos.numeracion) guardarMapaNumeracion(datos.numeracion);
      if (datos.seguridad) guardarSeguridad(datos.seguridad);
      if (datos.apariencia) { guardarApariencia(datos.apariencia); aplicarModoOscuro(); }
      if (datos.campos) guardarJSON('ostikec_campos_config', datos.campos);
      if (datos.numeracionConfig) guardarJSON('ostikec_numeracion_config', datos.numeracionConfig);

      renderizarListaNegocios();
      actualizarSelectoresEtiquetas();
      refrescarPanelSiAbierto();
      alert('Configuración importada correctamente.');
    };
    lector.onerror = function () { alert('No se pudo leer el archivo.'); };
    lector.readAsText(archivo);
  }

  /* ============================================================
     INTERCEPTAR generarTicket PARA GUARDAR EN HISTORIAL
     ============================================================ */
  function instalarInterceptorGenerarTicket() {
    if (typeof window.generarTicket !== 'function') return;
    if (window.generarTicket.__ostikec_historial_instalado) return;

    const original = window.generarTicket;
    const wrapper = function () {
      /* Leer datos antes de ejecutar */
      const datos = {
        f: (document.getElementById('inFecha') || {}).value ? document.getElementById('inFecha').value.trim() : '',
        n: (document.getElementById('inNombre') || {}).value ? document.getElementById('inNombre').value.trim() : '',
        t: (document.getElementById('inTelefono') || {}).value ? document.getElementById('inTelefono').value.trim() : '',
        a: (document.getElementById('inAsiento') || {}).value ? document.getElementById('inAsiento').value.trim() : '',
        i: (document.getElementById('inIdServicio') || {}).value ? document.getElementById('inIdServicio').value.trim() : ''
      };

      original.apply(this, arguments);

      /* Guardar en el historial solo si los campos básicos tienen contenido */
      if (datos.f && datos.n && datos.t && datos.a && datos.i) {
        let emitidoPor = '';
        try {
          const sesion = JSON.parse(localStorage.getItem(CLAVE_SESION) || '{}');
          if (sesion && sesion.tel) emitidoPor = sesion.tel;
        } catch (e) {}
        agregarAlHistorial({
          fecha: new Date().toISOString(),
          f: datos.f,
          n: datos.n,
          t: datos.t,
          a: datos.a,
          i: datos.i,
          e: emitidoPor,
          negId: leerActivoId()
        });
        /* Refrescar el panel si está abierto */
        refrescarPanelSiAbierto();
      }
    };
    wrapper.__ostikec_historial_instalado = true;
    window.generarTicket = wrapper;
  }

  /* ============================================================
     33. ARRANQUE
     ============================================================ */
  window.addEventListener('DOMContentLoaded', function () {

    /* --- Aplicar modo oscuro antes de todo --- */
    aplicarModoOscuro();

    /* --- Pantalla 1: ojo de licencia y términos --- */
    if (document.getElementById('pantallaLogin')) {
      inyectarOjoLicencia();
      inyectarAvisoTerminos();
    }

    /* --- Pantallas 2 y 3: info del creador --- */
    if (document.getElementById('pantallaCreador') || document.getElementById('pantallaValidador')) {
      instalarBotonInfo();
    }

    /* --- Pantalla 2: creador --- */
    if (document.getElementById('pantallaCreador')) {
      crearBotonNegocios();
      crearModalNegocios();
      crearBotonManual();
      crearBotonFlotante();
      instalarDibujarTicketPersonalizado();
      actualizarSelectoresEtiquetas();
      instalarInterceptorGenerarTicket();
    }

    /* --- Interceptar botones de cerrar sesión --- */
    interceptarBotonesSalir();

    /* --- Marcar body cuando el creador está activo --- */
    const pantallaCreador = document.getElementById('pantallaCreador');
    if (pantallaCreador) {
      const observer = new MutationObserver(function () {
        if (pantallaCreador.classList.contains('activa') &&
            pantallaCreador.style.display !== 'none') {
          document.body.classList.add('creador-activo');
        } else {
          document.body.classList.remove('creador-activo');
        }
      });
      observer.observe(pantallaCreador, { attributes: true, attributeFilter: ['class', 'style'] });
      /* Comprobar estado inicial */
      if (pantallaCreador.classList.contains('activa') &&
          pantallaCreador.style.display !== 'none') {
        document.body.classList.add('creador-activo');
      }
    }

  });

})();