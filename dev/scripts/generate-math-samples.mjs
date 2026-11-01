/**
 * Generate PNG examples for DOSWAPZ math mint (voxel/colorful).
 * Run: node scripts/generate-math-samples.mjs
 */
import { createCanvas } from 'canvas';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'images', 'math_mint_samples');

const NEON_PALETTES = [
  ['#00ff41', '#003311', '#00cc66', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#88ff00'],
  ['#ff2bd6', '#1a0022', '#ff6b9d', '#00f5ff', '#ffe600', '#9d4eff', '#ffffff', '#ff3366'],
  ['#00f0ff', '#001a33', '#0088ff', '#ff8800', '#ffee00', '#44ffcc', '#ffffff', '#0066ff'],
  ['#ff4444', '#220000', '#ff8800', '#ffff44', '#ff00aa', '#aa2222', '#ffffff', '#ff2200'],
  ['#b8ff00', '#112200', '#66ff44', '#00ffcc', '#ccff00', '#228811', '#ffffff', '#eeff66'],
  ['#ff66ff', '#220033', '#aa44ff', '#00ff99', '#ffcc00', '#ff0088', '#ffffff', '#cc66ff'],
  ['#00ffaa', '#002211', '#00ddff', '#ff5500', '#aaff00', '#005544', '#ffffff', '#33ffcc'],
  ['#ffd700', '#332200', '#ff6600', '#ff0066', '#00ffee', '#aa8800', '#ffffff', '#ffaa00']
];

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
}

function shade(hex, amount) {
  const c = hexToRgb(hex);
  return rgbToHex(c.r + amount, c.g + amount * 0.9, c.b + amount * 0.8);
}

function pickPalette(rng) {
  const base = NEON_PALETTES[Math.floor(rng() * NEON_PALETTES.length)].slice();
  if (rng() < 0.45) {
    const swap = Math.floor(rng() * base.length);
    base[swap] = NEON_PALETTES[Math.floor(rng() * NEON_PALETTES.length)][Math.floor(rng() * 8)];
  }
  return base;
}

function noise2D(x, y, seed) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

function drawChaosGrid(ctx, rng, palette) {
  const w = 32;
  let row = Array(w).fill(0);
  for (let x = 0; x < w; x++) row[x] = rng() < 0.5 ? 1 : 0;
  for (let y = 0; y < w; y++) {
    const next = Array(w).fill(0);
    for (let x = 0; x < w; x++) {
      const left = x > 0 ? row[x - 1] : 0;
      const center = row[x];
      const right = x < w - 1 ? row[x + 1] : 0;
      next[x] = left ^ (center | right);
      ctx.fillStyle = next[x] ? palette[Math.floor(rng() * 4)] : palette[1];
      ctx.fillRect(x, y, 1, 1);
    }
    row = next;
  }
}

function drawOrganic(ctx, rng, palette, seed) {
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      let v = 0, amp = 1, freq = 1;
      for (let o = 0; o < 5; o++) {
        v += amp * noise2D(x * freq * 0.08, y * freq * 0.08, seed + o * 17);
        amp *= 0.5; freq *= 2;
      }
      ctx.fillStyle = v > 0.62 ? palette[0] : v > 0.48 ? palette[3] : v > 0.32 ? palette[2] : palette[1];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawBio(ctx, rng, palette) {
  const u = [], v = [];
  for (let i = 0; i < 1024; i++) { u[i] = rng(); v[i] = rng(); }
  for (let step = 0; step < 10; step++) {
    const nu = u.slice(), nv = v.slice();
    for (let y = 1; y < 31; y++) {
      for (let x = 1; x < 31; x++) {
        const idx = y * 32 + x;
        const lapU = u[idx - 1] + u[idx + 1] + u[idx - 32] + u[idx + 32] - 4 * u[idx];
        const lapV = v[idx - 1] + v[idx + 1] + v[idx - 32] + v[idx + 32] - 4 * v[idx];
        nu[idx] = Math.max(0, Math.min(1, u[idx] + 0.05 * lapU - u[idx] * v[idx] * v[idx] + 0.012));
        nv[idx] = Math.max(0, Math.min(1, v[idx] + 0.09 * lapV + u[idx] * v[idx] * v[idx] - 0.055));
      }
    }
    u.splice(0, u.length, ...nu);
    v.splice(0, v.length, ...nv);
  }
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const val = u[y * 32 + x];
      ctx.fillStyle = val > 0.68 ? palette[4] : val > 0.5 ? palette[0] : val > 0.32 ? palette[3] : palette[1];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawVoronoi(ctx, rng, palette) {
  const sites = [];
  for (let i = 0; i < 11; i++) sites.push({ x: rng() * 32, y: rng() * 32, c: palette[i % palette.length] });
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      let best = 999, idx = 0;
      for (let s = 0; s < sites.length; s++) {
        const dx = x - sites[s].x, dy = y - sites[s].y;
        const d = dx * dx + dy * dy;
        if (d < best) { best = d; idx = s; }
      }
      ctx.fillStyle = sites[idx].c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawJulia(ctx, rng, palette) {
  const cRe = -0.72 + rng() * 0.5;
  const cIm = 0.18 + rng() * 0.55;
  for (let py = 0; py < 32; py++) {
    for (let px = 0; px < 32; px++) {
      let zr = (px - 16) / 13, zi = (py - 16) / 13, iter = 0;
      while (zr * zr + zi * zi < 4 && iter < 28) {
        const nzr = zr * zr - zi * zi + cRe;
        zi = 2 * zr * zi + cIm;
        zr = nzr;
        iter++;
      }
      ctx.fillStyle = iter > 22 ? palette[6] : iter > 16 ? palette[4] : iter > 10 ? palette[0] : iter > 5 ? palette[3] : palette[1];
      ctx.fillRect(px, py, 1, 1);
    }
  }
}

function drawLSystem(ctx, rng, palette) {
  ctx.fillStyle = palette[1];
  ctx.fillRect(0, 0, 32, 32);
  function branch(x, y, len, angle, depth) {
    if (depth <= 0 || len < 2) return;
    const x2 = x + Math.cos(angle) * len;
    const y2 = y + Math.sin(angle) * len;
    ctx.strokeStyle = depth % 3 === 0 ? palette[4] : depth % 2 ? palette[0] : palette[2];
    ctx.lineWidth = Math.max(1, depth * 0.45);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    branch(x2, y2, len * 0.7, angle - 0.42, depth - 1);
    branch(x2, y2, len * 0.7, angle + 0.42, depth - 1);
  }
  branch(16, 31, 13, -Math.PI / 2, 6);
}

function drawPlasma(ctx, rng, palette, seed) {
  const s = seed * 0.001;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      let v = Math.sin(x * 0.21 + s) + Math.sin(y * 0.17 + s * 1.7) +
        Math.sin((x + y) * 0.11 + s * 0.4) + Math.sin(Math.sqrt(x * x + y * y) * 0.13);
      v = (v + 4) / 8;
      ctx.fillStyle = v > 0.72 ? palette[4] : v > 0.55 ? palette[0] : v > 0.38 ? palette[5] : v > 0.22 ? palette[3] : palette[1];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawStrangeAttractor(ctx, rng, palette) {
  ctx.fillStyle = palette[1];
  ctx.fillRect(0, 0, 32, 32);
  const a = 1.4 + rng() * 0.4;
  const b = -2.3 + rng() * 0.5;
  const c = 2.4 + rng() * 0.3;
  const d = -2.1 + rng() * 0.4;
  let x = 0.1, y = 0.1;
  for (let i = 0; i < 4800; i++) {
    const xn = Math.sin(a * y) - Math.cos(b * x);
    const yn = Math.sin(c * x) - Math.cos(d * y);
    x = xn; y = yn;
    const px = Math.floor((x + 2.2) / 4.4 * 31);
    const py = Math.floor((y + 2.2) / 4.4 * 31);
    if (px >= 0 && px < 32 && py >= 0 && py < 32) {
      ctx.fillStyle = i % 7 === 0 ? palette[4] : i % 3 === 0 ? palette[0] : palette[3];
      ctx.fillRect(px, py, 1, 1);
    }
  }
}

function drawMoire(ctx, rng, palette) {
  const freq1 = 0.35 + rng() * 0.25;
  const freq2 = 0.28 + rng() * 0.22;
  const phase = rng() * Math.PI * 2;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const w1 = Math.sin(x * freq1 + phase);
      const w2 = Math.sin(y * freq2 + x * 0.08);
      const v = Math.abs(w1 + w2);
      ctx.fillStyle = v > 1.35 ? palette[6] : v > 0.9 ? palette[4] : v > 0.5 ? palette[0] : palette[1];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function applyGlitchShift(ctx, rng, palette, seed, streaks) {
  const imgData = ctx.getImageData(0, 0, 32, 32);
  const data = imgData.data;
  const row = new Uint8ClampedArray(32 * 4);
  for (let y = 0; y < 32; y++) {
    let shift = Math.floor((Math.sin(y * 0.7 + seed * 0.01) * 0.5 + 0.5) * 10) - 5;
    if (rng() < 0.18) shift = Math.floor(rng() * 16) - 8;
    for (let x = 0; x < 32; x++) {
      const sx = (x + shift + 32) % 32;
      const si = (y * 32 + sx) * 4;
      row[x * 4] = data[si];
      row[x * 4 + 1] = data[si + 1];
      row[x * 4 + 2] = data[si + 2];
      row[x * 4 + 3] = data[si + 3];
    }
    for (let x = 0; x < 32; x++) {
      const di = (y * 32 + x) * 4;
      data[di] = row[x * 4];
      data[di + 1] = row[x * 4 + 1];
      data[di + 2] = row[x * 4 + 2];
      data[di + 3] = row[x * 4 + 3];
    }
  }
  ctx.putImageData(imgData, 0, 0);
  if (streaks) {
    for (let i = 0; i < 7; i++) {
      if (rng() < 0.65) {
        const gy = Math.floor(rng() * 32);
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
  const warpAmp = 5 + rng() * 4;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const wx = x + (noise2D(x * 0.14, y * 0.14, seed) - 0.5) * warpAmp;
      const wy = y + (noise2D(x * 0.14 + 41, y * 0.14 + 17, seed + 31) - 0.5) * warpAmp;
      let v = 0, amp = 1, freq = 1;
      for (let o = 0; o < 4; o++) {
        v += amp * noise2D(wx * freq * 0.09, wy * freq * 0.09, seed + o * 23);
        amp *= 0.5; freq *= 2;
      }
      ctx.fillStyle = v > 0.68 ? palette[4] : v > 0.52 ? palette[0] : v > 0.36 ? palette[5] : v > 0.22 ? palette[3] : palette[1];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawClifford(ctx, rng, palette) {
  ctx.fillStyle = palette[1];
  ctx.fillRect(0, 0, 32, 32);
  const a = -1.4 + rng() * 0.8;
  const b = 1.6 + rng() * 0.6;
  const c = 1.2 + rng() * 0.5;
  const d = -0.7 + rng() * 0.6;
  let x = 0.12, y = 0.08;
  for (let i = 0; i < 5200; i++) {
    const xn = Math.sin(a * y) + c * Math.cos(a * x);
    const yn = Math.sin(b * x) + d * Math.cos(b * y);
    x = xn; y = yn;
    const px = Math.floor((x + 2.5) / 5 * 31);
    const py = Math.floor((y + 2.5) / 5 * 31);
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
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
    ctx.fillRect(Math.floor(rng() * 30), Math.floor(rng() * 30), 2, 2);
  }
}

const DRAWERS = {
  chaos: (ctx, rng, p, seed) => drawChaosGrid(ctx, rng, p),
  organic: (ctx, rng, p, seed) => drawOrganic(ctx, rng, p, seed),
  bio: (ctx, rng, p) => drawBio(ctx, rng, p),
  voronoi: (ctx, rng, p) => drawVoronoi(ctx, rng, p),
  julia: (ctx, rng, p) => drawJulia(ctx, rng, p),
  lsystem: (ctx, rng, p) => drawLSystem(ctx, rng, p),
  plasma: (ctx, rng, p, seed) => drawPlasma(ctx, rng, p, seed),
  strange: (ctx, rng, p) => drawStrangeAttractor(ctx, rng, p),
  moire: (ctx, rng, p) => drawMoire(ctx, rng, p),
  glitch: (ctx, rng, p, seed) => drawGlitchRaster(ctx, rng, p, seed),
  warp: (ctx, rng, p, seed) => drawWarp(ctx, rng, p, seed),
  clifford: (ctx, rng, p) => drawClifford(ctx, rng, p),
  cosmic: (ctx, rng, p, seed) => drawCosmic(ctx, rng, p, seed)
};

function generatePixel(seed, style) {
  const base = hashStr(seed);
  const rng = mulberry32(base);
  const palette = pickPalette(rng);
  const canvas = createCanvas(32, 32);
  const ctx = canvas.getContext('2d');
  DRAWERS[style](ctx, rng, palette, base);
  return canvas;
}

function drawVoxelBlock(ctx, x, y, color, size) {
  const top = shade(color, 42);
  const left = shade(color, -18);
  const right = shade(color, -42);
  const h = Math.max(3, Math.floor(size * 0.72));

  ctx.fillStyle = left;
  ctx.fillRect(x, y + (size - h), size, h);

  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(x + size, y + (size - h));
  ctx.lineTo(x + size + Math.floor(size * 0.28), y + (size - h) - Math.floor(size * 0.22));
  ctx.lineTo(x + size + Math.floor(size * 0.28), y + size - Math.floor(size * 0.22));
  ctx.lineTo(x + size, y + size);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(x, y + (size - h));
  ctx.lineTo(x + size, y + (size - h));
  ctx.lineTo(x + size + Math.floor(size * 0.28), y + (size - h) - Math.floor(size * 0.22));
  ctx.lineTo(x + Math.floor(size * 0.28), y + (size - h) - Math.floor(size * 0.22));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + (size - h) + 1, Math.max(1, size - 3), Math.max(1, h - 2));
}

function renderVoxels(sourceCanvas, voxelSize = 8) {
  const padX = Math.floor(voxelSize * 0.6);
  const padY = Math.floor(voxelSize * 0.5);
  const outW = 32 * voxelSize + padX + Math.floor(voxelSize * 0.3);
  const outH = 32 * voxelSize + padY + Math.floor(voxelSize * 0.3);
  const out = createCanvas(outW, outH);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#020202';
  ctx.fillRect(0, 0, outW, outH);

  const srcCtx = sourceCanvas.getContext('2d');
  const data = srcCtx.getImageData(0, 0, 32, 32).data;

  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const i = (y * 32 + x) * 4;
      const a = data[i + 3];
      if (a < 20) continue;
      const color = rgbToHex(data[i], data[i + 1], data[i + 2]);
      if (color === '#000000') continue;
      drawVoxelBlock(ctx, x * voxelSize + padX, y * voxelSize + padY, color, voxelSize);
    }
  }
  return out;
}

const EXAMPLES = [
  { style: 'chaos', seed: 'CHAOS-VOXEL-ALPHA-001' },
  { style: 'organic', seed: 'ORGANIC-TERRAIN-BETA-002' },
  { style: 'bio', seed: 'BIO-PATTERN-GAMMA-003' },
  { style: 'voronoi', seed: 'CRYSTAL-LATTICE-DELTA-004' },
  { style: 'julia', seed: 'FRACTAL-BLOOM-EPSILON-005' },
  { style: 'lsystem', seed: 'GROWTH-FORM-ZETA-006' },
  { style: 'plasma', seed: 'PLASMA-NEON-ETA-007' },
  { style: 'strange', seed: 'ATTRACTOR-THETA-008' },
  { style: 'moire', seed: 'MOIRE-INTERFERENCE-IOTA-009' },
  { style: 'glitch', seed: 'GLITCH-RASTER-KAPPA-010' },
  { style: 'warp', seed: 'WARP-DOMAIN-LAMBDA-011' },
  { style: 'clifford', seed: 'CLIFFORD-MU-012' },
  { style: 'cosmic', seed: 'COSMIC-RESONANCE-OMEGA-7777' }
];

mkdirSync(OUT_DIR, { recursive: true });

for (const ex of EXAMPLES) {
  const pixel = generatePixel(ex.seed, ex.style);
  const voxel = renderVoxels(pixel, 8);
  const file = join(OUT_DIR, `sample_${ex.style}.png`);
  writeFileSync(file, voxel.toBuffer('image/png'));
  console.log('Wrote', file);
}

console.log('Done —', EXAMPLES.length, 'samples in', OUT_DIR);