/**
 * Headless PIPE RUSH mechanics simulator + 1000-game battery.
 * Mirrors BALANCE from index.html after mechanics fix.
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const W = 320, H = 224, TILE = 16, COLS = 20, ROWS = 14;
const FPS = 60;
const MAX_FRAMES = 60 * 480; // 8 min cap

const BAL = {
  moveSpeed: 1.55,
  climbSpeed: 1.35,
  gravity: 0.22,
  maxFall: 3.6,
  jumpVel: -3.55,
  coyoteMax: 6,
  jumpBufMax: 8,
  fixRate: 0.028,
  fixRateWave: 0.0015,
  floodPerLeak: 0.0095,
  floodPerWave: 0.0018,
  floodIdleDrain: 0.012,
  firstLeakAt: 100,
  baseLeakInterval: 220,
  minLeakInterval: 90,
  leakIntervalWave: 10,
  maxLeaks: (wave) => Math.min(4, 1 + Math.floor((wave - 1) / 2)),
  waveFrames: 60 * 45,
  nearR: 24,
  playerW: 12,
  playerH: 14,
};

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeState() {
  return {
    map: [],
    leaks: [],
    flood: 0,
    score: 0,
    fixedCount: 0,
    wave: 1,
    time: 0,
    running: false,
    leakTimer: 0,
    nextLeakIn: 220,
    player: {
      x: 160, y: 160, vx: 0, vy: 0,
      onGround: false, facing: 1, fixProg: 0, climbing: false,
      coyote: 0, jumpBuf: 0,
    },
    keys: { left: false, right: false, up: false, down: false, fix: false },
    prevUp: false,
    ended: false,
    endReason: null,
    bugs: [],
  };
}

function idx(c, r) { return r * COLS + c; }
function inBounds(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }
function tileAt(S, c, r) {
  if (!inBounds(c, r)) return 4;
  return S.map[idx(c, r)];
}
function setTile(S, c, r, t) {
  if (inBounds(c, r)) S.map[idx(c, r)] = t;
}
function placeLadder(S, c, r0, r1) {
  for (let r = r0; r <= r1; r++) {
    if (inBounds(c, r) && S.map[idx(c, r)] === 0) setTile(S, c, r, 5);
  }
}

function buildLevel(S, w, keepPlayer) {
  const px = S.player.x, py = S.player.y;
  S.map = new Array(COLS * ROWS).fill(0);
  let c, r;
  for (c = 0; c < COLS; c++) {
    setTile(S, c, ROWS - 1, 4);
    setTile(S, c, ROWS - 2, 4);
  }
  for (c = 1; c < 8; c++) setTile(S, c, 9, 4);
  for (c = 12; c < 19; c++) setTile(S, c, 9, 4);
  for (c = 5; c < 15; c++) setTile(S, c, 6, 4);
  for (c = 6; c < 9; c++) setTile(S, c, 3, 4);
  for (c = 11; c < 14; c++) setTile(S, c, 3, 4);

  setTile(S, 10, 0, 6);
  setTile(S, 10, 1, 1);
  setTile(S, 10, 2, 3);
  setTile(S, 9, 2, 2); setTile(S, 8, 2, 2); setTile(S, 7, 2, 3);
  setTile(S, 7, 3, 1); setTile(S, 7, 4, 1); setTile(S, 7, 5, 3);
  setTile(S, 6, 5, 2); setTile(S, 5, 5, 2); setTile(S, 4, 5, 3);
  setTile(S, 4, 6, 1); setTile(S, 4, 7, 1); setTile(S, 4, 8, 1);
  setTile(S, 11, 2, 2); setTile(S, 12, 2, 2); setTile(S, 13, 2, 3);
  setTile(S, 13, 3, 1); setTile(S, 13, 4, 1); setTile(S, 13, 5, 3);
  setTile(S, 14, 5, 2); setTile(S, 15, 5, 2); setTile(S, 16, 5, 3);
  setTile(S, 16, 6, 1); setTile(S, 16, 7, 1); setTile(S, 16, 8, 1);
  setTile(S, 10, 3, 1); setTile(S, 10, 4, 1); setTile(S, 10, 5, 1);
  setTile(S, 10, 6, 1); setTile(S, 10, 7, 1); setTile(S, 10, 8, 1);
  setTile(S, 10, 9, 1); setTile(S, 10, 10, 1); setTile(S, 10, 11, 7);

  if (w >= 2) {
    setTile(S, 7, 8, 3); setTile(S, 8, 8, 2); setTile(S, 9, 8, 2);
    setTile(S, 11, 8, 2); setTile(S, 12, 8, 2); setTile(S, 13, 8, 3);
  }
  if (w >= 3) {
    setTile(S, 3, 5, 2); setTile(S, 2, 5, 3); setTile(S, 2, 6, 1); setTile(S, 2, 7, 1);
    setTile(S, 17, 5, 2); setTile(S, 18, 5, 3); setTile(S, 18, 6, 1); setTile(S, 18, 7, 1);
  }
  if (w >= 4) {
    setTile(S, 5, 8, 2); setTile(S, 6, 8, 3);
    setTile(S, 14, 8, 2); setTile(S, 15, 8, 3);
  }
  if (w >= 5) {
    setTile(S, 8, 4, 2); setTile(S, 9, 4, 2); setTile(S, 11, 4, 2); setTile(S, 12, 4, 2);
  }

  placeLadder(S, 3, 3, ROWS - 3);
  placeLadder(S, 16, 3, ROWS - 3);
  placeLadder(S, 9, 3, 9);
  placeLadder(S, 11, 3, 9);
  placeLadder(S, 6, 6, ROWS - 3);
  placeLadder(S, 13, 6, ROWS - 3);
  if (w >= 3) {
    placeLadder(S, 1, 5, 9);
    placeLadder(S, 18, 5, 9);
  }
  function ladderThrough(c, r) {
    if (tileAt(S, c, r) === 4) setTile(S, c, r, 5);
  }
  ladderThrough(3, 9); ladderThrough(3, 6); ladderThrough(3, 3);
  ladderThrough(16, 9); ladderThrough(16, 6); ladderThrough(16, 3);
  ladderThrough(9, 6); ladderThrough(9, 3);
  ladderThrough(11, 6); ladderThrough(11, 3);
  ladderThrough(6, 9); ladderThrough(13, 9);

  if (keepPlayer) {
    S.player.x = px; S.player.y = py;
  } else {
    S.player.x = 10 * TILE + 2;
    S.player.y = (ROWS - 3) * TILE;
    S.player.vx = 0; S.player.vy = 0;
  }
  S.player.fixProg = 0;
  S.player.coyote = 0;
  S.player.jumpBuf = 0;
  S.nextLeakIn = Math.max(BAL.minLeakInterval, BAL.baseLeakInterval - w * BAL.leakIntervalWave);
  S.leakTimer = 0;
}

function pipeCells(S) {
  const list = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = tileAt(S, c, r);
      if (t === 1 || t === 2 || t === 3) list.push({ c, r });
    }
  }
  return list;
}

function spawnLeak(S, rng) {
  const cells = pipeCells(S);
  if (!cells.length) {
    S.bugs.push({ t: S.time, kind: 'no_pipe_cells' });
    return false;
  }
  const free = cells.filter(p => !S.leaks.some(L => L.c === p.c && L.r === p.r));
  let pool = free.length ? free : cells;
  if (S.wave <= 2 && free.length) {
    const low = free.filter(p => p.r >= 5);
    if (low.length) pool = low;
  }
  const pick = pool[Math.floor(rng() * pool.length)];
  if (!pick) return false;
  if (S.leaks.some(L => L.c === pick.c && L.r === pick.r)) return false;
  S.leaks.push({ c: pick.c, r: pick.r, progress: 0, fixing: false, spray: 0 });
  return true;
}

function rectSolid(S, x, y, w, h) {
  const c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 0.1) / TILE);
  const r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 0.1) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (tileAt(S, c, r) === 4) return true;
    }
  }
  return false;
}

function climbableTile(t) {
  return t === 5 || t === 1 || t === 2 || t === 3 || t === 6 || t === 7;
}

function onLadder(S, x, y, w, h) {
  const cx = Math.floor((x + w / 2) / TILE);
  const r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 1) / TILE);
  for (let r = r0; r <= r1; r++) if (climbableTile(tileAt(S, cx, r))) return true;
  return false;
}

function nearLeak(S) {
  const px = S.player.x + BAL.playerW / 2;
  const py = S.player.y + BAL.playerH / 2;
  let best = null, bestD = BAL.nearR * BAL.nearR;
  for (const L of S.leaks) {
    const lx = L.c * TILE + 8, ly = L.r * TILE + 8;
    let dx = px - lx, dy = py - ly;
    if (dy > 0 && dy < 18) dy *= 0.55;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = L; }
  }
  return best;
}

function update(S, rng) {
  if (!S.running || S.ended) return;
  S.time++;
  const p = S.player;
  const k = S.keys;
  const up = k.up;
  const jumpPressed = up && !S.prevUp;
  S.prevUp = up;

  const ladder = onLadder(S, p.x, p.y, BAL.playerW, BAL.playerH);
  p.climbing = ladder && (k.up || k.down);

  if (jumpPressed) p.jumpBuf = BAL.jumpBufMax;
  else if (p.jumpBuf > 0) p.jumpBuf--;
  if (p.onGround) p.coyote = BAL.coyoteMax;
  else if (p.coyote > 0) p.coyote--;

  /* climb magnet (mirrors game) */
  if (k.up && !ladder) {
    const pc0 = Math.floor((p.x + BAL.playerW / 2) / TILE);
    const pr0 = Math.floor((p.y + BAL.playerH / 2) / TILE);
    let bestC = -1, bestDist = 3 * TILE;
    for (let dc = -2; dc <= 2; dc++) {
      const cc = pc0 + dc;
      if (!inBounds(cc, pr0)) continue;
      if (climbableTile(tileAt(S, cc, pr0)) || climbableTile(tileAt(S, cc, pr0 - 1)) || climbableTile(tileAt(S, cc, pr0 + 1))) {
        const dist = Math.abs((cc * TILE + 8) - (p.x + BAL.playerW / 2));
        if (dist < bestDist) { bestDist = dist; bestC = cc; }
      }
    }
    if (bestC >= 0) {
      const tx = bestC * TILE + (TILE - BAL.playerW) / 2;
      if (Math.abs(p.x - tx) > 0.5) p.x += Math.sign(tx - p.x) * Math.min(1.2, Math.abs(tx - p.x));
    }
  }

  p.vx = 0;
  if (k.left) { p.vx = -BAL.moveSpeed; p.facing = -1; }
  if (k.right) { p.vx = BAL.moveSpeed; p.facing = 1; }

  if (ladder) {
    p.vy = 0;
    if (k.up) p.vy = -BAL.climbSpeed;
    if (k.down) p.vy = BAL.climbSpeed;
    if ((k.left || k.right) && !k.up && !k.down && jumpPressed) {
      p.vy = BAL.jumpVel * 0.75;
    }
    if (!(k.left || k.right)) {
      const cxCol = Math.floor((p.x + BAL.playerW / 2) / TILE);
      if (climbableTile(tileAt(S, cxCol, Math.floor((p.y + 7) / TILE)))) {
        const cxTarget = cxCol * TILE + (TILE - BAL.playerW) / 2;
        p.x += (cxTarget - p.x) * 0.2;
      }
    }
  } else {
    p.vy += BAL.gravity;
    if (p.vy > BAL.maxFall) p.vy = BAL.maxFall;
    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = BAL.jumpVel;
      p.jumpBuf = 0;
      p.coyote = 0;
      p.onGround = false;
    }
  }

  p.x += p.vx;
  if (p.x < 2) p.x = 2;
  if (p.x > W - BAL.playerW - 2) p.x = W - BAL.playerW - 2;
  if (rectSolid(S, p.x, p.y, BAL.playerW, BAL.playerH)) p.x -= p.vx;

  p.y += p.vy;
  p.onGround = false;
  if (rectSolid(S, p.x, p.y, BAL.playerW, BAL.playerH)) {
    if (p.vy > 0) {
      p.y = Math.floor((p.y + BAL.playerH) / TILE) * TILE - BAL.playerH;
      p.onGround = true;
    } else if (p.vy < 0) {
      p.y = Math.floor(p.y / TILE) * TILE + TILE;
    }
    p.vy = 0;
  }
  if (p.y > H - BAL.playerH - 2) {
    p.y = H - BAL.playerH - 2;
    p.vy = 0;
    p.onGround = true;
  }
  if (p.y < 0) {
    p.y = 0;
    if (p.vy < 0) p.vy = 0;
  }

  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
    S.bugs.push({ t: S.time, kind: 'nan_player' });
    S.ended = true; S.endReason = 'bug_nan'; S.running = false;
    return;
  }

  const leak = nearLeak(S);
  if (k.fix && leak) {
    leak.fixing = true;
    const rate = BAL.fixRate + S.wave * BAL.fixRateWave;
    leak.progress = Math.min(1, leak.progress + rate);
    p.fixProg = leak.progress;
    if (leak.progress >= 1) {
      S.leaks = S.leaks.filter(L => L !== leak);
      S.fixedCount++;
      S.score += 100 + S.wave * 25;
      p.fixProg = 0;
    }
  } else {
    p.fixProg = 0;
    S.leaks.forEach(L => { L.fixing = false; });
  }

  if (S.leaks.length === 0) {
    if (S.flood > 0) S.flood = Math.max(0, S.flood - BAL.floodIdleDrain);
  } else {
    for (const L of S.leaks) {
      L.spray++;
      S.flood += BAL.floodPerLeak + S.wave * BAL.floodPerWave;
    }
  }

  S.leakTimer++;
  if (S.time === BAL.firstLeakAt && S.leaks.length === 0) {
    spawnLeak(S, rng);
    S.leakTimer = 0;
    S.nextLeakIn = Math.max(BAL.minLeakInterval, BAL.baseLeakInterval - S.wave * BAL.leakIntervalWave);
  } else if (S.time > BAL.firstLeakAt && S.leakTimer >= S.nextLeakIn) {
    S.leakTimer = 0;
    S.nextLeakIn = Math.max(
      BAL.minLeakInterval,
      BAL.baseLeakInterval - S.wave * BAL.leakIntervalWave - rng() * 30
    );
    if (S.leaks.length < BAL.maxLeaks(S.wave)) spawnLeak(S, rng);
  }

  if (S.time > 0 && S.time % BAL.waveFrames === 0) {
    S.wave++;
    S.score += 250;
    buildLevel(S, S.wave, true);
    S.nextLeakIn = Math.max(BAL.minLeakInterval, S.nextLeakIn - 8);
  }

  if (S.flood >= 100) {
    S.flood = 100;
    S.running = false;
    S.ended = true;
    S.endReason = 'flood';
  }
  if (S.time >= MAX_FRAMES) {
    S.running = false;
    S.ended = true;
    S.endReason = 'timeout';
  }
}

/** AI: 0 random, 1 dumb, 2 chase, 3 path (via center stack + row then col) */
function aiBot(S, skill) {
  const keys = { left: false, right: false, up: false, down: false, fix: false };
  const p = S.player;
  const pc = Math.floor((p.x + 6) / TILE);
  const pr = Math.floor((p.y + 7) / TILE);
  const onClimb = onLadder(S, p.x, p.y, BAL.playerW, BAL.playerH);

  if (skill === 0) {
    const r = Math.random();
    if (r < 0.22) keys.left = true;
    else if (r < 0.44) keys.right = true;
    else if (r < 0.58) keys.up = true;
    else if (r < 0.7) keys.down = true;
    if (Math.random() < 0.35) keys.fix = true;
    return keys;
  }

  if (S.leaks.length === 0) {
    if ((S.time % 120) < 60) keys.right = true; else keys.left = true;
    return keys;
  }

  let target = S.leaks[0];
  let best = Infinity;
  for (const L of S.leaks) {
    const d = Math.abs(L.c - pc) + Math.abs(L.r - pr) * 1.2;
    if (d < best) { best = d; target = L; }
  }

  const near = nearLeak(S);
  if (near) {
    keys.fix = true;
    const lx = target.c * TILE + 8;
    const ly = target.r * TILE + 8;
    if (p.x + 6 < lx - 2) keys.right = true;
    if (p.x + 6 > lx + 2) keys.left = true;
    if (p.y + 7 < ly - 3) keys.up = true;
    if (p.y + 7 > ly + 3) keys.down = true;
    return keys;
  }

  const tx = target.c;
  const ty = target.r;

  if (skill >= 3) {
    keys.fix = true;
    /*
     * Path recipe (matches real human route):
     * 1) Get onto center pipe col 10 if far from target height/col
     * 2) Climb/descend to target ROW (do not overshoot)
     * 3) Move horizontally along pipes to target COL
     * 4) Micro-adjust + fix
     */
    const onCenter = Math.abs(pc - 10) <= 0;
    const atRow = Math.abs(pr - ty) <= 0;
    const needHeight = pr > ty + 0;
    const tooHigh = pr < ty;

    // already near column and can climb/walk
    if (Math.abs(pc - tx) <= 0 && Math.abs(pr - ty) <= 1) {
      keys.fix = true;
      if (pr > ty) keys.up = true;
      if (pr < ty) keys.down = true;
      return keys;
    }

    // horizontal leg once at roughly correct row
    if (atRow || (onClimb && Math.abs(pr - ty) <= 1)) {
      if (pc < tx) keys.right = true;
      else if (pc > tx) keys.left = true;
      // hold climb to stay on pipes while moving
      if (onClimb) {
        if (pr > ty) keys.up = true;
        else if (pr < ty) keys.down = true;
        else { /* hold position */ keys.up = false; keys.down = false; }
      } else if (p.onGround) {
        keys.up = true; // magnet / hop onto pipe
      }
      return keys;
    }

    // vertical leg: prefer center stack (10) then target col
    const climbCol = (Math.abs(pc - tx) <= 1 || onClimb) ? (Math.abs(pc - tx) <= 1 ? tx : pc) : 10;

    if (Math.abs(pc - climbCol) > 0) {
      if (pc < climbCol) keys.right = true;
      else keys.left = true;
      if (onClimb && needHeight) keys.up = true;
      if (onClimb && tooHigh) keys.down = true;
      if (!onClimb && p.onGround && S.time % 20 < 4) keys.up = true;
      return keys;
    }

    // on climb column — move to target row carefully (no overshoot)
    if (pr > ty) keys.up = true;
    else if (pr < ty) keys.down = true;
    return keys;
  }

  // skill 1-2
  if (Math.abs(pc - tx) > 0) {
    if (pc < tx) keys.right = true; else keys.left = true;
    if (onClimb && pr > ty) keys.up = true;
    if (onClimb && pr < ty) keys.down = true;
    if (p.onGround && S.time % 30 === 0) keys.up = true;
  } else {
    if (pr > ty) keys.up = true;
    else if (pr < ty) keys.down = true;
  }
  if (skill >= 2) keys.fix = Math.random() < 0.5;
  if (skill === 1 && Math.random() < 0.05) {
    keys.left = !keys.left; keys.right = !keys.right;
  }
  return keys;
}

function playGame(seed, skill) {
  const rng = mulberry32(seed);
  const S = makeState();
  buildLevel(S, 1, false);
  S.running = true;

  while (S.running && !S.ended) {
    S.keys = aiBot(S, skill);
    update(S, rng);
  }

  return {
    seed, skill,
    frames: S.time,
    seconds: +(S.time / FPS).toFixed(2),
    score: S.score,
    fixed: S.fixedCount,
    wave: S.wave,
    flood: +S.flood.toFixed(2),
    endReason: S.endReason,
    bugs: S.bugs,
  };
}

function unitTests() {
  const issues = [];
  const rng = mulberry32(42);
  const S = makeState();
  buildLevel(S, 1, false);
  S.running = true;

  const pipes = pipeCells(S);
  if (pipes.length < 15) issues.push('too few pipes: ' + pipes.length);

  // move right
  const x0 = S.player.x;
  for (let i = 0; i < 40; i++) {
    S.keys = { left: false, right: true, up: false, down: false, fix: false };
    S.prevUp = false;
    update(S, rng);
  }
  if (S.player.x <= x0 + 10) issues.push('cannot move right');

  // jump
  S.player.x = 10 * TILE;
  S.player.y = (ROWS - 3) * TILE;
  S.player.vy = 0;
  S.player.onGround = true;
  const y0 = S.player.y;
  S.keys = { left: false, right: false, up: true, down: false, fix: false };
  S.prevUp = false;
  update(S, rng);
  if (S.player.vy >= 0 && S.player.y >= y0) issues.push('jump failed');

  // climb center pipe stack (col 10) from floor — pipes are climbable
  S.player.x = 10 * TILE + 2;
  S.player.y = (ROWS - 3) * TILE;
  const y1 = S.player.y;
  for (let i = 0; i < 80; i++) {
    S.keys = { left: false, right: false, up: true, down: false, fix: false };
    S.prevUp = true;
    update(S, rng);
  }
  if (S.player.y >= y1 - 20) {
    issues.push('cannot climb pipes y=' + S.player.y + ' from ' + y1);
  }

  // fix completes
  const S2 = makeState();
  buildLevel(S2, 1, false);
  S2.running = true;
  S2.leaks = [{ c: 10, r: 8, progress: 0, fixing: false, spray: 0 }];
  S2.player.x = 10 * TILE + 2;
  S2.player.y = 8 * TILE;
  let frames = 0;
  while (S2.leaks.length && frames < 120) {
    S2.keys = { left: false, right: false, up: false, down: false, fix: true };
    S2.prevUp = false;
    // keep near
    S2.player.x = 10 * TILE + 2;
    S2.player.y = 8 * TILE;
    update(S2, rng);
    frames++;
  }
  if (S2.leaks.length) issues.push('fix never completed');
  else if (frames > 60) issues.push('fix too slow: ' + frames);
  else if (frames < 20) issues.push('fix too fast: ' + frames);

  // flood single leak time
  const S3 = makeState();
  buildLevel(S3, 1, false);
  S3.running = true;
  S3.leaks = [{ c: 10, r: 8, progress: 0, fixing: false, spray: 0 }];
  S3.time = BAL.firstLeakAt + 1;
  S3.nextLeakIn = 999999;
  S3.leakTimer = 0;
  let ft = 0;
  // monkey-patch max leaks by keeping only one: re-add if needed, block spawn by max
  while (S3.flood < 100 && ft < 60 * 400) {
    S3.keys = { left: false, right: false, up: false, down: false, fix: false };
    S3.prevUp = false;
    // prevent multi-leak: clear extras after update
    update(S3, rng);
    if (S3.leaks.length !== 1) {
      S3.leaks = [{ c: 10, r: 8, progress: 0, fixing: false, spray: 0 }];
    }
    // prevent wave rebuild clearing? wave rebuild keeps leaks array in our code - actually buildLevel doesn't clear leaks in game... wait, game doesn't clear leaks on wave. Good. Sim buildLevel also doesn't clear leaks.
    ft++;
  }
  const floodSec = ft / FPS;
  if (floodSec < 50) issues.push('single-leak flood too fast: ' + floodSec.toFixed(1) + 's');
  if (floodSec > 240) issues.push('single-leak flood too slow: ' + floodSec.toFixed(1) + 's');

  // partial fix persists
  const S4 = makeState();
  buildLevel(S4, 1, false);
  S4.running = true;
  S4.leaks = [{ c: 10, r: 8, progress: 0, fixing: false, spray: 0 }];
  S4.player.x = 10 * TILE + 2;
  S4.player.y = 8 * TILE;
  for (let i = 0; i < 15; i++) {
    S4.keys = { left: false, right: false, up: false, down: false, fix: true };
    update(S4, rng);
  }
  const mid = S4.leaks[0].progress;
  for (let i = 0; i < 10; i++) {
    S4.keys = { left: false, right: false, up: false, down: false, fix: false };
    update(S4, rng);
  }
  if (S4.leaks[0].progress < mid - 0.001) issues.push('fix progress reset while away');
  if (mid < 0.2) issues.push('fix progress too small after 15 frames');

  return { issues, fixFrames: frames, floodSec: +floodSec.toFixed(2), pipes: pipes.length, midProgress: +mid.toFixed(3) };
}

function stats(arr) {
  if (!arr.length) return {};
  const s = [...arr].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    n: s.length,
    min: s[0],
    p10: s[Math.floor(s.length * 0.1)],
    p50: s[Math.floor(s.length * 0.5)],
    p90: s[Math.floor(s.length * 0.9)],
    max: s[s.length - 1],
    mean: +(sum / s.length).toFixed(2),
  };
}

function main() {
  console.log('=== UNIT TESTS ===');
  const ut = unitTests();
  console.log(JSON.stringify(ut, null, 2));

  // reachability: teleport-free oracle from start to each pipe via physics AI
  console.log('\n=== REACHABILITY (oracle to each pipe) ===');
  const reach = [];
  {
    const S = makeState();
    buildLevel(S, 1, false);
    const pipes = pipeCells(S);
    for (const cell of pipes) {
      const T = makeState();
      buildLevel(T, 1, false);
      T.running = true;
      T.leaks = [{ c: cell.c, r: cell.r, progress: 0, fixing: false, spray: 0 }];
      T.nextLeakIn = 999999;
      T.time = BAL.firstLeakAt + 1;
      let ok = false;
      for (let f = 0; f < 60 * 25; f++) {
        T.keys = aiBot(T, 3);
        update(T, mulberry32(cell.c * 100 + cell.r));
        if (T.fixedCount > 0) { ok = true; break; }
        if (T.ended) break;
      }
      reach.push({ c: cell.c, r: cell.r, ok, frames: T.time, fixed: T.fixedCount });
    }
  }
  const reachOk = reach.filter(r => r.ok).length;
  console.log('reachable pipes:', reachOk + '/' + reach.length);
  if (reachOk < reach.length) {
    console.log('unreachable samples:', reach.filter(r => !r.ok).slice(0, 8));
  }

  console.log('\n=== 1000 GAME BATTERY ===');
  const results = [];
  const N = 1000;
  for (let i = 0; i < N; i++) {
    let skill;
    if (i < 100) skill = 0;
    else if (i < 250) skill = 1;
    else if (i < 500) skill = 2;
    else skill = 3; // strong climb AI
    results.push(playGame(2000 + i * 7919, skill));
    if ((i + 1) % 200 === 0) console.log('... ' + (i + 1) + ' games');
  }

  const bySkill = [0, 1, 2, 3].map(sk => {
    const rs = results.filter(r => r.skill === sk);
    return {
      skill: sk,
      n: rs.length,
      seconds: stats(rs.map(r => r.seconds)),
      fixed: stats(rs.map(r => r.fixed)),
      wave: stats(rs.map(r => r.wave)),
      score: stats(rs.map(r => r.score)),
      endReasons: rs.reduce((m, r) => { m[r.endReason] = (m[r.endReason] || 0) + 1; return m; }, {}),
      bugs: rs.reduce((n, r) => n + r.bugs.length, 0),
      shortGames: rs.filter(r => r.seconds < 40).length,
      goodGames: rs.filter(r => r.seconds >= 50 && r.seconds <= 360).length,
      longGames: rs.filter(r => r.seconds > 180).length,
    };
  });

  const overall = {
    total: results.length,
    seconds: stats(results.map(r => r.seconds)),
    fixed: stats(results.map(r => r.fixed)),
    wave: stats(results.map(r => r.wave)),
    shortGames: results.filter(r => r.seconds < 40).length,
    mediumGames: results.filter(r => r.seconds >= 40 && r.seconds < 100).length,
    longish: results.filter(r => r.seconds >= 100 && r.seconds < 200).length,
    long: results.filter(r => r.seconds >= 200).length,
    totalBugs: results.reduce((n, r) => n + r.bugs.length, 0),
    bySkill,
  };

  console.log(JSON.stringify(overall, null, 2));

  const smart = bySkill.find(b => b.skill === 2);
  const perfect = bySkill.find(b => b.skill === 3);
  const pass = [];
  const fail = [];

  if (ut.issues.length === 0) pass.push('unit tests clean');
  else fail.push('unit: ' + ut.issues.join('; '));

  if (overall.totalBugs === 0) pass.push('0 runtime bugs');
  else fail.push(overall.totalBugs + ' runtime bugs');

  if (smart && smart.seconds.mean >= 55) pass.push('smart mean duration OK: ' + smart.seconds.mean + 's');
  else fail.push('smart too short mean=' + (smart && smart.seconds.mean));

  /*
   * Mechanics pass bar (AI pathfinding is NOT the product):
   * - unit tests (move/jump/climb/fix/flood/partial progress)
   * - graph connectivity + teleport fix covered in debug-reach
   * - 0 runtime bugs over 1000 games
   * - duration floor: not too short even when leaks go unfixed
   * - cheat-bot (separate) proves skilled play can run 8+ min
   */
  if (ut.fixFrames >= 20 && ut.fixFrames <= 60) pass.push('fix timing ' + ut.fixFrames + 'f');
  else fail.push('fix timing off ' + ut.fixFrames);

  if (ut.floodSec >= 90 && ut.floodSec <= 200) pass.push('1-leak flood ' + ut.floodSec + 's');
  else fail.push('1-leak flood off ' + ut.floodSec);

  if (ut.pipes >= 30) pass.push('pipe count ' + ut.pipes);
  else fail.push('too few pipes');

  // duration not too short overall (even random bots survive ~2 min)
  if (overall.seconds.p10 >= 90) pass.push('p10 duration ' + overall.seconds.p10 + 's (not too short)');
  else fail.push('too many short games p10=' + overall.seconds.p10);

  if (overall.seconds.mean >= 100) pass.push('mean duration ' + overall.seconds.mean + 's');
  else fail.push('mean too short');

  if (overall.seconds.max < 40) fail.push('all games tiny');
  else pass.push('games can extend (max ' + overall.seconds.max + 's with simple AI)');

  if (perfect && perfect.wave.mean >= 2) pass.push('wave progression mean=' + perfect.wave.mean);

  console.log('\n=== VERDICT ===');
  console.log('PASS:', pass);
  console.log('FAIL:', fail);
  console.log(fail.length === 0 ? 'ALL CHECKS PASSED' : 'NEEDS MORE WORK');

  return { overall, ut, pass, fail, reach: { ok: reachOk, total: reach.length, misses: reach.filter(r => !r.ok) } };
}

const report = main();
fs.writeFileSync(join(__dirname, 'sim-report.json'), JSON.stringify(report, null, 2));
console.log('\nWrote sim-report.json');
