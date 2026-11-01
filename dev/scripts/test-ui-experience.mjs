import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function check(label, ok) {
  if (!ok) {
    console.error('FAIL:', label);
    process.exitCode = 1;
  } else {
    console.log('OK:', label);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

check('page-transition.js', fs.existsSync(path.join(ROOT, 'assets/js/core/page-transition.js')));
check('site-shell.js', fs.existsSync(path.join(ROOT, 'assets/js/core/site-shell.js')));
check('hub-menu.js', fs.existsSync(path.join(ROOT, 'assets/js/core/hub-menu.js')));

const hub = read('hub.html');
const shell = read('assets/css/doswapz-shell.css');
const glitch = read('assets/js/core/glitch.js');
const ticker = read('assets/js/core/price-ticker.js');
const scum = read('assets/js/pond/scum.js');

check('hub flavor line', hub.includes('hubFlavorLine'));
check('hub menu module', hub.includes('hub-menu.js'));
check('hub loads site-shell', hub.includes('site-shell.js'));
check('hub data-flavor on pond', hub.includes('data-flavor="dossier terminal'));
check('tube-power CSS', shell.includes('.tube-power'));
check('glitch dial CSS', shell.includes('.glitch-dial'));
check('no menu-focus keyboard CSS', !shell.includes('.menu-focus'));
check('pond badge chips CSS', shell.includes('.pond-badge-chip'));
check('glitch profiles', glitch.includes('GLITCH_PROFILES'));
check('ticker world state', ticker.includes('worldStateItemHtml') && ticker.includes('appendWorldState'));
check('ticker loads site shell', ticker.includes('loadDosShell'));
check('scum badge strip', scum.includes('renderBadgeStrip'));
check('lily skip intro', read('pages/lily-pad.html').includes('doswapz_skip_lily'));
check('rabbit skip intro', read('pages/cryptodad/rabbit.html').includes('doswapz_skip_rabbit'));
check('start-local.cmd', fs.existsSync(path.join(ROOT, 'dev/scripts/start-local.cmd')));

console.log(process.exitCode ? '\nUI experience checks failed.' : '\nAll UI experience checks passed.');