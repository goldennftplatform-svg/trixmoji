/* DOSWAPZ - live price ticker: majors + every swap-dropdown token (VB + Trix) */
(function () {
 'use strict';

 var REFRESH_MS_DESKTOP = 5 * 60 * 1000;
 var REFRESH_MS_MOBILE = 8 * 60 * 1000; /* slightly slower on phones - battery / data */
 var BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
 var STABLE_QUOTES = { USDC: true, USDT: true };

 var timer = null;
 var seq = 0;
 var swapStatsPromise = null;
 var touchBound = false;

 function $(id) {
 return document.getElementById(id);
 }

 function isMobileUi() {
 try {
 return window.matchMedia('(max-width: 700px), (pointer: coarse)').matches;
 } catch (e) {
 return (window.innerWidth || 0) <= 700;
 }
 }

 function prefersReducedMotion() {
 try {
 return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 } catch (e) {
 return false;
 }
 }

 function saveDataMode() {
 try {
 var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
 if (!c) return false;
 if (c.saveData) return true;
 var t = String(c.effectiveType || '');
 return t === 'slow-2g' || t === '2g';
 } catch (e) {
 return false;
 }
 }

 function refreshInterval() {
 return isMobileUi() || saveDataMode() ? REFRESH_MS_MOBILE : REFRESH_MS_DESKTOP;
 }

 function ensureSwapStats() {
 if (window.DOSWAPZ_SWAP_STATS) return Promise.resolve();
 if (swapStatsPromise) return swapStatsPromise;
 swapStatsPromise = new Promise(function (resolve) {
 var script = document.createElement('script');
 script.src = '/assets/js/core/swap-stats.js';
 script.onload = resolve;
 script.onerror = resolve;
 document.body.appendChild(script);
 });
 return swapStatsPromise;
 }

 function fmtUsd(price) {
 var n = Number(price);
 if (!isFinite(n)) return ' - ';
 if (n >= 1000) {
 return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
 }
 if (n >= 1) {
 return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
 }
 if (n >= 0.0001) {
 return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
 }
 return '$' + n.toExponential(2);
 }

 function fmtUsdc(price) {
 var n = Number(price);
 if (!isFinite(n)) return ' - ';
 if (n >= 1000) {
 return n.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' USDC';
 }
 if (n >= 1) {
 return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDC';
 }
 if (n >= 0.0001) {
 return n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 }) + ' USDC';
 }
 return n.toExponential(2) + ' USDC';
 }

 function fmtChange(pct) {
 if (pct == null || !isFinite(Number(pct))) return '';
 var n = Number(pct);
 var sign = n >= 0 ? '+' : '';
 return sign + n.toFixed(2) + '%';
 }

 function changeClass(pct) {
 if (pct == null || !isFinite(Number(pct))) return '';
 return Number(pct) >= 0 ? 'up' : 'down';
 }

 function worldStateItemHtml(label, status, tag) {
 var tagHtml = tag ? '<span class="ticker-tag">' + tag + '</span>' : '';
 return (
 '<span class="ticker-item ticker-world">' +
 tagHtml +
 '<span class="ticker-symbol">' +
 label +
 '</span> ' +
 '<span class="ticker-price">' +
 status +
 '</span></span>'
 );
 }

 function itemHtml(label, price, change, tag, quote, href) {
 var mobile = isMobileUi();
 var ch = fmtChange(change);
 var cls = changeClass(change);
 // Tags are hidden via CSS on mobile; skip DOM for smaller HTML payload
 var tagHtml = !mobile && tag ? '<span class="ticker-tag">' + tag + '</span>' : '';
 var hasPrice = price != null && isFinite(Number(price));
 var priceText = hasPrice
 ? (quote === 'USDC' ? fmtUsdc(price) : fmtUsd(price))
 : ' - ';
 // On phones, keep % change short (no trailing noise)
 var chHtml = '';
 if (ch) {
 if (mobile && ch.length > 8) {
 // e.g. +3577.00% -> +3577%
 ch = ch.replace(/\.00%/, '%').replace(/(\.\d)%/, '%');
 }
 chHtml = '<span class="ticker-change ' + cls + '">' + ch + '</span>';
 }
 var inner =
 tagHtml +
 '<span class="ticker-symbol">' + label + '</span> ' +
 '<span class="ticker-price">' + priceText + '</span>' +
 chHtml;
 if (href) {
 return (
 '<a class="ticker-item" href="' + href + '" target="_blank" rel="noopener noreferrer">' +
 inner +
 '</a>'
 );
 }
 return '<span class="ticker-item">' + inner + '</span>';
 }

 function isStableQuote(symbol) {
 return STABLE_QUOTES[(symbol || '').toUpperCase()];
 }

 function pickBestPair(pairs, preferStable) {
 if (!pairs || !pairs.length) return null;
 var list = pairs.slice();
 if (preferStable) {
 var stable = list.filter(function (p) {
 return isStableQuote(p.quoteToken && p.quoteToken.symbol);
 });
 if (stable.length) list = stable;
 }
 list.sort(function (a, b) {
 return (b.liquidity && b.liquidity.usd ? b.liquidity.usd : 0) -
 (a.liquidity && a.liquidity.usd ? a.liquidity.usd : 0);
 });
 return list[0] || null;
 }

 function pairToQuote(pair, solUsdcPrice) {
 if (!pair) return null;
 var quoteSym = (pair.quoteToken && pair.quoteToken.symbol || '').toUpperCase();
 if (isStableQuote(quoteSym)) {
 var price = Number(pair.priceNative);
 if (!isFinite(price) || price <= 0) price = Number(pair.priceUsd);
 return {
 price: price,
 change: pair.priceChange && pair.priceChange.h24 != null ? pair.priceChange.h24 : null,
 quote: 'USDC'
 };
 }
 if (quoteSym === 'SOL' && solUsdcPrice != null && isFinite(Number(solUsdcPrice))) {
 var solPer = Number(pair.priceNative);
 if (isFinite(solPer) && solPer > 0) {
 return {
 price: solPer * Number(solUsdcPrice),
 change: pair.priceChange && pair.priceChange.h24 != null ? pair.priceChange.h24 : null,
 quote: 'USDC'
 };
 }
 }
 var usd = Number(pair.priceUsd);
 if (isFinite(usd) && usd > 0) {
 return {
 price: usd,
 change: pair.priceChange && pair.priceChange.h24 != null ? pair.priceChange.h24 : null,
 quote: 'USD'
 };
 }
 return null;
 }

 async function fetchCoinGecko() {
 var url =
 'https://api.coingecko.com/api/v3/simple/price' +
 '?ids=bitcoin,ethereum,solana,tether,usd-coin,bonk' +
 '&vs_currencies=usd&include_24hr_change=true';
 var res = await fetch(url, { headers: { Accept: 'application/json' } });
 if (!res.ok) throw new Error('CoinGecko HTTP ' + res.status);
 return res.json();
 }

 async function fetchDexPairs(mintOrAddr) {
 var res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + mintOrAddr);
 if (!res.ok) throw new Error('DexScreener HTTP ' + res.status);
 var data = await res.json();
 return data.pairs || [];
 }

 /** Batch up to 30 addresses per DexScreener request. Returns map mint(lower)->pairs[] */
 async function fetchDexPairsBatch(mints) {
 var map = {};
 var unique = [];
 var seen = {};
 (mints || []).forEach(function (m) {
 if (!m) return;
 var k = String(m).toLowerCase();
 if (seen[k]) return;
 seen[k] = true;
 unique.push(m);
 });

 for (var i = 0; i < unique.length; i += 30) {
 var chunk = unique.slice(i, i + 30);
 try {
 var res = await fetch(
 'https://api.dexscreener.com/latest/dex/tokens/' + chunk.join(',')
 );
 if (!res.ok) continue;
 var data = await res.json();
 var pairs = data.pairs || [];
 pairs.forEach(function (p) {
 var base = p.baseToken && p.baseToken.address;
 if (!base) return;
 var key = String(base).toLowerCase();
 if (!map[key]) map[key] = [];
 map[key].push(p);
 });
 } catch (e) {}
 }
 return map;
 }

 async function fetchJsonSafe(url) {
 var res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
 if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
 return res.json();
 }

 async function loadVantablackCoins() {
 var coins = [];
 try {
 var api = await fetchJsonSafe('/api/vantablack-coins');
 if (api && Array.isArray(api.coins)) coins = coins.concat(api.coins);
 } catch (e) {}
 try {
 var bundled = await fetchJsonSafe('/assets/data/vantablack-coins.json');
 if (bundled && Array.isArray(bundled.coins)) coins = coins.concat(bundled.coins);
 } catch (e) {}

 var seen = {};
 var out = [];
 coins.forEach(function (c) {
 if (!c || !c.mint) return;
 var key = String(c.mint).toLowerCase();
 if (seen[key]) return;
 seen[key] = true;
 out.push({
 mint: c.mint,
 symbol: String(c.symbol || 'TOKEN').replace(/^\$/, '').toUpperCase(),
 name: c.name || c.symbol || 'TOKEN',
 chain: String(c.chain || 'solana').toLowerCase(),
 section: String(c.section || '').toLowerCase(),
 source: 'vantablack'
 });
 });
 return out;
 }

 async function loadTrixTokens() {
 // Prefer same catalog the swap page uses via our proxy (full list)
 try {
 var data = await fetchJsonSafe('/api/trix-ticker');
 if (data && Array.isArray(data.tokens) && data.tokens.length) {
 return data.tokens.map(function (t) {
 return {
 mint: t.mint,
 symbol: String(t.symbol || 'TOKEN').replace(/^\$/, '').toUpperCase(),
 name: t.name || t.symbol || 'TOKEN',
 price: typeof t.price === 'number' ? t.price : null,
 change24h: typeof t.change24h === 'number' ? t.change24h : null,
 marketCap: typeof t.marketCap === 'number' ? t.marketCap : null,
 source: 'trix'
 };
 });
 }
 } catch (e) {}

 // Fallback: static seed
 try {
 var bundled = await fetchJsonSafe('/assets/data/trix-ticker.json');
 if (bundled && Array.isArray(bundled.tokens)) {
 return bundled.tokens.map(function (t) {
 return {
 mint: t.mint,
 symbol: String(t.symbol || 'TOKEN').replace(/^\$/, '').toUpperCase(),
 name: t.name || t.symbol || 'TOKEN',
 price: typeof t.price === 'number' ? t.price : null,
 change24h: typeof t.change24h === 'number' ? t.change24h : null,
 marketCap: typeof t.marketCap === 'number' ? t.marketCap : null,
 source: 'trix'
 };
 });
 }
 } catch (e2) {}

 // Last resort: client catalog if swap page already loaded it
 if (window.DOSWAPZ_TRIX && typeof window.DOSWAPZ_TRIX.getCatalog === 'function') {
 try {
 if (typeof window.DOSWAPZ_TRIX.refreshCatalog === 'function') {
 await window.DOSWAPZ_TRIX.refreshCatalog(false);
 }
 return (window.DOSWAPZ_TRIX.getCatalog() || []).map(function (t) {
 return {
 mint: t.mint,
 symbol: String(t.symbol || 'TOKEN').replace(/^\$/, '').toUpperCase(),
 name: t.name || t.symbol || 'TOKEN',
 price: typeof t.price === 'number' ? t.price : null,
 change24h: typeof t.change24h === 'number' ? t.change24h : null,
 marketCap: typeof t.marketCap === 'number' ? t.marketCap : null,
 source: 'trix'
 };
 });
 } catch (e3) {}
 }
 return [];
 }

 function appendWorldState(items) {
 // Mobile: one compact SYS chip only - more room for real token prices
 if (isMobileUi()) {
 items.push(worldStateItemHtml('DOSWAPZ', 'LIVE', 'SYS'));
 return;
 }

 items.push(worldStateItemHtml('DOSWAPZ NODE', 'ONLINE', 'SYS'));

 var glitch = 'NORMAL';
 try {
 glitch = localStorage.getItem('doswapz_glitch_level') || 'NORMAL';
 } catch (e) {}
 items.push(worldStateItemHtml('GLITCH', glitch, 'FX'));

 var pondRail = 'JUPITER';
 try {
 pondRail = (localStorage.getItem('doswapz_swap_rail') || 'jupiter').toUpperCase();
 } catch (e) {}
 items.push(worldStateItemHtml('SWAP RAIL', pondRail, 'ROUTE'));

 if (window.DOSWAPZ_SHELL && typeof window.DOSWAPZ_SHELL.getLastBoot === 'function') {
 var last = window.DOSWAPZ_SHELL.getLastBoot();
 if (last) {
 var short = last.split('/').filter(Boolean).pop() || 'HUB';
 items.push(worldStateItemHtml('LAST BOOT', short.replace('.html', '').toUpperCase(), 'MEM'));
 }
 }
 }

 function dexscreenerHref(mint) {
 if (!mint) return null;
 return 'https://dexscreener.com/search?q=' + encodeURIComponent(mint);
 }

 async function buildTickerItems() {
 var items = [];
 var solUsdc = null;
 var seenMints = {};
 var seenSymbols = {};

 function mark(mint, symbol) {
 if (mint) seenMints[String(mint).toLowerCase()] = true;
 if (symbol) seenSymbols[String(symbol).replace(/^\$/, '').toUpperCase()] = true;
 }

 function already(mint, symbol) {
 if (mint && seenMints[String(mint).toLowerCase()]) return true;
 if (symbol && seenSymbols[String(symbol).replace(/^\$/, '').toUpperCase()]) return true;
 return false;
 }

 appendWorldState(items);

 // ── Majors / base dropdown tokens (SOL, USDC, BONK + majors) ──
 try {
 var cg = await fetchCoinGecko();
 if (cg['usd-coin']) {
 items.push(itemHtml('$USDC', cg['usd-coin'].usd, cg['usd-coin'].usd_24h_change, 'STABLE'));
 mark(null, 'USDC');
 }
 if (cg.tether) {
 items.push(itemHtml('$USDT', cg.tether.usd, cg.tether.usd_24h_change, 'STABLE'));
 mark(null, 'USDT');
 }
 if (cg.solana) {
 items.push(itemHtml('$SOL', cg.solana.usd, cg.solana.usd_24h_change, 'SOLANA'));
 solUsdc = cg.solana.usd;
 mark('So11111111111111111111111111111111111111112', 'SOL');
 }
 if (cg.bonk) {
 items.push(itemHtml('$BONK', cg.bonk.usd, cg.bonk.usd_24h_change, 'BASE'));
 mark(BONK_MINT, 'BONK');
 }
 if (cg.bitcoin) {
 items.push(itemHtml('$BTC', cg.bitcoin.usd, cg.bitcoin.usd_24h_change, 'MAJOR'));
 mark(null, 'BTC');
 }
 if (cg.ethereum) {
 items.push(itemHtml('$ETH', cg.ethereum.usd, cg.ethereum.usd_24h_change, 'MAJOR'));
 mark(null, 'ETH');
 }
 } catch (e) {}

 // ── Vantablack catalog (same tokens available in swap dropdown) ──
 var vbCoins = [];
 try {
 vbCoins = await loadVantablackCoins();
 } catch (e) {}

 // Price via DexScreener batch for all VB mints (eth + sol)
 var vbMints = vbCoins.map(function (c) { return c.mint; });
 var vbPairMap = {};
 try {
 vbPairMap = await fetchDexPairsBatch(vbMints);
 } catch (e) {}

 vbCoins.forEach(function (c) {
 if (already(c.mint, c.symbol)) return;
 var pairs = vbPairMap[String(c.mint).toLowerCase()] || [];
 var q = pairToQuote(pickBestPair(pairs, true) || pickBestPair(pairs, false), solUsdc);
 var tag = c.section === 'main' ? 'VB MAIN' : 'VANTABLACK';
 if (c.chain === 'ethereum') tag = 'POND';
 items.push(
 itemHtml(
 '$' + c.symbol,
 q ? q.price : null,
 q ? q.change : null,
 tag,
 q ? q.quote : 'USDC',
 dexscreenerHref(c.mint)
 )
 );
 mark(c.mint, c.symbol);
 });

 // ── Trix Market (full list matching swap dropdown) ──
 var trixTokens = [];
 try {
 trixTokens = await loadTrixTokens();
 } catch (e) {}

 // Fill missing prices via DexScreener for Trix tokens without price.
 // On save-data / 2G phones: skip extra Dex calls (use Trix API prices only).
 var trixPairMap = {};
 if (!saveDataMode()) {
 var trixNeedPrice = trixTokens
 .filter(function (t) {
 return t.mint && (t.price == null || !isFinite(t.price));
 })
 .map(function (t) { return t.mint; });

 // Cap batch size on mobile to reduce radio wake-ups
 if (isMobileUi() && trixNeedPrice.length > 24) {
 trixNeedPrice = trixNeedPrice.slice(0, 24);
 }

 if (trixNeedPrice.length) {
 try {
 trixPairMap = await fetchDexPairsBatch(trixNeedPrice);
 } catch (e) {}
 }
 }

 // Sort: priced first by mcap, then rest
 trixTokens = trixTokens.slice().sort(function (a, b) {
 return (b.marketCap || 0) - (a.marketCap || 0);
 });

 trixTokens.forEach(function (t) {
 if (already(t.mint, t.symbol)) return;
 var price = t.price;
 var change = t.change24h;
 if (price == null || !isFinite(price)) {
 var pairs = trixPairMap[String(t.mint).toLowerCase()] || [];
 var q = pairToQuote(pickBestPair(pairs, true) || pickBestPair(pairs, false), solUsdc);
 if (q) {
 price = q.price;
 change = q.change;
 }
 }
 items.push(
 itemHtml(
 '$' + t.symbol,
 price,
 change,
 'TRIX',
 'USD',
 dexscreenerHref(t.mint)
 )
 );
 mark(t.mint, t.symbol);
 });

 // ── Platform swap counter ──
 try {
 await ensureSwapStats();
 if (window.DOSWAPZ_SWAP_STATS) {
 if (typeof window.DOSWAPZ_SWAP_STATS.refresh === 'function') {
 await window.DOSWAPZ_SWAP_STATS.refresh(true);
 }
 if (typeof window.DOSWAPZ_SWAP_STATS.getTotal === 'function') {
 var swapTotal = await window.DOSWAPZ_SWAP_STATS.getTotal();
 if (window.DOSWAPZ_SWAP_STATS.tickerItemHtml) {
 items.push(window.DOSWAPZ_SWAP_STATS.tickerItemHtml(swapTotal));
 }
 }
 }
 } catch (e) {}

 return { items: items, tokenCount: items.length };
 }

 function renderTrack(items) {
 var track = $('priceTickerTrack');
 if (!track || !items.length) return;

 var sep = '<span class="ticker-sep">///</span>';
 var html = items.join(sep);
 // Duplicate for seamless loop - long catalogs still scroll continuously
 track.innerHTML = html + sep + html;

 // Speed scales with item count so phones finish a full loop in a sensible time
 if (!prefersReducedMotion()) {
 var n = Math.max(items.length, 8);
 var mobile = isMobileUi();
 // ~2.2s per item desktop, ~1.6s mobile; clamp range
 var sec = Math.round(n * (mobile ? 1.6 : 2.2));
 sec = Math.max(mobile ? 55 : 70, Math.min(mobile ? 140 : 200, sec));
 track.style.animationDuration = sec + 's';
 } else {
 track.style.animationDuration = '0s';
 }
 }

 function formatStatusTime() {
 try {
 if (isMobileUi()) {
 return new Date().toLocaleTimeString(undefined, {
 hour: 'numeric',
 minute: '2-digit'
 });
 }
 } catch (e) {}
 return new Date().toLocaleTimeString();
 }

 function bindTouchPause(bar) {
 if (touchBound || !bar) return;
 touchBound = true;
 var track = null;
 function getTrack() {
 return track || (track = $('priceTickerTrack'));
 }
 function pause() {
 var t = getTrack();
 if (t) t.classList.add('is-paused');
 }
 function resume() {
 var t = getTrack();
 if (t) t.classList.remove('is-paused');
 }
 // Pause while finger is down so users can read / tap a token
 bar.addEventListener('touchstart', pause, { passive: true });
 bar.addEventListener('touchend', resume, { passive: true });
 bar.addEventListener('touchcancel', resume, { passive: true });
 // Desktop / stylus
 bar.addEventListener('mouseenter', pause);
 bar.addEventListener('mouseleave', resume);
 }

 async function refresh() {
 var mySeq = ++seq;
 var status = $('priceTickerStatus');
 if (status) status.textContent = 'SYNCING...';

 try {
 var result = await buildTickerItems();
 if (mySeq !== seq) return;
 renderTrack(result.items);
 if (status) {
 var swapNote = '';
 var nTokens = 0;
 try {
 nTokens = result.items.filter(function (html) {
 return html.indexOf('ticker-symbol') >= 0 &&
 html.indexOf('DOSWAPZ NODE') < 0 &&
 html.indexOf('ticker-symbol">DOSWAPZ') < 0 &&
 html.indexOf('GLITCH') < 0 &&
 html.indexOf('SWAP RAIL') < 0 &&
 html.indexOf('LAST BOOT') < 0 &&
 html.indexOf('>SWAPS<') < 0 &&
 html.indexOf('ticker-symbol">SWAPS') < 0;
 }).length;
 } catch (e) {}
 try {
 if (window.DOSWAPZ_SWAP_STATS) {
 var swapN = await window.DOSWAPZ_SWAP_STATS.getTotal();
 if (isFinite(Number(swapN))) swapNote = ' * SWAPS ' + swapN;
 }
 } catch (e) {}
 status.textContent =
 'LIVE * ' +
 (nTokens ? nTokens + ' TKN * ' : '') +
 formatStatusTime() +
 swapNote;
 }
 } catch (err) {
 if (status) status.textContent = 'TICKER OFFLINE';
 }
 }

 function ensureTickerDom() {
 if ($('priceTickerBar')) return $('priceTickerBar');

 document.body.classList.add('has-doswapz-ticker');
 if (isMobileUi()) document.body.classList.add('is-mobile-ticker');

 var bar = document.createElement('div');
 bar.className = 'price-ticker-bar';
 bar.id = 'priceTickerBar';
 bar.setAttribute('aria-label', 'Live price ticker');
 bar.setAttribute('role', 'region');
 bar.innerHTML =
 '<div class="price-ticker-inner">' +
 '<div class="price-ticker-label">' + (isMobileUi() ? 'TICKER' : 'LIVE TICKER') + '</div>' +
 '<div class="price-ticker-status" id="priceTickerStatus">LOADING...</div>' +
 '<div class="price-ticker-viewport">' +
 '<div class="price-ticker-track" id="priceTickerTrack"></div>' +
 '</div>' +
 '</div>';

 document.body.appendChild(bar);
 bindTouchPause(bar);
 return bar;
 }

 function init() {
 // Skip ticker on pure splash if desired - currently show everywhere except when body opts out
 if (document.body && document.body.dataset.noTicker === '1') return;

 // Early smooth flags if shell-boot hasn't run yet
 try {
 document.documentElement.classList.add('dos-smooth');
 if (document.body) {
 document.body.classList.add('dos-smooth');
 if (isMobileUi() || saveDataMode()) {
 document.documentElement.classList.add('dos-perf-lite');
 document.body.classList.add('dos-perf-lite');
 }
 }
 } catch (e) {}

 ensureTickerDom();
 refresh();
 timer = setInterval(function () {
 if (!document.hidden) refresh();
 }, refreshInterval());
 document.addEventListener('visibilitychange', function () {
 if (!document.hidden) refresh();
 });
 // Re-layout when rotating phone / resizing
 var resizeTimer = null;
 window.addEventListener('resize', function () {
 if (resizeTimer) clearTimeout(resizeTimer);
 resizeTimer = setTimeout(function () {
 var bar = $('priceTickerBar');
 if (!bar) return;
 var label = bar.querySelector('.price-ticker-label');
 if (label) label.textContent = isMobileUi() ? 'TICKER' : 'LIVE TICKER';
 document.body.classList.toggle('is-mobile-ticker', isMobileUi());
 var track = $('priceTickerTrack');
 if (track && !prefersReducedMotion()) {
 var n = Math.max(8, Math.floor(track.querySelectorAll('.ticker-item').length / 2) || 8);
 var mobile = isMobileUi();
 var sec = Math.round(n * (mobile ? 1.6 : 2.2));
 sec = Math.max(mobile ? 55 : 70, Math.min(mobile ? 140 : 200, sec));
 track.style.animationDuration = sec + 's';
 }
 }, 250);
 });
 window.addEventListener('beforeunload', function () {
 if (timer) clearInterval(timer);
 });
 }

 window.DOSWAPZ_TICKER = { refresh: refresh };

 function loadDosShell() {
 function inject(src, attr) {
 if (document.querySelector('script[' + attr + ']')) return;
 var s = document.createElement('script');
 s.src = src;
 s.setAttribute(attr, '1');
 document.body.appendChild(s);
 }
 inject('/assets/js/core/docs-footer.js', 'data-docs-footer');
 inject('/assets/js/core/shell-boot.js', 'data-shell-boot');
 inject('/assets/js/core/page-transition.js', 'data-page-transition');
 inject('/assets/js/core/system-brownout.js', 'data-system-brownout');
 inject('/assets/js/core/hub-menu.js', 'data-hub-menu');
 }

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', function () {
 init();
 loadDosShell();
 });
 } else {
 init();
 loadDosShell();
 }
})();
