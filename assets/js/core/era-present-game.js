/**
 * DOSWAPZ — enable Present-era game skin
 * Use: ?era=present  OR  path contains /orbit/
 * Does NOT apply on Crypto Dad main play or Crypto Mom (callers can force).
 */
(function () {
  'use strict';
  if (window.__DOSWAPZ_ERA_PRESENT_BOOT__) return;
  window.__DOSWAPZ_ERA_PRESENT_BOOT__ = true;

  function pathIsOrbit() {
    try {
      return /\/orbit\//i.test(location.pathname || '');
    } catch (e) {
      return false;
    }
  }

  function wantsPresent() {
    try {
      var q = new URLSearchParams(location.search || '');
      if (q.get('era') === 'present' || q.get('skin') === 'present') return true;
      if (q.get('era') === 'past') return false;
      return pathIsOrbit();
    } catch (e2) {
      return false;
    }
  }

  // Allow page to opt out: <body data-no-present-skin="1">
  function optedOut() {
    return !!(document.body && document.body.getAttribute('data-no-present-skin'));
  }

  function injectBar(label) {
    if (document.getElementById('presentEraBar')) return;
    var bar = document.createElement('div');
    bar.id = 'presentEraBar';
    bar.innerHTML =
      '<span>PRESENT · ' + (label || 'GAME') + '</span>' +
      '<a href="/orbit/hub.html" data-era="orbit" data-no-era data-plain data-no-transition="true">HUB</a>' +
      '<a href="/classic/hub.html" data-era="past" data-no-era data-plain data-no-transition="true">PAST HUB</a>' +
      '<a href="/future/hub.html" data-era="future" data-no-era data-plain data-no-transition="true">FUTURE</a>' +
      '<a href="' + location.pathname + '" data-no-era data-plain>PAST VERSION</a>';
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('has-present-bar');
  }

  /** Load era portal (rail + switch fix) without full shell-boot scroll unlock. */
  function ensureEraPortal() {
    if (window.DOSWAPZ_ERA) {
      try {
        if (DOSWAPZ_ERA.set) DOSWAPZ_ERA.set('orbit');
        if (DOSWAPZ_ERA.wireKnownEraControls) DOSWAPZ_ERA.wireKnownEraControls();
        if (DOSWAPZ_ERA.injectEraRail) DOSWAPZ_ERA.injectEraRail();
      } catch (e0) {}
      return;
    }
    if (document.querySelector('script[data-era-portal]')) return;
    var s = document.createElement('script');
    s.src = '/assets/js/core/era-portal.js?v=20260809era';
    s.setAttribute('data-era-portal', '1');
    s.onload = function () {
      try {
        if (window.DOSWAPZ_ERA) {
          DOSWAPZ_ERA.set('orbit');
          if (DOSWAPZ_ERA.installLinkGuard) DOSWAPZ_ERA.installLinkGuard();
          if (DOSWAPZ_ERA.wireKnownEraControls) DOSWAPZ_ERA.wireKnownEraControls();
          if (DOSWAPZ_ERA.injectEraRail) DOSWAPZ_ERA.injectEraRail();
        }
      } catch (e1) {}
    };
    (document.body || document.documentElement).appendChild(s);
  }

  function boot() {
    if (!document.body) return;
    if (optedOut()) return;
    if (!wantsPresent()) {
      window.DOSWAPZ_ERA_PRESENT = false;
      /* Still offer timeline rail on past game pages if shell didn't load */
      try {
        if (!document.querySelector('script[data-shell-boot]') && !window.DOSWAPZ_ERA) {
          var s0 = document.createElement('script');
          s0.src = '/assets/js/core/era-portal.js?v=20260809era';
          s0.setAttribute('data-era-portal', '1');
          (document.body || document.documentElement).appendChild(s0);
        }
      } catch (ePast) {}
      return;
    }
    window.DOSWAPZ_ERA_PRESENT = true;
    document.documentElement.classList.add('era-present');
    document.body.classList.add('era-present');

    var label = document.body.getAttribute('data-present-label') || document.title || 'GAME';
    // shorten label
    label = String(label).split('//')[0].split('|')[0].trim().slice(0, 28) || 'GAME';
    injectBar(label);
    ensureEraPortal();

    try {
      document.title = (document.title || 'GAME') + ' · PRESENT';
    } catch (e3) {}

    // Notify games that want to retint canvas
    try {
      window.dispatchEvent(new CustomEvent('doswapz-era-present', { detail: { present: true } }));
    } catch (e4) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
