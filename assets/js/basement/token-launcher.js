/**
 * DOSWAPZ Basement - on-chain SPL token launcher (client-side, wallet-signed).
 */
import {
 ASSOCIATED_TOKEN_PROGRAM_ID,
 AuthorityType,
 MINT_SIZE,
 TOKEN_PROGRAM_ID,
 createAssociatedTokenAccountInstruction,
 createInitializeMintInstruction,
 createMintToInstruction,
 createSetAuthorityInstruction,
 getAssociatedTokenAddress,
 getMinimumBalanceForRentExemptMint
} from 'https://esm.sh/@solana/spl-token@0.4.9';
import {
 Connection,
 Keypair,
 PublicKey,
 SystemProgram,
 Transaction
} from 'https://esm.sh/@solana/web3.js@1.91.0';

const DEFAULT_RPC = '/api/solana-rpc';

let walletProvider = null;
let connectedPubkey = null;

function publishWallet() {
 window.VB_LAUNCHER_WALLET = connectedPubkey
 ? { provider: walletProvider, pubkey: connectedPubkey }
 : null;
 window.dispatchEvent(new CustomEvent('vb-wallet-change', {
 detail: window.VB_LAUNCHER_WALLET
 }));
}

function $(id) {
 return document.getElementById(id);
}

function setStatus(msg, color) {
 const el = $('launchStatus');
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
 const btn = $('connectWalletBtn');
 const addr = $('walletAddr');
 const launchBtn = $('launchTokenBtn');
 if (!btn || !addr) return;

 if (connectedPubkey) {
 btn.textContent = 'DISCONNECT';
 addr.textContent = shortAddr(connectedPubkey);
 if (launchBtn) launchBtn.disabled = false;
 } else {
 btn.textContent = 'CONNECT WALLET';
 addr.textContent = ' - ';
 if (launchBtn) launchBtn.disabled = true;
 }
}

async function connectWallet() {
 if (connectedPubkey) {
 const p = walletProvider || detectWallet();
 if (p?.disconnect) {
 try { await p.disconnect(); } catch (e) {}
 }
 walletProvider = null;
 connectedPubkey = null;
 publishWallet();
 updateWalletUi();
 setStatus('DISCONNECTED', '#cc88ff');
 hideResult();
 return;
 }

 const provider = detectWallet();
 if (!provider) {
 setStatus('No Solana wallet found. Install Phantom or Solflare.', '#ff6666');
 return;
 }

 try {
 const resp = await provider.connect({ onlyIfTrusted: false });
 walletProvider = provider;
 connectedPubkey = resp.publicKey.toString();
 publishWallet();
 updateWalletUi();
 setStatus('WALLET CONNECTED - ready to launch on mainnet', '#ff66cc');
 } catch (err) {
 setStatus('Connect failed: ' + (err.message || err), '#ff6666');
 }
}

function hideResult() {
 const box = $('launchResult');
 if (box) box.style.display = 'none';
}

async function showResult(mint, sig, meta) {
 const box = $('launchResult');
 const mintEl = $('resultMint');
 const sigEl = $('resultSig');
 const marketBtn = $('marketListBtn');
 if (!box || !mintEl) return;

 mintEl.textContent = mint;
 if (sigEl) {
 if (sig) {
 sigEl.innerHTML =
 '<a href="https://solscan.io/tx/' + sig + '" target="_blank" rel="noopener noreferrer" style="color:#aaffaa;">' +
 shortAddr(sig) + ' -> Solscan</a>';
 } else {
 sigEl.innerHTML =
 '<a href="https://solscan.io/token/' + mint + '" target="_blank" rel="noopener noreferrer" style="color:#aaffaa;">' +
 'View mint on Solscan -> </a>';
 }
 }
 const onOrbit = location.pathname.indexOf('/orbit/') >= 0;
 let swapPath;
 if (window.DOSWAPZ_VANTABLACK) {
 swapPath = onOrbit
 ? window.DOSWAPZ_VANTABLACK.orbitSwapUrl(mint)
 : window.DOSWAPZ_VANTABLACK.swapUrl(mint);
 } else {
 swapPath = (onOrbit ? '/orbit/pages/doswapz/swap.html?toMint=' : '/classic/pages/doswapz/swap.html?toMint=') +
 encodeURIComponent(mint);
 }
 if (marketBtn) {
 marketBtn.href = swapPath;
 marketBtn.textContent = 'SWAP ON DOSWAPZ -> ';
 }
 const swapBtn = $('swapTokenBtn');
 if (swapBtn) swapBtn.href = swapPath;
 const marketPageBtn = $('marketPageBtn');
 if (marketPageBtn) {
 marketPageBtn.href = onOrbit
 ? '/orbit/pages/basement/vantablack/market.html'
 : '/classic/pages/basement/vantablack/market.html';
 }
 box.style.display = 'block';

 if (window.DOSWAPZ_VANTABLACK && meta) {
 try {
 await window.DOSWAPZ_VANTABLACK.register({
 mint,
 symbol: meta.symbol,
 name: meta.name,
 decimals: meta.decimals,
 creator: connectedPubkey,
 supply: meta.supply,
 launchType: 'classic',
 section: 'created',
 tag: 'created'
 });
 setStatus('LISTED ON VANTABLACK - mint copied to clipboard', '#00ff41');
 } catch (e) {
 setStatus('TOKEN LIVE - Vantablack listing saved locally', '#00ff41');
 }
 } else {
 setStatus('TOKEN LIVE - mint address ready', '#00ff41');
 }

 try {
 navigator.clipboard.writeText(mint);
 } catch (e) {}
}

function parseSupply(raw, decimals) {
 const s = String(raw || '').trim().replace(/,/g, '');
 if (!s || !/^\d+(\.\d+)?$/.test(s)) return null;
 const parts = s.split('.');
 const whole = parts[0] || '0';
 let frac = (parts[1] || '').slice(0, decimals);
 while (frac.length < decimals) frac += '0';
 if ((parts[1] || '').length > decimals) return null;
 try {
 return BigInt(whole + frac);
 } catch (e) {
 return null;
 }
}

function isExpiredError(err) {
 const msg = String(err?.message || err).toLowerCase();
 return msg.includes('block height exceeded') ||
 msg.includes('blockhash not found') ||
 msg.includes('has expired') ||
 msg.includes('transaction expired');
}

function normalizeSignature(sig) {
 if (!sig) return '';
 if (typeof sig === 'string') return sig;
 if (typeof sig.toString === 'function') return sig.toString();
 return String(sig);
}

async function confirmSignature(connection, signature) {
 const timeoutMs = 75000;
 const start = Date.now();

 while (Date.now() - start < timeoutMs) {
 const resp = await connection.getSignatureStatuses([signature], {
 searchTransactionHistory: true
 });
 const status = resp?.value?.[0];
 if (status) {
 if (status.err) {
 throw new Error('Transaction failed on-chain: ' + JSON.stringify(status.err));
 }
 if (
 status.confirmationStatus === 'processed' ||
 status.confirmationStatus === 'confirmed' ||
 status.confirmationStatus === 'finalized'
 ) {
 return;
 }
 }
 await new Promise(function (r) { setTimeout(r, 1200); });
 }

 const finalCheck = await connection.getSignatureStatuses([signature], {
 searchTransactionHistory: true
 });
 const landed = finalCheck?.value?.[0];
 if (landed && !landed.err) return;

 throw new Error('Confirmation timed out - check Solscan for ' + shortAddr(signature));
}

async function sendTransaction(provider, transaction, extraSigners) {
 const connection = getConnection();
 const blockhash = await connection.getLatestBlockhash('confirmed');
 transaction.recentBlockhash = blockhash.blockhash;
 transaction.feePayer = new PublicKey(connectedPubkey);

 if (extraSigners?.length) {
 transaction.partialSign(...extraSigners);
 }

 let signature = '';

 if (typeof provider.signAndSendTransaction === 'function') {
 const result = await provider.signAndSendTransaction(transaction, {
 skipPreflight: true,
 maxRetries: 5,
 preflightCommitment: 'confirmed'
 });
 signature = normalizeSignature(
 typeof result === 'string' ? result : (result && result.signature)
 );
 } else {
 if (typeof provider.signTransaction !== 'function') {
 throw new Error('Wallet cannot sign transactions');
 }
 const signed = await provider.signTransaction(transaction);
 signature = await connection.sendRawTransaction(signed.serialize(), {
 skipPreflight: true,
 maxRetries: 5
 });
 }

 if (!signature) throw new Error('Wallet did not return a transaction signature');
 await confirmSignature(connection, signature);
 return signature;
}

function siteFeeLamports() {
 const cfg = window.VANTABLACK_CONFIG || {};
 const sol = Number(cfg.launchFeeSol);
 if (!Number.isFinite(sol) || sol <= 0) return 0n;
 return BigInt(Math.round(sol * 1e9));
}

function siteFeeSolRecipient() {
 const cfg = window.VANTABLACK_CONFIG || {};
 const addr = String(cfg.siteFeeSol || '').trim();
 return addr || '';
}

async function buildLaunchTransaction(owner, mintKeypair, lamports, decimals, amount, revokeMint) {
 const ata = await getAssociatedTokenAddress(
 mintKeypair.publicKey,
 owner,
 false,
 TOKEN_PROGRAM_ID,
 ASSOCIATED_TOKEN_PROGRAM_ID
 );

 const ix = [];
 const feeLamports = siteFeeLamports();
 const feeTo = siteFeeSolRecipient();
 if (feeLamports > 0n && feeTo) {
  ix.push(
   SystemProgram.transfer({
    fromPubkey: owner,
    toPubkey: new PublicKey(feeTo),
    lamports: Number(feeLamports)
   })
  );
 }

 const tx = new Transaction().add(
 ...ix,
 SystemProgram.createAccount({
 fromPubkey: owner,
 newAccountPubkey: mintKeypair.publicKey,
 space: MINT_SIZE,
 lamports,
 programId: TOKEN_PROGRAM_ID
 }),
 createInitializeMintInstruction(
 mintKeypair.publicKey,
 decimals,
 owner,
 revokeMint ? owner : null
 ),
 createAssociatedTokenAccountInstruction(
 owner,
 ata,
 owner,
 mintKeypair.publicKey,
 TOKEN_PROGRAM_ID,
 ASSOCIATED_TOKEN_PROGRAM_ID
 ),
 createMintToInstruction(mintKeypair.publicKey, ata, owner, amount)
 );

 if (revokeMint) {
 tx.add(
 createSetAuthorityInstruction(
 mintKeypair.publicKey,
 owner,
 AuthorityType.MintTokens,
 null
 )
 );
 }

 return tx;
}

async function launchToken() {
 if (!connectedPubkey || !walletProvider) {
 setStatus('Connect wallet first.', '#ff6666');
 return;
 }

 const name = ($('tokenName')?.value || '').trim();
 const symbol = ($('tokenSymbol')?.value || '').trim().toUpperCase();
 const decimals = parseInt($('tokenDecimals')?.value || '9', 10);
 const supplyRaw = $('tokenSupply')?.value;
 const revokeMint = $('revokeMint')?.checked;

 if (!name || name.length < 2) {
 setStatus('Token name required (2+ chars).', '#ff6666');
 return;
 }
 if (!symbol || symbol.length < 2 || symbol.length > 10) {
 setStatus('Symbol required (2 - 10 chars).', '#ff6666');
 return;
 }
 if (!Number.isFinite(decimals) || decimals < 0 || decimals > 9) {
 setStatus('Decimals must be 0 - 9.', '#ff6666');
 return;
 }

 const amount = parseSupply(supplyRaw, decimals);
 if (amount == null || amount <= 0n) {
 setStatus('Enter a valid initial supply.', '#ff6666');
 return;
 }

 const btn = $('launchTokenBtn');
 if (btn) {
 btn.disabled = true;
 btn.textContent = 'LAUNCHING...';
 }
 hideResult();
 setStatus('Building transaction - approve in your wallet...', '#ffaa00');

 try {
 const connection = getConnection();
 const owner = new PublicKey(connectedPubkey);
 const mintKeypair = Keypair.generate();
 const lamports = await getMinimumBalanceForRentExemptMint(connection);
 const mintStr = mintKeypair.publicKey.toString();
 let sig = null;
 const maxAttempts = 3;

 for (let attempt = 0; attempt < maxAttempts; attempt++) {
 try {
 if (attempt > 0) {
 const mintLive = await connection.getAccountInfo(mintKeypair.publicKey);
 if (mintLive) {
 setStatus('Token already created on-chain - finishing up...', '#00ff41');
 break;
 }
 setStatus('Transaction expired - approve again in wallet (' + (attempt + 1) + '/' + maxAttempts + ')...', '#ffaa00');
 } else {
 setStatus('Sign one launch transaction in wallet...', '#ffaa00');
 }

 const tx = await buildLaunchTransaction(
 owner,
 mintKeypair,
 lamports,
 decimals,
 amount,
 revokeMint
 );
 sig = await sendTransaction(walletProvider, tx, [mintKeypair]);
 break;
 } catch (err) {
 if (!isExpiredError(err) || attempt === maxAttempts - 1) throw err;
 }
 }

 const mintLive = await connection.getAccountInfo(mintKeypair.publicKey);
 if (!sig && !mintLive) throw new Error('Launch did not return a signature');
 try {
 localStorage.setItem(
 'basement_last_launch',
 JSON.stringify({
 name,
 symbol,
 mint: mintStr,
 supply: supplyRaw,
 decimals,
 ts: new Date().toISOString()
 })
 );
 } catch (e) {}

 await showResult(mintStr, sig || '', { name, symbol, decimals, supply: supplyRaw });
 } catch (err) {
 console.error(err);
 setStatus('Launch failed: ' + (err.message || err), '#ff6666');
 } finally {
 if (btn) {
 btn.disabled = !connectedPubkey;
 btn.textContent = 'LAUNCH ON SOLANA';
 }
 }
}

function bind() {
 $('connectWalletBtn')?.addEventListener('click', connectWallet);
 $('launchTokenBtn')?.addEventListener('click', launchToken);
 updateWalletUi();
 const fee = (window.VANTABLACK_CONFIG && window.VANTABLACK_CONFIG.launchFeeSol) || 0.02;
 setStatus('Connect Phantom or Solflare. Creator keeps 100% supply. Site launch fee: ' + fee + ' SOL.', '#cc88ff');
}

if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', bind);
} else {
 bind();
}