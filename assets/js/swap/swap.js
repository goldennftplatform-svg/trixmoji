/* DOSWAPZ - Jupiter swap + Trix Market token support */
(function () {
 'use strict';

 var SOL = 'So11111111111111111111111111111111111111112';
 var USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
 var BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
 /* $CRACK — Crack On Sol (LaunchLab) */
 var CRACK = '9x9MKbh5pq8fsTAH6fpSi17UuBgGNAVJPwMYTyXLTRiX';
 /* $XELON — XELON (LaunchLab) */
 var XELON = '76Cf2zrKqwQEMGj7TaZ6hJ1Ja6hNsXXrK2UVBRjKTRiX';
 /* $HFO — Hair Force One (LaunchLab) */
 var HFO = '9JvvWgzgBe5MZsbRWn25FbnoZijTdSWGLN5vK9ytTRiX';

 var TOKEN_META = {
 SOL: { mint: SOL, decimals: 9, label: 'SOL' },
 USDC: { mint: USDC, decimals: 6, label: 'USDC' },
 BONK: { mint: BONK, decimals: 5, label: 'BONK' },
 CRACK: { mint: CRACK, decimals: 6, label: 'CRACK', name: 'Crack On Sol' },
 XELON: { mint: XELON, decimals: 6, label: 'XELON', name: 'XELON' },
 HFO: { mint: HFO, decimals: 6, label: 'HFO', name: 'Hair Force One' }
 };

 /* Always inject these into FROM/TO even if catalogs fail */
 var FEATURED_MINTS = [
 { symbol: 'HFO', mint: HFO, decimals: 6, name: 'Hair Force One', source: 'featured' },
 { symbol: 'XELON', mint: XELON, decimals: 6, name: 'XELON', source: 'featured' },
 { symbol: 'CRACK', mint: CRACK, decimals: 6, name: 'Crack On Sol', source: 'featured' }
 ];

 var JUPITER_BASES = [
 'https://api.jup.ag/swap/v1',
 'https://lite-api.jup.ag/swap/v1'
 ];

 var JUPITER_V2_ORDER = 'https://api.jup.ag/swap/v2/order';
 var JUPITER_V2_EXECUTE = 'https://api.jup.ag/swap/v2/execute';

 var DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';
 var SLIPPAGE_BPS = 50;
 var TRIX_VALUE_PREFIX = 'TRIX:';
 var VB_VALUE_PREFIX = 'VB:';

 var walletProvider = null;
 var connectedPubkey = null;
 var lastQuote = null;
 var quoteTimer = null;
 var quoteSeq = 0;
 var sendRpc = DEFAULT_RPC;
 var decimalsCache = {};
 var balanceCache = { sol: null, tokenMint: null, token: null };

 function $(id) {
 return document.getElementById(id);
 }

 function decorateLiveText(el) {
 if (el && window.FTWR_RABBIT && typeof window.FTWR_RABBIT.decorate === 'function') {
 window.FTWR_RABBIT.decorate(el);
 }
 }

 function setStatus(msg, color) {
 var el = $('swapStatus');
 if (!el) return;
 el.textContent = msg;
 el.style.color = color || '#00cc00';
 decorateLiveText(el);
 }

 function shortAddr(addr) {
 if (!addr || addr.length < 10) return addr || '';
 return addr.slice(0, 4) + '...' + addr.slice(-4);
 }

 function detectWallet() {
 if (window.solana && window.solana.isPhantom) return window.solana;
 if (window.solflare && window.solflare.isSolflare) return window.solflare;
 if (window.solana) return window.solana;
 return null;
 }

 function getWalletProvider() {
 return walletProvider || detectWallet();
 }

 function getConnection() {
 if (!window.solanaWeb3) return null;
 return new solanaWeb3.Connection(sendRpc, 'confirmed');
 }

 async function lookupDecimals(mint) {
 if (!mint) return 6;
 if (decimalsCache[mint] != null) return decimalsCache[mint];

 if (mint === SOL) {
 decimalsCache[mint] = 9;
 return 9;
 }

 /* core + featured known mints */
 for (var k in TOKEN_META) {
 if (TOKEN_META[k] && TOKEN_META[k].mint === mint && typeof TOKEN_META[k].decimals === 'number') {
 decimalsCache[mint] = TOKEN_META[k].decimals;
 return TOKEN_META[k].decimals;
 }
 }
 for (var fi = 0; fi < FEATURED_MINTS.length; fi++) {
 if (FEATURED_MINTS[fi].mint === mint && typeof FEATURED_MINTS[fi].decimals === 'number') {
 decimalsCache[mint] = FEATURED_MINTS[fi].decimals;
 return FEATURED_MINTS[fi].decimals;
 }
 }

 var trix = window.DOSWAPZ_TRIX && window.DOSWAPZ_TRIX.findByMint(mint);
 if (trix && trix.decimals != null) {
 decimalsCache[mint] = trix.decimals;
 return trix.decimals;
 }

 var vb = window.DOSWAPZ_VANTABLACK && window.DOSWAPZ_VANTABLACK.findByMint(mint);
 if (vb && vb.decimals != null) {
 decimalsCache[mint] = vb.decimals;
 return vb.decimals;
 }

 var conn = getConnection();
 if (!conn || !window.solanaWeb3) {
 decimalsCache[mint] = 6;
 return 6;
 }

 try {
 var info = await conn.getParsedAccountInfo(new solanaWeb3.PublicKey(mint));
 var parsed = info.value && info.value.data && info.value.data.parsed;
 if (parsed && parsed.info && typeof parsed.info.decimals === 'number') {
 decimalsCache[mint] = parsed.info.decimals;
 return parsed.info.decimals;
 }
 } catch (e) {}

 decimalsCache[mint] = 6;
 return 6;
 }

 function trixOptionValue(token) {
 return TRIX_VALUE_PREFIX + token.mint;
 }

 function vbOptionValue(token) {
 return VB_VALUE_PREFIX + token.mint;
 }

 function resolveCatalogToken(mint) {
 if (!mint) return null;
 var vb = window.DOSWAPZ_VANTABLACK && window.DOSWAPZ_VANTABLACK.findByMint(mint);
 if (vb) return vb;
 var trix = window.DOSWAPZ_TRIX && window.DOSWAPZ_TRIX.findByMint(mint);
 return trix || null;
 }

 function isDynamicOptionValue(value) {
 return !!(value && (
 value.indexOf(TRIX_VALUE_PREFIX) === 0 ||
 value.indexOf(VB_VALUE_PREFIX) === 0 ||
 value.indexOf('FEAT:') === 0
 ));
 }

 function getVantablackSwapTokens() {
 var vb = window.DOSWAPZ_VANTABLACK;
 if (!vb) return [];
 var tokens = vb.getCatalog().filter(function (t) {
 return t && t.chain !== 'ethereum' && t.section === 'main';
 });
 if (!tokens.length) {
 tokens = vb.getCatalog().filter(function (t) {
 return t && t.chain !== 'ethereum';
 });
 }
 return tokens;
 }

 function getTrixSwapTokens() {
 var trix = window.DOSWAPZ_TRIX;
 if (!trix) return [];
 var tokens = trix.getCatalog();
 if (trix.withPinned) tokens = trix.withPinned(tokens);
 return tokens;
 }

 function featuredOptionValue(token) {
 return 'FEAT:' + token.mint;
 }

 function isFeaturedOptionValue(value) {
 return !!(value && value.indexOf('FEAT:') === 0);
 }

 /** Rebuild dynamic optgroups without clobbering base SOL/USDC/BONK/CRACK/Other options. */
 function populateDynamicSelectOptions() {
 var vbTokens = getVantablackSwapTokens();
 var trixTokens = getTrixSwapTokens();

 ['fromToken', 'toToken'].forEach(function (selectId) {
 var sel = $(selectId);
 if (!sel) return;

 var prev = sel.value;
 var keep = [];
 for (var i = 0; i < sel.options.length; i++) {
 var opt = sel.options[i];
 if (!isDynamicOptionValue(opt.value) && !isFeaturedOptionValue(opt.value)) keep.push(opt);
 }
 sel.innerHTML = '';
 keep.forEach(function (opt) {
 sel.appendChild(opt);
 });

 /* Featured mints (e.g. $CRACK) — always present, pin near top after core */
 if (FEATURED_MINTS.length) {
 var featGroup = document.createElement('optgroup');
 featGroup.label = 'FEATURED';
 FEATURED_MINTS.forEach(function (token) {
 /* skip if already a core TOKEN_META option by symbol */
 var alreadyCore = false;
 for (var ci = 0; ci < keep.length; ci++) {
 if (keep[ci].value === token.symbol) { alreadyCore = true; break; }
 }
 if (alreadyCore) return;
 var o = document.createElement('option');
 o.value = featuredOptionValue(token);
 o.textContent = token.symbol + ' - ' + (token.name || token.symbol);
 o.dataset.mint = token.mint;
 o.dataset.symbol = token.symbol;
 featGroup.appendChild(o);
 });
 if (featGroup.children.length) sel.appendChild(featGroup);
 }

 if (vbTokens.length) {
 var vbGroup = document.createElement('optgroup');
 vbGroup.label = 'VANTABLACK MAIN';
 vbTokens.forEach(function (token) {
 var o = document.createElement('option');
 o.value = vbOptionValue(token);
 o.textContent = token.symbol + ' - ' + (token.name || token.symbol);
 o.dataset.mint = token.mint;
 o.dataset.symbol = token.symbol;
 vbGroup.appendChild(o);
 });
 sel.appendChild(vbGroup);
 }

 if (trixTokens.length) {
 var trixGroup = document.createElement('optgroup');
 trixGroup.label = 'TRIX MARKET';
 trixTokens.forEach(function (token) {
 var o = document.createElement('option');
 var mcap = token.marketCap != null && token.marketCap > 0
 ? ' * $' + (token.marketCap >= 1000
 ? Math.round(token.marketCap / 1000) + 'K mcap'
 : Math.round(token.marketCap) + ' mcap')
 : '';
 o.value = trixOptionValue(token);
 o.textContent = token.symbol + ' - ' + token.name + mcap;
 o.dataset.mint = token.mint;
 o.dataset.symbol = token.symbol;
 trixGroup.appendChild(o);
 });
 sel.appendChild(trixGroup);
 }

 if (prev) {
 for (var j = 0; j < sel.options.length; j++) {
 if (sel.options[j].value === prev) {
 sel.value = prev;
 break;
 }
 }
 }
 });
 }

 // Back-compat aliases used by older call sites
 function populateTrixSelectOptions() {
 populateDynamicSelectOptions();
 }

 function populateVantablackSelectOptions() {
 populateDynamicSelectOptions();
 }

 async function loadTrixCatalog() {
 if (!window.DOSWAPZ_TRIX) {
 setStatus('Trix catalog unavailable - use Other (paste mint)', '#ffaa00');
 return;
 }

 try {
 await window.DOSWAPZ_TRIX.refreshCatalog(false);
 populateDynamicSelectOptions();
 debouncedQuote();
 } catch (err) {
 setStatus('Trix catalog load failed - paste mint under Other', '#ffaa00');
 }
 }

 async function loadVantablackCatalog() {
 if (!window.DOSWAPZ_VANTABLACK) return;
 try {
 await window.DOSWAPZ_VANTABLACK.fetchCatalog();
 populateDynamicSelectOptions();
 debouncedQuote();
 } catch (err) {}
 }

 function applyTokenToSide(side, token) {
 if (!token || !token.mint) return;
 var selectId = side === 'to' ? 'toToken' : 'fromToken';
 var sel = $(selectId);
 if (!sel) return;

 /* Core symbols (SOL/USDC/BONK/CRACK) match plain option values */
 var coreLabel = null;
 for (var k in TOKEN_META) {
 if (TOKEN_META[k].mint === token.mint) {
 coreLabel = TOKEN_META[k].label;
 break;
 }
 }

 var candidates = [];
 if (coreLabel) candidates.push(coreLabel);
 if (token.symbol) candidates.push(token.symbol);
 candidates.push(featuredOptionValue(token));
 candidates.push(trixOptionValue(token));
 candidates.push(vbOptionValue(token));

 var found = false;
 for (var i = 0; i < sel.options.length; i++) {
 var ov = sel.options[i].value;
 for (var c = 0; c < candidates.length; c++) {
 if (ov === candidates[c]) {
 sel.value = ov;
 found = true;
 break;
 }
 }
 if (found) break;
 }

 if (!found) {
 var value = coreLabel || featuredOptionValue(token);
 var opt = document.createElement('option');
 opt.value = value;
 opt.textContent = (token.symbol || coreLabel || 'TOKEN') + ' - ' + (token.name || token.symbol || '');
 opt.dataset.mint = token.mint;
 sel.insertBefore(opt, sel.firstChild);
 sel.value = value;
 }

 toggleCustomMint(selectId, side === 'to' ? 'toCustomWrap' : 'fromCustomWrap');
 debouncedQuote();
 }

 async function resolveToken(selectId, mintInputId) {
 var sel = $(selectId);
 if (!sel) return null;

 var label = sel.value;

 if (label.indexOf(VB_VALUE_PREFIX) === 0) {
 var vbMint = label.slice(VB_VALUE_PREFIX.length);
 var vbToken = resolveCatalogToken(vbMint);
 var vbSymbol = vbToken ? vbToken.symbol : 'TOKEN';
 var vbName = vbToken ? vbToken.name : vbSymbol;
 var vbDec = await lookupDecimals(vbMint);
 return { label: vbSymbol, name: vbName, mint: vbMint, decimals: vbDec, source: 'vantablack' };
 }

 if (label.indexOf(TRIX_VALUE_PREFIX) === 0) {
 var mint = label.slice(TRIX_VALUE_PREFIX.length);
 var trix = resolveCatalogToken(mint);
 var symbol = trix ? trix.symbol : 'TRIX';
 var name = trix ? trix.name : symbol;
 var decimals = await lookupDecimals(mint);
 return { label: symbol, name: name, mint: mint, decimals: decimals, source: 'trix' };
 }

 if (label.indexOf('FEAT:') === 0) {
 var fMint = label.slice(5);
 var feat = null;
 for (var fj = 0; fj < FEATURED_MINTS.length; fj++) {
 if (FEATURED_MINTS[fj].mint === fMint) { feat = FEATURED_MINTS[fj]; break; }
 }
 var fDec = await lookupDecimals(fMint);
 return {
 label: feat ? feat.symbol : 'TOKEN',
 name: feat ? (feat.name || feat.symbol) : 'TOKEN',
 mint: fMint,
 decimals: fDec,
 source: 'featured'
 };
 }

 if (label === 'Other (paste mint)') {
 var mintEl = $(mintInputId);
 var mintAddr = mintEl ? mintEl.value.trim() : '';
 if (!mintAddr) return null;
 var dec = await lookupDecimals(mintAddr);
 /* label known featured/core mints even when pasted */
 var known = null;
 for (var mk in TOKEN_META) {
 if (TOKEN_META[mk].mint === mintAddr) { known = TOKEN_META[mk]; break; }
 }
 return {
 label: known ? known.label : 'CUSTOM',
 mint: mintAddr,
 decimals: dec,
 source: known ? 'core' : 'custom'
 };
 }

 if (!TOKEN_META[label]) return null;
 return {
 label: TOKEN_META[label].label,
 mint: TOKEN_META[label].mint,
 decimals: TOKEN_META[label].decimals,
 source: 'core'
 };
 }

 function toAtomic(amount, decimals) {
 var n = Number(amount);
 if (!isFinite(n) || n <= 0) return null;
 var factor = Math.pow(10, decimals);
 var raw = Math.floor(n * factor + 1e-9);
 if (raw <= 0) return null;
 return String(raw);
 }

 function formatAtomic(raw, decimals) {
 var n = Number(raw);
 if (!isFinite(n)) return '';
 var val = n / Math.pow(10, decimals);
 return val.toLocaleString(undefined, {
 maximumFractionDigits: Math.min(decimals, 6),
 minimumFractionDigits: 0
 });
 }

 function toggleCustomMint(selectId, wrapId) {
 var sel = $(selectId);
 var wrap = $(wrapId);
 if (!sel || !wrap) return;
 wrap.style.display = sel.value === 'Other (paste mint)' ? 'block' : 'none';
 }

 function bytesToBase64(bytes) {
 var bin = '';
 var chunk = 0x8000;
 for (var i = 0; i < bytes.length; i += chunk) {
 bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
 }
 return btoa(bin);
 }

 function routeLabels(routePlan) {
 if (!routePlan || !routePlan.length) return 'Jupiter';
 var seen = {};
 var labels = [];
 routePlan.forEach(function (step) {
 var info = step.swapInfo || step;
 var label = info.label || info.ammKey || 'DEX';
 if (!seen[label]) {
 seen[label] = true;
 labels.push(label);
 }
 });
 return labels.join(' -> ') || 'Jupiter';
 }

 async function fetchJsonWithFallback(path, opts) {
 var lastErr = null;
 for (var i = 0; i < JUPITER_BASES.length; i++) {
 try {
 var res = await fetch(JUPITER_BASES[i] + path, opts);
 if (!res.ok) {
 var txt = await res.text();
 throw new Error('HTTP ' + res.status + ': ' + txt.slice(0, 220));
 }
 return await res.json();
 } catch (err) {
 lastErr = err;
 }
 }
 throw lastErr || new Error('Jupiter request failed');
 }

 function isNotTradableError(msg) {
 var m = (msg || '').toLowerCase();
 return m.indexOf('not tradable') !== -1 || m.indexOf('token_not_tradable') !== -1;
 }

 async function fetchV1Quote(inputMint, outputMint, amount) {
 var qs = new URLSearchParams({
 inputMint: inputMint,
 outputMint: outputMint,
 amount: amount,
 slippageBps: String(SLIPPAGE_BPS)
 });
 return fetchJsonWithFallback('/quote?' + qs.toString());
 }

 async function fetchV2Order(inputMint, outputMint, amount, taker) {
 var qs = new URLSearchParams({
 inputMint: inputMint,
 outputMint: outputMint,
 amount: amount,
 slippageBps: String(SLIPPAGE_BPS)
 });
 if (taker) qs.set('taker', taker);
 var res = await fetch(JUPITER_V2_ORDER + '?' + qs.toString());
 if (!res.ok) {
 var txt = await res.text();
 throw new Error('HTTP ' + res.status + ': ' + txt.slice(0, 220));
 }
 return res.json();
 }

 async function fetchQuoteBundle(inputMint, outputMint, amount, taker) {
 var v1Err = null;
 try {
 var v1 = await fetchV1Quote(inputMint, outputMint, amount);
 return { mode: 'v1', quote: v1 };
 } catch (err) {
 v1Err = err;
 }

 try {
 var v2 = await fetchV2Order(inputMint, outputMint, amount, taker || null);
 if (!v2.outAmount) throw new Error('Jupiter v2 returned no quote');
 return { mode: 'v2', quote: v2, requestId: v2.requestId || null };
 } catch (v2Err) {
 throw v1Err || v2Err;
 }
 }

 async function buildSwapTransaction(quote, userPublicKey) {
 return fetchJsonWithFallback('/swap', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 quoteResponse: quote,
 userPublicKey: userPublicKey,
 dynamicComputeUnitLimit: true,
 prioritizationFeeLamports: 'auto'
 })
 });
 }

 async function executeV2Swap(order, provider) {
 var pubkey = connectedPubkey;
 if (!pubkey) throw new Error('Wallet not connected');

 var fresh = order;
 if (!fresh.transaction) {
 fresh = await fetchV2Order(order.inputMint, order.outputMint, order.inAmount, pubkey);
 }
 if (!fresh.transaction) {
 var hint = fresh.errorMessage ? ' (' + fresh.errorMessage + ')' : '';
 throw new Error('Jupiter could not build swap transaction' + hint);
 }

 var txBytes = Uint8Array.from(atob(fresh.transaction), function (c) {
 return c.charCodeAt(0);
 });
 var tx = solanaWeb3.VersionedTransaction.deserialize(txBytes);
 var signedB64;

 if (typeof provider.signTransaction === 'function') {
 var signed = await provider.signTransaction(tx);
 signedB64 = bytesToBase64(signed.serialize());
 } else {
 throw new Error('Wallet cannot sign transactions');
 }

 var res = await fetch(JUPITER_V2_EXECUTE, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 signedTransaction: signedB64,
 requestId: fresh.requestId
 })
 });
 if (!res.ok) {
 var txt = await res.text();
 throw new Error('Execute HTTP ' + res.status + ': ' + txt.slice(0, 220));
 }
 var result = await res.json();
 if (result.status !== 'Success') {
 throw new Error(result.error || 'Swap execute failed (code ' + result.code + ')');
 }
 return result.signature;
 }

 function formatBalance(amount, decimals) {
 var n = Number(amount);
 if (!isFinite(n)) return ' - ';
 return n.toLocaleString(undefined, {
 maximumFractionDigits: Math.min(decimals || 6, 6),
 minimumFractionDigits: 0
 });
 }

 async function fetchSolBalance(pubkey) {
 var conn = getConnection();
 if (!conn || !window.solanaWeb3) return null;
 try {
 var lamports = await conn.getBalance(new solanaWeb3.PublicKey(pubkey));
 return lamports / 1e9;
 } catch (e) {
 return null;
 }
 }

 async function fetchSplBalance(pubkey, mint, decimals) {
 var conn = getConnection();
 if (!conn || !window.solanaWeb3 || !mint) return null;
 if (mint === SOL) return fetchSolBalance(pubkey);

 try {
 var owner = new solanaWeb3.PublicKey(pubkey);
 var mintKey = new solanaWeb3.PublicKey(mint);
 var accounts = await conn.getParsedTokenAccountsByOwner(owner, { mint: mintKey });
 if (!accounts.value.length) return 0;
 var total = 0;
 accounts.value.forEach(function (acc) {
 var info = acc.account.data.parsed && acc.account.data.parsed.info;
 if (info && info.tokenAmount && info.tokenAmount.uiAmount != null) {
 total += Number(info.tokenAmount.uiAmount);
 }
 });
 return total;
 } catch (e) {
 return null;
 }
 }

 async function refreshWalletBalances() {
 if (!connectedPubkey) {
 balanceCache = { sol: null, tokenMint: null, token: null };
 updateBalanceUi();
 return;
 }

 var from = await resolveToken('fromToken', 'fromCustomMint');
 var solBal = await fetchSolBalance(connectedPubkey);
 var tokenBal = null;
 var tokenMint = null;

 if (from && from.mint) {
 tokenMint = from.mint;
 tokenBal = await fetchSplBalance(connectedPubkey, from.mint, from.decimals);
 }

 balanceCache = { sol: solBal, tokenMint: tokenMint, token: tokenBal };
 updateBalanceUi();
 }

 function updateBalanceUi() {
 var el = $('walletBalanceSwap');
 if (!el) return;

 if (!connectedPubkey) {
 el.textContent = '';
 el.style.display = 'none';
 return;
 }

 var parts = [];
 if (balanceCache.sol != null) {
 parts.push('SOL: ' + formatBalance(balanceCache.sol, 9));
 }

 if (balanceCache.token != null && balanceCache.tokenMint) {
 var from = null;
 var sel = $('fromToken');
 if (sel) {
 var label = sel.value;
 if (label.indexOf(VB_VALUE_PREFIX) === 0 || label.indexOf(TRIX_VALUE_PREFIX) === 0) {
 var cat = resolveCatalogToken(balanceCache.tokenMint);
 from = cat ? cat.symbol : 'TOKEN';
 } else if (TOKEN_META[label]) {
 from = TOKEN_META[label].label;
 } else if (label === 'Other (paste mint)') {
 from = 'TOKEN';
 }
 }
 parts.push((from || 'TOKEN') + ': ' + formatBalance(balanceCache.token, 6));
 }

 el.textContent = parts.length ? 'BALANCE - ' + parts.join(' * ') : 'BALANCE - loading...';
 el.style.display = 'block';
 }

 function updateSwapButton() {
 var btn = $('swapBtn');
 if (!btn) return;
 btn.style.display = 'inline-block';
 if (connectedPubkey && lastQuote) {
 var fromLabel = $('fromToken') && $('fromToken').value ? String($('fromToken').value) : '';
 var selling = fromLabel && fromLabel !== 'SOL' && fromLabel.indexOf('SOL') !== 0;
 btn.textContent = selling ? 'SELL / SWAP' : 'BUY / SWAP';
 btn.disabled = false;
 } else if (lastQuote) {
 btn.textContent = 'CONNECT WALLET TO SWAP';
 btn.disabled = true;
 } else {
 btn.textContent = 'SWAP';
 btn.disabled = true;
 }
 }

 function updateWalletUi() {
 var connectBtn = $('connectBtnSwap');
 var disconnectBtn = $('disconnectBtnSwap');
 var info = $('walletInfoSwap');
 var help = $('walletHelpSwap');

 if (connectedPubkey) {
 if (connectBtn) connectBtn.style.display = 'none';
 if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
 if (info) info.textContent = shortAddr(connectedPubkey) + ' connected';
 if (help) help.style.display = 'none';
 } else {
 if (connectBtn) connectBtn.style.display = 'inline-block';
 if (disconnectBtn) disconnectBtn.style.display = 'none';
 if (info) info.textContent = '';
 if (help) help.style.display = getWalletProvider() ? 'none' : 'block';
 updateBalanceUi();
 }
 updateSwapButton();
 }

 async function updateSwapQuote() {
 toggleCustomMint('fromToken', 'fromCustomWrap');
 toggleCustomMint('toToken', 'toCustomWrap');

 var from = await resolveToken('fromToken', 'fromCustomMint');
 var to = await resolveToken('toToken', 'toCustomMint');
 var amountRaw = $('fromAmount') ? $('fromAmount').value : '';
 var toAmountEl = $('toAmount');
 var routeLine = $('routeLine');

 if (!from || !to) {
 lastQuote = null;
 if (toAmountEl) toAmountEl.value = '';
 if (routeLine) routeLine.textContent = 'SELECT VALID TOKENS';
 updateSwapButton();
 return;
 }

 if (from.mint === to.mint) {
 lastQuote = null;
 if (toAmountEl) toAmountEl.value = '';
 setStatus('PICK TWO DIFFERENT TOKENS', '#ff5555');
 updateSwapButton();
 return;
 }

 var atomic = toAtomic(amountRaw, from.decimals);
 if (!atomic) {
 lastQuote = null;
 if (toAmountEl) toAmountEl.value = '';
 setStatus('ENTER A VALID AMOUNT', '#ff5555');
 updateSwapButton();
 return;
 }

 var seq = ++quoteSeq;
 setStatus('FETCHING JUPITER QUOTE...', '#ffff00');
 if (toAmountEl) toAmountEl.value = '...';

 try {
 var bundle = await fetchQuoteBundle(from.mint, to.mint, atomic, connectedPubkey);
 if (seq !== quoteSeq) return;

 lastQuote = bundle;
 var quote = bundle.quote;
 if (toAmountEl) {
 toAmountEl.value = formatAtomic(quote.outAmount, to.decimals) + ' ' + to.label;
 }

 var impact = quote.priceImpactPct != null ? Number(quote.priceImpactPct) : 0;
 var routerTag = bundle.mode === 'v2' ? ' * JUPITER V2 (TRIX/NEW)' : '';
 if (routeLine) {
 routeLine.textContent =
 'ROUTE: ' + routeLabels(quote.routePlan) +
 routerTag +
 ' * 0% DOSWAPZ FEE * SLIPPAGE ' + (SLIPPAGE_BPS / 100).toFixed(2) + '%' +
 (impact ? ' * IMPACT ' + impact.toFixed(3) + '%' : '');
 // skip rabbit decorate on swap route line (glyph noise on present)
 }

 if (connectedPubkey) {
 setStatus('QUOTE READY - TAP SWAP TO SIGN', '#ffff00');
 } else {
 setStatus('LIVE QUOTE - CONNECT WALLET TO SWAP', '#00cc00');
 }
 } catch (err) {
 if (seq !== quoteSeq) return;
 lastQuote = null;
 if (toAmountEl) toAmountEl.value = '';
 if (routeLine) routeLine.textContent = 'QUOTE FAILED';
 var msg = err.message || String(err);
 if (msg.indexOf('TOKEN_NOT_TRADABLE') !== -1 || msg.indexOf('not tradable') !== -1) {
 setStatus('Token not tradable on Jupiter yet - try SOL/USDC pair or another Trix coin.', '#ff5555');
 } else {
 setStatus('Quote error: ' + msg, '#ff5555');
 }
 }

 updateSwapButton();
 if (connectedPubkey) refreshWalletBalances();
 }

 function debouncedQuote() {
 if (quoteTimer) clearTimeout(quoteTimer);
 quoteTimer = setTimeout(updateSwapQuote, 320);
 }

 async function connectSwapWallet() {
 var provider = detectWallet();
 if (!provider) {
 setStatus('No Solana wallet detected. Install Phantom or Solflare.', '#ff5555');
 var help = $('walletHelpSwap');
 if (help) help.style.display = 'block';
 return;
 }

 try {
 var resp = await provider.connect({ onlyIfTrusted: false });
 walletProvider = provider;
 connectedPubkey = resp.publicKey.toString();
 updateWalletUi();
 setStatus('WALLET CONNECTED - QUOTE READY', '#ffff00');
 refreshWalletBalances();
 debouncedQuote();
 } catch (err) {
 setStatus('Connect failed: ' + (err.message || err), '#ff5555');
 }
 }

 function disconnectSwapWallet(silent) {
 var provider = getWalletProvider();
 if (provider && typeof provider.disconnect === 'function') {
 provider.disconnect().catch(function () {});
 }
 walletProvider = null;
 connectedPubkey = null;
 balanceCache = { sol: null, tokenMint: null, token: null };
 updateWalletUi();
 if (!silent) setStatus('DISCONNECTED', '#00cc00');
 }

 async function sendSignedTransaction(provider, serialized) {
 if (typeof provider.signAndSendTransaction === 'function') {
 var result = await provider.signAndSendTransaction(serialized);
 return result.signature || result;
 }

 var signed = await provider.signTransaction(serialized);
 var connection = getConnection();
 var sig = await connection.sendRawTransaction(signed.serialize(), {
 skipPreflight: false,
 maxRetries: 2
 });
 await connection.confirmTransaction(sig, 'confirmed');
 return sig;
 }

 function loadPair(fromMint, toMint, amount) {
 var knownFrom = findKnownByMint(fromMint) || { mint: fromMint, symbol: 'TOKEN', name: 'Token', source: 'custom' };
 var knownTo = findKnownByMint(toMint) || { mint: toMint, symbol: 'TOKEN', name: 'Token', source: 'custom' };
 applyTokenToSide('from', knownFrom);
 ensureMintSelectable('from', fromMint, findKnownByMint(fromMint));
 applyTokenToSide('to', knownTo);
 ensureMintSelectable('to', toMint, findKnownByMint(toMint));
 if ($('fromAmount') && amount != null && Number(amount) > 0) $('fromAmount').value = String(amount);
 debouncedQuote();
 refreshWalletBalances();
 }

 async function flipSwapSides() {
 var from = await resolveToken('fromToken', 'fromCustomMint');
 var to = await resolveToken('toToken', 'toCustomMint');
 if (!from || !to) {
 setStatus('PICK FROM AND TO FIRST', '#ff5555');
 return;
 }
 var oldAmt = $('fromAmount') ? $('fromAmount').value : '';
 loadPair(to.mint, from.mint, null);
 await refreshWalletBalances();
 var from2 = await resolveToken('fromToken', 'fromCustomMint');
 var el = $('fromAmount');
 if (el && from2) {
 if (from2.mint === SOL && balanceCache.sol != null) {
 el.value = oldAmt || String(Math.max(0.001, Number(balanceCache.sol) - 0.01));
 } else if (balanceCache.token != null && balanceCache.tokenMint === from2.mint) {
 el.value = String(balanceCache.token);
 } else if (oldAmt) {
 el.value = oldAmt;
 }
 }
 setStatus('FLIPPED * ' + (from2 && from2.symbol ? from2.symbol : 'TOKEN') + ' -> ' + (from && from.symbol ? from.symbol : 'TOKEN'), '#ffff00');
 debouncedQuote();
 }

 async function setMaxFrom() {
 if (!connectedPubkey) {
 setStatus('CONNECT WALLET FOR MAX', '#ffaa00');
 return;
 }
 await refreshWalletBalances();
 var from = await resolveToken('fromToken', 'fromCustomMint');
 var el = $('fromAmount');
 if (!el || !from) return;
 if (from.mint === SOL) {
 var sol = Number(balanceCache.sol);
 if (!isFinite(sol) || sol <= 0) {
 setStatus('NO SOL BALANCE', '#ff5555');
 return;
 }
 el.value = String(Math.max(0, Math.floor((sol - 0.01) * 1e6) / 1e6));
 } else {
 var tok = Number(balanceCache.token);
 if (balanceCache.tokenMint !== from.mint || !isFinite(tok) || tok <= 0) {
 setStatus('NO TOKEN BALANCE TO SELL', '#ff5555');
 return;
 }
 el.value = String(tok);
 }
 setStatus('MAX LOADED * TAP SWAP TO SELL', '#ffff00');
 debouncedQuote();
 }

 async function simulateSwap() {
 if (!connectedPubkey) {
 setStatus('Connect wallet first.', '#ff5555');
 return;
 }
 if (!lastQuote) {
 setStatus('Wait for a valid quote first.', '#ff5555');
 return;
 }

 var provider = getWalletProvider();
 if (!provider) {
 setStatus('Wallet disconnected. Reconnect and try again.', '#ff5555');
 return;
 }

 var btn = $('swapBtn');
 if (btn) {
 btn.disabled = true;
 btn.textContent = 'SIGNING...';
 }
 setStatus('BUILDING SWAP TX...', '#ffff00');

 try {
 var soldFrom = await resolveToken('fromToken', 'fromCustomMint');
 var boughtTo = await resolveToken('toToken', 'toCustomMint');
 var sigStr;
 setStatus('CONFIRM IN WALLET...', '#ffff00');

 if (lastQuote.mode === 'v2') {
 sigStr = await executeV2Swap(lastQuote.quote, provider);
 } else {
 var swapPayload = await buildSwapTransaction(lastQuote.quote, connectedPubkey);
 if (!swapPayload.swapTransaction) {
 throw new Error('Jupiter returned no swap transaction');
 }
 var txBytes = Uint8Array.from(atob(swapPayload.swapTransaction), function (c) {
 return c.charCodeAt(0);
 });
 var tx = solanaWeb3.VersionedTransaction.deserialize(txBytes);
 var sig = await sendSignedTransaction(provider, tx);
 sigStr = typeof sig === 'string' ? sig : String(sig);
 }

 if (btn) btn.textContent = 'SWAP SENT';
 var stayOn = true;
 if (window.DOSWAPZ_SWAP) window.DOSWAPZ_SWAP.keepConnected = true;
 /* Stay connected so the same bag can be sold back without reconnecting. */

 // Count confirmed swaps on the global counter (API -> Netlify Blobs / KV)
 var countedTotal = null;
 if (window.DOSWAPZ_SWAP_STATS && typeof window.DOSWAPZ_SWAP_STATS.recordSwap === 'function') {
 try {
 countedTotal = await window.DOSWAPZ_SWAP_STATS.recordSwap(sigStr);
 } catch (countErr) {
 try {
 // Retry once if first write races or blips
 countedTotal = await window.DOSWAPZ_SWAP_STATS.recordSwap(sigStr);
 } catch (e2) {}
 }
 }

 var countNote =
 countedTotal != null && isFinite(Number(countedTotal))
 ? ' * PLATFORM SWAPS: ' + countedTotal
 : '';
 setStatus(
 'SWAP CONFIRMED - ' +
 sigStr.slice(0, 8) +
 '...' +
 countNote +
 ' * STILL CONNECTED. FLIP OR TAP SELL TO SELL BACK.',
 '#00ff00'
 );
 if (soldFrom && boughtTo && soldFrom.mint === SOL && boughtTo.mint !== SOL) {
 await refreshWalletBalances();
 var got = balanceCache.tokenMint === boughtTo.mint ? balanceCache.token : null;
 loadPair(boughtTo.mint, SOL, got);
 setStatus(
 'SWAP CONFIRMED - LOADED SELL BACK $' +
 (boughtTo.symbol || 'TOKEN') +
 ' -> SOL. TAP SWAP TO SELL.',
 '#ffff00'
 );
 } else {
 await refreshWalletBalances();
 }
 } catch (err) {
 setStatus('Swap failed: ' + (err.message || err), '#ff5555');
 if (btn) {
 btn.textContent = 'SWAP';
 btn.disabled = false;
 }
 return;
 }

 updateSwapButton();
 }

 function updateNodeRoute() {
 var sel = $('nodeSelect');
 var custom = $('customRpc');
 var status = $('nodeStatus');
 var benefits = $('nodeBenefits');
 if (!sel) return;

 var mode = sel.value;
 if (custom) custom.style.display = mode === 'custom' ? 'inline-block' : 'none';

 if (mode === 'public') {
 sendRpc = DEFAULT_RPC;
 if (status) status.textContent = 'Jupiter public route';
 if (benefits) benefits.style.display = 'none';
 } else if (mode === 'own') {
 sendRpc = DEFAULT_RPC;
 if (status) status.textContent = 'Node sim active';
 if (benefits) benefits.style.display = 'block';
 } else if (mode === 'custom') {
 var url = custom ? custom.value.trim() : '';
 sendRpc = url || DEFAULT_RPC;
 if (status) status.textContent = url ? 'Custom RPC set' : 'Paste RPC URL';
 if (benefits) benefits.style.display = url ? 'block' : 'none';
 }

 debouncedQuote();
 }

 function findKnownByMint(mint) {
 if (!mint) return null;
 for (var k in TOKEN_META) {
 if (TOKEN_META[k].mint === mint) {
 return {
 mint: mint,
 symbol: TOKEN_META[k].label,
 name: TOKEN_META[k].name || TOKEN_META[k].label,
 decimals: TOKEN_META[k].decimals,
 source: 'core'
 };
 }
 }
 for (var i = 0; i < FEATURED_MINTS.length; i++) {
 if (FEATURED_MINTS[i].mint === mint) {
 return {
 mint: mint,
 symbol: FEATURED_MINTS[i].symbol,
 name: FEATURED_MINTS[i].name || FEATURED_MINTS[i].symbol,
 decimals: FEATURED_MINTS[i].decimals,
 source: 'featured'
 };
 }
 }
 var vb = window.DOSWAPZ_VANTABLACK && window.DOSWAPZ_VANTABLACK.findByMint(mint);
 if (vb) return vb;
 var trix = window.DOSWAPZ_TRIX && window.DOSWAPZ_TRIX.findByMint(mint);
 return trix || null;
 }

 function applyUrlMintPrefill() {
 var params = new URLSearchParams(location.search);
 var toMint = (params.get('toMint') || params.get('mint') || '').trim();
 var fromMint = (params.get('fromMint') || '').trim();
 var amount = (params.get('amount') || '').trim();
 if (toMint && toMint.length >= 32) {
 var knownTo = findKnownByMint(toMint);
 applyTokenToSide('to', knownTo || { mint: toMint, symbol: 'TOKEN', name: 'Token', source: 'custom' });
 /* If not in select yet, fall back to Other + paste */
 ensureMintSelectable('to', toMint, knownTo);
 }
 if (fromMint && fromMint.length >= 32) {
 var knownFrom = findKnownByMint(fromMint);
 applyTokenToSide('from', knownFrom || { mint: fromMint, symbol: 'TOKEN', name: 'Token', source: 'custom' });
 ensureMintSelectable('from', fromMint, knownFrom);
 }
 var amtEl = $('fromAmount');
 if (amtEl && amount && Number(amount) > 0) amtEl.value = amount;
 }

 function ensureMintSelectable(side, mint, known) {
 var selectId = side === 'to' ? 'toToken' : 'fromToken';
 var mintInputId = side === 'to' ? 'toCustomMint' : 'fromCustomMint';
 var wrapId = side === 'to' ? 'toCustomWrap' : 'fromCustomWrap';
 var sel = $(selectId);
 if (!sel) return;
 /* already selected via applyTokenToSide? */
 var resolved = false;
 for (var i = 0; i < sel.options.length; i++) {
 var v = sel.options[i].value;
 if (v === (known && known.symbol) ||
 v === 'FEAT:' + mint ||
 v === VB_VALUE_PREFIX + mint ||
 v === TRIX_VALUE_PREFIX + mint) {
 sel.value = v;
 resolved = true;
 break;
 }
 }
 if (!resolved) {
 /* use Other + paste mint so quote always works */
 sel.value = 'Other (paste mint)';
 var mintEl = $(mintInputId);
 if (mintEl) mintEl.value = mint;
 toggleCustomMint(selectId, wrapId);
 }
 }

 function init() {
 toggleCustomMint('fromToken', 'fromCustomWrap');
 toggleCustomMint('toToken', 'toCustomWrap');
 updateNodeRoute();
 updateWalletUi();
 var catalogReady = Promise.all([
 loadTrixCatalog().catch(function () {}),
 loadVantablackCatalog().catch(function () {})
 ]);
 catalogReady.then(function () {
 populateDynamicSelectOptions();
 applyUrlMintPrefill();
 debouncedQuote();
 });
 debouncedQuote();
 window.addEventListener('beforeunload', function () {
 disconnectSwapWallet();
 });
 }

 window.connectSwapWallet = connectSwapWallet;
 window.disconnectSwapWallet = disconnectSwapWallet;
 window.updateSwapQuote = debouncedQuote;
 window.simulateSwap = simulateSwap;
 window.updateNodeRoute = updateNodeRoute;
 window.flipSwapSides = flipSwapSides;
 window.setMaxFrom = setMaxFrom;

 async function runArmedSwap(opts) {
 opts = opts || {};
 if (!connectedPubkey) throw new Error('Connect wallet first');
 var fromMint = String(opts.fromMint || '').trim();
 var toMint = String(opts.toMint || '').trim();
 var amount = opts.amount;
 if (!fromMint || !toMint) throw new Error('Need from and to mint');
 var knownFrom = findKnownByMint(fromMint) || { mint: fromMint, symbol: 'TOKEN', name: 'Token', source: 'custom' };
 var knownTo = findKnownByMint(toMint) || { mint: toMint, symbol: 'TOKEN', name: 'Token', source: 'custom' };
 applyTokenToSide('from', knownFrom);
 ensureMintSelectable('from', fromMint, findKnownByMint(fromMint));
 applyTokenToSide('to', knownTo);
 ensureMintSelectable('to', toMint, findKnownByMint(toMint));
 if ($('fromAmount') && amount != null && Number(amount) > 0) {
 $('fromAmount').value = String(amount);
 }
 setStatus('AUTO TRADE * QUOTING...', '#ffff00');
 await updateSwapQuote();
 if (!lastQuote) throw new Error('No quote for auto trade');
 await simulateSwap();
 }

 window.DOSWAPZ_SWAP = {
 TOKEN_META: TOKEN_META,
 SOL: SOL,
 keepConnected: false,
 lookupDecimals: lookupDecimals,
 toAtomic: toAtomic,
 formatAtomic: formatAtomic,
 refreshWalletBalances: refreshWalletBalances,
 fetchQuoteBundle: fetchQuoteBundle,
 fetchV1Quote: fetchV1Quote,
 fetchV2Order: fetchV2Order,
 buildSwapTransaction: buildSwapTransaction,
 routeLabels: routeLabels,
 applyTokenToSide: applyTokenToSide,
 loadPair: loadPair,
 flipSwapSides: flipSwapSides,
 setMaxFrom: setMaxFrom,
 runArmedSwap: runArmedSwap,
 connect: connectSwapWallet,
 disconnect: disconnectSwapWallet,
 get pubkey() { return connectedPubkey; }
 };

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', init);
 } else {
 init();
 }
})();