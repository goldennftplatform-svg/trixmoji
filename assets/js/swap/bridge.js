/* DOSWAPZ multi-chain bridge UI - partner rails + Robinhood Chain */
(function () {
 'use strict';

 var CHAINS = window.DOSWAPZ_CHAINS;
 if (!CHAINS) {
 console.error('DOSWAPZ_CHAINS missing - load chains-config.js first');
 return;
 }

 var selectedRoute = 'lifi';
 var connected = null;
 var mode = 'bridge';

 function $(id) {
 return document.getElementById(id);
 }

 function shortAddr(a) {
 if (!a || a.length < 10) return a || '';
 return a.slice(0, 6) + '...' + a.slice(-4);
 }

 function chainList() {
 return CHAINS.list().filter(function (c) {
 return c.id !== 'optimism' || true;
 });
 }

 function fillSelect(el, preferId) {
 if (!el) return;
 el.innerHTML = '';
 chainList().forEach(function (c) {
 var opt = document.createElement('option');
 opt.value = c.id;
 opt.textContent = c.hood ? ('★ ' + c.label) : c.label;
 el.appendChild(opt);
 });
 if (preferId && CHAINS.byId(preferId)) el.value = preferId;
 }

 function renderChips() {
 var row = $('chipRow');
 if (!row) return;
 row.innerHTML = '';
 chainList().forEach(function (c) {
 var span = document.createElement('span');
 span.className = 'chip' + (c.hood ? ' hood' : '');
 span.textContent = c.hood
 ? (c.label + ' * ' + c.chainId)
 : c.label;
 row.appendChild(span);
 });
 }

 function setStatus(msg, color) {
 var el = $('statusLine');
 if (!el) return;
 el.textContent = msg;
 el.style.color = color || '#00cc00';
 }

 function parseAmount() {
 var n = parseFloat(String(($('amount') && $('amount').value) || '').replace(/,/g, ''));
 return isFinite(n) && n > 0 ? n : 0;
 }

 function renderRoutes() {
 var list = $('routeList');
 if (!list) return;
 list.innerHTML = '';
 var from = CHAINS.byId($('fromChain').value) || CHAINS.byId('ethereum');
 var to = CHAINS.byId($('toChain').value) || CHAINS.byId('robinhood');

 CHAINS.bridgeRoutes().forEach(function (r) {
 if (r.id === 'canonical') {
 var ok =
 (from.id === 'ethereum' && to.id === 'robinhood') ||
 (to.id === 'ethereum' && from.id === 'robinhood');
 if (!ok) return;
 }
 if ((from.kind === 'sol' || to.kind === 'sol') &&
 (r.id === 'canonical' || r.id === 'across')) {
 return;
 }

 var btn = document.createElement('button');
 btn.type = 'button';
 btn.className = 'route-item' + (selectedRoute === r.id ? ' selected' : '');
 btn.innerHTML =
 '<span class="name">' + r.name + '</span>' +
 '<span class="eta">' + r.eta + '</span>' +
 '<span class="fee">~' + (r.feeBps / 100).toFixed(2) + '%</span>';
 btn.title = r.note;
 btn.addEventListener('click', function () {
 selectedRoute = r.id;
 renderRoutes();
 updateQuote();
 });
 list.appendChild(btn);
 });

 if (!list.children.length) {
 selectedRoute = 'lifi';
 var fallback = document.createElement('button');
 fallback.type = 'button';
 fallback.className = 'route-item selected';
 fallback.innerHTML =
 '<span class="name">LI.FI / Jumper</span>' +
 '<span class="eta">multi-hop</span>' +
 '<span class="fee">varies</span>';
 list.appendChild(fallback);
 }
 }

 function updateQuote() {
 var quoteLine = $('quoteLine');
 if (!quoteLine) return;
 var amt = parseAmount();
 var asset = ($('asset') && $('asset').value) || 'USDC';
 var from = CHAINS.byId($('fromChain').value);
 var to = CHAINS.byId($('toChain').value);
 var routes = CHAINS.bridgeRoutes();
 var route = null;
 for (var i = 0; i < routes.length; i++) {
 if (routes[i].id === selectedRoute) {
 route = routes[i];
 break;
 }
 }
 route = route || routes[0];

 if (!amt || !from || !to) {
 quoteLine.textContent = 'Enter amount * pick chains * pick a route';
 return;
 }
 if (from.id === to.id) {
 quoteLine.textContent = 'FROM and TO are the same chain';
 quoteLine.style.color = '#ff5555';
 return;
 }
 quoteLine.style.color = '#ffff00';
 var fee = amt * (route.feeBps / 10000);
 var out = Math.max(0, amt - fee - amt * 0.0015);
 var outStr = (asset === 'WBTC' || asset === 'ETH' || asset === 'SOL')
 ? out.toFixed(6)
 : out.toFixed(2);
 quoteLine.textContent =
 amt + ' ' + asset + ' on ' + from.label +
 ' -> ~' + outStr + ' ' + asset + ' on ' + to.label +
 ' * via ' + route.name + ' (est.)';
 }

 function setMode(next) {
 mode = next;
 document.querySelectorAll('.mode-tab').forEach(function (t) {
 t.classList.toggle('active', t.getAttribute('data-mode') === next);
 });
 if (next === 'hood') {
 if (String($('fromChain').value).indexOf('robinhood') === 0) {
 $('fromChain').value = 'ethereum';
 }
 $('toChain').value = 'robinhood';
 } else if (next === 'exit') {
 $('fromChain').value = 'robinhood';
 if (String($('toChain').value).indexOf('robinhood') === 0) {
 $('toChain').value = 'ethereum';
 }
 }
 renderRoutes();
 updateQuote();
 setStatus(
 next === 'hood'
 ? 'Preset: bridge INTO Robinhood Chain mainnet (4663).'
 : next === 'exit'
 ? 'Preset: exit OUT of Robinhood Chain.'
 : 'Free-form multi-chain bridge.',
 '#00cc00'
 );
 }

 async function connectWallet() {
 if (window.ethereum && window.ethereum.request) {
 try {
 var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
 if (accounts && accounts[0]) {
 connected = { kind: 'evm', address: accounts[0] };
 $('walletStatus').textContent = 'EVM * ' + shortAddr(accounts[0]);
 $('connectBtn').style.display = 'none';
 if ($('disconnectBtn')) $('disconnectBtn').style.display = '';
 setStatus('Wallet connected. Open a partner rail to bridge.', '#00cc00');
 return;
 }
 } catch (e) {
 setStatus('Wallet request cancelled or failed.', '#ff5555');
 return;
 }
 }
 if (window.solana && (window.solana.isPhantom || window.solana.connect)) {
 try {
 var res = await window.solana.connect();
 var pk = res && res.publicKey ? res.publicKey.toString() : null;
 if (pk) {
 connected = { kind: 'sol', address: pk };
 $('walletStatus').textContent = 'SOL * ' + shortAddr(pk);
 $('connectBtn').style.display = 'none';
 if ($('disconnectBtn')) $('disconnectBtn').style.display = '';
 setStatus('Phantom connected - use LI.FI for Solana multi-hop.', '#00cc00');
 return;
 }
 } catch (e2) {}
 }
 setStatus('No wallet found. You can still open partner bridge links.', '#ffaa00');
 }

 function disconnectWallet() {
 connected = null;
 if ($('walletStatus')) {
 $('walletStatus').textContent = 'No wallet connected * partner links still work';
 }
 if ($('connectBtn')) $('connectBtn').style.display = '';
 if ($('disconnectBtn')) $('disconnectBtn').style.display = 'none';
 setStatus('Disconnected.', '#00cc00');
 }

 function openBridge() {
 var amt = parseAmount();
 var from = CHAINS.byId($('fromChain').value);
 var to = CHAINS.byId($('toChain').value);
 if (!from || !to || from.id === to.id) {
 setStatus('Pick two different chains.', '#ff5555');
 return;
 }
 if (!amt) {
 setStatus('Enter an amount (for your records / partner UI).', '#ffaa00');
 }
 updateQuote();
 var routes = CHAINS.bridgeRoutes();
 var route = routes[0];
 for (var i = 0; i < routes.length; i++) {
 if (routes[i].id === selectedRoute) {
 route = routes[i];
 break;
 }
 }
 var url = typeof route.url === 'function'
 ? route.url(CHAINS.jumperChainKey(from.id), CHAINS.jumperChainKey(to.id))
 : 'https://jumper.exchange';
 setStatus('Opening ' + route.name + '... complete the transfer in their UI.', '#ffff00');
 window.open(url, '_blank', 'noopener,noreferrer');
 }

 function bind() {
 if (!$('fromChain') || !$('toChain')) return;

 fillSelect($('fromChain'), 'ethereum');
 fillSelect($('toChain'), 'robinhood');
 renderChips();
 renderRoutes();
 updateQuote();

 $('fromChain').addEventListener('change', function () {
 mode = 'bridge';
 document.querySelectorAll('.mode-tab').forEach(function (t) {
 t.classList.toggle('active', t.getAttribute('data-mode') === 'bridge');
 });
 renderRoutes();
 updateQuote();
 });
 $('toChain').addEventListener('change', function () {
 mode = 'bridge';
 document.querySelectorAll('.mode-tab').forEach(function (t) {
 t.classList.toggle('active', t.getAttribute('data-mode') === 'bridge');
 });
 renderRoutes();
 updateQuote();
 });
 if ($('asset')) $('asset').addEventListener('change', updateQuote);
 if ($('amount')) $('amount').addEventListener('input', updateQuote);
 if ($('flipChains')) {
 $('flipChains').addEventListener('click', function () {
 var a = $('fromChain').value;
 $('fromChain').value = $('toChain').value;
 $('toChain').value = a;
 renderRoutes();
 updateQuote();
 });
 }
 document.querySelectorAll('.mode-tab').forEach(function (tab) {
 tab.addEventListener('click', function () {
 setMode(tab.getAttribute('data-mode'));
 });
 });
 if ($('connectBtn')) $('connectBtn').addEventListener('click', connectWallet);
 if ($('disconnectBtn')) $('disconnectBtn').addEventListener('click', disconnectWallet);
 if ($('executeBtn')) $('executeBtn').addEventListener('click', openBridge);
 }

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', bind);
 } else {
 bind();
 }
})();
