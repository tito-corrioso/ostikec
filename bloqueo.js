/* ============================================================================
   BLOQUEO.JS — Kill switch remoto (con soporte de hash)
   ============================================================================
   Consulta una lista negra alojada en GitHub Pages. Si el usuario está en
   la lista, bloquea la app con una pantalla de aviso.

   FORMATO DEL blocked.json (admite dos formatos a la vez):

     {
       "actualizado": "2026-10-15",
       "bloqueados": [
         {
           "hashCred": "6439445cb395d66ca134012935a1d2435073df59411ca2949186f8a0ff808ae8",
           "motivo": "Licencia revocada",
           "fecha": "2026-10-15"
         },
         {
           "telefono": "55555555",
           "licencia": "VV-V555-55-V",
           "motivo": "Formato antiguo, sigue funcionando",
           "fecha": "2026-09-30"
         }
       ]
     }

   - Las entradas con `hashCred` se comparan con el hash SHA-256 de la
     credencial introducida por el usuario. Es el formato recomendado.
   - Las entradas con `telefono` y/o `licencia` siguen funcionando por
     retrocompatibilidad. Se pueden dejar mientras migras.

   Si no hay internet, usa la última lista guardada localmente.
   Si nunca ha habido conexión, no bloquea nada (fail-open).

   Este archivo SÍ debe incluirse en el APK.
   ============================================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. CONFIGURACIÓN
     ============================================================ */
  const URL_LISTA_NEGRA = 'https://tito-corrioso.github.io/ostikec/blocked.json';
  const CLAVE_CACHE = 'ostikec_lista_negra';

  /* Longitud mínima de hash aceptada en comparaciones parciales.
     16 caracteres hex = 64 bits. Colisión prácticamente imposible
     en el rango de usuarios de una app personal. */
  const MIN_LARGO_HASH = 16;

  /* ============================================================
     2. CONSULTAR Y GUARDAR LA LISTA
     ============================================================ */
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

  function leerListaLocal() {
    try {
      const bruto = localStorage.getItem(CLAVE_CACHE);
      return bruto ? JSON.parse(bruto) : null;
    } catch (e) { return null; }
  }

  /* ============================================================
     3. CÁLCULO Y COMPARACIÓN DE HASH
     ============================================================ */

  /* Devuelve el hash SHA-256 (en minúsculas) de la credencial,
     usando la función global `calcularHashCredencial` de index.html.
     Si la función no existe, devuelve null. */
  function calcularHash(telefono, licencia) {
    if (typeof window.calcularHashCredencial !== 'function') return null;
    try {
      const h = window.calcularHashCredencial(telefono, licencia);
      return h ? String(h).toLowerCase() : null;
    } catch (e) {
      return null;
    }
  }

  /* Compara dos hashes. Coinciden si:
     - Son idénticos, o
     - Uno es prefijo del otro y el más corto tiene al menos MIN_LARGO_HASH
       caracteres.
     Esto permite almacenar tanto el hash completo como el corto. */
  function hashesCoinciden(a, b) {
    if (!a || !b) return false;
    const x = String(a).toLowerCase().trim();
    const y = String(b).toLowerCase().trim();
    const min = Math.min(x.length, y.length);
    if (min < MIN_LARGO_HASH) return false;
    return x.substring(0, min) === y.substring(0, min);
  }

  /* ============================================================
     4. COMPROBAR SI UN USUARIO ESTÁ BLOQUEADO
     ============================================================ */

  function estaBloqueado(telefono, licencia) {
    const lista = leerListaLocal();
    if (!lista || !Array.isArray(lista.bloqueados)) return null;

    const tel = String(telefono || '').trim();
    const lic = String(licencia || '').trim().toUpperCase();
    const hash = calcularHash(tel, lic);

    for (let i = 0; i < lista.bloqueados.length; i++) {
      const b = lista.bloqueados[i];

      /* --- Formato nuevo: comparación por hash --- */
      if (b.hashCred) {
        if (hash && hashesCoinciden(hash, b.hashCred)) return b;
        continue;
      }

      /* --- Formato antiguo: comparación por teléfono/licencia --- */
      const bTel = String(b.telefono || '').trim();
      const bLic = String(b.licencia || '').trim().toUpperCase();
      const coincideTel = bTel && bTel === tel;
      const coincideLic = bLic && bLic === lic;

      if (coincideTel && (!bLic || coincideLic)) {
        return b;
      }
    }
    return null;
  }

  /* ============================================================
     5. PANTALLA DE BLOQUEO
     ============================================================ */
  function mostrarBloqueo(motivo) {
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
     6. INTERCEPTAR EL LOGIN PARA VERIFICAR
     ============================================================ */
  function verificarBloqueo() {
    const telefono = document.getElementById('loginTelefono').value.trim();
    const licencia = document.getElementById('loginLicencia').value.trim();

    const bloqueo = estaBloqueado(telefono, licencia);

    if (bloqueo) {
      mostrarBloqueo(bloqueo.motivo || bloqueo.fecha || '');

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
     7. ARRANQUE
     ============================================================ */
  window.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('pantallaLogin')) return;

    actualizarListaNegra();
    instalarInterceptorLogin();

    setTimeout(verificarBloqueo, 1500);
  });

})();
