/* ============================================================================
   BLOQUEO.JS — Kill switch remoto
   ============================================================================
   Consulta una lista negra alojada en GitHub Pages. Si el teléfono y la
   licencia del usuario están en la lista, bloquea la app con una pantalla
   de aviso.

   Si no hay internet, usa la última lista guardada localmente.
   Si nunca ha habido conexión, no bloquea nada (fail-open).

   Este archivo SÍ debe incluirse en el APK.
   ============================================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. CONFIGURACIÓN — REEMPLAZA ESTA URL
     ============================================================ */
  /* URL del archivo blocked.json en tu GitHub Pages.
     Ejemplo: https://tunombre.github.io/turepo/blocked.json */
  const URL_LISTA_NEGRA = 'https://tito-corrioso.github.io/ostikec/blocked.json';

  /* Clave donde se guarda la lista descargada */
  const CLAVE_CACHE = 'ostikec_lista_negra';

  /* ============================================================
     2. CONSULTAR Y GUARDAR LA LISTA
     ============================================================ */

  /* Descarga la lista desde GitHub. Si falla, no hace nada. */
  function actualizarListaNegra() {
    fetch(URL_LISTA_NEGRA + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (datos) {
        if (datos && Array.isArray(datos.bloqueados)) {
          try {
            localStorage.setItem(CLAVE_CACHE, JSON.stringify(datos));
          } catch (e) {}
        }
      })
      .catch(function () {
        /* Silencioso: si no hay internet, se usa la lista guardada */
      });
  }

  /* Devuelve la lista guardada localmente, o null si no hay */
  function leerListaLocal() {
    try {
      const bruto = localStorage.getItem(CLAVE_CACHE);
      return bruto ? JSON.parse(bruto) : null;
    } catch (e) { return null; }
  }

  /* ============================================================
     3. COMPROBAR SI UN USUARIO ESTÁ BLOQUEADO
     ============================================================ */

  function estaBloqueado(telefono, licencia) {
    const lista = leerListaLocal();
    if (!lista || !Array.isArray(lista.bloqueados)) return null;

    const tel = String(telefono || '').trim();
    const lic = String(licencia || '').trim().toUpperCase();

    for (let i = 0; i < lista.bloqueados.length; i++) {
      const b = lista.bloqueados[i];
      const bTel = String(b.telefono || '').trim();
      const bLic = String(b.licencia || '').trim().toUpperCase();

      /* Coincide si teléfono Y licencia coinciden,
         o si solo coincide el teléfono (bloqueo por dispositivo),
         o si solo coincide la licencia (bloqueo por licencia robada). */
      const coincideTel = bTel && bTel === tel;
      const coincideLic = bLic && bLic === lic;

      if (coincideTel && (!bLic || coincideLic)) {
        return b;
      }
    }
    return null;
  }

  /* ============================================================
     4. PANTALLA DE BLOQUEO
     ============================================================ */

  function mostrarBloqueo(motivo) {
    /* Evitar duplicados */
    if (document.getElementById('pantallaBloqueo')) return;

    const overlay = document.createElement('div');
    overlay.id = 'pantallaBloqueo';
    overlay.style.cssText =
      'position:fixed; inset:0; z-index:99999; background:#0d2033; ' +
      'display:flex; flex-direction:column; align-items:center; ' +
      'justify-content:center; padding:30px; text-align:center; ' +
      'font-family:Arial, sans-serif; color:#ffffff;';

    overlay.innerHTML =
      '<div style="font-size:60px; margin-bottom:20px;">🚫</div>' +
      '<h1 style="font-size:22px; font-weight:800; margin:0 0 14px 0; color:#f2a900;">' +
        'ACCESO BLOQUEADO' +
      '</h1>' +
      '<p style="font-size:14px; color:#9db4cc; margin:0 0 20px 0; line-height:1.5;">' +
        'Esta licencia ha sido revocada o el dispositivo está bloqueado.<br>' +
        'Contacte al administrador del sistema.' +
      '</p>' +
      '<p style="font-size:12px; color:#64748b; margin:0;">' +
        'Motivo: ' + (motivo || 'No especificado') +
      '</p>' +
      '<p style="font-size:12px; color:#64748b; margin:20px 0 0 0;">' +
        'Contacto: osmanitito94@zoho.com' +
      '</p>';

    document.body.appendChild(overlay);
  }

  /* ============================================================
     5. INTERCEPTAR EL LOGIN PARA VERIFICAR
     ============================================================ */

  function verificarBloqueo() {
    const telefono = document.getElementById('loginTelefono').value.trim();
    const licencia = document.getElementById('loginLicencia').value.trim();

    const bloqueo = estaBloqueado(telefono, licencia);

    if (bloqueo) {
      /* Mostrar pantalla de bloqueo */
      mostrarBloqueo(bloqueo.motivo || bloqueo.fecha || '');

      /* Expulsar al usuario al login (oculta pantallas 2 y 3) */
      ['pantallaCreador', 'pantallaValidador'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) {
          el.classList.remove('activa');
          el.style.display = 'none';
        }
      });
    }
  }

  function instalarInterceptorLogin() {
    const btn = document.getElementById('btnEntrar');
    if (!btn || btn.dataset.bloqueoInstalado === '1') return;
    btn.dataset.bloqueoInstalado = '1';

    btn.addEventListener('click', function () {
      setTimeout(verificarBloqueo, 200);
    });
  }

  /* ============================================================
     6. ARRANQUE
     ============================================================ */

  window.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('pantallaLogin')) return;

    /* Primero descargar la lista actualizada */
    actualizarListaNegra();

    /* Instalar la verificación al iniciar sesión */
    instalarInterceptorLogin();

    /* Verificar también si ya había sesión guardada */
    setTimeout(verificarBloqueo, 1500);
  });

})();
