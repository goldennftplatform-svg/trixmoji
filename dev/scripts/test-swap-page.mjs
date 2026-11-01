/**
 * Static checks for doswapz-swap.html wiring (no browser).
 * Run: node scripts/test-swap-page.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'doswapz-swap.html');
const jsPath = path.join(root, 'js', 'doswapz-swap.js');

let failed = 0;

function check(label, ok) {
  if (ok) console.log(`PASS  ${label}`);
  else {
    failed++;
    console.error(`FAIL  ${label}`);
  }
}

const html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

check('doswapz-swap.html exists', fs.existsSync(htmlPath));
check('js/doswapz-swap.js exists', fs.existsSync(jsPath));
check('HTML loads ftwr-config.js', html.includes('ftwr-config.js'));
check('HTML loads ftwr-rabbit-icon.js', html.includes('js/ftwr-rabbit-icon.js'));
check('HTML loads doswapz-trix-tokens.js', html.includes('js/doswapz-trix-tokens.js'));
check('HTML loads doswapz-swap-stats.js', html.includes('js/doswapz-swap-stats.js'));
check('HTML loads doswapz-swap.js', html.includes('js/doswapz-swap.js'));
check('HTML loads doswapz-price-ticker.js', html.includes('js/doswapz-price-ticker.js'));
check('HTML loads @solana/web3.js', html.includes('@solana/web3.js'));
check('No redacted class on screen', !html.includes('dos-screen redacted'));
check('No undisclosed overlay', !html.includes('undisclosed-overlay'));
check('No SIMULATED swap label', !html.includes('SWAP (SIMULATED)'));
check('connectSwapWallet wired', html.includes('connectSwapWallet()'));
check('simulateSwap wired', html.includes('simulateSwap()'));
check('Custom mint inputs present', html.includes('fromCustomMint') && html.includes('toCustomMint'));
check('No Trix search panel', !html.includes('trix-panel') && !html.includes('trixSearchInput'));
check('Trix dropdown note present', html.includes('trix-dropdown-note'));
check('Wallet balance element present', html.includes('walletBalanceSwap'));
check('Swap live counter ticker present', html.includes('swapCountValue') && html.includes('swap-live-ticker'));
check('Price ticker script present', html.includes('js/doswapz-price-ticker.js'));
check('Auto-disconnect disclaimer present', html.includes('auto-disconnects after every completed swap'));
check('No Trix chip UI', !html.includes('trixUseFromBtn') && !html.includes('trixTokenList'));

const trixJs = fs.readFileSync(path.join(root, 'js', 'doswapz-trix-tokens.js'), 'utf8');
const rabbitJs = fs.readFileSync(path.join(root, 'js', 'ftwr-rabbit-icon.js'), 'utf8');

const requiredFns = [
  'connectSwapWallet',
  'disconnectSwapWallet',
  'updateSwapQuote',
  'simulateSwap',
  'updateNodeRoute',
  'fetchQuoteBundle',
  'fetchV2Order',
  'buildSwapTransaction',
  'lookupDecimals',
  'populateTrixSelectOptions',
  'loadTrixCatalog',
  'refreshWalletBalances',
  'disconnectSwapWallet',
];
for (const fn of requiredFns) {
  check(`JS defines ${fn}`, js.includes(fn));
}

check('No removed Trix search UI', !js.includes('renderTrixTokenList') && !js.includes('trixSearchInput'));
check('Trix module defines refreshCatalog', trixJs.includes('refreshCatalog'));
check('Trix module defines searchTokens', trixJs.includes('searchTokens'));
check('Trix module defines getPinnedToken', trixJs.includes('getPinnedToken'));
check('Trix module defines getTopByMarketCap', trixJs.includes('getTopByMarketCap'));
check('Trix module stores marketCap', trixJs.includes('marketCap'));
check('Price ticker module exists', fs.existsSync(path.join(root, 'js', 'doswapz-price-ticker.js')));
check('Rabbit icon module defines decorate', rabbitJs.includes('decorate'));
check('ftwr-config has trixMint field', fs.readFileSync(path.join(root, 'ftwr-config.js'), 'utf8').includes('trixMint'));
check('Swap stats JSON seeded', fs.existsSync(path.join(root, 'data', 'swap-stats.json')));
check('Swap stats module exists', fs.existsSync(path.join(root, 'js', 'doswapz-swap-stats.js')));
check('Swap success records stats', js.includes('DOSWAPZ_SWAP_STATS.recordSwap'));

check('Jupiter v1 API base', js.includes('api.jup.ag/swap/v1'));
check('lite-api fallback', js.includes('lite-api.jup.ag/swap/v1'));

console.log(failed ? `\n${failed} check(s) failed` : '\nAll page wiring checks passed');
process.exit(failed > 0 ? 1 : 0);