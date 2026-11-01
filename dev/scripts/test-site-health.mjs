import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'cryptodad-mobile') continue;
      walk(full, out);
    } else if (/\.html$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function check(label, ok) {
  if (!ok) {
    console.error('FAIL:', label);
    process.exitCode = 1;
  } else {
    console.log('OK:', label);
  }
}

const issues = [];

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');

  if (text.includes('assets/media//')) issues.push(`${rel}: broken media path`);
  if (/cary0x/i.test(text) && rel.includes('pond-scum')) issues.push(`${rel}: visible cary0x`);

  const refs = [...text.matchAll(/(?:src|href)=["']([^"'#?]+)/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (!ref.startsWith('/') || ref.startsWith('//')) continue;
    // Skip JS template placeholders like /assets/.../${n}.jpg
    if (ref.includes('${')) continue;
    const local = path.join(ROOT, ref.replace(/^\//, ''));
    if (!fs.existsSync(local)) issues.push(`${rel}: missing ${ref}`);
  }
}

const rabbit = fs.readFileSync(path.join(ROOT, 'classic/pages/cryptodad/rabbit.html'), 'utf8');
const icon = fs.readFileSync(path.join(ROOT, 'assets/js/core/rabbit-icon.js'), 'utf8');
const hub = fs.readFileSync(path.join(ROOT, 'classic/hub.html'), 'utf8');
const lily = fs.readFileSync(path.join(ROOT, 'classic/pages/lily-pad.html'), 'utf8');
const shell = fs.readFileSync(path.join(ROOT, 'assets/css/doswapz-shell.css'), 'utf8');

check('rabbit canvas hop page', rabbit.includes('rabbitCanvas') && rabbit.includes('requestAnimationFrame'));
// Product flow: rabbit intro → launch (not token.html)
check(
  'rabbit routes to launch page',
  rabbit.includes('/classic/pages/cryptodad/launch.html') && rabbit.includes('function enterToken')
);
check('FTWR_RABBIT decorate API', icon.includes('FTWR_RABBIT') && icon.includes('decorate'));
check('hub loads rabbit-icon.js', hub.includes('/assets/js/core/rabbit-icon.js'));
check('hub token entry -> rabbit.html', hub.includes('/classic/pages/cryptodad/rabbit.html'));
check('eat shit is direct nav (no dropdown)', hub.includes('href="/classic/pages/eat-shit.html"') && !hub.includes('Ethereum Phunks'));
check('pond scum is direct nav', hub.includes('href="/classic/pages/pond-scum.html" class="section-head section-direct"'));
check('lily pad is direct nav', hub.includes('href="/classic/pages/lily-pad.html" class="section-head section-direct"'));
check('scoreboard is direct nav', hub.includes('href="/classic/pages/cryptodad/scoreboard.html" class="section-head section-direct"'));
check('13th step is direct nav', hub.includes('href="/classic/pages/13th-step.html" class="section-head section-direct"'));
check(
  'perpetual vision center is direct nav',
  hub.includes('href="/classic/pages/perpetual-vision-center.html" class="section-head section-direct"')
);
check(
  'perpetual vision center page on disk',
  fs.existsSync(path.join(ROOT, 'classic/pages/perpetual-vision-center.html'))
);
check(
  'perpetual vision center embeds broadcast id',
  fs.readFileSync(path.join(ROOT, 'classic/pages/perpetual-vision-center.html'), 'utf8').includes('1XxyggpdQpWGM')
);
check('lily-pad video path', lily.includes('/assets/media/lily-pad.mp4') && !lily.includes('assets/media//'));
check('lily-pad.mp4 on disk', fs.existsSync(path.join(ROOT, 'assets/media/lily-pad.mp4')));
check('swap page loads rabbit-icon', fs.readFileSync(path.join(ROOT, 'classic/pages/doswapz/swap.html'), 'utf8').includes('rabbit-icon.js'));
check('rabbit icon hop animation CSS', shell.includes('ftwr-rabbit-hop') && shell.includes('--ftwr-rabbit-icon-url-alt'));
check('rabbit icon two-frame sprites', icon.includes('FRAMES') && icon.includes('svgDataUrls'));
check('rabbit intro skips price ticker', !rabbit.includes('price-ticker.js'));

// Cryptodad gallery files (images.html builds paths in JS)
let galleryOk = true;
for (let n = 1; n <= 22; n++) {
  if (!fs.existsSync(path.join(ROOT, 'assets/images/cryptodad_colorful', n + '.jpg'))) {
    issues.push('missing cryptodad_colorful/' + n + '.jpg');
    galleryOk = false;
  }
}
[
  'family_high',
  'family_low',
  'game_over',
  'good_ending',
  'heat_high',
  'last_stand'
].forEach((name) => {
  if (!fs.existsSync(path.join(ROOT, 'assets/images/cryptodad', name + '.jpg'))) {
    issues.push('missing cryptodad/' + name + '.jpg');
    galleryOk = false;
  }
});
check('cryptodad gallery assets on disk', galleryOk);

// Local server must expose all API handlers
const serverSrc = fs.readFileSync(path.join(ROOT, 'start-site-server.js'), 'utf8');
check('local server loads api handlers dynamically', serverSrc.includes('API_HANDLERS') && serverSrc.includes("apiDir"));

if (issues.length) {
  console.error('\nAsset/link issues:');
  issues.forEach((i) => console.error(' -', i));
} else {
  console.log('\nNo broken local asset links in HTML');
}

console.log(process.exitCode ? '\nSite health check failed.' : '\nSite health check passed.');