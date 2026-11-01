/**
 * LILY LEAP — original pond leap game
 * Organic lily pads, arc jumps, flies, heron, whirlpools.
 */
(() => {
  "use strict";

  const W = 480;
  const H = 640;
  const BANK = 70;
  const REACH = 105;
  const FROG_R = 13;
  const MAX_PONDS = 4;
  const LEAP_MS = 320;
  const WALK_SPEED = 3.2;
  const SHORE_MARGIN = 28;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const panels = {
    title: document.getElementById("title-panel"),
    howto: document.getElementById("howto-panel"),
    pause: document.getElementById("pause-panel"),
    over: document.getElementById("over-panel"),
    level: document.getElementById("level-panel"),
    win: document.getElementById("win-panel"),
  };

  const hudScore = document.getElementById("hud-score");
  const hudPond = document.getElementById("hud-pond");
  const hudLives = document.getElementById("hud-lives");
  const hudGlow = document.getElementById("hud-glow");
  const overScore = document.getElementById("over-score");
  const overGlow = document.getElementById("over-glow");
  const winScore = document.getElementById("win-score");
  const levelMsg = document.getElementById("level-msg");

  let state = "title";
  let howtoReturn = "title";
  let score = 0;
  let pond = 1;
  let lives = 3;
  let glow = 0;
  let animT = 0;
  let face = 1;
  const keys = Object.create(null);

  let frog = { x: W / 2, y: H - BANK / 2, pad: null };
  let leap = null; // {x0,y0,x1,y1,t,dur,toPad}
  let pads = [];
  let fireflies = [];
  let whirls = [];
  let heron = { t: 0, active: false, x: 0, danger: 0 };
  let dragonfly = null;
  let particles = [];
  let ripples = [];
  let hoverPad = null;
  let iframes = 0;
  let message = "";
  let messageT = 0;
  let tongue = null; // {x0,y0,x1,y1,t}
  let lastRun = null; // for soft post
  let postedThisRun = false;
  let rng = Math.random;

  const BOARD_KEY = "lily_leap_scores_v1";

  function getArcade() {
    return window.DOSWAPZ_ARCADE || null;
  }

  function getDaily() {
    const A = getArcade();
    return A && A.getDailyChallenge ? A.getDailyChallenge() : null;
  }

  /** Seeded RNG from daily seed so same day = same pond layout */
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedFromDaily(dayKey, seedHex) {
    let h = 2166136261;
    const s = String(dayKey || "") + ":" + String(seedHex || "") + ":LILY";
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function refreshDailyUI() {
    const d = getDaily();
    const modeEl = document.getElementById("daily-mode");
    const seedEl = document.getElementById("daily-seed");
    if (!d) {
      if (modeEl) modeEl.textContent = "offline";
      if (seedEl) seedEl.textContent = "SEED —";
      return;
    }
    if (modeEl) modeEl.textContent = d.mode || "DAILY";
    if (seedEl) seedEl.textContent = "SEED " + d.seed;
  }

  function refreshSoftUI() {
    const A = getArcade();
    if (!A) return;
    const id = A.softIdentity();
    const tag = document.getElementById("sc-tag");
    const st = document.getElementById("sc-status");
    if (tag) tag.textContent = id.tag;
    if (st) {
      st.textContent = id.linked
        ? "Soft-linked as " + id.tag + " · no wallet · no seed"
        : "Alias only · add @handle optional · no wallet";
    }
    const h = document.getElementById("sc-handle");
    const a = document.getElementById("sc-alias");
    const sc = A.loadSoftConnect();
    if (h && !h.value && sc.handle) h.value = "@" + sc.handle;
    if (a && !a.value && sc.alias) a.value = sc.alias;
  }

  function recordRun(finalScore, pondReached, fliesEaten, won) {
    lastRun = {
      score: finalScore,
      pond: pondReached,
      flies: fliesEaten,
      won: !!won,
      at: Date.now(),
    };
    postedThisRun = false;
    try {
      const hi = Number(localStorage.getItem("lily_leap_high") || 0);
      if (finalScore > hi) localStorage.setItem("lily_leap_high", String(finalScore));
    } catch (e) {}
    const overSt = document.getElementById("over-post-status");
    const winSt = document.getElementById("win-post-status");
    if (overSt) overSt.textContent = "Soft post ready · " + finalScore + " pts";
    if (winSt) winSt.textContent = "Soft post ready · " + finalScore + " pts";
  }

  function postSoftScore() {
    if (!lastRun || typeof lastRun.score !== "number") {
      flashMsg("No run to post", 50);
      return;
    }
    const A = getArcade();
    const id = A ? A.softIdentity() : { alias: "DEGEN", handle: "", tag: "DEGEN" };
    if (A) {
      const h = document.getElementById("sc-handle");
      const a = document.getElementById("sc-alias");
      A.saveSoftConnect({
        handle: h ? h.value : id.handle,
        alias: a ? a.value : id.alias,
      });
    }
    const soft = A ? A.softIdentity() : id;
    const daily = getDaily();
    const entry = {
      name: soft.alias,
      handle: soft.handle || "",
      soft: true,
      rulesOk: true,
      score: lastRun.score,
      flies: lastRun.flies,
      pond: lastRun.pond,
      won: !!lastRun.won,
      dailySeed: daily ? daily.seed : "",
      dailyDay: daily ? daily.day : "",
      dailyMode: daily ? daily.mode : "",
      at: Date.now(),
      ts: Date.now(),
    };

    let list = [];
    try {
      if (window.DOSWAPZ_SOFT_SCORE) {
        list = DOSWAPZ_SOFT_SCORE.loadBoard(BOARD_KEY) || [];
      } else {
        list = JSON.parse(localStorage.getItem(BOARD_KEY) || "[]");
      }
    } catch (e) {
      list = [];
    }
    if (!Array.isArray(list)) list = [];

    const keyOf = (e) =>
      e.handle ? "h:" + String(e.handle).toLowerCase() : "a:" + String(e.name || e.alias || "");
    const key = keyOf(entry);
    const others = list.filter((e) => keyOf(e) !== key);
    const prior = list.filter((e) => keyOf(e) === key);
    const bestPrior = prior.reduce((m, e) => (!m || e.score > m.score ? e : m), null);
    let keptOld = false;
    if (!bestPrior || entry.score >= bestPrior.score) {
      others.push(entry);
    } else {
      others.push(bestPrior);
      keptOld = true;
    }
    others.sort((a, b) => (b.score || 0) - (a.score || 0));
    const trimmed = others.slice(0, 40);
    try {
      localStorage.setItem(BOARD_KEY, JSON.stringify(trimmed));
    } catch (e2) {}

    postedThisRun = true;
    const msg = keptOld
      ? "Best kept (" + bestPrior.score + ") · this run lower"
      : "Posted as " + soft.tag + " · +DAILY tagged · soft only";
    const overSt = document.getElementById("over-post-status");
    const winSt = document.getElementById("win-post-status");
    if (overSt) overSt.textContent = msg;
    if (winSt) winSt.textContent = msg;
    flashMsg(keptOld ? "Best kept on board" : "Score posted soft", 70);
  }

  function shareRun() {
    const A = getArcade();
    if (!lastRun) {
      flashMsg("Play a run first", 40);
      return;
    }
    const id = A ? A.softIdentity() : { tag: "DEGEN" };
    const daily = getDaily();
    const text = A
      ? A.shareCard({
          game: "LILY LEAP",
          score: lastRun.score,
          extra:
            "Flies " +
            lastRun.flies +
            " * Pond " +
            lastRun.pond +
            (lastRun.won ? " * CLEARED" : "") +
            (daily ? " * +DAILY" : ""),
        })
      : id.tag + " scored " + lastRun.score + " on LILY LEAP";
    if (A && A.copyText) {
      A.copyText(text).then(function (ok) {
        flashMsg(ok ? "Share card copied" : "Copy failed", 50);
      });
    } else {
      flashMsg("Share ready", 40);
    }
    if (A && A.tweetUrl) {
      window.open(A.tweetUrl(text), "_blank", "noopener");
    }
  }

  function setState(s) {
    state = s;
    overlay.classList.toggle("hidden", s === "play");
    Object.values(panels).forEach((p) => p && p.classList.add("hidden"));
    if (s === "title") panels.title.classList.remove("hidden");
    if (s === "howto") panels.howto.classList.remove("hidden");
    if (s === "pause") panels.pause.classList.remove("hidden");
    if (s === "over") panels.over.classList.remove("hidden");
    if (s === "level") panels.level.classList.remove("hidden");
    if (s === "win") panels.win.classList.remove("hidden");
  }

  function updateHud() {
    hudScore.textContent = String(score);
    hudPond.textContent = String(pond);
    hudLives.textContent = "♥".repeat(Math.max(0, lives)) || "—";
    hudGlow.textContent = String(glow);
  }

  function openHowto() {
    if (state === "howto") return;
    howtoReturn = state;
    setState("howto");
  }
  function closeHowto() {
    setState(howtoReturn === "howto" ? "title" : howtoReturn || "title");
  }

  function flashMsg(t, frames) {
    message = t;
    messageT = frames || 90;
  }

  function rand(a, b) {
    return a + rng() * (b - a);
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  // ── Build organic pond ───────────────────────────────────
  function buildPond(n) {
    pads = [];
    fireflies = [];
    whirls = [];
    particles = [];
    ripples = [];
    leap = null;
    heron = { t: 200 + Math.random() * 180, active: false, x: W / 2, danger: 0 };
    dragonfly = {
      x: rand(40, W - 40),
      y: rand(BANK + 80, H - BANK - 80),
      vx: rand(0.6, 1.4) * (Math.random() < 0.5 ? -1 : 1),
      phase: Math.random() * 6,
      rideReady: false,
      rideT: 0,
    };

    // Near bank — full shore the frog can walk left/right on
    const start = {
      id: "start",
      x: W / 2,
      y: H - BANK * 0.45,
      r: 48,
      kind: "bank",
      open: true,
      phase: 0,
      vx: 0,
      vy: 0,
      baseX: W / 2,
      baseY: H - BANK * 0.45,
      walkable: true,
    };
    pads.push(start);

    // Far shore — entire bank is landable (not just a center nest pad)
    const far = {
      id: "far",
      x: W / 2,
      y: BANK * 0.5,
      r: 40,
      kind: "far",
      open: true,
      phase: 0,
      vx: 0,
      vy: 0,
      baseX: W / 2,
      baseY: BANK * 0.5,
      walkable: true,
      fullShore: true,
    };
    pads.push(far);

    // ── Shore pads: always close enough to jump from the bank ──
    // Frog stands at start.y; REACH is ~105. Keep first pads within ~70–90px.
    const shoreY = start.y - 72;
    const shoreCount = 5;
    for (let i = 0; i < shoreCount; i++) {
      const t = (i + 0.5) / shoreCount;
      const x = 50 + t * (W - 100);
      // alternate slight depth so they feel natural but all jumpable
      const y = shoreY - (i % 2) * 12;
      pads.push({
        id: "shore" + i,
        x,
        y,
        r: rand(17, 21),
        kind: "drift", // slide along shore so they "come by"
        open: true,
        bloomT: 0,
        phase: Math.random() * Math.PI * 2,
        vx: rand(0.45, 0.85) * (i % 2 === 0 ? 1 : -1),
        vy: 0,
        baseX: x,
        baseY: y,
        shoreLane: true, // clamp drift to stay near shore
      });
    }

    // One guaranteed pad right in front of spawn (always hoppable)
    pads.push({
      id: "shoreFront",
      x: start.x,
      y: start.y - 68,
      r: 20,
      kind: "lily",
      open: true,
      bloomT: 0,
      phase: 0,
      vx: 0,
      vy: 0,
      baseX: start.x,
      baseY: start.y - 68,
      shoreLane: false,
    });

    // Organic lily field deeper in the pond
    const top = BANK + 50;
    const bot = shoreY - 40; // don't overlap shore lane too much
    const count = 12 + n * 3;

    for (let i = 0; i < count; i++) {
      let x, y, ok, tries = 0;
      do {
        x = rand(42, W - 42);
        y = rand(top, Math.max(top + 40, bot));
        ok = true;
        for (const p of pads) {
          if (dist(x, y, p.x, p.y) < p.r + 34) {
            ok = false;
            break;
          }
        }
        tries++;
      } while (!ok && tries < 40);

      const roll = Math.random();
      let kind = "lily";
      if (n >= 1 && roll < 0.18 + n * 0.04) kind = "drift";
      else if (n >= 2 && roll < 0.32 + n * 0.03) kind = "bloom";

      const pad = {
        id: "p" + i,
        x,
        y,
        r: rand(15, 22),
        kind,
        open: kind !== "bloom",
        bloomT: Math.random() * 200,
        phase: Math.random() * Math.PI * 2,
        vx: kind === "drift" ? rand(0.25, 0.55) * (Math.random() < 0.5 ? -1 : 1) : 0,
        vy: kind === "drift" ? rand(0.1, 0.35) * (Math.random() < 0.5 ? -1 : 1) : 0,
        baseX: x,
        baseY: y,
        shoreLane: false,
      };
      pads.push(pad);
    }

    // Stepping stones from shore lane toward far bank
    let cursorY = shoreY - 55;
    let cursorX = start.x;
    let pathId = 0;
    while (cursorY > far.y + 55) {
      cursorX = Math.max(50, Math.min(W - 50, cursorX + rand(-70, 70)));
      cursorY -= rand(50, 68);
      let near = pads.some((p) => dist(p.x, p.y, cursorX, cursorY) < 48);
      if (!near) {
        pads.push({
          id: "path" + pathId++,
          x: cursorX,
          y: cursorY,
          r: rand(16, 20),
          kind: "lily",
          open: true,
          bloomT: 0,
          phase: Math.random() * 6,
          vx: 0,
          vy: 0,
          baseX: cursorX,
          baseY: cursorY,
          shoreLane: false,
        });
      }
    }

    // Flies — spawn on / near pads so you can actually eat them
    const lilyPads = pads.filter((p) => p.kind === "lily" || p.kind === "drift" || p.kind === "bloom" || p.id === "shoreFront" || (p.id && String(p.id).startsWith("shore")));
    const fn = 10 + n * 4;
    for (let i = 0; i < fn; i++) {
      const host = lilyPads[Math.floor(Math.random() * lilyPads.length)];
      let fx, fy;
      if (host && Math.random() < 0.75) {
        // buzz around a pad
        const a = Math.random() * Math.PI * 2;
        const rad = host.r + rand(8, 28);
        fx = host.x + Math.cos(a) * rad;
        fy = host.y + Math.sin(a) * rad * 0.7;
      } else {
        fx = rand(40, W - 40);
        fy = rand(top, H - BANK - 30);
      }
      fireflies.push({
        x: Math.max(20, Math.min(W - 20, fx)),
        y: Math.max(BANK + 20, Math.min(H - BANK - 20, fy)),
        phase: Math.random() * 6,
        alive: true,
        hostId: host ? host.id : null,
      });
    }

    // Whirlpools
    const wn = Math.min(1 + Math.floor(n / 2), 3);
    for (let i = 0; i < wn; i++) {
      whirls.push({
        x: rand(80, W - 80),
        y: rand(top + 40, bot - 40),
        r: 22 + n * 2,
        phase: Math.random() * 6,
      });
    }

    frog = { x: start.x, y: start.y, pad: start };
    face = 1;
    iframes = 0;
  }

  function startGame() {
    score = 0;
    pond = 1;
    lives = 3;
    glow = 0;
    lastRun = null;
    postedThisRun = false;
    // Daily seed → same pond layout for everyone today
    const daily = getDaily();
    if (daily && daily.seed) {
      rng = mulberry32(seedFromDaily(daily.day, daily.seed));
    } else {
      rng = Math.random;
    }
    buildPond(pond);
    updateHud();
    refreshDailyUI();
    setState("play");
    flashMsg(daily ? "Daily seed pond — leap!" : "Leap to the far shore…", 100);
  }

  function nextPond() {
    pond += 1;
    if (pond > MAX_PONDS) {
      winScore.textContent = String(score);
      recordRun(score, pond - 1, glow, true);
      setState("win");
      return;
    }
    score += 400;
    // keep same daily rng stream across ponds
    buildPond(pond);
    updateHud();
    setState("play");
    flashMsg("Pond " + pond, 80);
  }

  function die() {
    if (iframes > 0 || leap) return;
    spawnBurst(frog.x, frog.y, "#88ccff", 14);
    addRipple(frog.x, frog.y, 40);
    lives -= 1;
    updateHud();
    if (lives <= 0) {
      overScore.textContent = String(score);
      overGlow.textContent = String(glow);
      recordRun(score, pond, glow, false);
      setState("over");
      return;
    }
    const start = pads.find((p) => p.id === "start");
    frog.x = start.x;
    frog.y = start.y;
    frog.pad = start;
    leap = null;
    iframes = 60;
    flashMsg("Splash! Back to the bank", 70);
  }

  function spawnBurst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 2.5;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 20 + Math.random() * 20,
        color,
        r: 2 + Math.random() * 2,
      });
    }
  }

  function addRipple(x, y, maxR) {
    ripples.push({ x, y, r: 4, maxR: maxR || 30, life: 30 });
  }

  /** Point on far shore under a given x (any part of the bank). */
  function farShoreTarget(atX) {
    const far = pads.find((p) => p.kind === "far");
    if (!far) return null;
    const x = Math.max(SHORE_MARGIN, Math.min(W - SHORE_MARGIN, atX));
    return {
      id: "far",
      kind: "far",
      x,
      y: far.baseY,
      r: 44,
      open: true,
      walkable: true,
      fullShore: true,
      baseY: far.baseY,
      baseX: x,
      phase: 0,
      vx: 0,
      vy: 0,
    };
  }

  function padsInReach() {
    const list = [];
    for (const p of pads) {
      if (p === frog.pad) continue;
      if (p.kind === "far") continue; // handled as full shore below
      if (!p.open && p.kind === "bloom") continue;
      const d = dist(frog.x, frog.y, p.x, p.y);
      if (d <= REACH + p.r * 0.25 && d > 12) list.push({ p, d });
    }

    // Entire far shore is a valid landing strip
    if (!frog.pad || (frog.pad.kind !== "far" && frog.pad.id !== "far")) {
      const far = pads.find((p) => p.kind === "far");
      if (far) {
        // nearest point on far shore line to frog (same x, far y)
        const target = farShoreTarget(frog.x);
        const d = dist(frog.x, frog.y, target.x, target.y);
        if (d <= REACH + 28 && d > 10) {
          list.push({ p: target, d });
        }
        // also allow aiming at left/right stretches of shore within reach
        for (const ox of [-50, -25, 0, 25, 50, -80, 80]) {
          const t2 = farShoreTarget(frog.x + ox);
          const d2 = dist(frog.x, frog.y, t2.x, t2.y);
          if (d2 <= REACH + 20 && d2 > 10) {
            // avoid dupes of same landing
            if (!list.some((e) => e.p.kind === "far" && Math.abs(e.p.x - t2.x) < 12)) {
              list.push({ p: t2, d: d2 });
            }
          }
        }
      }
    }
    return list;
  }

  /**
   * Pick best pad in a direction (dx, dy). Works for forward, back, left, right.
   * dirX/dirY are preferred leap vector (need not be unit).
   */
  function bestInDirection(dirX, dirY) {
    const list = padsInReach();
    if (!list.length) return null;
    const len = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / len;
    const ny = dirY / len;

    let best = null;
    let bestS = -Infinity;
    for (const t of list) {
      const vx = t.p.x - frog.x;
      const vy = t.p.y - frog.y;
      const d = Math.hypot(vx, vy) || 1;
      const ux = vx / d;
      const uy = vy / d;
      // alignment: 1 = same direction, -1 = opposite
      const align = ux * nx + uy * ny;
      if (align < 0.25) continue; // must be roughly that way
      let s = align * 3 - t.d / REACH;
      if (t.p.kind === "far" && ny < -0.2) s += 2.5; // prefer far shore
      if (t.p.kind === "bank" && ny > 0.2) s += 1.2; // jump back to start shore
      if (s > bestS) {
        bestS = s;
        best = t.p;
      }
    }
    return best;
  }

  function bestAhead() {
    // default: toward nest (up), slight face bias
    return bestInDirection(face * 0.25, -1);
  }

  function bestLeft() {
    return bestInDirection(-1, -0.15);
  }

  function bestRight() {
    return bestInDirection(1, -0.15);
  }

  function bestBack() {
    return bestInDirection(face * 0.1, 1);
  }

  function tryLeapOrWalk(dirX, dirY) {
    if (state !== "play" || leap) return;
    const pad = bestInDirection(dirX, dirY);
    if (pad) {
      beginLeap(pad);
      return true;
    }
    // on shore, horizontal = walk if no pad that way
    if (onShore() && Math.abs(dirX) >= Math.abs(dirY)) {
      walkShore(dirX < 0 ? -1 : 1);
      return false;
    }
    return false;
  }

  function onShore() {
    return frog.pad && (frog.pad.kind === "bank" || frog.pad.kind === "far") && !leap;
  }

  function shoreY() {
    if (frog.pad && frog.pad.kind === "far") return frog.pad.baseY || BANK * 0.5;
    if (frog.pad && frog.pad.kind === "bank") return frog.pad.baseY;
    return H - BANK * 0.45;
  }

  function walkShore(dir) {
    if (!onShore()) return;
    face = dir < 0 ? -1 : 1;
    frog.x += dir * WALK_SPEED;
    frog.x = Math.max(SHORE_MARGIN, Math.min(W - SHORE_MARGIN, frog.x));
    frog.y = shoreY();
    // stay attached to shore pad object
  }

  function nearestPadInReach() {
    const list = padsInReach();
    if (!list.length) return null;
    list.sort((a, b) => a.d - b.d);
    return list[0].p;
  }

  function beginLeap(toPad) {
    if (state !== "play" || leap || !toPad) return;
    if (toPad === frog.pad) return;
    if (!toPad.open && toPad.kind === "bloom") {
      flashMsg("Bud is closed…", 50);
      return;
    }
    const d = dist(frog.x, frog.y, toPad.x, toPad.y);
    if (d > REACH + toPad.r * 0.3) {
      flashMsg("Walk closer on the shore", 50);
      return;
    }

    // whirlpool intercept?
    for (const w of whirls) {
      const mx = (frog.x + toPad.x) / 2;
      const my = (frog.y + toPad.y) / 2;
      if (dist(mx, my, w.x, w.y) < w.r + 8) {
        // pulled mid-leap — die after short leap into whirl
        leap = {
          x0: frog.x,
          y0: frog.y,
          x1: w.x,
          y1: w.y,
          t: 0,
          dur: LEAP_MS * 0.7,
          toPad: null,
          whirl: true,
        };
        frog.pad = null;
        face = toPad.x >= frog.x ? 1 : -1;
        return;
      }
    }

    leap = {
      x0: frog.x,
      y0: frog.y,
      x1: toPad.x,
      y1: toPad.y,
      t: 0,
      dur: LEAP_MS + d * 0.4,
      toPad,
      whirl: false,
    };
    frog.pad = null;
    face = toPad.x >= frog.x ? 1 : -1;
    addRipple(frog.x, frog.y, 18);
  }

  /** Eat nearby flies with tongue. range in px. Returns how many eaten. */
  function eatFlies(range) {
    let ate = 0;
    let last = null;
    for (const f of fireflies) {
      if (!f.alive) continue;
      if (dist(f.x, f.y, frog.x, frog.y) <= range) {
        f.alive = false;
        glow += 1;
        score += 50;
        ate += 1;
        last = f;
        spawnBurst(f.x, f.y, "#ffe066", 12);
      }
    }
    if (ate > 0 && last) {
      tongue = {
        x0: frog.x + face * 6,
        y0: frog.y - 4,
        x1: last.x,
        y1: last.y,
        t: 12,
      };
      flashMsg(ate === 1 ? "YUM! 🪰" : "YUM x" + ate + "!", 45);
      updateHud();
    }
    return ate;
  }

  function landOn(pad) {
    // Snap to full far shore at the x you aimed
    if (pad.kind === "far" || pad.fullShore) {
      const far = pads.find((p) => p.kind === "far");
      frog.x = Math.max(SHORE_MARGIN, Math.min(W - SHORE_MARGIN, pad.x));
      frog.y = far ? far.baseY : BANK * 0.5;
      // keep a live reference to the far pad for walking
      frog.pad = far || pad;
      frog.pad.x = frog.x;
      leap = null;
      score += 20;
      addRipple(frog.x, frog.y, 22);
      spawnBurst(frog.x, frog.y, "#ff9ad5", 8);
      eatFlies(52);

      score += 300 + pond * 80 + glow * 5;
      updateHud();
      flashMsg("Far shore!", 50);
      if (pond >= MAX_PONDS) {
        winScore.textContent = String(score);
        setState("win");
      } else {
        levelMsg.textContent = `Pond ${pond} crossed! Flies eaten: ${glow}`;
        setState("level");
      }
      return;
    }

    frog.x = pad.x;
    frog.y = pad.y;
    frog.pad = pad;
    leap = null;
    score += 20;
    addRipple(pad.x, pad.y, 22);
    spawnBurst(pad.x, pad.y, "#ff9ad5", 5);

    // Auto tongue-snap flies near landing
    eatFlies(52);

    updateHud();
  }

  // ── Input ────────────────────────────────────────────────
  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  canvas.addEventListener("pointermove", (e) => {
    if (state !== "play" || leap) return;
    const { x, y } = canvasPos(e);
    hoverPad = null;
    let best = Infinity;
    for (const t of padsInReach()) {
      const d = dist(x, y, t.p.x, t.p.y);
      if (d < t.p.r + 12 && d < best) {
        best = d;
        hoverPad = t.p;
      }
    }
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "play" || leap) return;
    const { x, y } = canvasPos(e);

    // Click far shore band — leap to that spot on the other bank
    if (y < BANK + 25 && (!frog.pad || frog.pad.kind !== "far")) {
      const target = farShoreTarget(x);
      const d = dist(frog.x, frog.y, target.x, target.y);
      if (d <= REACH + 30) {
        beginLeap(target);
        return;
      }
    }

    // On start shore: tap bank area to walk (unless tapping a pad)
    if (onShore() && frog.pad && frog.pad.kind === "bank" && y > H - BANK - 10) {
      let padClick = null;
      let best = Infinity;
      for (const t of padsInReach()) {
        const d = dist(x, y, t.p.x, t.p.y);
        if (d < t.p.r + 16 && d < best) {
          best = d;
          padClick = t.p;
        }
      }
      if (padClick) {
        beginLeap(padClick);
        return;
      }
      face = x >= frog.x ? 1 : -1;
      frog.x = Math.max(SHORE_MARGIN, Math.min(W - SHORE_MARGIN, x));
      frog.y = shoreY();
      return;
    }

    // On far shore: walk any part of the bank
    if (onShore() && frog.pad && frog.pad.kind === "far" && y < BANK + 30) {
      face = x >= frog.x ? 1 : -1;
      frog.x = Math.max(SHORE_MARGIN, Math.min(W - SHORE_MARGIN, x));
      frog.y = shoreY();
      return;
    }

    // nearest pad under cursor in reach
    let pick = null;
    let best = Infinity;
    for (const t of padsInReach()) {
      const d = dist(x, y, t.p.x, t.p.y);
      // far shore: generous click along whole bank strip
      if (t.p.kind === "far") {
        if (y < BANK + 40) {
          const ft = farShoreTarget(x);
          const df = dist(frog.x, frog.y, ft.x, ft.y);
          if (df <= REACH + 30 && df < best) {
            best = df;
            pick = ft;
          }
        }
        continue;
      }
      if (d < t.p.r + 16 && d < best) {
        best = d;
        pick = t.p;
      }
    }
    if (pick) beginLeap(pick);
    else {
      // leap toward click if a pad is roughly that direction
      const ahead = padsInReach()
        .map((t) => {
          const ang = Math.atan2(t.p.y - frog.y, t.p.x - frog.x);
          const want = Math.atan2(y - frog.y, x - frog.x);
          let da = Math.abs(ang - want);
          if (da > Math.PI) da = Math.PI * 2 - da;
          return { p: t.p, da, d: t.d };
        })
        .filter((t) => t.da < 0.55)
        .sort((a, b) => a.da - b.da || a.d - b.d)[0];
      if (ahead) beginLeap(ahead.p);
      else if (onShore()) {
        // no pad — walk along shore toward click x
        frog.x = Math.max(SHORE_MARGIN, Math.min(W - SHORE_MARGIN, x));
        frog.y = shoreY();
      }
    }
  });

  window.addEventListener("keydown", (e) => {
    const code = e.code;
    if (keys[code]) {
      // still mark held for walk, but don't re-fire leaps
      keys[code] = true;
      if (state === "play" && !leap && onShore() && (code === "ArrowLeft" || code === "KeyA" || code === "ArrowRight" || code === "KeyD")) {
        // allow held walk via keys{} in update — already true
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(code)) {
        e.preventDefault();
      }
      return;
    }
    keys[code] = true;

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(code)) {
      e.preventDefault();
    }
    if (code === "Escape") {
      if (state === "howto") closeHowto();
      else if (state === "play") setState("pause");
      else if (state === "pause") setState("play");
    }
    if (code === "KeyH") {
      if (state === "howto") closeHowto();
      else if (["title", "play", "pause"].includes(state)) openHowto();
    }
    if (state !== "play" || leap) return;

    // Directional leaps: forward, back, left, right
    if (code === "Space" || code === "ArrowUp" || code === "KeyW") {
      const b = bestAhead() || nearestPadInReach();
      if (b) beginLeap(b);
      else if (onShore()) flashMsg("Walk left/right to a closer pad", 60);
      else flashMsg("No pad that way", 40);
      return;
    }
    if (code === "ArrowDown" || code === "KeyS") {
      const b = bestBack() || bestInDirection(0, 1);
      if (b) beginLeap(b);
      else flashMsg("No pad behind", 40);
      return;
    }
    if (code === "ArrowLeft" || code === "KeyA") {
      face = -1;
      const b = bestLeft() || bestInDirection(-1, 0);
      if (b) beginLeap(b);
      else if (onShore()) walkShore(-1);
      else flashMsg("No pad left", 40);
      return;
    }
    if (code === "ArrowRight" || code === "KeyD") {
      face = 1;
      const b = bestRight() || bestInDirection(1, 0);
      if (b) beginLeap(b);
      else if (onShore()) walkShore(1);
      else flashMsg("No pad right", 40);
      return;
    }
    // Manual tongue — eat flies
    if (code === "KeyF") {
      const n = eatFlies(58);
      if (!n) flashMsg("No fly in range", 35);
      return;
    }
  });

  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  // Mobile touch D-pad — mirrors keyboard leaps
  const touchKeyMap = {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    eat: "KeyF",
  };
  function fireKey(code) {
    if (keys[code]) return;
    const ev = new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true });
    // Direct path: set keys + run leap logic like keydown handler
    keys[code] = true;
    if (state !== "play" || leap) return;
    if (code === "Space" || code === "ArrowUp" || code === "KeyW") {
      const b = bestAhead() || nearestPadInReach();
      if (b) beginLeap(b);
      else if (onShore()) flashMsg("Walk to a pad", 50);
      else flashMsg("No pad", 35);
      return;
    }
    if (code === "ArrowDown" || code === "KeyS") {
      const b = bestBack() || bestInDirection(0, 1);
      if (b) beginLeap(b);
      return;
    }
    if (code === "ArrowLeft" || code === "KeyA") {
      face = -1;
      const b = bestLeft() || bestInDirection(-1, 0);
      if (b) beginLeap(b);
      else if (onShore()) walkShore(-1);
      return;
    }
    if (code === "ArrowRight" || code === "KeyD") {
      face = 1;
      const b = bestRight() || bestInDirection(1, 0);
      if (b) beginLeap(b);
      else if (onShore()) walkShore(1);
      return;
    }
    if (code === "KeyF") {
      const n = eatFlies(58);
      if (!n) flashMsg("No fly", 30);
    }
  }
  function releaseKey(code) {
    keys[code] = false;
  }
  const touchRoot = document.getElementById("touch");
  if (touchRoot) {
    touchRoot.querySelectorAll("button[data-k]").forEach((btn) => {
      const code = touchKeyMap[btn.getAttribute("data-k")];
      if (!code) return;
      const down = (e) => {
        e.preventDefault();
        btn.classList.add("is-down");
        fireKey(code);
      };
      const up = (e) => {
        e.preventDefault();
        btn.classList.remove("is-down");
        releaseKey(code);
      };
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointerleave", up);
      btn.addEventListener("pointercancel", up);
    });
  }

  document.getElementById("btn-start").addEventListener("click", startGame);
  document.getElementById("btn-retry").addEventListener("click", startGame);
  document.getElementById("btn-replay").addEventListener("click", startGame);
  document.getElementById("btn-resume").addEventListener("click", () => setState("play"));
  document.getElementById("btn-quit").addEventListener("click", () => setState("title"));
  document.getElementById("btn-title").addEventListener("click", () => setState("title"));
  document.getElementById("btn-next").addEventListener("click", nextPond);
  ["btn-howto-title", "btn-howto-pause", "btn-howto-bar"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", openHowto);
  });
  document.getElementById("btn-howto-close").addEventListener("click", closeHowto);

  // Soft connect + post / share
  const scSave = document.getElementById("sc-save");
  if (scSave) {
    scSave.addEventListener("click", () => {
      const A = getArcade();
      if (!A) return;
      const h = document.getElementById("sc-handle");
      const a = document.getElementById("sc-alias");
      A.saveSoftConnect({ handle: h ? h.value : "", alias: a ? a.value : "DEGEN" });
      refreshSoftUI();
      flashMsg("Soft-connect saved", 50);
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

  // ── Update ───────────────────────────────────────────────
  function update() {
    animT += 1;
    if (messageT > 0) messageT -= 1;
    if (state !== "play") return;
    if (iframes > 0) iframes -= 1;

    // pads animate
    for (const p of pads) {
      if (p.kind === "bank" || p.kind === "far") continue;
      if (p.kind === "drift") {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 40 || p.x > W - 40) p.vx *= -1;
        if (p.shoreLane) {
          // stay in the near-shore jump band so they keep "coming by"
          p.y = p.baseY + Math.sin(animT * 0.03 + p.phase) * 4;
          p.vy = 0;
          if (p.x < 40) {
            p.x = 40;
            p.vx = Math.abs(p.vx);
          }
          if (p.x > W - 40) {
            p.x = W - 40;
            p.vx = -Math.abs(p.vx);
          }
        } else {
          if (p.y < BANK + 40 || p.y > H - BANK - 40) p.vy *= -1;
          p.x += Math.sin(animT * 0.02 + p.phase) * 0.15;
        }
      } else if (p.kind === "lily") {
        p.x = p.baseX + Math.sin(animT * 0.025 + p.phase) * 3;
        p.y = p.baseY + Math.cos(animT * 0.02 + p.phase) * 2.5;
      } else if (p.kind === "bloom") {
        p.x = p.baseX + Math.sin(animT * 0.02 + p.phase) * 2;
        p.y = p.baseY;
        p.bloomT += 1;
        // open/close cycle
        const phase = p.bloomT % 220;
        p.open = phase < 130;
      }
    }

    // Shore walk while holding left/right (leaps fire once on keydown)
    if (onShore() && !leap) {
      let moved = false;
      if (keys.ArrowLeft || keys.KeyA) {
        // only walk if no left-pad to leap (keydown already leaped once)
        if (!bestLeft()) {
          walkShore(-1);
          moved = true;
        }
      }
      if (keys.ArrowRight || keys.KeyD) {
        if (!bestRight()) {
          walkShore(1);
          moved = true;
        }
      }
      frog.y = shoreY();
      if (moved && animT % 8 === 0) {
        addRipple(frog.x, frog.y + 10, 10);
      }
    }

    // frog rides current floating pad (not shore)
    if (!leap && frog.pad && frog.pad.kind !== "bank" && frog.pad.kind !== "far") {
      frog.x = frog.pad.x;
      frog.y = frog.pad.y;
      if (frog.pad.kind === "bloom" && !frog.pad.open) {
        die();
        return;
      }
    }

    // leap arc
    if (leap) {
      leap.t += 1000 / 60;
      const u = Math.min(1, leap.t / leap.dur);
      // ease
      const e = u * u * (3 - 2 * u);
      frog.x = leap.x0 + (leap.x1 - leap.x0) * e;
      // parabolic height
      const arc = Math.sin(u * Math.PI) * Math.min(70, dist(leap.x0, leap.y0, leap.x1, leap.y1) * 0.45);
      frog.y = leap.y0 + (leap.y1 - leap.y0) * e - arc;

      // Mid-air snack — tongue snags flies you pass
      eatFlies(36);

      if (u >= 1) {
        if (leap.whirl) {
          leap = null;
          die();
          return;
        }
        landOn(leap.toPad);
      }
    } else if (frog.pad) {
      // Sitting on a pad/shore — auto-eat flies that buzz close
      if (animT % 6 === 0) eatFlies(40);
    }

    // tongue timer
    if (tongue) {
      tongue.t -= 1;
      if (tongue.t <= 0) tongue = null;
    }

    // flies drift (stay near host pad if any)
    for (const f of fireflies) {
      if (!f.alive) continue;
      f.x += Math.sin(animT * 0.07 + f.phase) * 0.7;
      f.y += Math.cos(animT * 0.06 + f.phase) * 0.55;
      if (f.hostId) {
        const host = pads.find((p) => p.id === f.hostId);
        if (host) {
          // soft leash to pad
          const dx = f.x - host.x;
          const dy = f.y - host.y;
          const d = Math.hypot(dx, dy);
          if (d > host.r + 36) {
            f.x -= dx * 0.08;
            f.y -= dy * 0.08;
          }
        }
      }
      f.x = Math.max(20, Math.min(W - 20, f.x));
      f.y = Math.max(BANK + 20, Math.min(H - BANK - 20, f.y));
    }

    // whirls spin
    for (const w of whirls) {
      w.phase += 0.08;
      // gentle wander
      w.x += Math.sin(animT * 0.01 + w.phase) * 0.2;
    }

    // dragonfly
    if (dragonfly) {
      dragonfly.x += dragonfly.vx;
      dragonfly.y += Math.sin(animT * 0.05 + dragonfly.phase) * 1.1;
      if (dragonfly.x < 30 || dragonfly.x > W - 30) dragonfly.vx *= -1;
      dragonfly.y = Math.max(BANK + 40, Math.min(H - BANK - 40, dragonfly.y));

      if (!leap && frog.pad && dragonfly.rideT <= 0) {
        if (dist(dragonfly.x, dragonfly.y, frog.x, frog.y) < 28) {
          // free lift toward far shore
          const lift = padsInReach().filter((t) => t.p.y < frog.y - 20).sort((a, b) => a.p.y - b.p.y)[0];
          if (lift) {
            flashMsg("Dragonfly lift!", 50);
            score += 30;
            beginLeap(lift.p);
            dragonfly.rideT = 240;
          } else {
            const farT = farShoreTarget(frog.x);
            if (farT && dist(frog.x, frog.y, farT.x, farT.y) < REACH * 1.5) {
              flashMsg("Dragonfly lift!", 50);
              beginLeap(farT);
              dragonfly.rideT = 240;
            }
          }
        }
      }
      if (dragonfly.rideT > 0) dragonfly.rideT -= 1;
    }

    // heron shadow event
    heron.t -= 1;
    if (!heron.active && heron.t <= 0) {
      heron.active = true;
      heron.danger = 100 + pond * 10;
      heron.x = frog.x;
      flashMsg("Heron shadow — stay still!", 70);
    }
    if (heron.active) {
      heron.danger -= 1;
      heron.x += (frog.x - heron.x) * 0.04;
      // if frog leaps during heron, risk
      if (leap && Math.random() < 0.02 + pond * 0.005) {
        heron.active = false;
        heron.t = 280 + Math.random() * 200;
        flashMsg("Heron snatches!", 60);
        die();
        return;
      }
      // if still on pad, safe
      if (heron.danger <= 0) {
        heron.active = false;
        heron.t = 260 + Math.random() * 220;
        if (!leap) score += 25;
      }
    }

    particles = particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
      return p.life > 0;
    });
    ripples = ripples.filter((r) => {
      r.r += 0.9;
      r.life -= 1;
      return r.life > 0;
    });
  }

  // ── Draw ─────────────────────────────────────────────────
  function draw() {
    // pond background — soft organic water, not lanes
    const g = ctx.createRadialGradient(W * 0.5, H * 0.55, 20, W * 0.5, H * 0.5, H * 0.7);
    g.addColorStop(0, "#5a2890");
    g.addColorStop(0.45, "#3a1868");
    g.addColorStop(1, "#1a0c30");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // soft caustics
    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 8; i++) {
      const cx = (Math.sin(animT * 0.01 + i) * 0.5 + 0.5) * W;
      const cy = (Math.cos(animT * 0.008 + i * 1.3) * 0.5 + 0.5) * H;
      ctx.fillStyle = i % 2 ? "#ff80c8" : "#a080ff";
      ctx.beginPath();
      ctx.ellipse(cx, cy, 40 + i * 8, 18, animT * 0.01, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // heron darken
    if (heron.active) {
      ctx.fillStyle = `rgba(10, 8, 20, ${0.25 + Math.sin(animT * 0.2) * 0.05})`;
      ctx.fillRect(0, 0, W, H);
      // shadow oval
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(heron.x, frog.y - 40, 50, 70, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // banks — soft curved reed shores
    drawShore(true);
    drawShore(false);

    // whirls
    for (const w of whirls) {
      drawWhirl(w);
    }

    // pads
    for (const p of pads) {
      if (p.kind === "bank" || p.kind === "far") continue;
      drawLily(p);
    }
    // far shore glow strip when jumpable
    if (state === "play" && !leap && frog.pad && frog.pad.kind !== "far") {
      const farT = farShoreTarget(frog.x);
      if (farT && dist(frog.x, frog.y, farT.x, farT.y) <= REACH + 28) {
        ctx.fillStyle = "rgba(255, 180, 220, 0.2)";
        ctx.fillRect(0, 0, W, BANK);
        ctx.strokeStyle = "rgba(255, 230, 120, 0.75)";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(SHORE_MARGIN, farT.y);
        ctx.lineTo(W - SHORE_MARGIN, farT.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255, 230, 160, 0.9)";
        ctx.font = "16px VT323, monospace";
        ctx.textAlign = "center";
        ctx.fillText("↑ leap anywhere on far shore", W / 2, farT.y + 4);
      }
    }

    // flies (clear yellow bugs)
    for (const f of fireflies) {
      if (!f.alive) continue;
      const pulse = 0.65 + Math.sin(animT * 0.2 + f.phase) * 0.35;
      // glow
      ctx.fillStyle = `rgba(255, 240, 80, ${0.25 * pulse})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 11, 0, Math.PI * 2);
      ctx.fill();
      // body
      ctx.fillStyle = `rgba(40, 30, 10, ${0.9})`;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // wings
      ctx.fillStyle = `rgba(255, 255, 200, ${0.55 * pulse})`;
      const flap = Math.sin(animT * 0.5 + f.phase) * 2;
      ctx.fillRect(f.x - 7, f.y - 2 - flap, 5, 3);
      ctx.fillRect(f.x + 2, f.y - 2 + flap, 5, 3);
      // bright core
      ctx.fillStyle = `rgba(255, 230, 60, ${pulse})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // tongue snap
    if (tongue && tongue.t > 0) {
      const u = tongue.t / 12;
      ctx.strokeStyle = `rgba(255, 120, 160, ${u})`;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(tongue.x0, tongue.y0);
      ctx.lineTo(tongue.x1, tongue.y1);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 80, 120, ${u})`;
      ctx.beginPath();
      ctx.arc(tongue.x1, tongue.y1, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // dragonfly
    if (dragonfly) drawDragonfly(dragonfly);

    // reach ring + hover + shore walk cue
    if (state === "play" && !leap) {
      ctx.strokeStyle = "rgba(255, 140, 200, 0.22)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.arc(frog.x, frog.y, REACH, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // on bank: show walk arrows hint on shore
      if (onShore()) {
        ctx.fillStyle = "rgba(255, 180, 220, 0.35)";
        ctx.font = "22px VT323, monospace";
        ctx.textAlign = "center";
        ctx.fillText("◀ walk ▶", frog.x, frog.y + 36);
        // highlight pads you can reach from here
        const reachable = padsInReach();
        if (!reachable.length) {
          ctx.fillStyle = "rgba(255, 220, 160, 0.8)";
          ctx.font = "16px VT323, monospace";
          ctx.fillText("walk to a closer pad", frog.x, frog.y - 28);
        }
      }

      for (const t of padsInReach()) {
        const hot = hoverPad === t.p;
        ctx.strokeStyle = hot ? "rgba(255, 230, 120, 0.95)" : "rgba(255, 180, 220, 0.55)";
        ctx.lineWidth = hot ? 3 : 2;
        ctx.beginPath();
        ctx.arc(t.p.x, t.p.y, t.p.r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // aim ghost
      if (hoverPad) {
        drawLeapArc(frog.x, frog.y, hoverPad.x, hoverPad.y, "rgba(255, 150, 200, 0.45)");
      }
    }

    // leap trail
    if (leap) {
      drawLeapArc(leap.x0, leap.y0, leap.x1, leap.y1, "rgba(255, 120, 190, 0.35)");
    }

    // ripples
    for (const r of ripples) {
      ctx.strokeStyle = `rgba(200, 180, 255, ${r.life / 35})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // frog
    if (state === "play" || state === "pause" || state === "level") {
      if (!(iframes > 0 && Math.floor(iframes / 4) % 2 === 0)) {
        drawFrog(frog.x, frog.y, face, !!leap);
      }
    } else if (state === "title") {
      drawFrog(W / 2, H - BANK * 0.45, 1, false);
    }

    // particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 30);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // message
    if (messageT > 0 && message) {
      ctx.fillStyle = "rgba(20, 8, 24, 0.65)";
      ctx.fillRect(W / 2 - 120, 16, 240, 28);
      ctx.fillStyle = "#ffe0f0";
      ctx.font = "18px VT323, monospace";
      ctx.textAlign = "center";
      ctx.fillText(message, W / 2, 36);
    }
  }

  function drawShore(far) {
    const y0 = far ? 0 : H - BANK;
    ctx.fillStyle = far ? "#3a2048" : "#4a2858";
    ctx.beginPath();
    if (far) {
      ctx.moveTo(0, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(W, BANK * 0.7);
      for (let x = W; x >= 0; x -= 20) {
        ctx.lineTo(x, BANK * 0.55 + Math.sin(x * 0.08 + animT * 0.02) * 6);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(0, H);
      ctx.lineTo(W, H);
      ctx.lineTo(W, H - BANK * 0.7);
      for (let x = W; x >= 0; x -= 20) {
        ctx.lineTo(x, H - BANK * 0.55 + Math.sin(x * 0.08) * 5);
      }
      ctx.closePath();
    }
    ctx.fill();

    // reeds
    ctx.strokeStyle = "#c04080";
    ctx.lineWidth = 2;
    for (let x = 12; x < W; x += 22) {
      const base = far ? BANK * 0.5 : H - BANK * 0.45;
      const h = 18 + (x % 40) / 4;
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.quadraticCurveTo(x + 4, base - h * 0.5, x + (far ? 2 : -2), base - h);
      ctx.stroke();
    }

    ctx.fillStyle = far ? "#ff9ad5" : "#ffb3d9";
    ctx.font = "15px VT323, monospace";
    ctx.textAlign = "center";
    ctx.fillText(far ? "☾ FAR SHORE  (land anywhere)" : "BANK  (walk · leap pads)", W / 2, far ? 28 : H - 18);
  }

  function drawLily(p) {
    if (p.kind === "bloom" && !p.open) {
      // closed bud
      ctx.fillStyle = "#6a3a80";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r * 0.55, p.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c8a0ff";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 4, p.r * 0.35, p.r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const bob = Math.sin(animT * 0.05 + p.phase) * 0.5;
    ctx.fillStyle = p.kind === "drift" ? "#3a9850" : "#2d8a42";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + bob, p.r, p.r * 0.72, p.phase * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // pink rim
    ctx.strokeStyle = p.kind === "drift" ? "#ff7ac8" : "rgba(255, 140, 190, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + bob, p.r, p.r * 0.72, p.phase * 0.1, 0, Math.PI * 2);
    ctx.stroke();

    // notch
    ctx.fillStyle = "#4a2090";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + bob);
    ctx.lineTo(p.x + p.r, p.y + bob - 4);
    ctx.lineTo(p.x + p.r, p.y + bob + 4);
    ctx.fill();

    if (p.kind === "bloom" && p.open) {
      // flower
      ctx.fillStyle = "#ff80d0";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + animT * 0.01;
        ctx.beginPath();
        ctx.ellipse(p.x + Math.cos(a) * 6, p.y + bob + Math.sin(a) * 4, 5, 3, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffe066";
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWhirl(w) {
    ctx.strokeStyle = "rgba(140, 200, 255, 0.45)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r - i * 6, w.phase + i, w.phase + i + Math.PI * 1.2);
      ctx.stroke();
    }
  }

  function drawDragonfly(d) {
    ctx.fillStyle = "#ffaa44";
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const flap = Math.sin(animT * 0.5) * 5;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(d.x - 12, d.y - 3 - flap, 10, 3);
    ctx.fillRect(d.x + 2, d.y - 3 + flap, 10, 3);
  }

  function drawLeapArc(x0, y0, x1, y1, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2 - Math.min(70, dist(x0, y0, x1, y1) * 0.45);
    ctx.quadraticCurveTo(mx, my, x1, y1);
    ctx.stroke();
  }

  function drawFrog(x, y, faceDir, midLeap) {
    const s = midLeap ? 1.08 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // body
    ctx.fillStyle = "#ff4da6";
    ctx.beginPath();
    ctx.ellipse(0, 2, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff7ac8";
    ctx.beginPath();
    ctx.ellipse(faceDir * 2, -7, 10, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = "#fff8fc";
    ctx.beginPath();
    ctx.arc(faceDir * 2 - 4, -9, 3.2, 0, Math.PI * 2);
    ctx.arc(faceDir * 2 + 4, -9, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a0a14";
    ctx.beginPath();
    ctx.arc(faceDir * 2 - 3 + faceDir, -9, 1.6, 0, Math.PI * 2);
    ctx.arc(faceDir * 2 + 5 + faceDir, -9, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // blush
    ctx.fillStyle = "rgba(255, 160, 200, 0.55)";
    ctx.beginPath();
    ctx.arc(-9, 1, 3, 0, Math.PI * 2);
    ctx.arc(9, 1, 3, 0, Math.PI * 2);
    ctx.fill();
    // legs
    if (!midLeap) {
      ctx.strokeStyle = "#e040a0";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-8, 8);
      ctx.quadraticCurveTo(-14, 12, -16, 16);
      ctx.moveTo(8, 8);
      ctx.quadraticCurveTo(14, 12, 16, 16);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#e040a0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-6, 6);
      ctx.lineTo(-12, 0);
      ctx.moveTo(6, 6);
      ctx.lineTo(12, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // Prefer daily seed even on title preview layout
  (function initRng() {
    const daily = getDaily();
    if (daily && daily.seed) rng = mulberry32(seedFromDaily(daily.day, daily.seed));
  })();
  buildPond(1);
  updateHud();
  refreshDailyUI();
  refreshSoftUI();
  setState("title");
  loop();
})();
