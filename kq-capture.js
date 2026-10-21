/*
 * kq-capture.js
 * Envía a Make (LD02) cada registro hecho con un form nativo de ActiveCampaign,
 * para que el lead llegue a DASH00 además de a AC.
 *
 * Uso en la landing, al final del <body>:
 *   <script src="https://soportetech-kuestiona.github.io/kq-scripts/kq-capture.js"
 *           data-funnel="may-vsl-mm" defer></script>
 *
 * data-funnel  funnel_name que se guarda en DASH00. Si falta, LD02 usa el slug.
 * data-hook    opcional, otro webhook de Make.
 * ?kqdebug=1   en la URL de la landing: muestra en consola qué se envía.
 */
(function () {
  if (window.__kqCapture) return;
  window.__kqCapture = true;

  var tag = document.currentScript;
  var HOOK = (tag && tag.getAttribute('data-hook')) ||
    'https://hook.eu2.make.com/7kis5kmtr4jrlkcpwvw8u5jiwfaxsu5s';
  var FUNNEL = (tag && tag.getAttribute('data-funnel')) || '';
  var DEBUG = /[?&]kqdebug=1/.test(location.search);

  var CAMPOS_URL = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'fbclid', 'gclid', 'wbraid', 'gbraid'];

  function log() {
    if (DEBUG && window.console) console.log.apply(console, ['[kq-capture]'].concat([].slice.call(arguments)));
  }

  function cookie(nombre) {
    var m = document.cookie.match('(?:^|; )' + nombre + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : '';
  }

  // La URL manda; localStorage solo como respaldo, porque puede traer UTMs de una visita anterior.
  function paramUrl(clave) {
    var enUrl = new URLSearchParams(location.search).get(clave);
    if (enUrl) return enUrl;
    try { return localStorage.getItem(clave) || ''; } catch (e) { return ''; }
  }

  function valorCampo(form, nombres) {
    for (var i = 0; i < nombres.length; i++) {
      var input = form.querySelector('[name="' + nombres[i] + '"]');
      if (input && input.value) return input.value.trim();
    }
    return '';
  }

  var slug = location.pathname.split('/').filter(Boolean)[0] || '';
  var registroPendiente = null;
  var enviado = false;

  // Fase de captura: leemos los valores antes de que el script de AC oculte el form.
  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (!form || !form.id || form.id.indexOf('_form_') !== 0) return;

    // El validador de AC no comprueba una casilla obligatoria suelta (solo grupos) y el form
    // lleva novalidate, así que la de privacidad se podía saltar. La cortamos aquí, antes de
    // que el evento llegue al script de AC.
    var sinMarcar = form.querySelector('input[type="checkbox"][required]:not(:checked)');
    if (sinMarcar) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      sinMarcar.setCustomValidity('Debes aceptar la política de privacidad para continuar.');
      sinMarcar.reportValidity();
      sinMarcar.addEventListener('change', function () { sinMarcar.setCustomValidity(''); }, { once: true });
      log('envío bloqueado: casilla obligatoria sin marcar', sinMarcar.name);
      return;
    }

    var fbclid = paramUrl('fbclid');
    var fbc = cookie('_fbc') || (fbclid ? 'fb.1.' + Date.now() + '.' + fbclid : '');

    var payload = {
      email: valorCampo(form, ['email']).toLowerCase(),
      nombre: valorCampo(form, ['fullname', 'firstname', 'first_name']),
      phone: valorCampo(form, ['phone']),
      funnel_name: FUNNEL,
      landing_slug: slug,
      landing_url: location.href,
      ac_form_id: form.id.replace(/\D/g, ''),
      fbp: cookie('_fbp'),
      fbc: fbc
    };
    CAMPOS_URL.forEach(function (c) { payload[c] = paramUrl(c); });

    registroPendiente = new URLSearchParams(payload);
    log('datos capturados', payload);
  }, true);

  // AC solo llama a _load_script(url, cb, true) cuando el form ha pasado su validación.
  // Nos colgamos ahí y no de _form_callback, que no se ejecuta si el form de AC
  // tiene configurada una redirección propia.
  function engancharAC() {
    var original = window._load_script;
    if (typeof original !== 'function' || original.__kq) return false;

    var envuelta = function (url, cb, isSubmit) {
      if (isSubmit && registroPendiente && !enviado) {
        enviado = true;
        var ok = false;
        try { ok = navigator.sendBeacon && navigator.sendBeacon(HOOK, registroPendiente); } catch (e) { ok = false; }
        if (!ok) {
          fetch(HOOK, { method: 'POST', body: registroPendiente, keepalive: true, mode: 'no-cors' })
            .catch(function (err) { log('fallo al enviar a Make', err); });
        }
        log('enviado a Make', ok ? '(sendBeacon)' : '(fetch)');
      }
      return original.apply(this, arguments);
    };
    envuelta.__kq = true;
    window._load_script = envuelta;
    log('enganchado al form de AC');
    return true;
  }

  // Si la línea se pega antes del form de AC, _load_script aún no existe: reintentamos 10 s.
  if (!engancharAC()) {
    var intentos = 0;
    var reintento = setInterval(function () {
      if (engancharAC() || ++intentos > 50) {
        clearInterval(reintento);
        if (intentos > 50) log('no hay form de AC en la página; no se envía nada');
      }
    }, 200);
  }
})();
