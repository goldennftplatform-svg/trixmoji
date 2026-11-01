/* Vantablack - bonding-curve progress + sparkline charts */
window.DOSWAPZ_VB_CURVE = (function () {
 'use strict';

 var cfg = window.VANTABLACK_CONFIG || {};
 var statsCache = {};
 var statsCacheTs = 0;
 var STATS_TTL_MS = 45000;

 function graduationMcap() {
 return cfg.graduationMcap || 69000;
 }

 function statsApiUrl(mints, types) {
 var base = cfg.statsApiUrl || '/api/vantablack-token-stats';
 var url = base + '?mints=' + encodeURIComponent(mints.join(','));
 if (types && types.length) {
 url += '&types=' + encodeURIComponent(types.join(','));
 }
 return url;
 }

 async function fetchStats(mintsOrCoins, force) {
 var list = [];
 var typePairs = [];

 (mintsOrCoins || []).forEach(function (item) {
 if (!item) return;
 if (typeof item === 'string') {
 list.push(item);
 return;
 }
 if (item.mint) {
 list.push(item.mint);
 if (item.launchType) {
 typePairs.push(item.mint + ':' + item.launchType);
 }
 }
 });

 if (!list.length) return {};

 var now = Date.now();
 if (!force && now - statsCacheTs < STATS_TTL_MS && Object.keys(statsCache).length) {
 var allCached = list.every(function (m) { return statsCache[m]; });
 if (allCached) return statsCache;
 }

 // DexScreener batch limit in API is 24
 var chunks = [];
 for (var i = 0; i < list.length; i += 24) {
 chunks.push(list.slice(i, i + 24));
 }

 try {
 for (var c = 0; c < chunks.length; c++) {
 var chunk = chunks[c];
 var chunkTypes = typePairs.filter(function (p) {
 var mint = p.split(':')[0];
 return chunk.indexOf(mint) >= 0;
 });
 var res = await fetch(statsApiUrl(chunk, chunkTypes), {
 headers: { Accept: 'application/json' },
 cache: 'no-store'
 });
 if (!res.ok) throw new Error('Stats HTTP ' + res.status);
 var data = await res.json();
 (data.stats || []).forEach(function (row) {
 if (row && row.mint) statsCache[row.mint] = row;
 });
 }
 statsCacheTs = now;
 } catch (e) {
 console.warn('vantablack stats', e);
 }

 return statsCache;
 }

 function formatMcap(n) {
 if (n == null || !Number.isFinite(n)) return ' - ';
 if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
 if (n >= 1e3) return '$' + Math.round(n).toLocaleString();
 return '$' + n.toFixed(2);
 }

 function formatPrice(n) {
 if (n == null || !Number.isFinite(n)) return ' - ';
 if (n >= 1) return '$' + n.toFixed(4);
 if (n >= 0.0001) return '$' + n.toFixed(6);
 return '$' + n.toExponential(2);
 }

 function formatUsd(n) {
 if (n == null || !Number.isFinite(n)) return ' - ';
 if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
 if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
 return '$' + n.toFixed(0);
 }

 function curveLabel(curve) {
 if (!curve) return 'UNLISTED';
 if (curve.status === 'graduated') return 'GRADUATED';
 if (curve.status === 'bonding') return 'BONDING CURVE';
 if (curve.status === 'trading') return 'TRADING';
 if (curve.status === 'direct') return 'DIRECT MINT';
 return 'UNLISTED';
 }

 function sparklineSvg(points, color) {
 if (!points || points.length < 2) {
 return '<svg class="vb-spark" viewBox="0 0 120 36" aria-hidden="true"><text x="60" y="20" text-anchor="middle" fill="#555" font-size="10">NO DATA</text></svg>';
 }

 var w = 120;
 var h = 36;
 var pad = 3;
 var vals = points.map(function (p) { return Math.max(0, Number(p.value) || 0); });
 var min = Math.min.apply(null, vals);
 var max = Math.max.apply(null, vals);
 var span = max - min || 1;

 var coords = vals.map(function (v, i) {
 var x = pad + (i / (vals.length - 1)) * (w - pad * 2);
 var y = h - pad - ((v - min) / span) * (h - pad * 2);
 return x.toFixed(1) + ',' + y.toFixed(1);
 });

 var stroke = color || '#ff66cc';
 var fill = stroke + '33';

 return (
 '<svg class="vb-spark" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
 '<polyline fill="none" stroke="' + stroke + '" stroke-width="1.8" points="' + coords.join(' ') + '"/>' +
 '<polygon fill="' + fill + '" points="' + coords.join(' ') + ' ' + (w - pad) + ',' + (h - pad) + ' ' + pad + ',' + (h - pad) + '"/>' +
 '</svg>'
 );
 }

 function progressBarHtml(progress, curve) {
 var pct = progress == null ? 0 : Math.max(0, Math.min(100, progress));
 var label = curveLabel(curve);
 var width = curve && curve.status === 'graduated' ? 100 : pct;
 var text = curve && curve.status === 'graduated'
 ? '100% - GRADUATED'
 : (progress == null ? ' - ' : pct.toFixed(1) + '% TO GRADUATION');

 return (
 '<div class="vb-progress-wrap">' +
 '<div class="vb-progress-meta"><span>' + label + '</span><span>' + text + '</span></div>' +
 '<div class="vb-progress-track"><div class="vb-progress-fill" style="width:' + width + '%"></div></div>' +
 '</div>'
 );
 }

 function applyLaunchHint(coin, row) {
 if (!row || !coin) return row;
 var curve = row.curve || {};
 if (coin.launchType === 'curve' && (!curve.status || curve.status === 'unlisted' || curve.status === 'direct')) {
 var mcap = row.marketCap;
 if (mcap != null && Number.isFinite(mcap)) {
 var progress = Math.min(100, Math.round((mcap / graduationMcap()) * 1000) / 10);
 row = Object.assign({}, row, {
 curve: {
 progress: progress,
 status: progress >= 100 ? 'graduated' : 'bonding',
 dexId: curve.dexId || 'curve',
 graduationTarget: graduationMcap()
 }
 });
 } else {
 row = Object.assign({}, row, {
 curve: {
 progress: 0,
 status: 'bonding',
 dexId: curve.dexId || 'curve',
 graduationTarget: graduationMcap()
 }
 });
 }
 }
 return row;
 }

 function cardStatsBlock(coin, stats) {
 var row = applyLaunchHint(coin, stats && stats[coin.mint]);
 if (!row || !row.ok) {
 return (
 '<div class="vb-stats">' +
 progressBarHtml(null, { status: coin.launchType === 'curve' ? 'bonding' : 'direct' }) +
 sparklineSvg([], '#6633cc') +
 '<div class="vb-mcap">Market cap: - </div>' +
 '<div class="vb-metrics"><span>Price - </span><span>Vol - </span><span>Liq - </span></div>' +
 '</div>'
 );
 }

 var curve = row.curve || {};
 var color = curve.status === 'graduated' ? '#00ff41' : (curve.status === 'bonding' ? '#ff66cc' : '#66ccff');
 var chg = row.change24h != null
 ? ' * 24h <span class="' + (row.change24h >= 0 ? 'up' : 'down') + '">' +
 (row.change24h >= 0 ? '+' : '') + row.change24h.toFixed(1) + '%</span>'
 : '';

 return (
 '<div class="vb-stats">' +
 progressBarHtml(curve.progress, curve) +
 sparklineSvg(row.sparkline, color) +
 '<div class="vb-mcap">MCap ' + formatMcap(row.marketCap) + chg + '</div>' +
 '<div class="vb-metrics">' +
 '<span>Px ' + formatPrice(row.priceUsd) + '</span>' +
 '<span>Vol ' + formatUsd(row.volume24h) + '</span>' +
 '<span>Liq ' + formatUsd(row.liquidity) + '</span>' +
 '</div>' +
 '</div>'
 );
 }

 return {
 fetchStats: fetchStats,
 cardStatsBlock: cardStatsBlock,
 sparklineSvg: sparklineSvg,
 progressBarHtml: progressBarHtml,
 formatMcap: formatMcap,
 formatPrice: formatPrice,
 formatUsd: formatUsd,
 curveLabel: curveLabel,
 graduationMcap: graduationMcap
 };
})();
