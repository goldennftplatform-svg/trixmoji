/**
 * Fetch Trix Market top 3 by market cap and write data/trix-ticker.json.
 * Run on deploy or hourly via cron: node scripts/refresh-trix-ticker-cache.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
const outPath = path.join(root, 'assets', 'data', 'trix-ticker.json');
const API = 'https://trix.market/api/trending';

function flattenTrending(data) {
  const out = [];
  ['trending', 'recentlyGraduated', 'topGainers'].forEach((key) => {
    const arr = data && data[key];
    if (Array.isArray(arr)) out.push(...arr);
  });
  const seen = new Set();
  return out.filter((t) => {
    if (!t || !t.mint || seen.has(t.mint)) return false;
    seen.add(t.mint);
    return true;
  });
}

async function main() {
  const res = await fetch(API, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Trix HTTP ' + res.status);
  const data = await res.json();
  const sorted = flattenTrending(data).sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
  const top3 = sorted.slice(0, 80).map((t) => ({
    mint: t.mint,
    symbol: (t.symbol || 'TOKEN').replace(/^\$/, '').toUpperCase(),
    name: t.name || t.symbol || 'TOKEN',
    price: typeof t.price === 'number' ? t.price : null,
    change24h: typeof t.change24h === 'number' ? t.change24h : null,
    marketCap: typeof t.marketCap === 'number' ? t.marketCap : null
  }));

  const payload = {
    updatedAt: new Date().toISOString(),
    source: 'trix.market/api/trending',
    tokens: top3
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log('Wrote', outPath, '—', top3.map((t) => t.symbol).join(', '));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});