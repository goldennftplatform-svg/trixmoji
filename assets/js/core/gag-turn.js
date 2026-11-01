/* One gag at a time on every content page.
 * Hub: each egg once in the first minute, then slower the longer the tab stays open.
 * Other pages: the same slowdown, without the opening parade.
 */
(function () {
  'use strict';
  if (window.__DOSWAPZ_GAG_TURN_FULL__) return;
  window.__DOSWAPZ_GAG_TURN_FULL__ = true;

  var EXPECTED = 5;
  var actors = {};
  var started = false;
  var timer = 0;
  var current = null;
  var lastShown = null;
  var seen = {};
  var deck = [];
  var dwellStart = 0;
  var waitTries = 0;

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function pathName() {
    return (window.location.pathname || '/').replace(/\/+$/, '') || '/';
  }

  function isSplash() {
    var p = pathName();
    return p === '/' || p === '/index.html' || p === '/portal.html';
  }

  function isHome() {
    var p = pathName();
    return p === '/past' || p === '/present' || p === '/classic/hub.html' || p === '/classic/hub' || p === '/orbit/hub.html' || p === '/orbit/hub' || p === '/hub.html' || p === '/hub';
  }

  function hideAll() {
    Object.keys(actors).forEach(function (k) {
      try {
        if (actors[k] && typeof actors[k].hide === 'function') actors[k].hide();
      } catch (e) {}
    });
    current = null;
  }

  function showNamed(name) {
    hideAll();
    var api = actors[name];
    if (!api || typeof api.show !== 'function') return false;
    if (document.hidden) return false;
    current = name;
    try {
      api.show();
    } catch (e) {
      current = null;
      return false;
    }
    return true;
  }

  function later(ms, fn) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function unseenNames() {
    return Object.keys(actors).filter(function (n) {
      return !seen[n];
    });
  }

  function nextActor() {
    var names = Object.keys(actors);
    if (!names.length) return null;
    var waiting = unseenNames();
    if (waiting.length) {
      deck = deck.filter(function (n) {
        return actors[n] && !seen[n];
      });
      waiting.forEach(function (n) {
        if (deck.indexOf(n) === -1) deck.push(n);
      });
      if (deck.length > 1) deck = shuffle(deck);
      return deck.shift();
    }
    deck = deck.filter(function (n) {
      return !!actors[n];
    });
    if (!deck.length) {
      var pool = names.filter(function (n) {
        return n !== lastShown;
      });
      if (!pool.length) pool = names;
      deck = shuffle(pool);
    }
    return deck.shift();
  }

  function dwellMs() {
    return dwellStart ? Date.now() - dwellStart : 0;
  }

  function openingParade() {
    return isHome() && unseenNames().length > 0 && dwellMs() < 70000;
  }

  function quietMs() {
    if (openingParade()) {
      var left = 60000 - dwellMs();
      var waiting = Math.max(1, unseenNames().length);
      var budget = left / waiting - 4600;
      var hi = Math.min(7000, Math.max(2800, budget));
      var lo = Math.max(1800, hi - 1600);
      return rand(lo, hi);
    }
    var minutes = dwellMs() / 60000;
    var lo = 16000 + minutes * 5000;
    var hi = 28000 + minutes * 8000;
    if (lo > 42000) lo = 42000;
    if (hi > 80000) hi = 80000;
    if (hi < lo + 6000) hi = lo + 6000;
    return rand(lo, hi);
  }

  function visibleMs() {
    if (openingParade()) {
      if (unseenNames().length > 2 && dwellMs() > 35000) return rand(2800, 3600);
      return rand(4200, 5100);
    }
    return rand(3000, 5200);
  }

  function cycle() {
    if (prefersReducedMotion() || document.hidden) {
      later(5000, cycle);
      return;
    }
    var name = nextActor();
    var used = name ? showNamed(name) : false;
    if (used) {
      lastShown = name;
      seen[name] = true;
    }
    var onMs = used ? visibleMs() : 0;
    later(onMs, function () {
      hideAll();
      later(quietMs(), cycle);
    });
  }

  function maybeStart() {
    if (started || isSplash() || prefersReducedMotion()) return;
    var n = Object.keys(actors).length;
    if (!n) return;
    if (n < EXPECTED && waitTries < 12) {
      waitTries += 1;
      later(400, maybeStart);
      return;
    }
    started = true;
    dwellStart = Date.now();
    later(isHome() ? rand(800, 1600) : rand(5000, 10000), cycle);
  }

  var stub = window.DOSWAPZ_GAG_TURN || {};
  var queued = stub._queue || [];

  window.DOSWAPZ_GAG_TURN = {
    register: function (name, api) {
      if (!name || !api) return;
      actors[name] = api;
      maybeStart();
    },
    hideAll: hideAll
  };

  queued.forEach(function (pair) {
    window.DOSWAPZ_GAG_TURN.register(pair[0], pair[1]);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) hideAll();
  });

  function inject(src, attr) {
    if (document.querySelector('script[' + attr + ']')) return;
    var s = document.createElement('script');
    s.src = src;
    s.setAttribute(attr, '1');
    (document.body || document.documentElement).appendChild(s);
  }

  function boot() {
    if (isSplash() || prefersReducedMotion()) return;
    inject('/assets/js/core/thermometer.js?v=gag3', 'data-thermo-gag');
    inject('/assets/js/core/wutang-peek.js?v=gag3', 'data-wutang-peek');
    inject('/assets/js/core/fudker-peek.js?v=gag3', 'data-fudker-peek');
    inject('/assets/js/core/aqua-drop.js?v=drip5', 'data-aqua-drop');
    inject('/assets/js/core/apple-drop.js?v=apple3', 'data-apple-drop');
    later(2500, maybeStart);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
