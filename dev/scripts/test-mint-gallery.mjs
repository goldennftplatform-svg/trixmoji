/** Mint gallery checks — past + present (local files) */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let failed = 0;
function check(l, ok) {
  if (ok) console.log('OK  ', l);
  else { failed++; console.error('FAIL', l); }
}
function read(r) { return fs.readFileSync(path.join(ROOT, r), 'utf8'); }
function exists(r) { return fs.existsSync(path.join(ROOT, r)); }

const classic = read('classic/pages/doswapz/gallery.html');
const orbit = read('orbit/pages/doswapz/gallery.html');
const js = read('assets/js/mint/mint-gallery.js');
const hub = read('classic/hub.html');

check('classic gallery exists', exists('classic/pages/doswapz/gallery.html'));
check('orbit gallery exists', exists('orbit/pages/doswapz/gallery.html'));
check('mint-gallery.js exists', exists('assets/js/mint/mint-gallery.js'));

check('classic soft connect button', classic.includes('galleryConnectBtn') && classic.includes('SOFT CONNECT'));
check('orbit soft connect button', orbit.includes('galleryConnectBtn') && orbit.includes('SOFT CONNECT'));
check('classic FLOORED.APP', classic.includes('floored.app') || classic.includes('FLOORED.APP'));
check('orbit FLOORED.APP', orbit.includes('floored.app') || orbit.includes('FLOORED.APP'));
check('classic disclaimers', classic.includes('NO responsibility') || classic.includes('no funds'));
check('orbit disclaimers', orbit.includes('NO responsibility') || orbit.includes('no funds'));
check('classic loads mint-gallery.js', classic.includes('/assets/js/mint/mint-gallery.js'));
check('orbit loads mint-gallery.js', orbit.includes('/assets/js/mint/mint-gallery.js'));
check('classic loads math-mint.js', classic.includes('/assets/js/mint/math-mint.js'));
check('orbit loads math-mint.js', orbit.includes('/assets/js/mint/math-mint.js'));

check('js soft personal_sign', js.includes('personal_sign'));
check('js FLOORED url', js.includes('floored.app'));
check('js no fund messaging', js.includes('NO FUNDS'));
check('js sample gallery', js.includes('sampleEntries') || js.includes('SHOW SAMPLES'));

check('hub links mint gallery', hub.includes('/classic/pages/doswapz/gallery.html'));
check('past era label on classic', classic.includes('PAST') || classic.includes('PAST ERA'));
check('present era on orbit', orbit.includes('PRESENT') || orbit.includes('present'));

console.log('');
if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('Mint gallery past+present tests passed.');
console.log('PAST:    /classic/pages/doswapz/gallery.html');
console.log('PRESENT: /orbit/pages/doswapz/gallery.html');
