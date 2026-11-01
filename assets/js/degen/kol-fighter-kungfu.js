/* Authentic NES Kung Fu (1985) - Thomas-style sprites, KOL palette from reference photos */
window.KOL_FIGHTER_KUNGFU = (function () {
 'use strict';

 const rigs = {};
 const work = document.createElement('canvas');
 const wctx = work.getContext('2d', { willReadFrequently: true });
 const SCALE = 3;

 const STAGE = {
 wall: '#c0b0d0',
 floor: '#b88850',
 floorLine: '#181818',
 red: '#d83030',
 beige: '#f0d8a0',
 pillar: '#181818'
 };

 /* Pixel keys: O=outline B=body(belt) S=skin H=hair A=arm/leg trim E=extra accent */
 const FRAMES = {
 idle: [
 '....HHHH....',
 '...SSSSS....',
 '...SSSSS....',
 '..BBBBBBB...',
 '..BBBBBBB...',
 '..BBBBBBB...',
 '...OOOOO....',
 '..AAA.AAA...',
 '..AAA.AAA...',
 '...AAA......',
 '...AAA......',
 '..OOO..OOO..',
 '..OOO..OOO..',
 '..OOO..OOO..',
 '...O....O...'
 ],
 walk1: [
 '....HHHH....',
 '...SSSSS....',
 '...SSSSS....',
 '..BBBBBBB...',
 '..BBBBBBB...',
 '..BBBBBBB...',
 '...OOOOO....',
 '..AAA.AAA...',
 '...AAA.AAA..',
 '....AAA.AAA.',
 '...OOO...OOO',
 '..OOO.....OO',
 '..OOO......O',
 '...O........'
 ],
 walk2: [
 '....HHHH....',
 '...SSSSS....',
 '...SSSSS....',
 '..BBBBBBB...',
 '..BBBBBBB...',
 '..BBBBBBB...',
 '...OOOOO....',
 '..AAA.AAA...',
 '.AAA.AAA....',
 'AAA.AAA.....',
 'OOO...OOO...',
 'OO.....OOO..',
 'O......OOO..',
 '........O...'
 ],
 punch: [
 '....HHHH....',
 '...SSSSS....',
 '...SSSSS....',
 '..BBBBBBB...',
 '..BBBBBBB...',
 '..BBBBBBB...',
 '...OOOOO....',
 'AAAAAA.AAA..',
 'SSSSSS.AAA..',
 '......AAA...',
 '.....OOO....',
 '.....OOO....',
 '....OO.OO...',
 '....O...O...'
 ],
 kick: [
 '....HHHH......',
 '...SSSSS......',
 '...SSSSS......',
 '..BBBBBBB.....',
 '..BBBBBBB.....',
 '..BBBBBBB.....',
 '...OOOOO......',
 '..AAA.........',
 '..AAA.........',
 '..BBBBBBBBBBBB',
 '..BBBBBBBBBBBB',
 '..BBB.........',
 '...BB.........',
 '...B..........'
 ],
 jump: [
 '....HHHH....',
 '...SSSSS....',
 '...SSSSS....',
 '..BBBBBBB...',
 '..BBBBBBB...',
 '...OOOOO....',
 '..OOO..OOO..',
 '.OOO....OOO.',
 '.OOO....OOO.',
 '...OO...OO..'
 ],
 crouch: [
 '....HHHH....',
 '...SSSSS....',
 '..BBBBBBB...',
 '..BBBBBBB...',
 '...OOOOO....',
 '..AAA..AAA..',
 '..OOO..OOO..',
 '..OOO..OOO..',
 '...O....O...'
 ],
 hit: [
 '...HHHH.....',
 '..SSSSS.....',
 '..BBBBBBB...',
 '..BBBBBBB...',
 '...OOOOO....',
 '.AAA...AAA..',
 'OOO.....OOO.',
 '.O.......O..'
 ]
 };

 const ENEMY_FRAMES = {
 idle: [
 '....EEEE....',
 '...SSSSS....',
 '...SSSSS....',
 '..VVVVVVV...',
 '..VVVVVVV...',
 '..PPPPPPP...',
 '..PPPPPPP...',
 '.AAA...AAA..',
 '.AAA...AAA..',
 '..OOO..OOO..',
 '..OOO..OOO..',
 '...O....O...'
 ],
 punch: [
 '....EEEE....',
 '...SSSSS....',
 '...SSSSS....',
 '..VVVVVVV...',
 '..VVVVVVV...',
 '..PPPPPPP...',
 'AAAAAA.AAA..',
 'SSSSSS.AAA..',
 '..OOO..OOO..',
 '...O....O...'
 ],
 kick: [
 '....EEEE....',
 '...SSSSS....',
 '...SSSSS....',
 '..VVVVVVV...',
 '..VVVVVVV...',
 '..PPPPPPP...',
 '..AAA..AAA..',
 '..PPPPPPPPPP',
 '..PPPPPPPPPP',
 '...OOO......',
 '...O........'
 ],
 hit: [
 '.....EEEE...',
 '....SSSSS...',
 '...VVVVVV...',
 '..VVVVVVV...',
 '...PPPPPP...',
 '.AAA....AAA.',
 'PPP......PPP',
 'OOO......OOO',
 '.O........O.'
 ]
 };

 const TRAITS = {
 degen: { hood: true, shades: true },
 ansem: { hood: true, shades: true, hairCurly: true },
 'roger-ver': { jacket: true },
 'michael-saylor': { suit: true },
 'vitalik-buterin': { tee: true },
 'jason-williams': { hat: true },
 bitboy: { beard: true },
 'crypto-bitlord': { crown: true },
 dogedesigner: { shiba: true },
 'jimmy-edgar': { tactical: true },
 donalt: { suit: true },
 pauly0x: { cap: true, beard: true, food: true }
 };

 function sample(img, rx, ry) {
 const w = img.naturalWidth;
 const h = img.naturalHeight;
 work.width = w;
 work.height = h;
 wctx.drawImage(img, 0, 0);
 const d = wctx.getImageData(
 Math.min(w - 1, Math.max(0, Math.floor(w * rx))),
 Math.min(h - 1, Math.max(0, Math.floor(h * ry))),
 1, 1
 ).data;
 return [d[0], d[1], d[2]];
 }

 function nes(rgb) {
 return '#' + rgb.map((n) => {
 const q = Math.min(255, Math.round(n / 51) * 51);
 return q.toString(16).padStart(2, '0');
 }).join('');
 }

 function bakeRig(slug, img) {
 const tr = TRAITS[slug] || {};
 const body = nes(sample(img, 0.5, 0.42));
 rigs[slug] = {
 tr,
 skin: nes(sample(img, 0.52, 0.17)),
 hair: nes(sample(img, 0.5, 0.08)),
 body,
 belt: '#181818',
 trim: nes(sample(img, 0.35, 0.38)),
 pants: nes(sample(img, 0.46, 0.7)),
 shoe: '#181818',
 vest: nes(sample(img, 0.55, 0.38)),
 accent: nes(sample(img, 0.62, 0.45)),
 enemyHair: nes(sample(img, 0.5, 0.12))
 };
 }

 function paletteFor(rig, playerSide) {
 if (playerSide) {
 return {
 H: rig.hair,
 S: rig.skin,
 B: rig.body,
 O: rig.belt,
 A: rig.body,
 '.': null
 };
 }
 return {
 E: rig.enemyHair,
 S: rig.skin,
 V: rig.vest,
 P: rig.pants,
 A: rig.accent,
 O: '#181818',
 '.': null
 };
 }

 function tick(f) {
 if (f.anim == null) f.anim = 0;
 const moving = Math.abs(f.vx) > 0.15;
 f.anim += moving ? 0.45 : (f.attack ? 0.32 : 0.06);
 }

 function getFrameName(f) {
 if (f.hitstun > 0) return 'hit';
 if (!f.onGround) return 'jump';
 if (f.crouch || f.block) return 'crouch';
 if (f.attack && f.attackTimer != null) {
 const k = f.attack;
 if (k === 'low' || k === 'heavy') return 'kick';
 if (k === 'high' || k === 'med' || k === 'throw' || k === 'special') return 'punch';
 }
 if (Math.abs(f.vx) > 0.15) {
 return Math.sin(f.anim) > 0 ? 'walk1' : 'walk2';
 }
 return 'idle';
 }

 function drawPixelFrame(ctx, grid, pal, ox, oy) {
 const rows = grid.length;
 const cols = grid[0].length;
 for (let y = 0; y < rows; y++) {
 for (let x = 0; x < cols; x++) {
 const ch = grid[y][x];
 if (ch === '.') continue;
 const c = pal[ch];
 if (!c) continue;
 ctx.fillStyle = c;
 ctx.fillRect(ox + x, oy + y, 1, 1);
 }
 }
 ctx.fillStyle = '#181818';
 for (let y = 0; y < rows; y++) {
 for (let x = 0; x < cols; x++) {
 const ch = grid[y][x];
 if (ch === '.') continue;
 if (x === 0 || grid[y][x - 1] === '.') ctx.fillRect(ox + x, oy + y, 1, 1);
 if (x === cols - 1 || grid[y][x + 1] === '.') ctx.fillRect(ox + x, oy + y, 1, 1);
 if (y === 0 || grid[y - 1][x] === '.') ctx.fillRect(ox + x, oy + y, 1, 1);
 if (y === rows - 1 || (y + 1 < rows && grid[y + 1][x] === '.')) ctx.fillRect(ox + x, oy + y, 1, 1);
 }
 }
 return { w: cols, h: rows };
 }

 function drawTrait(ctx, rig, ox, oy, frame, playerSide) {
 const tr = rig.tr;
 if (playerSide && tr.shades) {
 ctx.fillStyle = '#181818';
 ctx.fillRect(ox + 3, oy + 2, 6, 1);
 }
 if (tr.hood) {
 ctx.fillStyle = rig.trim;
 ctx.fillRect(ox + 2, oy, 8, 1);
 }
 if (tr.beard) {
 ctx.fillStyle = rig.hair;
 ctx.fillRect(ox + 3, oy + 3, 6, 2);
 }
 if (tr.cap) {
 ctx.fillStyle = '#d83030';
 ctx.fillRect(ox + 2, oy, 8, 2);
 if (tr.food) {
 ctx.fillStyle = '#58a858';
 ctx.fillRect(ox + 3, oy - 2, 6, 2);
 }
 }
 if (tr.crown) {
 ctx.fillStyle = '#f0d030';
 ctx.fillRect(ox + 2, oy - 1, 8, 1);
 }
 if (tr.shiba) {
 ctx.fillStyle = rig.accent;
 ctx.fillRect(ox + 1, oy + 1, 2, 2);
 ctx.fillRect(ox + 9, oy + 1, 2, 2);
 }
 }

 function draw(ctx, fighter) {
 const slug = fighter.isPlayer ? 'degen' : fighter.slug;
 const rig = rigs[slug];
 if (!rig) return false;

 tick(fighter);
 const frameName = getFrameName(fighter);
 const playerSide = !!fighter.isPlayer;
 const grids = playerSide ? FRAMES : ENEMY_FRAMES;
 const grid = grids[frameName] || grids.idle;
 const pal = paletteFor(rig, playerSide);

 const cx = (fighter.x + fighter.w / 2) | 0;
 const feet = fighter.y | 0;
 const cols = grid[0].length;
 const rows = grid.length;

 ctx.save();
 ctx.imageSmoothingEnabled = false;
 ctx.translate(cx, feet);
 ctx.scale(fighter.facing < 0 ? -SCALE : SCALE, SCALE);
 const ox = (-cols / 2) | 0;
 const oy = -rows;
 drawPixelFrame(ctx, grid, pal, ox, oy);
 drawTrait(ctx, rig, ox, oy, frameName, playerSide);
 ctx.restore();
 return true;
 }

 function drawMeander(ctx, y, W) {
 const u = 8;
 ctx.fillStyle = STAGE.red;
 ctx.fillRect(0, y, W, 12);
 ctx.fillStyle = STAGE.beige;
 for (let x = 0; x < W; x += u * 2) {
 ctx.fillRect(x, y + 2, u, 2);
 ctx.fillRect(x + u, y + 6, u, 2);
 ctx.fillRect(x + 4, y + 4, 2, 2);
 ctx.fillRect(x + u + 4, y + 8, 2, 2);
 }
 ctx.fillStyle = STAGE.floorLine;
 ctx.fillRect(0, y, W, 1);
 ctx.fillRect(0, y + 11, W, 1);
 }

 function drawStage(ctx, W, H, GROUND) {
 ctx.fillStyle = STAGE.wall;
 ctx.fillRect(0, 0, W, H);

 ctx.fillStyle = STAGE.floorLine;
 ctx.fillRect(0, 10, W, 2);
 ctx.fillStyle = STAGE.red;
 ctx.fillRect(0, 12, W, 4);
 ctx.fillStyle = STAGE.beige;
 ctx.fillRect(0, 16, W, 3);
 ctx.fillStyle = STAGE.red;
 ctx.fillRect(0, 19, W, 3);

 const pillarX = (W / 2 - 6) | 0;
 ctx.fillStyle = STAGE.pillar;
 ctx.fillRect(pillarX, 0, 12, 22);
 ctx.fillStyle = STAGE.red;
 ctx.fillRect(pillarX, 0, 12, 3);
 ctx.fillRect(pillarX, 8, 12, 2);

 ctx.fillStyle = STAGE.floor;
 ctx.fillRect(0, GROUND, W, H - GROUND - 14);
 ctx.fillStyle = STAGE.floorLine;
 ctx.fillRect(0, GROUND, W, 2);

 drawMeander(ctx, H - 14, W);
 }

 function drawHud(ctx, W, player, opponent) {
 if (!player || !opponent) return;
 ctx.fillStyle = '#181818';
 ctx.font = '8px monospace';
 ctx.textAlign = 'left';
 ctx.fillText(player.name, 8, 10);
 ctx.textAlign = 'right';
 ctx.fillText(opponent.name, W - 8, 10);
 }

 function register(slug, img) {
 if (img && img.complete && img.naturalWidth) bakeRig(slug, img);
 }

 return { draw, register, drawStage, drawHud, rigs, getFrameName, STAGE, FRAMES, SCALE };
})();