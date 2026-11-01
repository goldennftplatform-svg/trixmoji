/**
 * SNOWMAN BUILDZ GEOFF
 * Platformer: shoot carrots, beat enemies, collect GEOFF components.
 * Levels get longer and harder from easy → hard.
 */

(() => {
  "use strict";

  // ── Constants ──────────────────────────────────────────────
  const W = 960;
  const H = 540;
  const GRAVITY = 0.55;
  const MOVE_SPEED = 4.2;
  const JUMP_V = -11.8;
  const FRICTION = 0.82;
  const MAX_FALL = 14;
  const TILE = 40;
  const CARROT_SPEED = 9;
  const SHOOT_COOLDOWN = 14;
  const MAX_AMMO = 99;
  const START_AMMO = 5;

  const COMPONENTS = [
    { id: "psu", name: "Power Supply", icon: "⚡", slot: "psu", boot: "PSU 850W ONLINE" },
    { id: "mobo", name: "Motherboard", icon: "🔲", slot: "mobo", boot: "MOBO ATX DETECTED" },
    { id: "cpu", name: "Quantum CPU", icon: "🧠", slot: "cpu", boot: "CPU @ 9.2 THz" },
    { id: "ram", name: "Cryo RAM", icon: "💾", slot: "ram", boot: "RAM 2TB CRYO OK" },
    { id: "gpu", name: "Ice GPU", icon: "🖥️", slot: "gpu", boot: "GPU CLUSTER LINKED" },
    { id: "cooler", name: "Absolute Zero Cooler", icon: "❄️", slot: "cooler", boot: "COOLING: 0 K" },
  ];

  // Map legend:
  // # ground  P platform  S spikes  H heater
  // C carrot ammo  @ start  G goal
  // E walker  F flyer  X chaser  B brute (tanky walker)
  // Rows must be same width within a level.
  const LEVELS = [
    {
      name: "Snowy Outskirts",
      difficulty: "EASY",
      blurb: "Learn to move, jump, and shoot carrots. Few threats.",
      bg: ["#1a3048", "#243c50", "#2a4840"],
      map: [
        "........................................",
        "........................................",
        "........................................",
        "........................................",
        "...............C........................",
        "..............PPP...........C...........",
        "........................................",
        ".....C.................C................",
        "....####..........####....PPP.......C...",
        ".................................PPP....",
        "@.........E.................E..........G",
        "####..######....######..######....######",
        "########################################",
      ],
    },
    {
      name: "Frozen Forest",
      difficulty: "EASY+",
      blurb: "More ground, heaters, and heat drones. Stock up on carrots.",
      bg: ["#142838", "#1e3444", "#243c38"],
      map: [
        "..........................................",
        "..........................................",
        "..........................................",
        "..........C.................C.............",
        ".........PPP...............PPP............",
        ".................C........................",
        "....C...........PPP..........H.....C......",
        "...PPP...........................####.....",
        ".........E...............C................",
        ".......####....SS......PPP....E......C....",
        "@................E.................PPP...G",
        "####..######..######..######..######..####",
        "##########################################",
      ],
    },
    {
      name: "Ice Cave Lab",
      difficulty: "MEDIUM",
      blurb: "Flyers appear. Shoot them out of the air.",
      bg: ["#0e1c30", "#162438", "#1a2838"],
      map: [
        "..............................................",
        "..............................................",
        ".............C................................",
        "............PPP.........C..........C..........",
        ".....C.................PPP........PPP.........",
        "....PPP.....F.......................H.........",
        "....................C........F................",
        "........H.........PPP...............C.........",
        "......####.................E......PPP.........",
        "....C.......E....SS....C.................C....",
        "@..PPP................PPP.....E........PPP...G",
        "###....######..######....######..######....###",
        "##############################################",
      ],
    },
    {
      name: "Server Drift",
      difficulty: "MEDIUM+",
      blurb: "Chasers hunt you. Keep moving and lead your shots.",
      bg: ["#101c2c", "#182434", "#1c2838"],
      map: [
        "................................................",
        "................................................",
        "........C.....................C.................",
        ".......PPP.......C...........PPP......C.........",
        "...............PPP...................PPP........",
        "....C.....F..............H......F...............",
        "...####................####............C........",
        "..........C......E...............E....PPP.......",
        "........PPP............X........................",
        "....C.........SS....C......H......C......E......",
        "@..PPP..E.................PPP............PPP...G",
        "###....####..######..####....######..####....###",
        "################################################",
      ],
    },
    {
      name: "Chill Room 7",
      difficulty: "HARD",
      blurb: "Gauntlet of heat, spikes, flyers, and brutes.",
      bg: ["#0c1828", "#142030", "#182438"],
      map: [
        "..................................................",
        "..................................................",
        "...........C.....................C................",
        "..........PPP.......C...........PPP......C........",
        "..................PPP...................PPP.......",
        ".....C......H...........F......H....F.............",
        "....PPP................####...............C.......",
        ".........C......B...............E.......PPP.......",
        ".......PPP...........X......SS....................",
        "....H......E...####......C......H....C......B.....",
        "@..####..SS.........E...PPP............SS..PPP...G",
        "###....######..######....######..######....#######",
        "##################################################",
      ],
    },
    {
      name: "GEOFF Core",
      difficulty: "HARD+",
      blurb: "Final run. Every enemy type. Absolute Zero Cooler awaits.",
      bg: ["#0a1420", "#101c2c", "#142030"],
      map: [
        "....................................................",
        "....................................................",
        ".........C................C...............C.........",
        "........PPP..............PPP.............PPP........",
        "....C........F.................F....H.......C.......",
        "...PPP..............C......................PPP......",
        "........H.........PPP.....B......X....F.............",
        "......####....C.................PPP........C........",
        "....C.....E..PPP....E....SS..............PPP........",
        "...PPP........H......C......B....H....E......C......",
        "@........SS......X......PPP......SS.........PPP....G",
        "####..########..######....######..########...#######",
        "####################################################",
      ],
    },
  ];

  // ── DOM ────────────────────────────────────────────────────
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const panels = {
    title: document.getElementById("title-panel"),
    pause: document.getElementById("pause-panel"),
    clear: document.getElementById("level-clear-panel"),
    over: document.getElementById("game-over-panel"),
    win: document.getElementById("win-panel"),
    howto: document.getElementById("howto-panel"),
  };

  // Where to return after closing how-to
  let howtoReturn = "title";

  const hudLevel = document.getElementById("hud-level");
  const hudLives = document.getElementById("hud-lives");
  const hudCarrots = document.getElementById("hud-carrots");
  const hudDiff = document.getElementById("hud-diff");
  const componentList = document.getElementById("component-list");
  const geoffStatus = document.getElementById("geoff-status");
  const geoffScreen = document.getElementById("geoff-screen");
  const clearMessage = document.getElementById("clear-message");
  const clearComponent = document.getElementById("clear-component");
  const bootLog = document.getElementById("boot-log");
  const finalCarrots = document.getElementById("final-carrots");

  // ── State ──────────────────────────────────────────────────
  const keys = Object.create(null);
  let state = "title"; // title | play | pause | clear | over | win | howto
  let levelIndex = 0;
  let lives = 3;
  let carrots = START_AMMO; // ammo = carrots you can shoot
  let carrotsCollected = 0; // lifetime pickups (score)
  let kills = 0;
  let collected = [];
  let lastRun = null;
  const BOARD_KEY = "snowman_geoff_scores_v1";

  function getArcade() {
    return window.DOSWAPZ_ARCADE || null;
  }

  function getDaily() {
    const A = getArcade();
    return A && A.getDailyChallenge ? A.getDailyChallenge() : null;
  }

  /** Composite score: GEOFF finish is the big prize; kills/carrots/parts count */
  function computeScore(geoffComplete) {
    const parts = collected.length;
    let s = 0;
    s += kills * 100;
    s += carrotsCollected * 15;
    s += parts * 500;
    s += levelIndex * 100;
    if (geoffComplete) s += 5000;
    return s;
  }

  function refreshDailyUI() {
    const d = getDaily();
    const modeEl = document.getElementById("daily-mode");
    const seedEl = document.getElementById("daily-seed");
    if (!d) return;
    if (modeEl) modeEl.textContent = d.mode || "DAILY";
    if (seedEl) seedEl.textContent = "SEED " + d.seed;
  }

  function refreshSoftUI() {
    const A = getArcade();
    if (!A) return;
    const sc = A.loadSoftConnect();
    const h = document.getElementById("sc-handle");
    const a = document.getElementById("sc-alias");
    const st = document.getElementById("sc-status");
    if (h && !h.value && sc.handle) h.value = "@" + sc.handle;
    if (a && !a.value && sc.alias) a.value = sc.alias;
    if (st) {
      const id = A.softIdentity();
      st.textContent = id.linked
        ? "Soft as " + id.tag + " · no wallet · no seed"
        : "Alias only · add @handle · post after run";
    }
  }

  function recordRun(geoffComplete) {
    const score = computeScore(geoffComplete);
    lastRun = {
      score,
      kills,
      carrots: carrotsCollected,
      parts: collected.length,
      geoffComplete: !!geoffComplete,
      level: levelIndex + 1,
      at: Date.now(),
    };
    try {
      const hi = Number(localStorage.getItem("snowman_geoff_high") || 0);
      if (score > hi) localStorage.setItem("snowman_geoff_high", String(score));
    } catch (e) {}

    const overScore = document.getElementById("over-score");
    const overKills = document.getElementById("over-kills");
    const overParts = document.getElementById("over-parts");
    const finalScore = document.getElementById("final-score");
    if (overScore) overScore.textContent = String(score);
    if (overKills) overKills.textContent = String(kills);
    if (overParts) overParts.textContent = String(collected.length);
    if (finalScore) finalScore.textContent = String(score);

    const msg = geoffComplete
      ? "GEOFF 100% · score " + score + " · post soft!"
      : "Run scored " + score + " · " + kills + " kills · post soft";
    const overSt = document.getElementById("over-post-status");
    const winSt = document.getElementById("win-post-status");
    if (overSt) overSt.textContent = msg;
    if (winSt) winSt.textContent = msg;
  }

  function postSoftScore() {
    if (!lastRun) return;
    const A = getArcade();
    if (A) {
      const h = document.getElementById("sc-handle");
      const a = document.getElementById("sc-alias");
      A.saveSoftConnect({
        handle: h ? h.value : "",
        alias: a ? a.value : "DEGEN",
      });
    }
    const soft = A ? A.softIdentity() : { alias: "DEGEN", handle: "", tag: "DEGEN" };
    const daily = getDaily();
    const entry = {
      name: soft.alias,
      handle: soft.handle || "",
      soft: true,
      rulesOk: true,
      score: lastRun.score,
      kills: lastRun.kills,
      carrots: lastRun.carrots,
      parts: lastRun.parts,
      geoffComplete: !!lastRun.geoffComplete,
      level: lastRun.level,
      dailySeed: daily ? daily.seed : "",
      dailyDay: daily ? daily.day : "",
      dailyMode: daily ? daily.mode : "",
      at: Date.now(),
      ts: Date.now(),
    };

    let list = [];
    try {
      if (window.DOSWAPZ_SOFT_SCORE) list = DOSWAPZ_SOFT_SCORE.loadBoard(BOARD_KEY) || [];
      else list = JSON.parse(localStorage.getItem(BOARD_KEY) || "[]");
    } catch (e) {
      list = [];
    }
    if (!Array.isArray(list)) list = [];

    const keyOf = (e) =>
      e.handle ? "h:" + String(e.handle).toLowerCase() : "a:" + String(e.name || e.alias || "");
    const key = keyOf(entry);
    const others = list.filter((e) => keyOf(e) !== key);
    const prior = list.filter((e) => keyOf(e) === key);
    // Prefer keeping a GEOFF complete over a higher incomplete score if both exist
    const bestPrior = prior.reduce((m, e) => {
      if (!m) return e;
      if (e.geoffComplete && !m.geoffComplete) return e;
      if (!e.geoffComplete && m.geoffComplete) return m;
      return e.score > m.score ? e : m;
    }, null);

    let keptOld = false;
    if (!bestPrior) {
      others.push(entry);
    } else if (entry.geoffComplete && !bestPrior.geoffComplete) {
      others.push(entry);
    } else if (!entry.geoffComplete && bestPrior.geoffComplete) {
      others.push(bestPrior);
      keptOld = true;
    } else if (entry.score >= bestPrior.score) {
      others.push(entry);
    } else {
      others.push(bestPrior);
      keptOld = true;
    }
    others.sort((a, b) => {
      const ga = a.geoffComplete ? 1 : 0;
      const gb = b.geoffComplete ? 1 : 0;
      if (gb !== ga) return gb - ga;
      return (b.score || 0) - (a.score || 0) || (b.kills || 0) - (a.kills || 0);
    });
    try {
      localStorage.setItem(BOARD_KEY, JSON.stringify(others.slice(0, 50)));
    } catch (e2) {}

    const msg = keptOld
      ? "Best kept on board"
      : (entry.geoffComplete ? "★ GEOFF finish posted soft!" : "Score posted soft · +DAILY");
    const overSt = document.getElementById("over-post-status");
    const winSt = document.getElementById("win-post-status");
    if (overSt) overSt.textContent = msg;
    if (winSt) winSt.textContent = msg;
  }

  function shareRun() {
    const A = getArcade();
    if (!lastRun) return;
    const daily = getDaily();
    const text = A
      ? A.shareCard({
          game: "SNOWMAN BUILDZ GEOFF",
          score: lastRun.score,
          extra:
            (lastRun.geoffComplete ? "★ GEOFF 100% ONLINE * " : "Parts " + lastRun.parts + "/6 * ") +
            lastRun.kills +
            " kills * " +
            lastRun.carrots +
            " carrots" +
            (daily ? " * +DAILY" : ""),
        })
      : "Snowman scored " + lastRun.score;
    if (A && A.copyText) {
      A.copyText(text).then(function () {});
    }
    if (A && A.tweetUrl) window.open(A.tweetUrl(text), "_blank", "noopener");
  }
  let invuln = 0;
  let flash = 0;
  let shootCd = 0;
  let particles = [];
  let snowflakes = [];
  let projectiles = [];
  let cameraX = 0;
  let animT = 0;

  let player = null;
  let solids = [];
  let hazards = [];
  let pickups = [];
  let enemies = [];
  let goal = null;
  let mapW = 0;
  let mapH = 0;
  let levelBg = ["#0c1a2e", "#1a3048", "#2a4a3a"];
  let levelName = "";
  let levelDiff = "EASY";

  // ── Input ──────────────────────────────────────────────────
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "Escape") {
      if (state === "howto") closeHowto();
      else if (state === "play") setState("pause");
      else if (state === "pause") setState("play");
    }
    if (e.code === "KeyH") {
      if (state === "howto") closeHowto();
      else if (state === "title" || state === "play" || state === "pause") openHowto();
    }
    if (e.code === "KeyR" && (state === "play" || state === "pause")) {
      // keep ammo on restart, refresh level entities
      const keepAmmo = carrots;
      loadLevel(levelIndex);
      carrots = keepAmmo;
      updateHud();
      setState("play");
    }
    // Shoot on keydown for snappy fire (also held-fire in update)
    if (state === "play" && (e.code === "KeyJ" || e.code === "KeyF" || e.code === "ControlLeft" || e.code === "ControlRight")) {
      tryShoot();
    }
  });
  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  // Touch / on-screen controls (mobile)
  const touchMap = {
    left: "ArrowLeft",
    right: "ArrowRight",
    jump: "Space",
    shoot: "KeyJ",
  };
  function bindTouchBtn(btn) {
    const k = btn.getAttribute("data-k");
    const code = touchMap[k];
    if (!code) return;
    const down = (e) => {
      e.preventDefault();
      keys[code] = true;
      btn.classList.add("is-down");
      if (state === "play" && k === "shoot") tryShoot();
    };
    const up = (e) => {
      e.preventDefault();
      keys[code] = false;
      btn.classList.remove("is-down");
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointerleave", up);
    btn.addEventListener("pointercancel", up);
  }
  const touchEl = document.getElementById("touch");
  if (touchEl) {
    touchEl.querySelectorAll("button[data-k]").forEach(bindTouchBtn);
  }

  document.getElementById("btn-start").addEventListener("click", startGame);
  document.getElementById("btn-resume").addEventListener("click", () => setState("play"));
  document.getElementById("btn-quit").addEventListener("click", () => {
    resetProgress();
    setState("title");
  });
  document.getElementById("btn-next").addEventListener("click", () => {
    levelIndex += 1;
    if (levelIndex >= LEVELS.length) {
      winGame();
    } else {
      loadLevel(levelIndex);
      setState("play");
    }
  });
  document.getElementById("btn-retry").addEventListener("click", startGame);
  const btnTitle = document.getElementById("btn-title");
  if (btnTitle) {
    btnTitle.addEventListener("click", () => {
      resetProgress();
      setState("title");
    });
  }
  document.getElementById("btn-replay").addEventListener("click", startGame);
  const btnReplayChase = document.getElementById("btn-replay-chase");
  if (btnReplayChase) {
    btnReplayChase.addEventListener("click", () => {
      if (chaseCtl) chaseCtl.replay();
      else startWinChase();
    });
  }

  const scSave = document.getElementById("sc-save");
  if (scSave) {
    scSave.addEventListener("click", () => {
      const A = getArcade();
      if (!A) return;
      const h = document.getElementById("sc-handle");
      const a = document.getElementById("sc-alias");
      A.saveSoftConnect({ handle: h ? h.value : "", alias: a ? a.value : "DEGEN" });
      refreshSoftUI();
    });
  }
  ["btn-post-over", "btn-post-win"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", postSoftScore);
  });
  ["btn-share-over", "btn-share-win"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", shareRun);
  });

  function openHowto() {
    if (state === "howto") return;
    // Remember screen to restore (play freezes while how-to is open)
    howtoReturn = state === "howto" ? "title" : state;
    setState("howto");
  }

  function closeHowto() {
    const back = howtoReturn || "title";
    if (back === "play" || back === "pause" || back === "clear" || back === "over" || back === "win" || back === "title") {
      setState(back);
    } else {
      setState("title");
    }
  }

  [
    "btn-howto-title",
    "btn-howto-pause",
    "btn-howto-bar",
    "btn-howto-side",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", openHowto);
  });
  const howtoClose = document.getElementById("btn-howto-close");
  if (howtoClose) howtoClose.addEventListener("click", closeHowto);

  // ── UI helpers ─────────────────────────────────────────────
  function setState(s) {
    state = s;
    const showOverlay = s !== "play";
    overlay.classList.toggle("hidden", !showOverlay);
    Object.values(panels).forEach((p) => {
      if (p) p.classList.add("hidden");
    });
    if (s === "title") panels.title.classList.remove("hidden");
    if (s === "pause") panels.pause.classList.remove("hidden");
    if (s === "clear") panels.clear.classList.remove("hidden");
    if (s === "over") panels.over.classList.remove("hidden");
    if (s === "win") panels.win.classList.remove("hidden");
    if (s === "howto" && panels.howto) panels.howto.classList.remove("hidden");
  }

  function updateHud() {
    hudLevel.textContent = String(levelIndex + 1);
    hudLives.textContent = "❤".repeat(Math.max(0, lives)) || "—";
    hudCarrots.textContent = String(carrots);
    if (hudDiff) {
      hudDiff.textContent = levelDiff;
      hudDiff.dataset.diff = levelDiff.replace("+", "p");
    }
  }

  function renderComponentList() {
    componentList.innerHTML = "";
    COMPONENTS.forEach((c, i) => {
      const got = collected.includes(c.id);
      const li = document.createElement("li");
      li.className = got ? "got" : "";
      const diff = LEVELS[i] ? LEVELS[i].difficulty : "";
      li.innerHTML = `
        <span class="icon">${c.icon}</span>
        <span class="name">${c.name}</span>
        <span class="badge">${got ? "OK" : diff || `L${i + 1}`}</span>
      `;
      componentList.appendChild(li);

      const slot = document.querySelector(`.slot[data-slot="${c.slot}"]`);
      if (slot) slot.classList.toggle("filled", got);
    });

    const n = collected.length;
    if (n === 0) {
      geoffStatus.textContent = "Status: OFFLINE";
      geoffScreen.textContent = "—";
      geoffScreen.classList.remove("online");
    } else if (n < COMPONENTS.length) {
      geoffStatus.textContent = `Status: BUILDING (${n}/${COMPONENTS.length})`;
      geoffScreen.textContent = `${n}/${COMPONENTS.length}`;
      geoffScreen.classList.remove("online");
    } else {
      geoffStatus.textContent = "Status: ONLINE";
      geoffScreen.textContent = "GEOFF";
      geoffScreen.classList.add("online");
    }
  }

  function resetProgress() {
    levelIndex = 0;
    lives = 3;
    carrots = START_AMMO;
    carrotsCollected = 0;
    kills = 0;
    collected = [];
    updateHud();
    renderComponentList();
  }

  function startGame() {
    resetProgress();
    loadLevel(0);
    setState("play");
  }

  // ── Enemy factories ────────────────────────────────────────
  function makeEnemy(type, px, py) {
    const base = {
      x: px + 4,
      y: py + 8,
      w: 32,
      h: 32,
      vx: 0,
      vy: 0,
      type,
      hp: 1,
      alive: true,
      hurtFlash: 0,
      minX: px - TILE * 2,
      maxX: px + TILE * 3,
    };

    if (type === "walker") {
      base.vx = 1.35;
      base.hp = 1;
      base.color = "#ff5c5c";
    } else if (type === "flyer") {
      base.y = py - 20;
      base.vx = 1.8;
      base.hp = 1;
      base.color = "#ff9f43";
      base.baseY = base.y;
      base.minX = px - TILE * 3;
      base.maxX = px + TILE * 4;
    } else if (type === "chaser") {
      base.vx = 0;
      base.hp = 2;
      base.speed = 2.1;
      base.color = "#c44dff";
      base.w = 30;
      base.h = 30;
    } else if (type === "brute") {
      base.vx = 0.9;
      base.hp = 3;
      base.w = 40;
      base.h = 40;
      base.y = py;
      base.color = "#ff3355";
      base.minX = px - TILE * 1;
      base.maxX = px + TILE * 4;
    }
    return base;
  }

  // ── Level loading ──────────────────────────────────────────
  function loadLevel(idx) {
    const L = LEVELS[idx];
    levelName = L.name;
    levelDiff = L.difficulty || "—";
    levelBg = L.bg;
    solids = [];
    hazards = [];
    pickups = [];
    enemies = [];
    projectiles = [];
    goal = null;
    particles = [];
    invuln = 0;
    flash = 0;
    shootCd = 0;
    cameraX = 0;
    player = null;

    const rows = L.map;
    mapH = rows.length;
    mapW = rows[0].length;

    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const ch = rows[y][x];
        const px = x * TILE;
        const py = y * TILE;
        if (ch === "#" || ch === "P") {
          solids.push({ x: px, y: py, w: TILE, h: TILE, platform: ch === "P" });
        } else if (ch === "S") {
          hazards.push({ x: px + 4, y: py + 22, w: TILE - 8, h: 18, type: "spike" });
          solids.push({ x: px, y: py + TILE - 8, w: TILE, h: 8, platform: false });
        } else if (ch === "H") {
          hazards.push({ x: px + 6, y: py + 10, w: TILE - 12, h: TILE - 10, type: "heater" });
        } else if (ch === "C") {
          pickups.push({ x: px + 10, y: py + 10, w: 20, h: 20, type: "carrot", alive: true });
        } else if (ch === "E") {
          enemies.push(makeEnemy("walker", px, py));
        } else if (ch === "F") {
          enemies.push(makeEnemy("flyer", px, py));
        } else if (ch === "X") {
          enemies.push(makeEnemy("chaser", px, py));
        } else if (ch === "B") {
          enemies.push(makeEnemy("brute", px, py));
        } else if (ch === "@") {
          player = {
            x: px + 2,
            y: py - 12,
            w: 32,
            h: 52,
            vx: 0,
            vy: 0,
            onGround: false,
            facing: 1,
          };
        } else if (ch === "G") {
          const comp = COMPONENTS[idx];
          goal = {
            x: px + 4,
            y: py - 8,
            w: 32,
            h: 48,
            comp,
            bob: 0,
          };
        }
      }
    }

    if (!player) {
      player = { x: 40, y: 40, w: 32, h: 52, vx: 0, vy: 0, onGround: false, facing: 1 };
    }

    snowflakes = [];
    for (let i = 0; i < 70; i++) {
      snowflakes.push({
        x: Math.random() * mapW * TILE,
        y: Math.random() * H,
        r: 1 + Math.random() * 2,
        s: 0.4 + Math.random() * 1.2,
        drift: Math.random() * Math.PI * 2,
      });
    }

    updateHud();
  }

  // ── Physics helpers ────────────────────────────────────────
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function moveAxis(ent, dx, dy) {
    ent.x += dx;
    ent.y += dy;
    for (const s of solids) {
      if (!rectsOverlap(ent, s)) continue;
      if (s.platform) {
        if (dy > 0 && ent.y + ent.h - dy <= s.y + 4) {
          ent.y = s.y - ent.h;
          ent.vy = 0;
          ent.onGround = true;
        }
        continue;
      }
      if (dx > 0) ent.x = s.x - ent.w;
      if (dx < 0) ent.x = s.x + s.w;
      if (dy > 0) {
        ent.y = s.y - ent.h;
        ent.vy = 0;
        ent.onGround = true;
      }
      if (dy < 0) {
        ent.y = s.y + s.h;
        ent.vy = 0;
      }
    }
  }

  function hurtPlayer() {
    if (invuln > 0) return;
    lives -= 1;
    invuln = 90;
    flash = 12;
    spawnBurst(player.x + player.w / 2, player.y + player.h / 2, "#ff8a5c", 12);
    updateHud();
    if (lives <= 0) {
      recordRun(false);
      setState("over");
      return;
    }
    const L = LEVELS[levelIndex];
    for (let y = 0; y < L.map.length; y++) {
      const x = L.map[y].indexOf("@");
      if (x >= 0) {
        player.x = x * TILE + 2;
        player.y = y * TILE - 12;
        player.vx = 0;
        player.vy = 0;
        break;
      }
    }
  }

  function spawnBurst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 3;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1,
        life: 30 + Math.random() * 20,
        color,
        r: 2 + Math.random() * 2,
      });
    }
  }

  function tryShoot() {
    if (state !== "play" || !player || shootCd > 0) return;
    if (carrots <= 0) {
      // dry-fire puff
      spawnBurst(
        player.x + player.w / 2 + player.facing * 16,
        player.y + 22,
        "#888",
        3
      );
      shootCd = 8;
      return;
    }
    carrots -= 1;
    shootCd = SHOOT_COOLDOWN;
    const dir = player.facing >= 0 ? 1 : -1;
    projectiles.push({
      x: player.x + player.w / 2 + dir * 10,
      y: player.y + 22,
      w: 14,
      h: 10,
      vx: dir * CARROT_SPEED,
      vy: -0.4 + (Math.random() * 0.4 - 0.2),
      life: 70,
      dir,
    });
    spawnBurst(player.x + player.w / 2 + dir * 14, player.y + 22, "#ff9f43", 4);
    updateHud();
  }

  function damageEnemy(e, amount) {
    e.hp -= amount;
    e.hurtFlash = 8;
    spawnBurst(e.x + e.w / 2, e.y + e.h / 2, "#ffcc66", 6);
    if (e.hp <= 0) {
      e.alive = false;
      kills += 1;
      // ammo drop chance on kill
      if (Math.random() < 0.45) {
        pickups.push({
          x: e.x + e.w / 2 - 10,
          y: e.y + e.h / 2 - 10,
          w: 20,
          h: 20,
          type: "carrot",
          alive: true,
        });
      }
      spawnBurst(e.x + e.w / 2, e.y + e.h / 2, e.color || "#ff5c5c", 16);
    }
  }

  function collectGoal() {
    const comp = goal.comp;
    if (!collected.includes(comp.id)) {
      collected.push(comp.id);
    }
    spawnBurst(goal.x + goal.w / 2, goal.y + goal.h / 2, "#7cffb2", 24);
    renderComponentList();
    clearMessage.textContent = `Level ${levelIndex + 1} (${levelDiff}) — ${levelName}. You secured the ${comp.name}!`;
    clearComponent.textContent = `${comp.icon} ${comp.name}`;
    setState("clear");
  }

  let chaseCtl = null;

  function startWinChase() {
    const chaseCv = document.getElementById("chase-cutscene");
    const chaseStatus = document.getElementById("chase-status");
    if (chaseCtl) chaseCtl.stop();
    if (chaseCv && window.GEOFF_CHASE) {
      chaseCtl = window.GEOFF_CHASE.playChaseCutscene(chaseCv, {
        loop: true,
        onDone: null,
      });
    }
    if (chaseStatus) {
      chaseStatus.textContent = "Build GEOFF → it boots → free-range chase.";
    }
  }

  function winGame() {
    finalCarrots.textContent = String(carrotsCollected);
    const killEl = document.getElementById("final-kills");
    if (killEl) killEl.textContent = String(kills);
    const scoreEl = document.getElementById("final-score");
    if (scoreEl) scoreEl.textContent = String(computeScore(true));
    recordRun(true);
    bootLog.textContent = "";
    setState("win");
    startWinChase();
    const lines = [
      "> SNOWMAN BUILD SEQUENCE",
      ...COMPONENTS.map((c) => `> INSTALL ${c.boot}`),
      "> ALL PARTS SEATED",
      "> GEOFF BOOT SEQUENCE v1.0",
      "> SUPERCOMPUTER ONLINE",
      "> HELLO, SNOWMAN. I AM GEOFF.",
      "> WAIT— WHY AM I RUNNING",
      "> CHASE PROTOCOL: COMEDY",
      "> GOTCHA (gently). WANNA BUILD AGAIN?",
    ];
    let i = 0;
    const tick = () => {
      if (state !== "win") return;
      if (i < lines.length) {
        bootLog.textContent += lines[i] + "\n";
        i += 1;
        setTimeout(tick, 380);
      }
    };
    tick();
  }

  // ── Update ─────────────────────────────────────────────────
  function update() {
    if (state !== "play" || !player) return;
    animT += 1;
    if (invuln > 0) invuln -= 1;
    if (flash > 0) flash -= 1;
    if (shootCd > 0) shootCd -= 1;

    // Movement
    let ax = 0;
    if (keys.ArrowLeft || keys.KeyA) ax -= 1;
    if (keys.ArrowRight || keys.KeyD) ax += 1;
    if (ax !== 0) {
      player.vx += ax * 0.9;
      player.facing = ax;
    }
    player.vx *= FRICTION;
    if (Math.abs(player.vx) > MOVE_SPEED) {
      player.vx = Math.sign(player.vx) * MOVE_SPEED;
    }
    if (Math.abs(player.vx) < 0.05) player.vx = 0;

    // Jump (Space / W / Up) — not shoot
    const wantJump = keys.ArrowUp || keys.KeyW || keys.Space;
    if (wantJump && player.onGround) {
      player.vy = JUMP_V;
      player.onGround = false;
      spawnBurst(player.x + player.w / 2, player.y + player.h, "#e8f9ff", 6);
    }

    // Hold-to-fire
    if (keys.KeyJ || keys.KeyF || keys.ControlLeft || keys.ControlRight) {
      tryShoot();
    }

    player.vy += GRAVITY;
    if (player.vy > MAX_FALL) player.vy = MAX_FALL;
    player.onGround = false;

    moveAxis(player, player.vx, 0);
    moveAxis(player, 0, player.vy);

    if (player.x < 0) player.x = 0;
    if (player.x + player.w > mapW * TILE) player.x = mapW * TILE - player.w;
    if (player.y > mapH * TILE + 40) hurtPlayer();

    for (const h of hazards) {
      if (rectsOverlap(player, h)) hurtPlayer();
    }

    // Enemies AI
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.hurtFlash > 0) e.hurtFlash -= 1;

      if (e.type === "walker" || e.type === "brute") {
        e.x += e.vx;
        if (e.x < e.minX || e.x + e.w > e.maxX) e.vx *= -1;
      } else if (e.type === "flyer") {
        e.x += e.vx;
        if (e.x < e.minX || e.x + e.w > e.maxX) e.vx *= -1;
        e.y = e.baseY + Math.sin(animT * 0.08 + e.x * 0.01) * 18;
      } else if (e.type === "chaser") {
        const cx = e.x + e.w / 2;
        const px = player.x + player.w / 2;
        const dir = px > cx ? 1 : -1;
        e.vx = dir * e.speed;
        e.x += e.vx;
        // bob slightly
        e.y += Math.sin(animT * 0.1) * 0.3;
        // clamp to level
        if (e.x < 0) e.x = 0;
        if (e.x + e.w > mapW * TILE) e.x = mapW * TILE - e.w;
      }

      if (rectsOverlap(player, e)) {
        if (player.vy > 0 && player.y + player.h - player.vy <= e.y + 12) {
          damageEnemy(e, 1);
          player.vy = JUMP_V * 0.65;
        } else {
          hurtPlayer();
        }
      }
    }
    enemies = enemies.filter((e) => e.alive);

    // Projectiles
    for (const b of projectiles) {
      b.x += b.vx;
      b.y += b.vy;
      b.life -= 1;

      // hit solid?
      let hitSolid = false;
      for (const s of solids) {
        if (s.platform) continue;
        if (rectsOverlap(b, s)) {
          hitSolid = true;
          break;
        }
      }
      if (hitSolid) {
        b.life = 0;
        spawnBurst(b.x, b.y, "#ff9f43", 5);
        continue;
      }

      for (const e of enemies) {
        if (!e.alive) continue;
        if (rectsOverlap(b, e)) {
          damageEnemy(e, 1);
          b.life = 0;
          break;
        }
      }
    }
    projectiles = projectiles.filter((b) => b.life > 0);

    // Pickups
    for (const p of pickups) {
      if (!p.alive) continue;
      if (rectsOverlap(player, p)) {
        p.alive = false;
        carrots = Math.min(MAX_AMMO, carrots + 1);
        carrotsCollected += 1;
        updateHud();
        spawnBurst(p.x + 10, p.y + 10, "#ff9f43", 8);
      }
    }

    if (goal && rectsOverlap(player, goal)) {
      collectGoal();
    }
    if (goal) goal.bob = Math.sin(animT * 0.08) * 5;

    particles = particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life -= 1;
      return p.life > 0;
    });

    for (const s of snowflakes) {
      s.y += s.s;
      s.x += Math.sin(animT * 0.02 + s.drift) * 0.4;
      if (s.y > H) {
        s.y = -4;
        s.x = cameraX + Math.random() * W;
      }
    }

    const target = player.x + player.w / 2 - W / 2;
    const maxCam = Math.max(0, mapW * TILE - W);
    cameraX += (Math.max(0, Math.min(maxCam, target)) - cameraX) * 0.12;
  }

  // ── Draw ───────────────────────────────────────────────────
  function draw() {
    // flat medium-pixel sky bands
    ctx.fillStyle = levelBg[0];
    ctx.fillRect(0, 0, W, Math.floor(H * 0.35));
    ctx.fillStyle = levelBg[1];
    ctx.fillRect(0, Math.floor(H * 0.35), W, Math.floor(H * 0.35));
    ctx.fillStyle = levelBg[2];
    ctx.fillRect(0, Math.floor(H * 0.7), W, Math.ceil(H * 0.3));

    // chunky distant hills (blocky, not smooth curves)
    ctx.save();
    ctx.translate(-Math.round(cameraX * 0.25), 0);
    ctx.fillStyle = "#1a3040";
    const hillW = mapW * TILE + W;
    for (let x = 0; x < hillW; x += 48) {
      const hy = H - 100 - ((x * 7) % 50);
      ctx.fillRect(x, hy, 48, H - hy);
    }
    ctx.fillStyle = "#243848";
    for (let x = 0; x < hillW; x += 40) {
      const hy = H - 70 - ((x * 11) % 35);
      ctx.fillRect(x, hy, 40, H - hy);
    }
    ctx.restore();

    ctx.save();
    ctx.translate(-Math.round(cameraX), 0);
    ctx.imageSmoothingEnabled = false;

    for (const s of solids) {
      if (s.platform) {
        // ice platform — flat rects only
        ctx.fillStyle = "#5a90a8";
        ctx.fillRect(s.x, s.y, s.w, 12);
        ctx.fillStyle = "#a0d0e0";
        ctx.fillRect(s.x, s.y, s.w, 4);
        ctx.fillStyle = "#3a6070";
        ctx.fillRect(s.x, s.y + 10, s.w, 2);
      } else {
        // snow ground tiles
        ctx.fillStyle = "#3a5a70";
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.fillStyle = "#d8e8f0";
        ctx.fillRect(s.x, s.y, s.w, 10);
        ctx.fillStyle = "#f0f8fc";
        ctx.fillRect(s.x + 2, s.y + 2, s.w - 10, 4);
        ctx.fillStyle = "#2a4050";
        ctx.fillRect(s.x, s.y + s.h - 4, s.w, 4);
        ctx.fillStyle = "#1a2838";
        ctx.fillRect(s.x, s.y, 2, s.h);
      }
    }

    for (const h of hazards) {
      if (h.type === "spike") {
        ctx.fillStyle = "#c8dce8";
        const n = 3;
        const sw = h.w / n;
        for (let i = 0; i < n; i++) {
          ctx.beginPath();
          ctx.moveTo(h.x + i * sw, h.y + h.h);
          ctx.lineTo(h.x + i * sw + sw / 2, h.y);
          ctx.lineTo(h.x + (i + 1) * sw, h.y + h.h);
          ctx.fill();
        }
      } else if (h.type === "heater") {
        const pulse = 0.7 + Math.sin(animT * 0.15) * 0.3;
        ctx.fillStyle = `rgba(255, 100, 60, ${0.25 * pulse})`;
        ctx.beginPath();
        ctx.ellipse(h.x + h.w / 2, h.y + h.h / 2, h.w * 0.9, h.h * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff6b3d";
        ctx.fillRect(h.x, h.y + h.h - 14, h.w, 14);
        ctx.fillStyle = "#ffcc66";
        ctx.fillRect(h.x + 4, h.y + h.h - 20, h.w - 8, 8);
        ctx.strokeStyle = `rgba(255, 180, 80, ${0.4 * pulse})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const ox = Math.sin(animT * 0.1 + i) * 3;
          ctx.beginPath();
          ctx.moveTo(h.x + 6 + i * 8 + ox, h.y + h.h - 24);
          ctx.quadraticCurveTo(h.x + 10 + i * 8, h.y + 4, h.x + 6 + i * 8 - ox, h.y);
          ctx.stroke();
        }
      }
    }

    for (const p of pickups) {
      if (!p.alive) continue;
      const bob = Math.sin(animT * 0.1 + p.x) * 3;
      drawCarrot(p.x, p.y + bob, 1);
    }

    if (goal) {
      drawGoalCrate(goal);
    }

    // Enemies
    for (const e of enemies) {
      drawEnemy(e);
    }

    // Carrot projectiles
    for (const b of projectiles) {
      drawCarrotProjectile(b);
    }

    if (player) drawSnowman(player);

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 40);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const s of snowflakes) {
      const sx = s.x - cameraX;
      if (sx < -10 || sx > W + 10) continue;
      ctx.beginPath();
      ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state === "play" || state === "pause") {
      ctx.fillStyle = "#0c1218";
      ctx.fillRect(12, 12, 340, 46);
      ctx.fillStyle = "#3a5068";
      ctx.fillRect(12, 12, 340, 3);
      ctx.fillRect(12, 55, 340, 3);
      ctx.font = "bold 13px Nunito, sans-serif";
      ctx.fillStyle = "#e8f4fc";
      ctx.textAlign = "left";
      ctx.fillText(`${levelIndex + 1}. ${levelName}`, 22, 32);
      ctx.font = "bold 11px Orbitron, sans-serif";
      const diffColor =
        levelDiff.startsWith("HARD") ? "#e05060" :
        levelDiff.startsWith("MEDIUM") ? "#e8c060" : "#5ce090";
      ctx.fillStyle = diffColor;
      ctx.fillText(levelDiff, 22, 48);

      if (carrots <= 0) {
        ctx.fillStyle = "#e05060";
        ctx.font = "bold 12px Nunito, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("OUT OF CARROTS — grab more!", W / 2, H - 18);
      }
    }

    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 80, 80, ${0.15 * (flash / 12)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawEnemy(e) {
    const pulse = 0.85 + Math.sin(animT * 0.2 + e.x) * 0.15;
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    const flashWhite = e.hurtFlash > 0;

    if (e.type === "flyer") {
      ctx.fillStyle = flashWhite ? "#fff" : `rgba(255, 160, 60, ${0.25 * pulse})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, e.w * 0.7, e.h * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flashWhite ? "#fff" : "#ff9f43";
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fill();
      // wings
      ctx.fillStyle = flashWhite ? "#fff" : "#ffcc88";
      const flap = Math.sin(animT * 0.35) * 6;
      ctx.fillRect(e.x - 4, cy - 2 + flap, 12, 4);
      ctx.fillRect(e.x + e.w - 8, cy - 2 - flap, 12, 4);
      ctx.fillStyle = "#1a1020";
      ctx.fillRect(cx - 5, cy - 3, 3, 3);
      ctx.fillRect(cx + 2, cy - 3, 3, 3);
    } else if (e.type === "chaser") {
      ctx.fillStyle = flashWhite ? "#fff" : `rgba(180, 60, 255, ${0.3 * pulse})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flashWhite ? "#fff" : "#c44dff";
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffe066";
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 2, 3, 0, Math.PI * 2);
      ctx.arc(cx + 4, cy - 2, 3, 0, Math.PI * 2);
      ctx.fill();
      // HP pips
      for (let i = 0; i < e.hp; i++) {
        ctx.fillStyle = "#ff66ee";
        ctx.fillRect(e.x + 4 + i * 8, e.y - 6, 6, 3);
      }
    } else if (e.type === "brute") {
      ctx.fillStyle = flashWhite ? "#fff" : `rgba(255, 40, 70, ${0.25 * pulse})`;
      ctx.fillRect(e.x - 4, e.y - 4, e.w + 8, e.h + 8);
      ctx.fillStyle = flashWhite ? "#fff" : "#ff3355";
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.fillStyle = "#1a1020";
      ctx.fillRect(cx - 10, cy - 6, 6, 6);
      ctx.fillRect(cx + 4, cy - 6, 6, 6);
      ctx.fillStyle = "#ffcc00";
      ctx.fillRect(cx - 6, cy + 6, 12, 4);
      for (let i = 0; i < e.hp; i++) {
        ctx.fillStyle = "#ff6688";
        ctx.fillRect(e.x + 4 + i * 10, e.y - 8, 8, 4);
      }
    } else {
      // walker drone
      ctx.fillStyle = flashWhite ? "#fff" : `rgba(255, 80, 80, ${0.2 * pulse})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flashWhite ? "#fff" : "#ff5c5c";
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffcc00";
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 2, 3, 0, Math.PI * 2);
      ctx.arc(cx + 4, cy - 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff9944";
      ctx.fillRect(e.x + 10, e.y + e.h - 4, 12, 6 + Math.sin(animT * 0.4) * 2);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Medium-pixel GEOFF component crate (goal) */
  function drawGoalCrate(goal) {
    const gy = Math.round(goal.y + (goal.bob || 0));
    const x = Math.round(goal.x);
    ctx.imageSmoothingEnabled = false;

    // glow block
    ctx.fillStyle = "rgba(92, 224, 144, 0.15)";
    ctx.fillRect(x - 6, gy + 40, 44, 10);

    // crate body
    ctx.fillStyle = "#1a3040";
    ctx.fillRect(x, gy + 8, 32, 36);
    ctx.fillStyle = "#2a4858";
    ctx.fillRect(x + 2, gy + 10, 28, 8);
    ctx.fillStyle = "#5ce090";
    ctx.fillRect(x, gy + 8, 32, 3);
    ctx.fillRect(x, gy + 8, 3, 36);
    ctx.fillRect(x + 29, gy + 8, 3, 36);
    ctx.fillRect(x, gy + 41, 32, 3);

    ctx.font = "16px serif";
    ctx.textAlign = "center";
    ctx.fillText(goal.comp.icon, x + 16, gy + 34);

    ctx.fillStyle = "#5ce090";
    ctx.font = "bold 8px Orbitron, monospace";
    ctx.fillText("GEOFF", x + 16, gy + 52);
  }

  function drawCarrot(x, y, scale) {
    const s = scale || 1;
    ctx.save();
    ctx.translate(x + 10 * s, y + 10 * s);
    ctx.rotate(-0.4);
    ctx.fillStyle = "#ff8c2a";
    ctx.beginPath();
    ctx.moveTo(0, -8 * s);
    ctx.lineTo(5 * s, 8 * s);
    ctx.lineTo(-5 * s, 8 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3d8c40";
    ctx.fillRect(-2 * s, -12 * s, 4 * s, 5 * s);
    ctx.restore();
  }

  function drawCarrotProjectile(b) {
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.rotate(b.dir > 0 ? 0.15 : Math.PI - 0.15);
    // pixel carrot bullet
    ctx.fillStyle = "#ff8c2a";
    ctx.fillRect(-8, -3, 14, 6);
    ctx.fillStyle = "#ffaa44";
    ctx.fillRect(-6, -2, 8, 2);
    ctx.fillStyle = "#3d8c40";
    ctx.fillRect(6, -4, 4, 8);
    // motion trail
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#ffb060";
    ctx.fillRect(-14, -2, 6, 4);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /**
   * 90s pixel snowman — based on Ethscriptions portrait
   */
  const SNOWMAN_PALETTE = {
    K: "#140c18",
    D: "#2a1838",
    W: "#fff0f6",
    P: "#ffb8d4",
    L: "#ffe8f4",
    B: "#1a1020",
    O: "#ff6a28",
    M: "#3a1830",
    C: "#40e8ff",
    R: "#ff3a80",
  };

  const SNOWMAN_SPRITE = [
    "......KKKKKK......",
    ".....KKKKKKKK.....",
    ".....KKKKKKKK.....",
    "....KKKKKKKKKK....",
    "....KKKKKKKKKK....",
    "...DDDDDDDDDDDD...",
    "....DDWWWWWWDD....",
    "...DWWLWWWWLWWD...",
    "..CDWWBBWWBBWWRD..",
    "...DWWWWOOWWWWD...",
    "...DWWWWMMWWWWD...",
    "....DWWWWWWWWD....",
    ".....DDWWWWDD.....",
    "....DDWWLWWWDD....",
    "...DWWWWWWWWWWD...",
    "..RDWWWBBWWWWWDC..",
    "...DWWWBBWWWWWD...",
    "...DWWWWPWWWWWD...",
    "....DDWWWWWWDD....",
    "...DDWWWWWWWWDD...",
    "..DWWLWWWWWWLWWD..",
    ".CDWWWWWWWWWWWWRD.",
    "..DWWWWPWWWPWWWD..",
    "..DWWWWWWWWWWWWD..",
    "..DWWWWWWWWWWWWD..",
    "...DWWWWWWWWWWD...",
    "....DDWWWWWWDD....",
    ".....DDDDDDDD.....",
  ];

  let snowmanSpriteCanvas = null;
  let snowmanSpriteFlipCanvas = null;

  function buildSnowmanSpriteCanvases() {
    const rows = SNOWMAN_SPRITE;
    const h = rows.length;
    const w = rows[0].length;
    const scale = 2;

    function paint(flip) {
      const c = document.createElement("canvas");
      c.width = w * scale;
      c.height = h * scale;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = false;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const ch = rows[y][x];
          if (ch === "." || !SNOWMAN_PALETTE[ch]) continue;
          const sx = flip ? w - 1 - x : x;
          g.fillStyle = SNOWMAN_PALETTE[ch];
          g.fillRect(sx * scale, y * scale, scale, scale);
        }
      }
      return c;
    }

    snowmanSpriteCanvas = paint(false);
    snowmanSpriteFlipCanvas = paint(true);
  }

  function drawSnowman(p) {
    const blink = invuln > 0 && Math.floor(invuln / 4) % 2 === 0;
    if (blink) return;

    if (!snowmanSpriteCanvas) buildSnowmanSpriteCanvases();

    const spr = p.facing < 0 ? snowmanSpriteFlipCanvas : snowmanSpriteCanvas;
    const sw = spr.width;
    const sh = spr.height;
    const drawX = Math.round(p.x + p.w / 2 - sw / 2);
    const drawY = Math.round(p.y + p.h - sh);

    ctx.fillStyle = "rgba(20, 10, 30, 0.35)";
    ctx.fillRect(Math.round(p.x + 4), Math.round(p.y + p.h - 4), p.w - 6, 4);

    const glitch = Math.sin(animT * 0.12) > 0.85 ? 1 : 0;
    if (glitch) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.35;
      ctx.drawImage(spr, drawX - 2, drawY);
      ctx.globalAlpha = 0.3;
      ctx.drawImage(spr, drawX + 2, drawY);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, drawX, drawY);

    if (Math.abs(p.vx) > 0.8 && p.onGround && animT % 8 < 2) {
      ctx.fillStyle = "#ffb8d4";
      ctx.fillRect(drawX + 4, drawY + sh - 2, 2, 2);
      ctx.fillRect(drawX + sw - 8, drawY + sh - 2, 2, 2);
    }
  }

  // ── Loop ───────────────────────────────────────────────────
  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  function paintHeroPreview() {
    if (!snowmanSpriteCanvas) buildSnowmanSpriteCanvases();
    const hero = document.getElementById("hero-sprite");
    if (!hero) return;
    const hctx = hero.getContext("2d");
    hctx.imageSmoothingEnabled = false;
    hctx.clearRect(0, 0, hero.width, hero.height);
    hctx.drawImage(snowmanSpriteCanvas, 0, 0, hero.width, hero.height);
  }

  renderComponentList();
  updateHud();
  refreshDailyUI();
  refreshSoftUI();
  setState("title");
  loadLevel(0);
  paintHeroPreview();
  loop();
})();
