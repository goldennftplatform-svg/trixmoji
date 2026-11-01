/* DOSWAPZ - Pond0x rail embed (indexed swaps count on protocol) */
(function () {
 'use strict';

 var STORAGE_KEY = 'doswapz_swap_rail';
 var cfg = window.POND_CONFIG || {};

 function $(id) {
 return document.getElementById(id);
 }

 function getReferralWallet() {
 return (cfg.referralWallet || '').trim();
 }

 function buildPondSwapUrl() {
 var url = new URL(cfg.swapBase || 'https://www.pond0x.com/swap/solana');
 var ref = getReferralWallet();
 if (ref) url.searchParams.set('ref', ref);
 url.searchParams.set('utm_source', 'doswapz');
 url.searchParams.set('utm_medium', 'swap_rail');
 return url.toString();
 }

 function setRailUi(mode) {
 var pondPanel = $('pondRailPanel');
 var jupiterPanel = $('jupiterSwapPanel');
 var pondBtn = $('railPondBtn');
 var jupBtn = $('railJupiterBtn');
 var railStatus = $('railStatus');

 var isPond = mode === 'pond';
 if (pondPanel) pondPanel.style.display = isPond ? 'block' : 'none';
 if (jupiterPanel) jupiterPanel.style.display = isPond ? 'none' : 'block';
 if (pondBtn) {
 pondBtn.classList.toggle('rail-active', isPond);
 pondBtn.setAttribute('aria-pressed', isPond ? 'true' : 'false');
 }
 if (jupBtn) {
 jupBtn.classList.toggle('rail-active', !isPond);
 jupBtn.setAttribute('aria-pressed', !isPond ? 'true' : 'false');
 }

 if (railStatus) {
 if (isPond) {
 var ref = getReferralWallet();
 railStatus.textContent = ref
 ? 'POND RAIL ACTIVE - swaps index on Pond0x * ref ' + ref.slice(0, 4) + '...' + ref.slice(-4)
 : 'POND RAIL ACTIVE - swaps index on Pond0x protocol (set referralWallet in pond-config for ref credit)';
 railStatus.style.color = '#00ff00';
 } else {
 railStatus.textContent =
 'DIRECT JUPITER - fast Trix/exotic routes; may NOT count on Pond manifest rails';
 railStatus.style.color = '#ffaa00';
 }
 }
 }

 function mountPondIframe() {
 var frame = $('pondSwapFrame');
 var link = $('pondSwapLink');
 var url = buildPondSwapUrl();
 if (frame && frame.src !== url) frame.src = url;
 if (link) link.href = url;
 }

 function setRail(mode) {
 var next = mode === 'jupiter' ? 'jupiter' : 'pond';
 try {
 localStorage.setItem(STORAGE_KEY, next);
 } catch (e) {}
 setRailUi(next);
 if (next === 'pond') mountPondIframe();
 }

 function init() {
 var defaultRail = cfg.defaultRail === 'jupiter' ? 'jupiter' : 'pond';
 var saved = defaultRail;
 try {
 saved = localStorage.getItem(STORAGE_KEY) || defaultRail;
 } catch (e) {}

 var pondBtn = $('railPondBtn');
 var jupBtn = $('railJupiterBtn');
 if (pondBtn) pondBtn.addEventListener('click', function () { setRail('pond'); });
 if (jupBtn) jupBtn.addEventListener('click', function () { setRail('jupiter'); });

 setRail(saved);
 }

 window.DOSWAPZ_POND_RAIL = {
 buildPondSwapUrl: buildPondSwapUrl,
 setRail: setRail
 };

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', init);
 } else {
 init();
 }
})();