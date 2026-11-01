/**
 * Vantablack - bonding-curve token launch (wallet-signed).
 * Classic SPL launcher remains in token-launcher.js.
 */
import {
 Connection,
 Keypair,
 PublicKey,
 SystemProgram,
 Transaction,
 VersionedTransaction
} from 'https://esm.sh/@solana/web3.js@1.91.0';

const CURVE_METADATA_API = 'https://pump.fun/api/ipfs';
const CURVE_TX_API = 'https://pumpportal.fun/api/trade-local';
const DEFAULT_RPC = '/api/solana-rpc';

let walletProvider = null;
let connectedPubkey = null;

function $(id) {
 return document.getElementById(id);
}

function setStatus(msg, color) {
 const el = $('curveLaunchStatus');
 if (!el) return;
 el.textContent = msg;
 el.style.color = color || '#ddbbff';
}

function shortAddr(addr) {
 if (!addr || addr.length < 10) return addr || '';
 return addr.slice(0, 4) + '...' + addr.slice(-4);
}

function detectWallet() {
 if (window.solana?.isPhantom) return window.solana;
 if (window.solflare?.isSolflare) return window.solflare;
 if (window.solana) return window.solana;
 return null;
}

function getRpcUrl() {
 const cfg = window.VANTABLACK_CONFIG;
 const endpoint = (cfg && cfg.rpcUrl) || DEFAULT_RPC;
 return endpoint.indexOf('http') === 0
 ? endpoint
 : new URL(endpoint, window.location.origin).toString();
}

function getConnection() {
 return new Connection(getRpcUrl(), 'confirmed');
}

function updateWalletUi() {
 const launchBtn = $('launchCurveBtn');
 if (launchBtn) launchBtn.disabled = !connectedPubkey;
}

function syncWalletFromShared() {
 const shared = window.VB_LAUNCHER_WALLET;
 if (shared && shared.pubkey) {
 walletProvider = shared.provider;
 connectedPubkey = shared.pubkey;
 } else {
 walletProvider = null;
 connectedPubkey = null;
 }
 updateWalletUi();
}

async function uploadCurveMetadata(meta) {
 const form = new FormData();
 form.append('file', meta.imageFile);
 form.append('name', meta.name);
 form.append('symbol', meta.symbol);
 form.append('description', meta.description || meta.name);
 form.append('showName', 'true');
 if (meta.twitter) form.append('twitter', meta.twitter);
 if (meta.telegram) form.append('telegram', meta.telegram);
 if (meta.website) form.append('website', meta.website);

 const res = await fetch(CURVE_METADATA_API, { method: 'POST', body: form });
 if (!res.ok) {
 const txt = await res.text().catch(() => '');
 throw new Error('Metadata upload failed (' + res.status + '). ' + (txt || 'Try a PNG/JPG under 2MB.'));
 }
 const data = await res.json();
 if (!data.metadataUri) throw new Error('IPFS upload did not return metadataUri');
 return data.metadataUri;
}

async function confirmSignature(connection, signature) {
 const timeoutMs = 75000;
 const start = Date.now();
 while (Date.now() - start < timeoutMs) {
 const resp = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
 const status = resp?.value?.[0];
 if (status) {
 if (status.err) throw new Error('Transaction failed: ' + JSON.stringify(status.err));
 if (status.confirmationStatus === 'processed' || status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
 return;
 }
 }
 await new Promise((r) => setTimeout(r, 1200));
 }
}

async function launchCurveToken() {
 if (!connectedPubkey || !walletProvider) {
 setStatus('Connect wallet first.', '#ff6666');
 return;
 }

 const name = ($('curveTokenName')?.value || '').trim();
 const symbol = ($('curveTokenSymbol')?.value || '').trim().toUpperCase();
 const description = ($('curveTokenDesc')?.value || '').trim();
 const devBuy = parseFloat($('curveDevBuy')?.value || '0.01');
 const imageInput = $('curveTokenImage');
 const imageFile = imageInput?.files?.[0];

 if (!name || name.length < 2) {
 setStatus('Token name required (2+ chars).', '#ff6666');
 return;
 }
 if (!symbol || symbol.length < 2 || symbol.length > 10) {
 setStatus('Symbol required (2 - 10 chars).', '#ff6666');
 return;
 }
 if (!imageFile) {
 setStatus('Token image required (PNG or JPG).', '#ff6666');
 return;
 }
 if (!Number.isFinite(devBuy) || devBuy < 0 || devBuy > 5) {
 setStatus('Dev buy must be 0 - 5 SOL.', '#ff6666');
 return;
 }

 const btn = $('launchCurveBtn');
 if (btn) {
 btn.disabled = true;
 btn.textContent = 'LAUNCHING...';
 }

 const mintKeypair = Keypair.generate();
 const connection = getConnection();

 try {
 const vb = window.VANTABLACK_CONFIG || {};
 const feeSol = Number(vb.launchFeeSol);
 const feeTo = String(vb.siteFeeSol || '').trim();
 if (Number.isFinite(feeSol) && feeSol > 0 && feeTo) {
  setStatus('Collecting site launch fee (' + feeSol + ' SOL)...', '#ffaa00');
  const feeTx = new Transaction().add(
   SystemProgram.transfer({
    fromPubkey: new PublicKey(connectedPubkey),
    toPubkey: new PublicKey(feeTo),
    lamports: Math.round(feeSol * 1e9)
   })
  );
  const bh = await connection.getLatestBlockhash('confirmed');
  feeTx.recentBlockhash = bh.blockhash;
  feeTx.feePayer = new PublicKey(connectedPubkey);
  if (typeof walletProvider.signAndSendTransaction === 'function') {
   const sent = await walletProvider.signAndSendTransaction(feeTx, { skipPreflight: false });
   const feeSig = typeof sent === 'string' ? sent : (sent && sent.signature);
   if (feeSig) await confirmSignature(connection, String(feeSig));
  } else {
   const signedFee = await walletProvider.signTransaction(feeTx);
   const feeSig = await connection.sendRawTransaction(signedFee.serialize(), { skipPreflight: false });
   await confirmSignature(connection, feeSig);
  }
 }

 setStatus('Uploading metadata to IPFS...', '#ffaa00');
 const metadataUri = await uploadCurveMetadata({ name, symbol, description, imageFile });

 setStatus('Building bonding-curve create tx...', '#ffaa00');
 const tradeRes = await fetch(CURVE_TX_API, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 publicKey: connectedPubkey,
 action: 'create',
 tokenMetadata: { name, symbol, uri: metadataUri },
 mint: mintKeypair.publicKey.toBase58(),
 denominatedInSol: 'true',
 amount: devBuy,
 slippage: 12,
 priorityFee: 0.00005,
 pool: 'pump'
 })
 });

 if (!tradeRes.ok) {
 const errTxt = await tradeRes.text().catch(() => '');
 throw new Error('Curve tx build failed: ' + (errTxt || tradeRes.statusText));
 }

 const txBytes = new Uint8Array(await tradeRes.arrayBuffer());
 const tx = VersionedTransaction.deserialize(txBytes);

 setStatus('Approve curve launch in wallet...', '#ffaa00');

 if (typeof walletProvider.signTransaction !== 'function') {
 throw new Error('Wallet cannot sign versioned transactions');
 }

 const signed = await walletProvider.signTransaction(tx);
 signed.sign([mintKeypair]);

 const signature = await connection.sendRawTransaction(signed.serialize(), {
 skipPreflight: true,
 maxRetries: 5
 });

 setStatus('Confirming on-chain...', '#ffaa00');
 await confirmSignature(connection, signature);

 const mintStr = mintKeypair.publicKey.toString();

 if (window.DOSWAPZ_VANTABLACK) {
 try {
 await window.DOSWAPZ_VANTABLACK.register({
 mint: mintStr,
 symbol,
 name,
 decimals: 6,
 creator: connectedPubkey,
 supply: '',
 launchType: 'curve',
 section: 'created',
 tag: 'created'
 });
 } catch (e) {}
 }

 try {
 localStorage.setItem('basement_last_launch', JSON.stringify({
 name, symbol, mint: mintStr, launchType: 'curve', devBuy, ts: new Date().toISOString()
 }));
 navigator.clipboard.writeText(mintStr);
 } catch (e) {}

 const onOrbit = location.pathname.indexOf('/orbit/') >= 0;
 const marketUrl = onOrbit
 ? '/orbit/pages/basement/vantablack/market.html'
 : '/classic/pages/basement/vantablack/market.html';
 setStatus('CURVE TOKEN LIVE - bonding at ~$69k graduation. Mint copied.', '#00ff41');

 const result = $('curveLaunchResult');
 if (result) {
 result.style.display = 'block';
 const mintEl = $('curveResultMint');
 const sigEl = $('curveResultSig');
 if (mintEl) mintEl.textContent = mintStr;
 if (sigEl) {
 sigEl.innerHTML = '<a href="https://solscan.io/tx/' + signature + '" target="_blank" rel="noopener" style="color:#aaffaa;">' +
 shortAddr(signature) + ' -> Solscan</a>';
 }
 const link = $('curveMarketBtn');
 if (link) link.href = marketUrl;
 }
 } catch (err) {
 console.error(err);
 setStatus('Curve launch failed: ' + (err.message || err), '#ff6666');
 } finally {
 if (btn) {
 btn.disabled = !connectedPubkey;
 btn.textContent = 'LAUNCH CURVE TOKEN';
 }
 }
}

function bindModeTabs() {
 // Multi-chain controller owns panel visibility when present
 if (document.getElementById('chainGrid') || document.getElementById('evmLaunchPanel')) {
 return;
 }
 const tabs = document.querySelectorAll('[data-launch-mode]');
 const classicPanel = $('classicLaunchPanel');
 const curvePanel = $('curveLaunchPanel');

 tabs.forEach(function (tab) {
 tab.addEventListener('click', function () {
 const mode = tab.getAttribute('data-launch-mode');
 tabs.forEach(function (t) { t.classList.toggle('active', t === tab); });
 if (classicPanel) classicPanel.style.display = mode === 'classic' ? 'block' : 'none';
 if (curvePanel) curvePanel.style.display = mode === 'curve' ? 'block' : 'none';
 });
 });
}

function bind() {
 bindModeTabs();
 syncWalletFromShared();
 window.addEventListener('vb-wallet-change', syncWalletFromShared);
 $('launchCurveBtn')?.addEventListener('click', launchCurveToken);
 const fee = (window.VANTABLACK_CONFIG && window.VANTABLACK_CONFIG.launchFeeSol) || 0.02;
 setStatus('Trix-style curve: creator owns the token. Site launch fee ' + fee + ' SOL + optional dev buy.', '#cc88ff');
}

if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', bind);
} else {
 bind();
}