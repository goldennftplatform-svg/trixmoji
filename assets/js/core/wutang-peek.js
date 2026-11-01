/* Wu-Tang for the Children peek. Conducted by gag-turn. */
(function () {
  'use strict';
  if (window.__DOSWAPZ_WUTANG_PEEK__) return;
  window.__DOSWAPZ_WUTANG_PEEK__ = true;

  var HREF = 'https://wutangforthechildren.org/';
  var SRC = '/assets/images/geoffwatch/wutang-official.png';
  var SHOW_MS = 5000;
  var wrap = null;
  var hideTimer = 0;

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function injectStyles() {
    if (document.getElementById('wuGagStyles')) return;
    var s = document.createElement('style');
    s.id = 'wuGagStyles';
    s.textContent =
      '#wuGag{' +
      'position:fixed;right:14px;bottom:14%;left:auto;z-index:99991;' +
      'width:min(132px,28vw);height:auto;margin:0;padding:0;border:0;background:transparent;' +
      'pointer-events:none;opacity:0;visibility:hidden;' +
      'transform:translate3d(var(--wu-from,140%),12px,0) rotate(var(--wu-rot,-8deg));' +
      'transition:opacity .3s linear,transform .4s cubic-bezier(.22,1.1,.36,1);' +
      'filter:drop-shadow(0 0 10px rgba(255,200,0,.35));' +
      'text-decoration:none;cursor:pointer;' +
      'transform-origin:center bottom;' +
      '}' +
      '#wuGag.is-on{pointer-events:auto;opacity:1;visibility:visible;transform:translate3d(0,0,0) rotate(var(--wu-rot,-4deg));}' +
      '#wuGag img{display:block;width:100%;height:auto;image-rendering:pixelated;background:transparent;border:0;pointer-events:none;}' +
      '#wuGag:focus-visible{outline:2px solid #ffd400;outline-offset:3px;}';
    document.head.appendChild(s);
  }

  function ensure() {
    if (wrap) return wrap;
    injectStyles();
    wrap = document.createElement('a');
    wrap.id = 'wuGag';
    wrap.target = '_blank';
    wrap.rel = 'noopener noreferrer';
    wrap.setAttribute('aria-label', 'Wu-Tang for the Children');
    wrap.title = 'wutangforthechildren.org';
    var img = document.createElement('img');
    img.src = SRC;
    img.alt = 'Wu-Tang';
    img.draggable = false;
    wrap.appendChild(img);
    document.body.appendChild(wrap);
    return wrap;
  }

  function pose() {
    if (!wrap) return;
    var left = Math.random() < 0.5;
    var rot = Math.round((Math.random() * 56 - 28) * 10) / 10;
    var bottom = 6 + Math.random() * 42;
    wrap.style.left = left ? '14px' : 'auto';
    wrap.style.right = left ? 'auto' : '14px';
    wrap.style.bottom = bottom + '%';
    wrap.style.top = 'auto';
    wrap.style.setProperty('--wu-from', left ? '-140%' : '140%');
    wrap.style.setProperty('--wu-rot', rot + 'deg');
  }

  function show() {
    if (prefersReducedMotion()) return;
    ensure();
    pose();
    wrap.href = HREF;
    wrap.classList.add('is-on');
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, SHOW_MS);
  }

  function hide() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = 0;
    }
    if (wrap) {
      wrap.classList.remove('is-on');
      wrap.removeAttribute('href');
    }
  }

  window.DOSWAPZ_WUTANG_PEEK = { show: show, hide: hide };

  function boot() {
    if (window.DOSWAPZ_GAG_TURN && typeof window.DOSWAPZ_GAG_TURN.register === 'function') {
      window.DOSWAPZ_GAG_TURN.register('wutang', { show: show, hide: hide });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
