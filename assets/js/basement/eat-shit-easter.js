/**
 * Eat Shit page - 17s wait -> DOS dialog -> unlock Phunk Lab in Basement
 */
(function () {
 const GATE_KEY = 'doswapz_phunk_gate';
 const DISMISS_KEY = 'doswapz_phunk_prompt_dismissed';
 const WAIT_MS = 17000;
 function makerUrl() {
 if (window.DOSWAPZ_ERA && typeof DOSWAPZ_ERA.isOrbit === 'function' && DOSWAPZ_ERA.isOrbit()) {
 return '/orbit/pages/basement/phunk-maker.html';
 }
 if (location.pathname.indexOf('/orbit/') >= 0) {
 return '/orbit/pages/basement/phunk-maker.html';
 }
 return '/classic/pages/basement/phunk-maker.html';
 }

 let fired = false;

 function createDialog() {
 if (document.getElementById('phunkDosDialog')) return;

 const overlay = document.createElement('div');
 overlay.id = 'phunkDosOverlay';
 overlay.innerHTML = `
 <div id="phunkDosDialog" class="phunk-dos-dialog" role="dialog" aria-labelledby="phunkDosTitle">
 <div class="phunk-dos-title">
 <span id="phunkDosTitle">C:\\PHUNK\\MAKER.EXE</span>
 <button type="button" class="phunk-dos-close" id="phunkDosClose" aria-label="Close">✕</button>
 </div>
 <div class="phunk-dos-body">
 <p>Would you like to make your own Phunk?</p>
 <div class="phunk-dos-buttons">
 <button type="button" class="phunk-dos-btn" id="phunkDosYes">[ Y ] YES</button>
 <button type="button" class="phunk-dos-btn" id="phunkDosNo">[ N ] NO</button>
 </div>
 </div>
 </div>
 `;

 document.body.appendChild(overlay);

 document.getElementById('phunkDosYes').addEventListener('click', () => {
 sessionStorage.setItem(GATE_KEY, 'unlocked');
 sessionStorage.removeItem(DISMISS_KEY);
 window.location.href = makerUrl();
 });

 function closeDialog() {
 overlay.remove();
 sessionStorage.setItem(DISMISS_KEY, '1');
 }

 document.getElementById('phunkDosNo').addEventListener('click', closeDialog);
 document.getElementById('phunkDosClose').addEventListener('click', closeDialog);
 }

 function maybeShow() {
 if (fired) return;
 if (sessionStorage.getItem(GATE_KEY) === 'unlocked') return;
 if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
 fired = true;
 createDialog();
 }

 window.addEventListener('load', () => {
 setTimeout(maybeShow, WAIT_MS);
 });
})();