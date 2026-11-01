import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = 'http://localhost:8890/classic/pages/degen/kol-fighter-capture.html';
const out = join(root, 'assets', 'images', 'kol-fighter', 'gameplay-preview.png');

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 680, height: 420, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction(() => {
  const c = document.getElementById('c');
  return c && c.getContext('2d').getImageData(320, 180, 1, 1).data[0] > 0;
}, { timeout: 15000 });
const el = await page.$('#c');
const buf = await el.screenshot({ type: 'png' });
writeFileSync(out, buf);
await browser.close();
console.log('Saved', out);