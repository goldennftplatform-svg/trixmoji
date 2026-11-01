(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  let filter = "all";
  let search = "";
  let killCount = 0;
  let used = new Set();
  let busy = false;
  let viewers = 1337;
  let timers = [];
  let moveRaf = 0;
  let moveMode = null;
  let moveOpts = {};
  let paulyUnlocked = false;
  let justDidPauly = false;

  // restore progress within this browser session (unless ?fresh=1)
  try {
    if (/[?&]fresh=1(?:&|$)/.test(location.search)) {
      sessionStorage.removeItem("apeChamberUsed");
    } else {
      const saved = JSON.parse(sessionStorage.getItem("apeChamberUsed") || "[]");
      if (Array.isArray(saved)) saved.forEach((id) => used.add(Number(id)));
    }
  } catch (_) {}

  const randomOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function persistUsed() {
    try {
      sessionStorage.setItem("apeChamberUsed", JSON.stringify([...used]));
    } catch (_) {}
  }

  function isPaulyUnlocked() {
    return BASE_PROTOCOL_IDS.every((id) => used.has(id));
  }

  function baseClearCount() {
    return BASE_PROTOCOL_IDS.filter((id) => used.has(id)).length;
  }

  function refreshPaulyUnlock() {
    const was = paulyUnlocked;
    paulyUnlocked = isPaulyUnlocked();
    updateHubUI();
    if (paulyUnlocked && !was) {
      setBubble("CHANNEL 2 OPEN", "MENU");
    }
    return paulyUnlocked;
  }

  function updateHubUI() {
    const unlocked = isPaulyUnlocked();
    paulyUnlocked = unlocked;
    const btn = $("#pauly-hub-btn");
    const title = $("#pauly-hub-title");
    const desc = $("#pauly-hub-desc");
    const arrow = $("#pauly-hub-arrow");
    const n = baseClearCount();

    if (!btn) return;

    if (unlocked) {
      btn.disabled = false;
      btn.setAttribute("aria-disabled", "false");
      btn.classList.remove("hub-option-locked");
      btn.classList.add("hub-option-pauly");
      if (title) title.textContent = "PAULY PUNCH";
      if (desc) desc.textContent = "";
      if (arrow) arrow.textContent = "->";
    } else {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
      btn.classList.add("hub-option-locked");
      btn.classList.remove("hub-option-pauly");
      if (title) title.textContent = "????????";
      if (desc) desc.textContent = `${n}/10`;
      if (arrow) arrow.textContent = "??";
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setBubble(main, sub) {
    const el = $("#status-bubble");
    if (!el) return;
    const subHtml = sub
      ? `<div class="status-sub">${escapeHtml(sub)}</div>`
      : `<div class="status-sub"></div>`;
    el.innerHTML = `<div class="status-main">${escapeHtml(main)}</div>${subHtml}`;
  }

  function tickViewers() {
    /* no fake live viewer count */
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
    stopMoveLoop();
  }

  function later(ms, fn) {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  /* ─── Movement engine ─── */
  function stopMoveLoop() {
    if (moveRaf) cancelAnimationFrame(moveRaf);
    moveRaf = 0;
    moveMode = null;
  }

  function startMoveLoop(mode, opts = {}) {
    stopMoveLoop();
    moveMode = mode;
    moveOpts = opts;
    const actor = $("#ape-actor");
    if (!actor) return;

    const t0 = performance.now();
    let lastThrash = 0;
    let staggerX = 50;
    let staggerDir = 1;

    function frame(now) {
      if (moveMode !== mode) return;
      const t = (now - t0) / 1000;
      const speed = moveOpts.runSpeed || 1;
      const yBias = moveOpts.yBias != null ? moveOpts.yBias : 58;

      if (mode === "run") {
        const ang = t * 3.2 * speed;
        const x = 50 + Math.sin(ang) * 30;
        const y = yBias + Math.abs(Math.sin(ang * 2)) * 5;
        actor.style.left = x + "%";
        actor.style.top = y + "%";
        actor.classList.toggle("flip", Math.cos(ang) < 0);
      } else if (mode === "stagger") {
        staggerX += staggerDir * (0.35 + Math.sin(t * 4) * 0.15);
        if (staggerX > 78) staggerDir = -1;
        if (staggerX < 22) staggerDir = 1;
        actor.style.left = staggerX + "%";
        actor.style.top = yBias + Math.sin(t * 6) * 1.5 + "%";
        actor.classList.toggle("flip", staggerDir < 0);
      } else if (mode === "thrash") {
        if (now - lastThrash > 90) {
          lastThrash = now;
          actor.style.left = 20 + Math.random() * 60 + "%";
          actor.style.top = yBias - 8 + Math.random() * 16 + "%";
          actor.classList.toggle("flip", Math.random() > 0.5);
        }
      } else if (mode === "float") {
        const x = 50 + Math.sin(t * 2.2) * 18;
        const y = yBias + Math.sin(t * 3.1) * 6;
        actor.style.left = x + "%";
        actor.style.top = y + "%";
      } else if (mode === "spin") {
        // CSS handles rotate; orbit slightly
        const x = 50 + Math.sin(t * 8) * 12;
        const y = yBias + Math.cos(t * 8) * 8;
        actor.style.left = x + "%";
        actor.style.top = y + "%";
      } else if (mode === "climb") {
        // press upward against water/acid line
        const x = 50 + Math.sin(t * 4) * 22;
        const y = yBias + Math.sin(t * 5) * 3;
        actor.style.left = x + "%";
        actor.style.top = y + "%";
        actor.classList.toggle("flip", Math.cos(t * 4) < 0);
      } else if (mode === "pull") {
        // vacuum drag toward center with fight
        const fight = Math.sin(t * 9) * 18;
        const pull = Math.min(1, t / 2.2);
        const x = 50 + fight * (1 - pull * 0.7);
        const y = yBias + Math.sin(t * 5) * 4 * (1 - pull);
        actor.style.left = x + "%";
        actor.style.top = y + "%";
        actor.classList.toggle("flip", fight < 0);
      } else if (mode === "spasm") {
        actor.style.left = 50 + (Math.random() * 10 - 5) + "%";
        actor.style.top = yBias + (Math.random() * 8 - 4) + "%";
      } else if (mode === "shiver") {
        actor.style.left = 50 + Math.sin(t * 28) * 2 + "%";
        actor.style.top = yBias + Math.sin(t * 31) * 1.2 + "%";
      } else if (mode === "sink") {
        const p = Math.min(1, t / 1.5);
        actor.style.left = "50%";
        actor.style.top = yBias + p * 30 + "%";
        actor.style.opacity = String(1 - p * 0.55);
      }

      moveRaf = requestAnimationFrame(frame);
    }

    moveRaf = requestAnimationFrame(frame);
  }

  /* ─── Ape actor ─── */
  function setApe(key, opts = {}) {
    const img = $("#ape-sprite");
    const actor = $("#ape-actor");
    if (!img || !actor) return;

    const move = opts.move || "idle";
    stopMoveLoop();

    if (key === "hide") {
      actor.classList.add("hidden");
      actor.style.opacity = "";
      return;
    }
    actor.classList.remove("hidden");
    actor.style.opacity = "";

    const src = SPRITES[key];
    if (src) {
      img.src = src;
      img.alt = key;
    }

    actor.classList.toggle("flip", !!opts.flip);
    actor.classList.toggle("wide", key === "dead" || key === "fire_run" || key === "drown" || key === "electro");
    actor.classList.toggle("dead-pose", key === "dead");
    actor.classList.toggle("skeleton-pose", key === "skeleton");

    // default resting pose position
    if (!["run", "stagger", "thrash", "float", "spin", "climb", "pull", "spasm", "shiver", "sink"].includes(move)) {
      actor.style.left = "50%";
      if (key === "dead") actor.style.top = "78%";
      else if (key === "skeleton") actor.style.top = "60%";
      else actor.style.top = (opts.yBias != null ? opts.yBias : 58) + "%";
    } else if (opts.yBias != null && move !== "run") {
      actor.style.top = opts.yBias + "%";
    }

    actor.classList.remove(
      "move-idle", "move-shake", "move-run", "move-float", "move-spin",
      "move-sink", "move-squash", "move-none", "move-stagger", "move-thrash",
      "move-climb", "move-pull", "move-spasm", "move-shiver"
    );
    actor.classList.add("move-" + move);

    const loopMoves = ["run", "stagger", "thrash", "float", "spin", "climb", "pull", "spasm", "shiver", "sink"];
    if (loopMoves.includes(move)) {
      startMoveLoop(move, opts);
    }
  }

  function resetApePosition() {
    const actor = $("#ape-actor");
    if (!actor) return;
    stopMoveLoop();
    actor.style.left = "50%";
    actor.style.top = "58%";
    actor.style.opacity = "";
    actor.classList.remove("flip", "hidden", "wide", "dead-pose", "skeleton-pose");
    setApe("idle", { move: "idle" });
  }

  /* ─── Chamber FX ─── */
  function setFX(kit) {
    const layer = $("#exec-layer");
    const roomFx = $("#room-fx");
    if (!layer) return;

    // Pauly smash lives on full-room layer; clear glass FX when fist hits
    if (kit && String(kit).startsWith("pauly_")) {
      layer.innerHTML = kit === "pauly_shadow" ? buildFX("pauly_shadow_glass") : "";
      if (roomFx) {
        // Don't rebuild identical mess frames (prevents a second fist flash)
        if (roomFx.dataset.paulyKit === kit && kit === "pauly_mess") return;
        roomFx.dataset.paulyKit = kit;
        roomFx.innerHTML = buildFX(kit);
      }
      const room = $("#sim-room");
      if (kit === "pauly_impact" || kit === "pauly_aftermath" || kit === "pauly_mess") {
        room && room.classList.add("chamber-smashed");
      }
      return;
    }
    if (roomFx) delete roomFx.dataset.paulyKit;

    if (roomFx) roomFx.innerHTML = "";
    layer.innerHTML = buildFX(kit);
  }

  function setRoomShake(on) {
    const room = $("#sim-room");
    if (!room) return;
    room.classList.toggle("hard-shake", !!on);
  }

  function openPaulyVideo() {
    const modal = $("#pauly-video-modal");
    const vid = $("#pauly-video");
    const closeBtn = $("#pauly-close");
    if (!modal || !vid) return;

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    if (closeBtn) closeBtn.classList.add("hidden");

    // No chrome — force autoplay (try with sound, fall back to muted)
    vid.removeAttribute("controls");
    vid.controls = false;
    vid.setAttribute("playsinline", "");
    vid.setAttribute("webkit-playsinline", "");

    const showDone = () => {
      if (closeBtn) closeBtn.classList.remove("hidden");
    };

    vid.onended = () => {
      showDone();
      // auto-dismiss shortly after end
      later(800, () => {
        closePaulyVideo();
        if (justDidPauly) {
          $("#result").classList.remove("hidden");
          justDidPauly = false;
        }
      });
    };

    const tryPlay = (muted) => {
      vid.muted = !!muted;
      try {
        vid.currentTime = 0;
      } catch (_) {}
      const p = vid.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          // If we had to mute to start, unmute when possible
          if (muted) {
            try {
              vid.muted = false;
            } catch (_) {}
          }
        }).catch(() => {
          if (!muted) tryPlay(true);
          else showDone();
        });
      }
    };

    tryPlay(false);
  }

  function closePaulyVideo() {
    const modal = $("#pauly-video-modal");
    const vid = $("#pauly-video");
    const closeBtn = $("#pauly-close");
    if (vid) {
      vid.onended = null;
      vid.pause();
      try { vid.currentTime = 0; } catch (_) {}
      vid.controls = false;
    }
    if (closeBtn) closeBtn.classList.add("hidden");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function swarm(emoji, count, extraClass = "") {
    let html = `<div class="fx-swarm ${extraClass}">`;
    for (let i = 0; i < count; i++) {
      const left = 4 + Math.random() * 92;
      const top = 4 + Math.random() * 92;
      const delay = (Math.random() * 0.9).toFixed(2);
      const size = 10 + Math.floor(Math.random() * 14);
      const dx = (Math.random() * 56 - 28).toFixed(0);
      const dy = (Math.random() * 56 - 28).toFixed(0);
      const dur = (0.35 + Math.random() * 0.45).toFixed(2);
      html += `<span style="left:${left}%;top:${top}%;font-size:${size}px;animation-delay:${delay}s;animation-duration:${dur}s;--dx:${dx}px;--dy:${dy}px">${emoji}</span>`;
    }
    return html + `</div>`;
  }

  function liquid(kind, pct, extra = "") {
    return `<div class="fx-liquid ${kind} ${extra}" style="--lvl:${pct}%"><div class="meniscus"></div><div class="bub"></div><div class="bub"></div><div class="bub"></div></div>`;
  }

  function buildFX(kit) {
    switch (kit) {
      case "none":
        return "";

      /* fire */
      case "embers":
        return `<div class="fx-embers"></div><div class="fx-heat-shimmer"></div>`;
      case "embers_hot":
        return `<div class="fx-embers hot"></div><div class="fx-heat-shimmer"></div><div class="fx-smoke light"></div>`;
      case "inferno":
        return `<div class="fx-inferno"><div class="fl"></div><div class="fl"></div><div class="fl"></div><div class="fl"></div></div><div class="fx-heat-shimmer"></div>`;
      case "inferno_max":
        return `<div class="fx-inferno max"><div class="fl"></div><div class="fl"></div><div class="fl"></div><div class="fl"></div><div class="fl"></div></div><div class="fx-heat-shimmer"></div>`;
      case "ash":
        return `<div class="fx-ash"></div><div class="fx-smoke light"></div>`;

      /* water levels */
      case "water_15":
        return liquid("water", 15, "rise-anim");
      case "water_40":
        return liquid("water", 40, "rise-anim");
      case "water_70":
        return liquid("water", 70, "rise-anim");
      case "water_100":
        return liquid("water", 100, "rise-anim");
      case "water_100_quiet":
        return liquid("water", 100, "quiet");
      case "water_drain":
        return liquid("water", 100, "drain-anim");

      /* piranha */
      case "piranha_enter":
        return liquid("water", 100) + swarm("🐟", 12, "enter");
      case "piranha_tornado":
        return liquid("water", 100, "bloody") + `<div class="fx-tornado">${swarm("🐟", 32)}</div>`;
      case "piranha_frenzy":
        return liquid("water", 100, "bloody hard") + `<div class="fx-tornado fast">${swarm("🐟", 42)}</div><div class="fx-red-flash"></div>`;

      /* gas */
      case "gas_wisp":
        return `<div class="fx-gas wisp"></div>`;
      case "gas_green":
        return `<div class="fx-gas green"></div>`;
      case "gas_thick":
        return `<div class="fx-gas green thick"></div>`;
      case "gas_fade":
        return `<div class="fx-gas green fade"></div>`;

      /* electric */
      case "charge_glow":
        return `<div class="fx-charge"></div>`;
      case "zap_hit":
        return `<div class="fx-electric hit"><i></i><i></i><i></i><div class="flash"></div></div>`;
      case "electric_full":
        return `<div class="fx-electric"><i></i><i></i><i></i><i></i><div class="flash"></div></div>`;
      case "electric_max":
        return `<div class="fx-electric max"><i></i><i></i><i></i><i></i><i></i><div class="flash"></div></div>`;
      case "blackout":
        return `<div class="fx-blackout"></div>`;
      case "smoke":
        return `<div class="fx-smoke"></div>`;
      case "smoke_light":
        return `<div class="fx-smoke light"></div>`;

      /* bees */
      case "bees_few":
        return swarm("🐝", 8);
      case "bees_swarm":
        return swarm("🐝", 22);
      case "bees_chase":
        return swarm("🐝", 30, "chase");
      case "bees_thick":
        return swarm("🐝", 48, "thick");
      case "bees_settle":
        return swarm("🐝", 18, "settle");

      /* fart */
      case "fart_puff":
        return `<div class="fx-gas fart"></div><div class="fx-fart-label">*PPBBBBT*</div>`;
      case "fart_cloud":
        return `<div class="fx-gas fart mid"></div><div class="fx-fart-label">*ppbbt*</div>${swarm("💨", 10)}`;
      case "fart_double":
        return `<div class="fx-gas fart thick"></div><div class="fx-fart-label">*PPBBT PPBBT*</div>${swarm("💨", 16)}`;
      case "fart_thick":
        return `<div class="fx-gas fart thick"></div>${swarm("💨", 20)}`;
      case "fart_haze":
        return `<div class="fx-gas fart fade"></div>`;

      /* cryo */
      case "frost":
        return `<div class="fx-frost"></div>`;
      case "frost_heavy":
        return `<div class="fx-frost heavy"></div>`;
      case "ice_block":
        return `<div class="fx-frost heavy"></div><div class="fx-ice-rim"></div>`;
      case "ice_thick":
        return `<div class="fx-frost heavy"></div><div class="fx-ice-rim thick"></div>`;
      case "ice_crack":
        return `<div class="fx-frost heavy"></div><div class="fx-ice-rim thick"></div><div class="fx-crack"></div>`;

      /* acid */
      case "acid_sizzle":
        return `<div class="fx-acid-sizzle"></div>` + liquid("acid", 8, "rise-anim");
      case "acid_25":
        return liquid("acid", 25, "rise-anim");
      case "acid_55":
        return liquid("acid", 55, "rise-anim");
      case "acid_100":
        return liquid("acid", 100, "rise-anim");
      case "acid_drain":
        return liquid("acid", 100, "drain-anim");

      /* vacuum */
      case "vacuum":
        return `<div class="fx-vacuum"></div>`;
      case "vacuum_hard":
        return `<div class="fx-vacuum hard"></div>`;
      case "vacuum_max":
        return `<div class="fx-vacuum max"></div>`;
      case "vacuum_quiet":
        return `<div class="fx-vacuum quiet"></div>`;

      /* PAULY PUNCH — giant fist crashes through chamber */
      case "pauly_shadow_glass":
        return `<div class="fx-pauly-dim"></div>`;
      case "pauly_shadow":
        return `
          <div class="fx-pauly-shadow"></div>
          <div class="fx-pauly-fist-wrap approach">
            <img class="fx-pauly-fist-img" src="assets/sprites/fist.png" alt="PAULY FIST" draggable="false" />
          </div>
          <div class="fx-pauly-label">FIST INBOUND</div>`;
      case "pauly_fist":
        return `
          <div class="fx-pauly-whoosh"></div>
          <div class="fx-pauly-speedlines"></div>
          <div class="fx-pauly-fist-wrap strike">
            <img class="fx-pauly-fist-img" src="assets/sprites/fist.png" alt="PAULY FIST" draggable="false" />
          </div>
          <div class="fx-pauly-label hot">PAULY PUNCH!!!</div>`;
      case "pauly_impact":
        return `
          <div class="fx-impact-flash"></div>
          <div class="fx-pauly-fist-wrap impact">
            <img class="fx-pauly-fist-img" src="assets/sprites/fist.png" alt="PAULY FIST" draggable="false" />
          </div>
          <div class="fx-glass-shatter"></div>
          <div class="fx-glass-shards"></div>
          <div class="fx-blood-burst"></div>
          <div class="fx-guts"></div>
          <div class="fx-water-splash"></div>
          <div class="fx-pauly-label hot">DIRECT HIT</div>`;
      case "pauly_aftermath":
        // Single leave pass — one fist only
        return `
          <div class="fx-glass-shatter settled"></div>
          <div class="fx-glass-shards settled"></div>
          <div class="fx-blood-pool"></div>
          <div class="fx-guts settled"></div>
          <div class="fx-water-splash settled"></div>
          <div class="fx-pauly-fist-wrap leave">
            <img class="fx-pauly-fist-img" src="assets/sprites/fist.png" alt="PAULY FIST" draggable="false" />
          </div>`;
      case "pauly_mess":
        // Mess holds; no fist (avoids a second punch after leave)
        return `
          <div class="fx-glass-shatter settled"></div>
          <div class="fx-glass-shards settled"></div>
          <div class="fx-blood-pool"></div>
          <div class="fx-guts settled"></div>
          <div class="fx-water-splash settled"></div>`;

      default:
        return "";
    }
  }

  /* ─── Sequence player ─── */
  function playSequence(method) {
    return new Promise((resolve) => {
      clearTimers();
      const room = $("#sim-room");
      room.classList.add("executing");
      setRoomShake(false);
      resetApePosition();
      setFX("none");

      (method.stages || []).forEach((stage) => {
        later(stage.at, () => {
          setApe(stage.ape, {
            flip: stage.flip,
            move: stage.move || "idle",
            runSpeed: stage.runSpeed,
            yBias: stage.yBias,
          });
          if (stage.fx != null) setFX(stage.fx);
          if (stage.caption) setBubble(stage.caption, method.name.toUpperCase());
          setRoomShake(!!stage.roomShake);
        });
      });

      later(method.duration || 6000, () => {
        room.classList.remove("executing");
        setRoomShake(false);
        stopMoveLoop();
        resolve();
      });
    });
  }

  /* ─── UI ─── */
  function filteredMethods() {
    refreshPaulyUnlock();
    return getAllMethods().filter((m) => {
      if (m.special && m.unlock === "all_base" && !paulyUnlocked) return false;
      if (filter === "historic" && m.type !== "historic") return false;
      if (filter === "funny" && m.type !== "funny") return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${m.name} ${m.desc} ${m.era}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  function renderList() {
    refreshPaulyUnlock();
    const list = $("#method-list");
    const items = filteredMethods();

    const seenBase = BASE_PROTOCOL_IDS.filter((id) => used.has(id)).length;
    list.innerHTML =
      items
        .map(
          (m) => `
      <button type="button" class="method-card ${used.has(m.id) ? "used" : ""} ${m.special ? "special" : ""}" data-id="${m.id}">
        <span class="num">${m.special ? "!!" : String(m.id).padStart(2, "0")}</span>
        <span class="name">${escapeHtml(m.name.toUpperCase())}</span>
        <span class="badge ${m.special ? "special" : m.type}">${m.special ? "BOSS" : m.type === "historic" ? "GRIM" : "LOL"}</span>
      </button>`
        )
        .join("");

    list.querySelectorAll(".method-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const method = getAllMethods().find((m) => m.id === Number(btn.dataset.id));
        if (!method) return;
        if (method.special && !isPaulyUnlocked()) return;
        execute(method);
      });
    });

    const weekEl = $("#week-label");
    if (weekEl) {
      weekEl.textContent = `${seenBase}/10`;
    }
  }

  async function execute(method) {
    if (busy) return;
    if (method.special && !isPaulyUnlocked()) return;
    busy = true;
    justDidPauly = false;
    $("#result").classList.add("hidden");
    closePaulyVideo();

    $("#now-title").textContent = method.name.toUpperCase();
    $("#now-credit").textContent = "";
    $("#last-method").textContent = method.name.toUpperCase();

    await playSequence(method);

    // Only base protocols count toward the secret unlock
    if (!method.special) {
      used.add(method.id);
      persistUsed();
    } else {
      used.add(method.id);
      persistUsed();
    }
    killCount += 1;
    $("#kill-count").textContent = `${killCount} EXECUTED`;

    const newlyUnlocked = !paulyUnlocked && isPaulyUnlocked();
    refreshPaulyUnlock();

    if (method.special && method.video) {
      justDidPauly = true;
      openPaulyVideo();
      showResult(method, true);
    } else {
      showResult(method, false);
      if (newlyUnlocked) {
        // Surface discovery hint on the result card era line
        const era = $("#result-era");
        if (era) {
          era.textContent = "CHANNEL 2 — MENU";
          era.style.color = "#ff66cc";
        }
        setBubble("CHANNEL 2 OPEN", "MENU");
      }
    }

    renderList();
    busy = false;
  }

  function showResult(method, skipAuto = false) {
    const typeEl = $("#result-type");
    if (method.special) {
      typeEl.textContent = "SECRET PROTOCOL";
      typeEl.className = "result-type special";
    } else {
      typeEl.textContent = method.type === "historic" ? "GRIM PROTOCOL" : "ABSURD PROTOCOL";
      typeEl.className = `result-type ${method.type}`;
    }
    $("#result-name").textContent = method.name.toUpperCase();
    $("#result-desc").textContent = method.desc;
    $("#result-era").textContent = method.era.toUpperCase();
    // For Pauly, keep result hidden until video closes (tape is the payoff)
    if (skipAuto) {
      $("#result").classList.add("hidden");
    } else {
      $("#result").classList.remove("hidden");
    }
  }

  function resetChamber() {
    clearTimers();
    $("#exec-layer").innerHTML = "";
    const roomFx = $("#room-fx");
    if (roomFx) {
      roomFx.innerHTML = "";
      delete roomFx.dataset.paulyKit;
    }
    $("#sim-room").classList.remove("executing", "chamber-smashed", "hard-shake");
    setRoomShake(false);
    resetApePosition();
    setBubble("STILL BORED", "");
    $("#result").classList.add("hidden");
    $("#now-title").textContent = "STANDBY";
    $("#now-credit").textContent = "";
  }

  function randomMethod() {
    const pool = filteredMethods();
    if (!pool.length) return;
    const unused = pool.filter((m) => !used.has(m.id));
    execute(randomOf(unused.length ? unused : pool));
  }

  let loopsStarted = false;

  function enterGame(autoPauly) {
    if (autoPauly && !isPaulyUnlocked()) {
      updateHubUI();
      return;
    }

    $("#intro").classList.remove("active");
    $("#game").classList.add("active");
    resetApePosition();
    refreshPaulyUnlock();
    setBubble("STILL BORED", "");
    renderList();

    if (!loopsStarted) {
      loopsStarted = true;
      setInterval(() => {
        if (!busy && $("#result").classList.contains("hidden")) {
          if ($("#pauly-video-modal") && !$("#pauly-video-modal").classList.contains("hidden")) return;
          if (!$("#game").classList.contains("active")) return;
          setBubble(randomOf(["STILL BORED", "…", "GM"]), "");
        }
      }, 5000);
    }

    if (autoPauly && isPaulyUnlocked()) {
      later(400, () => execute(PAULY_PUNCH));
    }
  }

  function returnToHub() {
    if (busy) return;
    // Back to APE CHAMBER menu (Pauly unlock lives here — not arcade)
    closePaulyVideo();
    clearTimers();
    $("#game").classList.remove("active");
    $("#intro").classList.add("active");
    $("#result").classList.add("hidden");
    const roomFx = $("#room-fx");
    if (roomFx) roomFx.innerHTML = "";
    $("#exec-layer").innerHTML = "";
    $("#sim-room").classList.remove("executing", "chamber-smashed", "hard-shake");
    refreshPaulyUnlock();
  }

  $("#start-btn").addEventListener("click", () => enterGame(false));

  const paulyHubBtn = $("#pauly-hub-btn");
  if (paulyHubBtn) {
    paulyHubBtn.addEventListener("click", () => {
      if (!isPaulyUnlocked()) return;
      enterGame(true);
    });
  }

  const hubBtn = $("#hub-btn");
  if (hubBtn) {
    hubBtn.addEventListener("click", () => returnToHub());
  }

  // Hub keyboard: 1 = chamber, 2 = pauly (only if unlocked)
  document.addEventListener("keydown", (e) => {
    if (!$("#intro").classList.contains("active")) return;
    if (e.key === "1") enterGame(false);
    if (e.key === "2" && isPaulyUnlocked()) enterGame(true);
  });

  // Initial hub lock state
  updateHubUI();

  // No free unlock on main hub flow. PAULY only after all 10.
  // Demo: ?pauly=1 or pauly.html forces a single clean run
  function forcePaulyDemo() {
    BASE_PROTOCOL_IDS.forEach((id) => used.add(id));
    persistUsed();
    paulyUnlocked = true;
    refreshPaulyUnlock();
    if ($("#intro")) $("#intro").classList.remove("active");
    if ($("#game")) $("#game").classList.add("active");
    resetApePosition();
    const roomFx = $("#room-fx");
    if (roomFx) roomFx.innerHTML = "";
    $("#exec-layer") && ($("#exec-layer").innerHTML = "");
    $("#sim-room") && $("#sim-room").classList.remove("chamber-smashed", "executing", "hard-shake");
    renderList();
    later(350, () => execute(PAULY_PUNCH));
  }

  if (window.__PAULY_ONLY__ || /[?&]pauly=1(?:&|$)/.test(location.search)) {
    forcePaulyDemo();
  }

  $$(".filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".filter").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filter = btn.dataset.filter;
      renderList();
    });
  });

  $("#search").addEventListener("input", (e) => {
    search = e.target.value.trim();
    renderList();
  });

  $("#again-btn").addEventListener("click", () => {
    if (window.__PAULY_ONLY__) {
      resetChamber();
      later(200, () => execute(PAULY_PUNCH));
      return;
    }
    resetChamber();
  });
  const randomBtn = $("#random-btn");
  if (randomBtn) {
    randomBtn.addEventListener("click", () => {
      resetChamber();
      later(200, () => randomMethod());
    });
  }

  const paulyClose = $("#pauly-close");
  if (paulyClose) {
    paulyClose.addEventListener("click", () => {
      closePaulyVideo();
      if (justDidPauly) {
        $("#result").classList.remove("hidden");
        justDidPauly = false;
      }
    });
  }
  const paulyModal = $("#pauly-video-modal");
  if (paulyModal) {
    paulyModal.addEventListener("click", (e) => {
      if (e.target === paulyModal) {
        closePaulyVideo();
        if (justDidPauly) {
          $("#result").classList.remove("hidden");
          justDidPauly = false;
        }
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("#pauly-video-modal").classList.contains("hidden")) {
        closePaulyVideo();
        if (justDidPauly) {
          $("#result").classList.remove("hidden");
          justDidPauly = false;
        }
        return;
      }
    }
    if (!$("#game").classList.contains("active") || busy) return;
    if (e.key === "r" || e.key === "R") {
      resetChamber();
      later(150, () => randomMethod());
    }
  });

  Object.values(SPRITES).forEach((src) => {
    const i = new Image();
    i.src = src;
  });

  // apply unlock state if returning mid-session
  refreshPaulyUnlock();
})();
