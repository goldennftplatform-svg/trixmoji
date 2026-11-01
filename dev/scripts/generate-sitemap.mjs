/**
 * Build sitemap.xml from public classic + orbit pages + entry points.
 * Excludes KOL fighter, previews, capture tools, tests.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = 'https://doswapz.com';
const OUT = path.join(ROOT, 'sitemap.xml');

const EXCLUDE = [
  /kol-fighter/i,
  /preview/i,
  /capture/i,
  /looks-like-reference/i,
  /degen-poses/i,
  /degen-32bit/i,
  /characters-preview/i,
  /4th test/i,
  /test-/i,
  /\/dev\//i,
  /harbinger-face-test/i,
  /harbinger-float-test/i
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.html$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function toUrl(rel) {
  return BASE + '/' + rel.replace(/\\/g, '/').replace(/^\//, '');
}

const entries = new Set();
entries.add('/');
entries.add('/classic/hub.html');
entries.add('/orbit/hub.html');
entries.add('/portal.html');
entries.add('/harbinger.html');

for (const file of [...walk(path.join(ROOT, 'classic')), ...walk(path.join(ROOT, 'orbit'))]) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (EXCLUDE.some((re) => re.test(rel))) continue;
  entries.add('/' + rel);
}

const sorted = [...entries].sort();
const today = new Date().toISOString().slice(0, 10);

const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  sorted
    .map((loc) => {
      let priority = '0.5';
      let freq = 'monthly';
      if (loc === '/') {
        priority = '1.0';
        freq = 'weekly';
      } else if (loc.includes('hub.html')) {
        priority = '0.9';
        freq = 'weekly';
      } else if (loc.includes('swap') || loc.includes('mint') || loc.includes('harbinger')) {
        priority = '0.8';
        freq = 'weekly';
      } else if (loc.includes('portal')) {
        priority = '0.7';
        freq = 'weekly';
      }
      return (
        '  <url><loc>' +
        toUrl(loc === '/' ? '' : loc.slice(1)) +
        '</loc><lastmod>' +
        today +
        '</lastmod><changefreq>' +
        freq +
        '</changefreq><priority>' +
        priority +
        '</priority></url>'
      );
    })
    .join('\n') +
  '\n</urlset>\n';

// Fix root loc
const fixed = xml.replace(
  BASE + '//',
  BASE + '/'
);

fs.writeFileSync(OUT, fixed, 'utf8');
console.log('Wrote', OUT, 'urls=', sorted.length);
