/* DOSWAPZ Time Machine - hard glitch travel between past / present / future */
window.DOSWAPZ_ERA_TRANSITION = (function () {
 'use strict';

 var running = false;
 var pendingDest = '';

 function pickColor() {
  var c = ['#00ff00', '#ffff00', '#ff00ff', '#00ffff', '#ff4444', '#ffffff', '#66ff66'];
  return c[Math.floor(Math.random() * c.length)];
 }

 function ensureCss() {
  if (document.getElementById('eraTravelCssBoot')) return;
  var link = document.querySelector('link[href*="era-transition.css"]');
  if (link) return;
  var l = document.createElement('link');
  l.id = 'eraTravelCssBoot';
  l.rel = 'stylesheet';
  l.href = '/assets/css/era-transition.css?v=20260815glitch';
  (document.head || document.documentElement).appendChild(l);
 }

 function ensureOverlay() {
  ensureCss();
  var el = document.getElementById('eraTravelOverlay');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'eraTravelOverlay';
  el.innerHTML =
   '<div class="era-travel-glitch" id="eraTravelGlitch"></div>' +
   '<div class="era-travel-white" id="eraTravelWhite"></div>' +
   '<div class="era-travel-black" id="eraTravelBlack"></div>' +
   '<div class="era-travel-tube" id="eraTravelTube"></div>' +
   '<div class="era-travel-cursor" id="eraTravelCursor"></div>';
  document.body.appendChild(el);
  return el;
 }

 function spawnGlitch(layer, intensity) {
  if (!layer) return;
  var n = Math.max(3, Math.floor(intensity * (6 + Math.random() * 10)));
  for (var i = 0; i < n; i++) {
   var b = document.createElement('div');
   b.className = 'era-travel-block';
   b.style.left = (Math.random() * 100) + '%';
   b.style.top = (Math.random() * 100) + '%';
   b.style.width = (6 + Math.random() * 28 * intensity) + '%';
   b.style.height = (3 + Math.random() * 14 * intensity) + '%';
   var roll = Math.random();
   if (roll < 0.4) {
    b.style.background = '#00ff00';
    b.style.mixBlendMode = 'difference';
   } else if (roll < 0.55) {
    b.style.background = '#000';
    b.style.mixBlendMode = 'difference';
   } else {
    b.style.background = pickColor();
    b.style.mixBlendMode = 'screen';
   }
   b.style.opacity = (0.55 + Math.random() * 0.45).toString();
   layer.appendChild(b);
   (function (node) {
    setTimeout(function () { if (node && node.parentNode) node.remove(); }, 80 + Math.random() * 160);
   })(b);
  }
  if (Math.random() < 0.55 * intensity) {
   var band = document.createElement('div');
   band.className = 'era-travel-band';
   band.style.top = (Math.random() * 92) + '%';
   band.style.height = (6 + Math.random() * 22) + 'px';
   band.style.background = pickColor();
   layer.appendChild(band);
   setTimeout(function () { if (band.parentNode) band.remove(); }, 120 + Math.random() * 100);
  }
 }

 function go(dest) {
  try { window.location.href = dest; } catch (e) {}
 }

 function run(targetEra, destination) {
  /* Second click while mid-travel: keep playing the glitch, do not skip it */
  if (running) {
   if (destination) pendingDest = destination;
   return;
  }
  running = true;
  pendingDest = destination || '/classic/hub.html';

  var overlay = ensureOverlay();
  var glitch = document.getElementById('eraTravelGlitch');
  var white = document.getElementById('eraTravelWhite');
  var black = document.getElementById('eraTravelBlack');
  var tube = document.getElementById('eraTravelTube');
  var cursor = document.getElementById('eraTravelCursor');

  overlay.className = 'era-travel-active';
  overlay.style.display = 'block';
  overlay.style.pointerEvents = 'all';
  if (white) white.style.opacity = '0';
  if (black) black.style.opacity = '0';
  if (tube) {
   tube.style.display = 'none';
   tube.style.height = '0';
   tube.style.top = '50%';
   tube.style.transition = '';
  }
  if (cursor) {
   cursor.style.display = 'none';
   cursor.textContent = 'TRAVELING...';
  }
  if (glitch) glitch.innerHTML = '';

  try {
   localStorage.setItem('doswapz_era', targetEra);
  } catch (e) {}

  /* Seed a first burst immediately so travel never looks like a blank cut */
  spawnGlitch(glitch, 1.2);
  spawnGlitch(glitch, 1.6);
  try {
   document.body.style.filter = 'contrast(1.35) saturate(1.4)';
  } catch (e0) {}

  var safety = window.setTimeout(function () {
   go(pendingDest);
  }, 6200);

  var t0 = Date.now();
  var rampEnd = 1800;
  var chaosEnd = 3200;
  var whiteEnd = 3800;
  var blackEnd = 4500;
  var tuneEnd = 5300;

  function tick() {
   var elapsed = Date.now() - t0;

   if (elapsed < rampEnd) {
    var t = elapsed / rampEnd;
    var intensity = 0.4 + t * t * 1.8;
    spawnGlitch(glitch, intensity);
    if (Math.random() < 0.45 + t * 0.4) spawnGlitch(glitch, intensity);
    document.body.style.filter = 'contrast(' + (1 + t * 0.7) + ') brightness(' + (1 + t * 0.25) + ') saturate(' + (1 + t * 0.6) + ')';
   } else if (elapsed < chaosEnd) {
    var t2 = (elapsed - rampEnd) / (chaosEnd - rampEnd);
    var intense = 1.6 + t2 * 3.2;
    spawnGlitch(glitch, intense);
    spawnGlitch(glitch, intense);
    document.body.style.filter = 'contrast(' + (1.6 + t2 * 2.2) + ') brightness(' + (1.15 + t2) + ') hue-rotate(' + (t2 * 220) + 'deg)';
   } else if (elapsed < whiteEnd) {
    if (white) white.style.opacity = String(Math.min(1, (elapsed - chaosEnd) / 240));
    if (glitch) glitch.innerHTML = '';
   } else if (elapsed < blackEnd) {
    if (white) white.style.opacity = '1';
    if (black) black.style.opacity = String(Math.min(1, (elapsed - whiteEnd) / 300));
   } else if (elapsed < tuneEnd) {
    if (black) black.style.opacity = '1';
    if (white) white.style.opacity = String(Math.max(0, 1 - (elapsed - blackEnd) / 360));
    if (tube && elapsed > blackEnd + 80 && tube.style.display === 'none') {
     tube.style.display = 'block';
     tube.style.height = '0';
     tube.style.top = '50%';
     setTimeout(function () {
      tube.style.transition = 'height 380ms cubic-bezier(0.2, 0.9, 0.3, 1), top 380ms cubic-bezier(0.2, 0.9, 0.3, 1)';
      tube.style.top = '0';
      tube.style.height = '100vh';
     }, 16);
    }
    if (cursor && elapsed > blackEnd + 160) {
     cursor.style.display = 'block';
    }
   } else {
    document.body.style.filter = '';
    try { window.clearTimeout(safety); } catch (eClr) {}
    go(pendingDest);
    return;
   }

   requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
 }

 function reset() {
  running = false;
  pendingDest = '';
  try { document.body.style.filter = ''; } catch (e) {}
  var overlay = document.getElementById('eraTravelOverlay');
  if (overlay) {
   overlay.className = '';
   overlay.style.display = 'none';
   overlay.style.pointerEvents = 'none';
  }
  var glitch = document.getElementById('eraTravelGlitch');
  if (glitch) glitch.innerHTML = '';
  ['eraTravelWhite', 'eraTravelBlack'].forEach(function (id) {
   var el = document.getElementById(id);
   if (el) el.style.opacity = '0';
  });
  ['eraTravelTube', 'eraTravelCursor'].forEach(function (id) {
   var el = document.getElementById(id);
   if (el) el.style.display = 'none';
  });
 }

 window.addEventListener('pageshow', function () {
  reset();
 });

 return { run: run, reset: reset, isRunning: function () { return running; } };
})();
