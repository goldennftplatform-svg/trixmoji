/** Debug: teleport-to-leak fix + path climb trace */
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Re-implement thinnest slice: import sim by spawning logic from sim-test
// Actually duplicate only what we need by running play with forced positions.

const TILE = 16, COLS = 20, ROWS = 14, W = 320, H = 224;
const BAL = {
  moveSpeed: 1.55, climbSpeed: 1.35, gravity: 0.22, maxFall: 3.6,
  jumpVel: -3.55, coyoteMax: 6, jumpBufMax: 8,
  fixRate: 0.028, fixRateWave: 0.0015,
  floodPerLeak: 0, floodPerWave: 0, floodIdleDrain: 0,
  firstLeakAt: 999999, baseLeakInterval: 999999, minLeakInterval: 999999,
  leakIntervalWave: 0, maxLeaks: () => 0, waveFrames: 9999999,
  nearR: 24, playerW: 12, playerH: 14,
};

function idx(c, r) { return r * COLS + c; }
function inBounds(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }
function tileAt(map, c, r) { if (!inBounds(c, r)) return 4; return map[idx(c, r)]; }
function setTile(map, c, r, t) { if (inBounds(c, r)) map[idx(c, r)] = t; }
function placeLadder(map, c, r0, r1) {
  for (let r = r0; r <= r1; r++) if (inBounds(c, r) && map[idx(c, r)] === 0) setTile(map, c, r, 5);
}
function climbableTile(t) {
  return t === 5 || t === 1 || t === 2 || t === 3 || t === 6 || t === 7;
}

function buildMap(w = 1) {
  const map = new Array(COLS * ROWS).fill(0);
  let c, r;
  for (c = 0; c < COLS; c++) { setTile(map, c, ROWS - 1, 4); setTile(map, c, ROWS - 2, 4); }
  for (c = 1; c < 8; c++) setTile(map, c, 9, 4);
  for (c = 12; c < 19; c++) setTile(map, c, 9, 4);
  for (c = 5; c < 15; c++) setTile(map, c, 6, 4);
  for (c = 6; c < 9; c++) setTile(map, c, 3, 4);
  for (c = 11; c < 14; c++) setTile(map, c, 3, 4);
  setTile(map, 10, 0, 6); setTile(map, 10, 1, 1); setTile(map, 10, 2, 3);
  setTile(map, 9, 2, 2); setTile(map, 8, 2, 2); setTile(map, 7, 2, 3);
  setTile(map, 7, 3, 1); setTile(map, 7, 4, 1); setTile(map, 7, 5, 3);
  setTile(map, 6, 5, 2); setTile(map, 5, 5, 2); setTile(map, 4, 5, 3);
  setTile(map, 4, 6, 1); setTile(map, 4, 7, 1); setTile(map, 4, 8, 1);
  setTile(map, 11, 2, 2); setTile(map, 12, 2, 2); setTile(map, 13, 2, 3);
  setTile(map, 13, 3, 1); setTile(map, 13, 4, 1); setTile(map, 13, 5, 3);
  setTile(map, 14, 5, 2); setTile(map, 15, 5, 2); setTile(map, 16, 5, 3);
  setTile(map, 16, 6, 1); setTile(map, 16, 7, 1); setTile(map, 16, 8, 1);
  setTile(map, 10, 3, 1); setTile(map, 10, 4, 1); setTile(map, 10, 5, 1);
  setTile(map, 10, 6, 1); setTile(map, 10, 7, 1); setTile(map, 10, 8, 1);
  setTile(map, 10, 9, 1); setTile(map, 10, 10, 1); setTile(map, 10, 11, 7);
  placeLadder(map, 3, 3, ROWS - 3);
  placeLadder(map, 16, 3, ROWS - 3);
  placeLadder(map, 9, 3, 9);
  placeLadder(map, 11, 3, 9);
  placeLadder(map, 6, 6, ROWS - 3);
  placeLadder(map, 13, 6, ROWS - 3);
  function lt(c, r) { if (tileAt(map, c, r) === 4) setTile(map, c, r, 5); }
  lt(3, 9); lt(3, 6); lt(3, 3); lt(16, 9); lt(16, 6); lt(16, 3);
  lt(9, 6); lt(9, 3); lt(11, 6); lt(11, 3); lt(6, 9); lt(13, 9);
  return map;
}

function pipeCells(map) {
  const list = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const t = tileAt(map, c, r);
      if (t === 1 || t === 2 || t === 3) list.push({ c, r, t });
    }
  return list;
}

function rectSolid(map, x, y, w, h) {
  const c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 0.1) / TILE);
  const r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 0.1) / TILE);
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++)
      if (tileAt(map, c, r) === 4) return true;
  return false;
}

function onLadder(map, x, y, w, h) {
  const cx = Math.floor((x + w / 2) / TILE);
  const r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 1) / TILE);
  for (let r = r0; r <= r1; r++) if (climbableTile(tileAt(map, cx, r))) return true;
  return false;
}

function nearLeak(p, leak) {
  const px = p.x + BAL.playerW / 2, py = p.y + BAL.playerH / 2;
  const lx = leak.c * TILE + 8, ly = leak.r * TILE + 8;
  let dx = px - lx, dy = py - ly;
  if (dy > 0 && dy < 18) dy *= 0.55;
  return dx * dx + dy * dy < BAL.nearR * BAL.nearR;
}

function step(map, p, keys) {
  const ladder = onLadder(map, p.x, p.y, BAL.playerW, BAL.playerH);
  const jumpPressed = keys.up && !p.prevUp;
  p.prevUp = keys.up;
  if (jumpPressed) p.jumpBuf = BAL.jumpBufMax;
  else if (p.jumpBuf > 0) p.jumpBuf--;
  if (p.onGround) p.coyote = BAL.coyoteMax;
  else if (p.coyote > 0) p.coyote--;

  p.vx = 0;
  if (keys.left) p.vx = -BAL.moveSpeed;
  if (keys.right) p.vx = BAL.moveSpeed;

  if (ladder) {
    p.vy = 0;
    if (keys.up) p.vy = -BAL.climbSpeed;
    if (keys.down) p.vy = BAL.climbSpeed;
  } else {
    p.vy += BAL.gravity;
    if (p.vy > BAL.maxFall) p.vy = BAL.maxFall;
    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = BAL.jumpVel; p.jumpBuf = 0; p.coyote = 0; p.onGround = false;
    }
  }
  p.x += p.vx;
  if (p.x < 2) p.x = 2;
  if (p.x > W - 14) p.x = W - 14;
  if (rectSolid(map, p.x, p.y, BAL.playerW, BAL.playerH)) p.x -= p.vx;

  p.y += p.vy;
  p.onGround = false;
  if (rectSolid(map, p.x, p.y, BAL.playerW, BAL.playerH)) {
    if (p.vy > 0) {
      p.y = Math.floor((p.y + BAL.playerH) / TILE) * TILE - BAL.playerH;
      p.onGround = true;
    } else if (p.vy < 0) {
      p.y = Math.floor(p.y / TILE) * TILE + TILE;
    }
    p.vy = 0;
  }
  if (p.y > H - 16) { p.y = H - 16; p.vy = 0; p.onGround = true; }
  if (p.y < 0) { p.y = 0; if (p.vy < 0) p.vy = 0; }
}

const map = buildMap(1);
const pipes = pipeCells(map);
console.log('pipes', pipes.length);

// Test A: teleport next to each pipe and fix
let teleportOk = 0;
for (const cell of pipes) {
  const p = { x: cell.c * TILE + 2, y: cell.r * TILE, vx: 0, vy: 0, onGround: false, coyote: 0, jumpBuf: 0, prevUp: false };
  let prog = 0;
  for (let i = 0; i < 50; i++) {
    // stay put, fix if near
    if (nearLeak(p, cell)) prog += BAL.fixRate;
  }
  if (prog >= 1) teleportOk++;
  else {
    // try stand below
    const p2 = { x: cell.c * TILE + 2, y: (cell.r + 1) * TILE - BAL.playerH, vx: 0, vy: 0, onGround: true, coyote: 0, jumpBuf: 0, prevUp: false };
    prog = 0;
    for (let i = 0; i < 50; i++) if (nearLeak(p2, cell)) prog += BAL.fixRate;
    if (prog >= 1) teleportOk++;
    else console.log('TELEPORT FAIL', cell, 'near?', nearLeak(p, cell), nearLeak(p2, cell));
  }
}
console.log('teleport fix OK', teleportOk + '/' + pipes.length);

// Test B: from start, climb to (10,2) then left to (7,2)
{
  const p = {
    x: 10 * TILE + 2, y: (ROWS - 3) * TILE,
    vx: 0, vy: 0, onGround: true, coyote: 0, jumpBuf: 0, prevUp: false
  };
  const log = [];
  for (let i = 0; i < 200; i++) {
    const keys = { left: false, right: false, up: true, down: false };
    step(map, p, keys);
    if (i % 20 === 0) log.push({ i, x: p.x | 0, y: p.y | 0, ladder: onLadder(map, p.x, p.y, 12, 14) });
  }
  console.log('climb center 200f', log);
  // then go left at top
  for (let i = 0; i < 120; i++) {
    step(map, p, { left: true, right: false, up: true, down: false });
  }
  console.log('after left', { x: p.x | 0, y: p.y | 0, col: Math.floor((p.x + 6) / TILE), row: Math.floor((p.y + 7) / TILE) });
  const target = { c: 7, r: 2 };
  console.log('near 7,2?', nearLeak(p, target));
}

// Test C: BFS on climb graph (tile connectivity)
function neighbors(c, r) {
  const n = [];
  const t = tileAt(map, c, r);
  const can = climbableTile(t) || t === 0;
  // from climbable, move to adjacent climbable or empty above platform
  for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const nc = c + dc, nr = r + dr;
    if (!inBounds(nc, nr)) continue;
    const nt = tileAt(map, nc, nr);
    if (nt === 4) continue;
    if (climbableTile(nt) || nt === 0) n.push([nc, nr]);
  }
  // also stand on platform tops as walkable nodes (row above solid)
  return n;
}

function bfs(sc, sr, tc, tr) {
  const q = [[sc, sr]];
  const seen = new Set([sc + ',' + sr]);
  let guard = 0;
  while (q.length && guard++ < 5000) {
    const [c, r] = q.shift();
    if (c === tc && r === tr) return true;
    // also accept being adjacent
    if (Math.abs(c - tc) + Math.abs(r - tr) === 0) return true;
    for (const [nc, nr] of neighbors(c, r)) {
      const k = nc + ',' + nr;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push([nc, nr]);
    }
  }
  return false;
}

// start from floor positions under climbables
let graphOk = 0;
const startCells = [];
for (let c = 0; c < COLS; c++) {
  if (climbableTile(tileAt(map, c, ROWS - 3)) || climbableTile(tileAt(map, c, ROWS - 4)))
    startCells.push([c, ROWS - 3]);
}
startCells.push([10, ROWS - 3]);
console.log('starts', startCells);

for (const cell of pipes) {
  let ok = false;
  for (const [sc, sr] of startCells) {
    if (bfs(sc, sr, cell.c, cell.r)) { ok = true; break; }
  }
  // also bfs from any climbable near floor
  if (!ok) {
    for (let c = 0; c < COLS; c++) {
      for (let r = ROWS - 5; r < ROWS - 1; r++) {
        if (climbableTile(tileAt(map, c, r)) && bfs(c, r, cell.c, cell.r)) { ok = true; break; }
      }
      if (ok) break;
    }
  }
  if (ok) graphOk++;
  else console.log('GRAPH FAIL', cell);
}
console.log('graph reach', graphOk + '/' + pipes.length);

// print map ascii
const ch = { 0: '.', 1: '|', 2: '-', 3: '+', 4: '#', 5: 'H', 6: 'S', 7: 'D' };
for (let r = 0; r < ROWS; r++) {
  let line = String(r).padStart(2) + ' ';
  for (let c = 0; c < COLS; c++) line += ch[tileAt(map, c, r)] || '?';
  console.log(line);
}
