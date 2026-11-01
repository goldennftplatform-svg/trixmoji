/**
 * DEGEN REGEN — regenerative farming sim (HTML5)
 * Architecture: state → sim tick → render → UI
 * Godot-equivalent: Main scene = this file; crops.js = resource JSON.
 */
(() => {
  "use strict";

  const DATA = window.DEGEN_REGEN_DATA;
  if (!DATA) {
    console.error("Missing DEGEN_REGEN_DATA");
    return;
  }

  const TILE = 32;
  const SAVE_KEY = "degen_regen_save_v2";
  const SAVE_KEY_LEGACY = "degen_regen_save_v1";
  const SEASONS = ["Spring", "Summer", "Fall", "Winter"];

  // ── DOM ──────────────────────────────────────────────────
  const canvas = document.getElementById("farm");
  const ctx = canvas.getContext("2d");
  const stageWrap = document.getElementById("stage-wrap");
  const toolbar = document.getElementById("toolbar");
  const shopEl = document.getElementById("shop");
  const logEl = document.getElementById("log");
  const selInfo = document.getElementById("sel-info");
  const toastEl = document.getElementById("toast");
  const titleOverlay = document.getElementById("title-overlay");
  const helpOverlay = document.getElementById("help-overlay");

  // ── State ────────────────────────────────────────────────
  let state = null;
  let tool = "plant:clover";
  let selected = null; // {x,y}
  let hover = null;
  let running = false;
  let lastTs = 0;
  let animT = 0;
  let toastTimer = 0;
  let particles = [];
  let animals = []; // visual herd entities
  let bees = [];
  let clouds = [];
  let unlocked = new Set(["corn", "clover", "hand", "water", "till"]);

  // FarmVille-style farmer avatar (pixel)
  let farmer = {
    tx: 0,
    ty: 0,
    x: 0,
    y: 0,
    facing: 1, // -1 left, 1 right
    mode: "idle", // idle | walk | work
    workT: 0,
    workMax: 0,
    workTool: null,
    path: [],
    job: null,
    queue: [],
    step: 0,
  };

  function emptyHerd() {
    return { chickens: 0, sheep: 0, cattle: 0 };
  }

  function herdTotal() {
    if (!state || !state.herd) return 0;
    return (state.herd.chickens || 0) + (state.herd.sheep || 0) + (state.herd.cattle || 0);
  }

  function coverTileCount() {
    let n = 0;
    for (const t of state.tiles) {
      if (!t.crop || t.crop === "POLL") continue;
      const c = DATA.crops[t.crop];
      if (c && c.type === "cover") n++;
    }
    return n;
  }

  function defaultState() {
    const s = DATA.starting;
    const tiles = [];
    for (let y = 0; y < s.gridH; y++) {
      for (let x = 0; x < s.gridW; x++) {
        tiles.push(makeTile(x, y, s.soilBase + (Math.random() * 8 - 4)));
      }
    }
    return {
      coins: s.coins,
      debt: s.debt,
      xp: 0,
      level: 1,
      carbon: 0,
      biodiversity: s.biodiversity,
      day: 1,
      season: 0,
      dayProg: 0,
      gridW: s.gridW,
      gridH: s.gridH,
      tiles,
      seeds: { corn: 6, clover: 8 },
      owned: { hand: true, water: true, till: true },
      herd: emptyHerd(),
      chickens: false, // legacy flag kept for save compat
      pollinatorTiles: [],
      cert: 0,
      stats: { harvested: 0, composted: 0, covers: 0, wool: 0, grazed: 0 },
    };
  }

  function makeTile(x, y, soil) {
    return {
      x, y,
      soil: clamp(soil, 5, 100),
      crop: null,
      growth: 0,
      watered: false,
      tilled: false,
      bareFrames: 0,
      mulch: 0,
      lastCrop: null,
      rotation: [],
      grazeHeat: 0, // recent livestock pressure
    };
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function tileAt(x, y) {
    if (x < 0 || y < 0 || x >= state.gridW || y >= state.gridH) return null;
    return state.tiles[y * state.gridW + x];
  }

  function avgSoil() {
    let s = 0;
    for (const t of state.tiles) s += t.soil;
    return s / state.tiles.length;
  }

  function soilLabel(v) {
    if (v < 25) return "Degraded · dust vibes";
    if (v < 45) return "Recovering · don't rug it";
    if (v < 70) return "Healthy · microbes online";
    return "Regen chad soil";
  }

  function hash2(x, y) {
    // deterministic pseudo-noise for tile texture
    let n = x * 374761393 + y * 668265263;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  // ── Logging / toast ──────────────────────────────────────
  function log(msg, cls) {
    const line = document.createElement("div");
    if (cls) line.className = cls;
    line.textContent = msg;
    logEl.prepend(line);
    while (logEl.children.length > 40) logEl.removeChild(logEl.lastChild);
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  // ── Unlock / level ───────────────────────────────────────
  function checkLevel() {
    let lvl = 1;
    for (const L of DATA.levels) {
      if (state.xp >= L.xp) lvl = L.level;
    }
    if (lvl > state.level) {
      state.level = lvl;
      const info = DATA.levels.find((l) => l.level === lvl);
      if (info) {
        for (const u of info.unlock) unlocked.add(u);
        log("LVL " + lvl + " — " + info.msg, "good");
        toast("LEVEL UP " + lvl);
        rebuildToolbar();
        rebuildShop();
      }
    } else {
      state.level = lvl;
    }
    for (const id of unlocked) {
      if (DATA.crops[id] && state.seeds[id] == null) state.seeds[id] = 0;
    }
  }

  function hasUnlock(id) {
    return unlocked.has(id) || state.owned[id];
  }

  // ── Actions ──────────────────────────────────────────────
  function spend(n) {
    if (state.coins < n) {
      toast("Not enough coins");
      return false;
    }
    state.coins -= n;
    return true;
  }

  function plant(tile, cropId) {
    const crop = DATA.crops[cropId];
    if (!crop) return;
    if (!hasUnlock(cropId) && cropId !== "corn" && cropId !== "clover") {
      toast("Locked — grind XP");
      return;
    }
    if (tile.crop) {
      toast("Tile occupied");
      return;
    }
    if ((state.seeds[cropId] || 0) <= 0) {
      toast("No seeds — buy in shop");
      return;
    }

    state.seeds[cropId] -= 1;
    tile.crop = cropId;
    tile.growth = 0;
    tile.watered = !crop.needsWater;
    tile.lastCrop = cropId;
    tile.rotation.push(cropId);
    if (tile.rotation.length > 4) tile.rotation.shift();

    if (state.owned.no_till) {
      tile.soil = clamp(tile.soil + 0.5, 5, 100);
      log("No-till plant " + crop.name, "good");
    } else if (tile.tilled) {
      tile.soil = clamp(tile.soil - 2, 5, 100);
      log("Planted into tilled bed: " + crop.name);
    } else {
      log("Planted " + crop.name);
    }

    if (crop.type === "cover") {
      state.stats.covers += 1;
      state.biodiversity = clamp(state.biodiversity + 0.3, 0, 100);
    }

    const uniq = new Set(tile.rotation).size;
    if (uniq >= 3) {
      tile.soil = clamp(tile.soil + 1.5, 5, 100);
      log("Rotation diversity bonus", "good");
    }

    state.xp += 2;
    checkLevel();
    spawnSprout(tile);
  }

  function harvest(tile) {
    if (!tile.crop) return;
    const crop = DATA.crops[tile.crop];
    if (!crop) return;
    if (tile.growth < 1) {
      toast("Not ready");
      return;
    }

    if (crop.type === "cover") {
      const boost = crop.soilImpact + (state.owned.no_till ? 2 : 0);
      tile.soil = clamp(tile.soil + boost, 5, 100);
      state.carbon += crop.carbon;
      state.biodiversity = clamp(state.biodiversity + crop.biodiversity, 0, 100);
      tile.mulch = 3;
      log("Cover terminated → soil +" + boost.toFixed(0) + " · mulch left", "good");
      toast("Cover → soil gains");
    } else {
      const soilFactor = 0.55 + (tile.soil / 100) * 0.7;
      const waterPenalty = crop.needsWater && !tile.watered ? 0.55 : 1;
      const monoPenalty = tile.rotation.filter((c) => c === crop.id).length >= 3 ? 0.75 : 1;
      let pay = Math.round(
        (crop.harvestMin + Math.random() * (crop.harvestMax - crop.harvestMin)) *
          soilFactor *
          waterPenalty *
          monoPenalty
      );
      // livestock harvest bonus (chickens especially)
      const chickenBonus = 1 + (state.herd.chickens || 0) * (DATA.livestock.chickens.harvestBonus || 0);
      pay = Math.round(pay * chickenBonus);
      if (nearPollinator(tile.x, tile.y)) pay = Math.round(pay * 1.12);

      state.coins += pay;
      state.xp += 5 + Math.floor(pay / 10);
      state.stats.harvested += 1;
      tile.soil = clamp(tile.soil + crop.soilImpact, 5, 100);
      state.carbon = clamp(state.carbon + crop.carbon, 0, 9999);
      state.biodiversity = clamp(state.biodiversity + crop.biodiversity, 0, 100);

      if (state.debt > 0) {
        const payDebt = Math.min(state.debt, Math.floor(pay * 0.25));
        state.debt -= payDebt;
        state.coins -= payDebt;
        if (payDebt) log("Debt payment -" + payDebt, "tip");
      }

      log("Harvest " + crop.emoji + " +" + pay + " coins", "good");
      toast("+" + pay + " coins " + crop.emoji);
      spawnCoins(tile);
    }

    tile.crop = null;
    tile.growth = 0;
    tile.watered = false;
    tile.tilled = false;
    checkLevel();
    checkCert();
  }

  function compost(tile) {
    if (!spend(DATA.tools.compost.cost)) return;
    tile.soil = clamp(tile.soil + 10, 5, 100);
    tile.mulch = Math.max(tile.mulch, 2);
    state.carbon += 1;
    state.stats.composted += 1;
    state.xp += 3;
    log("Compost applied — microbes feasting", "good");
    toast("Compost +soil");
    spawnWorm(tile);
    checkLevel();
  }

  function water(tile) {
    if (!tile.crop) {
      toast("Nothing to water");
      return;
    }
    if (!spend(DATA.tools.water.cost)) return;
    tile.watered = true;
    log("Watered tile");
  }

  function placePollinator(tile) {
    if (!hasUnlock("pollinator") && !state.owned.pollinator) {
      toast("Unlock pollinator strip first");
      return;
    }
    if (!state.owned.pollinator) {
      toast("Buy pollinator in shop");
      return;
    }
    if (tile.crop) {
      toast("Clear crop first");
      return;
    }
    tile.crop = "POLL";
    tile.growth = 1;
    state.biodiversity = clamp(state.biodiversity + 5, 0, 100);
    log("Pollinator strip planted", "good");
    toast("Bees incoming");
    ensureBees();
  }

  function nearPollinator(x, y) {
    for (const t of state.tiles) {
      if (t.crop === "POLL" && Math.abs(t.x - x) + Math.abs(t.y - y) <= 2) return true;
    }
    return false;
  }

  function applyTool(tile, forcedTool) {
    if (!tile) return;
    const t = forcedTool || tool;
    if (t === "harvest") harvest(tile);
    else if (t === "till") {
      if (tile.crop) {
        toast("Clear crop before till");
        return;
      }
      tile.tilled = true;
      tile.soil = clamp(tile.soil - 7, 5, 100);
      state.biodiversity = clamp(state.biodiversity - 0.5, 0, 100);
      log("Tilled — short-term ease, long-term L", "bad");
      spawnDirt(tile);
    } else if (t === "compost") compost(tile);
    else if (t === "water") water(tile);
    else if (t === "pollinator") placePollinator(tile);
    else if (t.startsWith("plant:")) {
      const id = t.split(":")[1];
      plant(tile, id);
    }
    updateUI();
  }

  // ── Livestock ────────────────────────────────────────────
  function syncAnimals() {
    if (!state) return;
    const want = {
      chickens: state.herd.chickens || 0,
      sheep: state.herd.sheep || 0,
      cattle: state.herd.cattle || 0,
    };
    const counts = { chickens: 0, sheep: 0, cattle: 0 };
    animals = animals.filter((a) => {
      counts[a.kind] = (counts[a.kind] || 0) + 1;
      return (want[a.kind] || 0) >= counts[a.kind];
    });
    // recount after filter
    const have = { chickens: 0, sheep: 0, cattle: 0 };
    for (const a of animals) have[a.kind]++;
    for (const kind of ["chickens", "sheep", "cattle"]) {
      while (have[kind] < want[kind]) {
        animals.push(spawnAnimal(kind));
        have[kind]++;
      }
    }
  }

  function spawnAnimal(kind) {
    const tx = Math.floor(Math.random() * state.gridW);
    const ty = Math.floor(Math.random() * state.gridH);
    const p = worldPos(tx, ty);
    return {
      kind,
      tx, ty,
      x: p.x + TILE / 2 + (Math.random() - 0.5) * 10,
      y: p.y + TILE / 2 + (Math.random() - 0.5) * 8,
      facing: Math.random() < 0.5 ? 1 : -1,
      wait: Math.random() * 2,
      step: Math.random() * 10,
      grazeT: 0,
    };
  }

  function pickGrazeTarget(kind) {
    const def = DATA.livestock[kind];
    if (!def) return null;
    const scored = [];
    for (const t of state.tiles) {
      let score = 1 - t.grazeHeat * 0.5;
      if (t.crop === "POLL") score -= 2;
      else if (t.crop && DATA.crops[t.crop]) {
        const c = DATA.crops[t.crop];
        if (c.type === "cover") score += 4 + t.growth;
        else if (c.type === "cash") score += kind === "chickens" ? 1.5 : -1;
      } else {
        score += kind === "chickens" ? 1 : -0.5;
        if (t.mulch > 0) score += 0.5;
      }
      if (def.needsPasture && t.crop === "pasture") score += 5;
      if (t.soil < 25) score -= 1;
      scored.push({ t, score });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 8);
    return top[Math.floor(Math.random() * top.length)].t;
  }

  function updateAnimals(dt) {
    if (!state || !animals.length) return;
    for (const a of animals) {
      a.step += dt * 6;
      a.wait -= dt;
      a.grazeT += dt;

      const target = worldPos(a.tx, a.ty);
      const tx = target.x + TILE / 2;
      const ty = target.y + TILE / 2 + 4;
      const dx = tx - a.x;
      const dy = ty - a.y;
      const d = Math.hypot(dx, dy);
      const speed = a.kind === "cattle" ? 38 : a.kind === "sheep" ? 52 : 70;

      if (d > 2) {
        if (Math.abs(dx) > 0.4) a.facing = dx > 0 ? 1 : -1;
        a.x += (dx / d) * speed * dt;
        a.y += (dy / d) * speed * dt;
      } else if (a.wait <= 0) {
        // graze pulse on arrival
        applyGrazePulse(a);
        const next = pickGrazeTarget(a.kind);
        if (next) {
          a.tx = next.x;
          a.ty = next.y;
        }
        a.wait = 1.2 + Math.random() * 2.5 + (a.kind === "cattle" ? 1 : 0);
      }
    }

    // cool graze heat
    for (const t of state.tiles) {
      if (t.grazeHeat > 0) t.grazeHeat = Math.max(0, t.grazeHeat - dt * 0.08);
    }
  }

  function applyGrazePulse(a) {
    const tile = tileAt(a.tx, a.ty);
    const def = DATA.livestock[a.kind];
    if (!tile || !def) return;

    tile.grazeHeat = clamp(tile.grazeHeat + 0.35, 0, 3);
    const onCover = tile.crop && DATA.crops[tile.crop] && DATA.crops[tile.crop].type === "cover";
    const onPasture = tile.crop === "pasture";
    const bare = !tile.crop || tile.crop === "POLL";

    if (onCover || onPasture) {
      // regenerative rotational graze
      tile.soil = clamp(tile.soil + def.manure * 0.55, 5, 100);
      tile.mulch = Math.max(tile.mulch, 0.8);
      state.carbon = clamp(state.carbon + def.carbon * 0.4, 0, 9999);
      state.biodiversity = clamp(state.biodiversity + def.bio * 0.25, 0, 100);
      // light growth trim (grazing) then rebound mulch
      if (tile.growth > 0.35) tile.growth = clamp(tile.growth - 0.04, 0.2, 1);
      state.stats.grazed += 1;
    } else if (bare) {
      // overgraze bare soil
      tile.soil = clamp(tile.soil - def.overgraze * 0.9, 5, 100);
      if (tile.tilled) tile.soil = clamp(tile.soil - def.overgraze * 0.4, 5, 100);
    } else if (tile.crop && DATA.crops[tile.crop] && DATA.crops[tile.crop].type === "cash") {
      // chickens lightly help pest soil, cattle/sheep nibble cash → bad
      if (a.kind === "chickens") {
        tile.soil = clamp(tile.soil + def.manure * 0.2, 5, 100);
      } else {
        tile.growth = clamp(tile.growth - 0.03, 0, 1);
        tile.soil = clamp(tile.soil - def.overgraze * 0.25, 5, 100);
      }
    }

    // extra pressure if herd >> cover capacity
    const covers = coverTileCount();
    const pressure = herdTotal() / Math.max(1, covers + 1);
    if (pressure > 1.4 && Math.random() < 0.15) {
      tile.soil = clamp(tile.soil - 0.5, 5, 100);
    }
  }

  function livestockPestResist() {
    let r = 0;
    for (const id of ["chickens", "sheep", "cattle"]) {
      const n = state.herd[id] || 0;
      const def = DATA.livestock[id];
      if (def) r += n * (def.pestResist || 0);
    }
    return clamp(r, 0, 0.55);
  }

  function dailyLivestock() {
    const total = herdTotal();
    if (!total) return;

    // wool / herd income
    const sheep = state.herd.sheep || 0;
    if (sheep > 0) {
      const wool = Math.floor(sheep * DATA.livestock.sheep.woolIncome * (0.8 + avgSoil() / 200));
      if (wool > 0) {
        state.coins += wool;
        state.stats.wool += wool;
        log("🐑 Wool haul +" + wool + " coins", "good");
      }
    }

    // cattle carbon stipend when pasture present
    const cattle = state.herd.cattle || 0;
    if (cattle > 0) {
      let pastures = 0;
      for (const t of state.tiles) if (t.crop === "pasture") pastures++;
      if (pastures > 0) {
        const c = Math.floor(cattle * 0.6 + pastures * 0.3);
        state.carbon = clamp(state.carbon + c, 0, 9999);
        log("🐄 Pasture carbon +" + c, "good");
      } else if (Math.random() < 0.4) {
        log("🐄 Cattle restless — plant pasture mix", "bad");
      }
    }

    // overstock warning
    const covers = coverTileCount();
    if (total > covers + 2 && Math.random() < 0.5) {
      log("⚠ Overstocked herd — add covers or you'll overgraze", "bad");
      toast("Herd pressure high");
    }
  }

  function ensureBees() {
    const want = state.tiles.filter((t) => t.crop === "POLL").length * 3 + Math.floor(state.biodiversity / 20);
    while (bees.length < Math.min(12, want)) {
      bees.push({
        x: Math.random() * canvas.width,
        y: 40 + Math.random() * 80,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 20,
        life: 40 + Math.random() * 60,
      });
    }
  }

  function initClouds() {
    clouds = [];
    for (let i = 0; i < 4; i++) {
      clouds.push({
        x: Math.random() * 400,
        y: 8 + Math.random() * 28,
        w: 28 + Math.random() * 36,
        speed: 4 + Math.random() * 8,
      });
    }
  }

  // ── Farmer movement ──────────────────────────────────────
  function resetFarmer() {
    farmer.tx = 0;
    farmer.ty = Math.max(0, state.gridH - 1);
    const p = worldPos(farmer.tx, farmer.ty);
    farmer.x = p.x + TILE / 2;
    farmer.y = p.y + TILE / 2;
    farmer.mode = "idle";
    farmer.path = [];
    farmer.job = null;
    farmer.queue = [];
    farmer.workT = 0;
    farmer.step = 0;
  }

  function enqueueJob(tx, ty, jobTool) {
    farmer.queue.push({ tx, ty, tool: jobTool });
    if (farmer.mode === "idle" && !farmer.job) startNextJob();
  }

  function startNextJob() {
    if (!farmer.queue.length) {
      farmer.mode = "idle";
      farmer.job = null;
      return;
    }
    farmer.job = farmer.queue.shift();
    buildPath(farmer.tx, farmer.ty, farmer.job.tx, farmer.job.ty);
    if (farmer.path.length) {
      farmer.mode = "walk";
    } else {
      beginWork();
    }
  }

  function buildPath(x0, y0, x1, y1) {
    farmer.path = [];
    let x = x0;
    let y = y0;
    while (x !== x1) {
      x += x1 > x ? 1 : -1;
      farmer.path.push({ x, y });
    }
    while (y !== y1) {
      y += y1 > y ? 1 : -1;
      farmer.path.push({ x, y });
    }
  }

  function beginWork() {
    farmer.mode = "work";
    farmer.workTool = farmer.job ? farmer.job.tool : tool;
    farmer.workMax =
      farmer.workTool === "harvest" ? 0.55 :
      farmer.workTool === "till" ? 0.7 :
      farmer.workTool === "compost" ? 0.65 :
      farmer.workTool === "water" ? 0.45 : 0.6;
    farmer.workT = farmer.workMax;
  }

  function updateFarmer(dt) {
    if (!state) return;
    farmer.step += dt * 8;

    if (farmer.mode === "walk" && farmer.path.length) {
      const next = farmer.path[0];
      const target = worldPos(next.x, next.y);
      const tx = target.x + TILE / 2;
      const ty = target.y + TILE / 2 + 2;
      const dx = tx - farmer.x;
      const dy = ty - farmer.y;
      const d = Math.hypot(dx, dy);
      const speed = 110;
      if (d < 3) {
        farmer.x = tx;
        farmer.y = ty;
        farmer.tx = next.x;
        farmer.ty = next.y;
        farmer.path.shift();
        if (!farmer.path.length) beginWork();
      } else {
        if (Math.abs(dx) > 0.5) farmer.facing = dx > 0 ? 1 : -1;
        farmer.x += (dx / d) * speed * dt;
        farmer.y += (dy / d) * speed * dt;
      }
    } else if (farmer.mode === "work") {
      farmer.workT -= dt;
      if (Math.random() < dt * 12 && farmer.job) {
        if (farmer.workTool === "water") {
          particles.push({
            x: farmer.x + farmer.facing * 6,
            y: farmer.y - 4,
            vx: farmer.facing * 0.8,
            vy: 1,
            life: 15,
            color: "#60a0ff",
          });
        } else if (farmer.workTool === "till") {
          particles.push({
            x: farmer.x,
            y: farmer.y + 6,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random(),
            life: 12,
            color: "#8a6040",
          });
        } else if (farmer.workTool === "harvest") {
          particles.push({
            x: farmer.x,
            y: farmer.y - 2,
            vx: (Math.random() - 0.5),
            vy: -1,
            life: 18,
            color: "#ffe066",
          });
        }
      }
      if (farmer.workT <= 0 && farmer.job) {
        const tile = tileAt(farmer.job.tx, farmer.job.ty);
        applyTool(tile, farmer.job.tool);
        farmer.job = null;
        startNextJob();
      }
    } else {
      const p = worldPos(farmer.tx, farmer.ty);
      farmer.x += (p.x + TILE / 2 - farmer.x) * 0.15;
      farmer.y += (p.y + TILE / 2 + 2 - farmer.y) * 0.15;
    }
  }

  function checkCert() {
    const soil = avgSoil();
    if (soil >= 70 && state.biodiversity >= 40 && state.carbon >= 40 && state.debt <= 0 && state.cert < 1) {
      state.cert = 1;
      state.coins += 200;
      log("🏆 REGEN CERT L1 — grants +200 coins", "good");
      toast("REGEN CERTIFIED");
    }
    if (soil >= 85 && state.biodiversity >= 70 && state.carbon >= 100 && herdTotal() >= 3 && state.cert < 2) {
      state.cert = 2;
      state.coins += 500;
      log("🏆 REGEN CERT L2 — full chad farm + herd", "good");
      toast("FULL REGEN CERT");
    }
  }

  // ── Simulation tick ──────────────────────────────────────
  function tick(dt) {
    if (!state) return;
    animT += dt;
    updateFarmer(dt);
    updateAnimals(dt);

    // ambient bees
    for (const b of bees) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.x < 0 || b.x > canvas.width) b.vx *= -1;
      if (b.y < 20 || b.y > canvas.height * 0.6) b.vy *= -1;
    }
    bees = bees.filter((b) => b.life > 0);
    if (state.biodiversity > 30 && Math.random() < dt * 0.4) ensureBees();

    for (const c of clouds) {
      c.x += c.speed * dt;
      if (c.x > canvas.width + 40) c.x = -c.w;
    }

    if (!running) return;
    state.dayProg += dt / 12;
    if (state.dayProg >= 1) {
      state.dayProg = 0;
      state.day += 1;
      if (state.day % 7 === 0) {
        state.season = (state.season + 1) % 4;
        log("Season → " + SEASONS[state.season], "tip");
      }
      dailyLivestock();
      dailyEvents();
    }

    for (const tile of state.tiles) {
      if (!tile.crop && tile.mulch <= 0) {
        tile.bareFrames += dt;
        if (tile.bareFrames > 8) {
          tile.soil = clamp(tile.soil - dt * 0.15, 5, 100);
        }
      } else {
        tile.bareFrames = 0;
      }
      if (tile.mulch > 0) tile.mulch -= dt * 0.05;

      if (!tile.crop || tile.crop === "POLL") continue;
      const crop = DATA.crops[tile.crop];
      if (!crop) continue;

      let rate = 1 / crop.growSec;
      rate *= 0.75 + (tile.soil / 100) * 0.55;
      if (crop.needsWater && !tile.watered) rate *= 0.35;
      if (tile.mulch > 0) rate *= 1.08;
      if (nearPollinator(tile.x, tile.y) && crop.type === "cash") rate *= 1.05;
      // light livestock presence on covers speeds recovery growth slightly
      if (crop.type === "cover" && tile.grazeHeat > 0 && tile.grazeHeat < 1.5) rate *= 1.06;
      if (state.season === 3) rate *= 0.55;

      tile.growth = clamp(tile.growth + rate * dt, 0, 1);

      if (crop.type === "cash" && tile.soil < 20 && crop.needsWater && !tile.watered && Math.random() < dt * 0.02) {
        tile.growth = clamp(tile.growth - 0.15, 0, 1);
      }
    }

    updateUI();
  }

  function dailyEvents() {
    if (Math.random() > 0.35) return;
    const soil = avgSoil();
    const roll = Math.random();
    if (roll < 0.2) {
      let dmg = 0;
      const pestR = livestockPestResist();
      for (const t of state.tiles) {
        if (!t.crop || t.crop === "POLL") continue;
        const cover = DATA.crops[t.crop] && DATA.crops[t.crop].type === "cover";
        const resist = (t.soil / 100) * 0.5 + (cover ? 0.3 : 0) + (state.biodiversity / 200) + pestR;
        if (Math.random() > resist) {
          t.growth = clamp(t.growth - 0.2, 0, 1);
          dmg++;
        }
      }
      const chickNote = (state.herd.chickens || 0) > 0 ? " · chickens fought some" : "";
      log("🐛 Pest wave — " + dmg + " tiles stressed" + (soil > 55 ? " (regen resisted)" : "") + chickNote, dmg > 5 ? "bad" : "tip");
    } else if (roll < 0.36) {
      let hit = 0;
      for (const t of state.tiles) {
        if (!t.crop || t.crop === "POLL") continue;
        const hold = t.soil / 100 + t.mulch * 0.1;
        if (hold < 0.45) {
          t.watered = false;
          t.growth = clamp(t.growth - 0.12, 0, 1);
          hit++;
        }
      }
      log("☀️ Drought — healthy soil held water better. Hit tiles: " + hit, "bad");
    } else if (roll < 0.48) {
      let lost = 0;
      for (const t of state.tiles) {
        if (!t.crop && t.tilled) {
          t.soil = clamp(t.soil - 5, 5, 100);
          lost++;
        }
      }
      if (lost) log("💨 Erosion — bare tilled dirt yeeted (" + lost + ")", "bad");
      else log("💨 Wind event — covers held the line", "good");
    } else if (roll < 0.62) {
      for (const t of state.tiles) {
        if (t.crop && DATA.crops[t.crop] && DATA.crops[t.crop].type === "cover") {
          t.growth = clamp(t.growth + 0.15, 0, 1);
        }
      }
      log("🌧️ Perfect regen rain — covers thrived", "good");
    } else if (roll < 0.75) {
      const grant = Math.floor(10 + state.carbon * 0.8);
      state.coins += grant;
      log("📜 Carbon credit drop +" + grant + " coins", "good");
      toast("Carbon credits +" + grant);
    } else if (roll < 0.88 && herdTotal() > 0) {
      const boom = Math.floor(8 + herdTotal() * 6 + avgSoil() * 0.2);
      state.coins += boom;
      log("🥩 Livestock boom market +" + boom + " coins", "good");
      toast("Herd payday +" + boom);
    } else {
      const tip = Math.floor(15 + Math.random() * 40);
      state.coins += tip;
      log("🪙 Degen airdrop +" + tip + " — don't leverage the farm", "tip");
    }
  }

  // ── Particles ────────────────────────────────────────────
  function spawnDirt(tile) {
    const p = worldPos(tile.x, tile.y);
    for (let i = 0; i < 6; i++) {
      particles.push({
        x: p.x + 16, y: p.y + 16,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2,
        life: 20, color: "#8a6040",
      });
    }
  }
  function spawnSprout(tile) {
    const p = worldPos(tile.x, tile.y);
    particles.push({ x: p.x + 16, y: p.y + 20, vx: 0, vy: -0.5, life: 25, color: "#60e080" });
  }
  function spawnCoins(tile) {
    const p = worldPos(tile.x, tile.y);
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: p.x + 16, y: p.y + 16,
        vx: (Math.random() - 0.5) * 2,
        vy: -1 - Math.random(),
        life: 30, color: "#ffd060",
      });
    }
  }
  function spawnWorm(tile) {
    const p = worldPos(tile.x, tile.y);
    particles.push({ x: p.x + 10, y: p.y + 22, vx: 0.3, vy: 0, life: 40, color: "#e090a0" });
  }

  function gridOrigin() {
    const w = canvas.width;
    const h = canvas.height;
    const ox = (w - state.gridW * TILE) / 2;
    const oy = 56 + (h - 56 - state.gridH * TILE) / 2;
    return { ox, oy };
  }

  function worldPos(tx, ty) {
    const { ox, oy } = gridOrigin();
    return { x: ox + tx * TILE, y: oy + ty * TILE };
  }

  // ── Render ───────────────────────────────────────────────
  function resizeCanvas() {
    canvas.width = Math.max(380, state.gridW * TILE + 64);
    canvas.height = Math.max(380, state.gridH * TILE + 88);
  }

  function draw() {
    if (!state) return;
    ctx.imageSmoothingEnabled = false;
    const w = canvas.width;
    const h = canvas.height;
    const soil = avgSoil();
    const dayPhase = state.dayProg; // 0..1

    // sky by season + day progress
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    if (state.season === 3) {
      sky.addColorStop(0, "#5a7a98");
      sky.addColorStop(0.4, "#90a8b8");
      sky.addColorStop(1, "#b8c8b0");
    } else if (state.season === 2) {
      sky.addColorStop(0, "#4a88c0");
      sky.addColorStop(0.35, "#d0a060");
      sky.addColorStop(1, soil < 30 ? "#8a7a40" : "#7aaa40");
    } else {
      const top = dayPhase > 0.85 ? "#3a5a90" : "#4aa0e0";
      sky.addColorStop(0, top);
      sky.addColorStop(0.4, dayPhase > 0.85 ? "#7080a8" : "#87ceeb");
      sky.addColorStop(1, soil < 30 ? "#8a9a60" : "#6cbc48");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // sun / moon
    const sunX = w * (0.15 + dayPhase * 0.7);
    const sunY = 18 + Math.sin(dayPhase * Math.PI) * -8;
    if (dayPhase < 0.88) {
      ctx.fillStyle = state.season === 2 ? "#ffb040" : "#ffe060";
      ctx.beginPath();
      ctx.arc(sunX, sunY + 22, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 230, 100, 0.25)";
      ctx.beginPath();
      ctx.arc(sunX, sunY + 22, 16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#e8eef8";
      ctx.beginPath();
      ctx.arc(sunX, 28, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // clouds
    for (const c of clouds) {
      drawCloud(c.x, c.y, c.w);
    }

    // distant hills (layered)
    drawHills(w, soil < 35 ? "#5a6a38" : "#3a8a30", 42, 0.03, 5);
    drawHills(w, soil < 35 ? "#6a7a40" : "#4a9a38", 50, 0.045, 4);

    // ground band under hills
    const groundGrad = ctx.createLinearGradient(0, 48, 0, h);
    groundGrad.addColorStop(0, soil < 35 ? "#5a6830" : "#4a9840");
    groundGrad.addColorStop(1, soil < 35 ? "#3a4820" : "#2a6830");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 58, w, h - 58);

    // grass tufts outside farm
    ctx.fillStyle = soil < 35 ? "#6a7838" : "#50a848";
    for (let i = 0; i < 28; i++) {
      const gx = (hash2(i, 3) * w) | 0;
      const gy = 62 + ((hash2(i, 7) * (h - 80)) | 0);
      ctx.fillRect(gx, gy, 2, 4);
      ctx.fillRect(gx + 2, gy + 1, 2, 3);
    }

    if (soil < 32) stageWrap.classList.add("vhs");
    else stageWrap.classList.remove("vhs");

    const { ox, oy } = gridOrigin();

    drawBarn(ox - 8, oy - 48);
    drawSilo(ox + state.gridW * TILE - 4, oy - 44);
    drawTree(ox - 28, oy + 20, 1);
    drawTree(ox + state.gridW * TILE + 14, oy + state.gridH * TILE - 30, 0.85);

    drawFence(ox, oy, state.gridW * TILE, state.gridH * TILE);

    // dirt path
    ctx.fillStyle = "#c4a060";
    ctx.fillRect(ox + state.gridW * TILE / 2 - 7, oy + state.gridH * TILE, 14, h - (oy + state.gridH * TILE));
    ctx.fillStyle = "#a88850";
    for (let py = oy + state.gridH * TILE; py < h; py += 6) {
      ctx.fillRect(ox + state.gridW * TILE / 2 - 5 + (py % 4), py, 3, 2);
    }

    for (const tile of state.tiles) {
      const x = ox + tile.x * TILE;
      const y = oy + tile.y * TILE;
      drawTile(tile, x, y);
    }

    // soft grid
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= state.gridW; x++) {
      ctx.beginPath();
      ctx.moveTo(ox + x * TILE + 0.5, oy);
      ctx.lineTo(ox + x * TILE + 0.5, oy + state.gridH * TILE);
      ctx.stroke();
    }
    for (let y = 0; y <= state.gridH; y++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + y * TILE + 0.5);
      ctx.lineTo(ox + state.gridW * TILE, oy + y * TILE + 0.5);
      ctx.stroke();
    }

    if (hover) {
      const x = ox + hover.x * TILE;
      const y = oy + hover.y * TILE;
      ctx.strokeStyle = "#b8f060";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    }
    if (selected) {
      const x = ox + selected.x * TILE;
      const y = oy + selected.y * TILE;
      ctx.strokeStyle = "#ffd060";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    }

    if (farmer.path && farmer.path.length) {
      ctx.fillStyle = "rgba(255, 255, 100, 0.45)";
      for (const p of farmer.path) {
        ctx.fillRect(ox + p.x * TILE + 13, oy + p.y * TILE + 13, 6, 6);
      }
    }

    // animals (sorted by y for depth)
    const sorted = animals.slice().sort((a, b) => a.y - b.y);
    for (const a of sorted) drawAnimal(a);

    // bees
    for (const b of bees) {
      ctx.fillStyle = "#303030";
      ctx.fillRect(b.x | 0, b.y | 0, 2, 2);
      ctx.fillStyle = "#ffd040";
      ctx.fillRect((b.x | 0) + 1, b.y | 0, 1, 2);
    }

    drawFarmer(farmer.x, farmer.y);

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 30);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
      ctx.globalAlpha = 1;
    }

    // name tag
    ctx.font = "14px VT323, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(farmer.x - 30, farmer.y - 32, 60, 13);
    ctx.fillStyle = "#b8f060";
    ctx.fillText("DEGEN FARMER", farmer.x, farmer.y - 22);

    // herd count chip
    if (herdTotal() > 0) {
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(8, h - 20, 120, 14);
      ctx.fillStyle = "#ffd060";
      ctx.font = "13px VT323, monospace";
      ctx.fillText(
        "🐔" + (state.herd.chickens || 0) + " 🐑" + (state.herd.sheep || 0) + " 🐄" + (state.herd.cattle || 0),
        12,
        h - 9
      );
    }
  }

  function drawCloud(x, y, w) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(x, y + 4, w * 0.7, 8);
    ctx.fillRect(x + w * 0.15, y, w * 0.5, 10);
    ctx.fillRect(x + w * 0.4, y + 3, w * 0.45, 8);
  }

  function drawHills(w, color, baseY, freq, amp) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, baseY + 20);
    for (let x = 0; x <= w; x += 16) {
      ctx.lineTo(x, baseY + Math.sin(x * freq + animT * 0.3) * amp);
    }
    ctx.lineTo(w, 80);
    ctx.lineTo(0, 80);
    ctx.fill();
  }

  function drawTree(x, y, s) {
    ctx.fillStyle = "#5a3a20";
    ctx.fillRect(x + 4 * s, y + 10 * s, 4 * s, 14 * s);
    ctx.fillStyle = "#2a7a30";
    ctx.fillRect(x, y + 2 * s, 12 * s, 12 * s);
    ctx.fillStyle = "#3a9a40";
    ctx.fillRect(x + 2 * s, y, 8 * s, 8 * s);
  }

  function drawBarn(x, y) {
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x + 4, y + 36, 40, 6);
    // body
    ctx.fillStyle = "#b03838";
    ctx.fillRect(x, y + 12, 40, 28);
    // lighter planks
    ctx.fillStyle = "#c84848";
    ctx.fillRect(x + 2, y + 14, 36, 3);
    ctx.fillRect(x + 2, y + 22, 36, 3);
    // roof
    ctx.fillStyle = "#5a2020";
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 14);
    ctx.lineTo(x + 20, y - 2);
    ctx.lineTo(x + 43, y + 14);
    ctx.fill();
    ctx.fillStyle = "#8a3030";
    ctx.beginPath();
    ctx.moveTo(x, y + 14);
    ctx.lineTo(x + 20, y + 2);
    ctx.lineTo(x + 40, y + 14);
    ctx.fill();
    // door
    ctx.fillStyle = "#f0e0a0";
    ctx.fillRect(x + 14, y + 22, 12, 18);
    ctx.fillStyle = "#c0a060";
    ctx.fillRect(x + 19, y + 28, 2, 6);
    // loft window
    ctx.fillStyle = "#f0e0a0";
    ctx.fillRect(x + 16, y + 12, 8, 6);
    // X on door
    ctx.strokeStyle = "#a08040";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 15, y + 24);
    ctx.lineTo(x + 25, y + 38);
    ctx.moveTo(x + 25, y + 24);
    ctx.lineTo(x + 15, y + 38);
    ctx.stroke();
  }

  function drawSilo(x, y) {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x + 2, y + 38, 16, 4);
    ctx.fillStyle = "#9aa8b4";
    ctx.fillRect(x, y + 8, 16, 34);
    ctx.fillStyle = "#7a8a98";
    ctx.fillRect(x + 1, y + 12, 14, 2);
    ctx.fillRect(x + 1, y + 22, 14, 2);
    ctx.fillRect(x + 1, y + 32, 14, 2);
    ctx.fillStyle = "#c04040";
    ctx.fillRect(x + 1, y + 2, 14, 8);
    ctx.fillStyle = "#e06060";
    ctx.fillRect(x + 3, y, 10, 4);
  }

  function drawFence(x, y, w, h) {
    ctx.fillStyle = "#8a6030";
    for (let i = 0; i <= w; i += 16) {
      ctx.fillRect(x + i - 1, y - 8, 3, 10);
      ctx.fillRect(x + i - 1, y + h - 2, 3, 10);
    }
    for (let j = 0; j <= h; j += 16) {
      ctx.fillRect(x - 5, y + j, 7, 3);
      ctx.fillRect(x + w - 2, y + j, 7, 3);
    }
    ctx.fillStyle = "#b08848";
    ctx.fillRect(x, y - 3, w, 2);
    ctx.fillRect(x, y - 7, w, 2);
    ctx.fillRect(x, y + h, w, 2);
    ctx.fillRect(x, y + h + 4, w, 2);
  }

  function drawAnimal(a) {
    const bob = Math.abs(Math.sin(a.step)) * (a.kind === "cattle" ? 1 : 1.5);
    const x = Math.round(a.x);
    const y = Math.round(a.y + bob);
    const f = a.facing;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x - 5, y + 5, a.kind === "cattle" ? 14 : 10, 3);

    if (a.kind === "chickens") {
      ctx.fillStyle = "#f5f0e0";
      ctx.fillRect(x - 3, y - 2, 8, 6);
      ctx.fillStyle = "#e04030";
      ctx.fillRect(x + (f > 0 ? 4 : -4), y - 1, 3, 2);
      ctx.fillStyle = "#303030";
      ctx.fillRect(x + (f > 0 ? 2 : -2), y - 1, 1, 1);
      ctx.fillStyle = "#e8a020";
      ctx.fillRect(x - 2, y + 4, 2, 2);
      ctx.fillRect(x + 2, y + 4, 2, 2);
      // comb
      ctx.fillStyle = "#e03030";
      ctx.fillRect(x, y - 4, 2, 2);
    } else if (a.kind === "sheep") {
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(x - 5, y - 3, 11, 8);
      ctx.fillStyle = "#e0e0e0";
      ctx.fillRect(x - 4, y - 4, 4, 4);
      ctx.fillRect(x + 1, y - 4, 4, 4);
      // head
      ctx.fillStyle = "#d0c8b0";
      ctx.fillRect(x + (f > 0 ? 4 : -7), y - 1, 5, 5);
      ctx.fillStyle = "#202020";
      ctx.fillRect(x + (f > 0 ? 7 : -5), y, 1, 1);
      // legs
      ctx.fillStyle = "#303030";
      ctx.fillRect(x - 3, y + 5, 2, 3);
      ctx.fillRect(x + 2, y + 5, 2, 3);
    } else {
      // cattle
      ctx.fillStyle = "#6a4a30";
      ctx.fillRect(x - 7, y - 4, 16, 9);
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(x - 4, y - 2, 5, 4);
      // head
      ctx.fillStyle = "#5a3a28";
      ctx.fillRect(x + (f > 0 ? 7 : -10), y - 3, 6, 6);
      // snout
      ctx.fillStyle = "#c09080";
      ctx.fillRect(x + (f > 0 ? 11 : -12), y, 3, 2);
      // eye
      ctx.fillStyle = "#202020";
      ctx.fillRect(x + (f > 0 ? 9 : -7), y - 1, 1, 1);
      // legs
      ctx.fillStyle = "#3a2818";
      ctx.fillRect(x - 5, y + 5, 3, 4);
      ctx.fillRect(x + 4, y + 5, 3, 4);
      // horn hint
      ctx.fillStyle = "#e8d0a0";
      ctx.fillRect(x + (f > 0 ? 8 : -8), y - 5, 2, 2);
    }
  }

  function drawFarmer(cx, cy) {
    const f = farmer.facing;
    const walkBob = farmer.mode === "walk" ? Math.abs(Math.sin(farmer.step * 2)) * 2 : 0;
    const workChop = farmer.mode === "work" ? Math.sin((1 - farmer.workT / Math.max(0.01, farmer.workMax)) * Math.PI * 4) * 3 : 0;
    const x = Math.round(cx);
    const y = Math.round(cy + walkBob);

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x - 6, y + 6, 12, 4);

    ctx.fillStyle = "#3a3a60";
    if (farmer.mode === "walk") {
      const swing = Math.sin(farmer.step * 2) * 2;
      ctx.fillRect(x - 4, y + 2, 3, 6 + swing);
      ctx.fillRect(x + 1, y + 2, 3, 6 - swing);
    } else {
      ctx.fillRect(x - 4, y + 2, 3, 6);
      ctx.fillRect(x + 1, y + 2, 3, 6);
    }
    ctx.fillStyle = "#4a3020";
    ctx.fillRect(x - 5, y + 7, 4, 2);
    ctx.fillRect(x + 1, y + 7, 4, 2);

    ctx.fillStyle = "#3a7acc";
    ctx.fillRect(x - 5, y - 8, 10, 11);
    ctx.fillStyle = "#f0d060";
    ctx.fillRect(x - 4, y - 8, 2, 5);
    ctx.fillRect(x + 2, y - 8, 2, 5);

    ctx.fillStyle = "#e8b090";
    if (farmer.mode === "work") {
      ctx.fillRect(x + f * 5, y - 6 + workChop, 3, 7);
      ctx.fillRect(x - f * 4, y - 4, 3, 6);
      drawTool(x + f * 8, y - 4 + workChop, farmer.workTool, f);
    } else {
      ctx.fillRect(x - 7, y - 5, 3, 7);
      ctx.fillRect(x + 4, y - 5, 3, 7);
      drawTool(x + f * 7, y - 2, tool.startsWith("plant") ? "plant" : tool, f);
    }

    ctx.fillStyle = "#f0c8a0";
    ctx.fillRect(x - 4, y - 16, 8, 8);
    ctx.fillStyle = "#e8c84a";
    ctx.fillRect(x - 5, y - 18, 10, 4);
    ctx.fillRect(x - 6, y - 15, 12, 2);
    ctx.fillStyle = "#d0a830";
    ctx.fillRect(x - 3, y - 20, 6, 3);
    ctx.fillStyle = "#202020";
    if (f > 0) ctx.fillRect(x + 1, y - 13, 2, 2);
    else ctx.fillRect(x - 3, y - 13, 2, 2);
    ctx.fillRect(x - 1, y - 10, 3, 1);
  }

  function drawTool(x, y, t, facing) {
    const f = facing || 1;
    if (!t) t = "hand";
    if (t === "water") {
      ctx.fillStyle = "#4080c0";
      ctx.fillRect(x, y, 5, 6);
      ctx.fillStyle = "#60b0ff";
      ctx.fillRect(x + 1, y + 6, 2, 3);
    } else if (t === "till") {
      ctx.fillStyle = "#8a6030";
      ctx.fillRect(x, y - 2, 2, 10);
      ctx.fillStyle = "#808890";
      ctx.fillRect(x - 3, y + 6, 8, 3);
    } else if (t === "compost") {
      ctx.fillStyle = "#6a4020";
      ctx.fillRect(x - 1, y, 6, 5);
      ctx.fillStyle = "#4a8030";
      ctx.fillRect(x, y + 1, 4, 3);
    } else if (t === "harvest") {
      ctx.fillStyle = "#c0c0c8";
      ctx.fillRect(x, y, 2, 9);
      ctx.fillRect(x - 2, y, 6, 2);
    } else if (t === "pollinator") {
      ctx.fillStyle = "#ff80c0";
      ctx.fillRect(x, y + 2, 4, 4);
    } else {
      ctx.fillStyle = "#c07030";
      ctx.fillRect(x - 1, y + 1, 5, 5);
      ctx.fillStyle = "#60c040";
      ctx.fillRect(x + 1, y - 1, 2, 3);
    }
  }

  function drawTile(tile, x, y) {
    const s = tile.soil;
    let r, g, b;
    if (s < 30) {
      r = 90 + s; g = 55; b = 40;
    } else if (s < 60) {
      r = 80; g = 70 + s * 0.5; b = 35;
    } else {
      r = 40; g = 90 + s * 0.4; b = 40;
    }
    if (tile.tilled) {
      r = Math.min(255, r + 20);
      g = Math.max(0, g - 10);
    }
    // base soil
    ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    ctx.fillRect(x, y, TILE, TILE);

    // soil texture speckles
    const n = hash2(tile.x, tile.y);
    ctx.fillStyle = `rgba(0,0,0,${0.06 + n * 0.08})`;
    ctx.fillRect(x + 3 + (n * 10) | 0, y + 5, 2, 2);
    ctx.fillRect(x + 18, y + 14 + ((n * 8) | 0), 2, 1);
    ctx.fillRect(x + 10, y + 22, 3, 1);

    // tilled furrows
    if (tile.tilled) {
      ctx.fillStyle = "rgba(40,25,15,0.25)";
      for (let i = 4; i < TILE; i += 6) {
        ctx.fillRect(x, y + i, TILE, 1);
      }
    }

    // graze heat tint
    if (tile.grazeHeat > 0.4) {
      ctx.fillStyle = `rgba(120, 80, 40, ${Math.min(0.25, tile.grazeHeat * 0.08)})`;
      ctx.fillRect(x, y, TILE, TILE);
    }

    if (tile.mulch > 0) {
      ctx.fillStyle = "rgba(40, 80, 30, 0.35)";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "rgba(30, 60, 20, 0.4)";
      ctx.fillRect(x + 4, y + 20, 6, 2);
      ctx.fillRect(x + 18, y + 24, 8, 2);
    }

    if (s < 25 && Math.random() < 0.015) {
      ctx.fillStyle = Math.random() < 0.5 ? "#ff2060" : "#20ffc0";
      ctx.fillRect(x + Math.random() * 28, y + Math.random() * 28, 2, 2);
    }

    if (s > 65 && (tile.x + tile.y + Math.floor(animT * 2)) % 17 === 0) {
      ctx.fillStyle = "#e8a0b0";
      ctx.fillRect(x + 8, y + 22, 3, 2);
    }

    if (tile.crop === "POLL") {
      const cols = ["#ff80c0", "#ffe060", "#80c0ff", "#c080ff"];
      for (let i = 0; i < 5; i++) {
        const fx = x + 4 + (i % 3) * 9;
        const fy = y + 6 + Math.floor(i / 3) * 12 + Math.sin(animT * 2 + i) * 1;
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(fx, fy, 5, 5);
        ctx.fillStyle = "#fff8a0";
        ctx.fillRect(fx + 1, fy + 1, 2, 2);
      }
      // stem
      ctx.fillStyle = "#40a040";
      ctx.fillRect(x + 14, y + 18, 2, 8);
      return;
    }

    if (!tile.crop) return;
    const crop = DATA.crops[tile.crop];
    if (!crop) return;
    const stage = Math.min(3, Math.floor(tile.growth * 4));
    drawCropSprite(crop, stage, x, y);

    if (crop.needsWater && !tile.watered && stage < 3) {
      ctx.fillStyle = "#4080ff";
      ctx.fillRect(x + 2, y + 2, 3, 4);
      ctx.fillStyle = "rgba(80,140,255,0.5)";
      ctx.fillRect(x + 3, y + 6, 1, 2);
    }
  }

  function drawCropSprite(crop, stage, x, y) {
    const col = crop.color[stage] || crop.color[0];
    const id = crop.id;

    if (stage === 0) {
      ctx.fillStyle = col;
      ctx.fillRect(x + 14, y + 22, 4, 4);
      return;
    }

    // stem always
    ctx.fillStyle = stage >= 2 ? col : "#4a8030";
    if (id === "corn") {
      ctx.fillStyle = "#3a7028";
      ctx.fillRect(x + 14, y + (stage === 1 ? 16 : stage === 2 ? 10 : 4), 4, stage === 1 ? 10 : stage === 2 ? 16 : 22);
      if (stage >= 2) {
        ctx.fillStyle = "#4a9030";
        ctx.fillRect(x + 8, y + 12, 6, 3);
        ctx.fillRect(x + 18, y + 14, 6, 3);
      }
      if (stage === 3) {
        ctx.fillStyle = "#e8c84a";
        ctx.fillRect(x + 12, y + 6, 8, 10);
        ctx.fillStyle = "#f0e060";
        ctx.fillRect(x + 14, y + 8, 4, 6);
        sparkle(x + 22, y + 6);
      }
    } else if (id === "wheat") {
      ctx.fillStyle = col;
      for (let i = 0; i < (stage + 1); i++) {
        ctx.fillRect(x + 8 + i * 5, y + 18 - stage * 3, 2, 8 + stage * 2);
      }
      if (stage === 3) {
        ctx.fillStyle = "#f5e090";
        for (let i = 0; i < 4; i++) ctx.fillRect(x + 7 + i * 5, y + 8, 3, 4);
        sparkle(x + 24, y + 8);
      }
    } else if (id === "sunflower") {
      ctx.fillStyle = "#3a7020";
      ctx.fillRect(x + 14, y + 12, 4, 14);
      if (stage >= 2) {
        ctx.fillStyle = "#ffcc33";
        ctx.fillRect(x + 10, y + 6, 12, 12);
        ctx.fillStyle = "#5a3a10";
        ctx.fillRect(x + 13, y + 9, 6, 6);
      } else {
        ctx.fillStyle = col;
        ctx.fillRect(x + 12, y + 14, 8, 6);
      }
      if (stage === 3) sparkle(x + 24, y + 6);
    } else if (id === "beans") {
      ctx.fillStyle = col;
      ctx.fillRect(x + 12, y + (22 - stage * 4), 8, 6 + stage * 3);
      ctx.fillRect(x + 8, y + 16, 4, 4);
      ctx.fillRect(x + 20, y + 16, 4, 4);
      if (stage === 3) {
        ctx.fillStyle = "#8a5030";
        ctx.fillRect(x + 10, y + 12, 3, 3);
        ctx.fillRect(x + 18, y + 14, 3, 3);
        sparkle(x + 22, y + 8);
      }
    } else if (crop.type === "cover") {
      // bushy cover carpet
      ctx.fillStyle = col;
      ctx.fillRect(x + 2, y + 18 - stage * 2, 28, 8 + stage * 2);
      ctx.fillStyle = crop.color[Math.min(3, stage + 1)] || col;
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(x + 4 + i * 5, y + 14 - stage, 3, 4 + stage);
      }
      if (stage === 3 && id === "pasture") {
        ctx.fillStyle = "#90e0a0";
        ctx.fillRect(x + 6, y + 10, 4, 4);
        ctx.fillRect(x + 18, y + 12, 4, 3);
      }
    } else {
      // generic / hemp
      ctx.fillStyle = col;
      if (stage === 1) {
        ctx.fillRect(x + 13, y + 16, 6, 10);
        ctx.fillRect(x + 10, y + 14, 4, 4);
        ctx.fillRect(x + 18, y + 14, 4, 4);
      } else if (stage === 2) {
        ctx.fillRect(x + 12, y + 10, 8, 16);
        ctx.fillRect(x + 8, y + 10, 5, 5);
        ctx.fillRect(x + 19, y + 10, 5, 5);
      } else {
        ctx.fillRect(x + 11, y + 6, 10, 20);
        ctx.fillStyle = "#90e0a0";
        ctx.fillRect(x + 12, y + 6, 8, 6);
        sparkle(x + 22, y + 8);
      }
    }
  }

  function sparkle(x, y) {
    if (Math.floor(animT * 6) % 2 === 0) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // ── UI build ─────────────────────────────────────────────
  function rebuildToolbar() {
    toolbar.innerHTML = "";
    const add = (id, label, active) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tool" + (active ? " active" : "");
      b.dataset.tool = id;
      b.textContent = label;
      b.onclick = () => {
        tool = id;
        rebuildToolbar();
        toast(label);
      };
      toolbar.appendChild(b);
    };

    add("harvest", "✂ Harvest", tool === "harvest");
    add("water", "💧 Water", tool === "water");
    if (state.owned.till || unlocked.has("till")) add("till", "☠ Till", tool === "till");
    if (state.owned.compost || unlocked.has("compost") || state.level >= 2) add("compost", "💩 Compost", tool === "compost");
    if (state.owned.pollinator) add("pollinator", "🐝 Pollinator", tool === "pollinator");

    for (const id of Object.keys(DATA.crops)) {
      if (!hasUnlock(id) && !["corn", "clover"].includes(id)) continue;
      const c = DATA.crops[id];
      const n = state.seeds[id] || 0;
      add("plant:" + id, c.emoji + " " + c.name + " (" + n + ")", tool === "plant:" + id);
    }
  }

  function rebuildShop() {
    shopEl.innerHTML = "";
    for (const id of Object.keys(DATA.crops)) {
      if (!hasUnlock(id) && !["corn", "clover"].includes(id)) continue;
      const c = DATA.crops[id];
      const row = document.createElement("div");
      row.className = "shop-item";
      row.innerHTML = `<span>${c.emoji} ${c.name} seed</span><span class="price">${c.seedCost}¢</span>`;
      row.title = c.tip;
      row.onclick = () => {
        if (!spend(c.seedCost)) return;
        state.seeds[id] = (state.seeds[id] || 0) + 1;
        log("Bought " + c.name + " seed");
        rebuildToolbar();
        updateUI();
      };
      shopEl.appendChild(row);
    }

    // tools + livestock
    for (const id of ["no_till", "compost", "chickens", "sheep", "cattle", "pollinator", "expand"]) {
      const t = DATA.tools[id];
      if (!t) continue;
      if (id === "no_till" && !unlocked.has("no_till") && state.level < 3) continue;
      if (id === "chickens" && !unlocked.has("chickens") && state.level < 4) continue;
      if (id === "sheep" && !unlocked.has("sheep") && state.level < 5) continue;
      if (id === "cattle" && !unlocked.has("cattle") && state.level < 6) continue;
      if (id === "pollinator" && !unlocked.has("pollinator") && state.level < 5) continue;
      if (id === "expand" && !unlocked.has("expand") && state.level < 6) continue;
      if (id === "no_till" && state.owned.no_till) continue;
      if (id === "pollinator" && state.owned.pollinator) continue;

      // livestock stock caps
      if (DATA.livestock[id]) {
        const def = DATA.livestock[id];
        const have = state.herd[id] || 0;
        if (have >= def.max) continue;
      }

      const row = document.createElement("div");
      row.className = "shop-item" + (DATA.livestock[id] ? " livestock-item" : "");
      let label = t.name;
      if (DATA.livestock[id]) {
        const have = state.herd[id] || 0;
        label = `${t.name} [${have}/${DATA.livestock[id].max}]`;
      }
      row.innerHTML = `<span>${label}</span><span class="price">${t.cost}¢</span>`;
      row.title = t.tip;
      row.onclick = () => buyUpgrade(id);
      shopEl.appendChild(row);
    }
  }

  function buyUpgrade(id) {
    const t = DATA.tools[id];
    if (!t) return;
    if (DATA.livestock[id]) {
      const def = DATA.livestock[id];
      if (!state.herd) state.herd = emptyHerd();
      if ((state.herd[id] || 0) >= def.max) {
        toast("Herd at max for " + def.name);
        return;
      }
    }
    if (!spend(t.cost)) return;
    if (id === "no_till") {
      state.owned.no_till = true;
      unlocked.add("no_till");
      log("No-till planter unlocked — soil preserved", "good");
      toast("NO-TILL ONLINE");
    } else if (DATA.livestock[id]) {
      buyLivestock(id);
    } else if (id === "pollinator") {
      state.owned.pollinator = true;
      log("Pollinator strip tool ready", "good");
    } else if (id === "expand") {
      expandFarm();
    } else if (id === "compost") {
      log("Compost stocked (use compost tool)");
    }
    rebuildToolbar();
    rebuildShop();
    updateUI();
  }

  function buyLivestock(id) {
    const def = DATA.livestock[id];
    if (!def) return;
    if (!state.herd) state.herd = emptyHerd();
    const have = state.herd[id] || 0;
    if (have >= def.max) return;
    state.herd[id] = have + 1;
    if (id === "chickens") state.chickens = true; // legacy
    state.biodiversity = clamp(state.biodiversity + 3 + def.bio * 2, 0, 100);
    state.xp += 4;
    syncAnimals();
    log(def.emoji + " " + def.name + " joined the farm (" + state.herd[id] + "/" + def.max + ")", "good");
    toast(def.emoji + " " + def.name.toUpperCase());
    checkLevel();
  }

  function expandFarm() {
    const nw = state.gridW + 2;
    const nh = state.gridH + 2;
    const next = [];
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        if (x < state.gridW && y < state.gridH) {
          const t = tileAt(x, y);
          next.push(t || makeTile(x, y, 25));
        } else {
          next.push(makeTile(x, y, 22 + Math.random() * 10));
        }
      }
    }
    next.forEach((t, i) => {
      t.x = i % nw;
      t.y = Math.floor(i / nw);
    });
    state.gridW = nw;
    state.gridH = nh;
    state.tiles = next;
    resizeCanvas();
    log("Farm expanded to " + nw + "×" + nh, "good");
    toast("LAND ACQUIRED");
  }

  function updateUI() {
    if (!state) return;
    const soil = avgSoil();
    document.getElementById("h-coins").textContent = Math.floor(state.coins);
    document.getElementById("h-debt").textContent = Math.floor(state.debt);
    document.getElementById("h-xp").textContent = Math.floor(state.xp) + " / " + state.level;
    const soilEl = document.getElementById("h-soil");
    soilEl.textContent = Math.floor(soil) + "%";
    soilEl.className = "v" + (soil < 30 ? " bad" : soil < 50 ? " warn" : "");
    document.getElementById("h-carbon").textContent = Math.floor(state.carbon);
    document.getElementById("h-bio").textContent = Math.floor(state.biodiversity);
    document.getElementById("h-day").textContent = state.day;
    document.getElementById("h-season").textContent = SEASONS[state.season];

    const herdEl = document.getElementById("h-herd");
    const total = herdTotal();
    herdEl.textContent = total ? String(total) : "—";
    herdEl.className = "v" + (total ? " gold" : "");

    document.getElementById("ls-chickens").textContent = state.herd ? state.herd.chickens || 0 : 0;
    document.getElementById("ls-sheep").textContent = state.herd ? state.herd.sheep || 0 : 0;
    document.getElementById("ls-cattle").textContent = state.herd ? state.herd.cattle || 0 : 0;

    const tipEl = document.getElementById("herd-tip");
    if (!total) {
      tipEl.textContent = "No herd yet — unlock coops & flocks in shop.";
    } else {
      const covers = coverTileCount();
      const pressure = total / Math.max(1, covers);
      if (pressure > 1.4) {
        tipEl.textContent = "⚠ Overstocked vs covers — plant more living roots.";
      } else if ((state.herd.cattle || 0) > 0 && !state.tiles.some((t) => t.crop === "pasture")) {
        tipEl.textContent = "Cattle want pasture mix. Rotate them for carbon.";
      } else {
        tipEl.textContent = "Herd grazing. Keep covers under them for manure magic.";
      }
    }

    document.querySelector("#bar-soil i").style.width = soil + "%";
    document.querySelector("#bar-bio i").style.width = state.biodiversity + "%";
    document.querySelector("#bar-carbon i").style.width = Math.min(100, state.carbon) + "%";
    document.getElementById("soil-label").textContent = soilLabel(soil);

    if (selected) {
      const t = tileAt(selected.x, selected.y);
      if (t) {
        let cropLine = "Empty";
        if (t.crop === "POLL") cropLine = "Pollinator strip";
        else if (t.crop) {
          const c = DATA.crops[t.crop];
          cropLine = c.emoji + " " + c.name + " " + Math.floor(t.growth * 100) + "%";
          if (c.tip) cropLine += "\n💡 " + c.tip;
        }
        const graze = t.grazeHeat > 0.3 ? " · grazed" : "";
        selInfo.innerHTML =
          "<strong>(" + t.x + "," + t.y + ")</strong> soil " + t.soil.toFixed(0) + "% " +
          (t.tilled ? "· TILLED" : "") + (t.mulch > 0 ? " · mulch" : "") + graze +
          "<br>" + cropLine.replace(/\n/g, "<br>");
      }
    }
  }

  // ── Input ────────────────────────────────────────────────
  function canvasTile(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const sy = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const { ox, oy } = gridOrigin();
    const x = Math.floor((sx - ox) / TILE);
    const y = Math.floor((sy - oy) / TILE);
    if (x < 0 || y < 0 || x >= state.gridW || y >= state.gridH) return null;
    return { x, y };
  }

  canvas.addEventListener("pointermove", (e) => {
    if (!state) return;
    hover = canvasTile(e);
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (!state || !running) return;
    const t = canvasTile(e);
    if (!t) return;
    selected = t;
    enqueueJob(t.x, t.y, tool);
  });

  // ── Save / load ──────────────────────────────────────────
  function migrateState(s) {
    if (!s.herd) {
      s.herd = emptyHerd();
      if (s.chickens) s.herd.chickens = Math.max(1, s.herd.chickens || 1);
    }
    if (!s.stats) s.stats = { harvested: 0, composted: 0, covers: 0, wool: 0, grazed: 0 };
    if (s.stats.wool == null) s.stats.wool = 0;
    if (s.stats.grazed == null) s.stats.grazed = 0;
    for (const t of s.tiles || []) {
      if (t.grazeHeat == null) t.grazeHeat = 0;
    }
    return s;
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ state, unlocked: [...unlocked] }));
      toast("Farm saved");
      log("Save OK", "tip");
    } catch (e) {
      toast("Save failed");
    }
  }

  function load() {
    try {
      let raw = localStorage.getItem(SAVE_KEY);
      if (!raw) raw = localStorage.getItem(SAVE_KEY_LEGACY);
      if (!raw) {
        toast("No save");
        return false;
      }
      const data = JSON.parse(raw);
      state = migrateState(data.state);
      unlocked = new Set(data.unlocked || ["corn", "clover", "hand", "water", "till"]);
      // re-apply level unlocks
      for (const L of DATA.levels) {
        if (state.xp >= L.xp) {
          for (const u of L.unlock) unlocked.add(u);
        }
      }
      resizeCanvas();
      resetFarmer();
      syncAnimals();
      ensureBees();
      rebuildToolbar();
      rebuildShop();
      updateUI();
      toast("Save loaded");
      return true;
    } catch (e) {
      toast("Load failed");
      return false;
    }
  }

  function newGame() {
    state = defaultState();
    unlocked = new Set(["corn", "clover", "hand", "water", "till"]);
    selected = null;
    animals = [];
    bees = [];
    resizeCanvas();
    resetFarmer();
    rebuildToolbar();
    rebuildShop();
    log("Welcome to the dumpster farm. Soil is mid-trash. Time to regen.", "tip");
    log("💡 " + DATA.tips[Math.floor(Math.random() * DATA.tips.length)], "tip");
    log("Your degen farmer walks each tile and does the work.", "tip");
    log("Livestock unlock later — graze covers, don't overstock.", "tip");
    updateUI();
  }

  // ── Loop ─────────────────────────────────────────────────
  function loop(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    tick(dt);
    particles = particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life -= 1;
      return p.life > 0;
    });
    draw();
    requestAnimationFrame(loop);
  }

  // ── Boot ─────────────────────────────────────────────────
  document.getElementById("btn-start").onclick = () => {
    newGame();
    running = true;
    titleOverlay.classList.add("hidden");
  };
  document.getElementById("btn-continue").onclick = () => {
    if (load()) {
      running = true;
      titleOverlay.classList.add("hidden");
    }
  };
  document.getElementById("btn-help").onclick = (e) => {
    e.preventDefault();
    helpOverlay.classList.remove("hidden");
  };
  document.getElementById("btn-help-close").onclick = () => helpOverlay.classList.add("hidden");
  document.getElementById("btn-save").onclick = save;
  document.getElementById("btn-load").onclick = () => {
    if (load()) running = true;
  };
  document.getElementById("btn-reset").onclick = () => {
    if (confirm("New farm? Current progress in memory will reset (save first).")) {
      newGame();
      running = true;
      titleOverlay.classList.add("hidden");
    }
  };

  // idle preview
  state = defaultState();
  // demo animals on title screen for vibes
  state.herd = { chickens: 2, sheep: 1, cattle: 0 };
  resizeCanvas();
  resetFarmer();
  initClouds();
  syncAnimals();
  requestAnimationFrame(loop);
})();
