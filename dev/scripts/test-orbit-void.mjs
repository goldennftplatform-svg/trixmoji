#!/usr/bin/env node
/** Verify orbit void pages match merge-a shell requirements */
const BASE = process.env.ORBIT_TEST_BASE || 'http://localhost:8890';

const pages = [
  '/orbit/hub.html',
  '/orbit/pages/doswapz/swap.html',
  '/orbit/pages/attic.html',
  '/orbit/pages/basement.html',
  '/orbit/pages/pond-scum.html',
];

const mustHave = [
  'orbit-void.css',
  'hollow-base.css',
  'tm-static',
  '/portal.html',
  'TIME MACHINE',
];

const mustNotHave = [
  'hollow-v2.css',
  'doswapz-shell.css',
  'orbit-page.css',
  'void-veil',
  'orbit-tm-static',
  'CLASSIC HUB',
];

const hubOnly = [
  'hollowMandelBg',
  'hollowStars(',
];

const innerOnly = [
  'orbit-void-content.css',
  'orbit-void-inner',
  'id="orbitPanel"',
  'hollowPageBoot',
  'hollow-page-boot.js',
];

let failed = 0;

async function check(path) {
  const url = BASE + path;
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    console.error('FAIL', path, '— cannot fetch:', e.message);
    failed++;
    return;
  }
  if (!res.ok) {
    console.error('FAIL', path, '— HTTP', res.status);
    failed++;
    return;
  }
  const html = await res.text();
  const isHub = path.includes('/hub.html');
  for (const s of mustHave) {
    if (!html.includes(s)) {
      console.error('FAIL', path, '— missing:', s);
      failed++;
    }
  }
  for (const s of mustNotHave) {
    if (html.includes(s)) {
      console.error('FAIL', path, '— should not have:', s);
      failed++;
    }
  }
  if (isHub) {
    for (const s of hubOnly) {
      if (!html.includes(s)) {
        console.error('FAIL', path, '— hub missing:', s);
        failed++;
      }
    }
    if (!html.includes('HOLLOW_ORBIT_HUB_ORBITS')) {
      console.error('FAIL', path, '— hub must use HOLLOW_ORBIT_HUB_ORBITS');
      failed++;
    }
    if (html.includes('orbit-void-inner')) {
      console.error('FAIL', path, '— hub should not use inner page class');
      failed++;
    }
  } else {
    for (const s of innerOnly) {
      if (!html.includes(s)) {
        console.error('FAIL', path, '— inner page missing:', s);
        failed++;
      }
    }
    if (html.match(/scatter:true[^}]+portal\.html/)) {
      console.error('FAIL', path, '— TIME MACHINE must not be a shy floater');
      failed++;
    }
  }
  if (!failed) console.log('OK  ', path);
}

console.log('Testing orbit void at', BASE);
for (const p of pages) await check(p);

const assetChecks = ['/assets/css/orbit-void.css', '/assets/css/orbit-void-content.css'];
for (const p of assetChecks) {
  try {
    const r = await fetch(BASE + p);
    if (!r.ok) { console.error('FAIL', p, 'HTTP', r.status); failed++; }
    else console.log('OK  ', p);
  } catch (e) {
    console.error('FAIL', p, e.message);
    failed++;
  }
}

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nAll orbit void checks passed');