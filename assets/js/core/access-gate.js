/* Any link click on DOSWAPZ opens the participation notice. */
(function () {
  'use strict';
  if (window.__DOSWAPZ_ACCESS_GATE__) return;
  window.__DOSWAPZ_ACCESS_GATE__ = true;

  if (!document.querySelector('script[data-crawler-portraits]')) {
    var crawlers = document.createElement('script');
    crawlers.src = '/assets/js/core/crawler-portraits.js?v=20261029crawl';
    crawlers.setAttribute('data-crawler-portraits', '1');
    (document.head || document.documentElement).appendChild(crawlers);
  }

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
