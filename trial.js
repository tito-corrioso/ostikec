/* ============================================================================
   TRIAL.JS v2 — Modo prueba gratuita de OSTIKEC (autocontenido)
   ============================================================================
   Permite al usuario probar OSTIKEC durante N tickets sin licencia.

   TODO el sistema vive en este archivo. No requiere modificar ningún otro.
   Para desactivarlo: borrar este archivo y su <script> en index.html.

   QUÉ SE BLOQUEA EN MODO PRUEBA:
     - Botón Negocios (💼)         → oculto
     - Botón Lector QR (▦)          → oculto
     - Botón flotante del Panel (⚙) → oculto
     - Botón "Crear Ostikec"        → bloqueado tras agotar los tickets
     - Todos los tickets generados  → marcados con "demo": true en el QR
     - Marca de agua "DEMO"         → sobre el ticket

   QUÉ SE PERMITE EN MODO PRUEBA:
     - Crear hasta N tickets (con marca DEMO)
     - Descargar y compartir el ticket
     - Limpiar el formulario
     - Abrir el manual
     - Cambiar de negocio activo si ya había alguno (no se puede crear)
     - Ver el historial de sus propios tickets demo

   RESET DEL DESARROLLADOR (3 métodos):
     1. URL con hash:      file:///.../index.html#resettrial
     2. Pulsar 5s el logo OT en el login
     3. Consola:           window.OSTIKEC_TRIAL.reset()
   ============================================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. CONFIGURACIÓN — AJUSTA AQUÍ
     ============================================================ */
  const CONFIG_PRUEBA = {
    activa: true,       // false para desactivar la prueba sin quitar el archivo
    maxTickets: 10,     // cuántos tickets puede generar antes de bloquearse
    maxDias: 0          // 0 = sin caducidad por tiempo. Ej. 7 = 7 días.
  };

  /* Botones que se ocultan en modo prueba */
  const BOTONES_BLOQUEADOS = [
    'btnNegocios',       // 💼 Negocios y servicios
    'btnAbrirLector',    // ▦ Leer código QR
    'btnFlotanteMenu'    // ⚙ Panel de opciones
  ];

  /* Claves de almacenamiento (las 3 primeras son redundantes) */
  const CLAVES = {
    principal:  'ostikec_trial',
    secundaria: 'ostikec_cache_001',
    stats:      'ostikec_stats'
  };

  /* ============================================================
     2. ESTADO INTERNO
     ============================================================ */
  let trialActivo = false;
  let trialData   = null;
  let intervaloBloqueos = null;

  /* ============================================================
     3. UTILIDADES
     ============================================================ */
  function leerJSON(clave, porDefecto) {
    try {
      const bruto = localStorage.getItem(clave);
      if (!bruto) return porDefecto;
      return JSON.parse(bruto);
    } catch (e) { return porDefecto; }
  }

  function guardarJSON(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) {}
  }

  function huellaDispositivo() {
    if (typeof window.huellaDispositivo === 'function') {
      try { return window.huellaDispositivo(); } catch (e) {}
    }
    return 'unknown';
  }

  /* ============================================================
     4. OFUSCACIÓN DE LA CLAVE SECUNDARIA
     ============================================================ */
  const ALFABETO_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  function ofuscarTrial(data) {
    try {
      const json = JSON.stringify(data);
      const b64 = btoa(unescape(encodeURIComponent(json)));
      let out = '';
      for (let i = 0; i < b64.length; i++) {
        const ch = b64[i];
        if (ch === '=') { out += '='; continue; }
        const idx = ALFABETO_B64.indexOf(ch);
        out += ALFABETO_B64[(idx + 11 + i * 5) % 64];
      }
      return out;
    } catch (e) { return null; }
  }

  function desofuscarTrial(texto) {
    try {
      let b64 = '';
      for (let i = 0; i < texto.length; i++) {
        const ch = texto[i];
        if (ch === '=') { b64 += '='; continue; }
        const idx = ALFABETO_B64.indexOf(ch);
        if (idx < 0) return null;
        let nuevo = (idx - 11 - i * 5) % 64;
        if (nuevo < 0) nuevo += 64;
        b64 += ALFABETO_B64[nuevo];
      }
      return JSON.parse(decodeURIComponent(escape(atob(b64))));
    } catch (e) { return null; }
  }

  /* ============================================================
     5. ALMACENAMIENTO REDUNDANTE
     ============================================================ */
  function leerTrial() {
    const a = leerJSON(CLAVES.principal, null);

    let b = null;
    try {
      const bRaw = localStorage.getItem(CLAVES.secundaria);
      b = bRaw ? desofuscarTrial(bRaw) : null;
    } catch (e) {}

    const c = leerJSON(CLAVES.stats, null);
    const cNorm = (c && typeof c.v === 'number')
      ? { usados: c.v, inicio: c.t, huella: c.h, agotada: c.v >= CONFIG_PRUEBA.maxTickets }
      : null;

    const candidatos = [a, b, cNorm].filter(function (x) {
      return x && typeof x.usados === 'number';
    });

    if (candidatos.length === 0) return null;

    /* Se queda con el más restrictivo (mayor usados) */
    return candidatos.reduce(function (max, cur) {
      return cur.usados > max.usados ? cur : max;
    });
  }

  function guardarTrial(data) {
    guardarJSON(CLAVES.principal, data);
    const ofuscado = ofuscarTrial(data);
    if (ofuscado) {
      try { localStorage.setItem(CLAVES.secundaria, ofuscado); } catch (e) {}
    }
    guardarJSON(CLAVES.stats, { v: data.usados, t: data.inicio, h: data.huella });
  }

  function borrarTrial() {
    try {
      localStorage.removeItem(CLAVES.principal);
      localStorage.removeItem(CLAVES.secundaria);
      localStorage.removeItem(CLAVES.stats);
    } catch (e) {}
    trialActivo = false;
    trialData = null;
  }

  /* ============================================================
     6. RESET DEL DESARROLLADOR — Método 1: URL hash
     ============================================================ */
  function comprobarResetPorHash() {
    if (location.hash === '#resettrial' ||
        location.search.indexOf('resettrial') !== -1) {
      borrarTrial();
      console.log('✅ Trial reseteado por hash');
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
    }
  }

  /* ============================================================
     7. RESET DEL DESARROLLADOR — Método 2: pulsación larga del logo
     ============================================================ */
  function instalarResetPorLogo() {
    const logo = document.querySelector('#pantallaLogin .logo-grande');
    if (!logo || logo.dataset.trialResetInstalado === '1') return;

    logo.dataset.trialResetInstalado = '1';
    logo.style.cursor = 'pointer';
    logo.style.userSelect = 'none';
    logo.style.webkitUserSelect = 'none';

    let timer = null;

    const iniciar = function () {
      if (timer) return;
      timer = setTimeout(function () {
        timer = null;
        borrarTrial();
        alert('✅ Prueba reseteada. Puedes empezar de nuevo.');
        try { location.reload(); } catch (e) {}
      }, 5000);
    };

    const cancelar = function () {
      if (timer) { clearTimeout(timer); timer = null; }
    };

    logo.addEventListener('mousedown', iniciar);
    logo.addEventListener('touchstart', iniciar, { passive: true });
    logo.addEventListener('mouseup', cancelar);
    logo.addEventListener('mouseleave', cancelar);
    logo.addEventListener('touchend', cancelar);
    logo.addEventListener('touchcancel', cancelar);
  }

  /* ============================================================
     8. BLOQUEOS DE OPCIONES EN MODO PRUEBA
     ============================================================ */
  function aplicarBloqueos() {
    BOTONES_BLOQUEADOS.forEach(function (id) {
      const el = document.getElementById(id);
      if (el && el.style.display !== 'none') {
        el.style.display = 'none';
        el.dataset.trialOculto = '1';
      }
    });
  }

  function quitarBloqueos() {
    document.querySelectorAll('[data-trial-oculto="1"]').forEach(function (el) {
      el.style.display = '';
      delete el.dataset.trialOculto;
    });
  }

  function iniciarVigilanciaBloqueos() {
    if (intervaloBloqueos) return;
    /* Los botones se crean dinámicamente en extras.js; hay que vigilar
       periódicamente para ocultarlos en cuanto aparezcan. */
    intervaloBloqueos = setInterval(function () {
      if (trialActivo) aplicarBloqueos();
      else quitarBloqueos();
    }, 500);
  }

  /* ============================================================
     9. UI — BOTÓN "COMENZAR PRUEBA GRATUITA" EN EL LOGIN
     ============================================================ */
  function inyectarBotonPrueba() {
    if (!CONFIG_PRUEBA.activa) return;

    const tarjeta = document.querySelector('#pantallaLogin .tarjeta');
    if (!tarjeta) return;
    if (document.getElementById('btnProbarGratis')) return;

    const loginError = document.getElementById('loginError');
    const btnEntrar = document.getElementById('btnEntrar');
    if (!btnEntrar) return;

    const wrap = document.createElement('div');
    wrap.id = 'bloquePrueba';
    wrap.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin:18px 0 12px 0;">' +
        '<div style="flex:1;height:1px;background:#e2e8f0;"></div>' +
        '<span style="font-size:11px;color:#94a3b8;font-weight:700;letter-spacing:0.5px;">O</span>' +
        '<div style="flex:1;height:1px;background:#e2e8f0;"></div>' +
      '</div>' +
      '<button id="btnProbarGratis" type="button" ' +
        'style="width:100%;padding:13px;border:2px dashed #16324f;' +
        'background:#f8fafc;color:#16324f;border-radius:10px;' +
        'font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">' +
        'Comenzar prueba gratuita' +
      '</button>' +
      '<p id="trialInfoLogin" style="font-size:11px;color:#64748b;' +
        'text-align:center;margin:8px 0 0 0;line-height:1.4;">' +
        'Prueba ' + CONFIG_PRUEBA.maxTickets + ' tickets sin licencia.' +
      '</p>';

    if (loginError && loginError.parentNode) {
      loginError.parentNode.insertBefore(wrap, loginError);
    } else {
      tarjeta.appendChild(wrap);
    }

    document.getElementById('btnProbarGratis').addEventListener('click', iniciarModoPrueba);

    /* Si la prueba ya está agotada, cambiar el aspecto del botón */
    const t = leerTrial();
    if (t && t.agotada) {
      const btn = document.getElementById('btnProbarGratis');
      const info = document.getElementById('trialInfoLogin');
      if (btn) {
        btn.textContent = 'Prueba agotada — Obtener licencia';
        btn.style.borderStyle = 'solid';
        btn.style.borderColor = '#991b1b';
        btn.style.color = '#991b1b';
        btn.style.background = '#fee2e2';
      }
      if (info) info.textContent = 'Tu prueba gratuita ya fue utilizada.';
    }
  }

  /* ============================================================
     10. INICIAR MODO PRUEBA
     ============================================================ */
  function iniciarModoPrueba() {
    if (!CONFIG_PRUEBA.activa) {
      alert('La prueba gratuita no está disponible en este momento.');
      return;
    }

    let t = leerTrial();

    /* Primera vez */
    if (!t) {
      t = {
        inicio: Date.now(),
        usados: 0,
        agotada: false,
        huella: huellaDispositivo()
      };
      guardarTrial(t);
    }

    /* Ya agotada */
    if (t.agotada) {
      mostrarModalPruebaAgotada();
      return;
    }

    /* Caducidad por tiempo (si aplica) */
    if (CONFIG_PRUEBA.maxDias > 0) {
      const dias = (Date.now() - t.inicio) / 86400000;
      if (dias >= CONFIG_PRUEBA.maxDias) {
        t.agotada = true;
        guardarTrial(t);
        mostrarModalPruebaAgotada();
        return;
      }
    }

    /* Activar modo prueba */
    trialData = t;
    trialActivo = true;

    const loginError = document.getElementById('loginError');
    if (loginError) loginError.classList.remove('visible');

    if (typeof window.entrarAplicacion === 'function') {
      window.entrarAplicacion('creador');
    }

    /* Inyectar banner y aplicar bloqueos tras un breve retardo */
    setTimeout(function () {
      inyectarBannerPrueba();
      aplicarBloqueos();
      iniciarVigilanciaBloqueos();
    }, 200);
  }

  /* ============================================================
     11. CONSUMIR UN TICKET DE LA PRUEBA
     ============================================================ */
  function consumirTicketPrueba() {
    if (!trialActivo) return;

    const t = leerTrial();
    if (!t || t.agotada) return;

    t.usados++;
    if (t.usados >= CONFIG_PRUEBA.maxTickets) {
      t.agotada = true;
    }
    guardarTrial(t);
    trialData = t;

    actualizarBannerPrueba();

    if (t.agotada) {
      setTimeout(mostrarModalPruebaAgotada, 500);
    }
  }

  /* ============================================================
     12. BANNER SUPERIOR EN LA PANTALLA DEL CREADOR
     ============================================================ */
  function inyectarBannerPrueba() {
    if (!trialActivo) return;

    const pantalla = document.getElementById('pantallaCreador');
    if (!pantalla) return;

    if (!document.getElementById('bannerPrueba')) {
      const barra = pantalla.querySelector('.barra-superior');
      const main = pantalla.querySelector('main');
      if (!barra || !main) return;

      const banner = document.createElement('div');
      banner.id = 'bannerPrueba';
      banner.style.cssText =
        'background:#fff9e6;border-bottom:2px solid #f2a900;' +
        'padding:10px 14px;display:flex;align-items:center;gap:10px;' +
        'flex-wrap:wrap;font-size:12px;color:#7a5500;line-height:1.4;';
      barra.parentNode.insertBefore(banner, main);
    }

    actualizarBannerPrueba();
  }

  function actualizarBannerPrueba() {
    const banner = document.getElementById('bannerPrueba');
    if (!banner) return;

    const t = trialData || leerTrial();
    if (!t) return;

    const restantes = Math.max(0, CONFIG_PRUEBA.maxTickets - t.usados);
    const texto = t.agotada
      ? 'Prueba finalizada. Adquiere tu licencia para seguir generando tickets.'
      : 'MODO PRUEBA — Te quedan <b>' + restantes + '</b> de ' +
        CONFIG_PRUEBA.maxTickets + ' tickets.';

    banner.innerHTML =
      '<div style="flex:1 1 200px;min-width:0;">⚠ ' + texto + '</div>' +
      '<button id="btnBannerLicencia" type="button" ' +
        'style="padding:6px 12px;border:none;border-radius:6px;' +
        'background:#16324f;color:#fff;font-size:12px;font-weight:700;' +
        'cursor:pointer;font-family:inherit;white-space:nowrap;">' +
        'Obtener licencia' +
      '</button>';

    const btn = document.getElementById('btnBannerLicencia');
    if (btn) btn.addEventListener('click', mostrarModalPruebaAgotada);
  }

  /* ============================================================
     13. MODAL "PRUEBA AGOTADA"
     ============================================================ */
  function mostrarModalPruebaAgotada() {
    const existente = document.getElementById('modalPruebaAgotada');
    if (existente) {
      existente.classList.add('visible');
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'modalPruebaAgotada';
    modal.className = 'modal';
    modal.innerHTML =
      '<div class="modal-caja" style="max-width:400px;">' +
        '<div class="modal-cabecera">' +
          '<h3>Prueba finalizada</h3>' +
          '<button id="btnCerrarPruebaAgotada" class="btn-cerrar" type="button">✕</button>' +
        '</div>' +
        '<div class="modal-cuerpo" style="text-align:center;">' +
          '<div style="font-size:52px;margin:8px 0 14px 0;">🔒</div>' +
          '<p style="font-size:15px;color:#334155;line-height:1.55;margin:0 0 8px 0;">' +
            'Has utilizado los <b>' + CONFIG_PRUEBA.maxTickets + ' tickets</b> de prueba.' +
          '</p>' +
          '<p style="font-size:13px;color:#64748b;line-height:1.55;margin:0 0 18px 0;">' +
            'Para seguir generando tickets, adquiere tu licencia personal. ' +
            'Tus datos, negocios y estilos se conservarán.' +
          '</p>' +
          '<a href="https://t.me/+4atqFg3ymcpjNWFh" target="_blank" rel="noopener" ' +
            'style="display:block;padding:12px;background:#f2a900;color:#16324f;' +
            'border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;' +
            'margin-bottom:10px;">Solicitar licencia por Telegram</a>' +
          '<a href="mailto:osmanitito94@zoho.com" ' +
            'style="display:block;padding:10px;background:#eef2f7;color:#16324f;' +
            'border-radius:10px;font-weight:700;text-decoration:none;font-size:13px;' +
            'margin-bottom:10px;">Escribir a osmanitito94@zoho.com</a>' +
          '<button id="btnVolverLogin" type="button" ' +
            'style="width:100%;padding:10px;background:#e2e8f0;color:#334155;' +
            'border:none;border-radius:10px;font-weight:700;font-size:13px;' +
            'cursor:pointer;font-family:inherit;">Ya tengo licencia</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    modal.classList.add('visible');

    document.getElementById('btnCerrarPruebaAgotada').addEventListener('click', function () {
      modal.classList.remove('visible');
    });
    document.getElementById('btnVolverLogin').addEventListener('click', function () {
      modal.classList.remove('visible');
      if (typeof window.cerrarSesion === 'function') window.cerrarSesion();
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.classList.remove('visible');
    });
  }

  /* ============================================================
     14. MONKEY-PATCH — construirContenidoQR (marca demo)
     ============================================================ */
  function parchearConstruirQR() {
    if (typeof window.construirContenidoQR !== 'function') return;
    if (window.construirContenidoQR.__trialInstalado) return;

    const original = window.construirContenidoQR;
    const wrapper = function () {
      const datos = arguments[0];
      if (trialActivo && datos && typeof datos === 'object') {
        datos.demo = true;
      }
      return original.apply(this, arguments);
    };
    wrapper.__trialInstalado = true;
    window.construirContenidoQR = wrapper;
  }

  /* ============================================================
     15. MONKEY-PATCH — dibujarTicket (marca de agua DEMO)
     ============================================================ */
  function parchearDibujarTicket() {
    if (typeof window.dibujarTicket !== 'function') return;
    if (window.dibujarTicket.__trialInstalado) return;

    const original = window.dibujarTicket;
    const wrapper = function () {
      original.apply(this, arguments);
      if (!trialActivo) return;

      const cv = document.getElementById('canvasTicket');
      if (!cv || !cv.width || !cv.height) return;

      const ctx = cv.getContext('2d');
      const W = cv.width;
      const H = cv.height;

      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#f2a900';
      ctx.font = 'bold ' + Math.round(W * 0.20) + 'px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-Math.PI / 6);
      ctx.fillText('DEMO', 0, 0);
      ctx.restore();
    };
    wrapper.__trialInstalado = true;
    window.dibujarTicket = wrapper;
  }

  /* ============================================================
     16. MONKEY-PATCH — generarTicket (consumo + bloqueo al agotar)
     ============================================================ */
  function parchearGenerarTicket() {
    if (typeof window.generarTicket !== 'function') return;
    if (window.generarTicket.__trialInstalado) return;

    const original = window.generarTicket;
    const wrapper = function () {
      /* Fuera de modo prueba: comportamiento normal */
      if (!trialActivo) {
        return original.apply(this, arguments);
      }

      /* En modo prueba, comprobar si está agotada */
      const t = leerTrial();
      if (t && t.agotada) {
        mostrarModalPruebaAgotada();
        return;
      }

      /* Llamar al original */
      original.apply(this, arguments);

      /* Verificar si el ticket se mostró correctamente y descontar */
      setTimeout(function () {
        const zona = document.getElementById('zonaResultado');
        const mostrado = zona && !zona.classList.contains('oculto');
        if (mostrado) consumirTicketPrueba();
      }, 100);
    };
    wrapper.__trialInstalado = true;
    window.generarTicket = wrapper;
  }

  /* ============================================================
     17. MONKEY-PATCH — mostrarResultadoValidacion (banner amarillo)
     ============================================================ */
  function parchearMostrarResultadoValidacion() {
    if (typeof window.mostrarResultadoValidacion !== 'function') return;
    if (window.mostrarResultadoValidacion.__trialInstalado) return;

    const original = window.mostrarResultadoValidacion;
    const wrapper = function () {
      original.apply(this, arguments);
      const esValido = arguments[0];
      const datos = arguments[1];
      if (esValido && datos && datos.demo) {
        const banner = document.getElementById('bannerValidacion');
        if (banner) {
          banner.className = 'banner-validacion';
          banner.style.background = '#fff9e6';
          banner.style.color = '#7a5500';
          banner.textContent = '⚠ TICKET DE DEMOSTRACIÓN';
        }
      }
    };
    wrapper.__trialInstalado = true;
    window.mostrarResultadoValidacion = wrapper;
  }

  /* ============================================================
     18. MONKEY-PATCH — mostrarResultadoValidador (banner amarillo)
     ============================================================ */
  function parchearMostrarResultadoValidador() {
    if (typeof window.mostrarResultadoValidador !== 'function') return;
    if (window.mostrarResultadoValidador.__trialInstalado) return;

    const original = window.mostrarResultadoValidador;
    const wrapper = function () {
      original.apply(this, arguments);
      const resultado = arguments[0];
      if (resultado && resultado.valido && resultado.datos && resultado.datos.demo) {
        const banner = document.getElementById('bannerValidacion3');
        if (banner) {
          banner.className = 'banner-validacion';
          banner.style.background = '#fff9e6';
          banner.style.color = '#7a5500';
          banner.textContent = '⚠ TICKET DE DEMOSTRACIÓN';
        }
      }
    };
    wrapper.__trialInstalado = true;
    window.mostrarResultadoValidador = wrapper;
  }

  /* ============================================================
     19. MONKEY-PATCH — cerrarSesion (limpieza)
     ============================================================ */
  function parchearCerrarSesion() {
    if (typeof window.cerrarSesion !== 'function') return;
    if (window.cerrarSesion.__trialInstalado) return;

    const original = window.cerrarSesion;
    const wrapper = function () {
      /* Desactivar modo prueba */
      trialActivo = false;
      trialData = null;

      /* Quitar banner si existe */
      const banner = document.getElementById('bannerPrueba');
      if (banner && banner.parentNode) banner.parentNode.removeChild(banner);

      /* Restaurar botones bloqueados */
      quitarBloqueos();

      /* Llamar al original */
      return original.apply(this, arguments);
    };
    wrapper.__trialInstalado = true;
    window.cerrarSesion = wrapper;
  }

  /* ============================================================
     20. ARRANQUE
     ============================================================ */
  function instalarTodo() {
    parchearConstruirQR();
    parchearDibujarTicket();
    parchearGenerarTicket();
    parchearMostrarResultadoValidacion();
    parchearMostrarResultadoValidador();
    parchearCerrarSesion();

    inyectarBotonPrueba();
    instalarResetPorLogo();
    iniciarVigilanciaBloqueos();
  }

  /* Reset por hash: comprobar antes de que cargue el DOM */
  comprobarResetPorHash();

  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(instalarTodo, 50);
  });

  /* ============================================================
     21. API PÚBLICA
     ============================================================ */
  window.OSTIKEC_TRIAL = {
    estaActivo: function () { return trialActivo; },
    leer:       leerTrial,
    consumir:   consumirTicketPrueba,
    iniciar:    iniciarModoPrueba,
    reset:      function () {
      borrarTrial();
      try { location.reload(); } catch (e) {}
    },
    config:     CONFIG_PRUEBA
  };

})();