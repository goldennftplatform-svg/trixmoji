/**
 * SAVE THE TRENCHEZ — sniper overwatch.
 * Five scenes. Degens in the hole. Soldiers on the flanks.
 */
(() => {
  "use strict";

  const ROUNDS = 5;
  const BOLT_MS = 700;
  const RELOAD_MS = 1600;
  const TRENCH_HP = 8;
  const SENS = 1.15;
  const TOUCH_SENS = 1.25;
  const KEY_PAN = 420;
  const MAGNIFY = 1.0;
  const BOARD_KEY = "trench_scores_v1";
  const HI_KEY = "trench_high_v1";

  const el = {
    title: document.getElementById("screen-title"),
    play: document.getElementById("screen-play"),
    over: document.getElementById("screen-over"),
    canvas: document.getElementById("view"),
    reticle: document.getElementById("reticle"),
    hitmark: document.getElementById("hitmark"),
    btnStart: document.getElementById("btn-start"),
    btnRetry: document.getElementById("btn-retry"),
    score: document.getElementById("hud-score"),
    scene: document.getElementById("hud-scene"),
    wave: document.getElementById("hud-wave"),
    ammo: document.getElementById("hud-ammo"),
    status: document.getElementById("hud-status"),
    hp: document.getElementById("hud-hp"),
    kills: document.getElementById("hud-kills"),
    banner: document.getElementById("banner"),
    flash: document.getElementById("flash"),
    hitmark: document.getElementById("hitmark"),
    lockHint: document.getElementById("lock-hint"),
    touchBar: document.getElementById("touch-bar"),
    btnFire: document.getElementById("btn-fire"),
    btnReload: document.getElementById("btn-reload"),
    hi: document.getElementById("hi-label"),
    overTag: document.getElementById("over-tag"),
    overTitle: document.getElementById("over-title"),
    overScore: document.getElementById("over-score"),
    overWave: document.getElementById("over-wave"),
    overKills: document.getElementById("over-kills"),
    overHeads: document.getElementById("over-heads"),
    overPost: document.getElementById("over-post"),
  };

  const ctx = el.canvas.getContext("2d");
  const keys = Object.create(null);
  let usedTouch = false;

  function screens(list) {
    return list.map(function (p, i) {
      return { x: p[0], y: p[1], w: p[2] || 0.012, h: p[3] || 0.008, ph: i * 1.7, sp: 4 + (i % 5) };
    });
  }

  const SCENES = [
    {
      name: "OPEN FIELD",
      src: "assets/scene-field.jpg",
      waves: 5,
      lookY: 0.52,
      scale: 0.055,
      weather: null,
      left: { x0: 0.06, y0: 0.58, x1: 0.22, y1: 0.58, x2: 0.36, y2: 0.58 },
      right: { x0: 0.94, y0: 0.58, x1: 0.78, y1: 0.58, x2: 0.64, y2: 0.58 },
      screens: screens([[0.44,0.56],[0.48,0.57],[0.52,0.56],[0.56,0.58],[0.50,0.60],[0.46,0.59]]),
    },
    {
      name: "CITY CUT",
      src: "assets/scene-city.jpg",
      waves: 10,
      lookY: 0.55,
      scale: 0.06,
      weather: "rain",
      left: { x0: 0.08, y0: 0.62, x1: 0.24, y1: 0.70, x2: 0.38, y2: 0.76 },
      right: { x0: 0.92, y0: 0.62, x1: 0.76, y1: 0.70, x2: 0.62, y2: 0.76 },
      screens: screens([[0.44,0.72],[0.50,0.70],[0.56,0.73],[0.48,0.76],[0.54,0.78]]),
    },
    {
      name: "YARD",
      src: "assets/scene-yard.jpg",
      waves: 8,
      lookY: 0.52,
      scale: 0.055,
      weather: null,
      left: { x0: 0.08, y0: 0.62, x1: 0.26, y1: 0.68, x2: 0.40, y2: 0.72 },
      right: { x0: 0.92, y0: 0.62, x1: 0.74, y1: 0.68, x2: 0.60, y2: 0.72 },
      screens: screens([[0.48,0.72],[0.52,0.70],[0.50,0.74]]),
    },
    {
      name: "HIGHWAY",
      src: "assets/scene-highway.jpg",
      waves: 10,
      lookY: 0.52,
      scale: 0.055,
      weather: null,
      left: { x0: 0.12, y0: 0.48, x1: 0.30, y1: 0.62, x2: 0.42, y2: 0.74 },
      right: { x0: 0.88, y0: 0.48, x1: 0.70, y1: 0.62, x2: 0.58, y2: 0.74 },
      screens: screens([[0.47,0.78],[0.50,0.76],[0.53,0.80]]),
    },
    {
      name: "NIGHT PLAZA",
      src: "assets/scene-plaza.jpg",
      waves: 12,
      lookY: 0.52,
      scale: 0.05,
      weather: "rain",
      left: { x0: 0.12, y0: 0.42, x1: 0.28, y1: 0.58, x2: 0.42, y2: 0.72 },
      right: { x0: 0.88, y0: 0.42, x1: 0.72, y1: 0.58, x2: 0.58, y2: 0.72 },
      screens: screens([[0.46,0.82],[0.50,0.80],[0.54,0.83]]),
    },
  ];

  const imgs = {
    aR: load("assets/enemy-a-r.png"),
    aL: load("assets/enemy-a-l.png"),
    bR: load("assets/enemy-b-r.png"),
    cR: load("assets/enemy-c-r.png"),
  };
  SCENES.forEach(function (s) { s.img = load(s.src); });

  let worldW = 1408;
  let worldH = 704;
  let cw = 1280;
  let ch = 720;
  let lookX = 0;
  let lookY = 0;
  let recoil = 0;
  let sceneIdx = 0;
  let scenePause = 0;
  let rain = [];
  let breath = 0;

  let mode = "title";
  let running = false;
  let raf = 0;
  let lastTs = 0;
  let aimCssX = 0.5;
  let aimCssY = 0.5;

  let ammo = ROUNDS;
  let reloading = 0;
  let bolt = 0;
  let score = 0;
  let wave = 1;
  let hp = TRENCH_HP;
  let kills = 0;
  let heads = 0;
  let enemies = [];
  let spawnQ = [];
  let spawnT = 0;
  let wavePause = 0;
  let bannerT = 0;
  let flashT = 0;
  let hurtT = 0;
  let hitT = 0;
  let impacts = [];

  const audio = { ctx: null };

  function load(src) {
    const im = new Image();
    im.src = src;
    return im;
  }

  function show(screen) {
    el.title.classList.toggle("active", screen === "title");
    el.play.classList.toggle("active", screen === "play");
    el.over.classList.toggle("active", screen === "over");
    document.body.classList.toggle("menu", screen !== "play");
  }

  function high() {
    try { return Number(localStorage.getItem(HI_KEY) || 0); } catch (e) { return 0; }
  }
  function setHi(n) {
    try { localStorage.setItem(HI_KEY, String(n)); } catch (e) {}
    if (el.hi) el.hi.textContent = "HI " + n;
  }
  setHi(high());

  function ensureAudio() {
    if (audio.ctx) return audio.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio.ctx = new AC();
    return audio.ctx;
  }

  function blip(kind) {
    const ac = ensureAudio();
    if (!ac) return;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g);
    g.connect(ac.destination);
    if (kind === "shot") {
      o.type = "sawtooth";
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.start(t);
      o.stop(t + 0.18);
      const buf = ac.createBuffer(1, ac.sampleRate * 0.08, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const n = ac.createBufferSource();
      const ng = ac.createGain();
      n.buffer = buf;
      n.connect(ng);
      ng.connect(ac.destination);
      ng.gain.setValueAtTime(0.18, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      n.start(t);
    } else if (kind === "reload") {
      o.type = "square";
      o.frequency.setValueAtTime(140, t);
      o.frequency.setValueAtTime(90, t + 0.08);
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.start(t);
      o.stop(t + 0.22);
    } else if (kind === "empty") {
      o.type = "square";
      o.frequency.value = 70;
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      o.start(t);
      o.stop(t + 0.07);
    } else if (kind === "hit") {
      o.type = "triangle";
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(60, t + 0.1);
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.start(t);
      o.stop(t + 0.13);
    } else if (kind === "breach") {
      o.type = "sawtooth";
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(30, t + 0.4);
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.start(t);
      o.stop(t + 0.46);
    }
  }

  function resize() {
    const r = el.canvas.getBoundingClientRect();
    cw = Math.max(320, Math.floor(r.width * (window.devicePixelRatio || 1)));
    ch = Math.max(240, Math.floor(r.height * (window.devicePixelRatio || 1)));
    el.canvas.width = cw;
    el.canvas.height = ch;
  }

  function curScene() {
    return SCENES[sceneIdx] || SCENES[0];
  }

  function waveSpec() {
    const w = wave + sceneIdx * 2;
    return {
      count: 4 + w * 2,
      interval: Math.max(0.38, 2.05 - w * 0.14),
      speed: 46 + w * 10,
      maxLive: Math.min(1 + Math.floor((w + 1) / 2), 9),
    };
  }

  function viewZoom() {
    if (!worldW || !worldH) return 1;
    return Math.max(cw / worldW, ch / worldH) * MAGNIFY;
  }

  function scaleForY() {
    return curScene().scale || 0.11;
  }

  function enemyBox(e) {
    const nh = e.img.naturalHeight || 900;
    const nw = e.img.naturalWidth || 700;
    const dh = scaleForY(e.y) * worldH;
    const dw = (nw / nh) * dh;
    const pad = Math.max(12, dh * 0.18);
    return { x: e.x - dw * 0.42 - pad, y: e.y - dh - pad, w: dw * 0.84 + pad * 2, h: dh + pad * 2, dw, dh };
  }

  function pickImg(side) {
    const roll = Math.random();
    if (side === "left") {
      if (roll < 0.45) return { img: imgs.aR, flip: false };
      if (roll < 0.75) return { img: imgs.bR, flip: false };
      return { img: imgs.cR, flip: false };
    }
    if (roll < 0.5) return { img: imgs.aL, flip: false };
    if (roll < 0.78) return { img: imgs.bR, flip: true };
    return { img: imgs.cR, flip: true };
  }

  function spawnEnemy(side) {
    const plate = pickImg(side);
    const jitter = Math.random();
    let x;
    let y;
    let path;
    const sidePath = side === "left" ? curScene().left : curScene().right;
    if (side === "left") {
      x = worldW * (sidePath.x0 + jitter * 0.06);
      y = worldH * (sidePath.y0 + Math.random() * 0.06);
    } else {
      x = worldW * (sidePath.x0 - jitter * 0.06);
      y = worldH * (sidePath.y0 + Math.random() * 0.06);
    }
    path = [
      { x: worldW * sidePath.x1, y: worldH * sidePath.y1 },
      { x: worldW * sidePath.x2, y: worldH * sidePath.y2 },
    ];
    enemies.push({
      img: plate.img,
      flip: plate.flip,
      x, y,
      path,
      pi: 0,
      dead: false,
      deadT: 0,
      bob: Math.random() * Math.PI * 2,
      side,
    });
  }

  function queueWave() {
    const spec = waveSpec();
    spawnQ = [];
    for (let i = 0; i < spec.count; i++) {
      spawnQ.push(i % 2 === 0 ? "left" : "right");
    }
    for (let i = spawnQ.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = spawnQ[i];
      spawnQ[i] = spawnQ[j];
      spawnQ[j] = t;
    }
    spawnT = 0.35;
    banner(curScene().name + "  ·  WAVE " + wave + "/" + curScene().waves);
  }

  function banner(text) {
    el.banner.textContent = text;
    el.banner.classList.add("show");
    bannerT = 1.4;
  }

  function hud() {
    el.score.textContent = String(score);
    if (el.scene) el.scene.textContent = (sceneIdx + 1) + "/" + SCENES.length;
    el.wave.textContent = wave + "/" + curScene().waves;
    el.hp.textContent = String(hp);
    el.kills.textContent = String(kills);
    const rounds = "●".repeat(ammo) + "○".repeat(ROUNDS - ammo);
    el.ammo.textContent = rounds;
    el.ammo.classList.toggle("empty", ammo === 0);
    if (reloading > 0) el.status.textContent = "RELOADING";
    else if (ammo === 0) el.status.textContent = "EMPTY · RMB";
    else if (bolt > 0) el.status.textContent = "BOLT";
    else el.status.textContent = "READY";
  }

  function clampLook() {
    lookX = worldW / 2;
    lookY = worldH * (curScene().lookY || 0.52);
  }

  function aimWorld() {
    const z = viewZoom();
    return {
      x: lookX + (aimCssX - 0.5) * (cw / z),
      y: lookY + (aimCssY - 0.5) * (ch / z),
    };
  }

  function placeReticle() {
    if (!el.reticle) return;
    el.reticle.style.left = (aimCssX * 100) + "%";
    el.reticle.style.top = (aimCssY * 100) + "%";
    if (el.hitmark) {
      el.hitmark.style.left = (aimCssX * 100) + "%";
      el.hitmark.style.top = (aimCssY * 100) + "%";
    }
  }

  function setAimFromEvent(ev) {
    const rect = el.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    aimCssX = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
    aimCssY = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
    placeReticle();
  }

  function fire() {
    if (mode !== "play" || !running) return;
    if (reloading > 0 || bolt > 0) return;
    if (ammo <= 0) {
      blip("empty");
      el.status.textContent = "EMPTY · RMB";
      return;
    }
    ammo -= 1;
    bolt = BOLT_MS / 1000;
    recoil = 22;
    flashT = 0.08;
    el.flash.className = "on";
    blip("shot");

    const aim = aimWorld();
    const shotX = aim.x;
    const shotY = aim.y;

    let hit = null;
    let best = 1e9;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dead) continue;
      const b = enemyBox(e);
      if (shotX >= b.x && shotX <= b.x + b.w && shotY >= b.y && shotY <= b.y + b.h) {
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h * 0.38;
        const d = (shotX - cx) * (shotX - cx) + (shotY - cy) * (shotY - cy);
        if (d < best) { best = d; hit = e; }
      }
    }
    if (hit) {
      const b = enemyBox(hit);
      const head = shotY < b.y + b.h * 0.30;
      hit.dead = true;
      hit.deadT = 0;
      kills += 1;
      if (head) {
        heads += 1;
        score += 250;
      } else {
        score += 100;
      }
      blip("hit");
      el.hitmark.classList.add("show");
      hitT = 0.18;
    } else {
      impacts.push({ x: shotX, y: shotY, t: 0.28 });
    }
    hud();
  }

  function reload() {
    if (mode !== "play" || !running) return;
    if (reloading > 0) return;
    if (ammo >= ROUNDS) return;
    reloading = RELOAD_MS / 1000;
    blip("reload");
    hud();
  }

  function breach() {
    hp -= 1;
    hurtT = 0.45;
    el.flash.className = "hurt";
    blip("breach");
    hud();
    if (hp <= 0) endRun(false);
  }

  function endRun(held) {
    running = false;
    mode = "over";
    document.body.classList.remove("playing", "locked");
    try { if (document.exitPointerLock) document.exitPointerLock(); } catch (e) {}
    const finalScore = score;
    const hi = high();
    if (finalScore > hi) setHi(finalScore);
    try {
      const board = JSON.parse(localStorage.getItem(BOARD_KEY) || "[]");
      board.push({ score: finalScore, wave, kills, heads, ts: Date.now() });
      board.sort((a, b) => (b.score || 0) - (a.score || 0));
      localStorage.setItem(BOARD_KEY, JSON.stringify(board.slice(0, 50)));
    } catch (e) {}
    try {
      if (window.DOSWAPZ_X && window.DOSWAPZ_X.postScore) {
        window.DOSWAPZ_X.postScore({ game: "trench", score: finalScore, extra: { kills, depth: wave } });
      }
    } catch (e) {}
    el.overTag.textContent = held ? "ALL SECTORS HELD" : "TRENCH BREACHED";
    el.overTitle.textContent = held ? "THE DEGENS LIVE" : "THEY GOT IN";
    el.overScore.textContent = String(finalScore);
    el.overWave.textContent = (sceneIdx + 1) + " / " + wave;
    el.overKills.textContent = String(kills);
    el.overHeads.textContent = String(heads);
    el.overPost.textContent = finalScore >= hi ? "NEW HIGH" : "Best " + Math.max(hi, finalScore);
    show("over");
  }

  function scenesReady() {
    return SCENES.every(function (s) { return s.img && s.img.complete && s.img.naturalWidth; });
  }

  function applyScene() {
    const s = curScene();
    worldW = s.img.naturalWidth || 1280;
    worldH = s.img.naturalHeight || 720;
    lookX = worldW * 0.5;
    lookY = worldH * s.lookY;
    rain = [];
    if (s.weather === "rain") {
      for (let i = 0; i < 90; i++) {
        rain.push({
          x: Math.random() * worldW,
          y: Math.random() * worldH,
          l: 8 + Math.random() * 16,
          v: 220 + Math.random() * 180,
        });
      }
    }
  }

  function begin() {
    if (mode === "play" && running) return;
    if (!scenesReady()) {
      el.btnStart.textContent = "LOADING…";
      setTimeout(begin, 80);
      return;
    }
    el.btnStart.textContent = "HOLD THE LINE";
    sceneIdx = 0;
    scenePause = 0;
    applyScene();
    ammo = ROUNDS;
    reloading = 0;
    bolt = 0;
    score = 0;
    wave = 1;
    hp = TRENCH_HP;
    kills = 0;
    heads = 0;
    enemies = [];
    spawnQ = [];
    impacts = [];
    recoil = 0;
    wavePause = 0;
    scenePause = 0;
    mode = "play";
    running = true;
    show("play");
    resize();
    queueWave();
    hud();
    lastTs = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    try { if (document.exitPointerLock) document.exitPointerLock(); } catch (e) {}
    if (usedTouch) el.touchBar.hidden = false;
    if (el.lockHint) el.lockHint.hidden = true;
    document.body.classList.add("playing");
    document.body.classList.remove("locked");
    aimCssX = 0.5;
    aimCssY = 0.5;
    placeReticle();
    ensureAudio();
  }

  function loop(ts) {
    if (!running) return;
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
    lastTs = ts;
    step(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function step(dt) {
    breath += dt;
    if (recoil > 0) recoil = Math.max(0, recoil - dt * 70);
    if (bolt > 0) bolt = Math.max(0, bolt - dt);
    if (reloading > 0) {
      reloading = Math.max(0, reloading - dt);
      if (reloading === 0) {
        ammo = ROUNDS;
        hud();
      }
    }
    if (bannerT > 0) {
      bannerT -= dt;
      if (bannerT <= 0) el.banner.classList.remove("show");
    }
    if (flashT > 0) {
      flashT -= dt;
      if (flashT <= 0 && hurtT <= 0) el.flash.className = "";
    }
    if (hurtT > 0) {
      hurtT -= dt;
      if (hurtT <= 0) el.flash.className = "";
    }
    if (hitT > 0) {
      hitT -= dt;
      if (hitT <= 0) el.hitmark.classList.remove("show");
    }

    const spec = waveSpec();
    const live = enemies.filter((e) => !e.dead).length;
    spawnT -= dt;
    if (spawnQ.length && spawnT <= 0 && live < spec.maxLive) {
      spawnEnemy(spawnQ.shift());
      spawnT = spec.interval;
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.dead) {
        e.deadT += dt;
        e.y += dt * 40;
        if (e.deadT > 0.55) enemies.splice(i, 1);
        continue;
      }
      e.bob += dt * 10;
      const dest = e.path[e.pi];
      if (!dest) {
        enemies.splice(i, 1);
        breach();
        continue;
      }
      const dx = dest.x - e.x;
      const dy = dest.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const spd = spec.speed;
      const stepN = spd * dt;
      if (stepN >= dist) {
        e.x = dest.x;
        e.y = dest.y;
        e.pi += 1;
      } else {
        e.x += (dx / dist) * stepN;
        e.y += (dy / dist) * stepN;
      }
    }

    for (let i = impacts.length - 1; i >= 0; i--) {
      impacts[i].t -= dt;
      if (impacts[i].t <= 0) impacts.splice(i, 1);
    }

    if (!spawnQ.length && !enemies.length && wavePause <= 0 && scenePause <= 0) {
      score += 400 * wave * (sceneIdx + 1);
      if (wave >= curScene().waves) {
        if (sceneIdx >= SCENES.length - 1) {
          score += 2500;
          hud();
          endRun(true);
          return;
        }
        banner("SECTOR CLEAR");
        scenePause = 2.0;
      } else {
        wave += 1;
        wavePause = 1.15;
        banner("WAVE CLEAR");
      }
      hud();
    }
    if (scenePause > 0) {
      scenePause -= dt;
      if (scenePause <= 0) {
        sceneIdx += 1;
        wave = 1;
        enemies = [];
        spawnQ = [];
        applyScene();
        banner(curScene().name);
        wavePause = 1.2;
        hud();
      }
    }
    if (wavePause > 0) {
      wavePause -= dt;
      if (wavePause <= 0) queueWave();
    }

    for (let i = 0; i < rain.length; i++) {
      const d = rain[i];
      d.y += d.v * dt;
      d.x += 40 * dt;
      if (d.y > worldH) {
        d.y = -20;
        d.x = Math.random() * worldW;
      }
    }
    lookY -= recoil * dt * 4;
    clampLook();
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);

    const swayX = Math.sin(breath * 1.15) * 1.6;
    const swayY = Math.cos(breath * 0.9) * 1.2;
    const camX = lookX + swayX;
    const camY = lookY + swayY - recoil * 0.15;

    ctx.save();
    const zoom = viewZoom();
    ctx.translate(cw / 2, ch / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    const plate = curScene().img;
    if (plate && plate.complete) ctx.drawImage(plate, 0, 0, worldW, worldH);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glows = curScene().screens || [];
    for (let i = 0; i < glows.length; i++) {
      const g = glows[i];
      const flick = 0.55 + 0.35 * Math.sin(breath * g.sp + g.ph) + Math.random() * 0.12;
      ctx.fillStyle = "rgba(90, 255, 230," + (0.22 * Math.max(0.2, flick)) + ")";
      ctx.beginPath();
      ctx.ellipse(g.x * worldW, g.y * worldH, g.w * worldW, g.h * worldH, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (rain.length) {
      ctx.strokeStyle = "rgba(180, 210, 230, 0.28)";
      ctx.lineWidth = 1.2 / zoom;
      ctx.beginPath();
      for (let i = 0; i < rain.length; i++) {
        const d = rain[i];
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 4, d.y + d.l);
      }
      ctx.stroke();
    }

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.img.complete) continue;
      const b = enemyBox(e);
      const bob = e.dead ? 0 : Math.sin(e.bob) * 2.2;
      ctx.save();
      ctx.globalAlpha = e.dead ? Math.max(0, 1 - e.deadT / 0.55) : 1;
      ctx.translate(e.x, e.y - bob);
      if (e.flip) ctx.scale(-1, 1);
      ctx.drawImage(e.img, -b.dw / 2, -b.dh, b.dw, b.dh);
      ctx.restore();
    }

    for (let i = 0; i < impacts.length; i++) {
      const p = impacts[i];
      ctx.globalAlpha = Math.max(0, p.t / 0.28);
      ctx.fillStyle = "#3a2a18";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#c49646";
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dead) continue;
      const sx = (e.x - camX) * zoom + cw / 2;
      const sy = (e.y - camY) * zoom + ch / 2;
      if (sx >= 40 && sx <= cw - 40 && sy >= 40 && sy <= ch - 40) continue;
      const ang = Math.atan2(sy - ch / 2, sx - cw / 2);
      const r = Math.min(cw, ch) * 0.28;
      const ax = cw / 2 + Math.cos(ang) * r;
      const ay = ch / 2 + Math.sin(ang) * r;
      ctx.beginPath();
      ctx.arc(ax, ay, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  el.btnStart.addEventListener("click", (ev) => { ev.preventDefault(); begin(); });
  el.btnRetry.addEventListener("click", (ev) => { ev.preventDefault(); begin(); });
  el.title.addEventListener("click", (ev) => {
    if (ev.target.closest("a")) return;
    begin();
  });

  window.addEventListener("mousedown", (ev) => {
    if (mode !== "play") return;
    setAimFromEvent(ev);
    if (ev.button === 0) fire();
    else if (ev.button === 2) {
      ev.preventDefault();
      reload();
    }
  });
  window.addEventListener("contextmenu", (ev) => ev.preventDefault());
  window.addEventListener("keydown", (ev) => {
    keys[ev.code] = true;
    if (ev.code === "KeyR") reload();
    if (ev.code === "Space" && mode === "title") {
      ev.preventDefault();
      begin();
    }
  });
  window.addEventListener("keyup", (ev) => { keys[ev.code] = false; });
  document.addEventListener("mousemove", (ev) => {
    if (mode !== "play" || !running) return;
    setAimFromEvent(ev);
  });

  let touchId = null;
  let lastTx = 0;
  let lastTy = 0;
  window.addEventListener("touchstart", () => {
    usedTouch = true;
    if (mode === "play") el.touchBar.hidden = false;
  }, { passive: true });
  el.canvas.addEventListener("touchstart", (ev) => {
    usedTouch = true;
    el.touchBar.hidden = false;
    const t = ev.changedTouches[0];
    touchId = t.identifier;
    lastTx = t.clientX;
    lastTy = t.clientY;
  }, { passive: true });
  el.canvas.addEventListener("touchmove", (ev) => {
    for (let i = 0; i < ev.changedTouches.length; i++) {
      const t = ev.changedTouches[i];
      if (t.identifier !== touchId) continue;
      setAimFromEvent(t);
      lastTx = t.clientX;
      lastTy = t.clientY;
    }
  }, { passive: true });
  el.canvas.addEventListener("touchend", () => { touchId = null; });
  el.btnFire.addEventListener("click", (ev) => { ev.stopPropagation(); fire(); });
  el.btnReload.addEventListener("click", (ev) => { ev.stopPropagation(); reload(); });

  window.addEventListener("resize", resize);
  show("title");
})();
