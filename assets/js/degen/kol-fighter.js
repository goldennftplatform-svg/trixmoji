/* DEGEN KOL FIGHTER '85 - canvas prototype */
(function () {
 'use strict';

 const W = 640;
 const H = 360;
 const GROUND = 268;
 const GRAVITY = 0.68;
 const FLOOR_FRICTION = 0.78;
 const MOVE_SPEED = 2.8;

 const ROSTER = [
 { name: 'DonAlt', slug: 'donalt', screen: 'donalt', skin: '#d4a574', hair: '#2b2b2b', shirt: '#4488cc', pants: '#1a1a2e', accent: '#66ccff', tag: 'BEAR WHISPERER' },
 { name: 'Roger Ver', slug: 'roger-ver', screen: 'roger-ver', skin: '#e8b896', hair: '#4a3728', shirt: '#ffffff', pants: '#333366', accent: '#ffcc00', tag: 'BITCOIN JESUS' },
 { name: 'Ansem', slug: 'ansem', screen: 'ansem', skin: '#c68642', hair: '#0d0d18', shirt: '#ff00aa', pants: '#111122', accent: '#ff66ff', tag: 'MOON CALLER' },
 { name: 'Michael Saylor', slug: 'michael-saylor', screen: 'michael-saylor', skin: '#f0c9a6', hair: '#555555', shirt: '#ff6600', pants: '#222244', accent: '#ff9900', tag: 'ORANGE PILL' },
 { name: 'Vitalik Buterin', slug: 'vitalik-buterin', screen: 'vitalik-buterin', skin: '#f5d0b0', hair: '#6b4c3a', shirt: '#88aaff', pants: '#2a2a44', accent: '#aaccff', tag: 'ETH GOBLIN' },
 { name: 'Jason Williams', slug: 'jason-williams', screen: 'jason-williams', skin: '#8d5524', hair: '#111111', shirt: '#cc2222', pants: '#1a1a1a', accent: '#ff4444', tag: 'KOL HEAT' },
 { name: 'BitBoy', slug: 'bitboy', screen: 'bitboy', skin: '#e0a878', hair: '#3d2817', shirt: '#ffcc00', pants: '#003366', accent: '#ffff00', tag: 'HYPE BEAST' },
 { name: 'Crypto Bitlord', slug: 'crypto-bitlord', screen: 'crypto-bitlord', skin: '#b87a4b', hair: '#1c1c1c', shirt: '#00ff66', pants: '#0a0a0a', accent: '#00ff41', tag: 'SHITPOST KING' },
 { name: 'DogeDesigner', slug: 'dogedesigner', screen: 'dogedesigner', skin: '#d9a066', hair: '#2a1810', shirt: '#ffaa00', pants: '#442200', accent: '#ffdd44', tag: 'MEME LORD' },
 { name: 'Jimmy Edgar', slug: 'jimmy-edgar', screen: 'jimmy-edgar', skin: '#c49a6c', hair: '#000000', shirt: '#cc00cc', pants: '#220022', accent: '#ff66ff', tag: 'BASS DEGEN' }
 ];

 const BOSS = {
 name: 'Pauly0x', slug: 'pauly0x', screen: 'pauly0x', skin: '#e8a060', hair: '#ff4400', shirt: '#ff2288', pants: '#331100', accent: '#ffaa00',
 tag: 'RANDY TACO RV', boss: true, phases: 3
 };

 const SCREEN_BASE = '/assets/images/kol-fighter/screens/';
 const TITLE_SCREEN = 'IMQwC';

 const BACKGROUNDS = [
 { sky: '#1a0a2e', floor: '#2a1848', props: 'city' },
 { sky: '#0a1a2a', floor: '#1a3a4a', props: 'exchange' },
 { sky: '#2a1008', floor: '#4a2818', props: 'desert' },
 { sky: '#0a220a', floor: '#1a441a', props: 'pond' },
 { sky: '#1a1a0a', floor: '#3a3a18', props: 'conference' },
 { sky: '#220a1a', floor: '#44182a', props: 'club' },
 { sky: '#0a0a22', floor: '#1a1a44', props: 'moon' },
 { sky: '#1a220a', floor: '#2a4418', props: 'farm' },
 { sky: '#220022', floor: '#440044', props: 'neon' },
 { sky: '#0a1818', floor: '#183838', props: 'terminal' },
 { sky: '#2a0a0a', floor: '#550022', props: 'bossrv' }
 ];

 const ATTACKS = {
 high: { dmg: 10, range: 38, startup: 3, active: 5, recovery: 8, type: 'punch', label: 'PUNCH' },
 low: { dmg: 9, range: 34, startup: 4, active: 4, recovery: 9, type: 'kick', label: 'LOW KICK' },
 med: { dmg: 11, range: 40, startup: 3, active: 5, recovery: 8, type: 'punch', label: 'PUNCH' },
 heavy: { dmg: 16, range: 42, startup: 4, active: 6, recovery: 10, type: 'kick', label: 'KICK' },
 throw: { dmg: 20, range: 28, startup: 2, active: 4, recovery: 14, type: 'throw', label: 'GRAB' },
 special:{ dmg: 22, range: 44, startup: 5, active: 7, recovery: 14, type: 'punch', label: 'RUSH PUNCH' }
 };

 function sfx() {
 return window.KOL_FIGHTER_SFX || null;
 }

 const canvas = document.getElementById('kfCanvas');
 const ctx = canvas.getContext('2d');
 ctx.imageSmoothingEnabled = false;

 const keys = {};
 const sprites = {};
 const screens = {};
 let ladderIndex = 0;
 let roundP = 0;
 let roundO = 0;
 let gameState = 'title';
 let stateTimer = 0;
 let announce = '';
 let player = null;
 let opponent = null;
 let summons = [];
 let shake = 0;
 let flash = 0;
 let matchWon = false;
 let koPause = 0;
 let titleTick = 0;

 /* INSERT COIN on IMQwC.jpg - pixel-measured (1024×687) */
 const INSERT_COIN_FRAC = { x: 0.34375, y: 0.9447, w: 0.3057, h: 0.0393 };
 const INSERT_COIN_PATCH_FRAC = { x: 0.0977, y: 0.9534, w: 0.0342, h: 0.0291 };

 function loadSprites() {
 if (window.KOL_FIGHTER_SPRITES) KOL_FIGHTER_SPRITES.loadAll();
 }

 function fitImageRect(iw, ih, cw, ch) {
 const scale = Math.min(cw / iw, ch / ih);
 const dw = Math.round(iw * scale);
 const dh = Math.round(ih * scale);
 return {
 dx: ((cw - dw) / 2) | 0,
 dy: ((ch - dh) / 2) | 0,
 dw, dh, scale, iw, ih
 };
 }

 function fracToCanvasRect(frac, fit) {
 return {
 x: fit.dx + (frac.x * fit.dw) | 0,
 y: fit.dy + (frac.y * fit.dh) | 0,
 w: (frac.w * fit.dw) | 0,
 h: (frac.h * fit.dh) | 0
 };
 }

 function patchImageRegion(targetCtx, sourceImg, region, patchFrac, fit) {
 const srcX = (patchFrac.x * fit.iw) | 0;
 const srcY = (patchFrac.y * fit.ih) | 0;
 const srcW = (patchFrac.w * fit.iw) | 0;
 const srcH = (patchFrac.h * fit.ih) | 0;
 const tileW = Math.max(4, (patchFrac.w * fit.dw) | 0);
 for (let x = region.x; x < region.x + region.w; x += tileW) {
 const w = Math.min(tileW, region.x + region.w - x);
 targetCtx.drawImage(sourceImg, srcX, srcY, srcW, srcH, x, region.y, w, region.h);
 }
 }

 function drawFittedImage(targetCtx, img, fit) {
 targetCtx.fillStyle = '#000';
 targetCtx.fillRect(0, 0, W, H);
 targetCtx.drawImage(img, 0, 0, fit.iw, fit.ih, fit.dx, fit.dy, fit.dw, fit.dh);
 }

 function buildTitleLayers(img) {
 const fit = fitImageRect(img.naturalWidth, img.naturalHeight, W, H);
 const coinRegion = fracToCanvasRect(INSERT_COIN_FRAC, fit);

 const full = document.createElement('canvas');
 full.width = W;
 full.height = H;
 const fc = full.getContext('2d');
 fc.imageSmoothingEnabled = false;
 drawFittedImage(fc, img, fit);

 const noCoin = document.createElement('canvas');
 noCoin.width = W;
 noCoin.height = H;
 const nc = noCoin.getContext('2d');
 nc.imageSmoothingEnabled = false;
 nc.drawImage(full, 0, 0);
 patchImageRegion(nc, img, coinRegion, INSERT_COIN_PATCH_FRAC, fit);

 const srcX = (INSERT_COIN_FRAC.x * fit.iw) | 0;
 const srcY = (INSERT_COIN_FRAC.y * fit.ih) | 0;
 const srcW = (INSERT_COIN_FRAC.w * fit.iw) | 0;
 const srcH = (INSERT_COIN_FRAC.h * fit.ih) | 0;
 const coinStrip = document.createElement('canvas');
 coinStrip.width = coinRegion.w;
 coinStrip.height = coinRegion.h;
 const stripCtx = coinStrip.getContext('2d');
 stripCtx.imageSmoothingEnabled = false;
 stripCtx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, coinRegion.w, coinRegion.h);

 screens.title = full;
 screens.titleNoCoin = noCoin;
 screens.titleCoinStrip = coinStrip;
 screens.titleCoinPos = coinRegion;
 }

 function loadScreens() {
 const titleImg = new Image();
 titleImg.src = SCREEN_BASE + TITLE_SCREEN + '.jpg?v=3';
 titleImg.onload = () => { buildTitleLayers(titleImg); };

 const ids = new Set();
 ROSTER.forEach((f) => { if (f.screen) ids.add(f.screen); });
 ids.add(BOSS.screen);
 ids.forEach((id) => {
 const img = new Image();
 img.src = SCREEN_BASE + id + '.jpg';
 img.onload = () => { screens[id] = img; };
 });
 }

 function drawTitleScreen() {
 if (!screens.titleNoCoin) {
 ctx.fillStyle = '#000';
 ctx.fillRect(0, 0, W, H);
 return false;
 }

 ctx.drawImage(screens.titleNoCoin, 0, 0, W, H);

 if (Math.floor(titleTick / 22) % 2 === 0 && screens.titleCoinStrip && screens.titleCoinPos) {
 const p = screens.titleCoinPos;
 ctx.drawImage(screens.titleCoinStrip, p.x, p.y);
 }

 return true;
 }

 function drawLadderPortrait(slug, x, y, th) {
 const KFS = window.KOL_FIGHTER_SPRITES;
 const sheet = KFS && KFS.frames[slug];
 const img = sheet && (sheet.idleR || sheet.idle);
 if (!img) return;
 const scale = th / img.height;
 const tw = img.width * scale;
 ctx.save();
 ctx.imageSmoothingEnabled = false;
 ctx.drawImage(img, (x - tw / 2) | 0, (y - th) | 0, tw | 0, th | 0);
 ctx.restore();
 }

 function drawLadderScreen() {
 ctx.fillStyle = '#050510';
 ctx.fillRect(0, 0, W, H);
 ctx.fillStyle = 'rgba(0,255,65,0.08)';
 for (let x = 0; x < W; x += 16) ctx.fillRect(x, 0, 1, H);
 for (let y = 0; y < H; y += 16) ctx.fillRect(0, y, W, 1);

 ctx.textAlign = 'center';
 ctx.fillStyle = '#ffff00';
 ctx.font = 'bold 20px VT323, monospace';
 ctx.fillText('TOP OF THE FOODCHAIN', W / 2, 22);

 const ladder = ROSTER.concat([BOSS]);
 const rowH = 24;
 const startY = 42;

 ladder.forEach((foe, i) => {
 const y = startY + i * rowH;
 const isCurrent = i === ladderIndex;
 const beaten = i < ladderIndex;

 if (isCurrent) {
 ctx.fillStyle = 'rgba(255,255,0,0.15)';
 ctx.fillRect(24, y - 16, W - 48, 20);
 }

 drawLadderPortrait(foe.slug, 52, y + 2, 22);

 ctx.textAlign = 'left';
 ctx.fillStyle = isCurrent ? '#ffff00' : beaten ? '#336633' : '#aaffaa';
 ctx.font = (isCurrent ? 'bold 16px' : '15px') + ' VT323, monospace';
 const label = (i + 1) + '. ' + foe.name.toUpperCase();
 ctx.fillText(label, 72, y);
 if (foe.boss) {
 ctx.fillStyle = '#ff6688';
 ctx.fillText('BOSS', W - 72, y);
 } else if (foe.tag) {
 ctx.fillStyle = '#668866';
 ctx.font = '11px VT323, monospace';
 ctx.fillText(foe.tag, W - 140, y);
 }
 });

 drawLadderPortrait('degen', 52, H - 28, 28);
 ctx.textAlign = 'left';
 ctx.fillStyle = '#00ff41';
 ctx.font = 'bold 17px VT323, monospace';
 ctx.fillText('DEGEN (YOU)', 72, H - 14);

 ctx.textAlign = 'center';
 if (Math.floor(titleTick / 18) % 2 === 0) {
 ctx.fillStyle = '#ffffff';
 ctx.font = '14px VT323, monospace';
 const next = ladder[ladderIndex];
 ctx.fillText('FIGHT ' + (next ? next.name.toUpperCase() : '???') + ' - PRESS ENTER', W / 2, H - 36);
 }
 }

 function showLadder() {
 gameState = 'ladder';
 titleTick = 0;
 stateTimer = 0;
 announce = '';
 }

 function getCurrentFoe() {
 return ladderIndex >= ROSTER.length ? BOSS : ROSTER[ladderIndex];
 }

 function getScreenKey() {
 const foe = getCurrentFoe();
 return foe.screen || null;
 }

 function scrubBakedFighters(img) {
 const topY = 54;
 const floorY = 248;
 const srcX = 300;
 const srcW = 40;
 const bgH = floorY - topY;
 const floorH = GROUND + 48 - floorY;

 ctx.drawImage(img, srcX, topY, srcW, bgH, 0, topY, srcX, bgH);
 ctx.drawImage(img, srcX, topY, srcW, bgH, W - srcX, topY, srcX, bgH);
 ctx.drawImage(img, srcX, floorY, srcW, floorH, 0, floorY, srcX, floorH);
 ctx.drawImage(img, srcX, floorY, srcW, floorH, W - srcX, floorY, srcX, floorH);
 }

 function drawFightScreen(alpha, scrub) {
 const key = getScreenKey();
 const img = key && screens[key];
 if (img && img.complete && img.naturalWidth) {
 ctx.save();
 ctx.globalAlpha = alpha == null ? 1 : alpha;
 ctx.drawImage(img, 0, 0, W, H);
 if (scrub) scrubBakedFighters(img);
 ctx.restore();
 return true;
 }
 return false;
 }

 function drawScanlines() {
 ctx.fillStyle = 'rgba(0,0,0,0.12)';
 for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
 }

 function makeFighter(opts) {
 return {
 name: opts.name,
 slug: opts.slug || 'degen',
 screen: opts.screen || null,
 tag: opts.tag || '',
 isPlayer: !!opts.isPlayer,
 boss: !!opts.boss,
 x: opts.x,
 y: GROUND,
 vx: 0,
 vy: 0,
 w: 80,
 h: 220,
 facing: opts.facing || 1,
 hp: opts.hp || 100,
 maxHp: opts.hp || 100,
 palette: opts.palette,
 diff: opts.diff || 1,
 anim: 0,
 block: false,
 crouch: false,
 onGround: true,
 hitstun: 0,
 knockdown: 0,
 beingThrown: 0,
 victory: false,
 defeat: false,
 taunt: 0,
 summonPose: 0,
 attack: null,
 attackTimer: 0,
 attackPhase: null,
 attackSfxPlayed: false,
 attackHit: false,
 specialCd: 0,
 phase: 1,
 aiTimer: 0,
 aiMove: 0,
 summonCd: 120
 };
 }

 function playerPalette() {
 return { skin: '#d4a060', hair: '#00ff41', shirt: '#003300', pants: '#001100', accent: '#00ff41' };
 }

 function startMatch() {
 const foeData = ladderIndex >= ROSTER.length ? BOSS : ROSTER[ladderIndex];
 const diff = 1 + ladderIndex * 0.12 + (foeData.boss ? 0.8 : 0);
 const hp = foeData.boss ? 180 : 100;
 player = makeFighter({
 name: 'DEGEN', slug: 'degen', screen: foeData.screen, isPlayer: true, x: 88, facing: 1,
 hp: 100, palette: playerPalette(), diff: 1
 });
 opponent = makeFighter({
 name: foeData.name, slug: foeData.slug, screen: foeData.screen, tag: foeData.tag, boss: foeData.boss,
 x: W - 130, facing: -1, hp: hp, maxHp: hp, palette: foeData, diff: diff
 });
 summons = [];
 roundP = 0;
 roundO = 0;
 gameState = 'vs';
 stateTimer = 120;
 announce = 'ROUND 1 - FIGHT!';
 const S = sfx();
 if (S) S.vs();
 }

 function refillWinner(winner) {
 const bonus = Math.round(winner.maxHp * 0.12);
 winner.hp = Math.min(winner.maxHp, winner.hp + bonus);
 }

 function resetRoundPositions() {
 [player, opponent].forEach(function (f) {
 if (!f) return;
 f.hitstun = 0; f.knockdown = 0; f.beingThrown = 0;
 f.victory = false; f.defeat = false; f.taunt = 0; f.summonPose = 0;
 f.attack = null; f.block = false; f.crouch = false;
 });
 player.x = 88; player.y = GROUND; player.vx = 0; player.vy = 0;
 player.hp = player.maxHp;
 opponent.x = W - 130; opponent.y = GROUND; opponent.vx = 0; opponent.vy = 0;
 if (!opponent.boss) opponent.hp = opponent.maxHp;
 else if (opponent.phase === 1) opponent.hp = opponent.maxHp;
 else if (opponent.phase === 2) opponent.hp = Math.round(opponent.maxHp * 0.66);
 else opponent.hp = Math.round(opponent.maxHp * 0.33);
 summons = [];
 }

 function startRound(num) {
 resetRoundPositions();
 gameState = 'fight';
 stateTimer = 60;
 announce = 'ROUND ' + num + ' - FIGHT!';
 const S = sfx();
 if (S) S.fight();
 }

 function dist(a, b) {
 return Math.abs((a.x + a.w / 2) - (b.x + b.w / 2));
 }

 function facingToward(attacker, target) {
 const dx = (target.x + target.w / 2) - (attacker.x + attacker.w / 2);
 return dx >= 0 ? 1 : -1;
 }

 function beginAttack(f, kind) {
 if (f.hitstun > 0 || f.attack) return;
 if (kind === 'special' && f.specialCd > 0) return;
 if (kind === 'throw' && dist(player, opponent) > ATTACKS.throw.range) return;
 f.attack = kind;
 f.attackTimer = 0;
 f.attackPhase = 'startup';
 f.attackSfxPlayed = false;
 f.attackHit = false;
 if (kind === 'special') f.specialCd = 90;
 }

 function hurtbox(f) {
 const crouchOff = f.crouch ? 18 : 0;
 return { x: f.x + 6, y: f.y + 8 + crouchOff, w: f.w - 12, h: f.h - 10 - crouchOff };
 }

 function hitbox(f) {
 const atk = ATTACKS[f.attack];
 if (!atk) return null;
 const cx = f.x + f.w / 2;
 const reach = atk.range;
 const low = f.attack === 'low' || f.crouch;
 const high = f.attack === 'high';
 const yOff = low ? 36 : high ? 8 : 18;
 const h = low ? 22 : high ? 20 : 28;
 const x = f.facing > 0 ? cx : cx - reach;
 return { x, y: f.y + yOff, w: reach, h };
 }

 function rectsOverlap(a, b) {
 return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
 }

 function applyHit(attacker, defender, atk) {
 if (defender.hitstun > 0 && atk.type !== 'throw') return;
 const blocked = defender.block && atk.type !== 'throw';
 let dmg = atk.dmg * (attacker.isPlayer ? 1 : attacker.diff * 0.85);
 if (blocked) dmg *= 0.25;
 if (defender.crouch && atk.type === 'punch') dmg *= 0.5;
 defender.hp -= dmg;
 if (atk.type === 'throw') {
 defender.beingThrown = 24;
 defender.knockdown = 42;
 defender.hitstun = 28;
 } else if (atk.type === 'heavy' || atk.type === 'special') {
 defender.knockdown = dmg >= 14 ? 36 : 0;
 defender.hitstun = defender.knockdown ? 0 : 16;
 } else {
 defender.hitstun = 16;
 }
 defender.vx = attacker.facing * (atk.type === 'heavy' ? 6 : 4);
 shake = atk.type === 'special' ? 10 : 5;
 flash = 6;
 const S = sfx();
 if (S) {
 if (blocked) S.block();
 else {
 S.hit(attacker.attack || atk.type);
 S.hurt();
 }
 }
 }

 function updateCombat() {
 [player, opponent].forEach((f) => {
 if (f.attack) {
 f.attackTimer++;
 const atk = ATTACKS[f.attack];
 const activeStart = atk.startup;
 const activeEnd = atk.startup + atk.active;
 if (f.attackTimer < activeStart) f.attackPhase = 'startup';
 else if (f.attackTimer <= activeEnd) f.attackPhase = 'active';
 else f.attackPhase = 'recovery';
 if (f.attackPhase === 'active' && !f.attackSfxPlayed) {
 f.attackSfxPlayed = true;
 const S = sfx();
 if (S) S.attackActive(f.attack);
 }
 if (!f.attackHit && f.attackTimer >= activeStart && f.attackTimer <= activeEnd) {
 const hb = hitbox(f);
 const other = f === player ? opponent : player;
 if (hb && rectsOverlap(hb, hurtbox(other))) {
 applyHit(f, other, atk);
 f.attackHit = true;
 }
 }
 if (f.attackTimer > atk.startup + atk.active + atk.recovery) {
 if (!f.attackHit && f.isPlayer) {
 const S = sfx();
 if (S) S.whiff();
 }
 f.attack = null;
 f.attackPhase = null;
 f.attackSfxPlayed = false;
 }
 }
 if (f.specialCd > 0) f.specialCd--;
 if (f.hitstun > 0) {
 f.hitstun--;
 f.attack = null;
 }
 if (f.knockdown > 0) {
 f.knockdown--;
 f.attack = null;
 f.vx *= 0.85;
 }
 if (f.beingThrown > 0) f.beingThrown--;
 if (f.taunt > 0) f.taunt--;
 if (f.summonPose > 0) f.summonPose--;
 });

 summons = summons.filter((s) => {
 s.x += s.vx;
 s.life--;
 if (s.life <= 0) return false;
 if (rectsOverlap({ x: s.x, y: s.y, w: 16, h: 16 }, hurtbox(player))) {
 player.hp -= 4;
 player.hitstun = 8;
 shake = 4;
 const S = sfx();
 if (S) { S.hit('special'); S.hurt(); }
 return false;
 }
 return s.x > -20 && s.x < W + 20;
 });
 }

 function isHoldingBack(f) {
 const back = f.facing > 0 ? keys.a : keys.d;
 return back && !keys.s;
 }

 function handlePlayerInput() {
 if (gameState !== 'fight' || player.hitstun > 0 || player.knockdown > 0) return;
 player.crouch = keys.s && player.onGround && !isHoldingBack(player);
 player.block = player.onGround && (player.crouch || isHoldingBack(player));

 if (!player.attack) {
 if (keys.a) player.vx = -MOVE_SPEED;
 else if (keys.d) player.vx = MOVE_SPEED;
 else player.vx *= FLOOR_FRICTION;

 if (keys.w && player.onGround) {
 player.vy = -11.5;
 player.onGround = false;
 const S = sfx();
 if (S) S.jump();
 }

 const specialMod = keys.w;
 const close = dist(player, opponent) < ATTACKS.throw.range + 6;
 if (keys.arrowup) beginAttack(player, specialMod ? 'special' : 'high');
 else if (keys.arrowdown) beginAttack(player, 'low');
 else if (keys.arrowleft) beginAttack(player, close ? 'throw' : 'med');
 else if (keys.arrowright) beginAttack(player, close ? 'throw' : 'heavy');
 } else {
 player.vx *= 0.9;
 }
 player.facing = facingToward(player, opponent);
 }

 function updateAI() {
 if (gameState !== 'fight' || opponent.hitstun > 0 || opponent.knockdown > 0) return;
 opponent.aiTimer--;
 const d = dist(player, opponent);
 const diff = opponent.diff;

 if (opponent.boss) {
 const ratio = opponent.hp / opponent.maxHp;
 if (ratio <= 0.33 && opponent.phase < 3) {
 opponent.phase = 3;
 announce = 'PAULY0x PHASE 3 - PORK SUMMON!';
 stateTimer = 90;
 } else if (ratio <= 0.66 && opponent.phase < 2) {
 opponent.phase = 2;
 announce = 'PAULY0x PHASE 2 - TACO RV RAGE!';
 stateTimer = 90;
 }
 if (opponent.phase >= 3) {
 opponent.summonCd--;
 if (opponent.summonCd <= 0) {
 summons.push({ x: opponent.x, y: GROUND + 40, vx: -3.5, life: 180 });
 opponent.summonCd = 90 - opponent.phase * 10;
 opponent.summonPose = 30;
 announce = 'PORK MINION DEPLOYED!';
 stateTimer = 40;
 const S = sfx();
 if (S) S.summon();
 }
 }
 if (opponent.phase >= 2 && Math.random() < 0.004) {
 opponent.taunt = 45;
 }
 }

 if (opponent.aiTimer > 0) {
 opponent.vx = opponent.aiMove;
 return;
 }

 const roll = Math.random();
 opponent.block = roll < 0.08 * diff && d < 70;
 opponent.crouch = !opponent.block && roll > 0.92;

 if (d < ATTACKS.throw.range + 10 && roll < 0.22 * diff) {
 beginAttack(opponent, 'throw');
 opponent.aiTimer = 30;
 return;
 }
 if (d < 58 && roll < 0.35 * diff) {
 const kinds = ['high', 'low', 'med', 'heavy', 'special'];
 const pick = opponent.phase >= 2 ? kinds[Math.floor(Math.random() * kinds.length)] : kinds[Math.floor(Math.random() * 4)];
 beginAttack(opponent, pick);
 opponent.aiTimer = 25 + Math.random() * 20;
 return;
 }
 if (roll < 0.12 && opponent.onGround) {
 opponent.vy = -10 - diff;
 opponent.onGround = false;
 opponent.aiTimer = 20;
 return;
 }

 if (d > 90) {
 opponent.aiMove = facingToward(opponent, player) * (2.2 + diff * 0.4);
 opponent.aiTimer = 12 + Math.random() * 18;
 } else if (d < 40 && roll < 0.4) {
 opponent.aiMove = -facingToward(opponent, player) * 2.5;
 opponent.aiTimer = 10 + Math.random() * 12;
 } else {
 opponent.aiMove = facingToward(opponent, player) * (1.2 + diff * 0.25);
 opponent.aiTimer = 8 + Math.random() * 14;
 }
 opponent.facing = facingToward(opponent, player);
 }

 function physics(f) {
 const wasAir = !f.onGround;
 if (f.knockdown > 18) {
 f.y = GROUND + 28;
 f.onGround = true;
 f.vx *= 0.8;
 return;
 }
 if (f.hitstun > 0 && !f.attack) f.vx *= 0.92;
 f.vy += GRAVITY;
 f.x += f.vx;
 f.y += f.vy;
 if (f.y >= GROUND) {
 if (wasAir && f.vy > 1.5 && f.isPlayer) {
 const S = sfx();
 if (S) S.land();
 }
 f.y = GROUND;
 f.vy = 0;
 f.onGround = true;
 }
 f.x = Math.max(20, Math.min(W - f.w - 20, f.x));
 }

 function checkRoundEnd() {
 if (player.hp > 0 && opponent.hp > 0) {
 koPause = 0;
 return;
 }
 if (koPause === 0) {
 koPause = 55;
 const S = sfx();
 if (S) S.ko();
 if (player.hp <= 0) {
 player.defeat = true;
 opponent.victory = true;
 } else {
 opponent.defeat = true;
 player.victory = true;
 }
 }
 if (koPause > 0) {
 koPause--;
 return;
 }
 if (stateTimer > 0) return;
 const playerWin = opponent.hp <= 0;
 if (playerWin) {
 roundP++;
 refillWinner(player);
 announce = 'DEGEN WINS ROUND!';
 const S = sfx();
 if (S) S.roundWin();
 } else {
 roundO++;
 refillWinner(opponent);
 announce = opponent.name.toUpperCase() + ' WINS ROUND!';
 const S = sfx();
 if (S) S.roundLose();
 }
 gameState = 'roundEnd';
 stateTimer = 150;
 if (roundP >= 2 || roundO >= 2) {
 matchWon = roundP >= 2;
 gameState = 'matchEnd';
 stateTimer = 200;
 announce = matchWon ? 'YOU WIN THE MATCH!' : 'K.O. - YOU LOSE!';
 }
 }

 function update() {
 if (gameState === 'title' || gameState === 'ladder') {
 titleTick++;
 return;
 }
 if (stateTimer > 0) stateTimer--;
 if (shake > 0) shake--;
 if (flash > 0) flash--;

 if (gameState === 'vs' && stateTimer <= 0) startRound(roundP + roundO + 1);
 if (gameState === 'fight') {
 handlePlayerInput();
 updateAI();
 physics(player);
 physics(opponent);
 updateCombat();
 checkRoundEnd();
 }
 if (gameState === 'roundEnd' && stateTimer <= 0) {
 if (roundP < 2 && roundO < 2) startRound(roundP + roundO + 1);
 }
 if (gameState === 'matchEnd' && stateTimer <= 0) {
 if (matchWon) {
 ladderIndex++;
 if (ladderIndex > ROSTER.length) {
 gameState = 'victory';
 announce = 'TOP OF THE FOODCHAIN!';
 const S = sfx();
 if (S) S.victory();
 } else {
 showLadder();
 }
 } else {
 gameState = 'gameOver';
 const S = sfx();
 if (S) S.gameOver();
 }
 }
 }

 function drawBackground(idx) {
 const bg = BACKGROUNDS[idx % BACKGROUNDS.length];
 ctx.fillStyle = bg.sky;
 ctx.fillRect(0, 0, W, H);
 ctx.fillStyle = bg.floor;
 ctx.fillRect(0, GROUND + 40, W, H - GROUND - 40);
 ctx.fillStyle = '#0a0a12';
 ctx.fillRect(0, GROUND + 38, W, 4);

 const px = 8;
 ctx.fillStyle = 'rgba(0,255,65,0.15)';
 if (bg.props === 'city') {
 for (let i = 0; i < 9; i++) ctx.fillRect(i * 72, GROUND - 60 - (i % 3) * 20, 40, 60 + (i % 3) * 20);
 } else if (bg.props === 'pond') {
 ctx.fillStyle = 'rgba(0,180,120,0.25)';
 ctx.fillRect(0, GROUND + 20, W, 40);
 ctx.fillStyle = '#ff66aa';
 for (let i = 0; i < 6; i++) ctx.fillRect(80 + i * 90, GROUND - 10, 24, 8);
 } else if (bg.props === 'bossrv') {
 ctx.fillStyle = '#ff6600';
 ctx.fillRect(40, GROUND - 50, 200, 50);
 ctx.fillStyle = '#ff2288';
 ctx.fillRect(400, GROUND - 70, 180, 70);
 ctx.fillStyle = '#ffff00';
 ctx.fillRect(280, GROUND - 90, 80, 30);
 ctx.font = '10px monospace';
 ctx.fillText('POND0x RV', 290, GROUND - 72);
 } else if (bg.props === 'moon') {
 ctx.fillStyle = '#ccccaa';
 ctx.beginPath();
 ctx.arc(520, 60, 36, 0, Math.PI * 2);
 ctx.fill();
 } else {
 for (let i = 0; i < 7; i++) ctx.fillRect(30 + i * 85, GROUND - 30 - (i % 2) * 15, 50, 30);
 }
 }

 function drawPixelChar(f) {
 const KFS = window.KOL_FIGHTER_SPRITES;
 if (KFS && KFS.draw(ctx, f)) return;

 const img = sprites[f.slug];
 if (img && img.complete && img.naturalWidth) {
 const th = f.isPlayer ? 122 : (f.boss ? 148 : 126);
 const scale = th / img.naturalHeight;
 const dw = img.naturalWidth * scale;
 const cx = Math.round(f.x + f.w / 2);
 const feet = Math.round(f.y);
 ctx.save();
 ctx.translate(cx, feet);
 if (f.facing < 0) ctx.scale(-1, 1);
 ctx.drawImage(img, -dw / 2, -th, dw, th);
 ctx.restore();
 }
 }

 function drawHUD() {
 if (window.KOL_FIGHTER_NES) KOL_FIGHTER_NES.drawHud(ctx, W, player, opponent, roundP, roundO);
 if (opponent && opponent.boss) {
 for (let i = 0; i < 3; i++) {
 ctx.fillStyle = i < opponent.phase ? '#f0d030' : '#585858';
 ctx.fillRect(W / 2 - 20 + i * 14, H - 10, 10, 3);
 }
 }
 }

 function drawRetroBar(x, y, w, h, pct) {
 const fill = Math.max(0, Math.min(1, pct));
 ctx.fillStyle = '#000';
 ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
 ctx.fillStyle = '#442200';
 ctx.fillRect(x, y, w, h);
 const grad = ctx.createLinearGradient(x, y, x + w, y);
 grad.addColorStop(0, '#ffcc00');
 grad.addColorStop(0.85, '#ffaa00');
 grad.addColorStop(1, '#cc2200');
 ctx.fillStyle = grad;
 ctx.fillRect(x, y, w * fill, h);
 ctx.strokeStyle = '#fff';
 ctx.lineWidth = 1;
 ctx.strokeRect(x, y, w, h);
 }

 function drawAnnounce() {
 if (!announce || stateTimer <= 0) return;
 ctx.fillStyle = 'rgba(0,0,0,0.55)';
 ctx.fillRect(0, H / 2 - 30, W, 60);
 ctx.fillStyle = '#ffff00';
 ctx.font = 'bold 22px VT323, monospace';
 ctx.textAlign = 'center';
 ctx.fillText(announce, W / 2, H / 2 + 8);
 }

 function drawScreenOverlay() {
 ctx.textAlign = 'center';

 if (gameState === 'vs') {
 if (!drawFightScreen(1, true)) {
 if (window.KOL_FIGHTER_NES) KOL_FIGHTER_NES.drawStage(ctx, W, H, GROUND);
 else drawBackground(ladderIndex >= ROSTER.length ? 10 : ladderIndex);
 }
 ctx.fillStyle = 'rgba(0,0,0,0.35)';
 ctx.fillRect(0, 0, W, H);
 ctx.fillStyle = '#ffff00';
 ctx.font = 'bold 36px VT323, monospace';
 ctx.fillText('VS', W / 2, H / 2 - 10);
 ctx.fillStyle = '#fff';
 ctx.font = '18px VT323, monospace';
 ctx.fillText('DEGEN vs ' + opponent.name.toUpperCase(), W / 2, H / 2 + 24);
 if (opponent.tag) {
 ctx.fillStyle = '#ffcc00';
 ctx.font = '12px VT323, monospace';
 ctx.fillText(opponent.tag, W / 2, H / 2 + 44);
 }
 drawScanlines();
 return;
 }

 ctx.fillStyle = 'rgba(0,0,0,0.82)';
 ctx.fillRect(0, 0, W, H);
 ctx.fillStyle = '#00ff41';
 ctx.font = 'bold 28px VT323, monospace';

 if (gameState === 'gameOver') {
 ctx.fillStyle = 'rgba(0,0,0,0.72)';
 ctx.fillRect(0, 0, W, H);
 ctx.fillStyle = '#ff4444';
 ctx.font = 'bold 28px VT323, monospace';
 ctx.fillText('GAME OVER', W / 2, 120);
 ctx.fillStyle = '#fff';
 ctx.font = '16px VT323, monospace';
 ctx.fillText('PRESS ENTER TO RETRY', W / 2, 165);
 } else if (gameState === 'victory') {
 ctx.fillStyle = 'rgba(0,0,0,0.65)';
 ctx.fillRect(0, 0, W, H);
 ctx.fillStyle = '#ffff00';
 ctx.font = 'bold 24px VT323, monospace';
 ctx.fillText('TOP OF THE FOODCHAIN!', W / 2, 110);
 ctx.fillStyle = '#00ff41';
 ctx.font = '16px VT323, monospace';
 ctx.fillText('PAULY0x DEFEATED - DEGEN KING', W / 2, 145);
 ctx.fillText('PRESS ENTER TO PLAY AGAIN', W / 2, 175);
 }
 }

 function drawControls(y) {
 ctx.textAlign = 'left';
 ctx.fillStyle = '#66aa66';
 ctx.font = '13px VT323, monospace';
 const lines = [
 'WASD - move / jump / crouch / block',
 'ARROWS - attacks (up high, down low)',
 'LEFT/RIGHT - med / heavy (throw when close)',
 'W + ARROW - special move'
 ];
 lines.forEach((t, i) => ctx.fillText(t, 120, y + i * 20));
 }

 function render() {
 ctx.save();
 if (shake > 0) {
 ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
 }
 if (gameState === 'title') {
 drawTitleScreen();
 ctx.restore();
 return;
 }
 if (gameState === 'ladder') {
 drawLadderScreen();
 ctx.restore();
 return;
 }
 if (gameState === 'gameOver' || gameState === 'victory') {
 if (screens.titleNoCoin) {
 ctx.drawImage(screens.titleNoCoin, 0, 0, W, H);
 drawScanlines();
 } else {
 drawBackground(0);
 }
 drawScreenOverlay();
 ctx.restore();
 return;
 }

 if (gameState === 'vs') {
 drawScreenOverlay();
 ctx.restore();
 return;
 }

 if (!drawFightScreen(1, true)) {
 if (window.KOL_FIGHTER_NES) KOL_FIGHTER_NES.drawStage(ctx, W, H, GROUND);
 else {
 const bgIdx = ladderIndex >= ROSTER.length ? 10 : ladderIndex;
 drawBackground(bgIdx);
 }
 }
 if (player) drawPixelChar(player);
 if (opponent) drawPixelChar(opponent);
 summons.forEach((s) => {
 ctx.fillStyle = '#ff88cc';
 ctx.fillRect(s.x, s.y, 16, 16);
 ctx.fillStyle = '#ffff00';
 ctx.font = '8px monospace';
 ctx.fillText('PORK', s.x, s.y - 2);
 });
 drawHUD();
 drawAnnounce();
 drawScanlines();
 if (flash > 0) {
 ctx.fillStyle = 'rgba(255,255,255,0.25)';
 ctx.fillRect(0, 0, W, H);
 }
 if (gameState === 'matchEnd') drawScreenOverlay();
 ctx.restore();
 }

 function loop() {
 update();
 render();
 requestAnimationFrame(loop);
 }

 function onKey(e, down) {
 const k = e.key.toLowerCase();
 if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'enter', ' '].includes(k) || e.key === 'Enter') {
 e.preventDefault();
 }
 if (k === 'arrowup') keys.arrowup = down;
 else if (k === 'arrowdown') keys.arrowdown = down;
 else if (k === 'arrowleft') keys.arrowleft = down;
 else if (k === 'arrowright') keys.arrowright = down;
 else if (k.length === 1) keys[k] = down;

 const S = sfx();
 if (S) S.init();

 if (down && (k === 'enter' || e.key === ' ')) {
 if (gameState === 'title') {
 if (S) S.coin();
 ladderIndex = 0;
 showLadder();
 } else if (gameState === 'ladder') {
 startMatch();
 } else if (gameState === 'gameOver' || gameState === 'victory') {
 ladderIndex = 0;
 gameState = 'title';
 announce = '';
 }
 }
 }

 window.addEventListener('keydown', (e) => onKey(e, true));
 window.addEventListener('keyup', (e) => onKey(e, false));

 loadSprites();
 loadScreens();
 loop();
})();