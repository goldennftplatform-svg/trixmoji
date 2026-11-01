/* KOL fighter - loads Grok AI pose PNGs from characters/<slug>/poses/ */
window.KOL_FIGHTER_SPRITES = (function () {
 'use strict';

 const CHAR_BASE = (function () {
 if (window.KOL_FIGHTER_CHAR_BASE) return window.KOL_FIGHTER_CHAR_BASE;
 const p = (location.pathname || '').replace(/\\/g, '/');
 if (p.indexOf('/classic/pages/degen/') !== -1) return '../../../assets/images/kol-fighter/characters/';
 return '/assets/images/kol-fighter/characters/';
 })();

 const SLUGS = [
 'degen', 'ansem', 'jason-williams', 'dogedesigner', 'roger-ver', 'bitboy',
 'jimmy-edgar', 'michael-saylor', 'crypto-bitlord', 'donalt', 'vitalik-buterin', 'pauly0x'
 ];

 const SCALES = { degen: 2.2, pauly0x: 2.2 };
 const DEFAULT_SCALE = 2;
 const CACHE = 'v=24';

 const store = {};
 const frames = {};

 function pngToCanvas(img) {
 const c = document.createElement('canvas');
 c.width = img.naturalWidth || img.width;
 c.height = img.naturalHeight || img.height;
 const ctx = c.getContext('2d');
 ctx.imageSmoothingEnabled = false;
 ctx.clearRect(0, 0, c.width, c.height);
 ctx.drawImage(img, 0, 0);
 return c;
 }

 function loadImage(url) {
 return new Promise(function (resolve, reject) {
 const img = new Image();
 img.onload = function () { resolve(img); };
 img.onerror = function () { reject(new Error(url)); };
 img.src = url;
 });
 }

 function loadPoseSheetFromFiles(slug, onDone) {
 const POSES = window.KOL_FIGHTER_POSES;
 if (!POSES) {
 onDone(false);
 return;
 }

 const includeBoss = slug === 'pauly0x';
 const bases = POSES.allBases(includeBoss);
 const sheet = {
 _hasLR: true,
 _reference: true,
 _fromFiles: true,
 _scale: SCALES[slug] || DEFAULT_SCALE
 };
 const tasks = [];

 bases.forEach(function (base) {
 ['R', 'L'].forEach(function (side) {
 const facing = side === 'R' ? 1 : -1;
 const path = POSES.posePath(slug, base, facing);
 const key = POSES.sheetKey(base, facing);
 const url = CHAR_BASE + path + '?' + CACHE;
 tasks.push(
 loadImage(url).then(function (img) {
 sheet[key] = pngToCanvas(img);
 }).catch(function () {
 sheet[key] = null;
 })
 );
 });
 });

 Promise.all(tasks).then(function () {
 const leg = POSES.LEGACY;
 Object.keys(leg).forEach(function (oldName) {
 const base = leg[oldName];
 if (sheet[POSES.sheetKey(base, 1)]) sheet[oldName] = sheet[POSES.sheetKey(base, 1)];
 });

 const idle = sheet.idleR || sheet.idleL;
 if (!idle) {
 onDone(false);
 return;
 }
 frames[slug] = sheet;
 store[slug] = idle;
 if (window.KOL_FIGHTER_NES) KOL_FIGHTER_NES.register(slug, sheet);
 onDone(true);
 });
 }

 function loadOne(slug, onDone) {
 loadPoseSheetFromFiles(slug, onDone);
 }

 function loadAll(onReady) {
 let pending = SLUGS.length;
 let ok = 0;
 const done = function (success) {
 if (success) ok++;
 if (--pending === 0 && onReady) onReady(ok, SLUGS.length);
 };
 SLUGS.forEach(function (slug) { loadOne(slug, done); });
 }

 function loadDegen(onDone) {
 loadOne('degen', onDone);
 }

 function draw(ctx, fighter) {
 if (window.KOL_FIGHTER_NES && KOL_FIGHTER_NES.draw(ctx, fighter)) return true;
 return false;
 }

 return { loadAll, loadDegen, draw, store, frames, SLUGS, CHAR_BASE };
})();