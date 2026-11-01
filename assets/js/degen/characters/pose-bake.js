/* Bake pose canvases from one reference sprite - R-facing transforms + mirrored L */
window.KOL_FIGHTER_POSE_BAKE = (function () {
 'use strict';

 const POSES = () => window.KOL_FIGHTER_POSES;

 function applyTransform(ctx, cx, feet, t) {
 if (!t) return;
 if (t.translateX) ctx.translate(t.translateX, 0);
 if (t.translateY) ctx.translate(0, t.translateY);
 if (t.rotate) ctx.rotate(t.rotate);
 if (t.scaleX || t.scaleY) ctx.scale(t.scaleX || 1, t.scaleY || 1);
 }

 const RECIPES = {
 idle: null,
 idleBreath: { scaleY: 1.02, translateY: -1 },
 walkForward1: { rotate: -0.03, translateX: -2, translateY: -4 },
 walkForward2: { rotate: 0.03, translateX: 3, translateY: -2 },
 walkBackward1: { rotate: 0.04, translateX: -4, translateY: -2 },
 walkBackward2: { rotate: -0.02, translateX: 2, translateY: -3 },
 crouch: { scaleY: 0.74, translateY: 6 },
 jump: { translateY: -14, rotate: -0.05 },
 jumpPeak: { translateY: -18, rotate: 0.02 },
 falling: { translateY: -8, rotate: 0.06 },
 blockHigh: { rotate: -0.04, translateY: -2, scaleY: 0.98 },
 blockLow: { scaleY: 0.78, translateY: 4, rotate: -0.02 },
 hitStun: { rotate: 0.16, translateX: -12, translateY: -8 },
 crouchHitStun: { scaleY: 0.72, rotate: 0.12, translateX: -8, translateY: 6 },
 knockdown: { rotate: 1.15, translateX: -18, translateY: 18, scaleY: 0.52 },
 getUp: { rotate: 0.28, translateY: 4, scaleY: 0.86 },
 victory: { translateY: -8, rotate: -0.08, scaleX: 1.05 },
 defeat: { rotate: 0.22, translateY: 12, scaleY: 0.88 },
 highPunch: { rotate: -0.1, translateX: 10, translateY: -6, scaleX: 1.04 },
 highKick: { rotate: 0.08, translateX: 12, translateY: -10, scaleX: 1.06 },
 lowPunch: { scaleY: 0.76, translateX: 8, translateY: 4, rotate: -0.05 },
 lowKick: { scaleY: 0.74, rotate: 0.12, translateX: 14, translateY: 0 },
 medPunch: { rotate: -0.08, translateX: 8, translateY: -4, scaleX: 1.03 },
 medKick: { rotate: 0.06, translateX: 10, translateY: -8, scaleX: 1.04 },
 special1: { rotate: -0.12, translateX: 14, translateY: -8, scaleX: 1.08 },
 special2: { rotate: -0.15, translateX: 16, translateY: -10, scaleX: 1.1 },
 throw: { rotate: -0.06, translateX: 6, scaleX: 1.02 },
 thrown: { rotate: 0.38, translateX: -16, translateY: -4 },
 phase2: { scaleX: 1.08, scaleY: 1.05, translateY: -4 },
 phase3: { scaleX: 1.12, scaleY: 1.08, translateY: -6 },
 taunt: { rotate: -0.05, translateY: -2, scaleX: 1.02 },
 summon: { rotate: -0.1, translateX: -8, translateY: -4 },
 heavySpecialWindup: { rotate: -0.2, translateX: -10, scaleY: 0.95 }
 };

 function makePose(sprite, kind) {
 const dw = sprite.width;
 const dh = sprite.height;
 const padX = Math.ceil(dw * 0.4);
 const padY = Math.ceil(dh * 0.25);
 const c = document.createElement('canvas');
 c.width = dw + padX * 2;
 c.height = dh + padY;
 const ctx = c.getContext('2d');
 ctx.imageSmoothingEnabled = false;
 const cx = c.width / 2;
 const feet = c.height - 2;

 ctx.save();
 ctx.translate(cx, feet);
 applyTransform(ctx, cx, feet, RECIPES[kind]);
 ctx.drawImage(sprite, -dw / 2, -dh);
 ctx.restore();
 return c;
 }

 function mirrorCanvas(src) {
 const c = document.createElement('canvas');
 c.width = src.width;
 c.height = src.height;
 const ctx = c.getContext('2d');
 ctx.imageSmoothingEnabled = false;
 ctx.translate(c.width, 0);
 ctx.scale(-1, 1);
 ctx.drawImage(src, 0, 0);
 return c;
 }

 function bakeSheet(sprite, opts) {
 opts = opts || {};
 const includeBoss = !!opts.boss;
 const bases = POSES().allBases(includeBoss);
 const sheet = {
 _hasLR: true,
 _reference: !!opts.reference,
 _scale: opts.scale || 2.5
 };

 bases.forEach(function (base) {
 const r = makePose(sprite, base);
 sheet[base + 'R'] = r;
 sheet[base + 'L'] = mirrorCanvas(r);
 });

 const leg = POSES().LEGACY;
 Object.keys(leg).forEach(function (oldName) {
 const base = leg[oldName];
 sheet[oldName] = sheet[base + 'R'];
 });

 return sheet;
 }

 return { makePose, mirrorCanvas, bakeSheet, RECIPES };
})();