/** Local era hub checks — no deploy */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let failed = 0;
function check(l, ok, d) {
  if (ok) console.log('OK  ', l);
  else { failed++; console.error('FAIL', l, d || ''); }
}
function read(r) { return fs.readFileSync(path.join(ROOT, r), 'utf8'); }
function exists(r) { return fs.existsSync(path.join(ROOT, r)); }

check('past hub exists (untouched path)', exists('classic/hub.html'));
check('present orbit hub', exists('orbit/hub.html'));
check('present test hub', exists('orbit/test-hub.html'));
check('future hub', exists('future/hub.html'));
check('portal exists', exists('portal.html'));
check('future choir audio module', exists('assets/js/core/future-choir.js'));

const portal = read('portal.html');
const era = read('assets/js/core/era-portal.js');
const future = read('future/hub.html');
const testHub = read('orbit/test-hub.html');
const orbitHub = read('orbit/hub.html');
const classic = read('classic/hub.html');

check('portal has PAST', portal.includes('PAST') && portal.includes('pickPast'));
check('portal has PRESENT', portal.includes('PRESENT') && portal.includes('pickPresent'));
check('portal has FUTURE', portal.includes('FUTURE') && portal.includes('pickFuture'));
check('era supports future hub', era.includes("HUB_FUTURE") && era.includes('/future/hub.html'));
check('era select future', era.includes("era === 'future'") || era.includes("normalize(era)"));
check('future phrase', future.includes('think of your destination'));
check('future menu floats', future.includes('menu-wrap') && future.includes('rise'));
check('future random destinations', future.includes('DESTINATIONS') && future.includes('Math.random'));
check('future not-yet joke', future.includes('not made yet') || future.includes('Not yet'));
check('future loads choir', future.includes('future-choir.js'));
check('future pearly styles', future.includes('pearl') && future.includes('haze'));
check('dev test hub searchable', testHub.includes('search') && testHub.includes('CATALOG'));
check('dev test hub lists vision center', testHub.includes('perpetual-vision-center') || testHub.includes('VISION'));
check('present hub is orbit void (not test map)', orbitHub.includes('HOLLOW_ORBIT_HUB_ORBITS') && !orbitHub.includes('TEST SITE HUB'));
check('present floating icons (hub-bubbles)', orbitHub.includes('hub-bubbles') && orbitHub.includes('HOLLOW_ORBIT_HUB_OPTS'));
check('era present hub is orbit/hub', era.includes("HUB_ORBIT = HUB_ORBIT_BUBBLES") || /var HUB_ORBIT = ['"]\/orbit\/hub\.html['"]/.test(era) || era.includes("var HUB_ORBIT = HUB_ORBIT_BUBBLES"));
check('present hub links FUTURE', orbitHub.includes('/future/hub.html') && /FUTURE/i.test(orbitHub));
check('past hub links FUTURE', classic.includes('/future/hub.html'));
check('future is pure white', future.includes('background: #ffffff') && future.includes('future-pearl'));
check('past hub still green CRT', classic.includes('--green') || classic.includes('#00ff00'));
check('past hub has vision center', classic.includes('PERPETUAL VISION CENTER') || classic.includes('perpetual-vision-center'));

console.log('');
if (failed) { console.error(failed + ' failed'); process.exit(1); }
console.log('Era hub tests passed. No deploy.');
