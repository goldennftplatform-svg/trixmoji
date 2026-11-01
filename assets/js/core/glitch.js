/* DOSWAPZ - shared color glitch engine (splash + hub-home DNA) */
window.DOSWAPZ_GLITCH = (function () {
 'use strict';

 var SPLASH_COLORS = ['#00ff00', '#ffff00', '#ff00ff', '#00ffff', '#ff4444', '#ff8800', '#88ff88'];

 var GLITCH_PROFILES = {
 CALM: { interval: 1400, letterInterval: 4200, burst: 0.35, filterChance: 0.04 },
 NORMAL: { interval: 480, letterInterval: 1800, burst: 1, filterChance: 0.12 },
 CHAOS: { interval: 110, letterInterval: 620, burst: 2.2, filterChance: 0.28 }
 };

 function prefersReducedMotion() {
 try {
 if (document.documentElement.getAttribute('data-motion') === 'off') return true;
 if (document.documentElement.classList.contains('dos-motion-off')) return true;
 if (window.DOSWAPZ_SHELL && typeof window.DOSWAPZ_SHELL.getMotionOn === 'function') {
 if (!window.DOSWAPZ_SHELL.getMotionOn()) return true;
 }
 try {
 if (localStorage.getItem('doswapz_motion') === 'off') return true;
 } catch (e0) {}
 return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 } catch (e) {
 return false;
 }
 }

 function isPerfLite() {
 try {
 if (document.body && document.body.classList.contains('dos-perf-lite')) return true;
 if (window.matchMedia('(max-width: 700px), (pointer: coarse)').matches) return true;
 var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
 if (c && (c.saveData || c.effectiveType === '2g' || c.effectiveType === 'slow-2g')) return true;
 } catch (e) {}
 return false;
 }

 function getProfile() {
 var level = 'NORMAL';
 try {
 level = localStorage.getItem('doswapz_glitch_level') || 'NORMAL';
 } catch (e) {}
 var profile = GLITCH_PROFILES[level] || GLITCH_PROFILES.NORMAL;
 // Soften on phones so UI stays fluid while keeping the vibe
 if (isPerfLite() && level !== 'CHAOS') {
 return {
 interval: Math.max(profile.interval * 1.85, 900),
 letterInterval: Math.max(profile.letterInterval * 1.6, 2800),
 burst: profile.burst * 0.55,
 filterChance: profile.filterChance * 0.25
 };
 }
 if (isPerfLite() && level === 'CHAOS') {
 return {
 interval: Math.max(profile.interval * 1.4, 220),
 letterInterval: Math.max(profile.letterInterval * 1.2, 900),
 burst: profile.burst * 0.75,
 filterChance: profile.filterChance * 0.45
 };
 }
 return profile;
 }

 function glitchLayerChildCap() {
 return isPerfLite() ? 6 : 14;
 }

 function pruneGlitchLayer(layer) {
 if (!layer) return;
 var cap = glitchLayerChildCap();
 while (layer.childNodes.length > cap) {
 layer.removeChild(layer.firstChild);
 }
 }

 function pickColor() {
 return SPLASH_COLORS[Math.floor(Math.random() * SPLASH_COLORS.length)];
 }

 function ensureGlitchLayer() {
 var layer = document.getElementById('glitchLayer');
 if (layer) return layer;
 layer = document.createElement('div');
 layer.className = 'glitch-layer';
 layer.id = 'glitchLayer';
 document.body.appendChild(layer);
 return layer;
 }

 function ensureVignette(screen) {
 if (!screen || screen.querySelector('.vignette')) return;
 var v = document.createElement('div');
 v.className = 'vignette';
 screen.insertBefore(v, screen.firstChild);
 }

 function renderTitle(titleEl, letters) {
 titleEl.innerHTML = letters.map(function (ch) {
 if (ch.color) {
 return '<span class="color-letter" style="color:' + ch.color + '">' + ch.ch + '</span>';
 }
 return ch.ch || ch;
 }).join('');
 }

 function resetTitle(titleEl, titleText) {
 titleEl.textContent = titleText;
 titleEl.style.color = '';
 }

 function init(opts) {
 opts = opts || {};
 var screen = document.querySelector(opts.screen || '.dos-screen, #screen');
 if (!screen) return null;

 // Full accessibility opt-out - keep UI buttery, no ambient chaos
 if (prefersReducedMotion() || opts.disabled) {
 ensureVignette(screen);
 return { profile: getProfile(), destroy: function () {} };
 }

 ensureVignette(screen);
 var glitchLayer = ensureGlitchLayer();
 var content = opts.content ? document.querySelector(opts.content) : document.querySelector('.content, #content');
 var titleEl = opts.titleEl ? document.querySelector(opts.titleEl) : document.getElementById('doswapText');
 var titleText = opts.titleText || (titleEl ? (titleEl.textContent || 'DOSWAPZ').trim() : 'DOSWAPZ');
 var enableTitle = opts.enableTitle !== false && !!titleEl;
 var profile = getProfile();
 var interval = opts.interval || profile.interval;
 var letterInterval = opts.letterInterval || profile.letterInterval;
 var burst = profile.burst;
 var filterChance = profile.filterChance;
 var perfLite = isPerfLite();

 var path = window.location.pathname.replace(/\/+$/, '') || '/index.html';
 var isHubPage = /\/hub\.html$/.test(path) || path === '/portal.html';
 if (!isHubPage && opts.calm !== false) {
 interval = Math.max(interval * 2.2, 900);
 letterInterval = Math.max(letterInterval * 1.8, 3200);
 burst = burst * 0.45;
 filterChance = filterChance * 0.35;
 }

 function createHardPixelBlock() {
 pruneGlitchLayer(glitchLayer);
 var block = document.createElement('div');
 block.style.position = 'absolute';
 block.style.left = Math.random() * 100 + '%';
 block.style.top = Math.random() * 100 + '%';
 block.style.width = (2 + Math.random() * 7) + '%';
 block.style.height = (1.2 + Math.random() * 4.5) + '%';
 block.style.zIndex = '22';
 block.style.willChange = 'opacity';
 block.style.transform = 'translateZ(0)';

 var roll = Math.random();
 if (roll < 0.38) {
 block.style.background = '#00ff00';
 block.style.mixBlendMode = 'difference';
 block.style.opacity = (0.45 + Math.random() * 0.35).toString();
 } else if (roll < 0.58) {
 block.style.background = '#000000';
 block.style.mixBlendMode = 'difference';
 block.style.opacity = (0.55 + Math.random() * 0.35).toString();
 } else {
 block.style.background = pickColor();
 block.style.mixBlendMode = 'screen';
 block.style.opacity = (0.55 + Math.random() * 0.4).toString();
 block.style.boxShadow = '0 0 6px ' + block.style.background;
 }

 if (Math.random() < 0.35) {
 block.style.fontFamily = 'VT323, monospace';
 block.style.fontSize = (16 + Math.random() * 14) + 'px';
 block.style.color = pickColor();
 block.style.lineHeight = '1';
 block.style.background = 'transparent';
 block.style.mixBlendMode = 'screen';
 block.innerHTML = 'ABCDEFG$#%@&*'.split('')[Math.floor(Math.random() * 13)];
 }

 glitchLayer.appendChild(block);
 setTimeout(function () {
 block.style.transition = 'opacity 60ms linear';
 block.style.opacity = '0';
 setTimeout(function () { block.remove(); }, 70);
 }, 55 + Math.random() * 85);
 }

 function createColorFlash() {
 pruneGlitchLayer(glitchLayer);
 var flash = document.createElement('div');
 var color = pickColor();
 flash.style.position = 'absolute';
 flash.style.left = Math.random() * 92 + '%';
 flash.style.top = Math.random() * 88 + '%';
 flash.style.width = (3 + Math.random() * 5) + 'px';
 flash.style.height = (3 + Math.random() * 5) + 'px';
 flash.style.background = color;
 if (!perfLite) {
 flash.style.boxShadow = '0 0 10px ' + color + ', 0 0 22px ' + color;
 }
 flash.style.zIndex = '24';
 flash.style.mixBlendMode = perfLite ? 'normal' : 'screen';
 flash.style.opacity = '0.95';
 flash.style.willChange = 'opacity, transform';
 flash.style.transform = 'translateZ(0)';
 glitchLayer.appendChild(flash);
 setTimeout(function () {
 flash.style.transition = 'opacity 45ms linear, transform 45ms linear';
 flash.style.opacity = '0';
 flash.style.transform = 'scale(2.2)';
 setTimeout(function () { flash.remove(); }, 50);
 }, 35 + Math.random() * 40);
 }

 function createMoshBand() {
 var band = document.createElement('div');
 band.className = 'mosh-band';
 band.style.position = screen === document.body ? 'fixed' : 'absolute';
 band.style.left = '0';
 band.style.width = '100%';
 band.style.top = (Math.random() * 94) + '%';
 band.style.height = (6 + Math.random() * 9) + 'px';
 band.style.opacity = (0.45 + Math.random() * 0.35).toString();
 band.style.transform = 'translateX(' + ((Math.random() - 0.5) * 38) + 'px)';
 band.style.background = 'rgba(0, 255, 0, 0.18)';
 band.style.mixBlendMode = 'difference';
 band.style.pointerEvents = 'none';
 band.style.zIndex = '25';

 if (Math.random() < 0.35) {
 var c = pickColor();
 band.style.background = c;
 band.style.mixBlendMode = 'screen';
 band.style.boxShadow = '0 0 8px ' + c;
 }

 screen.appendChild(band);
 setTimeout(function () {
 band.style.transition = 'opacity 90ms linear';
 band.style.opacity = '0';
 setTimeout(function () { band.remove(); }, 100);
 }, 70 + Math.random() * 110);
 }

 function scrambleTitle() {
 if (!enableTitle) return;
 var garbage = '#$%@&*+=<>/\\|';
 var letters = titleText.split('').map(function (ch) {
 return {
 ch: Math.random() < 0.55 ? garbage[Math.floor(Math.random() * garbage.length)] : ch,
 color: Math.random() < 0.42 ? pickColor() : null
 };
 });
 renderTitle(titleEl, letters);
 setTimeout(function () { resetTitle(titleEl, titleText); }, 90 + Math.random() * 70);
 }

 function flashRandomLetter() {
 if (!enableTitle) return;
 var idx = Math.floor(Math.random() * titleText.length);
 var color = pickColor();
 var letters = titleText.split('').map(function (ch, i) {
 return { ch: ch, color: i === idx ? color : null };
 });
 renderTitle(titleEl, letters);
 setTimeout(function () { resetTitle(titleEl, titleText); }, 110 + Math.random() * 90);
 }

 function doWaterGlitch() {
 var ripple = document.createElement('div');
 ripple.className = 'water-ripple';
 ripple.style.position = screen === document.body ? 'fixed' : 'absolute';
 ripple.style.left = '0';
 ripple.style.width = '100%';
 ripple.style.top = (12 + Math.random() * 76) + '%';
 screen.appendChild(ripple);
 setTimeout(function () {
 ripple.style.transition = 'opacity 280ms linear, top 420ms linear';
 ripple.style.top = (parseFloat(ripple.style.top) + 6 + Math.random() * 10) + '%';
 ripple.style.opacity = '0';
 setTimeout(function () { ripple.remove(); }, 440);
 }, 30);
 }

 function emitGlitch(type, extra) {
 try {
 document.dispatchEvent(new CustomEvent('doswapz:glitch', {
 detail: Object.assign({ type: type, burst: burst }, extra || {})
 }));
 } catch (e) {}
 }

 function doAmbientGlitch() {
 if (document.hidden) return;
 if (Math.random() > burst) return;
 var r = Math.random();
 // On phones: prefer cheap pixels/flashes; skip filter-heavy mosh more often
 if (perfLite) {
 if (r < 0.42) {
 createHardPixelBlock();
 emitGlitch('pixel');
 } else if (r < 0.68) {
 createColorFlash();
 emitGlitch('flash');
 } else if (r < 0.82) {
 flashRandomLetter();
 emitGlitch('letter');
 } else if (r < 0.92 && !perfLite) {
 createMoshBand();
 emitGlitch('mosh');
 } else if (Math.random() < 0.35) {
 scrambleTitle();
 emitGlitch('scramble');
 }
 return;
 }
 if (r < 0.32) {
 createHardPixelBlock();
 if (Math.random() < 0.55 * burst) createHardPixelBlock();
 emitGlitch('pixel');
 } else if (r < 0.48) {
 createColorFlash();
 if (Math.random() < 0.4) createColorFlash();
 emitGlitch('flash');
 } else if (r < 0.62) {
 createMoshBand();
 emitGlitch('mosh');
 } else if (r < 0.74) {
 scrambleTitle();
 emitGlitch('scramble');
 } else if (r < 0.84) {
 flashRandomLetter();
 emitGlitch('letter');
 } else if (r < 0.92) {
 doWaterGlitch();
 emitGlitch('water');
 }
 }

 var mainTimer = setInterval(function () {
 if (!document.hidden) doAmbientGlitch();
 }, interval);
 var letterTimer = enableTitle ? setInterval(function () {
 if (!document.hidden && Math.random() < 0.18) flashRandomLetter();
 }, letterInterval) : null;

 var filterTargets = [];
 var filterTimer = null;
 // Full-element filter is expensive on mobile GPUs - desktop only
 if (!perfLite) {
 if (content) filterTargets.push(content);
 if (opts.extraContent) {
 (Array.isArray(opts.extraContent) ? opts.extraContent : [opts.extraContent]).forEach(function (sel) {
 var el = typeof sel === 'string' ? document.querySelector(sel) : sel;
 if (el && filterTargets.indexOf(el) < 0) filterTargets.push(el);
 });
 }

 if (filterTargets.length) {
 filterTimer = setInterval(function () {
 if (document.hidden) return;
 if (Math.random() < filterChance) {
 filterTargets.forEach(function (el) {
 el.style.transition = 'filter 120ms ease';
 el.style.filter = 'contrast(1.35) brightness(1.2)';
 setTimeout(function () { el.style.filter = ''; }, 150);
 });
 emitGlitch('filter');
 }
 }, 2400);
 }
 }

 if (isHubPage && !perfLite) {
 setTimeout(function () {
 for (var i = 0; i < 3; i++) {
 (function (n) {
 setTimeout(function () {
 createHardPixelBlock();
 if (n % 2 === 0) createColorFlash();
 }, n * 35);
 })(i);
 }
 }, 260);
 } else if (isHubPage && perfLite) {
 setTimeout(function () {
 createHardPixelBlock();
 }, 280);
 }

 function destroy() {
 clearInterval(mainTimer);
 if (letterTimer) clearInterval(letterTimer);
 if (filterTimer) clearInterval(filterTimer);
 if (glitchLayer) glitchLayer.innerHTML = '';
 }

 // Live MOTION toggle from shell dial
 window.addEventListener('doswapz:motion', function (ev) {
 if (ev && ev.detail && ev.detail.on === false) destroy();
 });

 return {
 profile: profile,
 destroy: destroy
 };
 }

 function ensureShellBoot() {
 // Docs footer even on splash / pages that previously skipped shell-boot
 if (!document.querySelector('script[data-docs-footer]') && !window.__DOSWAPZ_DOCS_FOOTER__) {
 var df = document.createElement('script');
 df.src = '/assets/js/core/docs-footer.js';
 df.setAttribute('data-docs-footer', '1');
 (document.body || document.documentElement).appendChild(df);
 }
 if (document.querySelector('script[data-shell-boot]') || document.querySelector('script[data-site-shell]')) {
 return;
 }
 var p = window.location.pathname.replace(/\/+$/, '') || '/index.html';
 if (p === '/index.html' || p === '/') return;
 var s = document.createElement('script');
 s.src = '/assets/js/core/shell-boot.js';
 s.setAttribute('data-shell-boot', '1');
 document.body.appendChild(s);
 }

 var _init = init;
 init = function (opts) {
 ensureShellBoot();
 return _init(opts);
 };

 return { init: init, pickColor: pickColor, getProfile: getProfile, GLITCH_PROFILES: GLITCH_PROFILES };
})();