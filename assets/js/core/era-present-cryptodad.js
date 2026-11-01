/* Activate Present Neon Void soft skin on classic Crypto Dad pages
   when hosted from /orbit (embed=1) or ?era=present. */
(function () {
  'use strict';
  try {
    var q = location.search || '';
    var embed = /[?&]embed=1(?:&|$)/.test(q);
    var eraPresent = /[?&]era=present(?:&|$)/i.test(q);
    var inOrbit = /\/orbit\//i.test(location.pathname || '');
    if (!embed && !eraPresent && !inOrbit) return;

    document.documentElement.classList.add('era-present', 'era-embed');

    function markBody() {
      if (!document.body) return;
      document.body.classList.add('era-present', 'era-embed');
      /* Parent orbit shell already owns PAST/PRESENT/FUTURE/TIME —
         do not inject a second rail inside the iframe. */
      if (embed) {
        document.body.setAttribute('data-no-era-rail', '');
        document.documentElement.setAttribute('data-no-era-rail', '');
      }
    }
    markBody();
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', markBody);
    }

    // Ensure soft CSS is loaded (idempotent)
    if (!document.querySelector('link[data-era-present-cryptodad]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/assets/css/era-present-cryptodad.css?v=neonvoid9';
      link.setAttribute('data-era-present-cryptodad', '1');
      document.head.appendChild(link);
    }

    // Hide Past hub exits + force ticker/chrome stack when embedded
    if (embed) {
      var style = document.createElement('style');
      style.setAttribute('data-era-embed-chrome', '1');
      style.textContent = [
        '.era-embed a[href*="classic/hub"],.era-embed a[href="/classic/hub.html"]{display:none!important}',
        /* Kill any rail that snuck in before data-no-era-rail */
        'html.era-embed #dosEraRail,html.era-embed .dos-era-rail,body.era-embed #dosEraRail,body.era-embed .dos-era-rail{display:none!important}',
        /* Ticker ALWAYS at true bottom of the embed viewport */
        'html.era-embed .price-ticker-bar,body.era-embed .price-ticker-bar{position:fixed!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;z-index:60!important}',
        /* Glitch / CRT controls sit just above the ticker, not the top */
        'html.era-embed .glitch-dial,html.era-embed .crt-controls,body.era-embed .glitch-dial,body.era-embed .crt-controls{position:fixed!important;left:8px!important;right:auto!important;top:auto!important;bottom:calc(38px + env(safe-area-inset-bottom,0px))!important;z-index:55!important}',
        'html.era-embed .dos-docs-chip,body.era-embed .dos-docs-chip{bottom:calc(38px + env(safe-area-inset-bottom,0px))!important}',
        /* Room so last content isn't under the ticker */
        'html.era-embed body,body.era-embed{padding-bottom:calc(48px + env(safe-area-inset-bottom,0px))!important}',
        'html.era-embed .dos-screen,body.era-embed .dos-screen{padding-bottom:calc(56px + env(safe-area-inset-bottom,0px))!important}'
      ].join('');
      (document.head || document.documentElement).appendChild(style);
    }

    try {
      if (window.parent && window.parent !== window && window.parent.DOSWAPZ_ERA) {
        window.parent.DOSWAPZ_ERA.set('orbit');
      }
    } catch (e) {}
  } catch (e) {}
})();
