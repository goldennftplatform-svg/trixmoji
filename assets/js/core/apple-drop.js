/* Pixel apple drip. Conducted by gag-turn, same turn as the thermometer,
 * Wu-Tang, and the Aqua Vaults drop. Click bites, plays the TBB reel,
 * then opens Apple Picker. Parked and non-interactive between drips.
 */
(function () {
  'use strict';

  if (window.__DOSWAPZ_APPLE_DROP__) return;
  window.__DOSWAPZ_APPLE_DROP__ = true;

  var HREF = '/classic/pages/tbb/apple-picker.html';
  var VIDEO = '/assets/media/tbb-apple-gate.mp4';
  var PX = 8;
  var COLS = 16;
  var ROWS = 18;
  var gateBusy = false;

  if (!window.DOSWAPZ_APPLE_CRUNCH) {
    window.DOSWAPZ_APPLE_CRUNCH = function (done) {
      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        if (typeof done === 'function') done();
      }
      try {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return finish();
        var ctx = new Ctx();
        function burst(when, dur, freq, gain) {
          var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
          var buf = ctx.createBuffer(1, len, ctx.sampleRate);
          var data = buf.getChannelData(0);
          for (var i = 0; i < len; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
          }
          var src = ctx.createBufferSource();
          src.buffer = buf;
          var bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = freq;
          bp.Q.value = 0.65;
          var g = ctx.createGain();
          g.gain.value = gain;
          src.connect(bp);
          bp.connect(g);
          g.connect(ctx.destination);
          src.start(ctx.currentTime + when);
        }
        burst(0, 0.07, 1600, 0.95);
        burst(0.06, 0.11, 900, 0.72);
        burst(0.15, 0.06, 2100, 0.38);
        setTimeout(function () {
          try { ctx.close(); } catch (e) {}
          finish();
        }, 420);
      } catch (e) {
        finish();
      }
    };
  }
  var W = COLS * PX;
  var H = ROWS * PX;

  function go(dest) {
    window.location.href = dest || HREF;
  }

  function playReel(dest) {
    var reduce = false;
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}
    if (reduce) return go(dest);
    var gate = document.getElementById('tbbGate');
    if (!gate) {
      gate = document.createElement('div');
      gate.id = 'tbbGate';
      gate.setAttribute('role', 'dialog');
      gate.setAttribute('aria-label', 'Apple reel');
      gate.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#000;display:flex;align-items:center;justify-content:center;';
      document.body.appendChild(gate);
    }
    gate.innerHTML = '';
    var video = document.createElement('video');
    video.src = VIDEO;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.controls = false;
    video.style.cssText = 'width:min(96vw,1100px);height:min(88vh,760px);object-fit:contain;background:#000;';
    gate.appendChild(video);
    var left = false;
    function leave() {
      if (left) return;
      left = true;
      go(dest);
    }
    video.addEventListener('ended', leave);
    video.addEventListener('error', leave);
    var watchdog = setTimeout(leave, 14000);
    video.addEventListener('ended', function () { clearTimeout(watchdog); });
    var play = video.play();
    if (play && typeof play.catch === 'function') play.catch(leave);
  }

  window.DOSWAPZ_TBB_GATE = function (dest) {
    if (gateBusy) return;
    gateBusy = true;
    var target = dest || HREF;
    var crunch = window.DOSWAPZ_APPLE_CRUNCH;
    if (typeof crunch === 'function') crunch(function () { playReel(target); });
    else playReel(target);
  };

  var hideTimer = 0;
  var wrap = null;
  var isShowing = false;

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function injectStyles() {
    if (document.getElementById('appleDropStyles')) return;
    var s = document.createElement('style');
    s.id = 'appleDropStyles';
    s.textContent =
      '#appleDrop{' +
      'position:fixed;z-index:99990;width:' + W + 'px;height:' + H + 'px;' +
      'pointer-events:none !important;visibility:hidden;opacity:0;' +
      'will-change:transform,opacity;' +
      'filter:drop-shadow(0 10px 8px rgba(120,0,0,.55)) drop-shadow(0 0 10px rgba(255,40,30,.35));' +
      'cursor:pointer;border:0;padding:0;background:transparent !important;' +
      'overflow:visible;left:-9999px;top:-9999px;text-decoration:none;' +
      '}' +
      '#appleDrop.apple-drop-show{' +
      'pointer-events:auto !important;visibility:visible;opacity:1;' +
      'transition:opacity .2s linear,transform 4.8s cubic-bezier(.35,.05,.55,1);' +
      '}' +
      '#appleDrop.apple-drop-fall{' +
      'pointer-events:none !important;opacity:0;' +
      'transition:opacity .35s linear,transform .9s cubic-bezier(.45,0,.7,.3);' +
      '}' +
      '#appleDrop canvas{' +
      'width:100%;height:100%;display:block;pointer-events:none;' +
      'image-rendering:pixelated;image-rendering:crisp-edges;background:transparent !important;' +
      '}' +
      '#appleDrop:focus-visible{outline:2px solid #ff3355;outline-offset:3px;}';
    document.head.appendChild(s);
  }

  function paint(canvas) {
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    var grid = [
      '......sLL.......',
      '.....ssLlL......',
      '....ss..lL......',
      '....RRRRRRR.....',
      '..RRRRRRRRRRR...',
      '..RRhhRRRRRRRR..',
      '.RRRhhRRRRRRRRR.',
      '.RRRRRRRRRRRRRd.',
      '.RRRRRRRRRRRRRd.',
      '.RRRRRRRRRRRMMd.',
      '..RRRRRRRRRRMMd.',
      '..RRRRRRRRRMMMd.',
      '...RRRRRRRRMMd..',
      '....RRRRRRMMd...',
      '.....RRRRMMd....',
      '......RRMMd.....',
      '.......MMd......',
      '........d.......'
    ];
    var colors = {
      R: '#ff2d1f',
      M: '#c81010',
      d: '#6a070c',
      h: '#fff6f4',
      s: '#6b3e16',
      L: '#3ee25a',
      l: '#157a28'
    };
    for (var y = 0; y < grid.length; y++) {
      var row = grid[y];
      for (var x = 0; x < row.length; x++) {
        var c = colors[row.charAt(x)];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * PX, y * PX, PX, PX);
      }
    }
  }

  function park() {
    if (!wrap) return;
    isShowing = false;
    wrap.classList.remove('apple-drop-show', 'apple-drop-fall');
    wrap.style.opacity = '0';
    wrap.style.visibility = 'hidden';
    wrap.style.pointerEvents = 'none';
    wrap.style.left = '-9999px';
    wrap.style.top = '-9999px';
    wrap.style.transform = 'none';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.setAttribute('tabindex', '-1');
    wrap.removeAttribute('href');
  }

  function ensure() {
    if (wrap) return wrap;
    injectStyles();
    wrap = document.createElement('a');
    wrap.id = 'appleDrop';
    wrap.title = 'Apple Picker';
    wrap.setAttribute('aria-label', 'Pixel apple - open Apple Picker');
    wrap.dataset.noTransition = 'true';
    wrap.dataset.noEra = '';
    wrap.dataset.plain = '';
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.setAttribute('aria-hidden', 'true');
    paint(canvas);
    wrap.appendChild(canvas);
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) {
      if (!isShowing) return;
      e.preventDefault();
      e.stopPropagation();
      hide(true);
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      window.DOSWAPZ_TBB_GATE(HREF);
    });
    park();
    return wrap;
  }

  function place() {
    var el = ensure();
    var vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    var padX = 24;
    var maxLeft = Math.max(padX, vw - W - padX);
    var left = padX + Math.floor(Math.random() * Math.max(1, maxLeft - padX));
    var startY = -H - Math.floor(Math.random() * 40);
    var rot = Math.round((Math.random() * 36 - 18) * 10) / 10;
    el.style.left = left + 'px';
    el.style.right = 'auto';
    el.style.top = '0';
    el.style.bottom = 'auto';
    el.style.transform = 'translate3d(0,' + startY + 'px,0) scale(0.92) rotate(' + rot + 'deg)';
    el.dataset.rot = String(rot);
  }

  function show() {
    if (document.hidden || prefersReducedMotion()) return;
    var el = ensure();
    isShowing = true;
    place();
    el.href = HREF;
    el.removeAttribute('aria-hidden');
    el.setAttribute('tabindex', '0');
    el.classList.remove('apple-drop-fall', 'apple-drop-show');
    el.style.opacity = '0';
    el.style.visibility = 'visible';
    el.style.transition = 'none';
    el.style.pointerEvents = 'none';
    void el.offsetWidth;
    var vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    var endY = Math.floor(vh * (0.55 + Math.random() * 0.28));
    var rot = el.dataset.rot || '0';
    requestAnimationFrame(function () {
      if (!isShowing || !el) return;
      el.style.transition = '';
      el.classList.add('apple-drop-show');
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
      el.style.transform = 'translate3d(0,' + endY + 'px,0) scale(1) rotate(' + rot + 'deg)';
    });
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      hide(false);
    }, 5200);
  }

  function hide(fast) {
    if (!wrap) return;
    isShowing = false;
    wrap.classList.remove('apple-drop-show');
    wrap.classList.add('apple-drop-fall');
    wrap.style.pointerEvents = 'none';
    var vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    var rot = wrap.dataset.rot || '0';
    wrap.style.transform = 'translate3d(0,' + (vh + H) + 'px,0) scale(0.75) rotate(' + rot + 'deg)';
    wrap.style.opacity = '0';
    setTimeout(park, fast ? 180 : 950);
  }

  function start() {
    if (prefersReducedMotion()) return;
    injectStyles();
    if (window.DOSWAPZ_GAG_TURN && typeof window.DOSWAPZ_GAG_TURN.register === 'function') {
      window.DOSWAPZ_GAG_TURN.register('apple', { show: show, hide: function () { hide(true); } });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
