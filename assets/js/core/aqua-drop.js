/* Aqua drop drip - pure vertical drip from random spots. Click -> aquavaults.com
 *
 * RULE: No persistent Aqua Vaults link in the corner.
 * The #aquaDrop anchor is ONLY interactive while the drip animation is showing.
 * Between drips it is off-screen, hidden, and pointer-events: none.
 */
(function () {
 'use strict';

 if (window.__DOSWAPZ_AQUA_DROP__) return;
 window.__DOSWAPZ_AQUA_DROP__ = true;

 var INTERVAL_MS = 1 * 60 * 1000; // 1 minute between drips
 var VISIBLE_MS = 5200; // time on screen while dripping
 var VIDEO_SRC = '/assets/media/aqua-drop.mp4';
 var HREF = 'https://aquavaults.com/';
 var W = 88;
 var H = 118;

 var timer = null;
 var hideTimer = null;
 var raf = null;
 var wrap = null;
 var video = null;
 var canvas = null;
 var ctx = null;
 var keying = false;
 var keyFrameSkip = 0;
 var isShowing = false;

 function isMobileLite() {
 try {
 if (document.body && document.body.classList.contains('dos-perf-lite')) return true;
 return window.matchMedia('(max-width: 700px), (pointer: coarse)').matches;
 } catch (e) {
 return false;
 }
 }

 function prefersReducedMotion() {
 try {
 return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 } catch (e) {
 return false;
 }
 }

 function injectStyles() {
 if (document.getElementById('aquaDropStyles')) return;
 var s = document.createElement('style');
 s.id = 'aquaDropStyles';
 s.textContent =
 '#aquaDrop{' +
 'position:fixed;z-index:99990;width:' + W + 'px;height:' + H + 'px;' +
 /* Hidden + non-interactive by default - NEVER a corner link */
 'pointer-events:none !important;visibility:hidden;opacity:0;' +
 'will-change:transform,opacity;' +
 'filter:drop-shadow(0 10px 14px rgba(20,90,160,.5));' +
 'cursor:pointer;border:0;padding:0;background:transparent !important;' +
 'overflow:visible;left:-9999px;top:-9999px;' +
 '}' +
 '#aquaDrop.aqua-drop-show{' +
 'pointer-events:auto !important;visibility:visible;opacity:1;' +
 'transition:opacity .2s linear,transform 4.8s cubic-bezier(.35,.05,.55,1);' +
 '}' +
 '#aquaDrop.aqua-drop-fall{' +
 'pointer-events:none !important;opacity:0;' +
 'transition:opacity .35s linear,transform .9s cubic-bezier(.45,0,.7,.3);' +
 '}' +
 '#aquaDrop canvas{' +
 'width:100%;height:100%;display:block;pointer-events:none;' +
 'background:transparent !important;' +
 '}' +
 '#aquaDrop video{' +
 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;' +
 'left:-9999px;top:0;' +
 '}' +
 '#aquaDrop:focus-visible{outline:2px solid #6cf;outline-offset:3px;}';
 document.head.appendChild(s);
 }

 /** Park the link completely off-screen and non-interactive. */
 function parkDrop() {
 if (!wrap) return;
 isShowing = false;
 wrap.classList.remove('aqua-drop-show', 'aqua-drop-fall');
 wrap.style.opacity = '0';
 wrap.style.visibility = 'hidden';
 wrap.style.pointerEvents = 'none';
 wrap.style.left = '-9999px';
 wrap.style.top = '-9999px';
 wrap.style.transform = 'none';
 wrap.setAttribute('aria-hidden', 'true');
 wrap.setAttribute('tabindex', '-1');
 // Remove href while parked so nothing can activate Aqua Vaults except the drip
 wrap.removeAttribute('href');
 }

 function armDropLink() {
 if (!wrap) return;
 wrap.href = HREF;
 wrap.removeAttribute('aria-hidden');
 wrap.setAttribute('tabindex', '0');
 wrap.style.pointerEvents = 'auto';
 wrap.style.visibility = 'visible';
 }

 /** Remove white / near-white background; keep the drop. */
 function keyFrame() {
 if (!video || !ctx || !canvas) return;
 if (video.readyState < 2) return;

 try {
 ctx.clearRect(0, 0, W, H);
 ctx.drawImage(video, 0, 0, W, H);
 var img = ctx.getImageData(0, 0, W, H);
 var d = img.data;
 for (var i = 0; i < d.length; i += 4) {
 var r = d[i];
 var g = d[i + 1];
 var b = d[i + 2];
 var maxc = Math.max(r, g, b);
 var minc = Math.min(r, g, b);
 var brightness = (r + g + b) / 3;
 var chroma = maxc - minc;

 if (brightness > 232 && chroma < 28) {
 d[i + 3] = 0;
 continue;
 }
 if (brightness > 205 && chroma < 40) {
 var t = (brightness - 205) / 40;
 d[i + 3] = Math.max(0, Math.min(255, d[i + 3] * (1 - t * 1.15)));
 continue;
 }
 if (d[i + 3] > 0 && brightness < 200) {
 d[i] = Math.min(255, r * 1.05);
 d[i + 1] = Math.min(255, g * 1.08);
 d[i + 2] = Math.min(255, b * 1.12);
 }
 }
 ctx.putImageData(img, 0, 0);
 } catch (e) {
 if (canvas) canvas.style.mixBlendMode = 'multiply';
 }
 }

 function loopKey() {
 if (!keying) return;
 if (isMobileLite()) {
 keyFrameSkip = 1 - keyFrameSkip;
 if (keyFrameSkip) {
 raf = requestAnimationFrame(loopKey);
 return;
 }
 }
 keyFrame();
 raf = requestAnimationFrame(loopKey);
 }

 function startKey() {
 if (keying) return;
 keying = true;
 loopKey();
 }

 function stopKey() {
 keying = false;
 if (raf) cancelAnimationFrame(raf);
 raf = null;
 }

 function ensure() {
 if (wrap) return wrap;
 injectStyles();

 wrap = document.createElement('a');
 wrap.id = 'aquaDrop';
 // NO href until drip is showing
 wrap.target = '_blank';
 wrap.rel = 'noopener noreferrer';
 wrap.title = 'Aqua Vaults';
 wrap.setAttribute('aria-label', 'Aqua Vaults drop - open aquavaults.com');
 wrap.dataset.noTransition = 'true';

 video = document.createElement('video');
 video.src = VIDEO_SRC;
 video.muted = true;
 video.defaultMuted = true;
 video.playsInline = true;
 video.loop = true;
 video.preload = 'metadata';
 video.crossOrigin = 'anonymous';
 video.setAttribute('playsinline', '');
 video.setAttribute('muted', '');
 video.setAttribute('aria-hidden', 'true');

 canvas = document.createElement('canvas');
 canvas.width = W;
 canvas.height = H;
 canvas.setAttribute('aria-hidden', 'true');
 ctx = canvas.getContext('2d', { willReadFrequently: true });

 wrap.appendChild(video);
 wrap.appendChild(canvas);
 document.body.appendChild(wrap);

 wrap.addEventListener('click', function () {
 // Only navigates if href was armed during show
 hideDrop(true);
 });

 video.addEventListener('loadeddata', function () {
 if (isShowing) keyFrame();
 });

 parkDrop();
 return wrap;
 }

 /**
 * Place drop at a random horizontal spot, starting just above the viewport.
 */
 function placeRandomSpot() {
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
 el.dataset.startY = String(startY);
 el.dataset.left = String(left);
 el.dataset.rot = String(rot);
 }

 function showDrop() {
 if (document.hidden) return;
 if (prefersReducedMotion()) return;

 var el = ensure();
 isShowing = true;
 placeRandomSpot();
 armDropLink();

 el.classList.remove('aqua-drop-fall', 'aqua-drop-show');
 el.style.opacity = '0';
 el.style.visibility = 'visible';
 el.style.transition = 'none';
 void el.offsetWidth;

 var vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
 var endY = Math.floor(vh * (0.55 + Math.random() * 0.28));
 var rot = el.dataset.rot || '0';

 requestAnimationFrame(function () {
 if (!isShowing || !el) return;
 el.style.transition = '';
 el.classList.add('aqua-drop-show');
 el.style.opacity = '1';
 el.style.pointerEvents = 'auto';
 el.style.transform = 'translate3d(0,' + endY + 'px,0) scale(1) rotate(' + rot + 'deg)';
 });

 try {
 video.currentTime = 0;
 var p = video.play();
 if (p && typeof p.catch === 'function') p.catch(function () {});
 } catch (e) {}

 startKey();

 if (hideTimer) clearTimeout(hideTimer);
 hideTimer = setTimeout(function () {
 hideDrop(false);
 }, VISIBLE_MS);
 }

 function hideDrop(fast) {
 if (!wrap) return;
 wrap.classList.remove('aqua-drop-show');
 wrap.classList.add('aqua-drop-fall');
 wrap.style.pointerEvents = 'none';

 var vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
 var rot = wrap.dataset.rot || '0';
 wrap.style.transform = 'translate3d(0,' + (vh + H) + 'px,0) scale(0.75) rotate(' + rot + 'deg)';
 wrap.style.opacity = '0';

 setTimeout(function () {
 stopKey();
 try {
 if (video) video.pause();
 } catch (e) {}
 parkDrop();
 }, fast ? 180 : 950);
 }

 function schedule() {
 if (timer) clearInterval(timer);
 var interval = isMobileLite() ? INTERVAL_MS * 2.5 : INTERVAL_MS;
 var firstDelay = /aqua-drop|test\.html|go\.html/i.test(location.pathname)
 ? 700
 : Math.min(interval, (isMobileLite() ? 8000 : 3500) + Math.random() * 4000);

 // Do NOT create the DOM node until first drip
 setTimeout(function () {
 showDrop();
 timer = setInterval(showDrop, interval);
 }, firstDelay);
 }

 function isConducted() {
 return !!(window.DOSWAPZ_GAG_TURN && typeof window.DOSWAPZ_GAG_TURN.register === 'function');
 }

 function start() {
 if (prefersReducedMotion()) return;
 injectStyles();
 window.DOSWAPZ_AQUA_DROP = {
 show: showDrop,
 hide: function () {
 hideDrop(true);
 },
 intervalMs: INTERVAL_MS,
 href: HREF,
 src: VIDEO_SRC
 };
 if (isConducted()) {
 window.DOSWAPZ_GAG_TURN.register('drop', {
 show: showDrop,
 hide: function () {
 hideDrop(true);
 }
 });
 return;
 }
 schedule();
 }

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', start);
 } else {
 start();
 }

})();
