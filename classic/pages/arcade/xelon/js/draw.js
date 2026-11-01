/** Pixel-art style drawing helpers + XELON sprite + detailed enemies */

const Draw = {
  pix(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  },

  // XELON rocket + pilot — uses your art when loaded
  xelon(ctx, x, y, w, h, invuln, flame) {
    const blink = invuln > 0 && Math.floor(invuln / 4) % 2 === 0;
    if (blink) return;

    // animated thruster glow behind sprite
    const fl = 8 + Math.sin(flame) * 4;
    const cx = x + 4;
    const cy = y + h * 0.62;
    const thruster = ctx.createRadialGradient(cx, cy, 1, cx - fl, cy, fl + 10);
    thruster.addColorStop(0, "rgba(255,240,120,0.95)");
    thruster.addColorStop(0.35, "rgba(255,120,20,0.85)");
    thruster.addColorStop(1, "rgba(255,40,0,0)");
    ctx.fillStyle = thruster;
    ctx.beginPath();
    ctx.ellipse(cx - fl * 0.4, cy, fl + 6, 8 + Math.sin(flame * 1.3) * 2, 0, 0, Math.PI * 2);
    ctx.fill();

    if (Assets.xelonReady && Assets.xelon) {
      ctx.imageSmoothingEnabled = true;
      // slight hover bob
      const bob = Math.sin(flame * 0.5) * 1.2;
      ctx.drawImage(Assets.xelon, x, y + bob, w, h);
      ctx.imageSmoothingEnabled = false;
      return;
    }

    // fallback vector art if image missing
    this._xelonFallback(ctx, x, y, w, h, flame);
  },

  _xelonFallback(ctx, x, y, w, h, flame) {
    const bx = x;
    const by = y + h * 0.35;
    const bw = w * 0.85;
    const bh = h * 0.4;
    const fl = 6 + Math.sin(flame) * 3;
    ctx.fillStyle = "#ff6600";
    ctx.beginPath();
    ctx.moveTo(bx, by + bh * 0.5);
    ctx.lineTo(bx - fl - 4, by + bh * 0.15);
    ctx.lineTo(bx - fl - 8, by + bh * 0.5);
    ctx.lineTo(bx - fl - 4, by + bh * 0.85);
    ctx.closePath();
    ctx.fill();
    const grad = ctx.createLinearGradient(bx, by, bx + bw, by);
    grad.addColorStop(0, "#2a3038");
    grad.addColorStop(0.4, "#5a6570");
    grad.addColorStop(1, "#1a2028");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(bx + 4, by);
    ctx.lineTo(bx + bw * 0.75, by);
    ctx.quadraticCurveTo(bx + bw + 6, by + bh * 0.5, bx + bw * 0.75, by + bh);
    ctx.lineTo(bx + 4, by + bh);
    ctx.quadraticCurveTo(bx - 2, by + bh * 0.5, bx + 4, by);
    ctx.fill();
    ctx.fillStyle = "#e8eef5";
    ctx.font = "bold 8px monospace";
    ctx.fillText("XELON", bx + bw * 0.22, by + bh * 0.62);
    // pilot
    ctx.fillStyle = "#111";
    ctx.fillRect(bx + bw * 0.28, by - 16, 12, 16);
    ctx.fillStyle = "#eee";
    ctx.font = "bold 8px monospace";
    ctx.fillText("X", bx + bw * 0.3, by - 5);
    ctx.fillStyle = "#c09050";
    ctx.fillRect(bx + bw * 0.3, by - 22, 9, 7);
  },

  /** Tiny life icon */
  xelonIcon(ctx, x, y) {
    if (Assets.xelonReady && Assets.xelon) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(Assets.xelon, x, y, 22, 14);
      ctx.imageSmoothingEnabled = false;
    } else {
      ctx.fillStyle = "#4af";
      ctx.fillRect(x, y + 4, 16, 6);
    }
  },

  option(ctx, x, y, t) {
    const pulse = 5.5 + Math.sin((t || 0) * 0.2) * 1.2;
    const g = ctx.createRadialGradient(x, y, 1, x, y, pulse + 3);
    g.addColorStop(0, "#eff");
    g.addColorStop(0.4, "#4cf");
    g.addColorStop(1, "rgba(40,160,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, pulse + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9ef";
    ctx.beginPath();
    ctx.arc(x - 1, y - 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(180,240,255,0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, pulse, 0, Math.PI * 2);
    ctx.stroke();
  },

  shield(ctx, x, y, w, h, hits) {
    const t = Date.now() * 0.005;
    ctx.strokeStyle = `rgba(180,220,255,${0.4 + hits * 0.18})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.55, y + h * 0.55, w * 0.52, h * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(120,200,255,${0.25 + Math.sin(t) * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.55, y + h * 0.55, w * 0.58, h * 0.62, 0, t, t + Math.PI);
    ctx.stroke();
  },

  bullet(ctx, b) {
    if (b.kind === "laser") {
      const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y);
      if (b.friendly) {
        g.addColorStop(0, "rgba(100,220,255,0.2)");
        g.addColorStop(0.5, "#6ef");
        g.addColorStop(1, "#fff");
      } else {
        g.addColorStop(0, "rgba(255,60,80,0.2)");
        g.addColorStop(0.5, "#f46");
        g.addColorStop(1, "#faa");
      }
      ctx.fillStyle = g;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = "#fff";
      ctx.fillRect(b.x, b.y + 1, b.w, Math.max(1, b.h - 2));
    } else if (b.kind === "missile") {
      ctx.fillStyle = "#ff8844";
      ctx.beginPath();
      ctx.moveTo(b.x + b.w, b.y + b.h / 2);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x, b.y + b.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff2200";
      ctx.fillRect(b.x - 4, b.y + 1, 4, b.h - 2);
    } else if (b.kind === "enemy") {
      const r = b.w / 2;
      const g = ctx.createRadialGradient(b.x + r, b.y + r, 1, b.x + r, b.y + r, r);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.4, b.color || "#f46");
      g.addColorStop(1, "#600");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x + r, b.y + r, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#9ff";
      ctx.shadowColor = "#4df";
      ctx.shadowBlur = 6;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.fillRect(b.x + 2, b.y, b.w - 3, 1);
    }
  },

  capsule(ctx, c, t) {
    const bob = Math.sin(t * 0.1 + c.x) * 2;
    const x = c.x;
    const y = c.y + bob;
    // shell
    const g = ctx.createLinearGradient(x, y, x, y + c.h);
    g.addColorStop(0, "#ffe066");
    g.addColorStop(0.5, "#ffaa00");
    g.addColorStop(1, "#cc7700");
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(x, y, c.w, c.h);
    ctx.fillStyle = g;
    ctx.fillRect(x + 2, y + 2, c.w - 4, c.h - 4);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(x + 3, y + 3, c.w - 6, 3);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px monospace";
    ctx.fillText("P", x + 5, y + 13);
  },

  enemy(ctx, e) {
    const { type } = e;
    switch (type) {
      case "zub":
        this._shipDetailed(ctx, e, e.color || "#3d8f4a", "#1a4020");
        break;
      case "fighter":
        this._shipDetailed(ctx, e, e.color || "#c64", "#602010");
        break;
      case "racer":
        this._shipDetailed(ctx, e, e.color || "#48f", "#104080");
        break;
      case "aimed":
        this._shipDetailed(ctx, e, e.color || "#c48", "#502018");
        break;
      case "drone":
        this._shipDetailed(ctx, e, e.color || "#6ac", "#183848");
        break;
      case "iceDrone":
        this._shipDetailed(ctx, e, e.color || "#8cf", "#245868");
        break;
      case "helix":
        this._helix(ctx, e);
        break;
      case "homing":
        this._shipDetailed(ctx, e, "#f48", "#601020");
        break;
      case "tentacle":
        this._blob(ctx, e, "#a4c", 6);
        break;
      case "asteroid":
        this._rock(ctx, e);
        break;
      case "bat":
      case "dragon":
        this._dragon(ctx, e);
        break;
      case "golem":
      case "mech":
      case "knight":
      case "thaw":
        this._golem(ctx, e);
        break;
      case "wallCannon":
      case "gunPod":
      case "wallLaser":
      case "sporeTurret":
      case "turretDebris":
      case "moai":
        this._turret(ctx, e);
        break;
      case "eye":
        this._eye(ctx, e);
        break;
      case "snake":
      case "vine":
      case "leech":
        this._snake(ctx, e);
        break;
      case "spore":
      case "seed":
      case "amoeba":
        this._spore(ctx, e);
        break;
      case "crystal":
        this._crystal(ctx, e);
        break;
      default:
        this._shipDetailed(ctx, e, e.color || "#888", "#333");
    }
  },

  _shipDetailed(ctx, e, color, dark) {
    const { x, y, w, h, age } = e;
    // wing shadow
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.15, y + h * 0.5);
    ctx.lineTo(x - 4, y - 2);
    ctx.lineTo(x + w * 0.35, y + h * 0.25);
    ctx.lineTo(x + w * 0.35, y + h * 0.75);
    ctx.lineTo(x - 4, y + h + 2);
    ctx.closePath();
    ctx.fill();

    // body
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, dark);
    g.addColorStop(0.45, color);
    g.addColorStop(1, "#eee");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + w, y + h * 0.5);
    ctx.lineTo(x + w * 0.55, y);
    ctx.lineTo(x + 2, y + h * 0.2);
    ctx.lineTo(x + 6, y + h * 0.5);
    ctx.lineTo(x + 2, y + h * 0.8);
    ctx.lineTo(x + w * 0.55, y + h);
    ctx.closePath();
    ctx.fill();

    // canopy / eye
    ctx.fillStyle = "rgba(180,240,255,0.9)";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.55, y + h * 0.5, w * 0.12, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0af";
    ctx.beginPath();
    ctx.arc(x + w * 0.58, y + h * 0.5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // engine glow
    const pulse = 0.6 + Math.sin((age || 0) * 0.25) * 0.3;
    ctx.fillStyle = `rgba(255,120,40,${pulse})`;
    ctx.fillRect(x - 3, y + h * 0.35, 5, h * 0.3);
    ctx.fillStyle = `rgba(255,240,100,${pulse})`;
    ctx.fillRect(x - 1, y + h * 0.42, 3, h * 0.16);

    // outline
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w, y + h * 0.5);
    ctx.lineTo(x + w * 0.55, y);
    ctx.lineTo(x + 2, y + h * 0.2);
    ctx.lineTo(x + 6, y + h * 0.5);
    ctx.lineTo(x + 2, y + h * 0.8);
    ctx.lineTo(x + w * 0.55, y + h);
    ctx.closePath();
    ctx.stroke();
  },

  _helix(ctx, e) {
    const { x, y, w, h, age } = e;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(age * 0.08);
    for (let i = 0; i < 3; i++) {
      ctx.rotate((Math.PI * 2) / 3);
      const g = ctx.createLinearGradient(0, 0, w / 2, 0);
      g.addColorStop(0, "#6cf");
      g.addColorStop(1, "#148");
      ctx.fillStyle = g;
      ctx.fillRect(0, -3, w / 2, 6);
    }
    ctx.fillStyle = "#eff";
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  _blob(ctx, e, color, tent) {
    const { x, y, w, h, age } = e;
    const cx = x + w / 2;
    const cy = y + h / 2;
    // tentacles first
    for (let i = 0; i < tent; i++) {
      const a = (i / tent) * Math.PI * 2 + age * 0.05;
      const len = w * 0.55 + Math.sin(age * 0.1 + i) * 4;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(
        cx + Math.cos(a + 0.4) * len * 0.5,
        cy + Math.sin(a + 0.4) * len * 0.5,
        cx + Math.cos(a) * len,
        cy + Math.sin(a) * len
      );
      ctx.stroke();
      // sucker tip
      ctx.fillStyle = "#f8a";
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * len, cy + Math.sin(a) * len, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, w / 2);
    g.addColorStop(0, "#fdf");
    g.addColorStop(0.4, color);
    g.addColorStop(1, "#302040");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, w / 2, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = "#0ff";
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 2, 4, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#002";
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 2, 1.5, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // mouth
    ctx.strokeStyle = "#400";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy + 5, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();
  },

  _rock(ctx, e) {
    const { x, y, w, h, age } = e;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((age || 0) * 0.02);
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, "#9aa");
    g.addColorStop(0.5, "#667");
    g.addColorStop(1, "#334");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, -h * 0.45);
    ctx.lineTo(w * 0.35, -h * 0.4);
    ctx.lineTo(w * 0.5, h * 0.1);
    ctx.lineTo(w * 0.25, h * 0.45);
    ctx.lineTo(-w * 0.35, h * 0.4);
    ctx.lineTo(-w * 0.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, -h * 0.3);
    ctx.lineTo(w * 0.1, -h * 0.25);
    ctx.lineTo(-w * 0.05, -h * 0.05);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.stroke();
    ctx.restore();
  },

  _dragon(ctx, e) {
    const { x, y, w, h, age } = e;
    const flap = Math.sin((age || 0) * 0.15) * 6;
    // wings
    ctx.fillStyle = "#1e4a1e";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.35, y + h * 0.45);
    ctx.quadraticCurveTo(x - 10, y - 4 + flap, x + w * 0.1, y + h * 0.2);
    ctx.quadraticCurveTo(x + w * 0.2, y + h * 0.35, x + w * 0.35, y + h * 0.45);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.35, y + h * 0.55);
    ctx.quadraticCurveTo(x - 8, y + h + 4 - flap, x + w * 0.1, y + h * 0.8);
    ctx.quadraticCurveTo(x + w * 0.2, y + h * 0.65, x + w * 0.35, y + h * 0.55);
    ctx.fill();
    // body
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, "#1a4a1a");
    g.addColorStop(0.5, "#3a9a3a");
    g.addColorStop(1, "#8fcf6a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // scales
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x + w * 0.3 + i * 6, y + h * 0.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // head / snout
    ctx.fillStyle = "#4aab4a";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.78, y + h * 0.48, w * 0.22, h * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    // eye
    ctx.fillStyle = "#f44";
    ctx.beginPath();
    ctx.arc(x + w * 0.82, y + h * 0.4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff0";
    ctx.beginPath();
    ctx.arc(x + w * 0.83, y + h * 0.4, 1.2, 0, Math.PI * 2);
    ctx.fill();
    // horn
    ctx.fillStyle = "#cfc";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.75, y + h * 0.28);
    ctx.lineTo(x + w * 0.7, y + h * 0.05);
    ctx.lineTo(x + w * 0.82, y + h * 0.3);
    ctx.fill();
    // jaw
    ctx.strokeStyle = "#062";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + w * 0.88, y + h * 0.55, 5, 0.1, Math.PI - 0.1);
    ctx.stroke();
  },

  _golem(ctx, e) {
    const { x, y, w, h, type, age } = e;
    const isMech = type === "mech";
    const body = isMech ? "#5a6570" : type === "thaw" ? "#a0c8d8" : type === "knight" ? "#7a8490" : "#8a6a4a";
    const dark = isMech ? "#2a3038" : "#4a3020";

    // legs
    ctx.fillStyle = dark;
    ctx.fillRect(x + 4, y + h * 0.65, 7, h * 0.35);
    ctx.fillRect(x + w - 11, y + h * 0.65, 7, h * 0.35);
    // body
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, body);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.fillRect(x + 2, y + h * 0.25, w - 4, h * 0.45);
    // shoulders
    ctx.fillStyle = body;
    ctx.fillRect(x - 2, y + h * 0.28, 8, 10);
    ctx.fillRect(x + w - 6, y + h * 0.28, 8, 10);
    // head
    ctx.fillStyle = body;
    ctx.fillRect(x + w * 0.25, y, w * 0.5, h * 0.3);
    // eyes
    const glow = 0.7 + Math.sin((age || 0) * 0.2) * 0.3;
    ctx.fillStyle = isMech ? `rgba(255,40,40,${glow})` : `rgba(255,180,40,${glow})`;
    ctx.fillRect(x + w * 0.32, y + h * 0.1, 5, 5);
    ctx.fillRect(x + w * 0.55, y + h * 0.1, 5, 5);
    // chest plate / crack
    if (isMech) {
      ctx.strokeStyle = "#8cf";
      ctx.strokeRect(x + w * 0.35, y + h * 0.38, w * 0.3, h * 0.18);
    } else {
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.moveTo(x + w * 0.4, y + h * 0.35);
      ctx.lineTo(x + w * 0.55, y + h * 0.55);
      ctx.stroke();
    }
    // outline
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.strokeRect(x + 2, y + h * 0.25, w - 4, h * 0.45);
  },

  _turret(ctx, e) {
    const { x, y, w, h, type, age } = e;
    if (type === "moai") {
      const g = ctx.createLinearGradient(x, y, x + w, y);
      g.addColorStop(0, "#6a6a5a");
      g.addColorStop(0.5, "#b0b098");
      g.addColorStop(1, "#5a5a4a");
      ctx.fillStyle = g;
      // head shape
      ctx.beginPath();
      ctx.moveTo(x + 4, y + h);
      ctx.lineTo(x, y + h * 0.3);
      ctx.lineTo(x + w * 0.2, y);
      ctx.lineTo(x + w * 0.85, y + 4);
      ctx.lineTo(x + w, y + h * 0.4);
      ctx.lineTo(x + w - 4, y + h);
      ctx.closePath();
      ctx.fill();
      // brow
      ctx.fillStyle = "#3a3a30";
      ctx.fillRect(x + 6, y + h * 0.22, w * 0.55, 5);
      // eyes
      ctx.fillStyle = "#111";
      ctx.fillRect(x + 8, y + h * 0.32, 9, 7);
      ctx.fillRect(x + 22, y + h * 0.32, 9, 7);
      // glow pupils
      ctx.fillStyle = "#f80";
      ctx.fillRect(x + 11, y + h * 0.34, 3, 3);
      ctx.fillRect(x + 25, y + h * 0.34, 3, 3);
      // nose / mouth
      ctx.fillStyle = "#2a2a22";
      ctx.fillRect(x + 12, y + h * 0.5, 8, 14);
      ctx.fillRect(x + 8, y + h * 0.72, 18, 8);
      // chin ridge
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.stroke();
    } else {
      // metal base
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, "#889");
      g.addColorStop(1, "#334");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#222";
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      // barrel
      ctx.fillStyle = "#666";
      ctx.fillRect(x + w - 4, y + h / 2 - 4, 12, 8);
      ctx.fillStyle = "#aaa";
      ctx.fillRect(x + w + 4, y + h / 2 - 2, 6, 4);
      // status light
      const on = Math.sin((age || 0) * 0.2) > 0;
      ctx.fillStyle = on ? "#f44" : "#400";
      ctx.beginPath();
      ctx.arc(x + 8, y + 8, 3, 0, Math.PI * 2);
      ctx.fill();
      // hazard stripes
      if (type === "gunPod" || type === "wallCannon") {
        ctx.fillStyle = "#fc0";
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(x + 4 + i * 7, y + h - 8, 4, 4);
        }
      }
      ctx.strokeStyle = "#111";
      ctx.strokeRect(x, y, w, h);
    }
  },

  _eye(ctx, e) {
    const { x, y, w, h, age } = e;
    const cx = x + w / 2;
    const cy = y + h / 2;
    // veins
    ctx.strokeStyle = "rgba(200,60,60,0.5)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + age * 0.02;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * w * 0.45, cy + Math.sin(a) * h * 0.45);
      ctx.stroke();
    }
    // sclera
    const g = ctx.createRadialGradient(cx - 2, cy - 2, 2, cx, cy, w / 2);
    g.addColorStop(0, "#fff");
    g.addColorStop(1, "#d8d0c8");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // iris
    const iris = e.eyeColor || "#2a8";
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.arc(cx + 2, cy, w * 0.22, 0, Math.PI * 2);
    ctx.fill();
    // pupil
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(cx + 3, cy, w * 0.1, 0, Math.PI * 2);
    ctx.fill();
    // shine
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  },

  _snake(ctx, e) {
    const { x, y, w, h, type, age } = e;
    const col = type === "vine" ? "#3a8a3a" : type === "leech" ? "#a46" : "#4a8a4a";
    const dark = type === "vine" ? "#1a4a1a" : "#2a4a2a";
    const segs = 7;
    // body ribbon
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = dark;
    ctx.lineWidth = 11;
    ctx.beginPath();
    for (let i = 0; i < segs; i++) {
      const sx = x + (i / (segs - 1)) * w;
      const sy = y + h / 2 + Math.sin(age * 0.12 + i * 0.9) * 10;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let i = 0; i < segs; i++) {
      const sx = x + (i / (segs - 1)) * w;
      const sy = y + h / 2 + Math.sin(age * 0.12 + i * 0.9) * 10;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    // belly stripe
    ctx.strokeStyle = "rgba(255,255,200,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < segs; i++) {
      const sx = x + (i / (segs - 1)) * w;
      const sy = y + h / 2 + Math.sin(age * 0.12 + i * 0.9) * 10;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    // head
    const hx = x + w;
    const hy = y + h / 2 + Math.sin(age * 0.12 + segs) * 10;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f44";
    ctx.beginPath();
    ctx.arc(hx + 3, hy - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // tongue
    ctx.strokeStyle = "#f66";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hx + 6, hy + 1);
    ctx.lineTo(hx + 12, hy - 2);
    ctx.moveTo(hx + 6, hy + 1);
    ctx.lineTo(hx + 12, hy + 3);
    ctx.stroke();
  },

  _spore(ctx, e) {
    const { x, y, w, h, type, age } = e;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const base = type === "amoeba" ? "#6a4a8a" : type === "seed" ? "#8a4" : "#c80";
    // blobs / lobes
    const g = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, w / 2 + 2);
    g.addColorStop(0, "#fea");
    g.addColorStop(0.4, base);
    g.addColorStop(1, "#301008");
    ctx.fillStyle = g;
    ctx.beginPath();
    const lobes = type === "amoeba" ? 6 : 1;
    if (lobes === 1) {
      ctx.arc(cx, cy, w / 2, 0, Math.PI * 2);
    } else {
      for (let i = 0; i < lobes; i++) {
        const a = (i / lobes) * Math.PI * 2 + age * 0.03;
        const lx = cx + Math.cos(a) * w * 0.2;
        const ly = cy + Math.sin(a) * h * 0.2;
        ctx.moveTo(lx + w * 0.28, ly);
        ctx.arc(lx, ly, w * 0.28, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    // nucleus / highlight
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    if (type === "seed") {
      ctx.strokeStyle = "#460";
      ctx.beginPath();
      ctx.moveTo(cx, cy - h / 2);
      ctx.lineTo(cx, cy + h / 2);
      ctx.stroke();
    }
  },

  _crystal(ctx, e) {
    const { x, y, w, h, age } = e;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(Math.sin((age || 0) * 0.03) * 0.15);
    // outer
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, "#eff");
    g.addColorStop(0.4, "#8cf");
    g.addColorStop(1, "#248");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, 0);
    ctx.lineTo(0, h / 2);
    ctx.lineTo(-w / 2, 0);
    ctx.closePath();
    ctx.fill();
    // inner facet
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.25);
    ctx.lineTo(w * 0.2, 0);
    ctx.lineTo(0, h * 0.1);
    ctx.lineTo(-w * 0.12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(200,240,255,0.8)";
    ctx.stroke();
    ctx.restore();
  },

  boss(ctx, b) {
    const { x, y, w, h, type, age } = b;
    if (type === "rockMaw" || type === "glacierBrain") {
      const cold = type === "glacierBrain";
      const g = ctx.createRadialGradient(x + w * 0.4, y + h * 0.4, 10, x + w / 2, y + h / 2, w / 2);
      g.addColorStop(0, cold ? "#dff" : "#aaa");
      g.addColorStop(0.5, cold ? "#6bf" : "#667");
      g.addColorStop(1, cold ? "#146" : "#223");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // craters / facets
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + age * 0.01;
        ctx.beginPath();
        ctx.arc(x + w / 2 + Math.cos(a) * w * 0.28, y + h / 2 + Math.sin(a) * h * 0.28, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      // core eye
      ctx.fillStyle = "#f40";
      ctx.beginPath();
      ctx.arc(x + w * 0.5, y + h * 0.5, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff0";
      ctx.beginPath();
      ctx.arc(x + w * 0.5 + 2, y + h * 0.5, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(x + w * 0.5 + 3, y + h * 0.5, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === "twinCruiser" || type === "dualCore" || type === "bigCore") {
      // hull
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, "#8a96a4");
      g.addColorStop(0.5, "#3a4550");
      g.addColorStop(1, "#1a2028");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + 20, y);
      ctx.lineTo(x + w - 10, y + 10);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w - 10, y + h - 10);
      ctx.lineTo(x + 20, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      ctx.fill();
      // panel lines
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.stroke();
      ctx.strokeStyle = "rgba(150,200,255,0.3)";
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 30, y + (h * i) / 4);
        ctx.lineTo(x + w - 20, y + (h * i) / 4);
        ctx.stroke();
      }
      const cores = type === "dualCore" ? 2 : 1;
      for (let i = 0; i < cores; i++) {
        const cx = x + w * (cores === 1 ? 0.45 : 0.32 + i * 0.3);
        const cy = y + h / 2;
        const cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 18);
        cg.addColorStop(0, "#fff");
        cg.addColorStop(0.4, "#4cf");
        cg.addColorStop(1, "#048");
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#8cf";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w * 0.42, age * 0.04, age * 0.04 + Math.PI);
      ctx.stroke();
      ctx.lineWidth = 1;
    } else if (type === "magmaHydra") {
      // body mass
      const bg = ctx.createRadialGradient(x + w / 2, y + h * 0.7, 10, x + w / 2, y + h * 0.7, w * 0.4);
      bg.addColorStop(0, "#a42");
      bg.addColorStop(1, "#311");
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.7, w * 0.35, h * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        if (b.heads && b.heads[i] <= 0) continue;
        const hx = x + 40 + i * 50;
        const hy = y + 30 + Math.sin(age * 0.08 + i) * 18;
        // neck
        ctx.strokeStyle = "#2a5a2a";
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + h * 0.6);
        ctx.quadraticCurveTo(hx - 10, hy + 40, hx, hy);
        ctx.stroke();
        // head
        const hg = ctx.createLinearGradient(hx - 20, hy, hx + 20, hy);
        hg.addColorStop(0, "#1a4a1a");
        hg.addColorStop(1, "#5aba4a");
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.ellipse(hx, hy, 26, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f40";
        ctx.beginPath();
        ctx.arc(hx + 10, hy - 3, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff0";
        ctx.beginPath();
        ctx.arc(hx + 11, hy - 3, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === "giantMoai") {
      const g = ctx.createLinearGradient(x, y, x + w, y);
      g.addColorStop(0, "#5a5a48");
      g.addColorStop(0.5, "#b0b090");
      g.addColorStop(1, "#4a4a38");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      // brow
      ctx.fillStyle = "#2a2a20";
      ctx.fillRect(x + 20, y + 30, w * 0.55, 14);
      ctx.fillRect(x + 25, y + 55, 36, 22);
      ctx.fillRect(x + 70, y + 55, 36, 22);
      ctx.fillStyle = "#f80";
      ctx.fillRect(x + 35, y + 60, 12, 12);
      ctx.fillRect(x + 80, y + 60, 12, 12);
      ctx.fillStyle = "#1a1a14";
      ctx.fillRect(x + 40, y + h - 90, 70, 50);
      // cracks
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.moveTo(x + w * 0.3, y + 20);
      ctx.lineTo(x + w * 0.4, y + h * 0.5);
      ctx.stroke();
    } else if (type === "blindMother" || type === "cellCore" || type === "finalBeast") {
      const col = type === "finalBeast" ? "#6a2a6a" : type === "cellCore" ? "#4a8a6a" : "#a44";
      const g = ctx.createRadialGradient(x + w * 0.4, y + h * 0.4, 20, x + w / 2, y + h / 2, w / 2);
      g.addColorStop(0, "#fca");
      g.addColorStop(0.35, col);
      g.addColorStop(1, "#200010");
      ctx.fillStyle = g;
      ctx.beginPath();
      // lumpy body
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + age * 0.01;
        const rr = w / 2 + Math.sin(age * 0.05 + i) * 8;
        const px = x + w / 2 + Math.cos(a) * rr * 0.85;
        const py = y + h / 2 + Math.sin(a) * (h / 2) * 0.85;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      const eyes = type === "finalBeast" ? 8 : 5;
      for (let i = 0; i < eyes; i++) {
        const a = (i / eyes) * Math.PI * 2 + age * 0.02;
        const ex = x + w / 2 + Math.cos(a) * w * 0.28;
        const ey = y + h / 2 + Math.sin(a) * h * 0.28;
        ctx.fillStyle = "#ffe";
        ctx.beginPath();
        ctx.arc(ex, ey, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f40";
        ctx.beginPath();
        ctx.arc(ex + 2, ey, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(ex + 3, ey, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // mouth
      ctx.fillStyle = "#100";
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.68, w * 0.22, h * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      // teeth
      ctx.fillStyle = "#eee";
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(x + w * 0.35 + i * 12, y + h * 0.62, 6, 10);
      }
    } else if (type === "gatekeeper") {
      const g = ctx.createLinearGradient(x, y, x + w, y);
      g.addColorStop(0, "#224");
      g.addColorStop(0.5, "#68a");
      g.addColorStop(1, "#224");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#8cf";
      ctx.globalAlpha = 0.5 + Math.sin(age * 0.1) * 0.2;
      ctx.fillRect(x + 20, y + h / 2 - 40, w - 40, 80);
      ctx.globalAlpha = 1;
      const arm = Math.sin(age * 0.06) * 50;
      ctx.fillStyle = "#46a";
      ctx.fillRect(x + w / 2 - 12, y + 20 + arm, 24, h - 40 - Math.abs(arm));
      // lights
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 === (age >> 3) % 2 ? "#f44" : "#400";
        ctx.fillRect(x + 10, y + 30 + i * 40, 8, 8);
        ctx.fillRect(x + w - 18, y + 30 + i * 40, 8, 8);
      }
    } else if (type === "rootTitan") {
      ctx.fillStyle = "#1a3a1a";
      ctx.fillRect(x + 20, y + h * 0.35, w - 40, h * 0.65);
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = i % 2 ? "#3a8a3a" : "#2a5a2a";
        ctx.lineWidth = 12 - i;
        ctx.beginPath();
        ctx.moveTo(x + 30 + i * 35, y + h);
        ctx.quadraticCurveTo(
          x + i * 40 + Math.sin(age * 0.05 + i) * 20,
          y + h * 0.4,
          x + 50 + i * 30,
          y + 10 + Math.sin(age * 0.08 + i) * 8
        );
        ctx.stroke();
        // leaf bud
        ctx.fillStyle = "#4c4";
        ctx.beginPath();
        ctx.arc(x + 50 + i * 30, y + 10 + Math.sin(age * 0.08 + i) * 8, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      // face in trunk
      ctx.fillStyle = "#0a0";
      ctx.beginPath();
      ctx.arc(x + w / 2 - 12, y + h * 0.55, 6, 0, Math.PI * 2);
      ctx.arc(x + w / 2 + 12, y + h * 0.55, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#a4a";
      ctx.fillRect(x, y, w, h);
    }

    // HP bar
    const pct = b.hp / b.maxHp;
    ctx.fillStyle = "#300";
    ctx.fillRect(x, y - 14, w, 8);
    ctx.fillStyle = pct > 0.3 ? "#4f4" : "#f44";
    ctx.fillRect(x, y - 14, w * pct, 8);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y - 14, w, 8);
  },

  background(ctx, level, scrollX, t) {
    const p = level.palette;
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, CONFIG.W, CONFIG.H);

    ctx.fillStyle = p.accent;
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 97 + scrollX * (0.3 + (i % 3) * 0.2)) % (CONFIG.W + 20)) - 10;
      const sy = (i * 53) % CONFIG.H;
      const sz = 1 + (i % 3);
      ctx.globalAlpha = 0.3 + (i % 5) * 0.1;
      ctx.fillRect(sx, sy, sz, sz);
    }
    ctx.globalAlpha = 1;

    if (level.theme === "volcano") {
      ctx.fillStyle = p.haze;
      ctx.fillRect(0, CONFIG.H - 50, CONFIG.W, 50);
      ctx.fillStyle = p.accent;
      for (let i = 0; i < 8; i++) {
        const lx = ((i * 140 - scrollX * 0.8) % (CONFIG.W + 100)) - 50;
        const lh = 40 + Math.sin(t * 0.05 + i) * 20;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(lx, CONFIG.H - lh, 24, lh);
        ctx.fillRect(lx + 60, 0, 18, lh * 0.7);
      }
      ctx.globalAlpha = 1;
    } else if (level.theme === "organic") {
      ctx.fillStyle = p.mid;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= CONFIG.W; x += 20) {
        const yy = 40 + Math.sin((x + scrollX) * 0.02) * 18 + Math.sin((x + scrollX) * 0.05) * 8;
        ctx.lineTo(x, yy);
      }
      ctx.lineTo(CONFIG.W, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, CONFIG.H);
      for (let x = 0; x <= CONFIG.W; x += 20) {
        const yy = CONFIG.H - 40 - Math.sin((x + scrollX) * 0.02 + 1) * 18;
        ctx.lineTo(x, yy);
      }
      ctx.lineTo(CONFIG.W, CONFIG.H);
      ctx.fill();
      ctx.fillStyle = p.accent;
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 12; i++) {
        const dx = ((i * 90 - scrollX) % (CONFIG.W + 40)) - 20;
        ctx.fillRect(dx, 30 + (i % 3) * 10, 4, 20);
        ctx.fillRect(dx, CONFIG.H - 50, 4, 18);
      }
      ctx.globalAlpha = 1;
    } else if (level.theme === "fortress" || level.theme === "hybrid" || level.theme === "final") {
      ctx.fillStyle = p.mid;
      ctx.fillRect(0, 0, CONFIG.W, 36);
      ctx.fillRect(0, CONFIG.H - 36, CONFIG.W, 36);
      ctx.fillStyle = p.accent;
      for (let i = 0; i < 20; i++) {
        const zx = ((i * 70 - scrollX) % (CONFIG.W + 40)) - 20;
        ctx.fillRect(zx, 28, 30, 8);
        ctx.fillRect(zx, CONFIG.H - 36, 30, 8);
      }
      ctx.strokeStyle = p.haze;
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 44, CONFIG.W - 16, CONFIG.H - 88);
    } else if (level.theme === "warp") {
      ctx.strokeStyle = p.accent;
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 16; i++) {
        const zx = ((i * 80 - scrollX * 2) % (CONFIG.W + 60)) - 30;
        ctx.beginPath();
        ctx.moveTo(zx, 0);
        ctx.lineTo(zx + 40, CONFIG.H / 2);
        ctx.lineTo(zx, CONFIG.H);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (level.theme === "ice") {
      ctx.fillStyle = p.haze;
      for (let i = 0; i < 10; i++) {
        const ix = ((i * 110 - scrollX * 0.5) % (CONFIG.W + 80)) - 40;
        const ih = 60 + (i % 4) * 20;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(ix, CONFIG.H);
        ctx.lineTo(ix + 20, CONFIG.H - ih);
        ctx.lineTo(ix + 40, CONFIG.H);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (level.theme === "plant") {
      ctx.fillStyle = p.mid;
      for (let i = 0; i < 14; i++) {
        const px = ((i * 90 - scrollX * 0.6) % (CONFIG.W + 50)) - 25;
        ctx.fillRect(px, CONFIG.H - 80 - (i % 3) * 30, 12, 100);
      }
    } else if (level.theme === "moai") {
      ctx.fillStyle = p.mid;
      ctx.fillRect(0, CONFIG.H - 40, CONFIG.W, 40);
      ctx.fillRect(0, 0, CONFIG.W, 30);
    }

    const g = ctx.createLinearGradient(0, CONFIG.H - 80, 0, CONFIG.H);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, CONFIG.H - 80, CONFIG.W, 80);
  },

  hud(ctx, game) {
    const { player, score, hiScore, lives, levelIndex, level } = game;

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, CONFIG.W, 28);
    ctx.fillRect(0, CONFIG.H - 36, CONFIG.W, 36);

    ctx.fillStyle = "#eee";
    ctx.font = "bold 12px monospace";
    ctx.fillText(`1P SCORE`, 12, 18);
    ctx.fillStyle = "#8cf";
    ctx.fillText(String(score).padStart(8, "0"), 80, 18);
    ctx.fillStyle = "#eee";
    ctx.fillText(`HI`, 200, 18);
    ctx.fillStyle = "#fc8";
    ctx.fillText(String(hiScore).padStart(8, "0"), 224, 18);

    ctx.fillStyle = "#eee";
    ctx.fillText(`STAGE ${levelIndex + 1}`, CONFIG.W - 200, 18);
    ctx.fillStyle = "#aaa";
    ctx.font = "11px monospace";
    ctx.fillText(level.name, CONFIG.W - 130, 18);

    ctx.fillStyle = "#eee";
    ctx.font = "bold 12px monospace";
    ctx.fillText("SHIPS", 12, CONFIG.H - 14);
    for (let i = 0; i < lives; i++) {
      this.xelonIcon(ctx, 58 + i * 26, CONFIG.H - 26);
    }

    const barX = 200;
    const barY = CONFIG.H - 28;
    const slotW = 72;
    ctx.font = "bold 10px monospace";
    for (let i = 0; i < POWER.length; i++) {
      const px = barX + i * (slotW + 4);
      const active = player.powerIndex === i && player.powerReady;
      ctx.fillStyle = active ? POWER[i].color : "#223";
      ctx.fillRect(px, barY, slotW, 18);
      ctx.strokeStyle = active ? "#fff" : "#445";
      ctx.strokeRect(px, barY, slotW, 18);
      ctx.fillStyle = active ? "#000" : "#889";
      ctx.fillText(POWER[i].label, px + 4, barY + 13);
    }

    ctx.fillStyle = "#aaa";
    ctx.font = "10px monospace";
    ctx.fillText(`CAP ${player.capsules}`, barX + POWER.length * (slotW + 4) + 8, CONFIG.H - 14);

    if (game.boss && game.boss.alive) {
      ctx.fillStyle = "#f88";
      ctx.font = "bold 14px monospace";
      ctx.fillText(game.boss.bossName || "BOSS", CONFIG.W / 2 - 40, 48);
    }
  },

  explosion(ctx, ex) {
    const p = ex.age / ex.life;
    const r = ex.life * 1.4 * p;
    ctx.fillStyle = `rgba(255,${180 - ex.age * 3},20,${1 - p})`;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,200,${1 - p})`;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    // sparks
    ctx.fillStyle = `rgba(255,200,80,${1 - p})`;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + ex.age * 0.2;
      ctx.fillRect(ex.x + Math.cos(a) * r * 0.8, ex.y + Math.sin(a) * r * 0.8, 2, 2);
    }
  },
};
