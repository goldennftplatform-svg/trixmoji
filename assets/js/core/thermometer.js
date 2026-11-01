/* Old-school pixel thermometer. Right rail. Conducted by gag-turn (5s on). */
(function () {
  'use strict';
  if (window.__DOSWAPZ_THERMO__) return;
  window.__DOSWAPZ_THERMO__ = true;

  var PW = 40;
  var PH = 112;
  var SCALE = 1.7;
  var SHOW_MS = 5000;
  var HREF = 'https://aisp.live/';
  var wrap = null;
  var canvas = null;
  var ctx = null;
  var raf = 0;
  var hideTimer = 0;
  var visible = false;
  var fromL = 0.28;
  var toL = 0.78;
  var rising = true;
  var t0 = 0;

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function injectStyles() {
    if (document.getElementById('thermoGagStyles')) return;
    var s = document.createElement('style');
    s.id = 'thermoGagStyles';
    s.textContent =
      '#thermoGag{' +
      'position:fixed;right:8px;top:16%;left:auto;z-index:99992;' +
      'width:' + Math.round(PW * SCALE) + 'px;height:' + Math.round(PH * SCALE) + 'px;' +
      'pointer-events:none;opacity:0;visibility:hidden;' +
      'transform:translate3d(var(--thermo-from,130%),0,0) rotate(var(--thermo-rot,0deg));' +
      'transition:opacity .28s linear,transform .38s cubic-bezier(.22,1.1,.36,1);' +
      'image-rendering:pixelated;image-rendering:crisp-edges;' +
      'transform-origin:center bottom;' +
      '}' +
      '#thermoGag.is-on{' +
      'pointer-events:auto;opacity:1;visibility:visible;' +
      'transform:translate3d(0,0,0) rotate(var(--thermo-rot,0deg));cursor:pointer;' +
      '}' +
      '#thermoGag canvas{width:100%;height:100%;display:block;image-rendering:pixelated;pointer-events:none;}' +
      '#thermoGag:focus-visible{outline:2px solid #22ee44;outline-offset:3px;}';
    document.head.appendChild(s);
  }

  function px(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function draw(level, up) {
    if (!ctx) return;
    ctx.clearRect(0, 0, PW, PH);
    ctx.imageSmoothingEnabled = false;

    var wood = '#6b3e1a';
    var woodD = '#3a1f0c';
    var woodL = '#8a5528';
    var brass = '#c4a35a';
    var brassD = '#8a7030';
    var glass = '#d8ecec';
    var glassD = '#9bb8b8';
    var merc = up ? '#22ee44' : '#ee2a2a';
    var mercD = up ? '#0a8a22' : '#8a1010';

    px(2, 2, 36, 108, woodD);
    px(3, 3, 34, 106, wood);
    px(4, 4, 32, 8, woodL);
    px(4, 4, 2, 104, woodL);

    px(12, 8, 16, 6, brassD);
    px(13, 8, 14, 4, brass);

    var tubeX = 16;
    var tubeW = 8;
    var tubeTop = 16;
    var tubeH = 70;
    px(tubeX - 2, tubeTop - 1, tubeW + 4, tubeH + 2, glassD);
    px(tubeX, tubeTop, tubeW, tubeH, glass);
    px(tubeX + 1, tubeTop, 2, tubeH, '#f4ffff');

    var bulbX = 13;
    var bulbY = 84;
    px(bulbX, bulbY, 14, 14, glassD);
    px(bulbX + 1, bulbY + 1, 12, 12, glass);

    var fill = Math.max(0.08, Math.min(0.92, level));
    var colH = Math.round(tubeH * fill);
    var colY = tubeTop + tubeH - colH;
    px(tubeX + 1, colY, tubeW - 2, colH, merc);
    px(tubeX + 2, colY, 1, colH, mercD);
    px(bulbX + 2, bulbY + 2, 10, 10, merc);
    px(bulbX + 3, bulbY + 3, 3, 3, 'rgba(255,255,255,0.5)');

    var i;
    for (i = 0; i < 9; i++) {
      var ty = tubeTop + 4 + i * 7;
      px(26, ty, i % 2 === 0 ? 6 : 3, 1, '#1a0c04');
    }

    ctx.fillStyle = '#1a0c04';
    ctx.font = '5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TEMP', 20, 10);
    ctx.fillStyle = up ? '#22ee44' : '#ee2a2a';
    ctx.fillText(up ? 'UP' : 'DN', 20, 108);
  }

  function tick(now) {
    if (!visible) return;
    if (!t0) t0 = now;
    var p = Math.min(1, (now - t0) / 4200);
    var eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    var level = fromL + (toL - fromL) * eased;
    draw(level, rising);
    raf = requestAnimationFrame(tick);
  }

  function ensure() {
    if (wrap) return wrap;
    injectStyles();
    wrap = document.createElement('a');
    wrap.id = 'thermoGag';
    wrap.target = '_blank';
    wrap.rel = 'noopener noreferrer';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.setAttribute('aria-label', 'AISP.live');
    wrap.title = 'aisp.live';
    canvas = document.createElement('canvas');
    canvas.width = PW;
    canvas.height = PH;
    wrap.appendChild(canvas);
    document.body.appendChild(wrap);
    ctx = canvas.getContext('2d');
    return wrap;
  }

  function pose() {
    if (!wrap) return;
    var left = Math.random() < 0.42;
    var rot = Math.round((Math.random() * 52 - 26) * 10) / 10;
    var top = 7 + Math.random() * 48;
    wrap.style.left = left ? '8px' : 'auto';
    wrap.style.right = left ? 'auto' : '8px';
    wrap.style.top = top + '%';
    wrap.style.setProperty('--thermo-from', left ? '-130%' : '130%');
    wrap.style.setProperty('--thermo-rot', rot + 'deg');
  }

  function show() {
    if (prefersReducedMotion()) return;
    ensure();
    pose();
    rising = Math.random() < 0.5;
    if (rising) {
      fromL = 0.16 + Math.random() * 0.22;
      toL = 0.62 + Math.random() * 0.28;
    } else {
      fromL = 0.62 + Math.random() * 0.26;
      toL = 0.14 + Math.random() * 0.22;
    }
    t0 = 0;
    visible = true;
    wrap.href = HREF;
    wrap.removeAttribute('aria-hidden');
    wrap.setAttribute('tabindex', '0');
    draw(fromL, rising);
    wrap.classList.add('is-on');
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, SHOW_MS);
  }

  function hide() {
    visible = false;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = 0;
    }
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (wrap) {
      wrap.classList.remove('is-on');
      wrap.removeAttribute('href');
      wrap.setAttribute('aria-hidden', 'true');
      wrap.setAttribute('tabindex', '-1');
    }
  }

  window.DOSWAPZ_THERMO = { show: show, hide: hide, showMs: SHOW_MS };

  function boot() {
    if (window.DOSWAPZ_GAG_TURN && typeof window.DOSWAPZ_GAG_TURN.register === 'function') {
      window.DOSWAPZ_GAG_TURN.register('thermo', { show: show, hide: hide });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
