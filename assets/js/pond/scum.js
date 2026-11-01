/* DOSWAPZ - Pond Scum dossier viewer + native OLD RAILS dossier swap hook */
(function () {
 'use strict';

 var cfg = window.POND_CONFIG || {};
 var walletProvider = null;
 var connectedPubkey = null;

 function $(id) {
 return document.getElementById(id);
 }

 function shortAddr(addr) {
 if (!addr || addr.length < 10) return addr || ' - ';
 return addr.slice(0, 4) + '...' + addr.slice(-4);
 }

 function isValidSolanaAddress(addr) {
 return typeof addr === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());
 }

 function detectWallet() {
 if (window.solana && window.solana.isPhantom) return window.solana;
 if (window.solflare && window.solflare.isSolflare) return window.solflare;
 if (window.solana) return window.solana;
 return null;
 }

 function setStatus(msg, color) {
 var el = $('pondScumStatus');
 if (!el) return;
 el.textContent = msg;
 el.style.color = color || '#00cc00';
 }

 function buildSignMessage(pubkey) {
 return (
 'DOSWAPZ POND SCUM - SOFT SIGN ONLY\n' +
 'Wallet: ' +
 pubkey +
 '\nTimestamp: ' +
 Date.now() +
 '\n\nSignature-only verification to view your Pond dossier. NO FUNDS, NO TRANSACTION PERMISSION.'
 );
 }

 function formatBool(val) {
 if (val === true || val === 'true') return 'TRUE';
 if (val === false || val === 'false') return 'FALSE';
 return String(val == null ? ' - ' : val).toUpperCase();
 }

 function formatExpiry(val) {
 if (val == null || val === '' || val === 'undefined') return ' - ';
 var n = Number(val);
 /* Cary/Pond often use unix seconds */
 if (Number.isFinite(n) && n > 1e9 && n < 1e12) {
  return new Date(n * 1000).toLocaleString();
 }
 if (Number.isFinite(n) && n > 1e12) {
  return new Date(n).toLocaleString();
 }
 var d = new Date(val);
 if (Number.isNaN(d.getTime())) return String(val);
 return d.toLocaleString();
 }

 function dash(v) {
 return v == null || v === '' ? ' - ' : String(v);
 }

 function renderBadgeStrip(badges) {
 if (!badges || badges === ' - ') {
 return '<span class="dossier-val"> - </span>';
 }
 var chips = String(badges)
 .split(',')
 .map(function (raw) {
 var name = raw.trim().toLowerCase();
 if (!name) return '';
 return (
 '<span class="pond-badge-chip badge-' +
 name.replace(/[^a-z0-9_-]/g, '') +
 '">' +
 name +
 '</span>'
 );
 })
 .filter(Boolean)
 .join('');
 return '<div class="dossier-val"><div class="pond-badge-strip">' + chips + '</div></div>';
 }

 function rowHtml(key, valHtml, wide) {
 return (
 '<div class="dossier-row' +
 (wide ? ' dossier-row-wide' : '') +
 '">' +
 '<div class="dossier-key">' +
 key +
 '</div>' +
 valHtml +
 '</div>'
 );
 }

 function valHtml(text) {
 return '<div class="dossier-val">' + text + '</div>';
 }

 function renderDossier(data) {
 var grid = $('dossierGrid');
 if (!grid) return;

 var luck = (data && data.luck) || null;
 var oldRails = (data && data.oldRails) || {};
 var rigDb = (data && data.rigDb) || {};
 var classic = (data && data.classicDossier) || {};

 var impact = luck && luck.impact != null ? luck.impact : ' - ';
 if (Array.isArray(impact)) impact = impact.join(', ');

 var rows = [];
 rows.push(
 rowHtml(
 'OLD RAILS',
 valHtml(
 oldRails.allowed
 ? 'UNLOCKED (' + String(oldRails.reason || 'ok') + ')'
 : 'LOCKED (' + String(oldRails.reason || 'n/a') + ')'
 )
 )
 );
 rows.push(
 rowHtml(
 'ON ACTIVATED-RIG LIST',
 valHtml(formatBool(data && data.activatedRig) + ' (list = old-rails allowlist)')
 )
 );
 rows.push(
 rowHtml(
 'RIG DB',
 valHtml(
 (rigDb.count != null ? String(rigDb.count) : '0') +
 ' wallets' +
 (rigDb.updatedAt ? ' · synced ' + formatExpiry(rigDb.updatedAt) : ' · not synced')
 )
 )
 );
 /* === MANIFEST (same fields as Cary manifest page) === */
 var passLabel = classic.available
  ? classic.multiWallet || classic.via === 'public_multi_wallet'
    ? 'LOADED (any wallet)'
    : 'LOADED'
  : data && data.proSwapsSol != null
    ? 'PARTIAL'
    : 'UNAVAILABLE';
 rows.push(rowHtml('// MANIFEST', valHtml(passLabel)));
 if (!classic.available && classic.reason) {
  rows.push(rowHtml('MANIFEST NOTE', valHtml(String(classic.reason))));
 }
 /* Always show Cary-parity rows so empty state is visible */
 rows.push(
  rowHtml(
   'SOL SWAPS',
   valHtml(
    data.proSwapsSol != null
     ? Number(data.proSwapsSol).toLocaleString()
     : 'OFFLINE (Pond locked public passport)'
   )
  )
 );
 rows.push(
  rowHtml(
   'BX SWAPS',
   valHtml(
    data.proSwapsBx != null
     ? Number(data.proSwapsBx).toLocaleString()
     : 'OFFLINE (Pond locked public passport)'
   )
  )
 );
 rows.push(
  rowHtml('HAS TWITTER', valHtml(data.hasTwitter != null ? formatBool(data.hasTwitter) : ' - '))
 );
 rows.push(
  rowHtml(
   'BADGES',
   data.badges ? renderBadgeStrip(String(data.badges)) : valHtml(' - ')
  )
 );
 rows.push(rowHtml('COPE', valHtml(data.cope != null ? formatBool(data.cope) : ' - ')));
 rows.push(rowHtml('IS PRO', valHtml(data.isPro != null ? formatBool(data.isPro) : ' - ')));
 rows.push(
  rowHtml(
   'PRO EXPIRY',
   valHtml(data.proExpiry != null && data.proExpiry !== '' ? formatExpiry(data.proExpiry) : ' - ')
  )
 );
 rows.push(
  rowHtml('CHECKED IN', valHtml(data.checkedin != null ? formatBool(data.checkedin) : ' - '))
 );
 rows.push(rowHtml('BOARD', valHtml(data.board != null ? String(data.board) : ' - ')));
 rows.push(rowHtml('PRIORITY', valHtml(data.priority != null ? String(data.priority) : ' - ')));
 rows.push(rowHtml('ETH LINKED', valHtml(data.eth ? String(data.eth) : ' - ')));

 /* === LUCK (Cary luck page) === */
 rows.push(rowHtml('// LUCK', valHtml(luck && luck.luck != null ? 'LOADED' : ' - ')));
 rows.push(rowHtml('LUCK', valHtml(luck && luck.luck != null ? String(luck.luck) : ' - ')));
 rows.push(rowHtml('LUCK IMPACT', valHtml(dash(impact === ' - ' ? null : impact))));
 rows.push(
  rowHtml(
   'REFERRALS',
   valHtml(
    luck
     ? String(luck.referrals || 0) + ' · txns ' + String(luck.referralTxns || 0)
     : ' - '
   )
  )
 );
 rows.push(
  rowHtml(
   'ASSOCIATES',
   valHtml(
    luck
     ? String(luck.associates || 0) + ' · txns ' + String(luck.associateTxns || 0)
     : ' - '
   )
  )
 );
 rows.push(
  rowHtml(
   'GENERATED',
   valHtml(luck && luck.generated != null ? String(luck.generated) : ' - ')
  )
 );
 rows.push(
  rowHtml(
   'LUCK HISTORY',
   valHtml(luck && luck.historyCount != null ? String(luck.historyCount) : ' - ')
  )
 );

 /* === BUBBLES (Cary bubbles) === */
 var bub = (data && data.bubbles) || null;
 rows.push(rowHtml('// BUBBLES', valHtml(bub && bub.bubbles != null ? 'LOADED' : ' - ')));
 rows.push(
  rowHtml('BUBBLES', valHtml(bub && bub.bubbles != null ? Number(bub.bubbles).toLocaleString() : ' - '))
 );
 var boosts =
  bub && Array.isArray(bub.boosts) && bub.boosts.length
   ? bub.boosts.join(', ')
   : ' - ';
 rows.push(rowHtml('BUBBLE BOOSTS', valHtml(boosts)));

 grid.innerHTML = rows.join('');

 var raw = $('dossierRaw');
 if (raw) {
 raw.textContent = JSON.stringify(data, null, 2);
 }
 }

 function clearDossier() {
 var grid = $('dossierGrid');
 if (grid) {
 grid.innerHTML =
 '<div class="dossier-empty">CONNECT OR PASTE WALLET - STATUS AWAITS</div>';
 }
 var raw = $('dossierRaw');
 if (raw) raw.textContent = '';
 }

 function pondDossierUrl(wallet) {
 /* Direct third-party scrapers disabled — always use DOSWAPZ proxy */
 return (cfg.dossierProxy || '/api/pond-dossier') + '?wallet=' + encodeURIComponent(wallet.trim());
 }

 function pondMiningUrl(wallet) {
 return (cfg.miningProxy || '/api/pond-mining') + '?wallet=' + encodeURIComponent(wallet.trim());
 }

 function formatUsd(val) {
 var n = Number(val);
 if (!Number.isFinite(n)) return ' - ';
 if (n >= 1000) return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
 if (n >= 1) return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
 if (n > 0) return '$' + n.toPrecision(3);
 return '$0';
 }

 function formatInt(val) {
 var n = Number(val);
 return Number.isFinite(n) ? n.toLocaleString() : ' - ';
 }

 function healthBarHtml(health) {
 var h = Number(health);
 if (!Number.isFinite(h)) h = 0;
 var pct = Math.min(100, Math.round((h / 7) * 100));
 return (
 '<div class="health-bar-wrap">' +
 '<div class="health-bar"><div class="health-bar-fill" style="width:' +
 pct +
 '%"></div></div>' +
 '<div class="health-bar-label">' +
 h +
 ' / 9 (' +
 pct +
 '%)</div></div>'
 );
 }

 function isLocalHost() {
 try {
 return /^(localhost|127\.0\.0\.1)$/i.test(location.hostname || '');
 } catch (e) {
 return false;
 }
 }

 function looksLikeJson(res, text) {
 var ct = res.headers && res.headers.get ? res.headers.get('content-type') || '' : '';
 if (ct.indexOf('json') !== -1) return true;
 var t = (text || '').trim();
 return t.charAt(0) === '{' || t.charAt(0) === '[';
 }

 /**
  * Fetch JSON with diagnostics.
  * @returns {{ ok:true, data:object } | { ok:false, status:number, error:string, html:boolean }}
  */
 async function tryFetchJsonDetail(url) {
 try {
  var res = await fetch(url, { cache: 'no-store' });
  var text = await res.text();
  var data = null;
  if (looksLikeJson(res, text)) {
   try {
    data = JSON.parse(text);
   } catch (e) {
    data = null;
   }
  }
  /* Accept dossier payloads even if a nested note field exists */
  if (res.ok && data && typeof data === 'object' && !Array.isArray(data)) {
   /* Only hard-fail top-level error when no wallet/status fields present */
   if (data.error && data.wallet == null && data.version == null && data.luck == null) {
    return {
     ok: false,
     status: res.status,
     error: String(data.error),
     detail: data.detail ? String(data.detail) : '',
     upstream: true
    };
   }
   return { ok: true, data: data, status: res.status };
  }
  if (data && data.error) {
   return {
    ok: false,
    status: res.status,
    error: String(data.error),
    detail: data.detail ? String(data.detail) : '',
    upstream: true
   };
  }
  if (!res.ok) {
   return {
    ok: false,
    status: res.status,
    error: res.status === 502 || res.status === 504
     ? 'Server timeout — retry in a few seconds'
     : 'HTTP ' + res.status,
    html: !looksLikeJson(res, text) && /<html/i.test(text || ''),
    upstream: false
   };
  }
  return { ok: false, status: res.status, error: 'Empty or unexpected response' };
 } catch (e) {
  return { ok: false, status: 0, error: String(e.message || e), network: true };
 }
 }

 function formatFetchFailure(label, attempts) {
 var last = attempts[attempts.length - 1] || {};
 var msg = (last.error || 'unavailable').trim();

 if (/upstream unavailable|Failed to retrieve/i.test(msg)) {
  return label + ' upstream issue. Retry shortly, or use open Jupiter swap.';
 }

 if (last.status === 429 || /rate limit/i.test(msg)) {
  return label + ' rate-limited — wait a minute and retry.';
 }

 if (last.html || last.status === 404) {
  if (isLocalHost()) {
   return (
    label +
    ' API not running locally. Use START-SITE.bat / netlify dev / vercel dev, or open https://doswapz.com'
   );
  }
  return label + ' endpoint missing (HTTP ' + (last.status || '?') + ').';
 }

 if (last.network) {
  return label + ' network error: ' + msg;
 }

 return label + ' failed: ' + msg;
 }

 async function fetchDossier(wallet) {
 if (!isValidSolanaAddress(wallet)) {
 throw new Error('Invalid Solana address');
 }

 var w = wallet.trim();
 var proxyUrl = pondDossierUrl(w);
 var pack = await tryFetchJsonDetail(proxyUrl);
 if (pack.ok) return pack.data;
 throw new Error(formatFetchFailure('Status', [pack]));
 }

 async function fetchMining(wallet) {
 if (!isValidSolanaAddress(wallet)) {
 throw new Error('Invalid Solana address');
 }

 var w = wallet.trim();
 var proxyUrl = pondMiningUrl(w);
 var pack = await tryFetchJsonDetail(proxyUrl);
 if (pack.ok) return pack.data;
 if (pack.status === 200 && pack.data) return pack.data;
 throw new Error(formatFetchFailure('Mining', [pack]));
 }

 function clearMining() {
 var grid = $('miningGrid');
 if (grid) {
 grid.innerHTML =
 '<div class="dossier-empty">LOAD DOSSIER TO VIEW MINING STATS</div>';
 }
 var notes = $('miningNotes');
 if (notes) notes.innerHTML = '';
 var raw = $('miningRaw');
 if (raw) raw.textContent = '';
 }

 function renderMining(data, dossierData) {
 var grid = $('miningGrid');
 if (!grid) return;

 var stats = (data && data.stats) || null;
 var sessionId = (data && data.sessionId) || (dossierData && dossierData.mining && dossierData.mining.sessionId) || null;
 var pondMine = cfg.pondMiningUrl || 'https://www.pond0x.com/mining';

 if (stats && typeof stats === 'object') {
  var est = stats.estimates || {};
  var rows = [
   ['RIG HEALTH', healthBarHtml(stats.health)],
   ['MINING SESSIONS', formatInt(stats.mining_sessions)],
   ['IN MEMPOOL', formatInt(stats.in_mempool)],
   ['SENT (CLAIMED)', formatInt(stats.sent)],
   ['FAILED', formatInt(stats.failed)],
   ['DRIFTED', formatInt(stats.drifted)],
   ['DRIFT RISK', formatInt(stats.drift_risk)],
   ['PRIORITY', formatInt(stats.priority)],
   ['EST SOL USD', formatUsd(est.sol_usd)],
   ['EST WPOND USD', formatUsd(est.wpond_usd)],
   ['EST MAX CLAIM', formatUsd(est.max_claim_estimate_usd)]
  ];
  grid.innerHTML = rows
   .map(function (row) {
    var v = row[0] === 'RIG HEALTH' ? row[1] : valHtml(row[1]);
    return rowHtml(row[0], v, row[0] === 'RIG HEALTH');
   })
   .join('');
 } else {
  grid.innerHTML = [
   rowHtml(
    'PUBLIC SESSION',
    valHtml(sessionId ? shortAddr(sessionId) + ' (present)' : 'NONE')
   ),
   rowHtml(
    'FULL RIG HEALTH',
    valHtml('See Pond0x mining (not scraped by DOSWAPZ)')
   ),
   rowHtml(
    'OPEN',
    valHtml('<a href="' + pondMine + '" target="_blank" rel="noopener noreferrer" style="color:#ffff00">pond0x.com/mining</a>')
   )
  ].join('');
 }

 var notes = $('miningNotes');
 if (notes) {
  var tips = Array.isArray(data && data.ai_beta) ? data.ai_beta.slice() : [];
  if (dossierData && dossierData.oldRails && dossierData.oldRails.message) {
   tips.unshift(String(dossierData.oldRails.message));
  }
  if (!tips.length) {
   notes.innerHTML =
    '<li class="mining-note-empty">Public mining session only — no private health scrape.</li>';
  } else {
   notes.innerHTML = tips
    .map(function (tip) {
     return '<li>' + String(tip) + '</li>';
    })
    .join('');
  }
 }

 var raw = $('miningRaw');
 if (raw) raw.textContent = JSON.stringify(data, null, 2);
 }

 async function loadDossierForWallet(wallet) {
 setStatus('LOADING DOSSIER…', '#ffff00');
 clearDossier();
 clearMining();
 try {
  var pair = await Promise.all([
   fetchDossier(wallet),
   fetchMining(wallet).catch(function () { return null; })
  ]);
  var data = pair[0];
  var miningDirect = pair[1];
  if (!data || typeof data !== 'object') {
   throw new Error('Empty dossier response');
  }
  renderDossier(data);

  var miningPayload = null;
  if (data.mining && data.mining.stats) {
   miningPayload = data.mining;
  } else if (miningDirect && miningDirect.stats) {
   miningPayload = miningDirect;
  } else if (miningDirect) {
   miningPayload = miningDirect;
  } else {
   miningPayload = {
    sessionId: data.mining && data.mining.sessionId,
    ai_beta: (data.notes || []).concat(['Mining detail retry failed — refresh once.'])
   };
  }
  renderMining(miningPayload, data);

  var luck = data.luck && data.luck.luck != null ? data.luck.luck : null;
  var rails = data.oldRails && data.oldRails.allowed ? 'RAILS ON' : 'RAILS LOCKED';
  var swaps =
   data.proSwapsSol != null || data.proSwapsBx != null
    ? Number(data.proSwapsSol || 0) + Number(data.proSwapsBx || 0)
    : null;
  var parts = [
   'DOSSIER LOADED - ' + shortAddr(wallet),
   rails,
   data.activatedRig ? 'RIG YES' : 'RIG NO'
  ];
  if (swaps != null) parts.push('SWAPS ' + swaps.toLocaleString());
  if (luck != null) parts.push('LUCK ' + luck);
  if (data.bubbles && data.bubbles.bubbles != null) {
   parts.push('BUBBLES ' + Number(data.bubbles.bubbles).toLocaleString());
  }
  if (miningPayload && miningPayload.stats && miningPayload.stats.mining_sessions != null) {
   parts.push('SESSIONS ' + Number(miningPayload.stats.mining_sessions).toLocaleString());
  }
  var hasLive =
   luck != null ||
   (miningPayload && miningPayload.stats) ||
   (data.bubbles && data.bubbles.bubbles != null);
  if (!data.classicDossier || !data.classicDossier.available) {
   parts.push(hasLive ? 'MANIFEST OFFLINE (luck/health still live)' : 'MANIFEST OFFLINE');
  }
  setStatus(parts.join(' * '), data.oldRails && data.oldRails.allowed ? '#00ff00' : '#ffcc00');

  localStorage.setItem('pond_scum_wallet', wallet.trim());
  var paste = $('walletPaste');
  if (paste) paste.value = wallet.trim();
 } catch (err) {
  console.error('dossier load failed', err);
  setStatus(
   'Dossier error: ' +
    (err && err.message ? err.message : err) +
    ' — hard refresh (Ctrl+Shift+R) and try once more',
   '#ff5555'
  );
 }
 }

 async function connectSoftWallet() {
 var provider = detectWallet();
 if (!provider) {
 setStatus('No Solana wallet detected. Paste address below or install Phantom.', '#ff5555');
 var help = $('pondWalletHelp');
 if (help) help.style.display = 'block';
 return;
 }

 try {
 setStatus('CONNECTING WALLET...', '#ffff00');
 var resp = await provider.connect({ onlyIfTrusted: false });
 walletProvider = provider;
 connectedPubkey = resp.publicKey.toString();

 var connectBtn = $('pondConnectBtn');
 var disconnectBtn = $('pondDisconnectBtn');
 var info = $('pondWalletInfo');
 if (connectBtn) connectBtn.style.display = 'none';
 if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
 if (info) info.textContent = shortAddr(connectedPubkey) + ' connected';

 if (typeof provider.signMessage === 'function') {
 setStatus('REQUESTING SOFT SIGN (NO FUNDS)...', '#ffff00');
 var encoded = new TextEncoder().encode(buildSignMessage(connectedPubkey));
 await provider.signMessage(encoded, 'utf8');
 }

 await loadDossierForWallet(connectedPubkey);
 } catch (err) {
 setStatus('Connect/sign failed: ' + (err.message || err), '#ff5555');
 }
 }

 function disconnectSoftWallet() {
 var provider = walletProvider || detectWallet();
 if (provider && typeof provider.disconnect === 'function') {
 provider.disconnect().catch(function () {});
 }
 walletProvider = null;
 connectedPubkey = null;

 var connectBtn = $('pondConnectBtn');
 var disconnectBtn = $('pondDisconnectBtn');
 var info = $('pondWalletInfo');
 if (connectBtn) connectBtn.style.display = 'inline-block';
 if (disconnectBtn) disconnectBtn.style.display = 'none';
 if (info) info.textContent = '';
 setStatus('DISCONNECTED', '#00cc00');
 }

 async function submitPastedWallet() {
 var paste = $('walletPaste');
 var wallet = paste ? paste.value.trim() : '';
 if (!isValidSolanaAddress(wallet)) {
 setStatus('Paste a valid Solana pubkey (base58).', '#ff5555');
 return;
 }
 await loadDossierForWallet(wallet);
 }

 async function refreshGlobalStats() {
 var el = $('pondGlobalStats');
 if (!el) return;

 var pondApi = cfg.pondStatsApi || 'https://www.pond0x.com/api/solana';
 var urls = [(cfg.statsProxy || '/api/pond-stats'), pondApi];

 for (var i = 0; i < urls.length; i++) {
 try {
 var res = await fetch(urls[i], { cache: 'no-store' });
 if (!res.ok) continue;
 var data = await res.json();
 var swaps = data.swaps != null ? Number(data.swaps).toLocaleString() : ' - ';
 var jackpot = data.jackpot != null ? data.jackpot : ' - ';
 var bonus = data.bonus != null ? data.bonus : ' - ';
 el.innerHTML =
 'POND PROTOCOL - TOTAL SWAPS: <span class="highlight">' +
 swaps +
 '</span> * JACKPOT: <span class="highlight">' +
 jackpot +
 '</span> * BONUS: <span class="highlight">' +
 bonus +
 '</span>';
 return;
 } catch (e) {}
 }

 el.textContent = 'POND GLOBAL STATS UNAVAILABLE - TRY AGAIN LATER';
 }

 function buildDossierSwapUrl() {
 /* Legacy iframe plugin URL (optional). Native old-rails UI lives in dossier-swap.js */
 var base = (cfg.jupiterPlugin || '').trim();
 if (!base) return '';
 try {
 var url = new URL(base);
 var ref = (cfg.referralWallet || '').trim();
 if (ref) url.searchParams.set('ref', ref);
 url.searchParams.set('utm_source', 'doswapz');
 url.searchParams.set('utm_medium', 'pond_scum_swap');
 return url.toString();
 } catch (e) {
 return base;
 }
 }

 function mountDossierSwap() {
 /* Prefer native OLD RAILS panel (#dossierSwapPanel). Fall back to iframe plugin if present. */
 var panel = $('dossierSwapPanel');
 if (panel) return;

 var frame = $('dossierSwapFrame');
 if (!frame) return;
 var url = buildDossierSwapUrl();
 if (url && frame.src !== url) frame.src = url;
 }

 function init() {
 clearDossier();
 clearMining();
 refreshGlobalStats();
 mountDossierSwap();

 var connectBtn = $('pondConnectBtn');
 var disconnectBtn = $('pondDisconnectBtn');
 var submitBtn = $('pondSubmitWallet');
 var refreshBtn = $('pondRefreshDossier');

 if (connectBtn) connectBtn.addEventListener('click', connectSoftWallet);
 if (disconnectBtn) disconnectBtn.addEventListener('click', disconnectSoftWallet);
 if (submitBtn) submitBtn.addEventListener('click', submitPastedWallet);
 var pasteEl = $('walletPaste');
 if (pasteEl) {
  pasteEl.addEventListener('keydown', function (e) {
   if (e.key === 'Enter') {
    e.preventDefault();
    submitPastedWallet();
   }
  });
 }
 if (refreshBtn) {
 refreshBtn.addEventListener('click', function () {
 var w =
 connectedPubkey ||
 ($('walletPaste') && $('walletPaste').value.trim()) ||
 localStorage.getItem('pond_scum_wallet') ||
 '';
 if (w) loadDossierForWallet(w);
 else setStatus('Connect or paste wallet first.', '#ff5555');
 refreshGlobalStats();
 });
 }

 var saved = localStorage.getItem('pond_scum_wallet');
 if (saved && isValidSolanaAddress(saved)) {
 var paste = $('walletPaste');
 if (paste) paste.value = saved;
 }

 if (!detectWallet()) {
 var help = $('pondWalletHelp');
 if (help) help.style.display = 'block';
 }
 }

 window.POND_SCUM = {
 loadDossierForWallet: loadDossierForWallet,
 fetchMining: fetchMining,
 refreshGlobalStats: refreshGlobalStats,
 buildDossierSwapUrl: buildDossierSwapUrl
 };

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', init);
 } else {
 init();
 }
})();