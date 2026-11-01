/* Vantablack Market - shared catalog + listing helpers */
window.DOSWAPZ_VANTABLACK = (function () {
 'use strict';

 var cfg = window.VANTABLACK_CONFIG || {};
 // Formerly blocked rebrand mints (CRYPTODAD/CRYPTOMOM) - now main as SELLER/MOMS
 var BLOCKED_MINTS = {};
 var MAIN_SYMBOL_ORDER = [
 'PORK', 'PNDC', 'WPOND', 'VOID', 'TRIX', 'PAULY', 'TBB', 'GPC',
 'SELLER', 'MOMS', 'DEMPLAR', 'RABBIT', 'BIT'
 ];
 var catalog = [];
 var loaded = false;
 var loadPromise = null;

 function isSolMint(mint) {
 return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(mint || '').trim());
 }

 function isEthAddress(addr) {
 return /^0x[a-fA-F0-9]{40}$/.test(String(addr || '').trim());
 }

 var EVM_CHAIN_ALIASES = {
 eth: 'ethereum',
 ethereum: 'ethereum',
 base: 'base',
 arbitrum: 'arbitrum',
 arb: 'arbitrum',
 polygon: 'polygon',
 matic: 'polygon',
 optimism: 'optimism',
 op: 'optimism',
 bsc: 'bsc',
 bnb: 'bsc',
 robinhood: 'robinhood',
 hood: 'robinhood',
 rh: 'robinhood',
 'robinhood-chain': 'robinhood'
 };

 function resolveChain(raw, mint) {
 var chainHint = String((raw && raw.chain) || '').toLowerCase().trim();
 if (chainHint === 'sol' || chainHint === 'solana') return 'solana';
 if (EVM_CHAIN_ALIASES[chainHint]) return EVM_CHAIN_ALIASES[chainHint];
 if (isEthAddress(mint)) {
 // bare 0x without chain -> ethereum default (legacy)
 return 'ethereum';
 }
 if (isSolMint(mint)) return 'solana';
 return null;
 }

 function normalize(raw) {
 if (!raw) return null;
 var mint = String(raw.mint || '').trim();
 if (!mint || BLOCKED_MINTS[mint]) return null;

 var chain = resolveChain(raw, mint);
 if (!chain) return null;
 if (chain === 'solana' && !isSolMint(mint)) return null;
 if (chain !== 'solana' && !isEthAddress(mint)) return null;

 var symbol = String(raw.symbol || 'TOKEN').trim().toUpperCase().slice(0, 12);
 var sectionRaw = String(raw.section || '').toLowerCase();
 var tagRaw = String(raw.tag || '').toLowerCase();
 var isMain =
 sectionRaw === 'main' ||
 tagRaw === 'main' ||
 (!!raw.featured && MAIN_SYMBOL_ORDER.indexOf(symbol) >= 0) ||
 (raw.source === 'seed' && MAIN_SYMBOL_ORDER.indexOf(symbol) >= 0);
 var section = isMain ? 'main' : 'created';
 var ltRaw = String(raw.launchType || '').toLowerCase();
 var launchType = 'classic';
 if (ltRaw === 'curve') launchType = 'curve';
 else if (ltRaw === 'erc20' || chain !== 'solana') launchType = chain === 'solana' ? 'classic' : 'erc20';

 var isEvm = chain !== 'solana';

 return {
 mint: mint,
 symbol: symbol,
 name: String(raw.name || raw.symbol || 'Token').trim().slice(0, 48),
 decimals: typeof raw.decimals === 'number'
 ? raw.decimals
 : (isEvm ? 18 : 9),
 creator: raw.creator || '',
 supply: raw.supply || '',
 chain: chain,
 featured: isMain || !!raw.featured,
 section: section,
 tag: isMain
 ? 'main'
 : (launchType === 'curve' ? 'curve' : (raw.tag || 'created')),
 launchType: launchType,
 listedAt: raw.listedAt || raw.ts || null,
 source: raw.source || 'vantablack'
 };
 }

 function dedupe(list) {
 var seen = {};
 var out = [];
 list.forEach(function (t) {
 if (!t) return;
 var key = String(t.mint).toLowerCase();
 if (seen[key]) return;
 seen[key] = true;
 out.push(t);
 });
 return out;
 }

 function sortCatalog(list) {
 list.sort(function (a, b) {
 if (a.section !== b.section) return a.section === 'main' ? -1 : 1;
 if (a.section === 'main') {
 var ai = MAIN_SYMBOL_ORDER.indexOf(a.symbol);
 var bi = MAIN_SYMBOL_ORDER.indexOf(b.symbol);
 if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
 }
 if (a.featured !== b.featured) return a.featured ? -1 : 1;
 return (b.listedAt || '').localeCompare(a.listedAt || '');
 });
 return list;
 }

 function readLocal() {
 try {
 var raw = localStorage.getItem(cfg.localCacheKey || 'vantablack_coins_v1');
 if (!raw) return [];
 var data = JSON.parse(raw);
 if (!Array.isArray(data)) return [];
 return data.map(normalize).filter(Boolean);
 } catch (e) {
 return [];
 }
 }

 function writeLocal(list) {
 try {
 localStorage.setItem(cfg.localCacheKey || 'vantablack_coins_v1', JSON.stringify(list));
 } catch (e) {}
 }

 function swapUrl(mint) {
 var base = cfg.swapPath || '/classic/pages/doswapz/swap.html?toMint=';
 if (!mint) return base.replace(/\?.*$/, '');
 if (base.indexOf('toMint=') >= 0) return base + encodeURIComponent(mint);
 return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'toMint=' + encodeURIComponent(mint);
 }

 function orbitSwapUrl(mint) {
 return '/orbit/pages/doswapz/swap.html?toMint=' + encodeURIComponent(mint || '');
 }

 function isMint(s) {
 return isSolMint(s);
 }

 function partition(list) {
 var main = [];
 var created = [];
 (list || []).forEach(function (c) {
 if (!c) return;
 if (c.section === 'main') main.push(c);
 else created.push(c);
 });
 return { main: main, created: created };
 }

 async function fetchCatalog(force) {
 if (loadPromise && !force) return loadPromise;

 loadPromise = (async function () {
 var merged = [];
 var apiOk = false;

 try {
 var res = await fetch(cfg.apiUrl || '/api/vantablack-coins', { cache: 'no-store' });
 if (res.ok) {
 var data = await res.json();
 if (Array.isArray(data.coins)) {
 merged = merged.concat(data.coins);
 apiOk = true;
 }
 }
 } catch (e) {}

 // Always pull seed JSON so main coins show even if API is empty/offline
 try {
 var staticRes = await fetch(cfg.catalogUrl || '/assets/data/vantablack-coins.json', {
 cache: 'no-store'
 });
 if (staticRes.ok) {
 var staticData = await staticRes.json();
 if (Array.isArray(staticData.coins)) merged = merged.concat(staticData.coins);
 }
 } catch (e2) {}

 // Drop old demo / test tracks if they leak in from remote store
 var DROP_MINTS = {
 FKaSujGciK4hhFxacUPRycsTiv5W2NirjAuYsZLgpump: true,
 E2ueKQ3EDTTmCkUA17j3KeTb2u6VT91xiyECdKRzpump: true,
 // accidental test tracks from market QA - not Vantablack-created
 '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr': true,
 JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: true,
 DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: true,
 EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: true
 };

 merged = sortCatalog(
 dedupe(merged.concat(readLocal()).map(normalize).filter(function (c) {
 return c && !DROP_MINTS[c.mint];
 }))
 );
 catalog = merged;
 loaded = true;
 return catalog;
 })();

 return loadPromise;
 }

 function getCatalog() {
 return catalog.slice();
 }

 function findByMint(mint) {
 if (!mint) return null;
 var key = String(mint).trim().toLowerCase();
 for (var i = 0; i < catalog.length; i++) {
 if (String(catalog[i].mint).toLowerCase() === key) return catalog[i];
 }
 return null;
 }

 function registerLocal(coin) {
 var entry = normalize(Object.assign(
 { source: 'local', section: 'created', tag: 'created' },
 coin,
 { listedAt: new Date().toISOString() }
 ));
 if (!entry) return null;
 // Launched/tracked coins are always created section unless explicitly main
 if (entry.section !== 'main') {
 entry.section = 'created';
 entry.featured = false;
 if (entry.tag === 'main') entry.tag = 'created';
 }
 var local = readLocal().filter(function (t) {
 return String(t.mint).toLowerCase() !== String(entry.mint).toLowerCase();
 });
 local.unshift(entry);
 writeLocal(local);
 catalog = sortCatalog(dedupe([entry].concat(catalog)));
 return entry;
 }

 async function register(coin) {
 var entry = registerLocal(coin);
 if (!entry) return null;
 entry.persisted = false;
 try {
 var res = await fetch(cfg.apiUrl || '/api/vantablack-coins', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 mint: entry.mint,
 symbol: entry.symbol,
 name: entry.name,
 decimals: entry.decimals,
 creator: entry.creator || '',
 supply: entry.supply || '',
 chain: entry.chain || 'solana',
 launchType: entry.launchType || 'classic',
 tag: entry.section === 'main' ? 'main' : 'created',
 section: entry.section || 'created'
 })
 });
 if (res.ok) {
 var data = await res.json();
 var fromApi = data.coin ? normalize(data.coin) : null;
 if (fromApi) {
 fromApi.persisted = !!data.persisted;
 entry = fromApi;
 } else {
 entry.persisted = !!data.persisted;
 }
 }
 } catch (e) {}
 return entry;
 }

 /**
 * Look up a mint on-chain/market data and list it for everyone.
 * Uses stats API for symbol/name when available.
 */
 async function trackMint(mint, opts) {
 opts = opts || {};
 mint = String(mint || '').trim();
 if (!isMint(mint) || BLOCKED_MINTS[mint]) {
 throw new Error('Invalid mint address');
 }

 var existing = findByMint(mint);
 if (existing && !opts.force) return existing;

 var symbol = opts.symbol || 'TOKEN';
 var name = opts.name || 'Token';
 var launchType = opts.launchType === 'curve' ? 'curve' : 'classic';

 if (window.DOSWAPZ_VB_CURVE) {
 var stats = await window.DOSWAPZ_VB_CURVE.fetchStats([mint], true);
 var row = stats[mint];
 if (row && row.ok) {
 if (row.symbol) symbol = row.symbol;
 if (row.name) name = row.name;
 if (row.curve && (row.curve.status === 'bonding' || row.curve.dexId === 'pumpfun')) {
 launchType = 'curve';
 }
 }
 }

 return register({
 mint: mint,
 symbol: symbol,
 name: name,
 decimals: opts.decimals != null ? opts.decimals : 9,
 chain: 'solana',
 launchType: launchType,
 tag: 'created',
 section: 'created',
 source: 'track'
 });
 }

 return {
 fetchCatalog: fetchCatalog,
 getCatalog: getCatalog,
 findByMint: findByMint,
 register: register,
 registerLocal: registerLocal,
 trackMint: trackMint,
 swapUrl: swapUrl,
 orbitSwapUrl: orbitSwapUrl,
 normalize: normalize,
 isMint: isMint,
 partition: partition,
 MAIN_SYMBOL_ORDER: MAIN_SYMBOL_ORDER
 };
})();
