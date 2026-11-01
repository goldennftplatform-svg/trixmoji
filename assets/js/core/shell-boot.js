/* DOSWAPZ - site shell + brownout on every content page */
(function () {
 'use strict';

 /* Same gate as /assets/js/core/access-gate.js. Inline so a cached page that
    already loads shell-boot still catches the click. */
 (function installAccessGate() {
  if (window.__DOSWAPZ_ACCESS_GATE__) return;
  window.__DOSWAPZ_ACCESS_GATE__ = true;
  var gate = '/access-notice.html';
  function seen() {
   try { return window.localStorage.getItem('doswapz-gate-passed') === '1'; }
   catch (e) { return false; }
  }
  if (seen()) return;
  function onGate() {
   var path = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
   return path === '/access-notice.html' || path === '/access-notice';
  }
  if (onGate()) return;
  function hijack(event) {
   var node = event.target;
   if (node && node.nodeType === 3) node = node.parentElement;
   if (!node || !node.closest) return;
   var link = node.closest('a[href]');
   if (!link) return;
   if (link.hasAttribute('data-gate-skip')) return;
   var href = (link.getAttribute('href') || '').replace(/^\s+|\s+$/g, '');
   if (!href) return;
   if (href.toLowerCase().indexOf('javascript:') === 0) return;
   event.preventDefault();
   event.stopPropagation();
   if (event.stopImmediatePropagation) event.stopImmediatePropagation();
   window.location.href = gate;
  }
  document.addEventListener('click', hijack, true);
  document.addEventListener('auxclick', hijack, true);
 })();

 // Immediate scroll unlock (before CSS/JS finish) - present + classic
 (function unlockScrollEarly() {
 try {
 var p = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
 if (p === '/' || p === '/index.html' || p === '/portal.html') return;
 var root = document.documentElement;
 root.style.setProperty('overflow-y', 'auto', 'important');
 root.style.setProperty('height', 'auto', 'important');
 if (document.body) {
 document.body.style.setProperty('overflow-y', 'auto', 'important');
 document.body.style.setProperty('height', 'auto', 'important');
 document.body.classList.remove('dos-no-scroll');
 }
 root.classList.remove('dos-no-scroll');
 } catch (e) {}
 })();

 function isSplash() {
 var p = window.location.pathname.replace(/\/+$/, '') || '/index.html';
 return p === '/index.html' || p === '/';
 }

 function prefersReducedMotion() {
 try {
 return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 } catch (e) {
 return false;
 }
 }

 function isPerfLite() {
 try {
 if (window.matchMedia('(max-width: 700px), (pointer: coarse)').matches) return true;
 var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
 if (c && (c.saveData || c.effectiveType === '2g' || c.effectiveType === 'slow-2g')) return true;
 // Low memory / low core phones
 if (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory > 0 && navigator.deviceMemory <= 4) {
 return true;
 }
 if (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4) {
 return true;
 }
 } catch (e) {}
 return false;
 }

 function applySmoothUi() {
 var root = document.documentElement;
 var body = document.body;
 if (!body) return;

 root.classList.add('dos-smooth');
 body.classList.add('dos-smooth');

 // Unlock wheel scroll on content pages (splash keeps lock)
 var path = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
 var splash = path === '/' || path === '/index.html' || body.classList.contains('splash-page');
 if (splash) {
 root.classList.add('dos-no-scroll');
 body.classList.add('dos-no-scroll');
 } else {
 root.classList.remove('dos-no-scroll');
 body.classList.remove('dos-no-scroll');
 try {
 // Undo legacy TEXT-control zoom that blurred fonts + killed wheel scroll
 body.style.zoom = '';
 root.style.zoom = '';
 body.style.fontSize = '';
 root.style.fontSize = '';
 body.style.overflow = '';
 body.style.overflowY = 'auto';
 root.style.overflowY = 'auto';
 body.style.height = '';
 root.style.height = '';
 var zoomed = document.querySelectorAll('[style*="zoom"]');
 for (var zi = 0; zi < zoomed.length; zi++) {
 zoomed[zi].style.zoom = '';
 }
 } catch (e) {}
 }

 if (isPerfLite()) {
 root.classList.add('dos-perf-lite');
 body.classList.add('dos-perf-lite');
 }

 if (prefersReducedMotion()) {
 root.classList.add('dos-reduced-motion');
 body.classList.add('dos-reduced-motion');
 return;
 }

 // One-shot enter ease (skip if returning via bfcache - pageshow handles reset)
 if (!body.classList.contains('dos-page-enter') && !body.dataset.noEnterAnim) {
 body.classList.add('dos-page-enter');
 window.setTimeout(function () {
 body.classList.remove('dos-page-enter');
 }, 320);
 }
 }

 function injectScript(src, attr) {
 if (document.querySelector('script[' + attr + ']')) return;
 var s = document.createElement('script');
 s.src = src;
 s.setAttribute(attr, '1');
 (document.body || document.documentElement).appendChild(s);
 }

 function loadDocsFooter() {
 injectScript('/assets/js/core/docs-footer.js?v=20260715e', 'data-docs-footer');
 }

 function loadCrawlerPortraits() {
  injectScript('/assets/js/core/crawler-portraits.js?v=20261029crawl', 'data-crawler-portraits');
 }

 function ensureEraPortal() {
 // Load era lock early so Past/Present pages stay true to their time
 if (window.DOSWAPZ_ERA) {
  try {
   if (typeof DOSWAPZ_ERA.lockFromLocation === 'function') DOSWAPZ_ERA.lockFromLocation();
   if (typeof DOSWAPZ_ERA.installLinkGuard === 'function') DOSWAPZ_ERA.installLinkGuard();
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
    if (DOSWAPZ_ERA.lockFromLocation) DOSWAPZ_ERA.lockFromLocation();
    if (DOSWAPZ_ERA.installLinkGuard) DOSWAPZ_ERA.installLinkGuard();
   }
  } catch (e1) {}
 };
 (document.head || document.documentElement).appendChild(s);
 }

 window.DOSWAPZ_GAG_TURN = window.DOSWAPZ_GAG_TURN || {
 _queue: [],
 register: function (name, api) {
 this._queue.push([name, api]);
 }
 };

 function loadSiteShell() {
 applySmoothUi();
 ensureEraPortal();

 // Legal footer on every page (including splash)
 loadDocsFooter();

 if (isSplash()) return;

 loadCrawlerPortraits();

 if (!prefersReducedMotion()) {
 injectScript('/assets/js/core/system-brownout.js', 'data-system-brownout');
 injectScript('/assets/js/core/gag-turn.js?v=gag7', 'data-gag-turn');
 }

 if (document.querySelector('script[data-site-shell]')) return;
 if (window.DOSWAPZ_SHELL) {
 if (typeof window.DOSWAPZ_SHELL.init === 'function') {
 window.DOSWAPZ_SHELL.init();
 }
 return;
 }
 var s = document.createElement('script');
 // Cache-bust: immutable CDN was serving year-old shell without wheel fix
 s.src = '/assets/js/core/site-shell.js?v=20260809era';
 s.setAttribute('data-site-shell', '1');
 document.body.appendChild(s);
 }

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', loadSiteShell);
 } else {
 loadSiteShell();
 }

 // bfcache restore - clear stuck opacity/filter from transitions
 window.addEventListener('pageshow', function () {
 applySmoothUi();
 if (window.DOSWAPZ_TRANSITION && typeof window.DOSWAPZ_TRANSITION.reset === 'function') {
 window.DOSWAPZ_TRANSITION.reset();
 }
 });
})();