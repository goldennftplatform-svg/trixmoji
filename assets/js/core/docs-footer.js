/* DOSWAPZ - site-wide DOCS / LEGAL access chip (every page)
 Full legal copy lives only at /docs/legal.html - no giant footer strip. */
(function () {
 'use strict';

 if (window.__DOSWAPZ_DOCS_FOOTER__) return;
 window.__DOSWAPZ_DOCS_FOOTER__ = true;

 var LEGAL_HREF = '/docs/legal.html';
 var DOCS_HREF = '/docs/';

 function ensureShellCss() {
 if (document.querySelector('link[data-doswapz-shell-css]')) return;
 var found = false;
 document.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) {
 if ((l.getAttribute('href') || '').indexOf('doswapz-shell.css') !== -1) found = true;
 });
 if (found) return;
 var link = document.createElement('link');
 link.rel = 'stylesheet';
 link.href = '/assets/css/doswapz-shell.css?v=20260715e';
 link.setAttribute('data-doswapz-shell-css', '1');
 document.head.appendChild(link);
 }

 function pathKey() {
 return (window.location.pathname || '/').replace(/\/+$/, '') || '/';
 }

 function isLegalPage() {
 var p = pathKey();
 return p === '/docs/legal.html' || p === '/docs' || p === '/docs/index.html';
 }

 function injectDocsChip() {
 // Remove any legacy full footer if a cached script left one
 var old = document.getElementById('dosDocsFooter');
 if (old && old.parentNode) old.parentNode.removeChild(old);
 document.body.classList.remove('has-dos-docs-footer', 'has-dos-docs-footer-compact');

 if (document.getElementById('dosDocsChip')) return;
 if (isLegalPage()) return; // already on docs - no need for floating chip

 ensureShellCss();

 var el = document.createElement('nav');
 el.id = 'dosDocsChip';
 el.className = 'dos-docs-chip';
 el.setAttribute('aria-label', 'Legal docs');
 el.innerHTML =
 '<a class="dos-docs-chip-btn" href="' + LEGAL_HREF + '" title="Full terms, risk disclosures, liability">' +
 '<span class="dos-docs-chip-lab">DOCS</span>' +
 '<span class="dos-docs-chip-sub">LEGAL</span>' +
 '</a>' +
 '<a class="dos-docs-chip-mini" href="' + DOCS_HREF + '" title="Docs index">+</a>';

 document.body.appendChild(el);
 document.body.classList.add('has-dos-docs-chip');
 }

 function boot() {
 if (!document.body) return;
 injectDocsChip();
 }

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', boot);
 } else {
 boot();
 }

 setTimeout(function () {
 if (document.body && !document.getElementById('dosDocsChip') && !isLegalPage()) {
 injectDocsChip();
 }
 }, 800);
})();
