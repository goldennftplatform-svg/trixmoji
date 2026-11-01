/**
 * Audio stubs — plug real files into assets/audio/ later.
 * API is ready; silent no-ops if files missing.
 */
(function (global) {
  "use strict";

  const slots = {
    music: "assets/audio/music_loop.mp3",
    jump: "assets/audio/sfx_jump.wav",
    land: "assets/audio/sfx_land.wav",
    eat: "assets/audio/sfx_eat.wav",
    hurt: "assets/audio/sfx_hurt.wav",
    ui: "assets/audio/sfx_ui.wav",
  };

  const cache = {};
  let muted = false;
  let musicEl = null;

  function load(name) {
    if (cache[name]) return cache[name];
    const a = new Audio();
    a.preload = "auto";
    a.src = slots[name] || "";
    a.addEventListener("error", () => {
      /* placeholder — file may not exist yet */
    });
    cache[name] = a;
    return a;
  }

  function play(name, opts) {
    if (muted) return;
    opts = opts || {};
    try {
      const a = load(name).cloneNode();
      a.volume = opts.volume != null ? opts.volume : 0.5;
      a.play().catch(() => {});
    } catch (_) {}
  }

  function startMusic() {
    if (muted) return;
    try {
      if (!musicEl) {
        musicEl = load("music");
        musicEl.loop = true;
        musicEl.volume = 0.25;
      }
      musicEl.play().catch(() => {});
    } catch (_) {}
  }

  function stopMusic() {
    if (musicEl) {
      musicEl.pause();
      musicEl.currentTime = 0;
    }
  }

  function setMuted(m) {
    muted = !!m;
    if (muted) stopMusic();
  }

  global.JIMPTHY_AUDIO = {
    play,
    startMusic,
    stopMusic,
    setMuted,
    slots, // for docs
  };
})(window);
