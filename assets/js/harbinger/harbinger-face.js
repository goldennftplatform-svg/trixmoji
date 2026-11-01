/**
 * H4RB1NG3R - crystalline head
 * Default: static front image (no mouse look, no breathe, no floating).
 * Pass options.interactive = true to restore multi-angle + tilt.
 */
window.HARBINGER_FACE = (function () {
 'use strict';

 var DEFAULT_IMAGES = {
 front: '/assets/images/harbinger/front.png',
 left: '/assets/images/harbinger/left.png',
 right: '/assets/images/harbinger/right.png',
 top: '/assets/images/harbinger/top.png',
 threeQuarter: '/assets/images/harbinger/threequarter.png'
 };

 function resolveImages(options) {
 var base = (options && options.images) || {};
 var headUrl = (options && (options.headUrl || options.imageUrl)) || DEFAULT_IMAGES.front;
 return {
 front: base.front || headUrl || DEFAULT_IMAGES.front,
 left: base.left || DEFAULT_IMAGES.left,
 right: base.right || DEFAULT_IMAGES.right,
 top: base.top || DEFAULT_IMAGES.top,
 threeQuarter: base.threeQuarter || DEFAULT_IMAGES.threeQuarter
 };
 }

 function preload(images, cb) {
 var keys = Object.keys(images);
 var pending = keys.length;
 var loaded = 0;
 if (!pending) {
 cb(false);
 return;
 }
 keys.forEach(function (key) {
 var img = new Image();
 img.onload = img.onerror = function () {
 if (img.complete && img.naturalWidth) loaded += 1;
 pending -= 1;
 if (!pending) cb(loaded > 0);
 };
 img.src = images[key];
 });
 }

 function isComingSoon(options) {
 var cfg = window.DOSWAPZ_HARBINGER_CONFIG || {};
 if (options && options.comingSoon === false) return false;
 if (options && options.comingSoon) return true;
 return !!cfg.comingSoon;
 }

 function mountComingSoon(container, options) {
 options = options || {};
 var theme = options.theme ||
 (document.body.classList.contains('orbit-void-inner') ? 'orbit' : 'classic');

 container.classList.add('hb-face-reactor', 'hb-face-coming-soon', 'hb-face-ready');
 container.setAttribute('data-era', theme);
 container.setAttribute('data-state', 'idle');
 container.innerHTML =
 '<div class="hb-coming-soon">' +
 '<p class="hb-coming-soon-tag">COMING SOON</p>' +
 '<p class="hb-coming-soon-line">the mirror is still assembling</p>' +
 '</div>';

 return {
 setState: function (state) {
 container.setAttribute('data-state', state || 'idle');
 },
 getState: function () {
 return container.getAttribute('data-state') || 'idle';
 },
 getVideoState: function () {
 return { loaded: true, playing: false, hasVideo: false };
 },
 destroy: function () {
 container.innerHTML = '';
 container.classList.remove('hb-face-reactor', 'hb-face-coming-soon', 'hb-face-ready');
 container.removeAttribute('data-era');
 container.removeAttribute('data-state');
 }
 };
 }

 function mount(container, options) {
 if (!container) return null;

 options = options || {};
 if (isComingSoon(options)) return mountComingSoon(container, options);

 var images = resolveImages(options);
 var theme = options.theme ||
 (document.body.classList.contains('orbit-void-inner') ? 'orbit' : 'classic');
 /* Static by default - title font morph must not be coupled to head motion */
 var interactive = options.interactive === true;
 var lightColor = theme === 'orbit' ? 'rgba(255, 102, 255, 0.42)' : 'rgba(255, 0, 255, 0.38)';

 var running = true;
 var currentAngle = 'front';
 var breatheTimer = null;
 var stageEl, wrapEl, headImg, lightLayer;

 container.classList.add(
 'hb-face-reactor',
 'hb-face-html',
 'hb-face-transparent',
 interactive ? 'hb-face-angles' : 'hb-face-static'
 );
 container.setAttribute('data-era', theme);
 container.setAttribute('data-state', 'idle');
 container.innerHTML =
 '<div class="hb-face-html-stage">' +
 '<div class="hb-face-head-wrap">' +
 '<img class="hb-face-img-angle" alt="Crystalline Head" />' +
 '</div>' +
 (interactive ? '<div class="hb-face-light-layer" aria-hidden="true"></div>' : '') +
 '</div>';

 stageEl = container.querySelector('.hb-face-html-stage');
 wrapEl = container.querySelector('.hb-face-head-wrap');
 headImg = container.querySelector('.hb-face-img-angle');
 lightLayer = container.querySelector('.hb-face-light-layer');

 function setTilt(x, y) {
 if (!interactive || !headImg) return;
 var tiltX = y * 8;
 var tiltY = -x * 12;
 headImg.style.transform =
 'perspective(600px) rotateX(' + tiltX + 'deg) rotateY(' + tiltY + 'deg)';
 }

 function setLight(clientX, clientY) {
 if (!interactive || !lightLayer || !stageEl) return;
 var rect = stageEl.getBoundingClientRect();
 if (!rect.width || !rect.height) return;
 var px = ((clientX - rect.left) / rect.width) * 100;
 var py = ((clientY - rect.top) / rect.height) * 100;
 lightLayer.style.background =
 'radial-gradient(circle 140px at ' + px + '% ' + py + '%, ' +
 lightColor + ', transparent 72%)';
 }

 function pickAngle(x, y) {
 if (Math.abs(x) > 0.12 && Math.abs(y) > 0.12) return 'threeQuarter';
 if (Math.abs(x) > Math.abs(y)) {
 if (x > 0.15) return 'right';
 if (x < -0.15) return 'left';
 return 'front';
 }
 if (y < -0.15) return 'top';
 return 'front';
 }

 function onMove(e) {
 if (!interactive) return;
 var rect = stageEl.getBoundingClientRect();
 if (!rect.width || !rect.height) return;

 var x = ((e.clientX - rect.left) / rect.width) - 0.5;
 var y = ((e.clientY - rect.top) / rect.height) - 0.5;
 var newAngle = pickAngle(x, y);

 if (newAngle !== currentAngle) {
 currentAngle = newAngle;
 headImg.src = images[newAngle] || images.front;
 }

 setTilt(x, y);
 setLight(e.clientX, e.clientY);
 }

 function onLeave() {
 if (!interactive) return;
 currentAngle = 'front';
 headImg.src = images.front;
 headImg.style.transform = 'none';
 if (lightLayer) lightLayer.style.background = 'transparent';
 }

 function startBreathing() {
 /* disabled - head stays static */
 }

 if (interactive) {
 stageEl.addEventListener('mousemove', onMove);
 stageEl.addEventListener('mouseleave', onLeave);
 }

 preload(images, function (ok) {
 if (!running) return;
 if (!ok) {
 container.innerHTML = '<p class="hb-face-fallback">Head images missing.</p>';
 return;
 }
 headImg.src = images.front;
 headImg.style.transform = 'none';
 container.classList.add('hb-face-ready');
 if (interactive) startBreathing();
 });

 return {
 setState: function (state) {
 container.setAttribute('data-state', state || 'idle');
 },
 getState: function () {
 return container.getAttribute('data-state') || 'idle';
 },
 getVideoState: function () {
 return {
 loaded: container.classList.contains('hb-face-ready'),
 playing: container.classList.contains('hb-face-ready'),
 hasVideo: false
 };
 },
 destroy: function () {
 running = false;
 if (breatheTimer) window.clearInterval(breatheTimer);
 if (interactive && stageEl) {
 stageEl.removeEventListener('mousemove', onMove);
 stageEl.removeEventListener('mouseleave', onLeave);
 }
 container.innerHTML = '';
 container.classList.remove(
 'hb-face-reactor', 'hb-face-html', 'hb-face-transparent',
 'hb-face-angles', 'hb-face-static', 'hb-face-ready'
 );
 container.removeAttribute('data-era');
 container.removeAttribute('data-state');
 }
 };
 }

 return { mount: mount, DEFAULT_IMAGES: DEFAULT_IMAGES };
})();