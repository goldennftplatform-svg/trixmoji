/**
 * Render the FTWR white pixel rabbit as a large JPG.
 * Run: node scripts/render-ftwr-rabbit-jpg.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'images');
const outPath = path.join(outDir, 'ftwr-white-rabbit.jpg');

const FRAME = [
  '..WW....',
  '.WWWW...',
  '.WBBW...',
  '.WWWW...',
  'WWWWWW..',
  '..WW.WW.',
  '..W..W..',
  '...WW...'
];

const WIDTH = 1920;
const HEIGHT = 1920;
const PIXEL = Math.floor(Math.min(WIDTH, HEIGHT) / 12);
const BG = '#000000';

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

ctx.fillStyle = BG;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

const rabbitW = FRAME[0].length * PIXEL;
const rabbitH = FRAME.length * PIXEL;
const offsetX = Math.floor((WIDTH - rabbitW) / 2);
const offsetY = Math.floor((HEIGHT - rabbitH) / 2);

for (let row = 0; row < FRAME.length; row++) {
  for (let col = 0; col < FRAME[row].length; col++) {
    const ch = FRAME[row][col];
    if (ch === 'W') ctx.fillStyle = '#ffffff';
    else if (ch === 'B') ctx.fillStyle = '#000000';
    else continue;

    ctx.fillRect(
      offsetX + col * PIXEL,
      offsetY + row * PIXEL,
      PIXEL,
      PIXEL
    );
  }
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
fs.writeFileSync(outPath, buffer);

console.log('Wrote', outPath);
console.log('Size:', WIDTH + 'x' + HEIGHT, 'px, pixel block:', PIXEL + 'px');