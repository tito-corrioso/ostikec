/* ============================================================================
   TRIAL.JS v4 — Modo prueba gratuita de OSTIKEC (autocontenido)
   ============================================================================
   Permite al usuario probar OSTIKEC durante 12 tickets sin licencia.

   TODO el sistema vive en este archivo. No requiere modificar ningún otro.
   Para desactivarlo: borrar este archivo y su <script> en index.html.

   COMPORTAMIENTO EN MODO PRUEBA:
     - Se muestran TODAS las opciones (Negocios, Lector QR, Panel).
     - Se permite generar hasta 12 tickets.
     - Los tickets generados llevan "demo": true en el QR y marca "DEMO".
     - Al agotar los 12 tickets: se ocultan Negocios, Lector QR y Panel,
       y el botón "Crear Ostikec" se desactiva mostrando un modal.

   RESET DEL DESARROLLADOR:
     - Pulsar el logo OT del login durante 12 segundos.
     - Introducir la contraseña en el modal (enmascarada, con botón de ojo).
     - La contraseña se verifica contra su hash SHA-256.
     - El hash guardado está en minúsculas para comparación tolerante.

   TOOLTIPS:
     - La primera vez que un usuario entra en modo prueba, se muestra un
       tour guiado de 6 pasos señalando las funciones principales.
     - Se marca como visto para no repetirse.

   API PÚBLICA:
     window.OSTIKEC_TRIAL.verTourDeNuevo()   → vuelve a mostrar el tour
     window.OSTIKEC_TRIAL.resetTour()        → limpia el flag del tour
     window.OSTIKEC_TRIAL.reset('clave')     → resetea el trial si la clave es correcta
   ============================================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. CONFIGURACIÓN
     ============================================================ */
  const CONFIG_PRUEBA = {
    activa: true,       // false para desactivar la prueba sin quitar el archivo
    maxTickets: 12,     // cuántos tickets puede generar antes de bloquearse
    maxDias: 0          // 0 = sin caducidad por tiempo. Ej. 7 = 7 días.
  };

  /* Hash SHA-256 de la contraseña de reset. El hash está en minúsculas.
     La contraseña NUNCA se guarda en el APK; solo este hash. */
  const HASH_CLAVE_RESET = '9fb088578c4ea5f16c611825b3ecfe42044032168c9781bc8e0c3379dcd1761d';

  /* Segundos de pulsación continua del logo para abrir el reset */
  const SEGUNDOS_PULSACION = 12;

  /* Longitud máxima aceptada en el campo de contraseña */
  const MAX_LARGO_CLAVE = 64;

  /* Botones que se ocultan cuando la prueba está AGOTADA */
  const BOTONES_BLOQUEADOS = [
    'btnNegocios',       // 💼 Negocios y servicios
    'btnAbrirLector',    // ▦ Leer código QR
    'btnFlotanteMenu'    // ⚙ Panel de opciones
  ];

  /* Claves de almacenamiento */
  const CLAVES = {
    principal:  'ostikec_trial',
    secundaria: 'ostikec_cache_001',
    stats:      'ostikec_stats',
    tour:       'ostikec_trial_tour_visto'
  };

  /* ============================================================
     2. ESTADO INTERNO
     ============================================================ */
  let trialActivo = false;
  let trialData   = null;
  let intervalBloqueos = null;
  let huboBloqueosAplicados = false;

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

  /* Envoltorio sobre el sha256Hex global de index.html */
  function sha256Hex(texto) {
    if (typeof window.sha256Hex === 'function') {
      try { return window.sha256Hex(String(texto)); } catch (e) {}
    }
    if (window.OSTIKEC && typeof window.OSTIKEC.sha256Hex === 'function') {
      try { return window.OSTIKEC.sha256Hex(String(texto)); } catch (e) {}
    }
    return '';
  }

  /* Devuelve true si la clave coincide con el hash guardado */
  function claveEsCorrecta(clave) {
    if (!clave) return false;
    const hash = sha256Hex(String(clave)).toLowerCase();
    return hash === HASH_CLAVE_RESET;
  }

  /* Comprueba si un elemento es visible en el DOM */
  function esVisible(el) {
    if (!el) return false;
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
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
      localStorage.removeItem(CLAVES.tour);
    } catch (e) {}
    trialActivo = false;
    trialData = null;
  }

  /* ============================================================
     6. MODAL DE CONTRASEÑA DE RESET
     ============================================================ */
  function pedirClaveReset() {
    /* Evitar duplicados */
    if (document.getElementById('modalResetClave')) return;

    const modal = document.createElement('div');
    modal.id = 'modalResetClave';
    modal.style.cssText =
      'position:fixed;inset:0;z-index:2147483000;' +
      'background:rgba(9,20,32,0.88);' +
      'display:flex;align-items:center;justify-content:center;padding:20px;';

    modal.innerHTML =
      '<div style="background:#fff;border-radius:14px;padding:22px;' +
        'max-width:340px;width:100%;font-family:inherit;' +
        'box-shadow:0 20px 50px rgba(0,0,0,0.4);">' +
        '<h3 style="margin:0 0 8px 0;font-size:17px;color:#16324f;font-weight:800;">' +
          'Contraseña de desarrollador</h3>' +
        '<p style="margin:0 0 14px 0;font-size:13px;color:#64748b;line-height:1.5;">' +
          'Introduce la contraseña para resetear la prueba gratuita:</p>' +
        '<div style="position:relative;">' +
          '<input id="inputResetClave" type="password" ' +
            'inputmode="text" autocomplete="new-password" spellcheck="false" ' +
            'autocapitalize="off" maxlength="' + MAX_LARGO_CLAVE + '" ' +
            'style="width:100%;padding:12px 46px 12px 12px;border:2px solid #cbd5e1;' +
            'border-radius:8px;font-size:16px;font-family:inherit;outline:none;' +
            'box-sizing:border-box;color:#16324f;font-weight:600;">' +
          '<button id="btnToggleClave" type="button" ' +
            'aria-label="Mostrar u ocultar contraseña" ' +
            'style="position:absolute;right:6px;top:50%;' +
            'transform:translateY(-50%);width:34px;height:34px;' +
            'border:none;border-radius:50%;background:#e2e8f0;color:#475569;' +
            'cursor:pointer;display:flex;align-items:center;' +
            'justify-content:center;padding:0;line-height:1;">' +
            '<svg id="svgOjoAbierto" width="18" height="18" viewBox="0 0 24 24" ' +
              'fill="none" stroke="currentColor" stroke-width="2" ' +
              'stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
              '<circle cx="12" cy="12" r="3"/></svg>' +
            '<svg id="svgOjoCerrado" width="18" height="18" viewBox="0 0 24 24" ' +
              'fill="none" stroke="currentColor" stroke-width="2" ' +
              'stroke-linecap="round" stroke-linejoin="round" ' +
              'style="display:none;">' +
              '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 ' +
                '18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 ' +
                '8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>' +
              '<line x1="1" y1="1" x2="23" y2="23"/></svg>' +
          '</button>' +
        '</div>' +
        '<div id="resetClaveError" style="font-size:12px;color:#991b1b;' +
          'text-align:center;min-height:16px;margin-top:8px;font-weight:600;"></div>' +
        '<div style="display:flex;gap:8px;margin-top:12px;">' +
          '<button id="btnResetCancelar" type="button" ' +
            'style="flex:1;padding:10px;border:none;border-radius:8px;' +
            'background:#e2e8f0;color:#334155;font-weight:700;' +
            'font-family:inherit;cursor:pointer;font-size:13px;">Cancelar</button>' +
          '<button id="btnResetAceptar" type="button" ' +
            'style="flex:1;padding:10px;border:none;border-radius:8px;' +
            'background:#16324f;color:#fff;font-weight:700;' +
            'font-family:inherit;cursor:pointer;font-size:13px;">Aceptar</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    const input  = document.getElementById('inputResetClave');
    const error  = document.getElementById('resetClaveError');
    const btnOjo = document.getElementById('btnToggleClave');
    const svgAbierto = document.getElementById('svgOjoAbierto');
    const svgCerrado = document.getElementById('svgOjoCerrado');

    setTimeout(function () {
      try { input.focus(); } catch (e) {}
    }, 100);

    /* Toggle mostrar/ocultar contraseña */
    btnOjo.addEventListener('click', function (e) {
      e.preventDefault();
      if (input.type === 'password') {
        input.type = 'text';
        svgAbierto.style.display = 'none';
        svgCerrado.style.display = '';
      } else {
        input.type = 'password';
        svgAbierto.style.display = '';
        svgCerrado.style.display = 'none';
      }
      try { input.focus(); } catch (e) {}
    });

    /* Enter para aceptar */
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        intentarAceptar();
      }
    });

    function cerrar() {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    }

    function intentarAceptar() {
      const clave = input.value;
      if (!clave) {
        error.textContent = 'Introduce la contraseña.';
        return;
      }
      if (claveEsCorrecta(clave)) {
        cerrar();
        borrarTrial();
        alert('✅ Prueba reseteada. La aplicación se reiniciará.');
        try { location.reload(); } catch (e) {}
      } else {
        error.textContent = 'Contraseña incorrecta.';
        input.value = '';
        input.type = 'password';
        svgAbierto.style.display = '';
        svgCerrado.style.display = 'none';
        try { input.focus(); } catch (e) {}
      }
    }

    document.getElementById('btnResetCancelar').addEventListener('click', cerrar);
    document.getElementById('btnResetAceptar').addEventListener('click', intentarAceptar);

    modal.addEventListener('click', function (e) {
      if (e.target === modal) cerrar();
    });
  }

  /* ============================================================
     7. PULSACIÓN LARGA DEL LOGO → RESET
     ============================================================ */
  function instalarResetPorLogo() {
    const logo = document.querySelector('#pantallaLogin .logo-grande');
    if (!logo || logo.dataset.trialResetInstalado === '1') return;

    logo.dataset.trialResetInstalado = '1';
    logo.style.cursor = 'pointer';
    logo.style.userSelect = 'none';
    logo.style.webkitUserSelect = 'none';
    logo.style.webkitTouchCallout = 'none';

    let timer = null;

    function iniciar() {
      if (timer) return;
      timer = setTimeout(function () {
        timer = null;
        pedirClaveReset();
      }, SEGUNDOS_PULSACION * 1000);
    }

    function cancelar() {
      if (timer) { clearTimeout(timer); timer = null; }
    }

    logo.addEventListener('mousedown', iniciar);
    logo.addEventListener('touchstart', iniciar, { passive: true });
    logo.addEventListener('mouseup', cancelar);
    logo.addEventListener('mouseleave', cancelar);
    logo.addEventListener('touchend', cancelar);
    logo.addEventListener('touchcancel', cancelar);
    logo.addEventListener('dragstart', function (e) { e.preventDefault(); cancelar(); });
  }

  /* ============================================================
     8. BLOQUEOS (solo cuando la prueba está agotada)
     ============================================================ */
  function debeBloquear() {
    if (!trialActivo) return false;
    const t = trialData || leerTrial();
    return !!(t && t.agotada);
  }

  function aplicarBloqueos() {
    huboBloqueosAplicados = true;

    /* Ocultar los botones prohibidos */
    BOTONES_BLOQUEADOS.forEach(function (id) {
      const el = document.getElementById(id);
      if (el && el.style.display !== 'none') {
        el.style.display = 'none';
        el.dataset.trialOculto = '1';
      }
    });

    /* Atenuar el botón Crear */
    const btnCrear = document.getElementById('btnCrear');
    if (btnCrear && btnCrear.dataset.trialBloqueado !== '1') {
      btnCrear.dataset.trialBloqueado = '1';
      btnCrear.style.opacity = '0.5';
      btnCrear.style.cursor = 'not-allowed';
      btnCrear.title = 'Prueba agotada';
    }
  }

  function quitarBloqueos() {
    if (!huboBloqueosAplicados) return;
    huboBloqueosAplicados = false;

    document.querySelectorAll('[data-trial-oculto="1"]').forEach(function (el) {
      el.style.display = '';
      delete el.dataset.trialOculto;
    });

    const btnCrear = document.getElementById('btnCrear');
    if (btnCrear && btnCrear.dataset.trialBloqueado === '1') {
      delete btnCrear.dataset.trialBloqueado;
      btnCrear.style.opacity = '';
      btnCrear.style.cursor = '';
      btnCrear.title = '';
    }
  }

  function iniciarVigilanciaBloqueos() {
    if (intervalBloqueos) return;
    intervalBloqueos = setInterval(function () {
      if (debeBloquear()) aplicarBloqueos();
      else quitarBloqueos();
    }, 500);
  }

  /* ============================================================
     9. BOTÓN "COMENZAR PRUEBA GRATUITA" EN EL LOGIN
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

    /* Inyectar banner, quitar bloqueos y arrancar vigilancia */
    setTimeout(function () {
      inyectarBannerPrueba();
      quitarBloqueos();
      iniciarVigilanciaBloqueos();

      /* Mostrar tour la primera vez */
      setTimeout(mostrarTooltips, 600);
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
      /* Esperar a que el usuario vea su último ticket antes de bloquear */
      setTimeout(mostrarModalPruebaAgotada, 800);
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
     14. TOOLTIPS — TOUR GUIADO DE 6 PASOS
     ============================================================ */
  const PASOS_TOUR = [
    {
      target: function () {
        return document.getElementById('btnNegocios');
      },
      titulo: 'Tus negocios y servicios',
      texto: 'Aquí guardas los datos de cada negocio (nombre de la institución y servicio). ' +
             'Puedes tener varios guardados y cambiar entre ellos con un toque. ' +
             'Cada negocio puede tener sus propias etiquetas para los campos 4 y 5.'
    },
    {
      target: function () {
        return document.getElementById('btnAbrirLector');
      },
      titulo: 'Valida tickets con código QR',
      texto: 'Pulsa aquí para escanear un ticket con la cámara o subir una imagen. ' +
             'La app verificará si es auténtico y mostrará todos sus datos. ' +
             'También puedes usar esta opción para rellenar el formulario desde un ticket existente.'
    },
    {
      target: function () {
        return document.getElementById('bannerPrueba');
      },
      titulo: 'Estás en modo prueba',
      texto: 'Este banner te dice cuántos tickets te quedan. Cuando llegues a ' +
             CONFIG_PRUEBA.maxTickets + ', necesitarás una licencia para seguir generando.'
    },
    {
      target: function () {
        return document.querySelector('#pantallaCreador .tarjeta .seccion-titulo');
      },
      titulo: 'Rellena los datos del cliente',
      texto: 'Aquí escribes la fecha, el nombre, el teléfono y los dos campos configurables. ' +
             'Es lo que aparecerá impreso en el ticket.'
    },
    {
      target: function () {
        return document.getElementById('btnCrear');
      },
      titulo: 'Genera el ticket',
      texto: 'Pulsa este botón para crear el ticket con su código QR. ' +
             'Aparecerá justo debajo y podrás descargarlo o compartirlo.'
    },
    {
      target: function () {
        return document.getElementById('btnFlotanteMenu');
      },
      titulo: 'Personaliza tu ticket',
      texto: 'Este botón abre el panel de opciones: colores, plantillas, marca de agua, ' +
             'historial, estadísticas, filtros y respaldo. ' +
             'Personaliza cada detalle del ticket para que lleve la identidad de tu negocio.'
    }
  ];

  let elementoResaltado = null;
  let overlayTour = null;
  let tooltipTour = null;
  let indiceTourActual = 0;

  function mostrarTooltips() {
    if (localStorage.getItem(CLAVES.tour) === '1') return;
    if (!document.getElementById('pantallaCreador')) return;

    crearEstructuraTour();
    setTimeout(function () { mostrarPasoTour(0); }, 250);
  }

  function crearEstructuraTour() {
    /* Overlay que captura clicks */
    overlayTour = document.createElement('div');
    overlayTour.id = 'trialTourOverlay';
    overlayTour.style.cssText =
      'position:fixed;inset:0;z-index:999998;background:transparent;';
    overlayTour.addEventListener('click', function (e) {
      if (tooltipTour && tooltipTour.contains(e.target)) return;
      avanzarTour();
    });
    document.body.appendChild(overlayTour);

    /* Tooltip */
    tooltipTour = document.createElement('div');
    tooltipTour.id = 'trialTourTooltip';
    tooltipTour.style.cssText =
      'position:fixed;z-index:999999;background:#ffffff;' +
      'border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,0.35);' +
      'padding:18px 18px 14px 18px;max-width:320px;font-family:inherit;' +
      'opacity:0;transition:opacity .25s;pointer-events:auto;';
    document.body.appendChild(tooltipTour);
  }

  function mostrarPasoTour(idx) {
    if (!tooltipTour) return;

    if (idx >= PASOS_TOUR.length) {
      finalizarTour();
      return;
    }

    indiceTourActual = idx;
    const paso = PASOS_TOUR[idx];
    const target = paso.target();

    /* Saltar el paso si el elemento no existe o no es visible */
    if (!target || !esVisible(target)) {
      mostrarPasoTour(idx + 1);
      return;
    }

    /* Limpiar resaltado anterior */
    if (elementoResaltado && elementoResaltado !== target) {
      limpiarResaltado(elementoResaltado);
    }
    elementoResaltado = target;

    /* Ocultar tooltip mientras reposicionamos */
    tooltipTour.style.opacity = '0';

    /* Scroll al target si es necesario */
    const rect = target.getBoundingClientRect();
    const visible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!visible) {
      try { target.scrollIntoView({ behavior: 'auto', block: 'center' }); } catch (e) {}
    }

    setTimeout(function () {
      aplicarResaltado(target);
      posicionarTooltipTour(target, idx, paso);
    }, 80);
  }

  function aplicarResaltado(el) {
    /* Guardar estilos previos para restaurarlos después */
    try {
      el.dataset.trialShadowPrev = JSON.stringify({
        position:     el.style.position,
        zIndex:       el.style.zIndex,
        boxShadow:    el.style.boxShadow,
        borderRadius: el.style.borderRadius
      });
    } catch (e) {}

    /* Solo aplicar position: relative si el elemento es estático,
       para no romper elementos con position: fixed o absolute */
    const cs = window.getComputedStyle(el);
    if (cs.position === 'static') {
      el.style.position = 'relative';
    }
    el.style.zIndex = '999999';
    el.style.boxShadow = '0 0 0 9999px rgba(13, 32, 51, 0.78)';
    el.style.borderRadius = '8px';
  }

  function limpiarResaltado(el) {
    if (!el) return;
    let prev = null;
    try { prev = JSON.parse(el.dataset.trialShadowPrev || 'null'); } catch (e) {}
    if (prev) {
      el.style.position     = prev.position     || '';
      el.style.zIndex       = prev.zIndex       || '';
      el.style.boxShadow    = prev.boxShadow    || '';
      el.style.borderRadius = prev.borderRadius || '';
    } else {
      el.style.position     = '';
      el.style.zIndex       = '';
      el.style.boxShadow    = '';
      el.style.borderRadius = '';
    }
    delete el.dataset.trialShadowPrev;
  }

  function posicionarTooltipTour(target, idx, paso) {
    const esUltimo = idx === PASOS_TOUR.length - 1;

    tooltipTour.innerHTML =
      '<div style="font-size:11px;font-weight:700;color:#f2a900;' +
        'text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">' +
        'Paso ' + (idx + 1) + ' de ' + PASOS_TOUR.length +
      '</div>' +
      '<h4 style="margin:0 0 8px 0;font-size:16px;color:#16324f;' +
        'font-weight:800;letter-spacing:0.3px;line-height:1.3;">' + paso.titulo + '</h4>' +
      '<p style="margin:0 0 14px 0;font-size:13px;color:#334155;line-height:1.55;">' +
        paso.texto +
      '</p>' +
      '<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;">' +
        '<button id="trialTourSaltar" type="button" ' +
          'style="padding:8px 12px;border:none;background:transparent;' +
          'color:#94a3b8;font-size:12px;font-weight:700;cursor:pointer;' +
          'font-family:inherit;">Saltar</button>' +
        '<button id="trialTourSiguiente" type="button" ' +
          'style="padding:8px 18px;border:none;background:#16324f;' +
          'color:#fff;border-radius:8px;font-size:13px;font-weight:700;' +
          'cursor:pointer;font-family:inherit;">' +
          (esUltimo ? 'Entendido' : 'Siguiente') +
        '</button>' +
      '</div>';

    /* Medir y posicionar */
    const rect = target.getBoundingClientRect();
    const tRect = tooltipTour.getBoundingClientRect();
    const tW = tRect.width;
    const tH = tRect.height;
    const margen = 14;

    let top = rect.bottom + margen;
    let left = rect.left + (rect.width / 2) - (tW / 2);

    /* Si no cabe debajo, poner arriba */
    if (top + tH > window.innerHeight - margen) {
      top = rect.top - tH - margen;
    }
    /* Clamp */
    if (top < margen) top = margen;
    if (left < margen) left = margen;
    if (left + tW > window.innerWidth - margen) {
      left = window.innerWidth - tW - margen;
    }

    tooltipTour.style.top = top + 'px';
    tooltipTour.style.left = left + 'px';
    tooltipTour.style.opacity = '1';

    /* Listeners */
    const btnSaltar = document.getElementById('trialTourSaltar');
    const btnSiguiente = document.getElementById('trialTourSiguiente');
    if (btnSaltar) btnSaltar.addEventListener('click', finalizarTour);
    if (btnSiguiente) btnSiguiente.addEventListener('click', avanzarTour);
  }

  function avanzarTour() {
    mostrarPasoTour(indiceTourActual + 1);
  }

  function finalizarTour() {
    if (elementoResaltado) {
      limpiarResaltado(elementoResaltado);
      elementoResaltado = null;
    }
    if (overlayTour && overlayTour.parentNode) {
      overlayTour.parentNode.removeChild(overlayTour);
      overlayTour = null;
    }
    if (tooltipTour && tooltipTour.parentNode) {
      tooltipTour.parentNode.removeChild(tooltipTour);
      tooltipTour = null;
    }
    try { localStorage.setItem(CLAVES.tour, '1'); } catch (e) {}
  }

  /* ============================================================
     15. MONKEY-PATCH — construirContenidoQR (marca demo)
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
     16. MONKEY-PATCH — dibujarTicket (marca de agua DEMO)
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
     17. MONKEY-PATCH — generarTicket (consumo + bloqueo al agotar)
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
      const t = trialData || leerTrial();
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
     18. MONKEY-PATCH — mostrarResultadoValidacion (banner correcto)
     ============================================================ */
  function parchearMostrarResultadoValidacion() {
    if (typeof window.mostrarResultadoValidacion !== 'function') return;
    if (window.mostrarResultadoValidacion.__trialInstalado) return;

    const original = window.mostrarResultadoValidacion;
    const wrapper = function () {
      original.apply(this, arguments);

      const esValido = arguments[0];
      const datos = arguments[1];
      const banner = document.getElementById('bannerValidacion');
      if (!banner) return;

      if (esValido && datos && datos.demo) {
        banner.className = 'banner-validacion';
        banner.style.background = '#fff9e6';
        banner.style.color = '#7a5500';
        banner.textContent = '⚠ TICKET DE DEMOSTRACIÓN';
      } else {
        /* Ticket normal: limpiar estilos inline para que se aplique
           la clase banner-ok o banner-malo original */
        banner.style.background = '';
        banner.style.color = '';
      }
    };
    wrapper.__trialInstalado = true;
    window.mostrarResultadoValidacion = wrapper;
  }

  /* ============================================================
     19. MONKEY-PATCH — mostrarResultadoValidador (banner correcto)
     ============================================================ */
  function parchearMostrarResultadoValidador() {
    if (typeof window.mostrarResultadoValidador !== 'function') return;
    if (window.mostrarResultadoValidador.__trialInstalado) return;

    const original = window.mostrarResultadoValidador;
    const wrapper = function () {
      original.apply(this, arguments);

      const resultado = arguments[0];
      const banner = document.getElementById('bannerValidacion3');
      if (!banner) return;

      if (resultado && resultado.valido && resultado.datos && resultado.datos.demo) {
        banner.className = 'banner-validacion';
        banner.style.background = '#fff9e6';
        banner.style.color = '#7a5500';
        banner.textContent = '⚠ TICKET DE DEMOSTRACIÓN';
      } else {
        banner.style.background = '';
        banner.style.color = '';
      }
    };
    wrapper.__trialInstalado = true;
    window.mostrarResultadoValidador = wrapper;
  }

  /* ============================================================
     20. MONKEY-PATCH — cerrarSesion (limpieza)
     ============================================================ */
  function parchearCerrarSesion() {
    if (typeof window.cerrarSesion !== 'function') return;
    if (window.cerrarSesion.__trialInstalado) return;

    const original = window.cerrarSesion;
    const wrapper = function () {
      trialActivo = false;
      trialData = null;

      const banner = document.getElementById('bannerPrueba');
      if (banner && banner.parentNode) banner.parentNode.removeChild(banner);

      /* Restaurar botones bloqueados */
      huboBloqueosAplicados = false;
      quitarBloqueos();

      return original.apply(this, arguments);
    };
    wrapper.__trialInstalado = true;
    window.cerrarSesion = wrapper;
  }

  /* ============================================================
     21. ARRANQUE
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

  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(instalarTodo, 50);
  });

  /* ============================================================
     22. API PÚBLICA
     ============================================================ */
  window.OSTIKEC_TRIAL = {
    estaActivo: function () { return trialActivo; },
    leer:       leerTrial,
    consumir:   consumirTicketPrueba,
    iniciar:    iniciarModoPrueba,

    /* Resetea el trial si la clave es correcta */
    reset: function (clave) {
      if (!claveEsCorrecta(clave)) {
        console.warn('OSTIKEC_TRIAL.reset: contraseña incorrecta');
        return false;
      }
      borrarTrial();
      try { location.reload(); } catch (e) {}
      return true;
    },

    /* Vuelve a mostrar el tour la próxima vez que se entre en modo prueba */
    verTourDeNuevo: function () {
      try { localStorage.removeItem(CLAVES.tour); } catch (e) {}
      console.log('Tour marcado para mostrarse de nuevo.');
    },

    /* Limpia el flag del tour y lo muestra inmediatamente si estamos en el creador */
    resetTour: function () {
      try { localStorage.removeItem(CLAVES.tour); } catch (e) {}
      finalizarTour();
      setTimeout(mostrarTooltips, 100);
    },

    config: CONFIG_PRUEBA
  };

})();