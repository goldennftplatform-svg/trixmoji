/* DOSWAPZ - Trix Market token catalog (live API) */
window.DOSWAPZ_TRIX = (function () {
 'use strict';

 var API_TRENDING = 'https://trix.market/api/trending';
 var API_SEARCH = 'https://trix.market/api/search';
 var CACHE_KEY = 'doswapz_trix_tokens_v2';
 var CACHE_TTL_MS = 5 * 60 * 1000;
 var TRIX_API_SECTIONS = ['trending', 'recentlyGraduated', 'topGainers'];

 var catalog = [];
 var lastFetch = 0;
 var fetchPromise = null;

 function normalize(raw) {
 if (!raw) return null;
 var mint = (raw.mint || raw.mintAddress || '').trim();
 if (!mint) return null;
 var symbol = (raw.symbol || 'TOKEN').trim().toUpperCase();
 var name = (raw.name || symbol).trim();
 var decimals = typeof raw.decimals === 'number' ? raw.decimals : null;
 return {
 mint: mint,
 symbol: symbol,
 name: name,
 decimals: decimals,
 logoUrl: raw.logoUrl || '',
 marketCap: typeof raw.marketCap === 'number' ? raw.marketCap : null,
 price: typeof raw.price === 'number' ? raw.price : null,
 change24h: typeof raw.change24h === 'number' ? raw.change24h : null,
 source: 'trix'
 };
 }

 function dedupe(list) {
 var seen = {};
 var out = [];
 list.forEach(function (t) {
 if (!t || !t.mint || seen[t.mint]) return;
 seen[t.mint] = true;
 out.push(t);
 });
 return out;
 }

 function readCache() {
 try {
 var raw = localStorage.getItem(CACHE_KEY);
 if (!raw) return null;
 var data = JSON.parse(raw);
 if (!data || !data.ts || !data.tokens) return null;
 if (Date.now() - data.ts > CACHE_TTL_MS) return null;
 return data.tokens.map(normalize).filter(Boolean);
 } catch (e) {
 return null;
 }
 }

 function writeCache(tokens) {
 try {
 localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), tokens: tokens }));
 } catch (e) {}
 }

 function flattenTrending(data) {
 var out = [];
 TRIX_API_SECTIONS.forEach(function (key) {
 var arr = data && data[key];
 if (Array.isArray(arr)) {
 arr.forEach(function (item) {
 var t = normalize(item);
 if (t) out.push(t);
 });
 }
 });
 return out;
 }

 function sortByMarketCap(tokens) {
 return tokens.slice().sort(function (a, b) {
 return (b.marketCap || 0) - (a.marketCap || 0);
 });
 }

 function getTopByMarketCap(limit) {
 return sortByMarketCap(catalog).slice(0, limit || 3);
 }

 async function fetchTrending() {
 var res = await fetch(API_TRENDING, { headers: { Accept: 'application/json' } });
 if (!res.ok) throw new Error('Trix trending HTTP ' + res.status);
 return flattenTrending(await res.json());
 }

 async function searchTokens(query) {
 var q = (query || '').trim();
 if (!q || q.length < 2) return [];
 var res = await fetch(API_SEARCH + '?q=' + encodeURIComponent(q), {
 headers: { Accept: 'application/json' }
 });
 if (!res.ok) throw new Error('Trix search HTTP ' + res.status);
 var data = await res.json();
 var tokens = Array.isArray(data.tokens) ? data.tokens : [];
 return withPinned(dedupe(tokens.map(normalize).filter(Boolean)));
 }

 function getPinnedToken() {
 var cfg = window.FTWR_CONFIG;
 if (!cfg) return null;
 var mint = (cfg.trixMint || '').trim();
 if (!mint) return null;
 return normalize({
 mint: mint,
 symbol: (cfg.symbol || 'DOSWAPZ').replace(/^\$/, ''),
 name: cfg.name || 'DOSWAPZ',
 decimals: typeof cfg.trixMintDecimals === 'number' ? cfg.trixMintDecimals : null,
 source: 'pinned'
 });
 }

 function withPinned(tokens) {
 var pinned = getPinnedToken();
 if (!pinned) return dedupe(tokens);
 var rest = tokens.filter(function (t) { return t.mint !== pinned.mint; });
 return [pinned].concat(rest);
 }

 async function refreshCatalog(force) {
 if (!force) {
 var cached = readCache();
 if (cached && cached.length) {
 catalog = cached;
 lastFetch = Date.now();
 return catalog;
 }
 }

 if (fetchPromise) return fetchPromise;

 fetchPromise = fetchTrending()
 .then(function (tokens) {
 catalog = sortByMarketCap(withPinned(dedupe(tokens)));
 lastFetch = Date.now();
 writeCache(catalog);
 return catalog;
 })
 .catch(function (err) {
 var cached = readCache();
 if (cached && cached.length) {
 catalog = cached;
 return catalog;
 }
 throw err;
 })
 .finally(function () {
 fetchPromise = null;
 });

 return fetchPromise;
 }

 function getCatalog() {
 return sortByMarketCap(catalog);
 }

 function findByMint(mint) {
 if (!mint) return null;
 return catalog.find(function (t) { return t.mint === mint; }) || null;
 }

 function findBySymbol(symbol) {
 if (!symbol) return null;
 var s = symbol.toUpperCase();
 return catalog.find(function (t) { return t.symbol === s; }) || null;
 }

 return {
 normalize: normalize,
 refreshCatalog: refreshCatalog,
 searchTokens: searchTokens,
 getCatalog: getCatalog,
 getPinnedToken: getPinnedToken,
 withPinned: withPinned,
 findByMint: findByMint,
 findBySymbol: findBySymbol,
 getTopByMarketCap: getTopByMarketCap,
 sortByMarketCap: sortByMarketCap
 };
})();