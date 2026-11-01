/**
 * Vantablack multi-chain launcher controller.
 * Routes Solana (curve/classic) vs EVM (ERC-20) panels by selected chain.
 */
(function () {
 'use strict';

 function $(id) {
 return document.getElementById(id);
 }

 var selectedChain = 'solana';
 var selectedMode = 'curve';

 function chainsApi() {
 return window.DOSWAPZ_CHAINS;
 }

 function chainObj() {
 return chainsApi() ? chainsApi().byId(selectedChain) : null;
 }

 function renderChainGrid() {
 var grid = $('chainGrid');
 if (!grid || !chainsApi()) return;
 grid.innerHTML = '';
 chainsApi().list().forEach(function (c) {
 // hide pure bridge-only extras if needed - show all launch-capable
 if (!c.modes || !c.modes.length) return;
 var btn = document.createElement('button');
 btn.type = 'button';
 btn.className = 'chain-card' +
 (c.hood ? ' hood' : '') +
 (c.id === 'solana' ? ' sol' : '') +
 (selectedChain === c.id ? ' selected' : '');
 btn.innerHTML = '<span class="cname">' + c.label + '</span>';
 btn.addEventListener('click', function () {
 selectedChain = c.id;
 selectedMode = c.defaultMode || c.modes[0];
 window.VB_SELECTED_CHAIN = selectedChain;
 renderChainGrid();
 renderModes();
 syncPanels();
 });
 grid.appendChild(btn);
 });
 }

 function renderModes() {
 var c = chainObj();
 if (!c) return;
 var tabs = document.querySelectorAll('[data-launch-mode]');
 tabs.forEach(function (tab) {
 var mode = tab.getAttribute('data-launch-mode');
 var allowed = c.modes.indexOf(mode) >= 0;
 tab.disabled = !allowed;
 tab.style.display = allowed ? '' : 'none';
 tab.classList.toggle('active', allowed && mode === selectedMode);
 });
 if (c.modes.indexOf(selectedMode) < 0) {
 selectedMode = c.defaultMode || c.modes[0];
 tabs.forEach(function (tab) {
 tab.classList.toggle(
 'active',
 tab.getAttribute('data-launch-mode') === selectedMode
 );
 });
 }

 var hint = $('modeHint');
 if (hint) {
 if (selectedMode === 'curve') {
 hint.innerHTML =
 '<strong>Curve:</strong> Solana bonding-curve launch - image, optional dev buy, lists with curve tag.';
 } else if (selectedMode === 'classic') {
 hint.innerHTML =
 '<strong>Classic SPL:</strong> fixed-supply mint to your Solana wallet.';
 } else {
 hint.innerHTML =
 '<strong>ERC-20:</strong> deploy on ' + c.label +
 (c.chainId != null ? (' (chainId ' + c.chainId + ')') : '') +
 ' or list an existing contract. Auto-lists on Vantablack.';
 }
 }

 var sub = document.querySelector('.header .sub');
 if (sub) {
 sub.textContent = 'BASEMENT * ' + c.label.toUpperCase() +
 (c.chainId != null ? (' * ' + c.chainId) : '');
 }
 }

 function syncPanels() {
 var c = chainObj();
 var isEvm = c && c.kind === 'evm';
 var curvePanel = $('curveLaunchPanel');
 var classicPanel = $('classicLaunchPanel');
 var evmPanel = $('evmLaunchPanel');

 if (curvePanel) {
 curvePanel.style.display = (!isEvm && selectedMode === 'curve') ? 'block' : 'none';
 }
 if (classicPanel) {
 classicPanel.style.display = (!isEvm && selectedMode === 'classic') ? 'block' : 'none';
 }
 if (evmPanel) {
 evmPanel.style.display = isEvm ? 'block' : 'none';
 }

 // Mirror name/symbol into EVM fields when switching
 var name = ($('curveTokenName') && $('curveTokenName').value) ||
 ($('tokenName') && $('tokenName').value) || '';
 var symbol = ($('curveTokenSymbol') && $('curveTokenSymbol').value) ||
 ($('tokenSymbol') && $('tokenSymbol').value) || '';
 if ($('evmTokenName') && name && !$('evmTokenName').value) {
 $('evmTokenName').value = name;
 }
 if ($('evmTokenSymbol') && symbol && !$('evmTokenSymbol').value) {
 $('evmTokenSymbol').value = symbol;
 }
 if (isEvm && $('evmTokenDecimals')) {
 $('evmTokenDecimals').value = String(c.decimalsDefault || 18);
 }

 window.VB_SELECTED_CHAIN = selectedChain;
 window.VB_SELECTED_MODE = selectedMode;

 // Re-bind connect button routing
 wireConnectButton();
 }

 function wireConnectButton() {
 var btn = $('connectWalletBtn');
 if (!btn || btn._vbMultiBound) return;
 // Capture-phase override so we route EVM vs Solana
 btn.addEventListener('click', function (e) {
 var c = chainObj();
 if (c && c.kind === 'evm') {
 e.preventDefault();
 e.stopImmediatePropagation();
 if (window.VB_EVM_LAUNCHER && window.VB_EVM_LAUNCHER.onConnectClick) {
 window.VB_EVM_LAUNCHER.onConnectClick();
 }
 }
 // else let token-launcher.js handle Solana connect
 }, true);
 btn._vbMultiBound = true;
 }

 function bindModeTabs() {
 document.querySelectorAll('[data-launch-mode]').forEach(function (tab) {
 tab.addEventListener('click', function () {
 if (tab.disabled) return;
 selectedMode = tab.getAttribute('data-launch-mode');
 document.querySelectorAll('[data-launch-mode]').forEach(function (t) {
 t.classList.toggle('active', t === tab);
 });
 syncPanels();
 });
 });
 }

 function bind() {
 if (!chainsApi()) {
 console.warn('DOSWAPZ_CHAINS not loaded');
 return;
 }
 window.VB_SELECTED_CHAIN = selectedChain;
 window.VB_SELECTED_MODE = selectedMode;
 renderChainGrid();
 bindModeTabs();
 renderModes();
 syncPanels();
 }

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', bind);
 } else {
 bind();
 }
})();
