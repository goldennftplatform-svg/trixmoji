/* Fudker peek easter egg — shy eye peeks from screen edges, blinks, looks around, hides.
 * Click → https://www.fudkers.xyz/
 *
 * Usage: <script src="/assets/js/core/fudker-peek.js?v=1" data-fudker-peek="1"></script>
 * Optional data attrs on the script tag:
 *   data-debug="1"     — show PEEK NOW + status (test only)
 *   data-first-ms="N"  — ms until first peek (default 4000)
 *   data-min-gap="N"   — min ms between peeks after hide (default 8000)
 *   data-max-gap="N"   — max ms between peeks (default 18000)
 */
(function () {
  'use strict';

  if (window.__DOSWAPZ_FUDKER_PEEK__) return;
  window.__DOSWAPZ_FUDKER_PEEK__ = true;

  var LINK = 'https://www.fudkers.xyz/';
  var scriptEl =
    document.currentScript ||
    document.querySelector('script[data-fudker-peek]');

  function attr(name, fallback) {
    if (!scriptEl) return fallback;
    var v = scriptEl.getAttribute(name);
    return v == null || v === '' ? fallback : v;
  }

  var DEBUG = attr('data-debug', '') === '1';
  var FIRST_MS = parseInt(attr('data-first-ms', '4000'), 10) || 4000;
  var MIN_GAP = parseInt(attr('data-min-gap', '8000'), 10) || 8000;
  var MAX_GAP = parseInt(attr('data-max-gap', '18000'), 10) || 18000;
  if (MAX_GAP < MIN_GAP) MAX_GAP = MIN_GAP;

  var BLINK_FRAMES = {
    open: '/assets/images/fudker-blink/00-open.png?v=imagine1',
    mid: '/assets/images/fudker-blink/01-mid.png?v=imagine1',
    closed: '/assets/images/fudker-blink/02-closed.png?v=imagine1'
  };

  if (location.protocol === 'file:') {
    BLINK_FRAMES = {
      open: 'assets/images/fudker-blink/00-open.png',
      mid: 'assets/images/fudker-blink/01-mid.png',
      closed: 'assets/images/fudker-blink/02-closed.png'
    };
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function injectStyles() {
    if (document.getElementById('fudkerPeekStyles')) return;
    var s = document.createElement('style');
    s.id = 'fudkerPeekStyles';
    s.textContent =
      '#fudkerPeek{' +
      'position:fixed;left:0;top:0;display:block;z-index:99999;' +
      'width:clamp(140px,22vw,220px);height:auto;margin:0;padding:0;' +
      'pointer-events:none;opacity:0;visibility:hidden;' +
      'transform:translate3d(-9999px,-9999px,0) rotate(0deg) scale(1);' +
      'transition:opacity .4s ease,transform .5s cubic-bezier(.22,1.15,.36,1),visibility 0s linear .4s;' +
      'filter:none!important;box-shadow:none!important;text-shadow:none!important;' +
      'will-change:transform,opacity;cursor:pointer;-webkit-tap-highlight-color:transparent;' +
      'text-decoration:none;background:transparent;border:0;' +
      '}' +
      '#fudkerPeek.is-visible{' +
      'pointer-events:auto;opacity:1;visibility:visible;' +
      'transition:opacity .4s ease,transform .5s cubic-bezier(.22,1.15,.36,1),visibility 0s linear 0s;' +
      '}' +
      '#fudkerPeek .fudker-eye-stage{display:block;width:100%;line-height:0;background:transparent;filter:none;box-shadow:none;}' +
      '#fudkerPeek img{' +
      'display:block;width:100%;height:auto;max-width:none;background:transparent;border:0;outline:none;' +
      'filter:none!important;box-shadow:none!important;mix-blend-mode:normal;' +
      'user-select:none;-webkit-user-drag:none;pointer-events:none;' +
      '}' +
      '#fudkerPeek:hover,#fudkerPeek:focus,#fudkerPeek:active{filter:none!important;box-shadow:none!important;opacity:1;}' +
      '#fudkerPeek:focus-visible{outline:1px dashed #666;outline-offset:4px;}' +
      '.fudker-toast{' +
      'position:fixed;bottom:18px;left:50%;transform:translateX(-50%) translateY(12px);z-index:100000;' +
      'padding:8px 14px;border:1px solid #445544;background:rgba(0,12,0,.88);color:#88aa88;' +
      'font-family:VT323,Courier New,monospace;font-size:14px;letter-spacing:2px;' +
      'opacity:0;pointer-events:none;transition:opacity .35s ease,transform .35s ease;white-space:nowrap;' +
      '}' +
      '.fudker-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}' +
      '.fudker-debug{' +
      'position:fixed;top:12px;right:12px;z-index:100001;display:flex;flex-direction:column;gap:6px;' +
      'align-items:flex-end;font-family:VT323,monospace;' +
      '}' +
      '.fudker-debug button{' +
      'font-family:inherit;font-size:16px;letter-spacing:2px;color:#0f0;background:rgba(0,20,0,.9);' +
      'border:1px solid #0a0;padding:8px 12px;cursor:pointer;' +
      '}' +
      '.fudker-debug button:hover{color:#ff0;border-color:#6a0;}' +
      '.fudker-debug .stat{font-size:13px;color:#6a6;letter-spacing:1px;max-width:220px;text-align:right;}';
    document.head.appendChild(s);
  }

  function ensureDom() {
    var el = document.getElementById('fudkerPeek');
    if (!el) {
      el = document.createElement('a');
      el.id = 'fudkerPeek';
      el.href = LINK;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
      el.setAttribute('aria-label', 'A shy Fudker is peeking. Open fudkers.xyz');
      el.title = 'psst… fudkers.xyz';
      el.innerHTML =
        '<span class="fudker-eye-stage">' +
        '<img id="fudkerEyeImg" src="' +
        BLINK_FRAMES.open +
        '" alt="Fudker eye" draggable="false">' +
        '</span>';
      document.body.appendChild(el);
    }

    var toast = document.getElementById('fudkerToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'fudkerToast';
      toast.className = 'fudker-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.textContent = 'something is watching…';
      document.body.appendChild(toast);
    }

    var forceBtn = null;
    var stat = null;
    if (DEBUG) {
      var debug = document.querySelector('.fudker-debug');
      if (!debug) {
        debug = document.createElement('div');
        debug.className = 'fudker-debug';
        debug.innerHTML =
          '<button type="button" id="fudkerForceBtn">PEEK NOW</button>' +
          '<div class="stat" id="fudkerStat">loading eye…</div>';
        document.body.appendChild(debug);
      }
      forceBtn = document.getElementById('fudkerForceBtn');
      stat = document.getElementById('fudkerStat');
    }

    return {
      el: el,
      img: document.getElementById('fudkerEyeImg') || el.querySelector('img'),
      toast: toast,
      forceBtn: forceBtn,
      stat: stat
    };
  }

  function boot() {
    if (prefersReducedMotion()) return;

    injectStyles();
    var dom = ensureDom();
    var el = dom.el;
    var img = dom.img;
    var toast = dom.toast;
    var forceBtn = dom.forceBtn;
    var stat = dom.stat;
    if (!el || !img) return;

    function setStat(msg) {
      if (stat) stat.textContent = msg;
      try {
        if (DEBUG) console.log('[fudker]', msg);
      } catch (e) {}
    }

    var hideTimer = null;
    var lookTimer = null;
    var scheduleTimer = null;
    var blinkTimer = null;
    var blinkAnimTimer = null;
    var busy = false;
    var ready = false;
    var blinking = false;

    function rand(min, max) {
      return min + Math.random() * (max - min);
    }

    function pick(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function showToast(msg, ms) {
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(showToast._t);
      showToast._t = setTimeout(function () {
        toast.classList.remove('show');
      }, ms || 1800);
    }

    Object.keys(BLINK_FRAMES).forEach(function (k) {
      var pre = new Image();
      pre.src = BLINK_FRAMES[k];
    });

    function setEyeFrame(key) {
      if (BLINK_FRAMES[key]) img.src = BLINK_FRAMES[key];
    }

    function stopBlinks() {
      if (blinkTimer) {
        clearTimeout(blinkTimer);
        blinkTimer = null;
      }
      if (blinkAnimTimer) {
        clearTimeout(blinkAnimTimer);
        blinkAnimTimer = null;
      }
      blinking = false;
      setEyeFrame('open');
    }

    function doBlink(kind) {
      if (!el.classList.contains('is-visible') || blinking) return;
      blinking = true;

      var steps;
      if (kind === 'double') {
        steps = [
          { f: 'mid', t: 45 },
          { f: 'closed', t: 55 },
          { f: 'mid', t: 45 },
          { f: 'open', t: 70 },
          { f: 'mid', t: 40 },
          { f: 'closed', t: 70 },
          { f: 'mid', t: 50 },
          { f: 'open', t: 0 }
        ];
      } else {
        steps = [
          { f: 'mid', t: 50 },
          { f: 'closed', t: 70 },
          { f: 'mid', t: 55 },
          { f: 'open', t: 0 }
        ];
      }

      var i = 0;
      function step() {
        if (!el.classList.contains('is-visible')) {
          blinking = false;
          setEyeFrame('open');
          return;
        }
        setEyeFrame(steps[i].f);
        if (i >= steps.length - 1) {
          blinking = false;
          return;
        }
        var delay = steps[i].t;
        i += 1;
        blinkAnimTimer = setTimeout(step, delay);
      }
      step();
    }

    function scheduleBlinkLoop() {
      stopBlinks();
      function next() {
        if (!el.classList.contains('is-visible')) return;
        var kind = Math.random() < 0.22 ? 'double' : 'single';
        doBlink(kind);
        blinkTimer = setTimeout(next, rand(1100, 2800));
      }
      blinkTimer = setTimeout(next, rand(400, 1000));
    }

    function eyeSize() {
      var w = el.offsetWidth;
      if (w && w > 20) return w;
      return Math.min(220, Math.max(140, window.innerWidth * 0.22));
    }

    function randomEdgePose() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      var size = eyeSize();
      var edge = pick(['left', 'right', 'bottom', 'top', 'bottom-left', 'bottom-right']);
      var x, y, rot, peekIn;

      switch (edge) {
        case 'left':
          x = -size * 0.55;
          y = rand(h * 0.2, h * 0.65);
          rot = rand(-10, 12);
          peekIn = { x: size * 0.05, y: y, rot: rot };
          break;
        case 'right':
          x = w - size * 0.45;
          y = rand(h * 0.2, h * 0.65);
          rot = rand(-12, 10);
          peekIn = { x: w - size * 1.05, y: y, rot: rot };
          break;
        case 'top':
          x = rand(w * 0.2, w * 0.65);
          y = -size * 0.55;
          rot = rand(-14, 14);
          peekIn = { x: x, y: size * 0.05, rot: rot };
          break;
        case 'bottom':
          x = rand(w * 0.2, w * 0.65);
          y = h - size * 0.4;
          rot = rand(-12, 12);
          peekIn = { x: x, y: h - size * 1.05, rot: rot };
          break;
        case 'bottom-left':
          x = -size * 0.5;
          y = h - size * 0.35;
          rot = rand(6, 20);
          peekIn = { x: size * 0.08, y: h - size * 1.0, rot: rot };
          break;
        default:
          x = w - size * 0.45;
          y = h - size * 0.35;
          rot = rand(-20, -6);
          peekIn = { x: w - size * 1.05, y: h - size * 1.0, rot: rot };
          break;
      }

      return {
        edge: edge,
        hide: { x: x, y: y, rot: rot },
        show: peekIn
      };
    }

    function applyPose(pose, scale) {
      scale = scale == null ? 1 : scale;
      el.style.left = '0px';
      el.style.top = '0px';
      el.style.transform =
        'translate3d(' + pose.x + 'px,' + pose.y + 'px,0) rotate(' + pose.rot + 'deg) scale(' + scale + ')';
    }

    function clearLookLoop() {
      if (lookTimer) {
        clearTimeout(lookTimer);
        lookTimer = null;
      }
    }

    function lookAround(base, remaining) {
      if (remaining <= 0 || !el.classList.contains('is-visible')) return;
      var next = {
        x: base.x + rand(-22, 22),
        y: base.y + rand(-18, 18),
        rot: base.rot + rand(-24, 24)
      };
      applyPose(next, rand(0.96, 1.08));

      if (Math.random() < 0.3 && remaining > 1) {
        lookTimer = setTimeout(function () {
          applyPose(
            {
              x: base.x + rand(-6, 6),
              y: base.y + rand(12, 30),
              rot: base.rot + rand(-8, 8)
            },
            0.92
          );
          lookTimer = setTimeout(function () {
            applyPose(base, 1);
            lookTimer = setTimeout(function () {
              lookAround(base, remaining - 1);
            }, rand(250, 450));
          }, rand(200, 380));
        }, rand(350, 650));
        return;
      }

      lookTimer = setTimeout(function () {
        lookAround(base, remaining - 1);
      }, rand(400, 850));
    }

    function isConducted() {
      return !!(window.DOSWAPZ_GAG_TURN && typeof window.DOSWAPZ_GAG_TURN.register === 'function');
    }

    function hideNow() {
      clearLookLoop();
      stopBlinks();
      if (hideTimer) clearTimeout(hideTimer);
      if (scheduleTimer) clearTimeout(scheduleTimer);
      el.classList.remove('is-visible');
      applyPose({ x: -400, y: -400, rot: 0 }, 0.9);
      busy = false;
      setStat('hiding');
    }

    function hideAway(pose) {
      clearLookLoop();
      stopBlinks();
      el.classList.remove('is-visible');
      applyPose(pose.hide, 0.9);
      busy = false;
      setStat('hiding · next peek soon');
      if (!isConducted()) scheduleNext(rand(MIN_GAP, MAX_GAP));
    }

    function peekOnce(force) {
      if (!ready) {
        setStat('eye not ready yet');
        return;
      }
      if (busy && !force) return;
      if (force) {
        clearLookLoop();
        if (hideTimer) clearTimeout(hideTimer);
        if (scheduleTimer) clearTimeout(scheduleTimer);
        busy = false;
      }
      if (busy) return;
      busy = true;

      var pose = randomEdgePose();
      setStat('peeking from ' + pose.edge);

      el.style.transition = 'none';
      applyPose(pose.hide, 0.9);
      el.classList.remove('is-visible');
      void el.offsetWidth;

      el.style.transition = '';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          el.classList.add('is-visible');
          applyPose(pose.show, 1);
          showToast('psst…', 1000);
          scheduleBlinkLoop();
          setTimeout(function () {
            doBlink('single');
          }, 180);

          lookTimer = setTimeout(function () {
            lookAround(pose.show, Math.floor(rand(3, 6)));
          }, 400);

          if (isConducted()) return;
          var dwell = rand(3200, 5600);
          hideTimer = setTimeout(function () {
            if (Math.random() < 0.5) {
              applyPose(
                {
                  x: (pose.show.x + pose.hide.x) / 2,
                  y: (pose.show.y + pose.hide.y) / 2,
                  rot: pose.hide.rot
                },
                0.94
              );
              hideTimer = setTimeout(function () {
                applyPose(pose.show, 1.03);
                hideTimer = setTimeout(function () {
                  hideAway(pose);
                }, rand(450, 800));
              }, rand(300, 550));
            } else {
              hideAway(pose);
            }
          }, dwell);
        });
      });
    }

    function scheduleNext(ms) {
      if (scheduleTimer) clearTimeout(scheduleTimer);
      scheduleTimer = setTimeout(function () {
        peekOnce(false);
      }, ms);
    }

    function startPeekLoop() {
      ready = true;
      window.DOSWAPZ_FUDKER_PEEK = {
        peek: function () {
          peekOnce(true);
        },
        hide: hideNow
      };
      if (isConducted()) {
        window.DOSWAPZ_GAG_TURN.register('eye', {
          show: function () {
            peekOnce(true);
          },
          hide: hideNow
        });
        setStat('ready · waiting turn');
        return;
      }
      setStat('ready · peeking…');
      scheduleNext(FIRST_MS);
    }

    el.setAttribute('href', LINK);
    el.addEventListener('click', function () {
      showToast('→ fudkers.xyz', 1200);
    });

    if (forceBtn) {
      forceBtn.addEventListener('click', function () {
        peekOnce(true);
      });
    }

    // Secret force-peek (dev / curious)
    window.addEventListener('keydown', function (e) {
      if (e.key === 'e' || e.key === 'E') {
        if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
        peekOnce(true);
      }
    });

    if (img.complete && img.naturalWidth > 0) {
      startPeekLoop();
    } else {
      img.onload = function () {
        setStat('loaded ' + img.naturalWidth + 'x' + img.naturalHeight);
        startPeekLoop();
      };
      img.onerror = function () {
        setStat('IMAGE FAILED — check fudker-blink frames');
      };
      if (!img.getAttribute('src')) img.src = BLINK_FRAMES.open;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
