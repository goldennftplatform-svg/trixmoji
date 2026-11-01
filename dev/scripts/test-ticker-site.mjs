/**
 * Verify live ticker is on all root HTML pages except index.html (home splash).
 * Run: node scripts/test-ticker-site.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const TICKER = 'js/doswapz-price-ticker.js';
const SHELL = 'css/doswapz-shell.css';

let failed = 0;

function check(label, ok) {
  if (ok) console.log(`PASS  ${label}`);
  else {
    failed++;
    console.error(`FAIL  ${label}`);
  }
}

const htmlFiles = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
const tickerJs = fs.readFileSync(path.join(root, 'js', 'doswapz-price-ticker.js'), 'utf8');
const shellCss = fs.readFileSync(path.join(root, 'css', 'doswapz-shell.css'), 'utf8');

check('Ticker module auto-injects DOM', tickerJs.includes('ensureTickerDom'));
check('Shell CSS has ticker styles', shellCss.includes('.price-ticker-bar'));
check('Shell CSS bumps comsec above ticker', shellCss.includes('body.has-doswapz-ticker .comsec'));
check('Pond tokens priced in USDC', tickerJs.includes('fetchPondUsdcPrice') && tickerJs.includes("quote: 'USDC'"));
check('Ticker refreshes hourly', tickerJs.includes('60 * 60 * 1000'));
check('Ticker fetches Trix top 3 by market cap', tickerJs.includes('top3ByMarketCap') && tickerJs.includes('TRIX.MARKET'));
check('Ticker has static Trix fallback', tickerJs.includes('data/trix-ticker.json'));
check('Ticker uses Trix API proxy (CORS-safe)', tickerJs.includes('/api/trix-ticker'));
check('Trix cache JSON exists', fs.existsSync(path.join(root, 'data', 'trix-ticker.json')));
check('Ticker includes swap counter hook', tickerJs.includes('ensureSwapStats') && tickerJs.includes('DOSWAPZ_SWAP_STATS'));
check('Swap stats JSON exists', fs.existsSync(path.join(root, 'data', 'swap-stats.json')));

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const hasTicker = html.includes(TICKER);

  if (file === 'index.html') {
    check('Home splash excludes ticker', !hasTicker);
  } else {
    check(`${file} includes ticker script`, hasTicker);
    check(`${file} includes shell CSS`, html.includes(SHELL));
  }
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll site-wide ticker checks passed');
process.exit(failed > 0 ? 1 : 0);