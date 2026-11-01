/* DOSWAPZ - CRT tube page transition (splash DNA) */
window.DOSWAPZ_TRANSITION = (function () {
 'use strict';

 var busy = false;

 function ensureTube() {
 var tube = document.getElementById('tubePower');
 if (tube) return tube;
 tube = document.createElement('div');
 tube.className = 'tube-power';
 tube.id = 'tubePower';
 document.body.appendChild(tube);
 return tube;
 }

 /** Panels to fade - never the whole <body> (orbit uses body#screen). */
 function fadeTargets() {
 var out = [];
 var seen = [];

 function add(el) {
 if (!el || el === document.body || el === document.documentElement) return;
 if (seen.indexOf(el) !== -1) return;
 seen.push(el);
 out.push(el);
 }

 add(document.getElementById('orbitPanel'));
 add(document.querySelector('.content'));
 add(document.querySelector('.dos-screen'));
 add(document.getElementById('content'));

 if (!out.length) {
 var screen = document.getElementById('screen');
 if (screen && screen !== document.body) add(screen);
 }

 return out;
 }

 function resetEraOverlay() {
 var overlay = document.getElementById('eraTravelOverlay');
 if (!overlay) return;
 overlay.className = '';
 var glitch = document.getElementById('eraTravelGlitch');
 if (glitch) glitch.innerHTML = '';
 ['eraTravelWhite', 'eraTravelBlack'].forEach(function (id) {
 var el = document.getElementById(id);
 if (el) el.style.opacity = '0';
 });
 ['eraTravelTube', 'eraTravelCursor'].forEach(function (id) {
 var el = document.getElementById(id);
 if (el) el.style.display = 'none';
 });
 if (window.DOSWAPZ_ERA_TRANSITION && typeof window.DOSWAPZ_ERA_TRANSITION.reset === 'function') {
 window.DOSWAPZ_ERA_TRANSITION.reset();
 }
 }

 function resetViewState() {
 busy = false;
 document.body.style.filter = '';
 document.body.style.opacity = '';
 document.body.style.transition = '';

 var tube = document.getElementById('tubePower');
 if (tube) {
 tube.style.display = 'none';
 tube.style.opacity = '0.95';
 tube.style.height = '0';
 tube.style.top = '50%';
 tube.style.transition = '';
 }

 fadeTargets().forEach(function (el) {
 el.style.opacity = '';
 el.style.transition = '';
 el.style.transform = '';
 el.style.willChange = '';
 });

 resetEraOverlay();
 }

 function isInternalHref(href) {
 if (!href || href.charAt(0) === '#') return false;
 if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;
 if (/^https?:\/\//i.test(href)) {
 try {
 var u = new URL(href);
 return u.origin === window.location.origin;
 } catch (e) {
 return false;
 }
 }
 return href.charAt(0) === '/' || /\.html?$/i.test(href);
 }

 function normalizeHref(href) {
 if (href.charAt(0) === '/') return href;
 try {
 return new URL(href, window.location.href).pathname + new URL(href, window.location.href).search;
 } catch (e) {
 return href;
 }
 }

 function navigate(href, opts) {
 opts = opts || {};
 if (busy) return;
 busy = true;

 var target = normalizeHref(href);
 if (window.DOSWAPZ_SHELL && typeof window.DOSWAPZ_SHELL.rememberDestination === 'function') {
 window.DOSWAPZ_SHELL.rememberDestination(target);
 }

 // Local preview / flaky servers: skip fancy CRT fade (prevents stuck black screen)
 var host = window.location.hostname || '';
 var local = host === '127.0.0.1' || host === 'localhost' || host === '';
 if (opts.skipFade || local || document.body.classList.contains('hub-page')) {
 window.location.href = target;
 // If navigation is blocked, unfreeze UI after a moment
 setTimeout(function () {
 busy = false;
 resetViewState();
 }, 1500);
 return;
 }

 var tube = ensureTube();
 var targets = fadeTargets();

 // Smoother CRT exit: ease opacity on compositor, short pre-delay
 var pre = opts.preDelay != null ? opts.preDelay : 60;
 var delay = opts.delay != null ? opts.delay : 540;
 var reduced = false;
 try {
 reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 } catch (e) {}

 if (reduced) {
 window.location.href = target;
 setTimeout(function () {
 busy = false;
 resetViewState();
 }, 1200);
 return;
 }

 if (targets.length) {
 targets.forEach(function (el) {
 el.style.willChange = 'opacity, transform';
 el.style.transition =
 'opacity 160ms cubic-bezier(0.4, 0, 0.2, 1), transform 180ms cubic-bezier(0.22, 0.9, 0.28, 1)';
 el.style.opacity = '0';
 el.style.transform = 'translate3d(0, 3px, 0) scale(0.995)';
 });
 }

 var navTimer = setTimeout(function () {
 window.location.href = target;
 // Safety: never leave page faded if navigation stalls
 setTimeout(function () {
 busy = false;
 resetViewState();
 }, 2000);
 }, pre + delay);

 setTimeout(function () {
 tube.style.display = 'block';
 tube.style.top = '50%';
 tube.style.height = '0';
 tube.style.opacity = '0.98';
 tube.style.transition = '';
 tube.style.willChange = 'height, top, opacity';

 setTimeout(function () {
 tube.style.transition =
 'height 320ms cubic-bezier(0.22, 0.95, 0.3, 1), top 320ms cubic-bezier(0.22, 0.95, 0.3, 1), opacity 280ms ease';
 tube.style.top = '0';
 tube.style.height = '100vh';
 }, 20);
 }, pre);

 // Keep reference so linters don't drop timer (nav always fires)
 void navTimer;
 }

 function bind(root) {
 root = root || document;
 root.addEventListener('click', function (e) {
 var a = e.target.closest('a[href]');
 if (!a || a.dataset.noTransition === 'true') return;
 if (a.target === '_blank' || a.hasAttribute('download')) return;
 if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

 var href = a.getAttribute('href');
 if (!isInternalHref(href)) return;

 var path = normalizeHref(href);
 if (path === window.location.pathname + window.location.search) return;
 if (path === window.location.pathname) return;

 // On hub / local: native navigation only (most reliable)
 var host = window.location.hostname || '';
 var local = host === '127.0.0.1' || host === 'localhost';
 if (local || document.body.classList.contains('hub-page') || a.hasAttribute('data-plain')) {
 return; // allow default browser click
 }

 e.preventDefault();
 navigate(path);
 });
 }

 function onPageShow(e) {
 resetViewState();
 if (e && e.persisted && document.body.classList.contains('orbit-void-inner')) {
 window.dispatchEvent(new Event('doswapz-orbit-resume'));
 }
 }

 window.addEventListener('pageshow', onPageShow);
 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', resetViewState);
 } else {
 resetViewState();
 }

 return {
 navigate: navigate,
 bind: bind,
 reset: resetViewState,
 isInternalHref: isInternalHref
 };
})();