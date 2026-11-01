/**
 * H4RB1NG3R - in-place matrix title morph
 * Letters flip case, leet digits swap (4↔A, 1↔I, 3↔E), colors + fonts pulse.
 * Matrix flashes use English letters/numbers only - word always reads harbinger.
 */
window.HARBINGER_TITLE = (function () {
 'use strict';

 var MATRIX_CHARS = '01H4RB1NG3RharbingerABCDEF#$%&*';

 var PALETTE = [
 '#00ff41', '#00ffff', '#ffff00', '#ff66cc', '#9944ff',
 '#ff4444', '#88ff00', '#00ccff', '#ffaa00', '#cc88ff'
 ];

 var FONTS = [
 { family: "'VT323', monospace", cls: 'hb-font-vt' },
 { family: "'Press Start 2P', monospace", cls: 'hb-font-pixel' },
 { family: "'Share Tech Mono', monospace", cls: 'hb-font-tech' },
 { family: "'Courier New', monospace", cls: 'hb-font-courier' },
 { family: 'Consolas, monospace', cls: 'hb-font-consolas' },
 { family: 'Impact, sans-serif', cls: 'hb-font-impact' },
 { family: 'Georgia, serif', cls: 'hb-font-serif' },
 { family: "'Arial Black', sans-serif", cls: 'hb-font-heavy' }
 ];

 /* H 4 R B 1 N G 3 R -> harbinger */
 var SLOT_DEFS = [
 { forms: ['H', 'h'] },
 { forms: ['4', 'A', 'a'], leet: true },
 { forms: ['R', 'r'] },
 { forms: ['B', 'b'] },
 { forms: ['1', 'I', 'i'], leet: true },
 { forms: ['N', 'n'] },
 { forms: ['G', 'g'] },
 { forms: ['3', 'E', 'e'], leet: true },
 { forms: ['R', 'r'] }
 ];

 function nextForm(slot, preferLeet) {
 var forms = slot.forms;
 if (forms.length <= 1) return forms[0];
 var cur = slot.el.textContent;
 var idx = forms.indexOf(cur);
 if (idx < 0) return forms[0];
 if (slot.leet && preferLeet && Math.random() < 0.55) {
 return forms[0];
 }
 return forms[(idx + 1) % forms.length];
 }

 function applyColor(slot, color) {
 /* CSS var survives orbit void !important span washes */
 slot.el.style.setProperty('--hb-char-color', color);
 slot.el.style.setProperty('color', color, 'important');
 }

 function applyFont(slot) {
 var font = FONTS[slot.fontIdx];
 slot.el.style.setProperty('font-family', font.family, 'important');
 FONTS.forEach(function (f) {
 slot.el.classList.remove(f.cls);
 });
 slot.el.classList.add(font.cls);
 }

 function nextFont(slot) {
 slot.fontIdx = (slot.fontIdx + 1 + Math.floor(Math.random() * 2)) % FONTS.length;
 applyFont(slot);
 }

 function mount(root, options) {
 if (!root) return null;
 options = options || {};
 var speed = options.speed != null ? options.speed : 1;

 root.classList.add('harbinger-title');
 root.setAttribute('aria-label', 'Harbinger');
 root.innerHTML = '';

 var slots = SLOT_DEFS.map(function (def, i) {
 var span = document.createElement('span');
 span.className = 'hb-char';
 span.setAttribute('aria-hidden', 'true');
 span.textContent = def.forms[0];
 span.classList.add(FONTS[i % FONTS.length].cls);
 root.appendChild(span);
 var slot = {
 forms: def.forms,
 leet: !!def.leet,
 el: span,
 phase: Math.random() * Math.PI * 2,
 colorIdx: i % PALETTE.length,
 fontIdx: i % FONTS.length,
 glitchUntil: 0
 };
 applyColor(slot, PALETTE[i % PALETTE.length]);
 applyFont(slot);
 return slot;
 });

 var running = true;
 var last = performance.now();

 function tick(now) {
 if (!running) return;
 var dt = now - last;
 last = now;

 slots.forEach(function (slot, i) {
 slot.phase += dt * 0.004 * speed;

 if (now < slot.glitchUntil) {
 return;
 }

 if (slot.el.classList.contains('hb-glitch')) {
 slot.el.classList.remove('hb-glitch');
 }

 if (Math.random() < 0.038 * speed) {
 slot.glitchUntil = now + 45 + Math.random() * 70;
 slot.el.textContent = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
 slot.el.classList.add('hb-glitch');
 return;
 }

 if (Math.random() < 0.11 * speed) {
 slot.el.textContent = nextForm(slot, Math.sin(slot.phase) > 0);
 }

 if (Math.random() < 0.07 * speed) {
 slot.colorIdx = (slot.colorIdx + 1 + Math.floor(Math.random() * 2)) % PALETTE.length;
 applyColor(slot, PALETTE[(i + slot.colorIdx) % PALETTE.length]);
 }

 if (Math.random() < 0.06 * speed) {
 nextFont(slot);
 }
 });

 requestAnimationFrame(tick);
 }

 requestAnimationFrame(tick);

 return {
 destroy: function () {
 running = false;
 root.innerHTML = '';
 root.classList.remove('harbinger-title');
 }
 };
 }

 return { mount: mount, PALETTE: PALETTE, FONTS: FONTS, SLOTS: SLOT_DEFS };
})();