/* DOSWAPZ - platform swap counter (API + Blobs/KV + local fallback) */
(function () {
 'use strict';

 var STATS_URL = '/assets/data/swap-stats.json';
 var API_URL = '/api/swap-stats';
 var SIGS_KEY = 'doswapz_swap_recorded_sigs_v1';
 var PENDING_KEY = 'doswapz_swap_pending_sigs_v1';
 var cachedStats = null;
 var listeners = [];
 var flushTimer = null;

 function readList(key) {
 try {
 var raw = localStorage.getItem(key);
 var list = raw ? JSON.parse(raw) : [];
 return Array.isArray(list) ? list : [];
 } catch (e) {
 return [];
 }
 }

 function writeList(key, list) {
 try {
 localStorage.setItem(key, JSON.stringify(list.slice(-200)));
 } catch (e) {}
 }

 function readRecordedSigs() {
 return readList(SIGS_KEY);
 }

 function writeRecordedSigs(list) {
 writeList(SIGS_KEY, list);
 }

 function readPendingSigs() {
 return readList(PENDING_KEY);
 }

 function writePendingSigs(list) {
 writeList(PENDING_KEY, list);
 }

 function addPending(signature) {
 var list = readPendingSigs();
 if (list.indexOf(signature) < 0) {
 list.push(signature);
 writePendingSigs(list);
 }
 }

 function removePending(signature) {
 writePendingSigs(readPendingSigs().filter(function (s) { return s !== signature; }));
 }

 function knownSignatures(stats) {
 var set = {};
 (stats && stats.signatures || []).forEach(function (entry) {
 var sig = typeof entry === 'string' ? entry : entry && entry.sig;
 if (sig) set[sig] = true;
 });
 return set;
 }

 function mergeStats(staticStats, apiStats) {
 var base = staticStats || { total: 0, signatures: [] };
 if (!apiStats || typeof apiStats.total !== 'number') return base;

 if (apiStats.persisted) {
 return {
 total: Math.max(base.total || 0, apiStats.total || 0),
 signatures: (apiStats.signatures && apiStats.signatures.length)
 ? apiStats.signatures
 : (base.signatures || []),
 updatedAt: apiStats.updatedAt || base.updatedAt || null,
 persisted: true,
 backend: apiStats.backend || null
 };
 }

 return {
 total: Math.max(base.total || 0, apiStats.total || 0),
 signatures: base.signatures || [],
 updatedAt: base.updatedAt || apiStats.updatedAt || null,
 persisted: false,
 backend: apiStats.backend || null
 };
 }

 function computeTotal(stats) {
 var base = stats && typeof stats.total === 'number' ? stats.total : 0;
 // When server is persisted, trust server total (don't double-count local)
 if (stats && stats.persisted) return base;

 var known = knownSignatures(stats);
 var extra = readRecordedSigs().filter(function (sig) {
 return sig && !known[sig];
 }).length;
 return base + extra;
 }

 function notify() {
 listeners.forEach(function (fn) {
 try {
 fn();
 } catch (e) {}
 });
 }

 async function fetchJson(url, options) {
 var res = await fetch(url, options || { headers: { Accept: 'application/json' }, cache: 'no-cache' });
 if (!res.ok) throw new Error('HTTP ' + res.status);
 return res.json();
 }

 async function fetchStats(force) {
 if (!force && cachedStats) return cachedStats;

 var staticStats = { total: 0, signatures: [], updatedAt: null };
 try {
 staticStats = await fetchJson(STATS_URL);
 } catch (e) {}

 try {
 var apiStats = await fetchJson(API_URL);
 cachedStats = mergeStats(staticStats, apiStats);
 } catch (e) {
 cachedStats = staticStats;
 }

 return cachedStats;
 }

 async function getTotal() {
 try {
 var stats = await fetchStats(false);
 return computeTotal(stats);
 } catch (e) {
 return computeTotal({ total: 0, signatures: [] });
 }
 }

 function rememberLocalSignature(signature) {
 if (!signature) return false;
 var sigs = readRecordedSigs();
 if (sigs.indexOf(signature) >= 0) return false;
 sigs.push(signature);
 writeRecordedSigs(sigs);
 return true;
 }

 async function postSwapToApi(signature) {
 try {
 var res = await fetch(API_URL, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
 body: JSON.stringify({ signature: signature })
 });
 var data = null;
 try {
 data = await res.json();
 } catch (e) {
 data = null;
 }

 if (!res.ok) {
 return { ok: false, status: res.status, data: data };
 }

 if (data && typeof data.total === 'number') {
 cachedStats = mergeStats(cachedStats || { total: 0, signatures: [] }, {
 total: data.total,
 signatures: cachedStats && cachedStats.signatures ? cachedStats.signatures : [],
 persisted: data.persisted !== false && (!!data.recorded || !!data.duplicate || !!data.persisted),
 backend: data.backend || null,
 updatedAt: new Date().toISOString()
 });
 }

 return {
 ok: true,
 total: data && typeof data.total === 'number' ? data.total : null,
 recorded: !!(data && data.recorded),
 duplicate: !!(data && data.duplicate),
 persisted: !!(data && data.persisted),
 data: data
 };
 } catch (e) {
 return { ok: false, error: e && e.message ? e.message : String(e) };
 }
 }

 async function flushPending() {
 var pending = readPendingSigs();
 if (!pending.length) return;
 for (var i = 0; i < pending.length; i++) {
 var sig = pending[i];
 if (!sig) continue;
 var result = await postSwapToApi(sig);
 if (result.ok && (result.recorded || result.duplicate || result.persisted)) {
 removePending(sig);
 rememberLocalSignature(sig);
 }
 }
 notify();
 }

 function scheduleFlush() {
 if (flushTimer) return;
 flushTimer = setTimeout(function () {
 flushTimer = null;
 flushPending().catch(function () {});
 }, 1500);
 }

 /**
 * Record a confirmed on-chain swap signature to the global counter.
 * Always POSTs to API (idempotent). Falls back to local + retry queue if offline.
 */
 async function recordSwap(signature) {
 if (!signature || String(signature).length < 32) {
 return getTotal();
 }
 signature = String(signature).trim();

 var result = await postSwapToApi(signature);
 rememberLocalSignature(signature);

 if (result.ok && (result.recorded || result.duplicate || result.persisted)) {
 removePending(signature);
 } else {
 // Queue for retry so failed writes still land on the global counter later
 addPending(signature);
 scheduleFlush();
 }

 // Force refresh from server so UI matches global total when persisted
 try {
 await fetchStats(true);
 } catch (e) {}

 notify();
 if (window.DOSWAPZ_TICKER && typeof window.DOSWAPZ_TICKER.refresh === 'function') {
 try {
 window.DOSWAPZ_TICKER.refresh();
 } catch (e) {}
 }
 return getTotal();
 }

 async function refresh(force) {
 await fetchStats(!!force);
 scheduleFlush();
 notify();
 return getTotal();
 }

 function subscribe(fn) {
 if (typeof fn === 'function') listeners.push(fn);
 }

 function tickerItemHtml(total) {
 var n = Number(total);
 var text = isFinite(n) ? String(n) : ' - ';
 return (
 '<span class="ticker-item">' +
 '<span class="ticker-tag">DOSWAPZ</span>' +
 '<span class="ticker-symbol">SWAPS</span> ' +
 '<span class="ticker-price">' + text + '</span>' +
 '</span>'
 );
 }

 // Retry any swaps that failed to persist (e.g. old 503s before Blobs)
 if (typeof window !== 'undefined') {
 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', function () {
 scheduleFlush();
 });
 } else {
 scheduleFlush();
 }
 window.addEventListener('online', function () {
 scheduleFlush();
 });
 }

 window.DOSWAPZ_SWAP_STATS = {
 getTotal: getTotal,
 recordSwap: recordSwap,
 refresh: refresh,
 subscribe: subscribe,
 tickerItemHtml: tickerItemHtml,
 flushPending: flushPending
 };
})();
