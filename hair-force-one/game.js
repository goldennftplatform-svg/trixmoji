/**
 * HAIR FORCE ONE
 * Hit arrow on time → character dances that move
 * Screen shake ONLY on miss
 * Music: original 80s synth parodies (music.js)
 */

(() => {
  "use strict";

  const TRAVEL_MS = 1600;
  const HIT_Y = 0.84;
  const WINDOWS = { perfect: 70, great: 120, good: 180 };
  const SCORES = { perfect: 300, great: 200, good: 100, miss: 0 };
  const POSE_HOLD_MS = 320;

  const POSE = {
    neutral: "assets/dance/neutral.jpg",
    left: "assets/dance/left.jpg",
    down: "assets/dance/down.jpg",
    up: "assets/dance/up.jpg",
    right: "assets/dance/right.jpg",
  };

  const DIRS = ["left", "down", "up", "right"];
  const KEY_MAP = {
    ArrowLeft: "left",
    ArrowDown: "down",
    ArrowUp: "up",
    ArrowRight: "right",
    a: "left",
    s: "down",
    w: "up",
    d: "right",
    A: "left",
    S: "down",
    W: "up",
    D: "right",
  };
  const GLYPH = { left: "◀", down: "▼", up: "▲", right: "▶" };

  const Music = window.HFO_MUSIC;

  const el = {
    title: document.getElementById("screen-title"),
    select: document.getElementById("screen-select"),
    play: document.getElementById("screen-play"),
    results: document.getElementById("screen-results"),
    btnStart: document.getElementById("btn-start"),
    btnRetry: document.getElementById("btn-retry"),
    btnSongs: document.getElementById("btn-songs"),
    songList: document.getElementById("song-list"),
    score: document.getElementById("score"),
    combo: document.getElementById("combo"),
    cMiss: document.getElementById("c-miss"),
    songLabel: document.getElementById("song-label"),
    judgment: document.getElementById("judgment"),
    stage: document.getElementById("dance-stage"),
    bgA: document.getElementById("play-bg-a"),
    bgB: document.getElementById("play-bg-b"),
    progress: document.getElementById("progress"),
    grade: document.getElementById("grade"),
    rScore: document.getElementById("r-score"),
    rCombo: document.getElementById("r-combo"),
    rPerfect: document.getElementById("r-perfect"),
    rGreat: document.getElementById("r-great"),
    rGood: document.getElementById("r-good"),
    rMiss: document.getElementById("r-miss"),
    lanes: {},
  };

  DIRS.forEach((d) => {
    const lane = document.querySelector(`.lane[data-dir="${d}"]`);
    el.lanes[d] = {
      notes: lane.querySelector(".notes"),
      receptor: lane.querySelector(".receptor"),
    };
  });

  let songs = Music.list();
  let selectedIndex = 0;
  let selectedSongId = songs[0].id;
  let bpm = songs[0].bpm;
  let beatMs = 60000 / bpm;

  let running = false;
  let startTime = 0;
  let raf = 0;
  let notes = [];
  let stats = freshStats();
  let songEndMs = 0;
  let chart = [];

  let useA = true;
  let currentPose = "neutral";
  let poseHoldUntil = 0;

  function freshStats() {
    return {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfect: 0,
      great: 0,
      good: 0,
      miss: 0,
    };
  }

  /** Build a chart scaled to song BPM — same pattern, beat-based */
  function buildChart() {
    const c = [];
    c.push({ beat: 4, dir: "left" });
    c.push({ beat: 6, dir: "down" });
    c.push({ beat: 8, dir: "up" });
    c.push({ beat: 10, dir: "right" });
    c.push({ beat: 12, dir: "right" });
    c.push({ beat: 13.5, dir: "up" });
    c.push({ beat: 15, dir: "down" });
    c.push({ beat: 16.5, dir: "left" });

    ["left", "right", "left", "right", "up", "down", "up", "down"].forEach((dir, i) => {
      c.push({ beat: 18 + i * 0.75, dir });
    });

    const groove = [
      "left", "down", "right", "up",
      "left", "up", "right", "down",
      "left", "right", "down", "up",
      "left", "down", "right", "up",
    ];
    groove.forEach((dir, i) => c.push({ beat: 25 + i * 0.5, dir }));

    c.push({ beat: 34, dir: "left" });
    c.push({ beat: 34, dir: "right" });
    c.push({ beat: 35.5, dir: "up" });
    c.push({ beat: 35.5, dir: "down" });
    c.push({ beat: 37, dir: "left" });
    c.push({ beat: 37.5, dir: "down" });
    c.push({ beat: 38, dir: "up" });
    c.push({ beat: 38.5, dir: "right" });

    return c.sort((a, b) => a.beat - b.beat || DIRS.indexOf(a.dir) - DIRS.indexOf(b.dir));
  }

  function preloadPoses() {
    return Promise.all(
      Object.values(POSE).map(
        (src) =>
          new Promise((res) => {
            const img = new Image();
            img.onload = img.onerror = () => res();
            img.src = src;
          })
      )
    );
  }

  function setPose(dirKey) {
    const key = POSE[dirKey] ? dirKey : "neutral";
    if (key === currentPose) return key;
    currentPose = key;
    const src = POSE[key];
    const next = useA ? el.bgB : el.bgA;
    const prev = useA ? el.bgA : el.bgB;
    next.src = src;
    next.classList.add("active");
    prev.classList.remove("active");
    useA = !useA;
    return key;
  }

  /** Dance to arrow. Screen shake ONLY on miss. */
  function danceToArrow(dir, kind) {
    if (kind === "miss") {
      setPose("neutral");
      el.stage.classList.remove("shake");
      void el.stage.offsetWidth;
      el.stage.classList.add("shake");
      poseHoldUntil = performance.now() + 200;
      return;
    }

    // Success: pose change only — no screen shake
    el.stage.classList.remove("shake");
    setPose(dir);
    poseHoldUntil = performance.now() + POSE_HOLD_MS;
  }

  function updatePoseReturn() {
    if (currentPose !== "neutral" && performance.now() >= poseHoldUntil) {
      setPose("neutral");
    }
  }

  function showScreen(name) {
    el.title.classList.toggle("active", name === "title");
    el.select.classList.toggle("active", name === "select");
    el.play.classList.toggle("active", name === "play");
    el.results.classList.toggle("active", name === "results");
  }

  function renderSongList() {
    el.songList.innerHTML = "";
    songs.forEach((s, i) => {
      const item = document.createElement("div");
      item.className = "song-item" + (i === selectedIndex ? " selected" : "");
      item.dataset.index = String(i);
      item.innerHTML =
        `<span class="song-title">${s.title}</span>` +
        `<span class="song-bpm">${s.bpm} BPM</span>` +
        `<span class="song-sub">${s.subtitle}</span>`;
      item.addEventListener("click", () => {
        selectedIndex = i;
        selectedSongId = s.id;
        renderSongList();
        startGame();
      });
      el.songList.appendChild(item);
    });
  }

  function openSelect() {
    Music.stop();
    running = false;
    cancelAnimationFrame(raf);
    renderSongList();
    showScreen("select");
  }

  function spawnNotes() {
    notes = chart.map((n, i) => ({
      id: i,
      dir: n.dir,
      hitTime: n.beat * beatMs,
      hit: false,
      missed: false,
      el: null,
    }));
    DIRS.forEach((d) => {
      el.lanes[d].notes.innerHTML = "";
    });
    notes.forEach((n) => {
      const div = document.createElement("div");
      div.className = `note ${n.dir}`;
      div.textContent = GLYPH[n.dir];
      div.style.visibility = "hidden";
      el.lanes[n.dir].notes.appendChild(div);
      n.el = div;
    });
  }

  function startGame() {
    Music.ensure();
    cancelAnimationFrame(raf);

    const song = Music.get(selectedSongId);
    selectedSongId = song.id;
    bpm = song.bpm;
    beatMs = 60000 / bpm;
    chart = buildChart();

    stats = freshStats();
    updateHud();
    el.judgment.className = "";
    el.judgment.textContent = "";
    el.stage.classList.remove("shake");
    el.songLabel.textContent = song.title;
    currentPose = "";
    setPose("neutral");
    poseHoldUntil = 0;
    songEndMs = (Math.max(...chart.map((c) => c.beat)) + 2.5) * beatMs;

    spawnNotes();
    showScreen("play");
    running = true;

    // Music + notes start together after tiny lead-in
    startTime = performance.now() + 300;
    setTimeout(() => {
      if (running) Music.play(selectedSongId);
    }, 280);

    loop();
  }

  function endGame() {
    running = false;
    cancelAnimationFrame(raf);
    Music.stop();
    setPose("up");
    el.rScore.textContent = stats.score.toLocaleString();
    el.rCombo.textContent = stats.maxCombo;
    el.rPerfect.textContent = stats.perfect;
    el.rGreat.textContent = stats.great;
    el.rGood.textContent = stats.good;
    el.rMiss.textContent = stats.miss;
    el.grade.textContent = gradeFor(stats);
    showScreen("results");
  }

  function gradeFor(s) {
    const total = s.perfect + s.great + s.good + s.miss;
    if (total === 0) return "F";
    const acc = (s.perfect + s.great * 0.75 + s.good * 0.4) / total;
    if (s.miss === 0 && s.perfect === total) return "SS";
    if (acc >= 0.95 && s.miss === 0) return "S";
    if (acc >= 0.85) return "A";
    if (acc >= 0.7) return "B";
    if (acc >= 0.5) return "C";
    return "D";
  }

  function updateHud() {
    el.score.textContent = stats.score.toLocaleString();
    el.combo.textContent = stats.combo;
    el.cMiss.textContent = stats.miss;
  }

  function showJudgment(kind) {
    el.judgment.textContent =
      kind === "perfect" ? "PERFECT!!" :
      kind === "great" ? "GREAT!" :
      kind === "good" ? "GOOD" : "MISS";
    el.judgment.className = "";
    void el.judgment.offsetWidth;
    el.judgment.className = `show ${kind}`;
  }

  function flashReceptor(dir) {
    const r = el.lanes[dir].receptor;
    r.classList.add("flash");
    setTimeout(() => r.classList.remove("flash"), 90);
  }

  function applyResult(kind, dir) {
    stats[kind]++;
    if (kind === "miss") {
      stats.combo = 0;
    } else {
      stats.combo++;
      stats.maxCombo = Math.max(stats.maxCombo, stats.combo);
      const mult = 1 + Math.floor(stats.combo / 10) * 0.1;
      stats.score += Math.floor(SCORES[kind] * mult);
    }
    Music.sfx(kind);
    showJudgment(kind);
    danceToArrow(dir, kind);
    updateHud();
  }

  function tryHit(dir) {
    if (!running) return;
    const now = performance.now() - startTime;
    flashReceptor(dir);

    let best = null;
    let bestAbs = Infinity;
    for (const n of notes) {
      if (n.dir !== dir || n.hit || n.missed) continue;
      const abs = Math.abs(now - n.hitTime);
      if (abs <= WINDOWS.good && abs < bestAbs) {
        best = n;
        bestAbs = abs;
      }
    }

    if (!best) return;

    best.hit = true;
    if (best.el) best.el.style.display = "none";

    if (bestAbs <= WINDOWS.perfect) applyResult("perfect", dir);
    else if (bestAbs <= WINDOWS.great) applyResult("great", dir);
    else applyResult("good", dir);
  }

  function loop() {
    if (!running) return;
    const now = performance.now() - startTime;

    updatePoseReturn();
    el.progress.style.width = Math.min(100, (now / songEndMs) * 100) + "%";

    for (const n of notes) {
      if (n.hit || n.missed || !n.el) continue;

      const appear = n.hitTime - TRAVEL_MS;
      const t = (now - appear) / TRAVEL_MS;

      if (t < 0) {
        n.el.style.visibility = "hidden";
        continue;
      }
      n.el.style.visibility = "visible";
      n.el.style.top = `calc(${Math.min(t, 1.15) * HIT_Y * 100}% - 26px)`;

      if (now - n.hitTime > WINDOWS.good) {
        n.missed = true;
        n.el.style.display = "none";
        applyResult("miss", n.dir);
      }
    }

    if (now >= songEndMs) {
      endGame();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  // ---- Input ----
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;

    // Song select navigation
    if (el.select.classList.contains("active")) {
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + songs.length) % songs.length;
        selectedSongId = songs[selectedIndex].id;
        renderSongList();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % songs.length;
        selectedSongId = songs[selectedIndex].id;
        renderSongList();
        return;
      }
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        selectedSongId = songs[selectedIndex].id;
        startGame();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        showScreen("title");
        return;
      }
    }

    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      if (el.title.classList.contains("active")) {
        openSelect();
      } else if (el.results.classList.contains("active")) {
        startGame();
      }
      return;
    }

    const dir = KEY_MAP[e.key];
    if (dir && running) {
      e.preventDefault();
      tryHit(dir);
    }
  });

  el.btnStart.addEventListener("click", openSelect);
  el.btnRetry.addEventListener("click", startGame);
  el.btnSongs.addEventListener("click", openSelect);

  el.bgA.src = POSE.neutral;
  el.bgA.classList.add("active");
  preloadPoses();
  renderSongList();
})();
