/* DOSWAPZ - hub boot sequence + flavor hints + what's new */
window.DOSWAPZ_HUB = (function () {
 'use strict';

 var inited = false;
 var WHATS_NEW_KEY = 'doswapz_whats_new_dismissed';
 var WHATS_NEW_VERSION = '2026-awardz-pool-v1';

 function $(sel) {
 return document.querySelector(sel);
 }

 function updateFlavorForEl(el) {
 var line = $('#hubFlavorLine');
 if (!line || !el) return;
 var flavor = el.getAttribute('data-flavor') || '';
 if (!flavor && el.classList.contains('option')) {
 flavor = 'open destination';
 }
 line.textContent = flavor;
 line.style.opacity = flavor ? '1' : '0';
 }

 function clearFlavor() {
 var line = $('#hubFlavorLine');
 if (line) {
 line.textContent = '';
 line.style.opacity = '0';
 }
 }

 function bindFlavorHints() {
 // Flavor hover text removed - keep hub quiet (no small status line on hover)
 clearFlavor();
 var line = $('#hubFlavorLine');
 if (line) {
 line.style.display = 'none';
 line.setAttribute('aria-hidden', 'true');
 }
 }

 function bindWhatsNew() {
 var banner = $('#whatsNewBanner');
 var dismiss = $('#whatsNewDismiss');
 if (!banner) return;

 try {
 var dismissed = localStorage.getItem(WHATS_NEW_KEY);
 if (dismissed === WHATS_NEW_VERSION) {
 return;
 }
 } catch (e) {}

 banner.classList.add('show');

 if (dismiss) {
 dismiss.addEventListener('click', function () {
 banner.classList.remove('show');
 try {
 localStorage.setItem(WHATS_NEW_KEY, WHATS_NEW_VERSION);
 } catch (e) {}
 });
 }
 }

 function markLastBoot() {
 var last = window.DOSWAPZ_SHELL ? window.DOSWAPZ_SHELL.getLastBoot() : '';
 if (!last) return;
 document.querySelectorAll('.section-head[href], .option[href]').forEach(function (a) {
 var href = a.getAttribute('href');
 if (href === last || last.endsWith(href)) {
 a.classList.add('last-boot');
 }
 });
 }

 function runBootSequence() {
 var status = $('.status');
 if (!status) return;

 var lines = [
 '> INITIALIZING DOSWAPZ...',
 '> GLITCH PROTOCOL ... OK',
 '> TICKER FEED ... SYNC',
 '> MENU ONLINE',
 '[CONNECTED] - STABLE'
 ];

 var i = 0;

 function tick() {
 if (i >= lines.length) return;
 status.textContent = lines[i];
 i += 1;
 setTimeout(tick, i === lines.length ? 280 : 340);
 }

 tick();
 }

 function init() {
 if (!document.body.classList.contains('hub-page') || inited) return;
 inited = true;

 bindWhatsNew();
 bindFlavorHints();
 markLastBoot();
 runBootSequence();
 }

 if (document.body.classList.contains('hub-page')) {
 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', init);
 } else {
 init();
 }
 }

 return { init: init };
})();