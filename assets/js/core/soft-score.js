/**
 * DOSWAPZ soft wallet score verify - signature only, never moves funds.
 * Solana (Phantom/Solflare) or Ethereum (MetaMask/Coinbase) personal_sign.
 *
 * Usage:
 * const r = await DOSWAPZ_SOFT_SCORE.signScore({
 * game: 'FTWR',
 * score: 1200,
 * fields: { depth: 3 },
 * onStatus: (msg) => { ... }
 * });
 * if (r.ok) { // r.wallet, r.short, r.chain }
 */
(function (global) {
 'use strict';

 var DISCLAIMER =
 'This is a signature-only verification. NO FUNDS, NO TRANSACTION PERMISSION, NO MOVE OF ASSETS.\n' +
 'Signing this message only proves wallet ownership for a local leaderboard entry.';

 function shortWallet(addr) {
 if (!addr || typeof addr !== 'string') return '????';
 if (addr.length <= 12) return addr;
 if (addr.indexOf('0x') === 0) return addr.slice(0, 6) + '...' + addr.slice(-4);
 return addr.slice(0, 4) + '...' + addr.slice(-4);
 }

 function buildMessage(game, score, fields, wallet) {
 var lines = [
 'DOSWAPZ ' + String(game || 'GAME').toUpperCase() + ' - SOFT SIGN ONLY',
 'Score: ' + String(score),
 'Timestamp: ' + Date.now(),
 'Wallet: ' + (wallet || '(pending)')
 ];
 if (fields && typeof fields === 'object') {
 Object.keys(fields).forEach(function (k) {
 if (fields[k] == null || fields[k] === '') return;
 lines.push(k.charAt(0).toUpperCase() + k.slice(1) + ': ' + fields[k]);
 });
 }
 lines.push('');
 lines.push(DISCLAIMER);
 return lines.join('\n');
 }

 function getSolanaProvider() {
 if (global.solana && typeof global.solana.connect === 'function') return global.solana;
 if (global.phantom && global.phantom.solana) return global.phantom.solana;
 return null;
 }

 /**
 * Soft-connect + sign a plain text message. Never sends a transaction.
 * @returns {Promise<{ok:boolean, wallet?:string, short?:string, chain?:string, error?:string}>}
 */
 async function softSign(messageText) {
 var text = String(messageText || '');
 if (!text) {
 return { ok: false, error: 'Empty sign message.' };
 }

 var sol = getSolanaProvider();
 if (sol && typeof sol.signMessage === 'function') {
 try {
 var resp = await sol.connect({ onlyIfTrusted: false });
 var pk =
 (resp && resp.publicKey && resp.publicKey.toString && resp.publicKey.toString()) ||
 (sol.publicKey && sol.publicKey.toString && sol.publicKey.toString());
 if (!pk) return { ok: false, error: 'Solana wallet connected but no public key.' };

 // Rebuild with real wallet in body if placeholder used
 var msg = text.indexOf('(pending)') >= 0
 ? text.replace('(pending)', pk)
 : text;
 if (msg.indexOf('Wallet:') < 0) {
 msg = msg + '\nWallet: ' + pk;
 }

 var encoded = new TextEncoder().encode(msg);
 await sol.signMessage(encoded, 'utf8');
 return { ok: true, wallet: pk, short: shortWallet(pk), chain: 'solana' };
 } catch (err) {
 return { ok: false, error: (err && (err.message || String(err))) || 'Solana sign cancelled' };
 }
 }

 if (global.ethereum && typeof global.ethereum.request === 'function') {
 try {
 var accounts = await global.ethereum.request({ method: 'eth_requestAccounts' });
 var addr = accounts && accounts[0];
 if (!addr) return { ok: false, error: 'No Ethereum account returned.' };

 var ethMsg = text.indexOf('(pending)') >= 0
 ? text.replace('(pending)', addr)
 : text;
 if (ethMsg.indexOf('Wallet:') < 0) {
 ethMsg = ethMsg + '\nWallet: ' + addr;
 }

 await global.ethereum.request({
 method: 'personal_sign',
 params: [ethMsg, addr]
 });
 return { ok: true, wallet: addr, short: shortWallet(addr), chain: 'ethereum' };
 } catch (err2) {
 return { ok: false, error: (err2 && (err2.message || String(err2))) || 'Ethereum sign cancelled' };
 }
 }

 return {
 ok: false,
 error:
 'No compatible wallet found. Install Phantom/Solflare (Solana) or MetaMask/Coinbase (ETH). Soft sign only - no funds.'
 };
 }

 /**
 * Build standard score message + soft sign.
 * opts: { game, score, fields?, onStatus? }
 */
 async function signScore(opts) {
 opts = opts || {};
 var game = opts.game || 'GAME';
 var score = opts.score;
 var fields = opts.fields || {};
 var onStatus = typeof opts.onStatus === 'function' ? opts.onStatus : function () {};

 if (score == null || Number(score) < 0 || (Number(score) === 0 && !opts.allowZero)) {
 return { ok: false, error: 'No valid score to sign. Play a run first.' };
 }

 onStatus('Connecting wallet for soft sign (no funds)...');
 var draft = buildMessage(game, score, fields, '(pending)');
 var result = await softSign(draft);
 if (!result.ok) {
 onStatus(result.error || 'Sign failed');
 return result;
 }
 onStatus('SOFT SIGN OK - ' + result.short + ' * no funds moved');
 return result;
 }

 function loadBoard(storageKey) {
 try {
 var list = JSON.parse(global.localStorage.getItem(storageKey) || '[]');
 return Array.isArray(list) ? list : [];
 } catch (e) {
 return [];
 }
 }

 /**
 * Save a scored entry. entry should include wallet (full) and score.
 * Dedupes by wallet keeping best score when keepBestPerWallet is true.
 */
 function saveBoardEntry(storageKey, entry, options) {
 options = options || {};
 var max = options.max || 20;
 var keepBest = options.keepBestPerWallet !== false;
 var list = loadBoard(storageKey);
 var full = entry.wallet || '';
 var short = entry.walletShort || shortWallet(full);

 var row = Object.assign({}, entry, {
 wallet: short,
 walletFull: full,
 ts: entry.ts || Date.now()
 });

 if (keepBest && full) {
 var others = list.filter(function (e) {
 var a = (e.walletFull || e.wallet || '').toLowerCase();
 var b = full.toLowerCase();
 // also match shortened form loosely
 if (a === b) return false;
 if (e.wallet === short && e.walletFull === full) return false;
 if (e.walletFull && e.walletFull.toLowerCase() === b) return false;
 return true;
 });
 var prior = list.filter(function (e) {
 return (
 (e.walletFull && e.walletFull.toLowerCase() === full.toLowerCase()) ||
 (e.wallet === short && !e.walletFull)
 );
 });
 var bestPrior = prior.reduce(function (m, e) {
 return !m || Number(e.score) > Number(m.score) ? e : m;
 }, null);
 if (!bestPrior || Number(row.score) >= Number(bestPrior.score)) {
 others.push(row);
 } else {
 others.push(bestPrior);
 row = bestPrior;
 row._keptOld = true;
 }
 list = others;
 } else {
 list.push(row);
 }

 list.sort(function (a, b) {
 return Number(b.score) - Number(a.score) || (b.ts || 0) - (a.ts || 0);
 });
 list = list.slice(0, max);
 try {
 global.localStorage.setItem(storageKey, JSON.stringify(list));
 } catch (e) {}
 return list;
 }

 global.DOSWAPZ_SOFT_SCORE = {
 shortWallet: shortWallet,
 buildMessage: buildMessage,
 softSign: softSign,
 signScore: signScore,
 loadBoard: loadBoard,
 saveBoardEntry: saveBoardEntry,
 DISCLAIMER: DISCLAIMER
 };
})(typeof window !== 'undefined' ? window : globalThis);
