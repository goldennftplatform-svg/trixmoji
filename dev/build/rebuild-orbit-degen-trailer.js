/**
 * Rebuild present degen trailer from classic with clean ASCII titles.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const classic = fs.readFileSync(path.join(root, 'classic', 'pages', 'degen', 'trailer.html'), 'utf8');

const styleMatch = classic.match(/<style>([\s\S]*?)<\/style>/);
let style = styleMatch ? styleMatch[1] : '';
// Soften classic full-page black for orbit panel use
style = style
 .replace(/html\s*,\s*body\s*\{[\s\S]*?\}/, '/* html,body handled by orbit shell */')
 .replace(/\.dos-screen\s*\{[\s\S]*?\}/, '.dos-screen { position:relative; min-height:0; background:transparent; padding:0; }')
 .replace(/\.dos-screen::before\s*\{[\s\S]*?\}/, '/* scanlines stripped */')
 .replace(/\.header\s*\{[\s\S]*?\}/, '/* header stripped - stage title used */')
 .replace(/\.subhead\s*\{[\s\S]*?\}/, '/* subhead stripped */');

const contentMatch = classic.match(
 /<div class="content"[^>]*>([\s\S]*?)<\/div>\s*(?:<!--\s*Glitch|<div class="glitch)/
) || classic.match(/<div class="content"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<script/);

let content = contentMatch ? contentMatch[1] : '';
content = content
 .replace(/href="\/classic\/hub\.html"/g, 'href="/orbit/hub.html"')
 .replace(/href="\/classic\/pages\/degen\//g, 'href="/orbit/pages/degen/')
 .replace(/href="\/classic\/pages\//g, 'href="/orbit/pages/')
 .replace(/<- BACK TO HUB/g, 'HUB')
 .replace(/&#8592; BACK TO HUB/g, 'HUB');

// ASCII-clean any em dashes in content
content = content.split(' - ').join(' - ').split(' - ').join(' - ').split(' * ').join(' * ');

const scriptsMatch = classic.match(/(<script[\s\S]*?<\/script>\s*)+<\/body>/);
let scripts = '';
if (scriptsMatch) {
 scripts = scriptsMatch[0].replace(/<\/body>/, '');
 // Drop glitch init that targets classic selectors; we re-init for orbit
 scripts = scripts.replace(
 /<script>\s*if\s*\(window\.DOSWAPZ_GLITCH\)[\s\S]*?<\/script>/g,
 ''
 );
 scripts = scripts.replace(
 /DOSWAPZ_GLITCH\.init\([\s\S]*?\);\s*/g,
 ''
 );
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <script>
 (function(){if(location.protocol!=='file:')return;var u='http://127.0.0.1:8890/orbit/pages/degen/trailer.html';document.documentElement.innerHTML='<head><meta charset="UTF-8"><title>DOSWAPZ</title></head><body style="margin:0;background:#000;color:#0f0;font-family:monospace;padding:40px"><p>Open via local server:</p><p><a href="'+u+'" style="color:#6cf">'+u+'</a></p></body>';})();
 </script>
 <title>DOSWAPZ // DEGEN$ - OFFICIAL TRAILER // ORBIT</title>
 <link rel="stylesheet" href="/assets/css/hollow-base.css">
 <link rel="stylesheet" href="/assets/css/orbit-void.css">
 <link rel="stylesheet" href="/assets/css/orbit-void-content.css">
 <link rel="stylesheet" href="/assets/css/era-transition.css">
 <style class="page-classic-styles">
@import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
${style}

 body#screen.orbit-void-inner.degen-trailer-orbit .orbit-panel.accent-degen {
 width: min(920px, 94vw) !important;
 max-width: 920px !important;
 border-style: solid !important;
 background: rgba(6, 2, 8, 0.95) !important;
 }
 body#screen.orbit-void-inner.degen-trailer-orbit .orbit-panel.accent-degen::before {
 display: none !important;
 }
 body#screen.orbit-void-inner.degen-trailer-orbit .float-field {
 display: none !important;
 }
 </style>
</head>
<body id="screen" class="orbit-void-inner degen-trailer-orbit">
 <canvas class="bg-canvas" id="bg" aria-hidden="true"></canvas>
 <div id="stars"></div>
 <div class="grain"></div>
 <div class="vignette"></div>
 <div class="glitch-layer" id="glitchLayer"></div>
 <div class="cursor-ghost" id="cursorGhost"></div>

 <nav class="ref-crumbs" style="color:rgba(255,255,255,0.15)">
 <span class="crumb-zone">DEGEN$ TRAILER</span>
 <a href="/portal.html" class="tm-static">TIME MACHINE</a>
 <a href="/orbit/hub.html" class="hub-static">HUB</a>
 </nav>

 <div class="float-field" id="field" style="display:none" aria-hidden="true"></div>

 <main class="stage" id="stage">
 <h1 class="hollow-title" id="orbitTitle">DEGEN$ - OFFICIAL TRAILER</h1>
 <p class="hollow-sub" id="stageSub">official trailer<span class="cursor-blink">|</span></p>
 </main>

 <div class="orbit-panel accent-degen" id="orbitPanel">
 <div class="content">
${content}
 </div>
 </div>

 <p class="glitch-credit">powered by Glitch Protocol</p>

 <script src="/assets/js/core/hollow-spawn.js"></script>
 <script src="/assets/js/core/hollow-orbit.js"></script>
 <script src="/assets/js/core/era-portal.js"></script>
 <script src="/assets/js/core/era-transition.js"></script>
 <script src="/assets/js/core/glitch.js"></script>
 <script src="/assets/js/core/price-ticker.js"></script>
${scripts}
 <script>
 DOSWAPZ_ERA.set('orbit');
 if (typeof hollowMandelBg === 'function') {
 hollowMandelBg('bg', ['#000', '#080208', '#100410'], { opacity: 0.1, speed: 0.00002, fast: true });
 }
 if (typeof hollowStars === 'function') hollowStars(28);
 if (window.DOSWAPZ_GLITCH) {
 DOSWAPZ_GLITCH.init({
 screen: '#screen',
 content: '#orbitPanel',
 titleEl: '#orbitTitle',
 titleText: 'DEGEN$ - OFFICIAL TRAILER',
 interval: 700,
 letterInterval: 2400
 });
 }
 </script>
</body>
</html>
`;

const out = path.join(root, 'orbit', 'pages', 'degen', 'trailer.html');
fs.writeFileSync(out, html, 'utf8');
console.log('wrote', out, html.length);
console.log('title ok', html.includes('DEGEN$ - OFFICIAL TRAILER'));
console.log('mojibake', html.includes('"'));
