/** Cheat AI: teleport to leaks — proves balance if player can reach */
import { createRequire } from 'module';
// Inline minimal reusing sim-test logic via dynamic import of functions - not exported.
// Duplicate play loop with teleport.

const TILE = 16, COLS = 20, ROWS = 14, W = 320, H = 224, FPS = 60;
const BAL = {
  moveSpeed: 1.55, climbSpeed: 1.35, gravity: 0.22, maxFall: 3.6,
  jumpVel: -3.55, coyoteMax: 6, jumpBufMax: 8,
  fixRate: 0.028, fixRateWave: 0.0015,
  floodPerLeak: 0.0095, floodPerWave: 0.0018, floodIdleDrain: 0.012,
  firstLeakAt: 100, baseLeakInterval: 220, minLeakInterval: 90,
  leakIntervalWave: 10,
  maxLeaks: (wave) => Math.min(4, 1 + Math.floor((wave - 1) / 2)),
  waveFrames: 60 * 45, nearR: 24, playerW: 12, playerH: 14,
};
const MAX_FRAMES = 60 * 480;

// Pull playGame from sim by reimplementing teleport bot on top of sim-test internals
// Easiest: spawn node evaluating patched sim

import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, 'sim-test.mjs'), 'utf8');

// Patch aiBot skill 3 to teleport
const patched = src
  .replace(
    'if (skill >= 3) {\n    keys.fix = true;',
    `if (skill >= 3) {
    // CHEAT: teleport onto leak and fix
    if (S.leaks.length) {
      let target = S.leaks[0];
      let best = Infinity;
      for (const L of S.leaks) {
        const d = L.progress; // prefer most fixed already
        const score = (1 - L.progress) * 10;
        if (score < best) { best = score; target = L; }
      }
      S.player.x = target.c * TILE + 2;
      S.player.y = target.r * TILE;
      S.player.vy = 0;
      keys.fix = true;
      return keys;
    }
    keys.fix = true;`
  )
  .replace('const N = 1000;', 'const N = 200;')
  .replace('if (i < 100) skill = 0;\n    else if (i < 250) skill = 1;\n    else if (i < 500) skill = 2;\n    else skill = 3; // strong climb AI',
    'skill = 3;')
  .replace("console.log('\\n=== REACHABILITY (oracle to each pipe) ===');",
    "console.log('\\n=== SKIP REACH (cheat run) ==='); const reach=[]; const reachOk=34; if(false){")
  .replace("console.log('reachable pipes:', reachOk + '/' + reach.length);",
    "} console.log('cheat mode 200 games skill3 teleport');");

writeFileSync(join(dir, '_cheat-sim.mjs'), patched);
const r = spawnSync('node', [join(dir, '_cheat-sim.mjs')], { encoding: 'utf8', cwd: dir, timeout: 120000 });
console.log(r.stdout);
if (r.stderr) console.error(r.stderr);
console.log('exit', r.status);
