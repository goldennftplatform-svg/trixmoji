/* Orbital hollow buttons + optional shy / hard-to-get proximity */
function hollowOrbit(field, orbits, opts) {
 opts = opts || {};
 if (typeof field === 'string') field = document.getElementById(field);

 var fullscreen = opts.fullscreen === true;
 var spreadX = opts.spreadX != null ? opts.spreadX : 68;
 var spreadY = opts.spreadY != null ? opts.spreadY : 64;
 var edgeMargin = opts.edgeMargin != null ? opts.edgeMargin : 36;
 var edgeReach = opts.edgeReach != null ? opts.edgeReach : 1;
 var useGlitch = opts.glitch !== false;
 var iconsOnly = opts.iconsOnly === true;
 var pauseOnHover = opts.pauseOnHover === true;
 var stationary = opts.stationary === true;
 var popOnClick = opts.popOnClick === true;
 var btns = [];
 var t0 = Date.now();
 var mouse = { x: -9999, y: -9999 };

 if (fullscreen) field.classList.add('orbit-fullscreen');

 function joltBtn(b, mag) {
 mag = mag || 18;
 b.joltX = (Math.random() - 0.5) * mag * 2;
 b.joltY = (Math.random() - 0.5) * mag * 2;
 b.joltT = 14;
 b.el.classList.add('glitch-jolt');
 setTimeout(function () { b.el.classList.remove('glitch-jolt'); }, 120);
 }

 function joltRandom(count, mag) {
 var pool = btns.filter(function (x) { return !x.paused; });
 if (!pool.length) return;
 count = Math.min(count, pool.length);
 for (var i = 0; i < count; i++) {
 joltBtn(pool[Math.floor(Math.random() * pool.length)], mag);
 }
 }

 function viewportRadii() {
 var vw = window.innerWidth;
 var vh = window.innerHeight;
 return {
 vw: vw, vh: vh,
 cx: vw * 0.5, cy: vh * 0.5,
 rx: Math.max(24, vw * 0.5 - edgeMargin) * edgeReach,
 ry: Math.max(24, vh * 0.5 - edgeMargin) * edgeReach
 };
 }

 function placeBtn(b, ang) {
 var rad = b.r * b.rMul;
 var dx = b.dodgeX + b.joltX;
 var dy = b.dodgeY + b.joltY;

 if (fullscreen) {
 var vp = viewportRadii();
 b.el.style.position = 'fixed';
 if (b.scatter) {
 b.el.style.left = (b.scatterX + dx) + 'px';
 b.el.style.top = (b.scatterY + dy) + 'px';
 } else {
 b.el.style.left = (vp.cx + Math.cos(ang) * rad * vp.rx + dx) + 'px';
 b.el.style.top = (vp.cy + Math.sin(ang) * rad * vp.ry + dy) + 'px';
 }
 } else {
 var fieldRect = field.getBoundingClientRect();
 var px = (dx / fieldRect.width) * 100;
 var py = (dy / fieldRect.height) * 100;
 b.el.style.left = (50 + Math.cos(ang) * rad * spreadX + px) + '%';
 b.el.style.top = (50 + Math.sin(ang) * rad * spreadY + py) + '%';
 }
 }

 orbits.forEach(function (orbit) {
 orbit.items.forEach(function (item, ii) {
 var a = document.createElement('a');
 a.className = 'hollow-btn' + (item.cls ? ' ' + item.cls : '');
 a.href = item.href;
 a.style.color = item.color || '#00ff41';
 if (item.ring) a.style.setProperty('--ring', item.ring + 'px');
 a.style.setProperty('--dur', (4 + Math.random() * 5) + 's');
 a.style.setProperty('--delay', (-Math.random() * 5) + 's');
 if (iconsOnly) a.classList.add('icons-only');
 a.setAttribute('aria-label', item.label);
 if (stationary) a.classList.add('stationary-bubble');
 var glyphInner = item.img
 ? '<img class="glyph-img" src="' + item.img + '" alt="">'
 : (item.glyph || '');
 a.innerHTML =
 '<div class="hollow-ring"><span class="glyph">' + glyphInner + '</span></div>' +
 '<span class="hollow-label" aria-hidden="true">' + item.label + '</span>';
 field.appendChild(a);

 var scatter = item.scatter === true;
 var b = {
 el: a,
 label: a.querySelector('.hollow-label'),
 angle: (ii / orbit.items.length) * Math.PI * 2 + (item.angleOffset || 0),
 r: orbit.r,
 rMul: item.rMul != null ? item.rMul : (0.88 + Math.random() * 0.16),
 speed: scatter ? (orbit.speed || 0.0001) * (0.85 + Math.random() * 0.55) : orbit.speed,
 scatter: scatter,
 scatterBaseNx: item.nx != null ? item.nx : (0.14 + Math.random() * 0.72),
 scatterBaseNy: item.ny != null ? item.ny : (0.14 + Math.random() * 0.72),
 scatterNx: 0,
 scatterNy: 0,
 scatterX: 0,
 scatterY: 0,
 scatterPhase: Math.random() * Math.PI * 2,
 scatterWanderPhase: Math.random() * Math.PI * 2,
 scatterWanderPhase2: Math.random() * Math.PI * 2,
 ambientPhase: Math.random() * Math.PI * 2,
 ambientFreq: 0.0014 + Math.random() * 0.0022,
 opacity: opts.hardToGet ? 0.04 : 1,
 dodgeX: 0,
 dodgeY: 0,
 joltX: 0,
 joltY: 0,
 joltT: 0,
 paused: false,
 pauseAngle: 0
 };
 if (scatter) {
 b.scatterNx = b.scatterBaseNx;
 b.scatterNy = b.scatterBaseNy;
 var vp0 = viewportRadii();
 b.scatterX = edgeMargin + b.scatterNx * (vp0.vw - edgeMargin * 2);
 b.scatterY = edgeMargin + b.scatterNy * (vp0.vh - edgeMargin * 2);
 }
 btns.push(b);

 if (stationary) {
 a.addEventListener('mouseenter', function () {
 a.classList.add('is-hovered');
 });
 a.addEventListener('mouseleave', function () {
 a.classList.remove('is-hovered');
 });
 if (popOnClick) {
 a.addEventListener('click', function (e) {
 e.preventDefault();
 if (a.classList.contains('bubble-pop')) return;
 a.classList.add('bubble-pop');
 setTimeout(function () {
 window.location.href = item.href;
 }, 380);
 });
 }
 } else if (pauseOnHover) {
 a.addEventListener('mouseenter', function () {
 b.paused = true;
 b.pauseAngle = b.angle + (Date.now() - t0) * b.speed;
 b.dodgeX = b.dodgeY = 0;
 a.classList.add('is-paused');
 });
 a.addEventListener('mouseleave', function () {
 b.paused = false;
 var tNow = Date.now() - t0;
 b.angle = b.pauseAngle - tNow * b.speed;
 a.classList.remove('is-paused');
 });
 }
 });
 });

 document.addEventListener('mousemove', function (e) {
 mouse.x = e.clientX;
 mouse.y = e.clientY;
 });

 function shyOpacity(dist) {
 var reveal = opts.revealRadius || 72;
 var flirt = opts.flirtRadius || 200;
 if (dist > flirt) return opts.baseOpacity != null ? opts.baseOpacity : 0.05;
 if (dist < reveal) return 1;
 var t = (flirt - dist) / (flirt - reveal);
 return (opts.baseOpacity || 0.05) + Math.pow(Math.max(0, t), 2.2) * 0.95;
 }

 function placeAll(angOverride) {
 btns.forEach(function (b) {
 if (b.scatter) {
 var vp = viewportRadii();
 b.scatterX = edgeMargin + b.scatterNx * (vp.vw - edgeMargin * 2);
 b.scatterY = edgeMargin + b.scatterNy * (vp.vh - edgeMargin * 2);
 }
 var ang = angOverride != null ? angOverride : b.angle;
 placeBtn(b, ang);
 if (stationary) {
 b.el.style.opacity = opts.baseOpacity != null ? String(opts.baseOpacity) : '0.72';
 }
 });
 }

 function tick() {
 var t = Date.now() - t0;
 var hard = opts.hardToGet || opts.proximity;
 var lerp = opts.hardToGet ? 0.06 : 0.2;

 if (stationary) {
 placeAll(0);
 return;
 }

 if (useGlitch && t % 3200 < 16 && Math.random() < 0.22) {
 joltRandom(1, 14);
 }

 btns.forEach(function (b) {
 var paused = b.paused;
 if (paused) {
 b.el.style.opacity = '1';
 if (b.label && iconsOnly) b.label.style.opacity = '1';
 }

 if (b.joltT > 0) {
 b.joltT--;
 b.joltX *= 0.72;
 b.joltY *= 0.72;
 }

 var moveMul = paused ? 0.42 : 1;
 var ang = paused ? b.pauseAngle + t * b.speed * 0.42 : b.angle + t * b.speed;

 if (b.scatter) {
 var vpS = viewportRadii();
 var wanderAmp = opts.scatterWander != null ? opts.scatterWander : 0.24;
 var wobR = opts.scatterWobble != null ? opts.scatterWobble : 42;
 b.scatterBaseNx += Math.sin(t * 0.00008 + b.scatterPhase) * 0.00014;
 b.scatterBaseNy += Math.cos(t * 0.0001 + b.scatterPhase * 1.37) * 0.00014;
 b.scatterBaseNx = Math.max(0.1, Math.min(0.9, b.scatterBaseNx));
 b.scatterBaseNy = Math.max(0.1, Math.min(0.9, b.scatterBaseNy));
 b.scatterNx = b.scatterBaseNx
 + Math.sin(t * 0.00024 + b.scatterWanderPhase) * wanderAmp;
 b.scatterNy = b.scatterBaseNy
 + Math.cos(t * 0.00021 + b.scatterWanderPhase2) * wanderAmp;
 var wob = Math.sin(t * b.speed * 4.6 + b.scatterPhase);
 var wob2 = Math.cos(t * b.speed * 3.3 + b.scatterPhase * 1.3);
 b.scatterX = edgeMargin + b.scatterNx * (vpS.vw - edgeMargin * 2) + wob * wobR * moveMul;
 b.scatterY = edgeMargin + b.scatterNy * (vpS.vh - edgeMargin * 2) + wob2 * wobR * moveMul;
 }

 if (opts.neverStationary !== false) {
 var ambient = paused ? 0.38 : 0.95;
 b.dodgeX += Math.sin(t * b.ambientFreq + b.ambientPhase) * ambient * moveMul;
 b.dodgeY += Math.cos(t * b.ambientFreq * 1.17 + b.ambientPhase) * ambient * moveMul;
 }

 if (opts.hardToGet) {
 var rect = b.el.getBoundingClientRect();
 var cx = rect.left + rect.width / 2;
 var cy = rect.top + rect.height / 2;
 var dx = mouse.x - cx;
 var dy = mouse.y - cy;
 var dist = Math.sqrt(dx * dx + dy * dy);
 var flirt = opts.flirtRadius || 200;
 var shy = opts.shyRadius || 130;

 if (dist > 0 && dist < flirt) {
 var flee = dist < shy
 ? (1 - dist / shy) * 32
 : (1 - (dist - shy) / (flirt - shy)) * 20;
 b.dodgeX += ((-dx / dist) * flee - b.dodgeX) * 0.14;
 b.dodgeY += ((-dy / dist) * flee - b.dodgeY) * 0.14;
 } else {
 b.dodgeX *= 0.94;
 b.dodgeY *= 0.94;
 }

 if (fullscreen && opts.cornerHide !== true) {
 var vpC = viewportRadii();
 var mdx = mouse.x - vpC.cx;
 var mdy = mouse.y - vpC.cy;
 var mDist = Math.sqrt(mdx * mdx + mdy * mdy);
 var centerR = opts.centerProbeRadius || Math.min(vpC.vw, vpC.vh) * 0.3;
 if (mDist < centerR && mDist > 1) {
 var icx = cx - vpC.cx;
 var icy = cy - vpC.cy;
 var iDist = Math.sqrt(icx * icx + icy * icy) || 1;
 var push = (1 - mDist / centerR) * 11;
 b.dodgeX += ((icx / iDist) * push - b.dodgeX) * 0.06;
 b.dodgeY += ((icy / iDist) * push - b.dodgeY) * 0.06;
 }
 }

 var target = paused ? 1 : shyOpacity(dist);
 b.opacity += (target - b.opacity) * lerp;
 b.el.style.opacity = b.opacity;

 if (b.label && iconsOnly) b.label.style.opacity = paused ? '1' : '0';
 else if (b.label && !iconsOnly) {
 b.label.style.opacity = b.opacity > 0.55 ? Math.min(1, (b.opacity - 0.55) * 2.2) : 0;
 }
 } else if (opts.proximity) {
 var r = b.el.getBoundingClientRect();
 var dx2 = mouse.x - (r.left + r.width / 2);
 var dy2 = mouse.y - (r.top + r.height / 2);
 var dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
 var radius = opts.proximityRadius || 150;
 var baseOp = opts.baseOpacity != null ? opts.baseOpacity : 0.2;
 b.el.style.opacity = dist2 < radius
 ? Math.min(1, baseOp + (radius - dist2) / (radius * 0.7))
 : baseOp;
 }

 placeBtn(b, ang);
 });

 requestAnimationFrame(tick);
 }
 if (stationary) {
 placeAll(0);
 window.addEventListener('resize', function () { placeAll(0); });
 } else {
 tick();
 }

 if (useGlitch && !stationary) {
 document.addEventListener('doswapz:glitch', function (e) {
 var d = e.detail || {};
 var n = 1;
 var mag = 16;
 if (d.type === 'mosh' || d.type === 'scramble') { n = 3; mag = 24; }
 else if (d.type === 'pixel' || d.type === 'flash') { n = 2; mag = 20; }
 else if (d.type === 'water') { n = 2; mag = 12; }
 else if (d.type === 'filter') { n = 1; mag = 10; }
 if (d.burst > 1.5) { n += 1; mag += 6; }
 joltRandom(n, mag);
 });
 }

 window.addEventListener('resize', function () { /* placeBtn runs every frame */ });

 return btns;
}

/* Full-viewport - wandering scatter + three orbital bands */
var HOLLOW_HUB_ORBITS = [
 { r: 1, speed: 0.00018, items: [
 { href: '/classic/pages/arcade/intro.html', glyph: '', label: 'ARCADE', color: '#00ffcc', angleOffset: 0.72 },
 { href: '/classic/pages/attic.html', glyph: '▲', label: 'ATTIC', color: '#ccaa66', angleOffset: 3.55 }
 ]},
 { r: 0.68, speed: -0.00022, items: [
 { href: '/classic/pages/hardwear/wallet.html', glyph: '⛓', label: 'HARDWEAR', color: '#aaa', ring: 58, angleOffset: 0.4 },
 { href: '/classic/pages/cryptodad/token.html', glyph: '◎', label: '$DOSWAPZ', color: '#00ffff', ring: 58, angleOffset: 2.9 },
 { href: '/classic/hub.html', glyph: '☰', label: 'LIVE HUB', color: '#7878fc', ring: 64, angleOffset: 5.1 }
 ]},
 { r: 0, speed: 0.00028, items: [
 { scatter: true, nx: 0.14, ny: 0.18, href: '/classic/pages/13th-step.html', glyph: '?', label: '13TH', color: '#ffff00', ring: 48 },
 { scatter: true, nx: 0.86, ny: 0.16, href: '/classic/pages/cryptodad/scoreboard.html', glyph: '#', label: 'SCORES', color: '#f39c12', ring: 48 },
 { scatter: true, nx: 0.18, ny: 0.82, href: '/classic/pages/doswapz/mint.html', glyph: '◈', label: 'MINT', color: '#3498db', ring: 48 },
 { scatter: true, nx: 0.84, ny: 0.78, href: '/classic/pages/degen/trailer.html', glyph: '', label: 'DEGEN$', color: '#ff00ff', ring: 48 },
 { scatter: true, nx: 0.52, ny: 0.12, href: '/classic/pages/doswapz/swap.html', glyph: '⇄', label: 'SWAP', color: '#00ff41', ring: 44 },
 { scatter: true, nx: 0.48, ny: 0.88, href: '/classic/pages/pond-scum.html', glyph: '≋', label: 'POND', color: '#88cc88', ring: 44 },
 { scatter: true, nx: 0.68, ny: 0.46, href: '/classic/pages/i-see-you.html', glyph: '\u25CE', label: 'I SEE YOU', color: '#ff3366', ring: 44 },
 { scatter: true, nx: 0.12, ny: 0.52, href: '/classic/pages/basement.html', glyph: '⬇', label: 'BASEMENT', color: '#ff66cc', ring: 44 },
 { scatter: true, nx: 0.88, ny: 0.48, href: '/classic/pages/lily-pad.html', glyph: '❀', label: 'LILY PAD', color: '#1abc9c', ring: 44 }
 ]}
];

/* Present hub bubbles — spread so icons do not stack (all clickable) */
var HOLLOW_ORBIT_HUB_ORBITS = [
 { r: 0, speed: 0, items: [
 { scatter: true, nx: 0.12, ny: 0.12, href: '/orbit/pages/13th-step.html', glyph: '?', label: '13TH', color: '#ffff00', ring: 50 },
 { scatter: true, nx: 0.32, ny: 0.10, href: '/orbit/pages/harbinger.html', glyph: '\u25C9', label: 'H4RB1NG3R', color: '#66ccff', ring: 52 },
 { scatter: true, nx: 0.50, ny: 0.08, href: '/future/hub.html', glyph: '\u25C7', label: 'FUTURE', color: '#f0eef8', ring: 54 },
 { scatter: true, nx: 0.68, ny: 0.10, href: '/orbit/pages/doswapz/bridge.html', glyph: '\u29C9', label: 'BRIDGE', color: '#8aa0ff', ring: 50 },
 { scatter: true, nx: 0.88, ny: 0.12, href: '/orbit/pages/cryptodad/scoreboard.html', glyph: '#', label: 'SCORES', color: '#f39c12', ring: 50 },
 { scatter: true, nx: 0.10, ny: 0.30, href: '/orbit/pages/arcade/intro.html', glyph: '\u25A0', label: 'ARCADE', color: '#00ffcc', ring: 56 },
 { scatter: true, nx: 0.28, ny: 0.28, href: '/orbit/pages/cryptodad/play.html', glyph: 'D', label: 'DAD', color: '#00ff66', ring: 40 },
 { scatter: true, nx: 0.72, ny: 0.28, href: '/orbit/pages/cryptodad/token.html', glyph: '\u25CE', label: '$DOSWAPZ', color: '#00ffff', ring: 48 },
 { scatter: true, nx: 0.90, ny: 0.30, href: '/orbit/pages/attic.html', glyph: '\u25B2', label: 'ATTIC', color: '#ccaa66', ring: 54 },
 { scatter: true, nx: 0.08, ny: 0.48, href: '/orbit/pages/tbb/play.html', glyph: 'B', label: 'TBB', color: '#ff4466', ring: 40 },
 { scatter: true, nx: 0.22, ny: 0.46, href: '/orbit/pages/cryptodad/ftwr-maze.html', glyph: 'R', label: 'FTWR', color: '#ffffff', ring: 40 },
 { scatter: true, nx: 0.78, ny: 0.46, href: '/orbit/pages/basement/cryptomom/play.html', glyph: 'M', label: 'MOM', color: '#ff66cc', ring: 40 },
 { scatter: true, nx: 0.92, ny: 0.48, href: '/orbit/pages/arcade/scores.html', glyph: '#', label: 'ARCADE #', color: '#ffd700', ring: 40 },
 { scatter: true, nx: 0.12, ny: 0.66, href: '/orbit/pages/hardwear/wallet.html', glyph: '\u26D3', label: 'HARDWEAR', color: '#aaa', ring: 50 },
 { scatter: true, nx: 0.32, ny: 0.64, href: '/orbit/pages/doswapz/swap.html', glyph: '\u21C4', label: 'SWAP', color: '#00ff41', ring: 52 },
 { scatter: true, nx: 0.50, ny: 0.62, href: '/orbit/pages/i-see-you.html', glyph: '\u25CE', label: 'I SEE YOU', color: '#ff3366', ring: 50 },
 { scatter: true, nx: 0.68, ny: 0.64, href: '/orbit/pages/perpetual-vision-center.html', glyph: '\u25C9', label: 'VISION', color: '#88ccff', ring: 50 },
 { scatter: true, nx: 0.88, ny: 0.66, href: '/orbit/pages/doswapz/mint.html', glyph: '\u25C8', label: 'MINT', color: '#3498db', ring: 50 },
 { scatter: true, nx: 0.14, ny: 0.82, href: '/orbit/pages/basement.html', glyph: '\u2B07', label: 'BASEMENT', color: '#ff66cc', ring: 50 },
 { scatter: true, nx: 0.34, ny: 0.84, href: '/orbit/pages/doswapz/gallery.html', glyph: '\u25A6', label: 'GALLERY', color: '#66ccff', ring: 46 },
 { scatter: true, nx: 0.50, ny: 0.86, href: '/orbit/pages/pond-scum.html', glyph: '\u224B', label: 'POND', color: '#88cc88', ring: 50 },
 { scatter: true, nx: 0.66, ny: 0.84, href: '/orbit/pages/degen/trailer.html', glyph: '\u25B6', label: 'DEGEN$', color: '#ff00ff', ring: 50 },
 { scatter: true, nx: 0.86, ny: 0.82, href: '/orbit/pages/lily-pad.html', glyph: '\u2740', label: 'LILY PAD', color: '#1abc9c', ring: 48 }
 ]}
];

var HOLLOW_HUB_FLOATER_OPTS = {
 fullscreen: true,
 edgeMargin: 32, edgeReach: 1,
 cornerHide: false, scatterWobble: 42, scatterWander: 0.28,
 hardToGet: true, glitch: true,
 iconsOnly: true, pauseOnHover: true,
 baseOpacity: 0.035, revealRadius: 72, flirtRadius: 240, shyRadius: 150
};

/* Present hub: stationary visible bubbles */
var HOLLOW_ORBIT_HUB_OPTS = {
 fullscreen: true,
 edgeMargin: 48,
 stationary: true,
 popOnClick: false,
 hardToGet: false,
 glitch: false,
 iconsOnly: true,
 baseOpacity: 0.92
};

var HOLLOW_PAGE_FLOATER_OPTS = {
 fullscreen: true,
 edgeMargin: 32,
 stationary: true,
 popOnClick: true,
 hardToGet: false,
 glitch: false,
 iconsOnly: true,
 baseOpacity: 0.7
};

var HOLLOW_PAGE_FLOATER_ORBIT = [{ r: 0, speed: 0.00008, items: [
 { scatter: true, nx: 0.88, ny: 0.12, href: '/orbit/hub.html', glyph: '\u2630', label: 'HUB', color: '#7878fc', ring: 40 }
]}];

function hollowStars(count) {
 var wrap = document.getElementById('stars');
 if (!wrap) return;
 for (var i = 0; i < count; i++) {
 var s = document.createElement('div');
 s.className = 'star';
 s.style.left = Math.random() * 100 + '%';
 s.style.top = Math.random() * 100 + '%';
 s.style.opacity = 0.08 + Math.random() * 0.35;
 var sz = 1 + Math.random() * 2;
 s.style.width = s.style.height = sz + 'px';
 wrap.appendChild(s);
 }
}