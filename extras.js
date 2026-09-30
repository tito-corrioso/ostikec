/* ============================================================================
   EXTRAS.JS — Añadidos a OSTIKEC sin modificar el código original
   ============================================================================
   Contenido:
     1. Botón en la pantalla 2 (creador) para gestionar Negocios/Servicios.
     2. Modal con dos campos y lista de combinaciones guardadas.
     3. Botones para EXPORTAR e IMPORTAR las combinaciones (archivo .json),
        lo que permite pasarlas a otro dispositivo.
     4. Al generar un ticket, el nombre del negocio se dibuja en la esquina
        superior derecha, y los datos del servicio debajo de la fecha de emisión.
     5. El texto "OSTIKEC" de la barra superior (pantallas 2 y 3) es pulsable
        y abre un modal con la información del creador.
     6. Añade el número de teléfono en el código QR para validar el ticket 

   Requiere que se cargue DESPUÉS del script principal de index.html.
   Si se elimina este archivo, la app sigue funcionando igual que antes.
   ============================================================================ */

(function () {
  'use strict';

  /* Claves de almacenamiento local */
  const CLAVE_NEGOCIOS        = 'ostikec_negocios';
  const CLAVE_NEGOCIO_ACTIVO  = 'ostikec_negocio_activo';

  /* Nombre del archivo exportado y firma del formato */
  const FIRMA_ARCHIVO   = 'OSTIKEC_NEGOCIOS';
  const VERSION_FORMATO = 1;

  /* ========================================================================
     ALMACENAMIENTO LOCAL
     ======================================================================== */

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

  /* ========================================================================
     BOTÓN EN LA BARRA SUPERIOR DEL CREADOR
     ======================================================================== */

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

  /* ========================================================================
     MODAL DE NEGOCIOS
     ======================================================================== */

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

          /* ---- Formulario de alta ---- */
          '<div class="neg-form">' +
            '<label for="negNombre">Nombre de la Institución</label>' +
            '<input id="negNombre" type="text" placeholder="Ej. Teatro Nacional" autocomplete="off">' +
            '<label for="negServicio">Datos del Servicio</label>' +
            '<input id="negServicio" type="text" placeholder="Ej. Función de las 8:00 PM - Sala A" autocomplete="off">' +
            '<button id="btnGuardarNegocio" class="btn btn-acento" style="margin-top:6px;">' +
              'Guardar combinación' +
            '</button>' +
          '</div>' +

          /* ---- Lista de combinaciones ---- */
          '<h4 class="neg-lista-titulo">Combinaciones guardadas</h4>' +
          '<div id="negLista" class="neg-lista"></div>' +
          '<div id="negVacio" class="neg-vacio">Todavía no hay combinaciones guardadas.</div>' +

          /* ---- Botones Exportar / Importar ---- */
          '<div class="acciones" style="margin-top:16px;">' +
            '<button id="btnExportarNeg" class="btn btn-secundario">Exportar</button>' +
            '<button id="btnImportarNeg" class="btn btn-acento">Importar</button>' +
          '</div>' +

          /* ---- Input oculto para importar ---- */
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

  /* ========================================================================
     GUARDAR / LISTAR / BORRAR / SELECCIONAR
     ======================================================================== */

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
  }

  function borrarNegocio(id) {
    let lista = leerNegocios();
    lista = lista.filter(n => n.id !== id);
    guardarNegocios(lista);
    if (leerActivoId() === id) guardarActivoId('');
    renderizarListaNegocios();
  }

  function seleccionarNegocio(id) {
    guardarActivoId(id);
    renderizarListaNegocios();
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

  /* ========================================================================
     EXPORTAR E IMPORTAR
     ======================================================================== */

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
      negocios: lista
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
    } catch (e) { /* seguimos con la descarga normal */ }

    descargarBlob(blob, nombreArchivo);
  }

  function importarNegocios(archivo) {
    const lector = new FileReader();

    lector.onload = function (e) {
      let datos;
      try {
        datos = JSON.parse(e.target.result);
      } catch (err) {
        alert('El archivo no tiene un formato válido.');
        return;
      }

      let lista;
      if (Array.isArray(datos)) {
        lista = datos;
      } else if (datos && Array.isArray(datos.negocios)) {
        lista = datos.negocios;
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
      renderizarListaNegocios();

      let mensaje = 'Se importaron ' + agregados + ' combinación(es).';
      if (duplicados > 0) mensaje += '\nSe omitieron ' + duplicados + ' por estar duplicadas.';
      alert(mensaje);
    };

    lector.onerror = function () {
      alert('No se pudo leer el archivo.');
    };

    lector.readAsText(archivo);
  }

  /* ========================================================================
     MODAL: INFORMACIÓN DEL CREADOR
     Se abre al pulsar el texto "OSTIKEC" de la barra superior en las
     pantallas 2 (creador) y 3 (validador). En el login no se instala.
     ======================================================================== */

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

  /* ========================================================================
     ENVOLVER TEXTO (copia local, para no depender del scope original)
     ======================================================================== */

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

  /* ========================================================================
     SOBRESCRIBIR dibujarTicket PARA AÑADIR LOS DOS ELEMENTOS
     ======================================================================== */

  function instalarExtensionTicket() {
    if (typeof window.dibujarTicket !== 'function') return;

    const original = window.dibujarTicket;

    window.dibujarTicket = function (datos, textoQR) {
       original.call(this, datos, textoQR);

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

  /* ========================================================================
     ARRANQUE
     ======================================================================== */

  window.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('pantallaCreador')) return;

    crearBotonNegocios();
    crearModalNegocios();
    instalarExtensionTicket();
    instalarBotonInfo();
  });

   /* ========================================================================
   MOSTRAR TELÉFONO EMISOR EN LAS VENTANAS DE VALIDACIÓN
   ======================================================================== */

/* Envolvemos mostrarResultadoValidacion (usado por la pantalla 2 - creador) */
(function () {
  if (typeof window.mostrarResultadoValidacion !== 'function') return;
  const originalValidacion = window.mostrarResultadoValidacion;
  window.mostrarResultadoValidacion = function (esValido, datos, error) {
    if (esValido && datos && datos.e) {
      /* Guardamos temporalmente el teléfono emisor para que la tabla lo muestre */
      const tablaOriginal = document.getElementById('tablaDatos');
      const htmlOriginal = tablaOriginal ? tablaOriginal.innerHTML : '';
      /* Llamamos al original y luego añadimos la fila extra */
      originalValidacion.call(this, esValido, datos, error);
      if (tablaOriginal) {
        tablaOriginal.innerHTML +=
          '<tr><td>Emitido por</td><td>' + datos.e + '</td></tr>';
      }
    } else {
      originalValidacion.call(this, esValido, datos, error);
    }
  };
})();

/* Envolvemos mostrarResultadoValidador (usado por la pantalla 3 - validador) */
(function () {
  if (typeof window.mostrarResultadoValidador !== 'function') return;
  const originalValidador = window.mostrarResultadoValidador;
  window.mostrarResultadoValidador = function (resultado) {
    originalValidador.call(this, resultado);
    if (resultado && resultado.valido && resultado.datos && resultado.datos.e) {
      const tabla = document.getElementById('tablaDatos3');
      if (tabla) {
        tabla.innerHTML +=
          '<tr><td>Emitido por</td><td>' + resultado.datos.e + '</td></tr>';
      }
    }
  };
})();

     /* ========================================================================
     AÑADIR TELÉFONO EMISOR AL CONTENIDO DEL QR
     Se intercepta construirContenidoQR (que se ejecuta ANTES que dibujarTicket),
     para que el teléfono quede dentro del QR cifrado y firmado.
     ======================================================================== */
  (function () {
    if (typeof window.construirContenidoQR !== 'function') return;
    const originalContenido = window.construirContenidoQR;
    window.construirContenidoQR = function (datos) {
      try {
        const sesion = JSON.parse(localStorage.getItem('ostikec_sesion') || '{}');
        if (sesion && sesion.tel) {
          datos.e = sesion.tel;
        }
      } catch (err) {}
      return originalContenido.call(this, datos);
    };
  })();
   
})();
