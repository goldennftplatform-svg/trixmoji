/** Entity factories and update logic */

function createPlayer() {
  return {
    x: 80,
    y: CONFIG.H / 2 - CONFIG.PLAYER_H / 2,
    w: CONFIG.PLAYER_W,
    h: CONFIG.PLAYER_H,
    speedLevel: 0,
    hasMissile: false,
    hasDouble: false,
    hasLaser: false,
    options: 0,
    forceField: false, // ? weapon: rear shot
    shield: 0,
    capsules: 0,
    powerIndex: 0,
    powerReady: false,
    fireCd: 0,
    missileCd: 0,
    invuln: 0,
    alive: true,
    flame: 0,
    optionAngles: [0, Math.PI, Math.PI / 2, -Math.PI / 2],
  };
}

function playerHitbox(p) {
  // tight hitbox on rocket body (not full pilot silhouette)
  return {
    x: p.x + p.w * 0.38,
    y: p.y + p.h * 0.48,
    w: p.w * 0.28,
    h: p.h * 0.28,
  };
}

function playerSpeed(p) {
  return CONFIG.PLAYER_BASE_SPEED + p.speedLevel * CONFIG.PLAYER_SPEED_STEP;
}

function updatePlayer(p, dt) {
  if (!p.alive) return;
  const sp = playerSpeed(p);
  let dx = 0;
  let dy = 0;
  if (KEY.left) dx -= 1;
  if (KEY.right) dx += 1;
  if (KEY.up) dy -= 1;
  if (KEY.down) dy += 1;
  if (dx && dy) {
    dx *= 0.707;
    dy *= 0.707;
  }
  p.x += dx * sp;
  p.y += dy * sp;
  p.x = clamp(p.x, 8, CONFIG.W * 0.55);
  p.y = clamp(p.y, 32, CONFIG.H - p.h - 40);
  if (p.fireCd > 0) p.fireCd--;
  if (p.missileCd > 0) p.missileCd--;
  if (p.invuln > 0) p.invuln--;
  p.flame += 0.4;
  for (let i = 0; i < p.optionAngles.length; i++) {
    p.optionAngles[i] += 0.04;
  }
}

function getOptionPositions(p) {
  const positions = [];
  const count = p.options;
  for (let i = 0; i < count; i++) {
    const a = p.optionAngles[i];
    const ox = p.x + p.w * 0.4 + Math.cos(a) * (18 + i * 4);
    const oy = p.y + p.h * 0.5 + Math.sin(a) * (16 + i * 3);
    // classic Gradius: options trail behind more than orbit
    const trail = [
      { x: p.x - 18, y: p.y - 16 },
      { x: p.x - 18, y: p.y + p.h + 4 },
      { x: p.x - 36, y: p.y - 8 },
      { x: p.x - 36, y: p.y + p.h - 4 },
    ];
    positions.push(trail[i] || { x: ox, y: oy });
  }
  return positions;
}

function playerFire(p, bullets) {
  if (!p.alive || p.fireCd > 0) return;
  const cd = p.hasLaser ? CONFIG.LASER_COOLDOWN : CONFIG.FIRE_COOLDOWN;
  p.fireCd = cd;

  const shots = [];
  // muzzle near rocket nose (lower-right of full pilot+rocket sprite)
  const baseY = p.y + p.h * 0.62;
  const baseX = p.x + p.w * 0.92;

  if (p.hasLaser) {
    shots.push({ x: baseX, y: baseY - 2, w: 48, h: 4, vx: 14, vy: 0, friendly: true, kind: "laser", dmg: 2 });
  } else {
    shots.push({ x: baseX, y: baseY, w: 10, h: 3, vx: 11, vy: 0, friendly: true, kind: "vulcan", dmg: 1 });
  }

  if (p.hasDouble) {
    shots.push({
      x: baseX,
      y: baseY - 2,
      w: 8,
      h: 3,
      vx: 9,
      vy: -5,
      friendly: true,
      kind: "vulcan",
      dmg: 1,
    });
  }

  if (p.forceField) {
    shots.push({
      x: p.x,
      y: baseY,
      w: 8,
      h: 3,
      vx: -9,
      vy: 0,
      friendly: true,
      kind: "vulcan",
      dmg: 1,
    });
  }

  // options copy fire
  const opts = getOptionPositions(p);
  for (const o of opts) {
    if (p.hasLaser) {
      shots.push({ x: o.x + 8, y: o.y, w: 32, h: 3, vx: 12, vy: 0, friendly: true, kind: "laser", dmg: 1 });
    } else {
      shots.push({ x: o.x + 8, y: o.y, w: 8, h: 3, vx: 10, vy: 0, friendly: true, kind: "vulcan", dmg: 1 });
    }
  }

  for (const s of shots) bullets.push(s);

  if (p.hasMissile && p.missileCd <= 0) {
    p.missileCd = CONFIG.MISSILE_COOLDOWN;
    bullets.push({
      x: p.x + p.w * 0.4,
      y: p.y + p.h,
      w: 6,
      h: 4,
      vx: 4,
      vy: 5,
      friendly: true,
      kind: "missile",
      dmg: 2,
      ground: true,
    });
    for (const o of opts) {
      bullets.push({
        x: o.x,
        y: o.y + 4,
        w: 5,
        h: 3,
        vx: 3,
        vy: 4,
        friendly: true,
        kind: "missile",
        dmg: 1,
        ground: true,
      });
    }
  }
}

function applyPower(p) {
  if (!p.powerReady) return false;
  const id = POWER[p.powerIndex].id;
  p.powerReady = false;
  p.capsules = 0;

  switch (id) {
    case "speed":
      p.speedLevel = Math.min(CONFIG.MAX_SPEED_LEVEL, p.speedLevel + 1);
      break;
    case "missile":
      p.hasMissile = true;
      break;
    case "double":
      p.hasDouble = true;
      break;
    case "laser":
      p.hasLaser = true;
      break;
    case "option":
      p.options = Math.min(CONFIG.MAX_OPTIONS, p.options + 1);
      break;
    case "force":
      p.forceField = true;
      break;
    case "shield":
      p.shield = CONFIG.MAX_SHIELD;
      break;
  }
  // advance highlight to next empty-ish slot feel: cycle to start
  p.powerIndex = 0;
  return true;
}

function collectCapsule(p) {
  p.capsules++;
  if (!p.powerReady) {
    p.powerReady = true;
    p.powerIndex = 0;
  } else {
    p.powerIndex = (p.powerIndex + 1) % POWER.length;
  }
}

function resetWeapons(p) {
  p.speedLevel = 0;
  p.hasMissile = false;
  p.hasDouble = false;
  p.hasLaser = false;
  p.options = 0;
  p.forceField = false;
  p.shield = 0;
  p.capsules = 0;
  p.powerReady = false;
  p.powerIndex = 0;
}

// --- Enemies ---

const ENEMY_DEFS = {
  zub: { w: 28, h: 20, hp: 1, score: 100, color: "#4a8", shoot: 0.004 },
  fighter: { w: 32, h: 18, hp: 2, score: 200, color: "#c64", shoot: 0.008 },
  tentacle: { w: 34, h: 34, hp: 4, score: 300, color: "#a4c", shoot: 0.01 },
  asteroid: { w: 36, h: 36, hp: 5, score: 150, color: "#667", shoot: 0 },
  aimed: { w: 30, h: 20, hp: 2, score: 250, color: "#c48", shoot: 0.015, aimed: true },
  turretDebris: { w: 32, h: 26, hp: 6, score: 400, color: "#666", shoot: 0.02, aimed: true },
  bat: { w: 30, h: 22, hp: 2, score: 200, color: "#3a8a3a", shoot: 0.01 },
  dragon: { w: 44, h: 30, hp: 5, score: 500, color: "#2a6a2a", shoot: 0.012 },
  golem: { w: 34, h: 40, hp: 8, score: 400, color: "#8a6a4a", shoot: 0.01, ground: true },
  wallCannon: { w: 28, h: 28, hp: 6, score: 350, color: "#555", shoot: 0.018, aimed: true },
  moai: { w: 38, h: 56, hp: 10, score: 600, color: "#8a8a7a", shoot: 0.02 },
  knight: { w: 28, h: 34, hp: 4, score: 300, color: "#789", shoot: 0.008, ground: true },
  eye: { w: 28, h: 28, hp: 3, score: 250, color: "#fff", shoot: 0.012, aimed: true },
  snake: { w: 56, h: 24, hp: 8, score: 500, color: "#4a8a4a", shoot: 0.01 },
  spore: { w: 22, h: 22, hp: 2, score: 150, color: "#c80", shoot: 0.006, split: true },
  amoeba: { w: 32, h: 32, hp: 4, score: 300, color: "#6a4a8a", shoot: 0.008, split: true },
  helix: { w: 28, h: 28, hp: 3, score: 280, color: "#6cf", shoot: 0.01 },
  leech: { w: 26, h: 18, hp: 2, score: 220, color: "#a46", shoot: 0.01, chase: true },
  racer: { w: 34, h: 16, hp: 2, score: 300, color: "#48f", shoot: 0.005 },
  wallLaser: { w: 24, h: 32, hp: 5, score: 400, color: "#66a", shoot: 0.025 },
  crystal: { w: 28, h: 34, hp: 6, score: 350, color: "#8cf", shoot: 0.01, reflect: true },
  iceDrone: { w: 28, h: 20, hp: 3, score: 250, color: "#8cf", shoot: 0.012 },
  thaw: { w: 32, h: 36, hp: 7, score: 400, color: "#aef", shoot: 0.01, ground: true },
  sporeTurret: { w: 30, h: 30, hp: 7, score: 400, color: "#3a6a3a", shoot: 0.02 },
  vine: { w: 58, h: 22, hp: 6, score: 400, color: "#3a8a3a", shoot: 0.01 },
  seed: { w: 20, h: 20, hp: 1, score: 100, color: "#8a4", shoot: 0.004 },
  drone: { w: 26, h: 18, hp: 2, score: 200, color: "#6ac", shoot: 0.01 },
  gunPod: { w: 28, h: 28, hp: 8, score: 450, color: "#555", shoot: 0.022, aimed: true },
  mech: { w: 38, h: 42, hp: 12, score: 700, color: "#556", shoot: 0.015, ground: true },
  homing: { w: 28, h: 20, hp: 3, score: 400, color: "#f48", shoot: 0.012, homingShot: true },
};

function spawnEnemy(type, form, index, total, level) {
  const def = ENEMY_DEFS[type] || ENEMY_DEFS.zub;
  const hpMul = level.hpMul || 1;
  let x = CONFIG.W + 20 + index * 12;
  let y = CONFIG.H / 2;
  let vx = -1.5 - Math.random() * 0.5;
  let vy = 0;
  let pattern = form;

  switch (form) {
    case "line":
      y = 80 + (index / Math.max(1, total - 1)) * (CONFIG.H - 160);
      break;
    case "v":
      y = CONFIG.H / 2 + (index - total / 2) * 28;
      x += Math.abs(index - total / 2) * 16;
      break;
    case "sine":
      y = CONFIG.H / 2;
      pattern = "sine";
      break;
    case "circle":
      y = CONFIG.H / 2 + Math.sin((index / total) * Math.PI * 2) * 100;
      break;
    case "scatter":
      y = rand(60, CONFIG.H - 80);
      vx = -1.2 - Math.random();
      break;
    case "ground":
      y = CONFIG.H - 70 - def.h;
      vx = -1.0;
      break;
    case "walls":
      y = index % 2 === 0 ? 50 : CONFIG.H - 50 - def.h;
      vx = -1.3;
      break;
    default:
      y = rand(60, CONFIG.H - 80);
  }

  if (type === "racer") vx = -4 - Math.random() * 2;

  return {
    type,
    x,
    y,
    w: def.w,
    h: def.h,
    hp: Math.ceil(def.hp * hpMul),
    maxHp: Math.ceil(def.hp * hpMul),
    score: def.score,
    color: def.color,
    vx,
    vy,
    age: 0,
    pattern,
    shoot: def.shoot,
    aimed: !!def.aimed,
    ground: !!def.ground,
    split: !!def.split,
    chase: !!def.chase,
    homingShot: !!def.homingShot,
    alive: true,
    phaseOff: index * 0.7,
  };
}

function updateEnemy(e, player, level, bullets) {
  e.age++;
  const bm = level.bulletMul || 1;

  if (e.pattern === "sine") {
    e.x += e.vx * (level.scroll || 1);
    e.y = CONFIG.H / 2 + Math.sin(e.age * 0.05 + e.phaseOff) * 110;
  } else if (e.chase && player.alive) {
    e.x += e.vx * 1.2;
    e.y += Math.sign(player.y - e.y) * 1.2;
  } else {
    e.x += e.vx * (0.8 + (level.scroll || 1) * 0.3);
    e.y += e.vy;
  }

  // shooting
  if (e.shoot > 0 && chance(e.shoot * bm) && e.x < CONFIG.W && e.x > 40) {
    fireEnemyShot(e, player, bullets, bm);
  }
}

function fireEnemyShot(e, player, bullets, bm) {
  const cx = e.x;
  const cy = e.y + e.h / 2;
  let vx = -3 * bm;
  let vy = 0;

  if (e.aimed && player.alive) {
    const dx = player.x + player.w / 2 - cx;
    const dy = player.y + player.h / 2 - cy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const spd = 2.8 * bm;
    vx = (dx / d) * spd;
    vy = (dy / d) * spd;
  } else if (e.homingShot && player.alive) {
    const dx = player.x - cx;
    const dy = player.y - cy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    vx = (dx / d) * 2.2 * bm;
    vy = (dy / d) * 2.2 * bm;
  } else if (e.type === "moai") {
    // ring-ish: 3-way
    for (const ang of [-0.4, 0, 0.4]) {
      bullets.push({
        x: cx,
        y: cy,
        w: 6,
        h: 6,
        vx: -3 * bm * Math.cos(ang),
        vy: 3 * bm * Math.sin(ang),
        friendly: false,
        kind: "enemy",
        color: "#fa4",
        dmg: 1,
      });
    }
    return;
  } else if (e.type === "wallLaser" || e.type === "gunPod") {
    bullets.push({
      x: cx - 20,
      y: cy - 1,
      w: 24,
      h: 3,
      vx: -6 * bm,
      vy: 0,
      friendly: false,
      kind: "laser",
      dmg: 1,
    });
    return;
  }

  bullets.push({
    x: cx,
    y: cy,
    w: 6,
    h: 6,
    vx,
    vy,
    friendly: false,
    kind: "enemy",
    color: "#f46",
    dmg: 1,
    homing: e.homingShot,
  });
}

function createBoss(def, level) {
  const hp = Math.ceil(def.hp * (level.hpMul || 1));
  const base = {
    type: def.type,
    bossName: def.name,
    x: CONFIG.W - 220,
    y: CONFIG.H / 2 - 80,
    w: 180,
    h: 160,
    hp,
    maxHp: hp,
    age: 0,
    phase: 0,
    alive: true,
    vx: -0.3,
    vy: 0,
    shootCd: 0,
    heads: [1, 1, 1],
    score: 10000 + level.id * 2000,
  };

  if (def.type === "twinCruiser" || def.type === "dualCore") {
    base.w = 200;
    base.h = 100;
  }
  if (def.type === "bigCore") {
    base.w = 160;
    base.h = 100;
  }
  if (def.type === "finalBeast") {
    base.w = 240;
    base.h = 220;
    base.x = CONFIG.W - 280;
  }
  if (def.type === "rootTitan") {
    base.y = CONFIG.H - 200;
    base.h = 160;
  }
  if (def.type === "gatekeeper") {
    base.w = 120;
    base.h = 280;
    base.y = CONFIG.H / 2 - 140;
  }
  return base;
}

function updateBoss(b, player, level, bullets) {
  if (!b.alive) return;
  b.age++;
  b.x = clamp(b.x, CONFIG.W * 0.45, CONFIG.W - b.w - 10);
  b.y += Math.sin(b.age * 0.03) * 1.2;
  b.y = clamp(b.y, 40, CONFIG.H - b.h - 50);

  if (b.hp < b.maxHp * 0.5) b.phase = 1;
  if (b.hp < b.maxHp * 0.25) b.phase = 2;

  if (b.shootCd > 0) {
    b.shootCd--;
    return;
  }

  const bm = (level.bulletMul || 1) * (1 + b.phase * 0.15);
  const cd = Math.max(20, 50 - b.phase * 10 - level.id);
  b.shootCd = cd;

  const cx = b.x + 20;
  const cy = b.y + b.h / 2;

  // pattern library
  if (b.type === "bigCore" || b.type === "dualCore" || b.type === "twinCruiser") {
    // barrier + aimed
    for (let i = -2; i <= 2; i++) {
      bullets.push({
        x: cx,
        y: cy,
        w: 7,
        h: 7,
        vx: -3.5 * bm,
        vy: i * 1.2 * bm,
        friendly: false,
        kind: "enemy",
        color: "#4af",
        dmg: 1,
      });
    }
    if (b.phase >= 1 && player.alive) {
      const dx = player.x - cx;
      const dy = player.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      bullets.push({
        x: cx,
        y: cy,
        w: 8,
        h: 8,
        vx: (dx / d) * 4 * bm,
        vy: (dy / d) * 4 * bm,
        friendly: false,
        kind: "enemy",
        color: "#f84",
        dmg: 1,
      });
    }
  } else if (b.type === "finalBeast" || b.type === "blindMother" || b.type === "cellCore") {
    const n = 6 + b.phase * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + b.age * 0.02;
      bullets.push({
        x: b.x + b.w * 0.3,
        y: b.y + b.h * 0.5,
        w: 7,
        h: 7,
        vx: Math.cos(a) * 2.5 * bm,
        vy: Math.sin(a) * 2.5 * bm,
        friendly: false,
        kind: "enemy",
        color: "#f4a",
        dmg: 1,
      });
    }
    if (b.phase >= 2) {
      bullets.push({
        x: b.x,
        y: b.y + b.h * 0.5,
        w: 40,
        h: 4,
        vx: -7 * bm,
        vy: 0,
        friendly: false,
        kind: "laser",
        dmg: 1,
      });
    }
  } else if (b.type === "magmaHydra") {
    for (let i = 0; i < 3; i++) {
      if (b.heads[i] <= 0) continue;
      bullets.push({
        x: b.x + 40 + i * 40,
        y: b.y + 30,
        w: 6,
        h: 6,
        vx: -3 * bm,
        vy: Math.sin(b.age * 0.1 + i) * 2,
        friendly: false,
        kind: "enemy",
        color: "#f60",
        dmg: 1,
      });
    }
  } else if (b.type === "gatekeeper") {
    bullets.push({
      x: b.x,
      y: b.y + b.h / 2 + Math.sin(b.age * 0.06) * 40,
      w: 30,
      h: 4,
      vx: -8 * bm,
      vy: 0,
      friendly: false,
      kind: "laser",
      dmg: 1,
    });
  } else {
    // default spread
    for (let i = -1 - b.phase; i <= 1 + b.phase; i++) {
      bullets.push({
        x: cx,
        y: cy,
        w: 6,
        h: 6,
        vx: -3 * bm,
        vy: i * 1.5 * bm,
        friendly: false,
        kind: "enemy",
        color: "#f66",
        dmg: 1,
      });
    }
  }
}
