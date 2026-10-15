/* ============================================================================
   UPDATE.JS — Aviso de actualizaciones
   ============================================================================
   Consulta un archivo update.json en GitHub Pages y avisa al usuario si
   hay una versión más reciente disponible.

   - Solo consulta una vez cada 24 horas.
   - Si no hay internet, no hace nada.
   - Si la actualización es forzada (force_update: true), el modal no
     se puede cerrar hasta que el usuario pulse "Descargar".

   Este archivo SÍ debe incluirse en el APK.
   ============================================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. CONFIGURACIÓN
     ============================================================ */
  const URL_UPDATE           = 'https://tito-corrioso.github.io/ostikec/update.json';
  const CLAVE_ULTIMA_CONSULTA = 'ostikec_update_last_check';
  const CLAVE_YA_AVISADO      = 'ostikec_update_notified';
  const HORAS_ENTRE_CONSULTAS = 24;
  const DELAY_CONSULTA        = 3000;

  /* ============================================================
     2. UTILIDADES
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

  /* Compara dos versiones tipo "26.80.20". Devuelve:
       -1 si a < b
        0 si a === b
        1 si a > b */
  function compararVersiones(a, b) {
    const pa = String(a || '').split('.').map(function (x) { return parseInt(x, 10) || 0; });
    const pb = String(b || '').split('.').map(function (x) { return parseInt(x, 10) || 0; });
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na < nb) return -1;
      if (na > nb) return 1;
    }
    return 0;
  }

  /* ============================================================
     3. CONSULTA
     ============================================================ */
  function puedeConsultar() {
    const ultima = leerJSON(CLAVE_ULTIMA_CONSULTA, 0);
    if (!ultima) return true;
    const horas = (Date.now() - ultima) / 3600000;
    return horas >= HORAS_ENTRE_CONSULTAS;
  }

  function consultar() {
    if (!puedeConsultar()) return;

    fetch(URL_UPDATE + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (datos) {
        guardarJSON(CLAVE_ULTIMA_CONSULTA, Date.now());

        if (!datos || !datos.version) return;

        const versionActual = (typeof window.VERSION_APP === 'string')
          ? window.VERSION_APP
          : '0.0.0';

        if (compararVersiones(datos.version, versionActual) <= 0) return;

        /* Evitar repetir el aviso de la misma versión en la misma instalación */
        const yaAvisado = leerJSON(CLAVE_YA_AVISADO, '');
        if (yaAvisado === datos.version) return;

        guardarJSON(CLAVE_YA_AVISADO, datos.version);
        mostrarAviso(datos);
      })
      .catch(function () {
        /* Silencioso: si no hay internet, no pasa nada */
      });
  }

  /* ============================================================
     4. AVISO
     ============================================================ */
  function mostrarAviso(datos) {
    if (datos.force_update) {
      mostrarModalForzado(datos);
    } else {
      mostrarBanner(datos);
    }
  }

  /* Banner discreto, cerrable, para actualizaciones normales */
  function mostrarBanner(datos) {
    if (document.getElementById('bannerUpdate')) return;

    const pantalla = document.getElementById('pantallaCreador') ||
                     document.getElementById('pantallaValidador') ||
                     document.getElementById('pantallaLogin');
    if (!pantalla) return;

    const ancla = pantalla.querySelector('main') || pantalla;

    const banner = document.createElement('div');
    banner.id = 'bannerUpdate';
    banner.style.cssText =
      'background:#eef2f7;border-bottom:2px solid #16324f;' +
      'padding:10px 14px;display:flex;align-items:center;gap:10px;' +
      'flex-wrap:wrap;font-size:12px;color:#16324f;line-height:1.4;' +
      'font-family:inherit;';

    const changelog = (datos.changelog || '').trim();

    banner.innerHTML =
      '<div style="flex:1 1 200px;min-width:0;">' +
        '📦 <b>Nueva versión disponible:</b> ' + datos.version +
        (changelog ? '<br><span style="color:#475569;">' + changelog + '</span>' : '') +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
        '<button id="btnUpdateDescargar" type="button" ' +
          'style="padding:6px 12px;border:none;border-radius:6px;' +
          'background:#16324f;color:#fff;font-size:12px;font-weight:700;' +
          'cursor:pointer;font-family:inherit;white-space:nowrap;">' +
          'Descargar' +
        '</button>' +
        '<button id="btnUpdateCerrar" type="button" ' +
          'style="padding:6px 12px;border:none;border-radius:6px;' +
          'background:#e2e8f0;color:#334155;font-size:12px;font-weight:700;' +
          'cursor:pointer;font-family:inherit;white-space:nowrap;">' +
          'Más tarde' +
        '</button>' +
      '</div>';

    ancla.parentNode.insertBefore(banner, ancla);

    document.getElementById('btnUpdateDescargar').addEventListener('click', function () {
      if (datos.apk_url) {
        try { window.open(datos.apk_url, '_blank'); } catch (e) {}
      }
    });

    document.getElementById('btnUpdateCerrar').addEventListener('click', function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    });
  }

  /* Modal bloqueante para actualizaciones obligatorias */
  function mostrarModalForzado(datos) {
    if (document.getElementById('modalUpdateForzado')) return;

    const modal = document.createElement('div');
    modal.id = 'modalUpdateForzado';
    modal.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;' +
      'background:rgba(9,20,32,0.92);' +
      'display:flex;align-items:center;justify-content:center;' +
      'padding:20px;font-family:inherit;';

    const changelog = (datos.changelog || '').trim();

    modal.innerHTML =
      '<div style="background:#fff;border-radius:14px;padding:24px;' +
        'max-width:380px;width:100%;text-align:center;' +
        'box-shadow:0 20px 50px rgba(0,0,0,0.4);">' +
        '<div style="font-size:52px;margin-bottom:14px;">📦</div>' +
        '<h3 style="margin:0 0 10px 0;font-size:18px;color:#16324f;font-weight:800;">' +
          'Actualización obligatoria</h3>' +
        '<p style="font-size:14px;color:#334155;line-height:1.55;margin:0 0 12px 0;">' +
          'Hay una nueva versión de OSTIKEC (' + datos.version + ') que debes instalar para continuar.</p>' +
        (changelog
          ? '<p style="font-size:13px;color:#64748b;line-height:1.5;' +
            'margin:0 0 18px 0;">' + changelog + '</p>'
          : '') +
        '<button id="btnUpdateForzadoDescargar" type="button" ' +
          'style="width:100%;padding:13px;border:none;border-radius:10px;' +
          'background:#f2a900;color:#16324f;font-size:15px;font-weight:700;' +
          'cursor:pointer;font-family:inherit;">Descargar actualización</button>' +
      '</div>';

    document.body.appendChild(modal);

    document.getElementById('btnUpdateForzadoDescargar').addEventListener('click', function () {
      if (datos.apk_url) {
        try { window.open(datos.apk_url, '_blank'); } catch (e) {}
      }
    });
  }

  /* ============================================================
     5. ARRANQUE
     ============================================================ */
  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(consultar, DELAY_CONSULTA);
  });

  /* API pública por si quieres forzar la consulta desde Eruda */
  window.OSTIKEC_UPDATE = {
    consultar: consultar,
    compararVersiones: compararVersiones
  };

})();