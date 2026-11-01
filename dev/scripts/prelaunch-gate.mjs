/**
 * Final pre-launch gate before Netlify production deploy.
 * node dev/scripts/prelaunch-gate.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let failed = 0;

function ok(msg) {
  console.log('OK:', msg);
}
function fail(msg) {
  console.error('FAIL:', msg);
  failed += 1;
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

const mustFiles = [
  'index.html',
  'portal.html',
  'classic/hub.html',
  'orbit/hub.html',
  'orbit/test-hub.html',
  'orbit/pages/harbinger.html',
  'classic/pages/harbinger.html',
  'orbit/pages/doswapz/swap.html',
  'classic/pages/doswapz/swap.html',
  'orbit/pages/doswapz/bridge.html',
  'classic/pages/doswapz/bridge.html',
  'orbit/pages/i-see-you.html',
  'orbit/pages/perpetual-vision-center.html',
  'orbit/pages/13th-step.html',
  'orbit/pages/degen/trailer.html',
  'classic/pages/basement/token-launcher.html',
  'orbit/pages/basement/token-launcher.html',
  'classic/pages/basement/vantablack/market.html',
  'orbit/pages/basement/vantablack/market.html',
  'assets/js/swap/bridge.js',
  'assets/js/config/chains-config.js',
  'assets/js/basement/token-launcher-multichain.js',
  'assets/js/basement/token-launcher-evm.js',
  'assets/js/basement/vb-erc20-artifact.js',
  'assets/css/harbinger-llm.css',
  'assets/css/orbit-void-content.css',
  'assets/css/swap-orbit.css',
  'assets/images/harbinger/head-float-core.png',
  'netlify.toml',
  '.netlifyignore',
];

for (const f of mustFiles) {
  exists(f) ? ok(`file ${f}`) : fail(`missing ${f}`);
}

const markers = [
  ['assets/js/config/chains-config.js', ['Robinhood Chain', '4663', 'ROBINHOOD_CHAIN_ID']],
  ['assets/js/swap/bridge.js', ['Robinhood', 'multi-chain']],
  ['orbit/pages/doswapz/bridge.html', ['chains-config.js', 'bridge.js', 'Robinhood']],
  ['classic/pages/doswapz/bridge.html', ['chains-config.js', 'bridge.js']],
  ['orbit/pages/basement/token-launcher.html', ['token-launcher-multichain', 'chains-config']],
  ['classic/pages/basement/token-launcher.html', ['token-launcher-multichain', 'chains-config']],
  ['orbit/pages/harbinger.html', ['hb-head-block', 'shardsOnly', 'border: none']],
  ['assets/css/orbit-void-content.css', ['Harbinger head must never']],
  ['orbit/hub.html', ['HOLLOW_ORBIT_HUB_ORBITS', 'PRESENT', 'TIME MACHINE']],
  ['orbit/test-hub.html', ['harbinger', 'swap', 'bridge']],
  ['assets/js/core/era-portal.js', ['HUB_ORBIT_BUBBLES', "var HUB_ORBIT = HUB_ORBIT_BUBBLES"]],
  ['orbit/pages/i-see-you.html', ['i-see-you']],
  ['classic/pages/basement/phunk-maker.html', ['24 x 24']],
];

for (const [f, need] of markers) {
  if (!exists(f)) {
    fail(`markers missing file ${f}`);
    continue;
  }
  const s = read(f);
  const miss = need.filter((n) => !s.includes(n));
  if (miss.length) fail(`${f} missing: ${miss.join(', ')}`);
  else ok(`markers ${f}`);
}

// Outer panel must NOT be force-killed on harbinger
const hb = read('orbit/pages/harbinger.html');
if (/orbit-panel\.accent-hub\s*\{[\s\S]*?border:\s*none\s*!important/.test(hb)) {
  fail('harbinger still kills outer orbit-panel box');
} else {
  ok('harbinger keeps outer panel box');
}

// dev test map may still ship (optional), but present must not depend on it
const ignore = read('.netlifyignore');
if (ignore.split(/\r?\n/).some((l) => l.trim() === 'orbit/hub.html')) {
  fail('.netlifyignore excludes orbit/hub.html (present hub)');
} else {
  ok('present hub not excluded from deploy');
}

// mojibake on launch-critical pages
const critical = [
  'orbit/pages/harbinger.html',
  'orbit/pages/doswapz/swap.html',
  'orbit/pages/doswapz/bridge.html',
  'orbit/pages/i-see-you.html',
  'orbit/pages/perpetual-vision-center.html',
  'orbit/pages/13th-step.html',
  'orbit/pages/degen/trailer.html',
  'orbit/test-hub.html',
  'orbit/hub.html',
  'classic/hub.html',
  'classic/pages/basement/phunk-maker.html',
  'classic/pages/basement/token-launcher.html',
  'orbit/pages/basement/token-launcher.html',
];
const moji = /â€|â€™|â€œ|â€|â–|Ã—|Ã\u00a0/;
for (const f of critical) {
  const s = read(f);
  if (moji.test(s)) fail(`mojibake in ${f}`);
  else ok(`encoding ${f}`);
}

console.log(failed ? `\n${failed} check(s) failed — DO NOT DEPLOY.` : '\nPre-launch gate PASSED. Safe to deploy once.');
process.exit(failed ? 1 : 0);
