/* DOSWAPZ - The Attic drop board (JSON-driven)
 * Launch prep: prefers static JSON. Optional API when:
 *   window.DOSWAPZ_ATTIC_DROPS_USE_API === true
 *   or ?dropsApi=1 on the attic URL
 * Live retailer polling is server-side only (ATTIC_DROPS_LIVE) — not here.
 */
window.DOSWAPZ_ATTIC_DROPS = (function () {
 'use strict';

 var DATA_URL = '/assets/data/attic-drops.json';
 var API_URL = '/api/attic-drops';
 var STORAGE_KEY = 'doswapz-attic-watch';

 var STATUS_LABEL = {
 live: 'LIVE',
 preorder: 'PREORDER',
 upcoming: 'UPCOMING',
 soldout: 'SOLD OUT'
 };

 var CAT_LABEL = {
 sports: 'SPORTS',
 pokemon: 'POKÉMON',
 other: 'OTHER'
 };

 var state = {
 products: [],
 updated: '',
 filter: 'all',
 watched: {}
 };

 function $(id) {
 return document.getElementById(id);
 }

 function escapeHtml(str) {
 return String(str == null ? '' : str)
 .replace(/&/g, '&amp;')
 .replace(/</g, '&lt;')
 .replace(/>/g, '&gt;')
 .replace(/"/g, '&quot;');
 }

 function loadWatch() {
 try {
 state.watched = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
 } catch (e) {
 state.watched = {};
 }
 }

 function saveWatch() {
 try {
 localStorage.setItem(STORAGE_KEY, JSON.stringify(state.watched));
 } catch (e) { /* ignore */ }
 }

 function setCount(msg) {
 var el = $('countLabel');
 if (el) el.textContent = msg;
 }

 function setLiveBanner(liveCount, updated) {
 var el = $('dropLiveMeta');
 if (!el) return;
 var parts = [];
 if (state.liveTracking) {
 parts.push('<span class="live">● TRACKER ARMED</span>');
 } else if (useApi()) {
 parts.push('board API (prep)');
 } else {
 parts.push('manual board');
 }
 if (liveCount > 0) {
 parts.push('<span class="live">● LIVE</span> ' + liveCount + ' product' + (liveCount === 1 ? '' : 's') + ' flagged in-stock');
 } else {
 parts.push('product drops &amp; release links');
 }
 if (updated) {
 parts.push('<span style="color:var(--green-dim)">board updated ' + escapeHtml(updated) + '</span>');
 }
 el.innerHTML = parts.join(' * ');
 }

 function filtered() {
 return state.products.filter(function (p) {
 if (state.filter === 'all') return true;
 if (state.filter === 'live') return p.status === 'live';
 return p.cat === state.filter;
 });
 }

 function render() {
 var grid = $('dropGrid');
 if (!grid) return;

 var list = filtered();
 setCount(list.length + ' product' + (list.length === 1 ? '' : 's'));

 if (!list.length) {
 grid.innerHTML =
 '<div class="feed-empty" style="grid-column:1/-1">NO DROPS MATCH THIS FILTER - EDIT attic-drops.json</div>';
 return;
 }

 grid.innerHTML = list.map(function (p) {
 var cat = CAT_LABEL[p.cat] || 'OTHER';
 var st = STATUS_LABEL[p.status] || String(p.status || '').toUpperCase();
 var links = (p.links || []).map(function (l) {
 var href = l.href || '#';
 return (
 '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer"' +
 (l.dim ? ' class="dim"' : '') + '>' +
 escapeHtml(l.label || 'LINK') +
 '</a>'
 );
 }).join('');

 var on = state.watched[p.id] ? ' on' : '';
 return (
 '<article class="drop-card" data-status="' + escapeHtml(p.status) + '" data-cat="' + escapeHtml(p.cat) + '">' +
 '<div class="drop-top">' +
 '<span class="badge cat-' + escapeHtml(p.cat) + '">' + cat + '</span>' +
 '<span class="badge st-' + escapeHtml(p.status) + '">' + st + '</span>' +
 '</div>' +
 '<div class="drop-title">' + escapeHtml(p.title) + '</div>' +
 '<div class="drop-meta"><strong>' + escapeHtml(p.brand) + '</strong> * ' + escapeHtml(p.date) + '</div>' +
 '<div class="drop-meta">MSRP ' + escapeHtml(p.msrp) + ' * ' + escapeHtml(p.note) + '</div>' +
 '<div class="drop-links">' + links + '</div>' +
 '<button type="button" class="watch-btn' + on + '" data-id="' + escapeHtml(p.id) + '">' +
 (state.watched[p.id] ? '[ ★ WATCHING ]' : '[ + WATCH ]') +
 '</button>' +
 '</article>'
 );
 }).join('');

 grid.querySelectorAll('.watch-btn').forEach(function (btn) {
 btn.addEventListener('click', function () {
 var id = btn.getAttribute('data-id');
 if (!id) return;
 state.watched[id] = !state.watched[id];
 saveWatch();
 render();
 });
 });
 }

 function bindFilters() {
 document.querySelectorAll('.filter-btn[data-filter]').forEach(function (btn) {
 btn.addEventListener('click', function () {
 document.querySelectorAll('.filter-btn[data-filter]').forEach(function (b) {
 b.classList.remove('active');
 });
 btn.classList.add('active');
 state.filter = btn.getAttribute('data-filter') || 'all';
 render();
 });
 });
 }

 function bindNotify() {
 var b = $('toggleNotify');
 if (!b) return;
 b.addEventListener('click', function () {
 if (b.dataset.on === '1') {
 b.dataset.on = '0';
 b.textContent = '[ ENABLE BROWSER ALERTS ]';
 return;
 }
 if (!('Notification' in window)) {
 alert('Browser notifications not supported here.');
 return;
 }
 Notification.requestPermission().then(function (perm) {
 if (perm === 'granted') {
 b.dataset.on = '1';
 b.textContent = '[ ALERTS ON ]';
 new Notification('DOSWAPZ The Attic', {
 body: 'Watchlist ready - you will get pings when products go LIVE (browser demo).'
 });
 } else {
 alert('Permission denied.');
 }
 });
 });
 }

 function normalizeProduct(raw) {
 if (!raw || !raw.id || !raw.title) return null;
 var cat = raw.cat === 'sports' || raw.cat === 'pokemon' || raw.cat === 'other' ? raw.cat : 'other';
 var status = raw.status;
 if (['live', 'preorder', 'upcoming', 'soldout'].indexOf(status) === -1) {
 status = 'upcoming';
 }
 return {
 id: String(raw.id),
 cat: cat,
 status: status,
 title: String(raw.title),
 brand: String(raw.brand || ''),
 date: String(raw.date || ''),
 msrp: String(raw.msrp || ' - '),
 note: String(raw.note || ''),
 links: Array.isArray(raw.links) ? raw.links : []
 };
 }

 function useApi() {
 if (window.DOSWAPZ_ATTIC_DROPS_USE_API === true) return true;
 if (window.DOSWAPZ_ATTIC_DROPS_USE_API === false) return false;
 try {
 var q = new URLSearchParams(window.location.search || '');
 if (q.get('dropsApi') === '1') return true;
 } catch (e) { /* ignore */ }
 return false; // default: static JSON (current production behavior)
 }

 async function fetchBoard() {
 if (useApi()) {
 var apiRes = await fetch(API_URL + '?v=' + Date.now(), { cache: 'no-store' });
 if (apiRes.ok) return apiRes.json();
 // fall through to static if API not deployed yet
 }
 var url = DATA_URL + (DATA_URL.indexOf('?') >= 0 ? '&' : '?') + 'v=' + Date.now();
 var res = await fetch(url, { cache: 'no-store' });
 if (!res.ok) throw new Error('Could not load drop board (' + res.status + ')');
 return res.json();
 }

 async function loadData() {
 setCount('Loading...');
 var data = await fetchBoard();
 var list = Array.isArray(data.products) ? data.products : [];
 state.products = list.map(normalizeProduct).filter(Boolean);
 state.updated = data.updated ? String(data.updated) : '';
 state.liveTracking = !!data.liveTracking;
 state.prepOnly = data.prepOnly !== false && !data.liveTracking;

 var liveCount = state.products.filter(function (p) { return p.status === 'live'; }).length;
 setLiveBanner(liveCount, state.updated);
 render();
 }

 function init() {
 loadWatch();
 bindFilters();
 bindNotify();
 loadData().catch(function (err) {
 setCount('Load failed');
 var grid = $('dropGrid');
 if (grid) {
 grid.innerHTML =
 '<div class="feed-empty" style="grid-column:1/-1;color:#ff6666">' +
 escapeHtml(err && err.message ? err.message : 'Load failed') +
 '<br><span style="color:var(--green-dim)">Check /assets/data/attic-drops.json</span></div>';
 }
 });
 }

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', init);
 } else {
 init();
 }

 return {
 reload: loadData,
 getProducts: function () { return state.products.slice(); }
 };
})();
