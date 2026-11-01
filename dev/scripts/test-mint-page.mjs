/**
 * Static checks for doswapz-mint.html live mint wiring (no browser).
 * Run: node scripts/test-mint-page.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'doswapz-mint.html');
const cfgPath = path.join(root, 'js', 'doswapz-mint-config.js');
const mathPath = path.join(root, 'js', 'doswapz-math-mint.js');

let failed = 0;

function check(label, ok) {
  if (ok) console.log(`PASS  ${label}`);
  else {
    failed++;
    console.error(`FAIL  ${label}`);
  }
}

const html = fs.readFileSync(htmlPath, 'utf8');
const cfg = fs.readFileSync(cfgPath, 'utf8');
const math = fs.readFileSync(mathPath, 'utf8');

check('doswapz-mint.html exists', fs.existsSync(htmlPath));
check('js/doswapz-mint-config.js exists', fs.existsSync(cfgPath));
check('js/doswapz-math-mint.js exists', fs.existsSync(mathPath));
check('HTML loads ethers', html.includes('ethers') && html.includes('umd.min.js'));
check('HTML loads doswapz-mint-config.js', html.includes('js/doswapz-mint-config.js'));
check('HTML loads doswapz-math-mint.js', html.includes('js/doswapz-math-mint.js'));
check('LIVE badge present', html.includes('>LIVE</span>'));
check('No undisclosed overlay', !html.includes('undisclosed-overlay'));
check('No PREVIEW ONLY wallet block', !html.includes('PREVIEW ONLY — NO WALLET CONNECT'));
check('No NOT LIVE status', !html.includes('NOT LIVE'));
check('connectWallet wired', html.includes('connectWallet()'));
check('disconnectWallet wired', html.includes('disconnectWallet()'));
check('mintNow wired', html.includes('mintNow()'));
check('Auto-disconnect after mint', html.includes('disconnectWallet();') && html.includes('Reconnect if you want to mint again'));
check('Mainnet chain guard', html.includes('MINT_CHAIN_ID') && html.includes('assertMainnet'));
check('Mint busy lock', html.includes('mintInFlight') && html.includes('setMintBusy'));
check('Recipient from config', html.includes('MINT_RECIPIENT') && html.includes('DOSWAPZ_MINT_CONFIG'));
check('Config has recipient', cfg.includes('0x5be58476DF379BAdc88b552F603db227C0D95bac'));
check('Config price 0.001 ETH', cfg.includes('priceEth: 0.001'));
check('Math module saveMint', math.includes('function saveMint'));

console.log(failed ? `\n${failed} check(s) failed` : '\nAll mint page wiring checks passed');
process.exit(failed > 0 ? 1 : 0);