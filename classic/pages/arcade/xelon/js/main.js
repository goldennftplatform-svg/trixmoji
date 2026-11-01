(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const introEl = document.getElementById("intro");
  const introVideo = document.getElementById("intro-video");
  ctx.imageSmoothingEnabled = false;

  function unmuteIntro() {
    if (!introVideo) return;
    introVideo.muted = false;
    introVideo.volume = 1;
  }

  function playIntroWithSound() {
    if (!introVideo) return;
    unmuteIntro();
    const play = introVideo.play();
    if (play && typeof play.catch === "function") {
      play.catch(() => {
        introVideo.muted = true;
        introVideo.play().catch(() => {});
      });
    }
  }

  function showIntro() {
    if (!introEl) return;
    introEl.classList.add("active");
    if (canvas) canvas.hidden = true;
    if (introVideo) {
      try {
        introVideo.currentTime = 0;
      } catch (_) {}
      playIntroWithSound();
    }
  }

  function hideIntro() {
    if (introEl) introEl.classList.remove("active");
    if (canvas) canvas.hidden = false;
    if (introVideo) {
      introVideo.pause();
      introVideo.muted = true;
    }
  }

  window.XelonUI = { showIntro, hideIntro, unmuteIntro };

  function unlockAudio() {
    if (Game.state !== "title" || !introVideo) return;
    unmuteIntro();
    if (introVideo.paused) {
      introVideo.play().catch(() => {});
    }
  }

  function mapKey(e, down) {
    if (down) unlockAudio();

    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        KEY.left = down;
        e.preventDefault();
        break;
      case "ArrowRight":
      case "KeyD":
        KEY.right = down;
        e.preventDefault();
        break;
      case "ArrowUp":
      case "KeyW":
        KEY.up = down;
        e.preventDefault();
        break;
      case "ArrowDown":
      case "KeyS":
        KEY.down = down;
        e.preventDefault();
        break;
      case "KeyZ":
      case "Space":
        KEY.fire = down;
        e.preventDefault();
        break;
      case "KeyX":
      case "ShiftLeft":
      case "ShiftRight":
        KEY.power = down;
        e.preventDefault();
        break;
      case "KeyP":
        if (down) {
          if (Game.state === "playing" || Game.state === "levelClear") {
            Game.state = "paused";
          } else if (Game.state === "paused") {
            Game.state = "playing";
          }
        }
        e.preventDefault();
        break;
      case "Enter":
        if (down) {
          if (Game.state === "title") {
            hideIntro();
            Game.startGame();
          } else if (Game.state === "gameover" || Game.state === "win") {
            showIntro();
            Game.returnToTitle();
          }
        }
        e.preventDefault();
        break;
    }
  }

  window.addEventListener("keydown", (e) => mapKey(e, true));
  window.addEventListener("keyup", (e) => mapKey(e, false));

  if (introEl) {
    introEl.addEventListener("pointerdown", () => unlockAudio());
    introEl.addEventListener("click", () => {
      if (Game.state === "title") {
        unlockAudio();
        hideIntro();
        Game.startGame();
      }
    });
  }

  window.addEventListener("blur", () => {
    KEY.left = KEY.right = KEY.up = KEY.down = KEY.fire = KEY.power = false;
  });

  Game.init();

  // Show intro immediately — don't wait on assets
  showIntro();

  // Load sprite in background
  if (window.Assets && Assets.load) {
    Assets.load().catch((err) => console.warn("Asset load failed", err));
  }

  let last = performance.now();
  let acc = 0;
  const STEP = 1000 / 60;

  function frame(now) {
    acc += now - last;
    last = now;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      Game.update();
      acc -= STEP;
      steps++;
    }
    if (Game.state !== "title") {
      Game.draw(ctx);
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
