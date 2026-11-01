/**
 * Build a clean present-era Perpetual Vision Center page from classic.
 * Avoids broken orbit sanitize (missing CSS vars, mojibake, narrow panel).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const classicPath = path.join(root, 'classic', 'pages', 'perpetual-vision-center.html');
const outPath = path.join(root, 'orbit', 'pages', 'perpetual-vision-center.html');

const classic = fs.readFileSync(classicPath, 'utf8');

const styleMatch = classic.match(/<style>([\s\S]*?)<\/style>/);
const styleInner = styleMatch ? styleMatch[1] : '';

const wrapMatch = classic.match(/<div class="wrap">([\s\S]*?)<\/div>\s*<div class="glitch-layer"/);
let wrapInner = wrapMatch ? wrapMatch[1] : '';

// present links
wrapInner = wrapInner
 .replace(/href="\/classic\/hub\.html"/g, 'href="/orbit/hub.html"')
 .replace(/href="\/classic\/pages\/lily-pad\.html"/g, 'href="/orbit/pages/lily-pad.html"');

const scriptMatch = classic.match(/(<script>\s*window\.DOSWAPZ_PVV[\s\S]*?<\/script>\s*<script>[\s\S]*?<\/script>)/);
const mainScripts = scriptMatch ? scriptMatch[1] : '';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
 <script>
 (function(){if(location.protocol!=='file:')return;var p=location.pathname.replace(/\\\\/g,'/'),m='/doswapz',i=p.toLowerCase().lastIndexOf(m),r=i>=0?p.slice(i+m.length):'/orbit/hub.html',u='http://localhost:8890'+r;document.documentElement.innerHTML='<head><meta charset="UTF-8"><title>DOSWAPZ - use local server</title></head><body style="margin:0;background:#000;color:#0f0;font-family:Consolas,monospace"><div style="max-width:580px;margin:48px auto;padding:28px;border:2px solid #0f0;line-height:1.55"><h1 style="font-size:26px;letter-spacing:3px;margin:0 0 16px">OPEN VIA LOCAL SERVER</h1><p>Run OPEN-PREVIEW.bat then open: <a href="'+u+'" style="color:#6cf">'+u+'</a></p></div></body>';})();
 </script>
 <title>DOSWAPZ // PERPETUAL VISION CENTER // ORBIT</title>
 <meta name="description" content="PERPETUAL VISION CENTER - live X broadcast playlist on DOSWAPZ present era.">
 <link rel="stylesheet" href="/assets/css/hollow-base.css">
 <link rel="stylesheet" href="/assets/css/orbit-void.css">
 <link rel="stylesheet" href="/assets/css/orbit-void-content.css">
 <link rel="stylesheet" href="/assets/css/era-transition.css">
 <style>
${styleInner}

 /* Present shell overrides - wide solid player, not dashed void */
 body#screen.orbit-void-inner.pvv-orbit {
 overflow-x: hidden !important;
 overflow-y: auto !important;
 height: auto !important;
 }
 body#screen.orbit-void-inner.pvv-orbit .float-field { display: none !important; }
 body#screen.orbit-void-inner.pvv-orbit .stage .page-path { display: none !important; }
 body#screen.orbit-void-inner.pvv-orbit .stage .hollow-title {
 -webkit-text-stroke-color: rgba(136, 204, 255, 0.45);
 filter: drop-shadow(0 0 16px rgba(100, 160, 255, 0.25));
 }
 body#screen.orbit-void-inner.pvv-orbit .stage .hollow-sub {
 color: rgba(136, 180, 220, 0.65);
 letter-spacing: 3px;
 }
 body#screen.orbit-void-inner.pvv-orbit .orbit-panel.accent-pvv {
 width: min(1180px, 96vw) !important;
 max-width: 1180px !important;
 margin: 0 auto 100px !important;
 padding: 18px 14px 28px !important;
 background: rgba(4, 8, 14, 0.96) !important;
 border: 1px solid rgba(100, 160, 255, 0.3) !important;
 border-style: solid !important;
 border-radius: 4px !important;
 box-shadow: 0 0 40px rgba(60, 120, 220, 0.1) !important;
 }
 body#screen.orbit-void-inner.pvv-orbit .orbit-panel.accent-pvv::before {
 display: none !important;
 }
 /* Don't let void wash kill player UI colors */
 body#screen.orbit-void-inner.pvv-orbit .orbit-panel.accent-pvv,
 body#screen.orbit-void-inner.pvv-orbit .orbit-panel.accent-pvv .wrap {
 color: #88ccff !important;
 text-shadow: none !important;
 }
 body#screen.orbit-void-inner.pvv-orbit .orbit-panel.accent-pvv .header h1 {
 color: #e8f4ff !important;
 text-shadow: 0 0 10px #88ccff, 0 0 28px rgba(100,160,255,0.35) !important;
 }
 body#screen.orbit-void-inner.pvv-orbit .orbit-panel.accent-pvv .pvv-frame,
 body#screen.orbit-void-inner.pvv-orbit .orbit-panel.accent-pvv .playlist-col,
 body#screen.orbit-void-inner.pvv-orbit .orbit-panel.accent-pvv .now-meta,
 body#screen.orbit-void-inner.pvv-orbit .orbit-panel.accent-pvv .credits-board {
 border-style: solid !important;
 background: #04060c !important;
 }
 body#screen.orbit-void-inner.pvv-orbit .orbit-panel.accent-pvv .broadcast-mount {
 background: #000 !important;
 min-height: 420px !important;
 }
 body#screen.orbit-void-inner.pvv-orbit .orbit-panel.accent-pvv .btn {
 border-style: solid !important;
 border-radius: 0 !important;
 background: #050810 !important;
 color: #88ccff !important;
 }
 body#screen.orbit-void-inner.pvv-orbit .orbit-panel.accent-pvv .pl-item {
 border-radius: 0 !important;
 background: transparent !important;
 color: inherit !important;
 }
 body#screen.orbit-void-inner.pvv-orbit .orbit-panel.accent-pvv .pl-item.active {
 background: #101828 !important;
 }
 body#screen.orbit-void-inner.pvv-orbit .orbit-panel.accent-pvv .pl-title {
 color: #ddeeff !important;
 }
 body#screen.orbit-void-inner.pvv-orbit .orbit-panel.accent-pvv .now-title,
 body#screen.orbit-void-inner.pvv-orbit .orbit-panel.accent-pvv .card-title {
 color: #e8f4ff !important;
 }
 </style>
</head>
<body id="screen" class="orbit-void-inner pvv-orbit">
 <canvas class="bg-canvas" id="bg" aria-hidden="true"></canvas>
 <div id="stars"></div>
 <div class="grain"></div>
 <div class="vignette"></div>
 <div class="glitch-layer" id="glitchLayer"></div>
 <div class="cursor-ghost" id="cursorGhost"></div>

 <nav class="ref-crumbs" style="color:rgba(255,255,255,0.15)">
 <span class="crumb-zone">VISION CENTER</span>
 <a href="/portal.html" class="tm-static">&#9678; TIME MACHINE</a>
 <a href="/orbit/hub.html" class="hub-static">HUB</a>
 </nav>

 <div class="float-field" id="field" style="display:none" aria-hidden="true"></div>

 <main class="stage" id="stage">
 <h1 class="hollow-title" id="orbitTitle">PERPETUAL VISION CENTER</h1>
 <p class="hollow-sub" id="stageSub">live x playlist<span class="cursor-blink">|</span></p>
 </main>

 <div class="orbit-panel accent-pvv" id="orbitPanel">
 <div class="wrap">
${wrapInner}
 </div>
 </div>

 <p class="glitch-credit">powered by Glitch Protocol</p>

 <script src="/assets/js/core/hollow-spawn.js"></script>
 <script src="/assets/js/core/hollow-orbit.js"></script>
 <script src="/assets/js/core/era-portal.js"></script>
 <script src="/assets/js/core/era-transition.js"></script>
 <script src="/assets/js/core/glitch.js"></script>
 <script src="/assets/js/core/price-ticker.js"></script>
${mainScripts}
 <script>
 DOSWAPZ_ERA.set('orbit');
 if (typeof hollowMandelBg === 'function') {
 hollowMandelBg('bg', ['#000', '#020408', '#040812', '#061018'], { opacity: 0.1, speed: 0.00002, fast: true });
 }
 if (typeof hollowStars === 'function') hollowStars(36);
 if (window.DOSWAPZ_GLITCH) {
 DOSWAPZ_GLITCH.init({
 screen: '#screen',
 content: '#orbitPanel',
 titleEl: '#orbitTitle',
 titleText: 'PERPETUAL VISION CENTER',
 interval: 700,
 letterInterval: 2400
 });
 }
 </script>
</body>
</html>
`;

fs.writeFileSync(outPath, html, 'utf8');
console.log('wrote', outPath, 'bytes', html.length);
