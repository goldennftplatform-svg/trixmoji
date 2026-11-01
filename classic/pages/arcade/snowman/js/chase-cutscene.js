/**
 * Ending cutscene: snowman builds GEOFF → GEOFF comes alive → comedy chase.
 * Shared by ending-animation-sample + in-game win panel.
 */
(function (global) {
  "use strict";

  const PAL = {
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
    G: "#5ce090",
    A: "#5cb8e0",
    S: "#2a4840",
    I: "#1e3848",
    Y: "#e8c060",
  };

  const PART_NAMES = ["PSU", "MOBO", "CPU", "RAM", "GPU", "COOLER"];
  const PART_COLORS = ["#e8c060", "#5cb8e0", "#c080ff", "#5ce090", "#ff6a28", "#40e8ff"];

  const SNOW = [
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

  // Total cutscene length (seconds) before loop / done
  const DURATION = 20;

  function drawPix(ctx, rows, ox, oy, scale, flip, bob) {
    const w = rows[0].length;
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch === "." || !PAL[ch]) continue;
        const sx = flip ? w - 1 - x : x;
        ctx.fillStyle = PAL[ch];
        ctx.fillRect(ox + sx * scale, oy + y * scale + (bob || 0), scale, scale);
      }
    }
  }

  /**
   * @param {number} filled 0..6 how many bays installed
   * @param {number} face 0..1 boot face intensity
   * @param {boolean} boots show comedy boots
   */
  function drawGeoff(ctx, x, y, scale, filled, face, lean, bootKick, boots) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x + 2 * scale, y + 24 * scale, 14 * scale, 2 * scale);

    const lx = lean || 0;
    // chassis
    ctx.fillStyle = PAL.K;
    ctx.fillRect(x + lx, y, 14 * scale, 22 * scale);
    ctx.fillStyle = "#243040";
    ctx.fillRect(x + scale + lx, y + scale, 12 * scale, 20 * scale);

    // empty rack rails
    ctx.fillStyle = "#1a2030";
    for (let i = 0; i < 6; i++) {
      const by = y + 2 * scale + i * 3 * scale;
      ctx.fillRect(x + 2 * scale + lx, by, 10 * scale, 2 * scale);
    }

    // filled bays (build progress)
    const n = Math.max(0, Math.min(6, filled | 0));
    for (let i = 0; i < n; i++) {
      const by = y + 2 * scale + i * 3 * scale;
      ctx.fillStyle = PART_COLORS[i];
      ctx.fillRect(x + 2 * scale + lx, by, 10 * scale, 2 * scale);
      ctx.fillStyle = face >= 1 ? PAL.G : "#fff8";
      ctx.fillRect(x + 3 * scale + lx, by + scale * 0.35, 2 * scale, scale * 0.5);
    }

    // face panel when powering / alive
    if (face > 0.05) {
      ctx.fillStyle = "#0a1810";
      ctx.fillRect(x + 3 * scale + lx, y + 3 * scale, 8 * scale, 7 * scale);
      ctx.globalAlpha = Math.min(1, face);
      ctx.fillStyle = PAL.G;
      if (face >= 0.85) {
        // mischievous
        ctx.fillRect(x + 4 * scale + lx, y + 5 * scale, 2 * scale, scale);
        ctx.fillRect(x + 9 * scale + lx, y + 5 * scale, 2 * scale, scale);
        ctx.fillRect(x + 4 * scale + lx, y + 8 * scale, 6 * scale, scale);
        ctx.fillRect(x + 4 * scale + lx, y + 7 * scale, scale, scale);
        ctx.fillRect(x + 9 * scale + lx, y + 7 * scale, scale, scale);
      } else {
        // soft boot eyes
        ctx.fillRect(x + 4 * scale + lx, y + 5 * scale, 2 * scale, 2 * scale);
        ctx.fillRect(x + 9 * scale + lx, y + 5 * scale, 2 * scale, 2 * scale);
      }
      ctx.globalAlpha = 1;
    }

    if (face >= 0.9) {
      ctx.fillStyle = "rgba(92,224,144,0.14)";
      ctx.fillRect(x - scale + lx, y - scale, 16 * scale, 26 * scale);
    }

    if (boots) {
      const kick = bootKick || 0;
      ctx.fillStyle = PAL.G;
      ctx.fillRect(x + 2 * scale + lx, y + 22 * scale, 4 * scale, 3 * scale);
      ctx.fillRect(x + 8 * scale + lx + kick, y + 22 * scale, 4 * scale, 3 * scale);
      ctx.fillStyle = "#e0ffe8";
      ctx.fillRect(x + 3 * scale + lx, y + 23 * scale, 2 * scale, scale);
      ctx.fillRect(x + 9 * scale + lx + kick, y + 23 * scale, 2 * scale, scale);
    }
  }

  function drawPartCrate(ctx, x, y, scale, kind, glow) {
    ctx.fillStyle = PAL.K;
    ctx.fillRect(x, y, 6 * scale, 5 * scale);
    ctx.fillStyle = PART_COLORS[kind % PART_COLORS.length];
    ctx.fillRect(x + scale, y + scale, 4 * scale, 3 * scale);
    if (glow) {
      ctx.fillStyle = "rgba(255,255,200,0.35)";
      ctx.fillRect(x - 1, y - 1, 6 * scale + 2, 5 * scale + 2);
    }
  }

  function drawSweat(ctx, x, y, t) {
    ctx.fillStyle = PAL.A;
    for (let i = 0; i < 3; i++) {
      const sy = y + ((t * 40 + i * 12) % 24);
      ctx.fillRect(x + i * 5, sy, 2, 3);
    }
  }

  function drawMotionLines(ctx, x, y, dir) {
    ctx.fillStyle = "rgba(200,230,255,0.35)";
    for (let i = 0; i < 4; i++) {
      const ox = dir < 0 ? x + 10 + i * 6 : x - 10 - i * 6;
      ctx.fillRect(ox, y + 8 + i * 10, 8 + i * 2, 2);
    }
  }

  function drawSpark(ctx, x, y, t) {
    if (Math.sin(t * 30) < 0) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, 2, 2);
    ctx.fillStyle = PAL.G;
    ctx.fillRect(x + 3, y - 2, 2, 2);
    ctx.fillRect(x - 2, y + 2, 2, 2);
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ loop?: boolean, onDone?: function }} opts
   */
  function playChaseCutscene(canvas, opts) {
    opts = opts || {};
    const loop = !!opts.loop;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    let raf = 0;
    let t0 = 0;
    let running = true;
    let caption = "";

    let snowX = W * 0.28;
    let geoffX = W * 0.58;
    let snowFacing = 1;
    let phase = "intro";
    // chase lag state
    let geoffChaseX = W * 0.58;

    function setCap(s) {
      caption = s;
    }

    function drawBg(t) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0e1c30");
      g.addColorStop(1, "#0a1420");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "rgba(220,240,255,0.45)";
      for (let i = 0; i < 18; i++) {
        const px = (i * 53 + t * 18) % W;
        const py = (i * 37 + t * 28) % (H * 0.7);
        ctx.fillRect(px, py, 2, 2);
      }

      ctx.fillStyle = PAL.S;
      ctx.fillRect(0, H - 48, W, 48);
      ctx.fillStyle = PAL.I;
      ctx.fillRect(0, H - 48, W, 4);
      ctx.fillStyle = "rgba(160,220,255,0.08)";
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(i * 70 + ((t * 10) | 0) % 20, H - 40, 40, 2);
      }
    }

    function drawCaption() {
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(0, H - 26, W, 26);
      ctx.fillStyle = PAL.G;
      ctx.font = Math.max(12, (W / 40) | 0) + "px VT323, monospace";
      ctx.textAlign = "left";
      ctx.fillText(caption, 10, H - 9);
    }

    function frame(ts) {
      if (!running) return;
      if (!t0) t0 = ts;
      const t = (ts - t0) / 1000;
      ctx.imageSmoothingEnabled = false;

      /*
       * TIMELINE
       * 0.0–1.2   intro     empty tower + floating parts
       * 1.2–7.2   build     snowman installs 6 parts
       * 7.2–9.0   boot      GEOFF powers on / face / boots
       * 9.0–10.2  realize   mischief grin
       * 10.2–11.0 panic
       * 11.0–15.5 chase
       * 15.5–17.0 slip
       * 17.0–18.8 tag
       * 18.8–20   end
       */
      let filled = 0;
      let face = 0;
      let boots = false;
      let flyingPart = -1; // index mid-flight
      let flyU = 0;

      if (t < 1.2) {
        phase = "intro";
        filled = 0;
        setCap("All 6 parts secured. Time to build GEOFF…");
      } else if (t < 7.2) {
        phase = "build";
        const bt = t - 1.2; // 0..6
        // each part takes 1s: 0.0-0.35 fly in, 0.35-1.0 seated
        const slot = Math.min(5, Math.floor(bt));
        const u = bt - slot;
        filled = slot + (u >= 0.45 ? 1 : 0);
        if (u < 0.45) {
          flyingPart = slot;
          flyU = u / 0.45;
        }
        setCap("Installing " + PART_NAMES[Math.min(5, slot)] + "… (" + Math.min(6, filled) + "/6)");
      } else if (t < 9.0) {
        phase = "boot";
        filled = 6;
        face = Math.min(1, (t - 7.2) / 1.4);
        boots = face > 0.7;
        setCap("GEOFF BOOT SEQUENCE… coming online");
      } else if (t < 10.2) {
        phase = "realize";
        filled = 6;
        face = 1;
        boots = true;
        setCap("GEOFF: hey snow pal  >:D");
      } else if (t < 11.0) {
        phase = "panic";
        filled = 6;
        face = 1;
        boots = true;
        setCap("SNOWMAN: wait that's not the tutorial—");
      } else if (t < 15.5) {
        phase = "chase";
        filled = 6;
        face = 1;
        boots = true;
        setCap("COMEDY CHASE: GEOFF IS FREE-RANGE");
      } else if (t < 17.0) {
        phase = "slip";
        filled = 6;
        face = 1;
        boots = true;
        setCap("*ice physics has entered the chat*");
      } else if (t < 18.8) {
        phase = "tag";
        filled = 6;
        face = 1;
        boots = true;
        setCap("GEOFF: GOTCHA (gently)");
      } else {
        phase = "end";
        filled = 6;
        face = 1;
        boots = true;
        setCap("HELLO, SNOWMAN. I AM GEOFF. WANNA BUILD AGAIN?");
      }

      const groundY = H - 48;
      const snowScale = Math.max(2, (W / 180) | 0);
      const geoffScale = Math.max(3, (W / 90) | 0);
      let snowBob = 0;
      let geoffLean = 0;
      let bootKick = 0;
      let snowFlip = false;
      let armReach = 0; // snowman lean toward tower while building
      let geoffY = groundY - 25 * geoffScale;
      let snowY = groundY - 28 * snowScale;

      // default positions for build/intro/boot
      if (phase === "intro" || phase === "build" || phase === "boot") {
        snowX = W * 0.3;
        geoffX = W * 0.58;
        geoffChaseX = geoffX;
        snowFacing = 1;
        if (phase === "build") {
          // hop + reach toward GEOFF each install
          const bt = t - 1.2;
          const u = bt - Math.floor(bt);
          snowBob = u < 0.45 ? Math.sin(u * Math.PI) * 5 : Math.sin(t * 8) * 1;
          armReach = u < 0.5 ? 6 : 0;
          snowX = W * 0.3 + armReach;
        }
        if (phase === "boot") {
          snowBob = Math.sin(t * 6) * 1;
          // proud little hop when fully online
          if (face > 0.85) snowBob = Math.abs(Math.sin(t * 12)) * 3;
        }
      } else if (phase === "realize") {
        snowX = W * 0.3;
        geoffX = W * 0.58;
        geoffChaseX = geoffX;
        geoffLean = Math.sin(t * 8) * 2;
        snowBob = Math.sin(t * 20) * 1;
      } else if (phase === "panic") {
        snowX = W * 0.3;
        geoffX = W * 0.58;
        snowFacing = -1;
        snowBob = Math.abs(Math.sin(t * 30)) * 2;
      } else if (phase === "chase") {
        const chaseT = t - 11.0;
        const run = Math.sin(chaseT * 1.6);
        snowX = W * 0.45 + run * W * 0.28;
        snowFacing = Math.cos(chaseT * 1.6) > 0 ? 1 : -1;
        snowBob = Math.abs(Math.sin(chaseT * 14)) * 3;
        const target = snowX + (snowFacing > 0 ? -40 : 40);
        geoffChaseX += (target - geoffChaseX) * 0.05;
        geoffX = geoffChaseX;
        geoffLean = (target - geoffX) * 0.08;
        bootKick = Math.sin(chaseT * 16) * 4;
        snowY = groundY - 28 * snowScale - Math.abs(Math.sin(chaseT * 14)) * 2;
      } else if (phase === "slip") {
        const st = t - 15.5;
        snowX = W * 0.25 + st * 40;
        snowY = groundY - 28 * snowScale - Math.sin(st * 8) * 8;
        snowFacing = 1;
        snowFlip = st > 0.6 && st < 1.1;
        geoffX = snowX + 70;
        if (st > 0.8) geoffX = snowX + 70 + (st - 0.8) * 90;
        geoffLean = 6;
        bootKick = Math.sin(t * 20) * 5;
        geoffChaseX = geoffX;
      } else if (phase === "tag") {
        snowX = W * 0.4;
        geoffX = snowX + 50;
        geoffChaseX = geoffX;
        snowBob = Math.sin(t * 6) * 2;
        geoffLean = Math.sin(t * 5) * 3;
        snowY = groundY - 28 * snowScale - Math.abs(Math.sin(t * 8)) * 4;
      } else {
        snowX = W * 0.35;
        geoffX = W * 0.52;
        geoffChaseX = geoffX;
        snowBob = Math.sin(t * 4) * 2;
        geoffLean = Math.sin(t * 3) * 2;
        bootKick = Math.sin(t * 8) * 2;
      }

      drawBg(t);

      // Floating spare parts during intro (on ground / hovering)
      if (phase === "intro") {
        for (let i = 0; i < 6; i++) {
          const px = W * 0.12 + (i % 3) * 36;
          const py = groundY - 70 - Math.floor(i / 3) * 28 + Math.sin(t * 3 + i) * 4;
          drawPartCrate(ctx, px, py, 3, i, true);
        }
      }

      // Part mid-flight into tower during build
      if (phase === "build" && flyingPart >= 0) {
        const startX = W * 0.18 + (flyingPart % 3) * 30;
        const startY = groundY - 80;
        const endX = geoffX - 2 * geoffScale;
        const endY = geoffY + 2 * geoffScale + flyingPart * 3 * geoffScale;
        const u = flyU * flyU; // ease in
        const px = startX + (endX - startX) * u;
        const py = startY + (endY - startY) * u - Math.sin(flyU * Math.PI) * 30;
        drawPartCrate(ctx, px, py, 3, flyingPart, true);
        if (flyU > 0.85) drawSpark(ctx, endX + 10, endY, t);
      }

      // install sparkles when a part just seated
      if (phase === "build" && filled > 0) {
        const just = filled - 1;
        const bt = t - 1.2;
        const u = bt - Math.floor(bt);
        if (u >= 0.45 && u < 0.7) {
          drawSpark(
            ctx,
            geoffX + 4 * geoffScale,
            geoffY + 2 * geoffScale + just * 3 * geoffScale,
            t
          );
        }
      }

      // boot flash
      if (phase === "boot" && face > 0.5) {
        ctx.fillStyle = "rgba(92,224,144," + (0.08 + Math.sin(t * 20) * 0.04) + ")";
        ctx.fillRect(0, 0, W, H);
      }

      if (phase === "chase" || phase === "slip") {
        drawMotionLines(ctx, snowX, snowY, snowFacing);
        drawMotionLines(ctx, geoffX, geoffY, snowFacing);
      }

      const snowDrawX = snowX - 9 * snowScale;
      const geoffDrawX = geoffX - 7 * geoffScale;

      const drawSnow = () => {
        if (phase === "panic" || phase === "chase" || phase === "slip") {
          drawSweat(ctx, snowDrawX + (snowFacing < 0 ? -8 : 20 * snowScale), snowY + 10, t);
        }
        drawPix(ctx, SNOW, snowDrawX, snowY + snowBob, snowScale, snowFacing < 0 || snowFlip, 0);

        // build: carrot "wrench" held out
        if (phase === "build" || phase === "intro") {
          ctx.fillStyle = PAL.O;
          ctx.fillRect(snowDrawX + 18 * snowScale, snowY + 14 * snowScale + snowBob, 8, 3);
          ctx.fillStyle = "#40a030";
          ctx.fillRect(snowDrawX + 24 * snowScale, snowY + 13 * snowScale + snowBob, 3, 2);
        }

        if (phase === "chase" && Math.sin(t * 5) > 0.7) {
          ctx.fillStyle = PAL.O;
          const cx = snowX + snowFacing * 30;
          ctx.fillRect(cx, snowY + 20, 8, 3);
          ctx.fillStyle = "#40a030";
          ctx.fillRect(cx + (snowFacing > 0 ? 8 : -2), snowY + 19, 3, 2);
        }
      };

      if (geoffDrawX < snowDrawX) {
        drawGeoff(ctx, geoffDrawX, geoffY, geoffScale, filled, face, geoffLean, bootKick, boots);
        drawSnow();
      } else {
        drawSnow();
        drawGeoff(ctx, geoffDrawX, geoffY, geoffScale, filled, face, geoffLean, bootKick, boots);
      }

      if (phase === "chase") {
        ctx.fillStyle = PAL.P;
        for (let i = 0; i < 4; i++) {
          if (Math.sin(t * 20 + i) > 0.3) {
            ctx.fillRect(snowX - snowFacing * (10 + i * 6), groundY - 6 - i * 2, 3, 2);
          }
        }
      }

      if (phase === "realize" || phase === "panic") {
        ctx.fillStyle = "#ffe060";
        ctx.font = "bold " + 16 * snowScale + "px VT323, monospace";
        ctx.fillText("!", snowDrawX + 8 * snowScale, snowY - 4);
      }

      // progress pips during build
      if (phase === "intro" || phase === "build" || phase === "boot") {
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = i < filled ? PART_COLORS[i] : "#1a2030";
          ctx.fillRect(10 + i * 14, 10, 10, 10);
          ctx.strokeStyle = "#3a5068";
          ctx.strokeRect(10 + i * 14, 10, 10, 10);
        }
      }

      if (phase === "tag" || phase === "end") {
        ctx.fillStyle = PAL.R;
        const hx = (snowX + geoffX) / 2;
        ctx.fillRect(hx, groundY - 90 + Math.sin(t * 4) * 3, 4, 4);
        ctx.fillRect(hx + 10, groundY - 100 + Math.cos(t * 5) * 3, 3, 3);
      }

      drawCaption();

      if (t >= DURATION) {
        if (loop) {
          t0 = ts;
          geoffChaseX = W * 0.58;
        } else {
          running = false;
          if (opts.onDone) opts.onDone();
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    return {
      stop() {
        running = false;
        cancelAnimationFrame(raf);
      },
      replay() {
        running = true;
        t0 = 0;
        phase = "intro";
        geoffChaseX = W * 0.58;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      },
    };
  }

  global.GEOFF_CHASE = { playChaseCutscene };
})(typeof window !== "undefined" ? window : globalThis);
