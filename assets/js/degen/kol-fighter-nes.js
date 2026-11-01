/* NES Kung Fu (1985) - full pose list with L/R baked frames */
window.KOL_FIGHTER_NES = (function () {
 'use strict';

 const sheets = {};
 const SCALE = 2;
 const POSES = () => window.KOL_FIGHTER_POSES;

 const STAGE = {
 wall: '#c0b0d0',
 floor: '#b88850',
 black: '#181818',
 red: '#d83030',
 beige: '#f0d8a0'
 };

 function tick(f) {
 if (f.anim == null) f.anim = 0;
 const moving = Math.abs(f.vx) > 0.15;
 const busy = f.attack || f.hitstun > 0 || f.knockdown > 0;
 f.anim += moving ? 0.44 : (busy ? 0.3 : 0.06);
 }

 function getFrame(f) {
 if (POSES()) return POSES().resolve(f);
 if (f.hitstun > 0) return 'hitStun';
 if (!f.onGround) return 'jump';
 if (f.crouch || f.block) return 'crouch';
 if (f.attack) return f.attack === 'low' || f.attack === 'heavy' ? 'highKick' : 'highPunch';
 if (Math.abs(f.vx) > 0.15) return Math.sin(f.anim) > 0 ? 'walkForward1' : 'walkForward2';
 return 'idle';
 }

 function getFrameKey(f) {
 if (POSES()) return POSES().resolveKey(f);
 const base = getFrame(f);
 return base + (f.facing > 0 ? 'R' : 'L');
 }

 function pickImage(sheet, frameKey, f) {
 if (!sheet) return null;
 let img = sheet[frameKey];
 if (img) return img;

 const base = frameKey.slice(0, -1);
 const side = f.facing > 0 ? 'R' : 'L';
 img = sheet[base + side];
 if (img) return img;

 const leg = POSES() && POSES().LEGACY;
 if (leg) {
 for (const old in leg) {
 if (leg[old] === base && sheet[old]) return sheet[old];
 }
 }

 return sheet.idleR || sheet.idle || null;
 }

 function draw(ctx, fighter) {
 const slug = fighter.isPlayer ? 'degen' : fighter.slug;
 const sheet = sheets[slug];
 if (!sheet) return false;

 tick(fighter);
 const frameKey = getFrameKey(fighter);
 const img = pickImage(sheet, frameKey, fighter);
 if (!img) return false;

 const sw = img.width;
 const sh = img.height;
 let drawScale = sheet._scale || SCALE;
 if (fighter.attackPhase === 'active') drawScale *= 1.06;
 const cx = (fighter.x + fighter.w / 2) | 0;
 const feet = fighter.y | 0;
 const bob = Math.abs(fighter.vx) > 0.15 ? Math.sin(fighter.anim) * 0.5 : 0;
 const lunge = fighter.attackPhase === 'active' ? fighter.facing * 3 : 0;

 ctx.save();
 ctx.imageSmoothingEnabled = false;
 ctx.translate(cx + lunge, feet + bob);
 if (!sheet._hasLR && fighter.facing < 0) ctx.scale(-1, 1);
 ctx.drawImage(img, (-sw * drawScale / 2) | 0, -sh * drawScale, sw * drawScale, sh * drawScale);
 ctx.restore();
 return true;
 }

 function drawMeander(ctx, y, W) {
 ctx.fillStyle = STAGE.red;
 ctx.fillRect(0, y, W, 12);
 ctx.fillStyle = STAGE.beige;
 for (let x = 0; x < W; x += 16) {
 ctx.fillRect(x, y + 2, 8, 2);
 ctx.fillRect(x + 8, y + 6, 8, 2);
 }
 ctx.fillStyle = STAGE.black;
 ctx.fillRect(0, y, W, 1);
 ctx.fillRect(0, y + 11, W, 1);
 }

 function drawStage(ctx, W, H, GROUND) {
 ctx.fillStyle = STAGE.wall;
 ctx.fillRect(0, 0, W, H);
 ctx.fillStyle = STAGE.black;
 ctx.fillRect(0, 10, W, 2);
 ctx.fillStyle = STAGE.red;
 ctx.fillRect(0, 12, W, 4);
 ctx.fillStyle = STAGE.beige;
 ctx.fillRect(0, 16, W, 3);
 ctx.fillStyle = STAGE.red;
 ctx.fillRect(0, 19, W, 3);
 const px = (W / 2 - 6) | 0;
 ctx.fillStyle = STAGE.black;
 ctx.fillRect(px, 0, 12, 22);
 ctx.fillStyle = STAGE.red;
 ctx.fillRect(px, 0, 12, 3);
 ctx.fillRect(px, 8, 12, 2);
 ctx.fillStyle = STAGE.floor;
 ctx.fillRect(0, GROUND, W, H - GROUND - 14);
 ctx.fillStyle = STAGE.black;
 ctx.fillRect(0, GROUND, W, 2);
 drawMeander(ctx, H - 14, W);
 }

 function drawHud(ctx, W, player, opponent, roundP, roundO) {
 ctx.fillStyle = STAGE.black;
 ctx.fillRect(0, 22, W, 14);
 ctx.font = 'bold 10px monospace';
 ctx.fillStyle = '#fcfcfc';
 ctx.textAlign = 'left';
 ctx.fillText('1P ' + (player ? player.name : ''), 8, 32);
 ctx.textAlign = 'right';
 ctx.fillText((opponent ? opponent.name : 'CPU') + ' CPU', W - 8, 32);
 if (player && opponent) {
 const bw = 100;
 ctx.fillStyle = '#b83800';
 ctx.fillRect(40, 24, bw, 5);
 ctx.fillStyle = '#fc9838';
 ctx.fillRect(40, 24, bw * Math.max(0, player.hp / player.maxHp), 5);
 ctx.fillRect(W - 40 - bw, 24, bw, 5);
 ctx.fillRect(W - 40 - bw, 24, bw * Math.max(0, opponent.hp / opponent.maxHp), 5);
 }
 ctx.textAlign = 'center';
 ctx.fillStyle = '#f8d878';
 ctx.fillText('R' + (roundP + roundO + 1) + ' ' + roundP + '-' + roundO, W / 2, 32);
 }

 function register(slug, sheet) {
 if (sheet) sheets[slug] = sheet;
 }

 return { draw, register, drawStage, drawHud, sheets, getFrame, getFrameKey, SCALE };
})();