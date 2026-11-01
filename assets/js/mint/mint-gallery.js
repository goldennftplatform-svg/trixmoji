/* DOSWAPZ Mint Gallery - soft wallet view + local mint cards (no funds) */
window.DOSWAPZ_MINT_GALLERY = (function () {
 'use strict';

 var FLOORED_URL = 'https://floored.app';
 var state = {
 address: null,
 chain: null,
 filterMine: false
 };

 function shortAddr(a) {
 if (!a || a.length < 12) return a || ' - ';
 return a.slice(0, 6) + '...' + a.slice(-4);
 }

 function setStatus(msg, kind) {
 var el = document.getElementById('galleryStatus');
 if (!el) return;
 el.textContent = msg || '';
 el.className = 'gallery-status' + (kind ? ' ' + kind : '');
 }

 function setWalletUi() {
 var addrEl = document.getElementById('galleryWalletAddr');
 var btn = document.getElementById('galleryConnectBtn');
 var filterBtn = document.getElementById('galleryFilterMine');
 if (addrEl) {
 addrEl.textContent = state.address
 ? (state.chain ? state.chain.toUpperCase() + ' * ' : '') + shortAddr(state.address)
 : 'NOT CONNECTED';
 }
 if (btn) btn.textContent = state.address ? 'DISCONNECT' : 'SOFT CONNECT WALLET';
 if (filterBtn) {
 filterBtn.disabled = !state.address;
 filterBtn.textContent = state.filterMine ? 'SHOW ALL MINTS' : 'SHOW MY MINTS ONLY';
 }
 }

 function loadEntries() {
 var list = [];
 if (window.DOSWAPZ_MATH && typeof DOSWAPZ_MATH.loadMints === 'function') {
 list = DOSWAPZ_MATH.loadMints() || [];
 }
 if (state.filterMine && state.address) {
 var key = state.address.toLowerCase();
 list = list.filter(function (m) {
 return m.wallet && String(m.wallet).toLowerCase() === key;
 });
 }
 return list;
 }

 function sampleEntries() {
 if (!window.DOSWAPZ_MATH || !DOSWAPZ_MATH.EXAMPLE_SEEDS) return [];
 var seeds = DOSWAPZ_MATH.EXAMPLE_SEEDS;
 return Object.keys(seeds).slice(0, 8).map(function (k) {
 return {
 seed: seeds[k],
 style: k,
 label: DOSWAPZ_MATH.styleLabel ? DOSWAPZ_MATH.styleLabel(k) : k.toUpperCase(),
 cosmic: k === 'cosmic',
 wallet: 'sample',
 ts: 0,
 sample: true
 };
 });
 }

 function renderCard(entry, grid) {
 var card = document.createElement('div');
 card.className = 'mint-card' + (entry.sample ? ' sample' : '');

 var canvas = document.createElement('canvas');
 canvas.width = 32;
 canvas.height = 32;
 if (window.DOSWAPZ_MATH && DOSWAPZ_MATH.drawTo) {
 try {
 DOSWAPZ_MATH.drawTo(canvas, entry.seed, { voxels: true, voxelSize: 6 });
 } catch (e) {}
 }

 var meta = document.createElement('div');
 meta.className = 'mint-meta';
 var shortWallet = entry.wallet && entry.wallet.length > 10
 ? shortAddr(entry.wallet)
 : (entry.wallet || 'preview');
 meta.innerHTML =
 '<strong>' + (entry.label || entry.style || 'MINT') + '</strong>' +
 (entry.cosmic ? ' <span class="oneofone">1/1 COSMIC</span>' : '') +
 (entry.sample ? ' <span class="sample-tag">SAMPLE</span>' : '') +
 '<br>SEED: ' + String(entry.seed || '').slice(0, 18) +
 (String(entry.seed || '').length > 18 ? '...' : '') +
 '<br>WALLET: ' + shortWallet;

 card.appendChild(canvas);
 card.appendChild(meta);
 grid.appendChild(card);
 }

 function renderGallery(opts) {
 opts = opts || {};
 var grid = document.getElementById('math-grid');
 if (!grid) return;

 var mints = loadEntries();
 var usingSamples = false;
 if (!mints.length && opts.allowSamples !== false) {
 mints = sampleEntries();
 usingSamples = true;
 }

 if (!mints.length) {
 grid.innerHTML =
 '<div class="empty-msg">' +
 'NO MINTS YET - CONNECT ON THE MINT PAGE, THEN RETURN HERE.<br>' +
 '<a class="btn" href="' + mintPath() + '">GO TO MINT -> </a>' +
 '</div>';
 setStatus(state.address ? 'Connected - no mints saved for this wallet yet.' : 'Soft-connect optional. Mint first to populate your gallery.');
 return;
 }

 grid.innerHTML = '';
 mints.forEach(function (entry) { renderCard(entry, grid); });

 if (usingSamples) {
 setStatus('Showing sample math mints - your real mints appear after a live mint.');
 } else if (state.filterMine && state.address) {
 setStatus(mints.length + ' mint(s) for ' + shortAddr(state.address));
 } else {
 setStatus(mints.length + ' mint(s) in local gallery' + (state.address ? ' * connected ' + shortAddr(state.address) : ''));
 }
 }

 function mintPath() {
 return location.pathname.indexOf('/orbit/') >= 0
 ? '/orbit/pages/doswapz/mint.html'
 : '/classic/pages/doswapz/mint.html';
 }

 async function softConnect() {
 if (state.address) {
 state.address = null;
 state.chain = null;
 state.filterMine = false;
 setWalletUi();
 renderGallery();
 setStatus('Disconnected. Soft session ended - no funds moved.');
 return;
 }

 setStatus('Requesting soft wallet connect (view only)...');

 // Prefer Ethereum for math mints; Solana also allowed for soft session display
 if (window.ethereum && typeof window.ethereum.request === 'function') {
 try {
 var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
 var addr = accounts && accounts[0];
 if (!addr) throw new Error('No account');
 // Soft sign - message only, no tx
 var msg =
 'DOSWAPZ MINT GALLERY - SOFT VERIFY\n' +
 'View-only connection.\n' +
 'NO FUNDS * NO TRANSACTION * NO APPROVALS\n' +
 'Address: ' + addr + '\n' +
 'Time: ' + new Date().toISOString();
 await window.ethereum.request({
 method: 'personal_sign',
 params: [msg, addr]
 });
 state.address = addr;
 state.chain = 'eth';
 setWalletUi();
 renderGallery();
 setStatus('Soft connected ' + shortAddr(addr) + ' - signature only, no funds.', 'ok');
 return;
 } catch (err) {
 setStatus('ETH soft connect cancelled or failed: ' + (err.message || err), 'err');
 return;
 }
 }

 if (window.solana && typeof window.solana.connect === 'function') {
 try {
 var resp = await window.solana.connect({ onlyIfTrusted: false });
 var sAddr = (resp && resp.publicKey && resp.publicKey.toString()) ||
 (window.solana.publicKey && window.solana.publicKey.toString());
 if (!sAddr) throw new Error('No Solana pubkey');
 if (typeof window.solana.signMessage === 'function') {
 var encoded = new TextEncoder().encode(
 'DOSWAPZ MINT GALLERY - SOFT VERIFY\nNO FUNDS\n' + sAddr
 );
 await window.solana.signMessage(encoded, 'utf8');
 }
 state.address = sAddr;
 state.chain = 'sol';
 setWalletUi();
 renderGallery();
 setStatus('Soft connected ' + shortAddr(sAddr) + ' (Sol) - no funds.', 'ok');
 return;
 } catch (err2) {
 setStatus('Solana soft connect cancelled or failed: ' + (err2.message || err2), 'err');
 return;
 }
 }

 setStatus('No wallet found. Install MetaMask / Phantom, or browse samples without connecting.', 'err');
 }

 function bind() {
 var connectBtn = document.getElementById('galleryConnectBtn');
 var filterBtn = document.getElementById('galleryFilterMine');
 var samplesBtn = document.getElementById('gallerySamplesBtn');

 if (connectBtn) connectBtn.addEventListener('click', function () { softConnect(); });
 if (filterBtn) {
 filterBtn.addEventListener('click', function () {
 if (!state.address) return;
 state.filterMine = !state.filterMine;
 setWalletUi();
 renderGallery({ allowSamples: !state.filterMine });
 });
 }
 if (samplesBtn) {
 samplesBtn.addEventListener('click', function () {
 state.filterMine = false;
 setWalletUi();
 var grid = document.getElementById('math-grid');
 if (!grid) return;
 grid.innerHTML = '';
 sampleEntries().forEach(function (e) { renderCard(e, grid); });
 setStatus('Sample gallery - not your wallet mints. Mint live to save yours.');
 });
 }

 var floored = document.getElementById('flooredLink');
 if (floored) {
 floored.href = FLOORED_URL;
 floored.rel = 'noopener noreferrer';
 floored.target = '_blank';
 }

 setWalletUi();
 renderGallery();
 }

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', bind);
 } else {
 bind();
 }

 return {
 render: renderGallery,
 softConnect: softConnect,
 FLOORED_URL: FLOORED_URL
 };
})();
