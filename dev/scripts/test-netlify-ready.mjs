/**
 * Pre-deploy gate for DOSWAPZ-v2 on Netlify.
 * Run: node dev/scripts/test-netlify-ready.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let failed = 0;

function ok(label) {
  console.log('OK:', label);
}

function fail(label, detail) {
  console.error('FAIL:', label, detail ? `— ${detail}` : '');
  failed += 1;
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// ── Critical entry files ────────────────────────────────────────
[
  'index.html',
  'portal.html',
  '404.html',
  'classic/hub.html',
  'orbit/hub.html',
  'netlify.toml',
  '.netlifyignore',
  'package.json',
  'classic/pages/cryptodad/scoreboard.html',
  'classic/pages/basement/cryptomom/scoreboard.html',
].forEach((f) => (exists(f) ? ok(`file ${f}`) : fail(`missing ${f}`)));

// ── Netlify Functions match api/ ───────────────────────────────
const apiFiles = fs.readdirSync(path.join(ROOT, 'api')).filter((f) => f.endsWith('.js'));
const fnDir = path.join(ROOT, 'netlify', 'functions');
const fnFiles = fs.existsSync(fnDir)
  ? fs.readdirSync(fnDir).filter((f) => f.endsWith('.js') && !f.startsWith('_') && !f.includes('-cron.'))
  : [];

for (const api of apiFiles) {
  const base = api.replace(/\.js$/, '');
  const wrapper = `netlify/functions/${base}.js`;
  exists(wrapper) ? ok(`function wrapper ${base}`) : fail(`no wrapper for api/${api}`);
}

if (fnFiles.length !== apiFiles.length) {
  fail('function count', `${fnFiles.length} wrappers vs ${apiFiles.length} api handlers`);
} else {
  ok(`all ${apiFiles.length} API handlers have Netlify wrappers`);
}

// ── netlify.toml API redirects ──────────────────────────────────
const toml = read('netlify.toml');
for (const api of apiFiles) {
  const base = api.replace(/\.js$/, '');
  const needle = `from = "/api/${base}"`;
  toml.includes(needle) ? ok(`redirect ${needle}`) : fail(`missing redirect`, needle);
}

// ── KOL shelved ─────────────────────────────────────────────────
const hub = read('classic/hub.html');
hub.includes('kol-fighter') ? fail('hub still links KOL Fighter') : ok('hub has no KOL Fighter link');

const ignore = read('.netlifyignore');
ignore.includes('assets/images/kol-fighter/') ? ok('KOL images excluded') : fail('KOL images not in .netlifyignore');
ignore.includes('assets/js/degen/') ? ok('KOL JS excluded') : fail('KOL JS not in .netlifyignore');

// ── Scoreboard: no manual score input ───────────────────────────
const dadBoard = read('classic/pages/cryptodad/scoreboard.html');
dadBoard.includes('scoreInput') ? fail('Crypto Dad scoreboard still has manual input') : ok('Crypto Dad scoreboard last-run only');
dadBoard.includes('pending_score') ? ok('Crypto Dad pending_score flow') : fail('Crypto Dad pending_score missing');

const momBoard = read('classic/pages/basement/cryptomom/scoreboard.html');
momBoard.includes('scoreInput') ? fail('Crypto Mom scoreboard still has manual input') : ok('Crypto Mom scoreboard last-run only');

// ── Orbit hub uses stationary bubbles ───────────────────────────
const orbitHub = read('orbit/hub.html');
orbitHub.includes('HOLLOW_ORBIT_HUB_OPTS') ? ok('orbit hub stationary bubble opts') : fail('orbit hub missing HOLLOW_ORBIT_HUB_OPTS');

// ── Adapter has res.send ────────────────────────────────────────
const adapter = read('netlify/functions/_vercel-adapter.js');
adapter.includes('send:') ? ok('function adapter res.send') : fail('adapter missing res.send');

console.log(failed ? `\n${failed} check(s) failed — fix before deploy.` : '\nAll Netlify readiness checks passed.');
process.exit(failed ? 1 : 0);