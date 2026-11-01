/**
 * Phunk base sprites - loaded from user-provided male/female reference art
 * Sampled to 24×24 (Ethereum Phunk spec)
 */
window.PHUNK_BASES = (function () {
 const SIZE = 24;
 const MALE_URL = '/assets/images/phunk/base-male.jpg';
 const FEMALE_URL = '/assets/images/phunk/base-female.png';

 function rgbToHex(r, g, b) {
 return '#' + [r, g, b].map(function (v) {
 return ('0' + (v & 255).toString(16)).slice(-2);
 }).join('');
 }

 function isBackground(r, g, b, a) {
 // Transparent / cutout only. Pure black is phunk outline — never drop it.
 if (a < 100) return true;
 // Light gray / white plate (JPG bases, checkerboard bake-ins)
 if (Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r >= 160) return true;
 return false;
 }

 function loadGrid(url) {
 return new Promise(function (resolve, reject) {
 const img = new Image();
 img.crossOrigin = 'anonymous';
 img.onload = function () {
 // Full-res sample then nearest-neighbor into 24×24 so outlines stay sharp.
 const src = document.createElement('canvas');
 src.width = img.naturalWidth || img.width;
 src.height = img.naturalHeight || img.height;
 const sctx = src.getContext('2d');
 sctx.imageSmoothingEnabled = false;
 sctx.drawImage(img, 0, 0);
 const srcData = sctx.getImageData(0, 0, src.width, src.height).data;
 const grid = [];
 for (let y = 0; y < SIZE; y++) {
 grid[y] = [];
 const sy = Math.min(src.height - 1, Math.floor((y + 0.5) * src.height / SIZE));
 for (let x = 0; x < SIZE; x++) {
 const sx = Math.min(src.width - 1, Math.floor((x + 0.5) * src.width / SIZE));
 const i = (sy * src.width + sx) * 4;
 const r = srcData[i];
 const g = srcData[i + 1];
 const b = srcData[i + 2];
 const a = srcData[i + 3];
 grid[y][x] = isBackground(r, g, b, a) ? null : rgbToHex(r, g, b);
 }
 }
 resolve(grid);
 };
 img.onerror = function () { reject(new Error('Failed to load phunk base: ' + url)); };
 img.src = url;
 });
 }

 return {
 SIZE: SIZE,
 MALE_URL: MALE_URL,
 FEMALE_URL: FEMALE_URL,
 loadGrid: loadGrid
 };
})();