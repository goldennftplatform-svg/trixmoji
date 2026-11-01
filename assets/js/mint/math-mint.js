/* DOSWAPZ - Pixel Math Mint engine (32×32 deterministic voxel art) */
window.DOSWAPZ_MATH = (function () {
 'use strict';

 var NEON_PALETTES = [
 ['#00ff41', '#003311', '#00cc66', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#88ff00'],
 ['#ff2bd6', '#1a0022', '#ff6b9d', '#00f5ff', '#ffe600', '#9d4eff', '#ffffff', '#ff3366'],
 ['#00f0ff', '#001a33', '#0088ff', '#ff8800', '#ffee00', '#44ffcc', '#ffffff', '#0066ff'],
 ['#ff4444', '#220000', '#ff8800', '#ffff44', '#ff00aa', '#aa2222', '#ffffff', '#ff2200'],
 ['#b8ff00', '#112200', '#66ff44', '#00ffcc', '#ccff00', '#228811', '#ffffff', '#eeff66'],
 ['#ff66ff', '#220033', '#aa44ff', '#00ff99', '#ffcc00', '#ff0088', '#ffffff', '#cc66ff'],
 ['#00ffaa', '#002211', '#00ddff', '#ff5500', '#aaff00', '#005544', '#ffffff', '#33ffcc'],
 ['#ffd700', '#332200', '#ff6600', '#ff0066', '#00ffee', '#aa8800', '#ffffff', '#ffaa00']
 ];

 var VOXEL_SIZE = 8;

 function hashStr(s) {
 var h = 2166136261;
 for (var i = 0; i < s.length; i++) {
 h ^= s.charCodeAt(i);
 h = Math.imul(h, 16777619);
 }
 return h >>> 0;
 }

 function mulberry32(seed) {
 return function () {
 seed |= 0;
 seed = (seed + 0x6D2B79F5) | 0;
 var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
 t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
 return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
 };
 }

 function hexToRgb(hex) {
 var n = parseInt(hex.replace('#', ''), 16);
 return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
 }

 function rgbToHex(r, g, b) {
 return '#' + [r, g, b].map(function (v) {
 return Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0');
 }).join('');
 }

 function shade(hex, amount) {
 var c = hexToRgb(hex);
 return rgbToHex(
 c.r + amount,
 c.g + amount * 0.9,
 c.b + amount * 0.8
 );
 }

 function pickPalette(rng) {
 var base = NEON_PALETTES[Math.floor(rng() * NEON_PALETTES.length)].slice();
 if (rng() < 0.45) {
 var swap = Math.floor(rng() * base.length);
 base[swap] = NEON_PALETTES[Math.floor(rng() * NEON_PALETTES.length)][Math.floor(rng() * 8)];
 }
 return base;
 }

 function drawChaosGrid(ctx, rng, palette) {
 var w = 32, row = new Array(w).fill(0);
 for (var x = 0; x < w; x++) row[x] = rng() < 0.5 ? 1 : 0;
 for (var y = 0; y < w; y++) {
 var next = new Array(w).fill(0);
 for (var x = 0; x < w; x++) {
 var left = x > 0 ? row[x - 1] : 0;
 var center = row[x];
 var right = x < w - 1 ? row[x + 1] : 0;
 next[x] = left ^ (center | right);
 ctx.fillStyle = next[x]
 ? palette[Math.floor(rng() * 4)]
 : palette[1];
 ctx.fillRect(x, y, 1, 1);
 }
 row = next;
 }
 }

 function noise2D(x, y, seed) {
 var n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
 return n - Math.floor(n);
 }

 function drawOrganic(ctx, rng, palette, seed) {
 for (var y = 0; y < 32; y++) {
 for (var x = 0; x < 32; x++) {
 var v = 0, amp = 1, freq = 1;
 for (var o = 0; o < 5; o++) {
 v += amp * noise2D(x * freq * 0.08, y * freq * 0.08, seed + o * 17);
 amp *= 0.5;
 freq *= 2;
 }
 ctx.fillStyle = v > 0.62 ? palette[0]
 : v > 0.48 ? palette[3]
 : v > 0.32 ? palette[2]
 : palette[1];
 ctx.fillRect(x, y, 1, 1);
 }
 }
 }

 function drawBio(ctx, rng, palette) {
 var u = [], v = [];
 for (var i = 0; i < 1024; i++) {
 u[i] = rng();
 v[i] = rng();
 }
 for (var step = 0; step < 10; step++) {
 var nu = u.slice(), nv = v.slice();
 for (var y = 1; y < 31; y++) {
 for (var x = 1; x < 31; x++) {
 var idx = y * 32 + x;
 var lapU = u[idx - 1] + u[idx + 1] + u[idx - 32] + u[idx + 32] - 4 * u[idx];
 var lapV = v[idx - 1] + v[idx + 1] + v[idx - 32] + v[idx + 32] - 4 * v[idx];
 nu[idx] = Math.max(0, Math.min(1, u[idx] + 0.05 * lapU - u[idx] * v[idx] * v[idx] + 0.012));
 nv[idx] = Math.max(0, Math.min(1, v[idx] + 0.09 * lapV + u[idx] * v[idx] * v[idx] - 0.055));
 }
 }
 u = nu; v = nv;
 }
 for (var y = 0; y < 32; y++) {
 for (var x = 0; x < 32; x++) {
 var val = u[y * 32 + x];
 ctx.fillStyle = val > 0.68 ? palette[4]
 : val > 0.5 ? palette[0]
 : val > 0.32 ? palette[3]
 : palette[1];
 ctx.fillRect(x, y, 1, 1);
 }
 }
 }

 function drawVoronoi(ctx, rng, palette) {
 var sites = [];
 for (var i = 0; i < 11; i++) {
 sites.push({ x: rng() * 32, y: rng() * 32, c: palette[i % palette.length] });
 }
 for (var y = 0; y < 32; y++) {
 for (var x = 0; x < 32; x++) {
 var best = 999, idx = 0;
 for (var s = 0; s < sites.length; s++) {
 var dx = x - sites[s].x, dy = y - sites[s].y;
 var d = dx * dx + dy * dy;
 if (d < best) { best = d; idx = s; }
 }
 ctx.fillStyle = sites[idx].c;
 ctx.fillRect(x, y, 1, 1);
 }
 }
 }

 function drawJulia(ctx, rng, palette) {
 var cRe = -0.72 + rng() * 0.5;
 var cIm = 0.18 + rng() * 0.55;
 for (var py = 0; py < 32; py++) {
 for (var px = 0; px < 32; px++) {
 var zr = (px - 16) / 13;
 var zi = (py - 16) / 13;
 var iter = 0;
 while (zr * zr + zi * zi < 4 && iter < 28) {
 var nzr = zr * zr - zi * zi + cRe;
 zi = 2 * zr * zi + cIm;
 zr = nzr;
 iter++;
 }
 ctx.fillStyle = iter > 22 ? palette[6]
 : iter > 16 ? palette[4]
 : iter > 10 ? palette[0]
 : iter > 5 ? palette[3]
 : palette[1];
 ctx.fillRect(px, py, 1, 1);
 }
 }
 }

 function drawLSystem(ctx, rng, palette) {
 ctx.fillStyle = palette[1];
 ctx.fillRect(0, 0, 32, 32);
 function branch(x, y, len, angle, depth) {
 if (depth <= 0 || len < 2) return;
 var x2 = x + Math.cos(angle) * len;
 var y2 = y + Math.sin(angle) * len;
 ctx.strokeStyle = depth % 3 === 0 ? palette[4] : depth % 2 ? palette[0] : palette[2];
 ctx.lineWidth = Math.max(1, depth * 0.45);
 ctx.beginPath();
 ctx.moveTo(x, y);
 ctx.lineTo(x2, y2);
 ctx.stroke();
 branch(x2, y2, len * 0.7, angle - 0.42 + rng() * 0.08, depth - 1);
 branch(x2, y2, len * 0.7, angle + 0.42 - rng() * 0.08, depth - 1);
 }
 branch(16, 31, 13, -Math.PI / 2, 6);
 }

 function drawPlasma(ctx, rng, palette, seed) {
 var s = seed * 0.001;
 for (var y = 0; y < 32; y++) {
 for (var x = 0; x < 32; x++) {
 var v = Math.sin(x * 0.21 + s) + Math.sin(y * 0.17 + s * 1.7) +
 Math.sin((x + y) * 0.11 + s * 0.4) + Math.sin(Math.sqrt(x * x + y * y) * 0.13);
 v = (v + 4) / 8;
 ctx.fillStyle = v > 0.72 ? palette[4]
 : v > 0.55 ? palette[0]
 : v > 0.38 ? palette[5]
 : v > 0.22 ? palette[3]
 : palette[1];
 ctx.fillRect(x, y, 1, 1);
 }
 }
 }

 function drawStrangeAttractor(ctx, rng, palette) {
 ctx.fillStyle = palette[1];
 ctx.fillRect(0, 0, 32, 32);
 var a = 1.4 + rng() * 0.4;
 var b = -2.3 + rng() * 0.5;
 var c = 2.4 + rng() * 0.3;
 var d = -2.1 + rng() * 0.4;
 var x = 0.1;
 var y = 0.1;
 for (var i = 0; i < 4800; i++) {
 var xn = Math.sin(a * y) - Math.cos(b * x);
 var yn = Math.sin(c * x) - Math.cos(d * y);
 x = xn;
 y = yn;
 var px = Math.floor((x + 2.2) / 4.4 * 31);
 var py = Math.floor((y + 2.2) / 4.4 * 31);
 if (px >= 0 && px < 32 && py >= 0 && py < 32) {
 ctx.fillStyle = i % 7 === 0 ? palette[4] : i % 3 === 0 ? palette[0] : palette[3];
 ctx.fillRect(px, py, 1, 1);
 }
 }
 }

 function drawMoire(ctx, rng, palette) {
 var freq1 = 0.35 + rng() * 0.25;
 var freq2 = 0.28 + rng() * 0.22;
 var phase = rng() * Math.PI * 2;
 for (var y = 0; y < 32; y++) {
 for (var x = 0; x < 32; x++) {
 var w1 = Math.sin(x * freq1 + phase);
 var w2 = Math.sin(y * freq2 + x * 0.08);
 var v = Math.abs(w1 + w2);
 ctx.fillStyle = v > 1.35 ? palette[6]
 : v > 0.9 ? palette[4]
 : v > 0.5 ? palette[0]
 : palette[1];
 ctx.fillRect(x, y, 1, 1);
 }
 }
 }

 function applyGlitchShift(ctx, rng, palette, seed, streaks) {
 var imgData = ctx.getImageData(0, 0, 32, 32);
 var data = imgData.data;
 var row = new Uint8ClampedArray(32 * 4);
 for (var y = 0; y < 32; y++) {
 var shift = Math.floor((Math.sin(y * 0.7 + seed * 0.01) * 0.5 + 0.5) * 10) - 5;
 if (rng() < 0.18) shift = Math.floor(rng() * 16) - 8;
 for (var x = 0; x < 32; x++) {
 var sx = (x + shift + 32) % 32;
 var si = (y * 32 + sx) * 4;
 row[x * 4] = data[si];
 row[x * 4 + 1] = data[si + 1];
 row[x * 4 + 2] = data[si + 2];
 row[x * 4 + 3] = data[si + 3];
 }
 for (var x = 0; x < 32; x++) {
 var di = (y * 32 + x) * 4;
 data[di] = row[x * 4];
 data[di + 1] = row[x * 4 + 1];
 data[di + 2] = row[x * 4 + 2];
 data[di + 3] = row[x * 4 + 3];
 }
 }
 ctx.putImageData(imgData, 0, 0);
 if (streaks) {
 for (var i = 0; i < 7; i++) {
 if (rng() < 0.65) {
 var gy = Math.floor(rng() * 32);
 ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
 ctx.fillRect(0, gy, 32, rng() < 0.4 ? 2 : 1);
 }
 }
 }
 }

 function drawGlitchRaster(ctx, rng, palette, seed) {
 drawChaosGrid(ctx, rng, palette);
 applyGlitchShift(ctx, rng, palette, seed, true);
 }

 function drawWarp(ctx, rng, palette, seed) {
 var warpAmp = 5 + rng() * 4;
 for (var y = 0; y < 32; y++) {
 for (var x = 0; x < 32; x++) {
 var wx = x + (noise2D(x * 0.14, y * 0.14, seed) - 0.5) * warpAmp;
 var wy = y + (noise2D(x * 0.14 + 41, y * 0.14 + 17, seed + 31) - 0.5) * warpAmp;
 var v = 0;
 var amp = 1;
 var freq = 1;
 for (var o = 0; o < 4; o++) {
 v += amp * noise2D(wx * freq * 0.09, wy * freq * 0.09, seed + o * 23);
 amp *= 0.5;
 freq *= 2;
 }
 ctx.fillStyle = v > 0.68 ? palette[4]
 : v > 0.52 ? palette[0]
 : v > 0.36 ? palette[5]
 : v > 0.22 ? palette[3]
 : palette[1];
 ctx.fillRect(x, y, 1, 1);
 }
 }
 }

 function drawClifford(ctx, rng, palette) {
 ctx.fillStyle = palette[1];
 ctx.fillRect(0, 0, 32, 32);
 var a = -1.4 + rng() * 0.8;
 var b = 1.6 + rng() * 0.6;
 var c = 1.2 + rng() * 0.5;
 var d = -0.7 + rng() * 0.6;
 var x = 0.12;
 var y = 0.08;
 for (var i = 0; i < 5200; i++) {
 var xn = Math.sin(a * y) + c * Math.cos(a * x);
 var yn = Math.sin(b * x) + d * Math.cos(b * y);
 x = xn;
 y = yn;
 var px = Math.floor((x + 2.5) / 5 * 31);
 var py = Math.floor((y + 2.5) / 5 * 31);
 if (px >= 0 && px < 32 && py >= 0 && py < 32) {
 ctx.fillStyle = i % 6 === 0 ? palette[6] : i % 2 ? palette[0] : palette[4];
 ctx.fillRect(px, py, 1, 1);
 }
 }
 }

 function drawCosmic(ctx, rng, palette, seed) {
 drawChaosGrid(ctx, rng, palette);
 ctx.globalAlpha = 0.48;
 drawPlasma(ctx, rng, palette, seed);
 ctx.globalAlpha = 0.42;
 drawWarp(ctx, rng, palette, seed + 7);
 ctx.globalAlpha = 0.4;
 drawStrangeAttractor(ctx, rng, palette);
 ctx.globalAlpha = 0.36;
 drawClifford(ctx, rng, palette);
 ctx.globalAlpha = 0.38;
 drawJulia(ctx, rng, palette);
 ctx.globalAlpha = 1;
 applyGlitchShift(ctx, rng, palette, seed + 99, true);
 for (var i = 0; i < 18; i++) {
 ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
 ctx.fillRect(Math.floor(rng() * 30), Math.floor(rng() * 30), 2, 2);
 }
 ctx.strokeStyle = palette[4];
 ctx.lineWidth = 2;
 ctx.strokeRect(1, 1, 30, 30);
 ctx.fillStyle = palette[5];
 ctx.font = '7px monospace';
 ctx.fillText('1/1', 4, 9);
 }

 var FORMULAS = {
 chaos: 'next = left XOR (center OR right)',
 organic: 'Σ amplitude × noise(octave × freq)',
 bio: 'Gray-Scott reaction-diffusion (u,v laplacian)',
 voronoi: 'nearest-site distance field (11 seeds)',
 julia: 'z = z² + c until |z| > 2',
 lsystem: 'recursive branching (angle ±0.42 rad)',
 plasma: 'Σ sin(x * f) + sin(y * f) + sin(r * f) - neon bands',
 strange: 'de Jong attractor: xₙ₊₁ = sin(ay) − cos(bx)',
 moire: '|sin(x * f₁) + sin(y * f₂ + x * k)| interference',
 glitch: 'row XOR-shift + neon scanline tear',
 warp: 'domain warp: f(x+δx, y+δy) with δ from noise²',
 clifford: 'Clifford: xₙ₊₁ = sin(ay)+c * cos(ax), yₙ₊₁ = sin(bx)+d * cos(by)',
 cosmic: 'stack: chaos + plasma + warp + strange + clifford + julia + glitch (1/1)'
 };

 function rollStyle(rng) {
 var r = rng();
 if (r < 0.24) return 'chaos';
 if (r < 0.41) return 'organic';
 if (r < 0.54) return 'bio';
 if (r < 0.63) return 'voronoi';
 if (r < 0.69) return 'julia';
 if (r < 0.72) return 'lsystem';
 if (r < 0.78) return 'plasma';
 if (r < 0.83) return 'strange';
 if (r < 0.86) return 'moire';
 if (r < 0.89) return 'glitch';
 if (r < 0.94) return 'warp';
 return 'clifford';
 }

 function styleLabel(style) {
 return {
 chaos: 'Chaos Grid',
 organic: 'Organic Terrain',
 bio: 'Bio Patterns',
 voronoi: 'Crystal Lattice',
 julia: 'Fractal Bloom',
 lsystem: 'Growth Form',
 plasma: 'Plasma Field',
 strange: 'Strange Attractor',
 moire: 'Moire Interference',
 glitch: 'Glitch Raster',
 warp: 'Domain Warp',
 clifford: 'Clifford Attractor',
 cosmic: 'Cosmic Resonance'
 }[style] || style;
 }

 function readPixelGrid(sourceCanvas) {
 var ctx = sourceCanvas.getContext('2d');
 var data = ctx.getImageData(0, 0, 32, 32).data;
 var grid = [];
 for (var y = 0; y < 32; y++) {
 grid[y] = [];
 for (var x = 0; x < 32; x++) {
 var i = (y * 32 + x) * 4;
 var a = data[i + 3];
 if (a < 20) {
 grid[y][x] = null;
 } else {
 grid[y][x] = rgbToHex(data[i], data[i + 1], data[i + 2]);
 }
 }
 }
 return grid;
 }

 function drawVoxelBlock(ctx, x, y, color, size) {
 var s = size || VOXEL_SIZE;
 var top = shade(color, 42);
 var left = shade(color, -18);
 var right = shade(color, -42);
 var h = Math.max(3, Math.floor(s * 0.72));

 ctx.fillStyle = left;
 ctx.fillRect(x, y + (s - h), s, h);

 ctx.fillStyle = right;
 ctx.beginPath();
 ctx.moveTo(x + s, y + (s - h));
 ctx.lineTo(x + s + Math.floor(s * 0.28), y + (s - h) - Math.floor(s * 0.22));
 ctx.lineTo(x + s + Math.floor(s * 0.28), y + s - Math.floor(s * 0.22));
 ctx.lineTo(x + s, y + s);
 ctx.closePath();
 ctx.fill();

 ctx.fillStyle = top;
 ctx.beginPath();
 ctx.moveTo(x, y + (s - h));
 ctx.lineTo(x + s, y + (s - h));
 ctx.lineTo(x + s + Math.floor(s * 0.28), y + (s - h) - Math.floor(s * 0.22));
 ctx.lineTo(x + Math.floor(s * 0.28), y + (s - h) - Math.floor(s * 0.22));
 ctx.closePath();
 ctx.fill();

 ctx.fillStyle = color;
 ctx.fillRect(x + 1, y + (s - h) + 1, Math.max(1, s - 3), Math.max(1, h - 2));
 }

 function renderVoxels(sourceCanvas, targetCanvas, opts) {
 opts = opts || {};
 var size = opts.voxelSize || VOXEL_SIZE;
 var padX = opts.padX || Math.floor(size * 0.6);
 var padY = opts.padY || Math.floor(size * 0.5);
 var grid = readPixelGrid(sourceCanvas);
 var outW = 32 * size + padX + Math.floor(size * 0.3);
 var outH = 32 * size + padY + Math.floor(size * 0.3);

 targetCanvas.width = outW;
 targetCanvas.height = outH;
 var ctx = targetCanvas.getContext('2d');
 ctx.imageSmoothingEnabled = false;
 ctx.fillStyle = '#020202';
 ctx.fillRect(0, 0, outW, outH);

 for (var y = 0; y < 32; y++) {
 for (var x = 0; x < 32; x++) {
 var color = grid[y][x];
 if (!color || color === '#000000') continue;
 drawVoxelBlock(ctx, x * size + padX, y * size + padY, color, size);
 }
 }

 return targetCanvas;
 }

 function generate(seed, opts) {
 opts = opts || {};
 var seedStr = String(seed || Date.now());
 var base = hashStr(seedStr);
 var rng = mulberry32(base);
 var palette = pickPalette(rng);
 var cosmic = opts.forceCosmic || (base % 2500 === 0);
 var style = cosmic ? 'cosmic' : rollStyle(rng);

 var canvas = document.createElement('canvas');
 canvas.width = 32;
 canvas.height = 32;
 var ctx = canvas.getContext('2d');
 ctx.imageSmoothingEnabled = false;

 if (style === 'chaos') drawChaosGrid(ctx, rng, palette);
 else if (style === 'organic') drawOrganic(ctx, rng, palette, base);
 else if (style === 'bio') drawBio(ctx, rng, palette);
 else if (style === 'voronoi') drawVoronoi(ctx, rng, palette);
 else if (style === 'julia') drawJulia(ctx, rng, palette);
 else if (style === 'lsystem') drawLSystem(ctx, rng, palette);
 else if (style === 'plasma') drawPlasma(ctx, rng, palette, base);
 else if (style === 'strange') drawStrangeAttractor(ctx, rng, palette);
 else if (style === 'moire') drawMoire(ctx, rng, palette);
 else if (style === 'glitch') drawGlitchRaster(ctx, rng, palette, base);
 else if (style === 'warp') drawWarp(ctx, rng, palette, base);
 else if (style === 'clifford') drawClifford(ctx, rng, palette);
 else drawCosmic(ctx, rng, palette, base);

 return {
 canvas: canvas,
 seed: seedStr,
 style: style,
 label: styleLabel(style),
 cosmic: cosmic,
 palette: palette,
 entropy: (base ^ (Date.now() & 0xffff)).toString(16).toUpperCase().padStart(8, '0').slice(-8),
 block: (base % 0xffffff).toString(16).toUpperCase().padStart(8, '0')
 };
 }

 function drawTo(canvasEl, seed, opts) {
 opts = opts || {};
 var result = generate(seed, opts);
 var useVoxels = opts.voxels !== false;

 if (useVoxels) {
 renderVoxels(result.canvas, canvasEl, { voxelSize: opts.voxelSize || VOXEL_SIZE });
 } else {
 canvasEl.width = 32;
 canvasEl.height = 32;
 var ctx = canvasEl.getContext('2d');
 ctx.imageSmoothingEnabled = false;
 ctx.clearRect(0, 0, 32, 32);
 ctx.drawImage(result.canvas, 0, 0);
 }

 return result;
 }

 function saveMint(result, wallet) {
 var key = 'doswapz_math_mints';
 var list = [];
 try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
 list.unshift({
 seed: result.seed,
 style: result.style,
 label: result.label,
 cosmic: result.cosmic,
 wallet: wallet || 'preview',
 ts: Date.now()
 });
 list = list.slice(0, 48);
 localStorage.setItem(key, JSON.stringify(list));
 return list;
 }

 function loadMints() {
 try { return JSON.parse(localStorage.getItem('doswapz_math_mints') || '[]'); } catch (e) { return []; }
 }

 return {
 generate: generate,
 drawTo: drawTo,
 renderVoxels: renderVoxels,
 saveMint: saveMint,
 loadMints: loadMints,
 styleLabel: styleLabel,
 FORMULAS: FORMULAS,
 EXAMPLE_SEEDS: {
 chaos: 'CHAOS-VOXEL-ALPHA-001',
 organic: 'ORGANIC-TERRAIN-BETA-002',
 bio: 'BIO-PATTERN-GAMMA-003',
 voronoi: 'CRYSTAL-LATTICE-DELTA-004',
 julia: 'FRACTAL-BLOOM-EPSILON-005',
 lsystem: 'GROWTH-FORM-ZETA-006',
 plasma: 'PLASMA-NEON-ETA-007',
 strange: 'ATTRACTOR-THETA-008',
 moire: 'MOIRE-INTERFERENCE-IOTA-009',
 glitch: 'GLITCH-RASTER-KAPPA-010',
 warp: 'WARP-DOMAIN-LAMBDA-011',
 clifford: 'CLIFFORD-MU-012',
 cosmic: 'COSMIC-RESONANCE-OMEGA-7777'
 }
 };
})();