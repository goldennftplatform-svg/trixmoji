/* DOSWAPZ - site-wide shell: breadcrumb, glitch dial, intro skip helpers */
window.DOSWAPZ_SHELL = (function () {
 'use strict';

 var LAST_BOOT_KEY = 'doswapz_last_dest';
 var GLITCH_KEY = 'doswapz_glitch_level';
 var MOTION_KEY = 'doswapz_motion';
 var TEXT_KEY = 'doswapz_text_scale';
 var SCAN_KEY = 'doswapz_scanlines';
 var HICON_KEY = 'doswapz_hicon';
 var CONTROLS_HIDE_KEY = 'doswapz_crt_controls_hidden';
 var SKIP_LILY_KEY = 'doswapz_skip_lily';
 var SKIP_RABBIT_KEY = 'doswapz_skip_rabbit';
 var TEXT_SCALES = ['sm', 'md', 'lg', 'xl'];

 var PATH_CRUMBS = {
 '/classic/hub.html': ['SYSTEM_MENU'],
 '/classic/pages/pond-scum.html': ['POND_SCUM'],
 '/classic/pages/i-see-you.html': ['I_SEE_YOU'],
 '/orbit/pages/i-see-you.html': ['I_SEE_YOU'],
 '/classic/pages/lily-pad.html': ['LILY_PAD'],
 '/classic/pages/perpetual-vision-center.html': ['PERPETUAL_VISION_CENTER'],
 '/orbit/pages/perpetual-vision-center.html': ['PERPETUAL_VISION_CENTER'],
 '/classic/pages/perpetual-vision-vault.html': ['PERPETUAL_VISION_CENTER'],
 '/orbit/pages/perpetual-vision-vault.html': ['PERPETUAL_VISION_CENTER'],
 '/classic/pages/attic.html': ['THE_ATTIC'],
 '/classic/pages/basement.html': ['THE_BASEMENT'],
 '/classic/pages/basement/token-launcher.html': ['THE_BASEMENT', 'VANTABLACK', 'LAUNCHER'],
 '/classic/pages/basement/vantablack/market.html': ['THE_BASEMENT', 'VANTABLACK'],

 '/classic/pages/nodes.html': ['LILY_PAD', 'NODES'],
 '/classic/pages/13th-step.html': ['13TH_STEP'],

 '/classic/pages/doswapz/swap.html': ['DOSWAPZ', 'SWAP'],
 '/classic/pages/doswapz/mint.html': ['DOSWAPZ', 'MINT'],
 '/classic/pages/doswapz/meat.html': ['DOSWAPZ', 'MEAT'],
 '/classic/pages/doswapz/gallery.html': ['DOSWAPZ', 'MINT_GALLERY'],
 '/orbit/pages/doswapz/gallery.html': ['DOSWAPZ', 'MINT_GALLERY'],
 '/classic/pages/cryptodad/play.html': ['CRYPTO_DAD', 'PLAY'],
 '/classic/pages/cryptodad/mobile.html': ['CRYPTO_DAD', 'MOBILE'],
 '/classic/pages/cryptodad/how-to-play.html': ['CRYPTO_DAD', 'HOW_TO_PLAY'],
 '/classic/pages/cryptodad/rabbit.html': ['FTWR', 'GATE'],
 '/classic/pages/cryptodad/ftwr-maze.html': ['FTWR', 'MAZE'],
 '/classic/pages/cryptodad/ftwr-scoreboard.html': ['FTWR', 'SCORES'],
 '/classic/pages/tbb/scoreboard.html': ['TBB', 'SCORES'],
 '/classic/pages/basement/cryptomom/scoreboard.html': ['CRYPTO_MOM', 'SCORES'],
 '/classic/pages/arcade/intro.html': ['ARCADE', 'INTRO'],
 '/classic/pages/arcade/hub.html': ['ARCADE', 'HUB'],
 '/classic/pages/arcade/preview.html': ['ARCADE', 'PREVIEW'],
 '/classic/pages/arcade/scores.html': ['ARCADE', 'SCORES'],
 '/classic/pages/arcade/smoke-checklist.html': ['ARCADE', 'SMOKE'],
 '/orbit/pages/arcade/intro.html': ['ARCADE', 'INTRO'],
 '/orbit/pages/arcade/hub.html': ['ARCADE', 'HUB'],
 '/orbit/pages/arcade/preview.html': ['ARCADE', 'PREVIEW'],
 '/orbit/pages/arcade/scores.html': ['ARCADE', 'SCORES'],
 '/orbit/pages/arcade/smoke-checklist.html': ['ARCADE', 'SMOKE'],
 '/future/pages/arcade.html': ['ARCADE', 'FUTURE'],
 '/classic/pages/basement/cryptomom/play.html': ['CRYPTO_MOM', 'PLAY'],
 '/classic/pages/cryptodad/launch.html': ['CRYPTO_DAD', 'LAUNCH'],
 '/classic/pages/cryptodad/token.html': ['DOSWAPZ', 'TOKEN'],
 '/classic/pages/cryptodad/donate.html': ['CRYPTO_DAD', 'DONATE'],
 '/classic/pages/cryptodad/scoreboard.html': ['SCOREBOARD'],
 '/classic/pages/cryptodad/images.html': ['CRYPTO_DAD', 'IMAGES'],
 '/classic/pages/degen/trailer.html': ['DEGEN$', 'TRAILER'],
 '/classic/pages/degen/synopsis.html': ['DEGEN$', 'SYNOPSIS'],
 '/classic/pages/degen/donate.html': ['DEGEN$', 'DONATE'],
 '/classic/pages/hardwear/wallet.html': ['HARDWEAR', 'WALLET'],
 '/classic/pages/hardwear/merch.html': ['HARDWEAR', 'MERCH'],
 '/classic/pages/demplar/character.html': ['KNIGHTS_DEMPLAR', 'CHARACTER'],
 '/classic/pages/donate.html': ['DONATE'],
 '/docs/legal.html': ['DOCS', 'LEGAL'],
 '/docs/index.html': ['DOCS'],
 '/docs': ['DOCS']
 };

 function pathKey() {
 return window.location.pathname.replace(/\/+$/, '') || '/index.html';
 }

 function isSplash() {
 var p = pathKey();
 return p === '/index.html' || p === '/';
 }

 function isHub() {
 var p = pathKey();
 return p === '/classic/hub.html' || p === '/orbit/hub.html' || p === '/hub';
 }

 function rememberDestination(href) {
 try {
 localStorage.setItem(LAST_BOOT_KEY, href);
 } catch (e) {}
 }

 function getLastBoot() {
 try {
 return localStorage.getItem(LAST_BOOT_KEY) || '';
 } catch (e) {
 return '';
 }
 }

 function getGlitchLevel() {
 try {
 return localStorage.getItem(GLITCH_KEY) || 'NORMAL';
 } catch (e) {
 return 'NORMAL';
 }
 }

 function setGlitchLevel(level) {
 try {
 localStorage.setItem(GLITCH_KEY, level);
 } catch (e) {}
 document.documentElement.setAttribute('data-glitch-level', level);
 updateGlitchDialUi();
 if (window.DOSWAPZ_TICKER && typeof window.DOSWAPZ_TICKER.refresh === 'function') {
 window.DOSWAPZ_TICKER.refresh();
 }
 }

 function shouldSkipIntro(kind) {
 try {
 if (kind === 'lily') return localStorage.getItem(SKIP_LILY_KEY) === '1';
 if (kind === 'rabbit') return localStorage.getItem(SKIP_RABBIT_KEY) === '1';
 } catch (e) {}
 return false;
 }

 function setSkipIntro(kind, on) {
 try {
 var key = kind === 'lily' ? SKIP_LILY_KEY : SKIP_RABBIT_KEY;
 if (on) localStorage.setItem(key, '1');
 else localStorage.removeItem(key);
 } catch (e) {}
 }

 var NO_BREADCRUMB_PATHS = {
 '/classic/pages/eat-shit.html': true,
 '/eat-shit.html': true,
 '/classic/pages/basement/phunk-maker.html': true,
 '/orbit/pages/basement/phunk-maker.html': true,
 '/phunk-maker.html': true,
 '/phunk-lab.html': true
 };

 function shouldHideBreadcrumb() {
 if (document.body && document.body.dataset.noBreadcrumb) return true;
 return !!NO_BREADCRUMB_PATHS[pathKey()];
 }

 function injectBreadcrumb() {
 if (isSplash() || isHub()) return;
 if (shouldHideBreadcrumb()) return;
 var crumbs = PATH_CRUMBS[pathKey()];
 if (!crumbs || !crumbs.length) return;
 if (document.getElementById('dosPathBar')) return;

 var bar = document.createElement('div');
 bar.className = 'dos-path-bar';
 bar.id = 'dosPathBar';
 bar.innerHTML =
 '<span class="dos-path-root">C:\\DOSWAPZ\\</span>' +
 '<span class="dos-path-trail">' +
 crumbs.join('\\') +
 '\\&gt;</span>';

 var anchor =
 document.querySelector('.header') ||
 document.querySelector('.content') ||
 document.querySelector('.dos-screen') ||
 document.body;

 if (anchor && anchor.parentNode) {
 anchor.parentNode.insertBefore(bar, anchor);
 } else {
 document.body.insertBefore(bar, document.body.firstChild);
 }
 }

 function updateGlitchDialUi() {
 var dial = document.getElementById('glitchDial');
 if (!dial) return;
 var level = getGlitchLevel();
 dial.querySelectorAll('[data-level]').forEach(function (btn) {
 btn.classList.toggle('active', btn.getAttribute('data-level') === level);
 });
 }

 function getMotionOn() {
 try {
 var v = localStorage.getItem(MOTION_KEY);
 if (v === 'off' || v === '0') return false;
 if (v === 'on' || v === '1') return true;
 } catch (e) {}
 try {
 if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
 } catch (e2) {}
 return true;
 }

 function setMotionOn(on) {
 try {
 localStorage.setItem(MOTION_KEY, on ? 'on' : 'off');
 } catch (e) {}
 applyMotionState(on);
 updateControlsUi();
 }

 function applyMotionState(on) {
 var root = document.documentElement;
 var body = document.body;
 if (on) {
 root.removeAttribute('data-motion');
 root.classList.remove('dos-motion-off');
 if (body) body.classList.remove('dos-motion-off');
 } else {
 root.setAttribute('data-motion', 'off');
 root.classList.add('dos-motion-off');
 if (body) body.classList.add('dos-motion-off');
 }
 try {
 window.dispatchEvent(new CustomEvent('doswapz:motion', { detail: { on: !!on } }));
 } catch (e) {}
 }

 function getTextScale() {
 try {
 var v = localStorage.getItem(TEXT_KEY) || 'md';
 if (TEXT_SCALES.indexOf(v) >= 0) return v;
 } catch (e) {}
 return 'md';
 }

 function setTextScale(level) {
 if (TEXT_SCALES.indexOf(level) < 0) level = 'md';
 applyTextScale(level);
 updateControlsUi();
 }

 function nudgeTextScale(dir) {
 var i = TEXT_SCALES.indexOf(getTextScale());
 if (i < 0) i = 1;
 i = Math.max(0, Math.min(TEXT_SCALES.length - 1, i + dir));
 setTextScale(TEXT_SCALES[i]);
 }

 function clearPageZoomDamage() {
 // Whole-page zoom on html/body breaks wheel scroll + blurs VT323.
 try {
 var root = document.documentElement;
 var body = document.body;
 root.style.zoom = '';
 root.style.fontSize = '';
 if (body) {
 body.style.zoom = '';
 body.style.fontSize = '';
 body.style.transform = '';
 body.style.transformOrigin = '';
 }
 } catch (e) {}
 }

 // Alias - ensureDocumentScroll / boot must not throw ReferenceError
 function clearZoomDamage() {
 clearPageZoomDamage();
 }

 function textScaleTargets() {
 return document.querySelectorAll(
 [
 '.content',
 '#content',
 '.menu',
 '.hub-footer',
 '.swap-container',
 '.swap-box',
 '.dos-docs-panel',
 '.warnings-box',
 '.cabinets',
 '.boards',
 '.wrap',
 '.dos-screen > .content',
 'main'
 ].join(',')
 );
 }

 function clearContentTextZoom() {
 var nodes = textScaleTargets();
 for (var i = 0; i < nodes.length; i++) {
 try {
 nodes[i].style.zoom = '';
 nodes[i].style.fontSize = '';
 } catch (e) {}
 }
 var tag = document.getElementById('dosTextScaleStyle');
 if (tag) tag.textContent = '';
 }

 function ensureTextScaleStyleEl() {
 var tag = document.getElementById('dosTextScaleStyle');
 if (tag) return tag;
 tag = document.createElement('style');
 tag.id = 'dosTextScaleStyle';
 document.head.appendChild(tag);
 return tag;
 }

 function applyTextScale(level) {
 if (TEXT_SCALES.indexOf(level) < 0) level = 'md';
 var root = document.documentElement;
 var body = document.body;

 clearPageZoomDamage();

 root.setAttribute('data-text-scale', level);
 if (body) body.setAttribute('data-text-scale', level);

 ['sm', 'md', 'lg', 'xl'].forEach(function (k) {
 root.classList.remove('dos-text-' + k);
 if (body) body.classList.remove('dos-text-' + k);
 });
 root.classList.add('dos-text-' + level);
 if (body) body.classList.add('dos-text-' + level);

 // Visible size change WITHOUT zooming html/body (keeps wheel + crisp chrome).
 // Multipliers are mild so VT323 stays readable.
 var mult = { sm: 0.9, md: 1, lg: 1.12, xl: 1.24 }[level] || 1;
 clearContentTextZoom();

 if (mult !== 1) {
 // 1) Prefer element zoom on reading columns only (Chrome/Edge/Safari)
 var nodes = textScaleTargets();
 var usedZoom = false;
 for (var i = 0; i < nodes.length; i++) {
 try {
 if ('zoom' in nodes[i].style) {
 nodes[i].style.zoom = String(mult);
 usedZoom = true;
 }
 } catch (e) {}
 }

 // 2) Fallback stylesheet for engines without element zoom
 if (!usedZoom || nodes.length === 0) {
 var tag = ensureTextScaleStyleEl();
 var pct = Math.round(mult * 100);
 tag.textContent =
 'html.dos-text-' + level + ' .content,' +
 'html.dos-text-' + level + ' #content,' +
 'html.dos-text-' + level + ' .menu,' +
 'html.dos-text-' + level + ' .hub-footer,' +
 'html.dos-text-' + level + ' .swap-box,' +
 'html.dos-text-' + level + ' .wrap,' +
 'html.dos-text-' + level + ' .cabinets,' +
 'html.dos-text-' + level + ' .boards,' +
 'html.dos-text-' + level + ' .section-head,' +
 'html.dos-text-' + level + ' .option,' +
 'html.dos-text-' + level + ' .status,' +
 'html.dos-text-' + level + ' .menu-prompt,' +
 'html.dos-text-' + level + ' .btn,' +
 'html.dos-text-' + level + ' .disclaimer,' +
 'html.dos-text-' + level + ' .hub-map a,' +
 'html.dos-text-' + level + ' p,' +
 'html.dos-text-' + level + ' li,' +
 'html.dos-text-' + level + ' h1,' +
 'html.dos-text-' + level + ' h2 {' +
 'font-size: ' + pct + '% !important;' +
 '}';
 }
 }

 try {
 localStorage.setItem(TEXT_KEY, level);
 } catch (e) {}
 }

 function isNoScrollPage() {
 var path = pathKey();
 if (path === '/' || path === '/index.html' || path === '/portal.html') return true;
 if (!document.body) return false;
 if (document.body.classList.contains('splash-page')) return true;
 if (document.body.classList.contains('dos-no-scroll')) return true;
 if (document.body.dataset.noScroll === '1') return true;
 return false;
 }

 function nearestScrollable(start) {
 var el = start;
 while (el && el !== document.body && el !== document.documentElement) {
 if (el.nodeType === 1) {
 try {
 var st = window.getComputedStyle(el);
 var oy = st.overflowY;
 var ox = st.overflowX;
 var canY = (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
 el.scrollHeight > el.clientHeight + 2;
 var canX = (ox === 'auto' || ox === 'scroll' || ox === 'overlay') &&
 el.scrollWidth > el.clientWidth + 2;
 if (canY || canX) return el;
 } catch (e) {}
 }
 el = el.parentElement;
 }
 return null;
 }

 var wheelBound = false;

 /**
 * Force mouse-wheel / trackpad to scroll the document.
 * Some CRT layers + legacy zoom left the page unable to scroll at all.
 */
 function bindWheelScroll() {
 if (wheelBound) return;
 wheelBound = true;

 function applyDelta(e) {
 var se = document.scrollingElement || document.documentElement;
 if (!se) return;
 var dx = e.deltaX || 0;
 var dy = e.deltaY || 0;
 // deltaMode: 0=pixel, 1=line, 2=page
 if (e.deltaMode === 1) {
 dx *= 16;
 dy *= 16;
 } else if (e.deltaMode === 2) {
 dx *= se.clientWidth;
 dy *= se.clientHeight;
 }
 se.scrollTop += dy;
 se.scrollLeft += dx;
 }

 window.addEventListener(
 'wheel',
 function (e) {
 if (e.ctrlKey) return; // browser zoom gesture
 if (isNoScrollPage()) return;

 // Let nested scroll areas (modals, code boxes) handle themselves
 var nested = nearestScrollable(e.target);
 if (nested) {
 var dy = e.deltaY;
 var atTop = nested.scrollTop <= 0;
 var atBot = nested.scrollTop + nested.clientHeight >= nested.scrollHeight - 2;
 if ((dy < 0 && !atTop) || (dy > 0 && !atBot)) return;
 // nested stuck at edge -> page scroll
 }

 // Drive page scroll even if another handler already called preventDefault
 // (present/orbit layers used to swallow the wheel with no scroll target).
 if (!e.defaultPrevented) {
 e.preventDefault();
 }
 applyDelta(e);
 },
 { passive: false, capture: true }
 );
 }

 /** Ensure document can scroll with the mouse wheel (content pages). */
 function ensureDocumentScroll() {
 var root = document.documentElement;
 var body = document.body;
 if (!body) return;

 if (isNoScrollPage()) {
 root.classList.add('dos-no-scroll');
 body.classList.add('dos-no-scroll');
 return;
 }

 root.classList.remove('dos-no-scroll');
 body.classList.remove('dos-no-scroll');

 try {
 root.style.setProperty('overflow-x', 'hidden', 'important');
 root.style.setProperty('overflow-y', 'auto', 'important');
 root.style.setProperty('height', 'auto', 'important');
 root.style.setProperty('max-height', 'none', 'important');
 body.style.setProperty('overflow-x', 'hidden', 'important');
 body.style.setProperty('overflow-y', 'auto', 'important');
 body.style.setProperty('height', 'auto', 'important');
 body.style.setProperty('max-height', 'none', 'important');
 body.style.setProperty('position', 'relative', 'important');
 clearZoomDamage();
 } catch (e) {}

 try {
 ['.glitch-layer', '.vignette', '.dos-brownout-black', '.dos-brownout-ping'].forEach(function (sel) {
 var el = document.querySelector(sel);
 if (el) el.style.pointerEvents = 'none';
 });
 // Scanline pseudo can't be targeted - ensure parent doesn't capture
 var screens = document.querySelectorAll('.dos-screen, #screen');
 for (var s = 0; s < screens.length; s++) {
 screens[s].style.pointerEvents = '';
 screens[s].style.overflow = 'visible';
 }
 } catch (e2) {}

 bindWheelScroll();
 }

 function getScanOn() {
 try {
 var v = localStorage.getItem(SCAN_KEY);
 if (v === 'off' || v === '0') return false;
 } catch (e) {}
 return true;
 }

 function setScanOn(on) {
 try {
 localStorage.setItem(SCAN_KEY, on ? 'on' : 'off');
 } catch (e) {}
 applyScanState(on);
 updateControlsUi();
 }

 function applyScanState(on) {
 var root = document.documentElement;
 var body = document.body;
 if (on) {
 root.removeAttribute('data-scan');
 root.classList.remove('dos-scan-off');
 if (body) body.classList.remove('dos-scan-off');
 } else {
 root.setAttribute('data-scan', 'off');
 root.classList.add('dos-scan-off');
 if (body) body.classList.add('dos-scan-off');
 }
 }

 function getHiConOn() {
 try {
 return localStorage.getItem(HICON_KEY) === 'on';
 } catch (e) {
 return false;
 }
 }

 function setHiConOn(on) {
 try {
 localStorage.setItem(HICON_KEY, on ? 'on' : 'off');
 } catch (e) {}
 applyHiConState(on);
 updateControlsUi();
 }

 function applyHiConState(on) {
 var root = document.documentElement;
 var body = document.body;
 if (on) {
 root.setAttribute('data-hicon', 'on');
 root.classList.add('dos-hicon');
 if (body) body.classList.add('dos-hicon');
 } else {
 root.removeAttribute('data-hicon');
 root.classList.remove('dos-hicon');
 if (body) body.classList.remove('dos-hicon');
 }
 }

 function applyAllDisplayPrefs() {
 applyMotionState(getMotionOn());
 applyTextScale(getTextScale());
 applyScanState(getScanOn());
 applyHiConState(getHiConOn());
 }

 function getControlsHidden() {
 try {
 return localStorage.getItem(CONTROLS_HIDE_KEY) === '1';
 } catch (e) {
 return false;
 }
 }

 function setControlsHidden(on) {
 try {
 if (on) localStorage.setItem(CONTROLS_HIDE_KEY, '1');
 else localStorage.removeItem(CONTROLS_HIDE_KEY);
 } catch (e) {}
 applyControlsHidden(on);
 updateControlsUi();
 }

 function applyControlsHidden(on) {
 var dial = document.getElementById('glitchDial');
 var root = document.documentElement;
 var body = document.body;
 if (on) {
 root.classList.add('dos-crt-hidden');
 if (body) body.classList.add('dos-crt-hidden');
 if (dial) {
 dial.classList.add('is-hidden');
 dial.setAttribute('aria-expanded', 'false');
 }
 } else {
 root.classList.remove('dos-crt-hidden');
 if (body) body.classList.remove('dos-crt-hidden');
 if (dial) {
 dial.classList.remove('is-hidden');
 dial.setAttribute('aria-expanded', 'true');
 }
 }
 }

 function updateControlsUi() {
 var motionBtn = document.getElementById('motionToggleBtn');
 if (motionBtn) {
 var mon = getMotionOn();
 motionBtn.textContent = mon ? 'ON' : 'OFF';
 motionBtn.classList.toggle('active', mon);
 motionBtn.setAttribute('aria-pressed', mon ? 'true' : 'false');
 motionBtn.title = mon ? 'FX motion on - tap to calm' : 'FX motion off';
 }

 var scale = getTextScale();
 var textLabel = document.getElementById('textScaleLabel');
 if (textLabel) {
 textLabel.textContent = scale.toUpperCase();
 textLabel.title = 'Text size: ' + scale;
 }
 var textBtns = document.querySelectorAll('[data-text-nudge]');
 textBtns.forEach(function (b) {
 var dir = b.getAttribute('data-text-nudge');
 var i = TEXT_SCALES.indexOf(scale);
 if (dir === '-1') b.disabled = i <= 0;
 if (dir === '1') b.disabled = i >= TEXT_SCALES.length - 1;
 });

 var scanBtn = document.getElementById('scanToggleBtn');
 if (scanBtn) {
 var son = getScanOn();
 scanBtn.textContent = son ? 'ON' : 'OFF';
 scanBtn.classList.toggle('active', son);
 scanBtn.setAttribute('aria-pressed', son ? 'true' : 'false');
 scanBtn.title = son ? 'Scanlines on' : 'Scanlines off';
 }

 var hiBtn = document.getElementById('hiconToggleBtn');
 if (hiBtn) {
 var hon = getHiConOn();
 hiBtn.textContent = hon ? 'ON' : 'OFF';
 hiBtn.classList.toggle('active', hon);
 hiBtn.setAttribute('aria-pressed', hon ? 'true' : 'false');
 hiBtn.title = hon ? 'High contrast on' : 'High contrast off';
 }

 var hideBtn = document.getElementById('crtHideBtn');
 var showBtn = document.getElementById('crtShowBtn');
 var hidden = getControlsHidden();
 applyControlsHidden(hidden);
 if (hideBtn) {
 hideBtn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
 hideBtn.title = 'Hide CRT controls';
 }
 if (showBtn) {
 showBtn.title = 'Show CRT controls';
 showBtn.setAttribute('aria-label', 'Show CRT controls');
 }
 }

 // back-compat name
 function updateMotionUi() {
 updateControlsUi();
 }

 function injectGlitchDial() {
 if (isSplash() || document.getElementById('glitchDial')) return;

 var dial = document.createElement('div');
 dial.className = 'glitch-dial crt-controls';
 dial.id = 'glitchDial';
 dial.setAttribute('aria-label', 'CRT display controls');
 dial.setAttribute('aria-expanded', 'true');
 dial.innerHTML =
 '<button type="button" id="crtShowBtn" class="crt-show-tab" title="Show CRT controls" aria-label="Show CRT controls">CTRL</button>' +
 '<div class="crt-controls-panel" id="crtControlsPanel">' +
 '<div class="crt-controls-row">' +
 '<span class="glitch-dial-label">GLITCH</span>' +
 '<button type="button" data-level="CALM" title="Calm FX">CALM</button>' +
 '<button type="button" data-level="NORMAL" title="Normal FX">NORM</button>' +
 '<button type="button" data-level="CHAOS" title="Chaos FX">CHAOS</button>' +
 '<span class="glitch-dial-sep" aria-hidden="true"></span>' +
 '<span class="glitch-dial-label">MOTION</span>' +
 '<button type="button" id="motionToggleBtn" class="motion-toggle chip-toggle" aria-pressed="true" title="Toggle motion FX">ON</button>' +
 '<span class="glitch-dial-sep" aria-hidden="true"></span>' +
 '<button type="button" id="crtHideBtn" class="crt-hide-btn" title="Hide CRT controls" aria-label="Hide CRT controls">HIDE</button>' +
 '</div>' +
 '<div class="crt-controls-row crt-controls-help">' +
 '<span class="glitch-dial-label">TEXT</span>' +
 '<button type="button" data-text-nudge="-1" title="Smaller text" aria-label="Smaller text">A-</button>' +
 '<button type="button" id="textScaleLabel" class="chip-readout" title="Text size" disabled>MD</button>' +
 '<button type="button" data-text-nudge="1" title="Bigger text" aria-label="Bigger text">A+</button>' +
 '<span class="glitch-dial-sep" aria-hidden="true"></span>' +
 '<span class="glitch-dial-label">SCAN</span>' +
 '<button type="button" id="scanToggleBtn" class="chip-toggle" aria-pressed="true" title="Scanlines">ON</button>' +
 '<span class="glitch-dial-sep" aria-hidden="true"></span>' +
 '<span class="glitch-dial-label">HI-CON</span>' +
 '<button type="button" id="hiconToggleBtn" class="chip-toggle" aria-pressed="false" title="High contrast">OFF</button>' +
 '</div>' +
 '</div>';

 dial.addEventListener('click', function (e) {
 var t = e.target.closest('button');
 if (!t) return;

 if (t.id === 'crtHideBtn') {
 setControlsHidden(true);
 return;
 }
 if (t.id === 'crtShowBtn') {
 setControlsHidden(false);
 return;
 }
 if (t.id === 'motionToggleBtn') {
 setMotionOn(!getMotionOn());
 return;
 }
 if (t.id === 'scanToggleBtn') {
 setScanOn(!getScanOn());
 return;
 }
 if (t.id === 'hiconToggleBtn') {
 setHiConOn(!getHiConOn());
 return;
 }
 if (t.hasAttribute('data-text-nudge')) {
 // parseInt: do NOT use `Number(x) || 0` - works, but be explicit for -1
 var dir = parseInt(t.getAttribute('data-text-nudge'), 10);
 if (!isNaN(dir) && dir !== 0) {
 nudgeTextScale(dir);
 // Re-apply after tick so late-rendered .content nodes are included
 setTimeout(function () {
 applyTextScale(getTextScale());
 updateControlsUi();
 }, 0);
 }
 return;
 }
 if (t.hasAttribute('data-level')) {
 setGlitchLevel(t.getAttribute('data-level'));
 }
 });

 document.body.appendChild(dial);
 document.documentElement.setAttribute('data-glitch-level', getGlitchLevel());
 applyAllDisplayPrefs();
 applyControlsHidden(getControlsHidden());
 updateGlitchDialUi();
 updateControlsUi();
 // Content nodes may mount after shell - re-apply text scale once more
 setTimeout(function () {
 applyTextScale(getTextScale());
 updateControlsUi();
 }, 50);
 setTimeout(function () {
 applyTextScale(getTextScale());
 }, 300);
 }

 function mountIntroSkipUi(kind, targetHref) {
 var id = kind === 'lily' ? 'skipLilyNext' : 'skipRabbitNext';
 if (document.getElementById(id)) return;

 var wrap = document.createElement('label');
 wrap.className = 'intro-skip-opt';
 wrap.innerHTML =
 '<input type="checkbox" id="' +
 id +
 '" ' +
 (shouldSkipIntro(kind) ? 'checked' : '') +
 '> SKIP INTRO NEXT TIME';

 wrap.querySelector('input').addEventListener('change', function (e) {
 setSkipIntro(kind, e.target.checked);
 });

 var footer = document.querySelector('.footer') || document.querySelector('.skip-btn') || document.body;
 footer.appendChild(wrap);

 if (shouldSkipIntro(kind) && targetHref) {
 if (window.DOSWAPZ_TRANSITION) {
 window.DOSWAPZ_TRANSITION.navigate(targetHref, { skipFade: true, preDelay: 0, delay: 400 });
 } else {
 window.location.replace(targetHref);
 }
 }
 }

 var shellInited = false;

 function ensureDocsFooter() {
 if (document.querySelector('script[data-docs-footer]') || window.__DOSWAPZ_DOCS_FOOTER__) return;
 var s = document.createElement('script');
 s.src = '/assets/js/core/docs-footer.js';
 s.setAttribute('data-docs-footer', '1');
 (document.body || document.documentElement).appendChild(s);
 }

 function init() {
 if (shellInited) return;
 shellInited = true;

 if (!document.querySelector('script[data-gag-turn]') && !window.__DOSWAPZ_GAG_TURN_FULL__) {
  var gag = document.createElement('script');
  gag.src = '/assets/js/core/gag-turn.js?v=gag7';
  gag.setAttribute('data-gag-turn', '1');
  (document.body || document.documentElement).appendChild(gag);
 }

 ensureDocumentScroll();
 applyAllDisplayPrefs();
 ensureDocsFooter();
 injectBreadcrumb();
 injectGlitchDial();
 ensureDocumentScroll();

 if (window.DOSWAPZ_TRANSITION && !document.documentElement.dataset.transitionBound) {
 document.documentElement.dataset.transitionBound = '1';
 window.DOSWAPZ_TRANSITION.bind(document);
 }

 if (isHub() && window.DOSWAPZ_HUB) {
 window.DOSWAPZ_HUB.init();
 }

 var p = pathKey();
 if (p === '/classic/pages/lily-pad.html') {
 mountIntroSkipUi('lily', '/classic/pages/nodes.html');
 }
 if (p === '/classic/pages/cryptodad/rabbit.html') {
 mountIntroSkipUi('rabbit', '/classic/pages/cryptodad/ftwr-maze.html');
 }

 // Re-assert scroll after late overlays inject
 setTimeout(ensureDocumentScroll, 0);
 setTimeout(ensureDocumentScroll, 400);
 }

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', init);
 } else {
 init();
 }

 // Apply saved display prefs ASAP (even before dial inject) so first paint matches
 if (document.documentElement) {
 try {
 clearZoomDamage();
 applyAllDisplayPrefs();
 } catch (e) {}
 }

 return {
 rememberDestination: rememberDestination,
 getLastBoot: getLastBoot,
 getGlitchLevel: getGlitchLevel,
 setGlitchLevel: setGlitchLevel,
 getMotionOn: getMotionOn,
 setMotionOn: setMotionOn,
 getTextScale: getTextScale,
 setTextScale: setTextScale,
 getScanOn: getScanOn,
 setScanOn: setScanOn,
 getHiConOn: getHiConOn,
 setHiConOn: setHiConOn,
 getControlsHidden: getControlsHidden,
 setControlsHidden: setControlsHidden,
 ensureDocumentScroll: ensureDocumentScroll,
 shouldSkipIntro: shouldSkipIntro,
 setSkipIntro: setSkipIntro,
 mountIntroSkipUi: mountIntroSkipUi
 };
})();