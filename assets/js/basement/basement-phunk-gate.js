/**
 * Basement - EAT SHIT / Phunk Lab link only works after easter egg unlock
 */
(function () {
 const GATE_KEY = 'doswapz_phunk_gate';

 function makerUrl() {
 if (window.DOSWAPZ_ERA && typeof DOSWAPZ_ERA.isOrbit === 'function' && DOSWAPZ_ERA.isOrbit()) {
 return '/orbit/pages/basement/phunk-maker.html';
 }
 if (location.pathname.indexOf('/orbit/') >= 0) {
 return '/orbit/pages/basement/phunk-maker.html';
 }
 return '/classic/pages/basement/phunk-maker.html';
 }

 document.addEventListener('DOMContentLoaded', () => {
 const link = document.getElementById('phunkLabLink');
 if (!link) return;

 const unlocked = sessionStorage.getItem(GATE_KEY) === 'unlocked';

 if (unlocked) {
 link.classList.add('phunk-unlocked');
 var status = link.querySelector('.phunk-status');
 if (status) {
  // Keep bracket style when the locked label used them ([ LOCKED ] → [ UNLOCKED ])
  var hadBrackets = /\[/.test(status.textContent || '');
  status.textContent = hadBrackets ? '[ UNLOCKED ]' : 'UNLOCKED';
 }
 const go = () => { window.location.href = makerUrl(); };
 link.addEventListener('click', (e) => { e.preventDefault(); go(); });
 link.addEventListener('keydown', (e) => {
 if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
 });
 } else {
 const noop = (e) => { e.preventDefault(); };
 link.addEventListener('click', noop);
 link.addEventListener('keydown', noop);
 }
 });
})();