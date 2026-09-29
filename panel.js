/* ============================================================================
   PANEL.JS — Envío de eventos a Telegram
   ============================================================================
   Cada vez que alguien inicia sesión o genera un ticket, se envía un mensaje
   a tu chat de Telegram con el bot que creaste.

   No requiere Internet permanente: si falla el envío, se guarda en cola
   y se reintenta en la próxima apertura.

   Este archivo SÍ debe incluirse en el APK.
   ============================================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. CONFIGURACIÓN — REEMPLAZA ESTOS VALORES
     ============================================================ */
  const TELEGRAM_TOKEN   = 'TU_TOKEN_AQUI';        // ← El token de BotFather
  const TELEGRAM_CHAT_ID = 'TU_CHAT_ID_AQUI';      // ← El número que obtuviste

  const API_URL = 'https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage';

  /* Clave de la cola de reintentos */
  const CLAVE_COLA = 'ostikec_cola_telegram';

  /* ============================================================
     2. ENVÍO DE MENSAJES (con truco de imagen para evitar CORS)
     ============================================================ */

  /* Envía un mensaje de texto a Telegram.
     Usa una petición GET camuflada como imagen para evitar el bloqueo CORS
     de los WebView. No necesitamos leer la respuesta. */
  function enviarMensaje(texto) {
    const url = API_URL
      + '?chat_id=' + encodeURIComponent(TELEGRAM_CHAT_ID)
      + '&text=' + encodeURIComponent(texto)
      + '&parse_mode=HTML';

    /* El truco: crear una imagen invisible con esa URL.
       El navegador hace la petición sin bloquearla por CORS. */
    const img = new Image();
    img.src = url;

    /* Aunque no podemos saber si falló, guardamos en cola por si acaso.
       En la próxima apertura se reintentará. */
    encolar({ texto: texto, fecha: Date.now() });
  }

  /* ============================================================
     3. COLA DE REINTENTOS
     ============================================================ */
  function leerCola() {
    try { return JSON.parse(localStorage.getItem(CLAVE_COLA) || '[]'); }
    catch (e) { return []; }
  }

  function guardarCola(cola) {
    try { localStorage.setItem(CLAVE_COLA, JSON.stringify(cola)); } catch (e) {}
  }

  function encolar(mensaje) {
    const cola = leerCola();
    /* Evitar duplicados muy recientes (misma hora) */
    const yaExiste = cola.some(function (m) {
      return m.texto === mensaje.texto && Math.abs(m.fecha - mensaje.fecha) < 5000;
    });
    if (yaExiste) return;

    cola.push(mensaje);
    /* Limitar la cola a 100 mensajes para no llenar el almacenamiento */
    if (cola.length > 100) cola.shift();
    guardarCola(cola);
  }

  function reintentarCola() {
    const cola = leerCola();
    if (cola.length === 0) return;

    console.log('🔄 Reintentando ' + cola.length + ' mensajes pendientes...');

    /* Vaciamos la cola y reenviamos todo */
    guardarCola([]);

    cola.forEach(function (m) {
      const url = API_URL
        + '?chat_id=' + encodeURIComponent(TELEGRAM_CHAT_ID)
        + '&text=' + encodeURIComponent(m.texto)
        + '&parse_mode=HTML';

      const img = new Image();
      img.src = url;
    });
  }

  /* ============================================================
     4. FORMATEAR Y ENVIAR EVENTOS
     ============================================================ */

  function formatearLogin(huella, telefono, licencia, tipo) {
    return '🔐 <b>NUEVO ACCESO</b>\n\n'
      + '📱 <b>Huella:</b> ' + huella + '\n'
      + '📞 <b>Teléfono:</b> ' + telefono + '\n'
      + '🔑 <b>Licencia:</b> ' + licencia + '\n'
      + '👤 <b>Tipo:</b> ' + tipo + '\n'
      + '🕐 <b>Fecha:</b> ' + new Date().toLocaleString('es-ES');
  }

  function formatearTicket(huella, nombreNegocio) {
    return '🎫 <b>TICKET GENERADO</b>\n\n'
      + '📱 <b>Huella:</b> ' + huella + '\n'
      + '🏢 <b>Negocio:</b> ' + nombreNegocio + '\n'
      + '🕐 <b>Fecha:</b> ' + new Date().toLocaleString('es-ES');
  }

  /* ============================================================
     5. INTERCEPTAR LOS BOTONES
     ============================================================ */

  function instalarInterceptorLogin() {
    const btn = document.getElementById('btnEntrar');
    if (!btn || btn.dataset.panelInstalado === '1') return;
    btn.dataset.panelInstalado = '1';

    btn.addEventListener('click', function () {
      setTimeout(function () {
        const enCreador  = document.getElementById('pantallaCreador').classList.contains('activa');
        const enValidador = document.getElementById('pantallaValidador').classList.contains('activa');
        if (!enCreador && !enValidador) return;

        const telefono = document.getElementById('loginTelefono').value.trim();
        const licencia = document.getElementById('loginLicencia').value.trim().toUpperCase();
        const tipo     = enCreador ? 'creador' : 'validador';
        const huella   = (typeof huellaDispositivo === 'function')
          ? huellaDispositivo()
          : 'desconocida';

        enviarMensaje(formatearLogin(huella, telefono, licencia, tipo));
      }, 300);
    });
  }

  function instalarInterceptorTicket() {
    const btn = document.getElementById('btnCrear');
    if (!btn || btn.dataset.panelInstalado === '1') return;
    btn.dataset.panelInstalado = '1';

    btn.addEventListener('click', function () {
      setTimeout(function () {
        try {
          const activoId = localStorage.getItem('ostikec_negocio_activo');
          if (!activoId) return;

          const negocios = JSON.parse(localStorage.getItem('ostikec_negocios') || '[]');
          const neg = negocios.find(function (n) { return n.id === activoId; });
          if (!neg) return;

          const huella = (typeof huellaDispositivo === 'function')
            ? huellaDispositivo()
            : 'desconocida';

          enviarMensaje(formatearTicket(huella, neg.nombre));
        } catch (err) {}
      }, 300);
    });
  }

  /* ============================================================
     6. ARRANQUE
     ============================================================ */

  window.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('pantallaLogin')) return;

    instalarInterceptorLogin();
    instalarInterceptorTicket();

    /* Reintentar cola al arrancar (dar tiempo a que cargue todo) */
    setTimeout(reintentarCola, 4000);
  });

})();