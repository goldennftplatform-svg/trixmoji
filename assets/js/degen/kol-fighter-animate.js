/* 8 - 16-bit articulated fighters - limbs animate, styles match reference screens */
window.KOL_FIGHTER_ANIMATE = (function () {
 'use strict';

 const STYLES = {
 degen: {
 skin: '#d4a574', hair: '#5a3a22', top: '#9a9a9a', top2: '#7a7a7a', pants: '#3a5a9a', shoes: '#3a2a1a',
 head: 'human', topKind: 'hoodie', scale: 1
 },
 'vitalik-buterin': {
 skin: '#f0c9a6', hair: '#6b4c3a', top: '#5a8acc', pants: '#5a5a6a', shoes: '#3a2a1a',
 head: 'human', topKind: 'tee', emblem: '#ddeeff', scale: 1
 },
 donalt: {
 skin: '#d4a574', hair: '#2b2b2b', top: '#8a8a8a', pants: '#3a4a6a', shoes: '#2a2a2a',
 head: 'human', topKind: 'hoodie', tie: '#cc2222', scale: 1
 },
 'michael-saylor': {
 skin: '#f0c9a6', hair: '#555555', top: '#1a1a2a', pants: '#1a1a2a', shoes: '#111',
 head: 'human', topKind: 'suit', tie: '#4488ff', scale: 1
 },
 'roger-ver': {
 skin: '#e8b896', hair: '#4a3728', top: '#3a5a9a', pants: '#3a5a9a', shoes: '#3a2a1a',
 head: 'human', topKind: 'jacket', emblem: '#ff8800', scale: 1
 },
 'jason-williams': {
 skin: '#8d5524', hair: '#111', top: '#3a5a3a', pants: '#2a3a2a', shoes: '#1a1a1a',
 head: 'human', topKind: 'cap', cap: '#3a6a3a', emblem: '#fff', scale: 1
 },
 bitboy: {
 skin: '#e0a878', hair: '#3d2817', top: '#ffcc00', pants: '#1a3a5a', shoes: '#3a2a1a',
 head: 'human', beard: true, scale: 1.08
 },
 'crypto-bitlord': {
 skin: '#b87a4b', hair: '#1c1c1c', top: '#2a4a8a', pants: '#1a2a4a', shoes: '#111',
 head: 'human', topKind: 'royal', crown: true, scale: 1.05
 },
 dogedesigner: {
 skin: '#e8862a', fur: '#e8862a', belly: '#f5e6c8', pants: '#3a5acc', shoes: '#e8862a',
 head: 'shiba', scale: 1.05
 },
 'jimmy-edgar': {
 skin: '#c49a6c', hair: '#111', top: '#2a2a4a', pants: '#1a1a2a', shoes: '#222',
 head: 'human', topKind: 'tactical', scale: 1
 },
 ansem: {
 skin: '#c68642', hair: '#0d0d18', top: '#ff00aa', pants: '#111122', shoes: '#222',
 head: 'human', topKind: 'hoodie', scale: 1
 },
 pauly0x: {
 skin: '#e8a060', hair: '#1a1a1a', top: '#e8a060', pants: '#3a5a9a', shoes: '#3a2a1a',
 head: 'human', topKind: 'shirtless', cap: '#cc2222', beard: true, scale: 1.18
 }
 };

 function tick(fighter) {
 if (fighter.anim == null) fighter.anim = Math.random() * 6.28;
 const moving = Math.abs(fighter.vx) > 0.2;
 const rate = moving ? 0.34 : (fighter.attack ? 0.2 : 0.07);
 fighter.anim += rate;
 }

 function getPose(fighter) {
 const a = fighter.anim || 0;
 const moving = Math.abs(fighter.vx) > 0.2;
 const walk = moving ? Math.sin(a) : Math.sin(a) * 0.25;
 const walk2 = moving ? Math.sin(a + Math.PI) : Math.sin(a + 1) * 0.2;

 let backLeg = 0.35 + walk2 * 0.55;
 let frontLeg = -0.25 + walk * 0.55;
 let backArm = -2.2 + walk * 0.35;
 let frontArm = -0.9 - walk2 * 0.35;
 let bodyY = 0;
 let lean = 0;

 if (!fighter.onGround) {
 backLeg = 0.6;
 frontLeg = -0.5;
 backArm = -1.8;
 frontArm = -1.2;
 bodyY = -4;
 } else if (fighter.crouch || fighter.block) {
 bodyY = 10;
 backLeg = 0.8;
 frontLeg = 0.7;
 backArm = -2.4;
 frontArm = -2.0;
 }

 if (fighter.attack && fighter.attackTimer != null) {
 const k = fighter.attack;
 const t = fighter.attackTimer;
 if (k === 'high' || k === 'special') {
 frontArm = -0.15 - Math.min(t * 0.04, 0.5);
 frontLeg = -0.1;
 lean = 0.08;
 } else if (k === 'low') {
 frontArm = -1.5;
 frontLeg = 0.9;
 lean = 0.12;
 } else if (k === 'heavy') {
 frontLeg = -0.05 - Math.min(t * 0.05, 0.6);
 frontArm = -1.4;
 lean = 0.1;
 } else if (k === 'med' || k === 'throw') {
 frontArm = -0.05 - Math.min(t * 0.06, 0.45);
 lean = 0.06;
 }
 }

 if (fighter.hitstun > 0) {
 lean = -0.12 * fighter.facing;
 frontArm = -2.5;
 backArm = -2.8;
 }

 return { backLeg, frontLeg, backArm, frontArm, bodyY, lean, walk };
 }

 function px(ctx, x, y, w, h, color, outline) {
 ctx.fillStyle = color;
 ctx.fillRect(Math.round(x), Math.round(y), w, h);
 if (outline) {
 ctx.strokeStyle = outline;
 ctx.lineWidth = 1;
 ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, w - 1, h - 1);
 }
 }

 function drawLimb(ctx, ox, oy, len, thick, angle, color) {
 ctx.save();
 ctx.translate(ox, oy);
 ctx.rotate(angle);
 px(ctx, -thick / 2, -len, thick, len, color, '#1a1a1a');
 px(ctx, -thick / 2, -2, thick, 3, color, null);
 ctx.restore();
 }

 function drawHead(ctx, st, y, cr) {
 if (st.head === 'shiba') {
 px(ctx, -14, y - 22, 28, 22, st.fur, '#1a1a1a');
 px(ctx, -10, y - 18, 20, 14, st.belly, null);
 px(ctx, -16, y - 30, 8, 10, st.fur, '#1a1a1a');
 px(ctx, 8, y - 30, 8, 10, st.fur, '#1a1a1a');
 px(ctx, -4, y - 14, 4, 3, '#111', null);
 px(ctx, 2, y - 14, 4, 3, '#111', null);
 px(ctx, -2, y - 10, 5, 4, '#f5c8c8', null);
 px(ctx, -12, y - 26, 24, 4, '#fff', '#aaa');
 return;
 }

 px(ctx, -11, y - 20 + cr, 22, 18, st.skin, '#2a2018');
 px(ctx, -12, y - 24 + cr, 24, 8, st.hair, '#1a1a1a');
 if (st.beard) {
 px(ctx, -8, y - 10 + cr, 16, 8, '#3a2818', null);
 }
 px(ctx, -6, y - 14 + cr, 3, 3, '#111', null);
 px(ctx, 3, y - 14 + cr, 3, 3, '#111', null);

 if (st.crown) {
 px(ctx, -12, y - 28 + cr, 24, 5, '#ffcc00', '#aa8800');
 px(ctx, -10, y - 34 + cr, 5, 7, '#ffcc00', null);
 px(ctx, -2, y - 36 + cr, 5, 9, '#ffcc00', null);
 px(ctx, 6, y - 34 + cr, 5, 7, '#ffcc00', null);
 } else if (st.cap) {
 px(ctx, -13, y - 26 + cr, 26, 7, st.cap, '#1a1a1a');
 px(ctx, -15, y - 22 + cr, 10, 4, st.cap, null);
 if (st.emblem) {
 ctx.fillStyle = st.emblem;
 ctx.font = 'bold 8px monospace';
 ctx.textAlign = 'center';
 ctx.fillText('W', 0, y - 20 + cr);
 }
 } else if (st.topKind === 'hoodie') {
 px(ctx, -13, y - 6 + cr, 6, 8, st.top2, null);
 px(ctx, 7, y - 6 + cr, 6, 8, st.top2, null);
 }
 }

 function drawTorso(ctx, st, y, cr) {
 const top = st.topKind === 'shirtless' ? st.skin : st.top;
 px(ctx, -14, y - 2 + cr, 28, 22, top, '#1a1a1a');

 if (st.topKind === 'hoodie') {
 px(ctx, -10, y + 2 + cr, 20, 3, st.top2, null);
 } else if (st.topKind === 'suit') {
 px(ctx, -2, y + cr, 4, 18, '#fff', null);
 if (st.tie) px(ctx, -2, y + 4 + cr, 4, 12, st.tie, null);
 } else if (st.topKind === 'jacket' && st.emblem) {
 px(ctx, -10, y + 4 + cr, 10, 12, st.emblem, null);
 } else if (st.topKind === 'tee' && st.emblem) {
 px(ctx, -5, y + 6 + cr, 10, 8, st.emblem, '#8899bb');
 } else if (st.topKind === 'royal') {
 px(ctx, -14, y - 2 + cr, 4, 22, '#ffcc00', null);
 px(ctx, 10, y - 2 + cr, 4, 22, '#ffcc00', null);
 px(ctx, -8, y + 14 + cr, 16, 4, '#ffcc00', null);
 } else if (st.topKind === 'tactical') {
 ['#cc2222', '#22cc44', '#ffcc00', '#4488ff'].forEach((c, i) => {
 px(ctx, -4 + (i % 2) * 5, y + 4 + Math.floor(i / 2) * 6 + cr, 4, 4, c, null);
 });
 }

 if (st.tie && st.topKind === 'hoodie') {
 px(ctx, -2, y + 2 + cr, 4, 14, st.tie, null);
 px(ctx, -3, y + 14 + cr, 6, 2, '#aa1111', null);
 }
 }

 function draw(ctx, fighter) {
 const slug = fighter.isPlayer ? 'degen' : fighter.slug;
 const st = STYLES[slug];
 if (!st) return false;

 tick(fighter);
 const pose = getPose(fighter);
 const bob = fighter.attack ? Math.sin(fighter.attackTimer * 0.7) * 2 : 0;
 const cx = Math.round(fighter.x + fighter.w / 2);
 const feet = Math.round(fighter.y + bob);
 const S = 3.4 * (st.scale || 1);
 const cr = (fighter.crouch || fighter.block) ? 4 : 0;

 ctx.save();
 ctx.translate(cx, feet);
 if (fighter.facing < 0) ctx.scale(-1, 1);
 ctx.translate(pose.lean * 20, -pose.bodyY);
 ctx.scale(S, S);

 const hipY = -18;
 const shoulderY = -20;
 const skinArm = st.head === 'shiba' ? st.fur : st.skin;
 const legColor = st.head === 'shiba' ? st.fur : st.pants;
 const shoe = st.shoes;

 drawLimb(ctx, -5, hipY, 14, 5, pose.backLeg, legColor);
 px(ctx, -7, hipY - 15, 6, 4, shoe, '#111');

 drawLimb(ctx, 5, shoulderY, 11, 4, pose.backArm, skinArm);

 drawTorso(ctx, st, 0, cr);
 drawHead(ctx, st, 0, cr);

 drawLimb(ctx, 5, hipY, 14, 5, pose.frontLeg, legColor);
 px(ctx, 3, hipY - 15, 6, 4, shoe, '#111');

 drawLimb(ctx, -5, shoulderY, 11, 4, pose.frontArm, skinArm);

 if (st.head === 'shiba') {
 px(ctx, 10, hipY - 8, 8, 5, st.fur, null);
 }

 if (fighter.attack === 'special') {
 ctx.globalAlpha = 0.5 + Math.sin(fighter.anim * 3) * 0.3;
 px(ctx, 8, shoulderY - 14, 10, 10, '#88ffff', '#fff');
 ctx.globalAlpha = 1;
 }

 ctx.restore();
 return true;
 }

 return { tick, draw, STYLES };
})();