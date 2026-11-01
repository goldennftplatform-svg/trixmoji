/**
 * Local tests for Perpetual Vision Vault — no deploy.
 * Run: node dev/scripts/test-perpetual-vision-vault.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const FEEDS = [
  {
    id: '1XxyggpdQpWGM',
    url: 'https://x.com/i/broadcasts/1XxyggpdQpWGM',
    handle: 'boudahh',
    name: 'The P.I.G.'
  },
  {
    id: '1mxPaaAVyodKN',
    url: 'https://x.com/i/broadcasts/1mxPaaAVyodKN',
    handle: 'Sparrow_X_',
    name: 'Sparrow'
  }
];

let failed = 0;

function check(label, ok, detail) {
  if (ok) console.log('OK  ', label);
  else {
    failed += 1;
    console.error('FAIL', label, detail || '');
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

check('classic page exists', exists('classic/pages/perpetual-vision-vault.html'));
check('orbit page exists', exists('orbit/pages/perpetual-vision-vault.html'));

const classic = read('classic/pages/perpetual-vision-vault.html');
const orbit = read('orbit/pages/perpetual-vision-vault.html');
const hub = read('classic/hub.html');
const hollow = read('assets/js/core/hollow-orbit.js');
const shell = read('assets/js/core/site-shell.js');
const vercel = read('vercel.json');
const netlify = read('netlify.toml');

// Layout / playlist
check('classic playlist layout', classic.includes('vault-layout') && classic.includes('playlist'));
check('classic playlist UI', classic.includes('PLAYLIST') && classic.includes('pl-item'));
check('classic creator credits board', classic.includes('CREATOR CREDITS') || classic.includes('credits-list'));
check('classic DOSWAPZ_PVV feeds array', classic.includes('DOSWAPZ_PVV') && classic.includes('feeds:'));
check('classic loads widgets.js', classic.includes('platform.x.com/widgets.js'));

check('orbit playlist layout', orbit.includes('vault-layout') && orbit.includes('playlist'));
check('orbit DOSWAPZ_PVV feeds', orbit.includes('feeds:') && orbit.includes('DOSWAPZ_PVV'));
check('orbit loads widgets.js', orbit.includes('platform.x.com/widgets.js'));

// Both feeds + credits
for (const f of FEEDS) {
  check(`classic has broadcast ${f.id}`, classic.includes(f.id) && classic.includes(f.url));
  check(`classic credits @${f.handle}`, classic.includes(f.handle) && classic.includes(`https://x.com/${f.handle}`));
  check(`classic names ${f.name}`, classic.includes(f.name));

  check(`orbit has broadcast ${f.id}`, orbit.includes(f.id) && orbit.includes(f.url));
  check(`orbit credits @${f.handle}`, orbit.includes(f.handle) && orbit.includes(`https://x.com/${f.handle}`));
}

check('classic has both feed ids', classic.includes(FEEDS[0].id) && classic.includes(FEEDS[1].id));
check('orbit has both feed ids', orbit.includes(FEEDS[0].id) && orbit.includes(FEEDS[1].id));
check('classic courtesy credit pattern', classic.includes('LIVE FEED COURTESY OF') || classic.includes('COURTESY OF'));

// Hub / orbit bubble / config
check(
  'hub has Perpetual Vision Vault option',
  hub.includes('PERPETUAL VISION VAULT') &&
    hub.includes('href="/classic/pages/perpetual-vision-vault.html"')
);
check(
  'hub option is section-direct',
  hub.includes('href="/classic/pages/perpetual-vision-vault.html" class="section-head section-direct"')
);
check(
  'orbit hub bubble points to vault page',
  hollow.includes('/orbit/pages/perpetual-vision-vault.html')
);
check('site-shell classic crumb', shell.includes("'/classic/pages/perpetual-vision-vault.html'"));
check('site-shell orbit crumb', shell.includes("'/orbit/pages/perpetual-vision-vault.html'"));
check('vercel short path', vercel.includes('/perpetual-vision-vault'));
check('netlify short path', netlify.includes('/perpetual-vision-vault'));

// oEmbed for both broadcasts
for (const f of FEEDS) {
  try {
    const res = await fetch(
      'https://publish.x.com/oembed?url=' + encodeURIComponent(f.url),
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) {
      check(`X oEmbed ${f.id}`, false, 'HTTP ' + res.status);
      continue;
    }
    const data = await res.json();
    check(
      `X oEmbed ${f.id} ok`,
      typeof data.html === 'string' &&
        (data.html.includes(f.id) || data.html.includes('twitter-broadcast'))
    );
  } catch (e) {
    console.warn('SKIP oEmbed', f.id, e.message || e);
  }
}

console.log('');
if (failed) {
  console.error(failed + ' test(s) failed.');
  process.exit(1);
}
console.log('All Perpetual Vision Vault playlist tests passed.');
console.log('Feeds: PondTV (@boudahh) + PAULY (@Sparrow_X_)');
console.log('NOT deployed — wait for permission before netlify deploy.');
