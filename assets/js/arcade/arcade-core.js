/**
 * DOSWAPZ Arcade core - shared soft-connect, intro skip, daily seed, boards, share.
 * Soft-connect only: no seed phrases, no fund moves from this module.
 */
(function (global) {
 'use strict';

 // Bump when intro reel changes OR when skip cache must reset for all visitors
 var VIDEO_VERSION = '20260715b';
 var VIDEO_SRC = '/assets/videos/arcade/intro.mp4?v=' + VIDEO_VERSION;
 var INTRO_SEEN_KEY = 'doswapz_arcade_intro_seen';
 var INTRO_VERSION_KEY = 'doswapz_arcade_intro_version';
 var SOFT_KEY = 'doswapzSoftConnect';
 var SOFT_LEGACY = 'tbbSoftConnect';
 var DAILY_KEY = 'doswapz_arcade_daily';

 function lsGet(k, fallback) {
 try {
 var v = localStorage.getItem(k);
 return v == null ? fallback : v;
 } catch (e) {
 return fallback;
 }
 }
 function lsSet(k, v) {
 try { localStorage.setItem(k, v); } catch (e) {}
 }
 function lsJson(k, fallback) {
 try {
 var raw = lsGet(k, null);
 if (!raw) return fallback;
 return JSON.parse(raw);
 } catch (e) {
 return fallback;
 }
 }
 function lsJsonSet(k, obj) {
 try { lsSet(k, JSON.stringify(obj)); } catch (e) {}
 }

 function isOrbit() {
 return location.pathname.indexOf('/orbit/') >= 0;
 }
 function isFuture() {
 return location.pathname.indexOf('/future/') >= 0;
 }
 function era() {
 if (isFuture()) return 'future';
 if (isOrbit()) return 'present';
 return 'past';
 }
 function paths() {
 var e = era();
 if (e === 'present') {
 return {
 era: e,
 hub: '/orbit/hub.html',
 intro: '/orbit/pages/arcade/intro.html',
 arcadeHub: '/orbit/pages/arcade/hub.html',
 preview: '/orbit/pages/arcade/preview.html',
 scores: '/orbit/pages/arcade/scores.html',
 checklist: '/orbit/pages/arcade/smoke-checklist.html',
 badge: 'PRESENT'
 };
 }
 if (e === 'future') {
 return {
 era: e,
 hub: '/future/hub.html',
 intro: '/classic/pages/arcade/intro.html',
 arcadeHub: '/future/pages/arcade.html',
 preview: '/classic/pages/arcade/preview.html',
 scores: '/classic/pages/arcade/scores.html',
 checklist: '/classic/pages/arcade/smoke-checklist.html',
 badge: 'FUTURE'
 };
 }
 return {
 era: e,
 hub: '/classic/hub.html',
 intro: '/classic/pages/arcade/intro.html',
 arcadeHub: '/classic/pages/arcade/hub.html',
 preview: '/classic/pages/arcade/preview.html',
 scores: '/classic/pages/arcade/scores.html',
 checklist: '/classic/pages/arcade/smoke-checklist.html',
 badge: 'PAST'
 };
 }

 // ── Soft connect (shared across arcade games) ───────────
 function normalizeHandle(raw) {
 if (!raw) return '';
 var h = String(raw).trim().replace(/\s+/g, '');
 h = h.replace(/^@+/, '');
 h = h.replace(/[^A-Za-z0-9_]/g, '');
 return h.slice(0, 15);
 }
 function normalizeAlias(raw) {
 var a = String(raw || 'DEGEN').toUpperCase().replace(/[^A-Z0-9_$]/g, '').slice(0, 12);
 return a || 'DEGEN';
 }
 function loadSoftConnect() {
 var data = lsJson(SOFT_KEY, null);
 if (!data || typeof data !== 'object') {
 data = lsJson(SOFT_LEGACY, {}) || {};
 if (data && (data.handle || data.alias)) lsJsonSet(SOFT_KEY, data);
 }
 return data || {};
 }
 function saveSoftConnect(data) {
 var clean = {
 handle: normalizeHandle(data && data.handle),
 alias: normalizeAlias(data && data.alias)
 };
 lsJsonSet(SOFT_KEY, clean);
 // Keep TBB legacy key in sync
 lsJsonSet(SOFT_LEGACY, clean);
 return clean;
 }
 function xSession() {
 try {
 if (global.DOSWAPZ_X && global.DOSWAPZ_X.user && global.DOSWAPZ_X.user.username) {
 return global.DOSWAPZ_X.user;
 }
 } catch (e) {}
 return null;
 }
 function softIdentity() {
 var sc = loadSoftConnect();
 var x = xSession();
 var handle = x ? normalizeHandle(x.username) : normalizeHandle(sc.handle);
 var alias = normalizeAlias(sc.alias);
 return {
 handle: handle,
 alias: alias,
 linked: !!handle,
 verified: !!x,
 tag: handle ? '@' + handle : alias,
 xid: x ? x.id : ''
 };
 }

 // ── Intro skip ──────────────────────────────────────────
 function hasSeenIntro() {
 return lsGet(INTRO_SEEN_KEY, '') === '1' &&
 lsGet(INTRO_VERSION_KEY, '') === VIDEO_VERSION;
 }
 function markIntroSeen() {
 lsSet(INTRO_SEEN_KEY, '1');
 lsSet(INTRO_VERSION_KEY, VIDEO_VERSION);
 }
 function clearIntroSeen() {
 try {
 localStorage.removeItem(INTRO_SEEN_KEY);
 localStorage.removeItem(INTRO_VERSION_KEY);
 } catch (e) {}
 }
 /**
 * Hub entry always opens the intro reel (force=1) so the animation launches.
 * After the reel ends/watches, user lands on hub; "REPLAY INTRO" still works.
 * Pass forceIntro === false only for internal skip-to-hub links.
 */
 function arcadeEntryHref(forceIntro) {
 var p = paths();
 if (forceIntro === false) {
 return hasSeenIntro() ? p.arcadeHub : p.intro;
 }
 // Default / true: always play intro when entering Arcade from a hub
 return p.intro + (p.intro.indexOf('?') >= 0 ? '&' : '?') + 'force=1';
 }

 // ── Daily seed / challenge ──────────────────────────────
 function dayKey(d) {
 d = d || new Date();
 var y = d.getUTCFullYear();
 var m = String(d.getUTCMonth() + 1).padStart(2, '0');
 var day = String(d.getUTCDate()).padStart(2, '0');
 return y + '-' + m + '-' + day;
 }
 function hashSeed(str) {
 var h = 2166136261;
 for (var i = 0; i < str.length; i++) {
 h ^= str.charCodeAt(i);
 h = Math.imul(h, 16777619);
 }
 return (h >>> 0).toString(16).padStart(8, '0');
 }
 function getDailyChallenge() {
 var key = dayKey();
 var cached = lsJson(DAILY_KEY, null);
 if (cached && cached.day === key && cached.seed) return cached;
 var seed = hashSeed('DOSWAPZ-ARCADE-' + key);
 var modes = ['STACK MODE', 'DODGE MODE', 'PARABOLIC', 'COLD HANDS', 'GOD CANDLE'];
 var idx = parseInt(seed.slice(0, 2), 16) % modes.length;
 var challenge = {
 day: key,
 seed: seed,
 mode: modes[idx],
 blurb: 'Same seed for every player today * tag runs with this seed on the board',
 bonusLabel: '+DAILY'
 };
 lsJsonSet(DAILY_KEY, challenge);
 return challenge;
 }

 // ── Board aggregation ───────────────────────────────────
 function maxScore(list, field) {
 field = field || 'score';
 if (!list || !list.length) return 0;
 var m = 0;
 for (var i = 0; i < list.length; i++) {
 var n = Number(list[i][field] || 0);
 if (n > m) m = n;
 }
 return m;
 }
 function loadDadBoard() {
 try {
 if (global.DOSWAPZ_SOFT_SCORE && global.DOSWAPZ_SOFT_SCORE.loadBoard) {
 return global.DOSWAPZ_SOFT_SCORE.loadBoard('doswapz_scores') || [];
 }
 } catch (e) {}
 return lsJson('doswapz_scores', []) || [];
 }
 function loadTbbBoard() {
 var list = lsJson('tbbBoard', []) || [];
 return (Array.isArray(list) ? list : []).filter(function (e) {
 return e && e.rulesOk !== false;
 });
 }
 function loadFtwrBoard() {
 try {
 if (global.DOSWAPZ_SOFT_SCORE && global.DOSWAPZ_SOFT_SCORE.loadBoard) {
 return global.DOSWAPZ_SOFT_SCORE.loadBoard('ftwr_scores_v1') || [];
 }
 } catch (e) {}
 return lsJson('ftwr_scores_v1', []) || [];
 }
 function loadMomBoard() {
 try {
 if (global.DOSWAPZ_SOFT_SCORE && global.DOSWAPZ_SOFT_SCORE.loadBoard) {
 return global.DOSWAPZ_SOFT_SCORE.loadBoard('doswapz_cryptomom_scores') || [];
 }
 } catch (e) {}
 return lsJson('doswapz_cryptomom_scores', []) || [];
 }
 function loadLilyBoard() {
 try {
 if (global.DOSWAPZ_SOFT_SCORE && global.DOSWAPZ_SOFT_SCORE.loadBoard) {
 return global.DOSWAPZ_SOFT_SCORE.loadBoard('lily_leap_scores_v1') || [];
 }
 } catch (e) {}
 return lsJson('lily_leap_scores_v1', []) || [];
 }
 function loadSnowmanBoard() {
 try {
 if (global.DOSWAPZ_SOFT_SCORE && global.DOSWAPZ_SOFT_SCORE.loadBoard) {
 return global.DOSWAPZ_SOFT_SCORE.loadBoard('snowman_geoff_scores_v1') || [];
 }
 } catch (e) {}
 return lsJson('snowman_geoff_scores_v1', []) || [];
 }

 function gatherScores() {
 var dad = loadDadBoard();
 var tbb = loadTbbBoard();
 var ftwr = loadFtwrBoard();
 var mom = loadMomBoard();
 var lily = loadLilyBoard();
 var snow = loadSnowmanBoard();
 var tbbHigh = Number(lsGet('tbbHighScore', '0') || 0);
 var ftwrDepth = Number(lsGet('ftwr_best_depth', '0') || 0);
 var lilyHigh = Number(lsGet('lily_leap_high', '0') || 0);
 var snowHigh = Number(lsGet('snowman_geoff_high', '0') || 0);
 var snowGeoffFinishes = snow.filter(function (e) { return e && e.geoffComplete; }).length;
 return {
 dad: {
 id: 'dad',
 name: 'Crypto Dad',
 best: maxScore(dad),
 entries: dad.length,
 href: '/classic/pages/cryptodad/scoreboard.html',
 play: '/classic/pages/cryptodad/play.html',
 list: dad.slice(0, 5)
 },
 tbb: {
 id: 'tbb',
 name: '$TBB Bull Run',
 best: Math.max(tbbHigh, maxScore(tbb)),
 entries: tbb.length,
 href: '/classic/pages/tbb/scoreboard.html',
 play: '/classic/pages/tbb/play.html',
 list: tbb.slice().sort(function (a, b) { return (b.score || 0) - (a.score || 0); }).slice(0, 5)
 },
 ftwr: {
 id: 'ftwr',
 name: 'FTWR',
 best: maxScore(ftwr),
 depth: ftwrDepth || maxScore(ftwr, 'depth'),
 entries: ftwr.length,
 href: '/classic/pages/cryptodad/ftwr-scoreboard.html',
 play: '/classic/pages/cryptodad/ftwr-maze.html',
 list: ftwr.slice(0, 5)
 },
 mom: {
 id: 'mom',
 name: 'Crypto Mom [18+]',
 best: maxScore(mom),
 entries: mom.length,
 href: '/classic/pages/basement/cryptomom/scoreboard.html',
 play: '/classic/pages/basement/cryptomom/play.html',
 list: mom.slice(0, 5)
 },
 lily: {
 id: 'lily',
 name: 'Lily Leap',
 best: Math.max(lilyHigh, maxScore(lily)),
 entries: lily.length,
 href: '/classic/pages/arcade/lily-leap/scoreboard.html',
 play: '/classic/pages/arcade/lily-leap/',
 list: lily.slice().sort(function (a, b) { return (b.score || 0) - (a.score || 0); }).slice(0, 5)
 },
 snow: {
 id: 'snow',
 name: 'Snowman Buildz Geoff',
 best: Math.max(snowHigh, maxScore(snow)),
 entries: snow.length,
 geoffFinishes: snowGeoffFinishes,
 href: '/classic/pages/arcade/snowman/scoreboard.html',
 play: '/classic/pages/arcade/snowman/',
 list: snow.slice().sort(function (a, b) {
 // Geoff finishers first, then score
 var ga = a.geoffComplete ? 1 : 0;
 var gb = b.geoffComplete ? 1 : 0;
 if (gb !== ga) return gb - ga;
 return (b.score || 0) - (a.score || 0);
 }).slice(0, 5)
 },
 daily: getDailyChallenge(),
 soft: softIdentity()
 };
 }

 // ── Share cards ─────────────────────────────────────────
 function shareCard(opts) {
 opts = opts || {};
 var id = softIdentity();
 var daily = getDailyChallenge();
 var game = opts.game || 'ARCADE';
 var score = opts.score != null ? opts.score : ' - ';
 var extra = opts.extra || '';
 var lines = [
 '◇ SOFT CONNECT // ' + game,
 id.tag + ' scored ' + (typeof score === 'number' ? score.toLocaleString() : score),
 extra,
 'Daily seed ' + daily.day + ' * ' + daily.seed + ' * ' + daily.mode,
 '',
 'No wallet seed. Soft connect only.',
 '#DOSWAPZ #Arcade #SoftConnect'
 ].filter(function (l, i, arr) {
 // drop empty middle extras but keep intentional blanks between blocks
 return !(l === '' && arr[i - 1] === '');
 });
 return lines.join('\n').replace(/\n{3,}/g, '\n\n');
 }

 function tweetUrl(text) {
 return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
 }

 async function copyText(text) {
 try {
 if (navigator.clipboard && navigator.clipboard.writeText) {
 await navigator.clipboard.writeText(text);
 return true;
 }
 } catch (e) {}
 try {
 var ta = document.createElement('textarea');
 ta.value = text;
 ta.style.position = 'fixed';
 ta.style.left = '-9999px';
 document.body.appendChild(ta);
 ta.select();
 var ok = document.execCommand('copy');
 document.body.removeChild(ta);
 return ok;
 } catch (e2) {
 return false;
 }
 }

 // ── Era badge REMOVED (was debug chrome: "PAST / INTRO v...") ──
 function injectEraBadge() {
 var p = paths();
 try {
 if (p.era === 'past') document.body.classList.add('past-crt');
 if (p.era === 'future') document.body.classList.add('future-pearl');
 } catch (e) {}
 // Nuke any legacy badge nodes/styles left from cached old builds
 try {
 var dead = document.getElementById('arcadeEraBadge');
 if (dead && dead.parentNode) dead.parentNode.removeChild(dead);
 document.querySelectorAll('.era-pill, .era-ver, [id="arcadeEraBadge"]').forEach(function (n) {
 // Keep intentional hub labels only if marked data-keep-era
 if (n.getAttribute && n.getAttribute('data-keep-era') === '1') return;
 // Orbit hub PRESENT pill was debug-ish chrome - remove all fixed corner pills
 var st = window.getComputedStyle ? window.getComputedStyle(n) : null;
 if (st && st.position === 'fixed') {
 if (n.parentNode) n.parentNode.removeChild(n);
 }
 });
 } catch (e2) {}
 }

 // Run once on load so cached HTML cannot keep the corner badge
 if (typeof document !== 'undefined') {
 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', function () {
 try { injectEraBadge(); } catch (e) {}
 });
 } else {
 try { injectEraBadge(); } catch (e) {}
 }
 }

 global.DOSWAPZ_ARCADE = {
 VIDEO_VERSION: VIDEO_VERSION,
 VIDEO_SRC: VIDEO_SRC,
 paths: paths,
 era: era,
 isOrbit: isOrbit,
 hasSeenIntro: hasSeenIntro,
 markIntroSeen: markIntroSeen,
 clearIntroSeen: clearIntroSeen,
 arcadeEntryHref: arcadeEntryHref,
 loadSoftConnect: loadSoftConnect,
 saveSoftConnect: saveSoftConnect,
 softIdentity: softIdentity,
 xSession: xSession,
 normalizeHandle: normalizeHandle,
 normalizeAlias: normalizeAlias,
 getDailyChallenge: getDailyChallenge,
 gatherScores: gatherScores,
 shareCard: shareCard,
 tweetUrl: tweetUrl,
 copyText: copyText,
 injectEraBadge: injectEraBadge
 };
})(typeof window !== 'undefined' ? window : this);
