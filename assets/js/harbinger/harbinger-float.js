/**
 * H4RB1NG3R - floating head (stationary)
 * Space-void face * crystal shards peel into the void
 * No mouse follow - head stays centered with soft idle float only
 */
window.HARBINGER_FLOAT = (function () {
 'use strict';

 var DEFAULT_HEAD = '/assets/images/harbinger/head-float-core.png';
 var SHARD_COUNT = 20;
 var SHARD_BASE = '/assets/images/harbinger/shards/shard-';

 function rand(a, b) {
 return a + Math.random() * (b - a);
 }

 function pickColor() {
 var palette = [
 [80, 220, 210],
 [120, 90, 220],
 [60, 180, 255],
 [180, 80, 220],
 [40, 255, 200]
 ];
 return palette[(Math.random() * palette.length) | 0];
 }

 function mount(container, options) {
 if (!container) return null;
 options = options || {};

 var headUrl = options.headUrl || DEFAULT_HEAD;
 var pixel = !!options.pixel;
 var shardsOnly = !!options.shardsOnly;
 var width = options.width || 480;
 var height = options.height || 560;
 var headFallbacks = [
 headUrl,
 '/assets/images/harbinger/head-float-core.png',
 '/assets/images/harbinger/front.png',
 '/assets/images/harbinger/face-head-crop.jpg'
 ];
 var headTry = 0;

 container.innerHTML = '';
 container.classList.add('hb-float-root');
 container.style.width = '100%';
 container.style.height = '100%';
 container.style.minHeight = (height || 320) + 'px';
 container.style.position = 'absolute';
 container.style.inset = '0';
 container.style.margin = '0';
 container.style.overflow = 'hidden';

 // Shards canvas only (head can live in page HTML when shardsOnly)
 var canvas = document.createElement('canvas');
 canvas.className = 'hb-float-shards';
 canvas.style.cssText =
 'position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none;';
 container.appendChild(canvas);

 var headWrap = null;
 var headImg = null;
 var glow = null;

 if (!shardsOnly) {
 var stage = document.createElement('div');
 stage.className = 'hb-float-stage';
 stage.style.cssText =
 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
 'pointer-events:none;z-index:5;';

 headWrap = document.createElement('div');
 headWrap.className = 'hb-float-head-wrap';
 headWrap.style.cssText =
 'position:relative;width:78%;max-width:360px;z-index:6;will-change:transform;' +
 (pixel ? 'image-rendering:pixelated;' : '');

 headImg = document.createElement('img');
 headImg.alt = 'Harbinger';
 headImg.draggable = false;
 headImg.style.cssText =
 'display:block;width:100%;height:auto;max-height:520px;object-fit:contain;' +
 'position:relative;z-index:2;' +
 'filter:drop-shadow(0 0 22px rgba(80,200,230,0.35)) drop-shadow(0 0 48px rgba(120,70,220,0.22));' +
 (pixel ? 'image-rendering:pixelated;' : '');

 function setHeadSrc(url) {
 var bust = (url.indexOf('?') >= 0 ? '&' : '?') + 'v=face14';
 headImg.src = url + bust;
 }
 headImg.onerror = function () {
 headTry += 1;
 if (headTry < headFallbacks.length) setHeadSrc(headFallbacks[headTry]);
 };
 setHeadSrc(headFallbacks[0]);

 glow = document.createElement('div');
 glow.className = 'hb-float-glow';
 glow.style.cssText =
 'position:absolute;left:50%;top:48%;width:80%;height:60%;transform:translate(-50%,-50%);' +
 'border-radius:50%;background:radial-gradient(circle,rgba(100,220,255,0.18),transparent 68%);' +
 'pointer-events:none;z-index:1;filter:blur(8px);';

 headWrap.appendChild(glow);
 headWrap.appendChild(headImg);
 stage.appendChild(headWrap);
 container.appendChild(stage);
 }

 var ctx = canvas.getContext('2d');
 var dpr = Math.min(window.devicePixelRatio || 1, 2);
 var running = true;
 var t0 = performance.now();
 var shards = [];
 var spriteImgs = [];
 var spritesReady = 0;

 function resize() {
 var r = container.getBoundingClientRect();
 canvas.width = Math.max(1, Math.floor(r.width * dpr));
 canvas.height = Math.max(1, Math.floor(r.height * dpr));
 ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
 }

 function loadSprites(cb) {
 var n = SHARD_COUNT;
 if (n <= 0) {
 cb();
 return;
 }
 for (var i = 0; i < n; i++) {
 (function (idx) {
 var img = new Image();
 img.onload = img.onerror = function () {
 spritesReady += 1;
 if (img.complete && img.naturalWidth) spriteImgs.push(img);
 if (spritesReady >= n) cb();
 };
 img.src = SHARD_BASE + String(idx).padStart(2, '0') + '.png';
 })(i);
 }
 }

 // Head center + outer ring only (never inside face / space void)
 function headFrame() {
 var r = container.getBoundingClientRect();
 return {
 w: r.width,
 h: r.height,
 cx: r.width * 0.5,
 cy: r.height * 0.5,
 // outer silhouette of head (approx)
 outerRx: r.width * 0.34,
 outerRy: r.height * 0.42
 };
 }

 // Speed tiers: crawl -> drift -> cruise -> whizz
 function pickSpeedTier() {
 var roll = Math.random();
 if (roll < 0.22) {
 // super slow
 return { speed: rand(1.2, 4.5), life: rand(14, 28), spin: rand(-0.35, 0.35), size: rand(5, 14), trail: false };
 }
 if (roll < 0.5) {
 // slow drift
 return { speed: rand(5, 12), life: rand(9, 18), spin: rand(-0.9, 0.9), size: rand(6, 16), trail: false };
 }
 if (roll < 0.78) {
 // medium
 return { speed: rand(14, 28), life: rand(5, 11), spin: rand(-1.6, 1.6), size: rand(7, 20), trail: true };
 }
 // whizz by
 return { speed: rand(38, 72), life: rand(2.2, 5), spin: rand(-3.5, 3.5), size: rand(8, 22), trail: true };
 }

 function spawnShard() {
 var f = headFrame();
 var ang = rand(0, Math.PI * 2);
 // Outside head only - ring just beyond silhouette, never in face cavity
 var ring = rand(1.05, 1.75);
 var x = f.cx + Math.cos(ang) * f.outerRx * ring;
 var y = f.cy + Math.sin(ang) * f.outerRy * ring;

 var tier = pickSpeedTier();
 var color = pickColor();
 var useSprite = spriteImgs.length && Math.random() > 0.3;
 var sprite = useSprite ? spriteImgs[(Math.random() * spriteImgs.length) | 0] : null;

 // Motion: mostly tangential orbit + outward drift (varies by speed)
 var tx = -Math.sin(ang);
 var ty = Math.cos(ang);
 var ox = Math.cos(ang);
 var oy = Math.sin(ang);
 var tangentBias = tier.speed < 12 ? rand(0.55, 0.95) : rand(0.15, 0.65);
 var outBias = 1 - tangentBias * 0.85;

 shards.push({
 x: x,
 y: y,
 vx: (tx * tangentBias + ox * outBias) * tier.speed + rand(-2, 2),
 vy: (ty * tangentBias + oy * outBias) * tier.speed * 0.9 + rand(-3, 2),
 rot: rand(0, Math.PI * 2),
 spin: tier.spin,
 size: tier.size,
 life: tier.life,
 age: 0,
 color: color,
 sprite: sprite,
 peel: !!tier.trail,
 z: rand(0.4, 1.45),
 trail: [],
 speedClass: tier.speed
 });
 }

 function seedOrbit() {
 for (var i = 0; i < 22; i++) spawnShard();
 }

 function tick(now) {
 if (!running) return;
 var dt = Math.min(0.05, (now - (tick._last || now)) / 1000);
 tick._last = now;
 var elapsed = (now - t0) / 1000;

 var r = container.getBoundingClientRect();
 var w = r.width;
 var h = r.height;

 // Soft idle float when head is owned by this engine
 if (headWrap) {
 var bob = Math.sin(elapsed * 0.9) * 8;
 var sway = Math.sin(elapsed * 0.45) * 4;
 var scale = 1 + Math.sin(elapsed * 0.7) * 0.012;
 headWrap.style.transform =
 'translate(' + sway.toFixed(2) + 'px,' + bob.toFixed(2) + 'px) scale(' + scale.toFixed(4) + ')';
 if (glow) glow.style.opacity = String(0.55 + Math.sin(elapsed * 1.2) * 0.2);
 }

 if (!tick._spawnAcc) tick._spawnAcc = 0;
 tick._spawnAcc += dt;
 // Outer-only field - occasional new shards (mixed speeds)
 if (tick._spawnAcc > rand(0.35, 1.1)) {
 tick._spawnAcc = 0;
 spawnShard();
 if (Math.random() > 0.55) spawnShard();
 }
 if (shards.length < 24) spawnShard();

 ctx.clearRect(0, 0, w, h);

 var hf = headFrame();

 // Soft distant travel streaks (outside only, faint)
 ctx.save();
 ctx.globalAlpha = 0.07;
 for (var s = 0; s < 10; s++) {
 var sy = ((elapsed * 28 + s * 51) % (h + 40)) - 20;
 var sx = (s * 89 + elapsed * 9) % w;
 ctx.strokeStyle = 'rgba(140,200,255,0.55)';
 ctx.lineWidth = 1;
 ctx.beginPath();
 ctx.moveTo(sx, sy);
 ctx.lineTo(sx - 14 - (s % 4) * 3, sy + 36 + (s % 3) * 8);
 ctx.stroke();
 }
 ctx.restore();

 for (var i = shards.length - 1; i >= 0; i--) {
 var p = shards[i];
 p.age += dt;
 p.x += p.vx * dt * (0.75 + p.z * 0.4);
 p.y += p.vy * dt * (0.75 + p.z * 0.4);

 // Gentle outward push - keep clear of face center
 var dx = p.x - hf.cx;
 var dy = p.y - hf.cy;
 var dist = Math.sqrt(dx * dx + dy * dy) || 1;
 var minR = Math.min(hf.outerRx, hf.outerRy) * 0.95;
 if (dist < minR) {
 // kick back outside if somehow inside
 p.x = hf.cx + (dx / dist) * minR * 1.08;
 p.y = hf.cy + (dy / dist) * minR * 1.08;
 p.vx += (dx / dist) * 20 * dt;
 p.vy += (dy / dist) * 20 * dt;
 } else {
 // slow ones drift; fast ones keep rocketing out
 var push = p.speedClass < 12 ? 2.5 : (p.speedClass > 35 ? 9 : 5);
 p.vx += (dx / dist) * push * dt;
 p.vy += (dy / dist) * push * 0.75 * dt - 1.2 * dt;
 }
 p.rot += p.spin * dt;

 if (p.peel) {
 p.trail.push({ x: p.x, y: p.y, a: 1 });
 if (p.trail.length > (p.speedClass > 35 ? 12 : 7)) p.trail.shift();
 }

 var lifeT = p.age / p.life;
 if (lifeT >= 1 || p.x < -40 || p.x > w + 40 || p.y < -40 || p.y > h + 40) {
 shards.splice(i, 1);
 continue;
 }

 var alpha = lifeT < 0.15 ? lifeT / 0.15 : 1 - Math.pow(lifeT, 1.4);
 alpha = Math.max(0, Math.min(1, alpha)) * (0.55 + p.z * 0.35);

 if (p.trail.length > 1) {
 ctx.save();
 ctx.strokeStyle = 'rgba(' + p.color[0] + ',' + p.color[1] + ',' + p.color[2] + ',0.25)';
 ctx.lineWidth = 1.2;
 ctx.beginPath();
 for (var t = 0; t < p.trail.length; t++) {
 if (t === 0) ctx.moveTo(p.trail[t].x, p.trail[t].y);
 else ctx.lineTo(p.trail[t].x, p.trail[t].y);
 }
 ctx.stroke();
 ctx.restore();
 }

 ctx.save();
 ctx.translate(p.x, p.y);
 ctx.rotate(p.rot);
 ctx.globalAlpha = alpha;
 var sz = p.size * (0.7 + p.z * 0.5);

 if (p.sprite && p.sprite.naturalWidth) {
 var iw = p.sprite.naturalWidth;
 var ih = p.sprite.naturalHeight;
 var scaleS = sz / Math.max(iw, ih);
 if (pixel) ctx.imageSmoothingEnabled = false;
 ctx.drawImage(p.sprite, -iw * scaleS * 0.5, -ih * scaleS * 0.5, iw * scaleS, ih * scaleS);
 } else {
 ctx.fillStyle = 'rgba(' + p.color[0] + ',' + p.color[1] + ',' + p.color[2] + ',0.9)';
 ctx.beginPath();
 ctx.moveTo(0, -sz);
 ctx.lineTo(sz * 0.45, -sz * 0.1);
 ctx.lineTo(sz * 0.2, sz * 0.7);
 ctx.lineTo(-sz * 0.35, sz * 0.35);
 ctx.lineTo(-sz * 0.4, -sz * 0.25);
 ctx.closePath();
 ctx.fill();
 ctx.fillStyle = 'rgba(255,255,255,0.35)';
 ctx.beginPath();
 ctx.moveTo(0, -sz * 0.7);
 ctx.lineTo(sz * 0.15, -sz * 0.1);
 ctx.lineTo(-sz * 0.1, sz * 0.1);
 ctx.closePath();
 ctx.fill();
 }
 ctx.restore();
 }

 requestAnimationFrame(tick);
 }

 resize();
 window.addEventListener('resize', resize);

 // Start anim immediately - don't wait on shard sprites (those can hang)
 seedOrbit();
 requestAnimationFrame(tick);
 loadSprites(function () { /* sprites enhance shards when ready */ });

 return {
 setPixel: function (on) {
 pixel = !!on;
 if (headImg) headImg.style.imageRendering = pixel ? 'pixelated' : 'auto';
 if (headWrap) headWrap.style.imageRendering = pixel ? 'pixelated' : 'auto';
 },
 is3D: false,
 destroy: function () {
 running = false;
 window.removeEventListener('resize', resize);
 container.innerHTML = '';
 container.classList.remove('hb-float-root');
 }
 };
 }

 return { mount: mount };
})();
