/** Main game state machine */

const Game = {
  state: "title", // title | playing | bossIntro | paused | levelClear | gameover | win
  levelIndex: 0,
  level: null,
  player: null,
  enemies: [],
  bullets: [],
  capsules: [],
  explosions: [],
  boss: null,
  score: 0,
  hiScore: 0,
  lives: CONFIG.START_LIVES,
  scrollX: 0,
  progress: 0,
  frame: 0,
  waveCursor: 0,
  message: "",
  messageTimer: 0,
  bossSpawned: false,
  levelClearTimer: 0,
  flash: 0,

  init() {
    try {
      this.hiScore = parseInt(localStorage.getItem("xelon_hi") || "0", 10) || 0;
    } catch (_) {
      this.hiScore = 0;
    }
    this.state = "title";
  },

  returnToTitle() {
    this.state = "title";
    this.level = null;
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.capsules = [];
    this.explosions = [];
    this.boss = null;
    this.message = "";
    this.messageTimer = 0;
  },

  startGame() {
    this.levelIndex = 0;
    this.score = 0;
    this.lives = CONFIG.START_LIVES;
    this.player = createPlayer();
    this.startLevel();
  },

  startLevel() {
    this.level = LEVELS[this.levelIndex];
    this.enemies = [];
    this.bullets = [];
    this.capsules = [];
    this.explosions = [];
    this.boss = null;
    this.bossSpawned = false;
    this.progress = 0;
    this.scrollX = 0;
    this.frame = 0;
    this.waveCursor = 0;
    this.state = "playing";
    this.message = this.level.name;
    this.messageTimer = 120;
    if (this.player) {
      this.player.x = 80;
      this.player.y = CONFIG.H / 2 - CONFIG.PLAYER_H / 2;
      this.player.alive = true;
      this.player.invuln = 60;
      this.player.fireCd = 0;
    }
  },

  saveHi() {
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      try {
        localStorage.setItem("xelon_hi", String(this.hiScore));
      } catch (_) {}
    }
  },

  spawnWaves() {
    const waves = this.level.waves;
    while (
      this.waveCursor < waves.length &&
      this.frame >= waves[this.waveCursor].t
    ) {
      const w = waves[this.waveCursor];
      const n = Math.max(1, Math.round(w.n * (this.level.density || 1)));
      for (let i = 0; i < n; i++) {
        this.enemies.push(spawnEnemy(w.type, w.form, i, n, this.level));
      }
      this.waveCursor++;
    }

    // continuous light spawns after scripted waves, before boss
    if (
      !this.bossSpawned &&
      this.progress > this.level.length * 0.35 &&
      this.progress < this.level.length * 0.85 &&
      this.frame % Math.max(40, 90 - this.level.id * 4) === 0
    ) {
      const types = Object.keys(ENEMY_DEFS);
      // prefer types used in this level's waves
      const pool = this.level.waves.map((w) => w.type);
      const type = pool[(Math.random() * pool.length) | 0] || types[0];
      const forms = ["line", "sine", "scatter", "v"];
      const form = forms[(Math.random() * forms.length) | 0];
      const n = 2 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) {
        this.enemies.push(spawnEnemy(type, form, i, n, this.level));
      }
    }
  },

  spawnBoss() {
    this.boss = createBoss(this.level.boss, this.level);
    this.bossSpawned = true;
    this.message = "WARNING  " + this.level.boss.name;
    this.messageTimer = 100;
    this.flash = 20;
  },

  addExplosion(x, y, life = 20) {
    this.explosions.push({ x, y, age: 0, life });
  },

  killEnemy(e) {
    e.alive = false;
    this.score += e.score;
    this.addExplosion(e.x + e.w / 2, e.y + e.h / 2);
    if (chance(CONFIG.CAPSULE_CHANCE)) {
      this.capsules.push({
        x: e.x,
        y: e.y,
        w: 16,
        h: 16,
        vx: -0.8,
        vy: Math.sin(this.frame) * 0.5,
      });
    }
    // split amoeba/spore
    if (e.split && e.w > 12) {
      for (let i = 0; i < 2; i++) {
        const child = spawnEnemy(e.type, "scatter", i, 2, this.level);
        child.x = e.x;
        child.y = e.y + i * 10;
        child.w = Math.max(12, e.w * 0.6);
        child.h = Math.max(12, e.h * 0.6);
        child.hp = 1;
        child.split = false;
        this.enemies.push(child);
      }
    }
  },

  damagePlayer() {
    const p = this.player;
    if (!p.alive || p.invuln > 0) return;
    if (p.shield > 0) {
      p.shield--;
      p.invuln = 30;
      this.addExplosion(p.x + p.w, p.y + p.h / 2, 12);
      return;
    }
    this.lives--;
    this.addExplosion(p.x + p.w / 2, p.y + p.h / 2, 30);
    resetWeapons(p);
    if (this.lives <= 0) {
      p.alive = false;
      this.lives = 0;
      this.state = "gameover";
      this.message = "GAME OVER";
      this.messageTimer = 9999;
      this.saveHi();
      return;
    }
    p.x = 80;
    p.y = CONFIG.H / 2;
    p.invuln = CONFIG.INVULN_FRAMES;
    this.message = "SHIP LOST";
    this.messageTimer = 60;
  },

  update() {
    if (this.state === "title" || this.state === "gameover" || this.state === "win") {
      return;
    }
    if (this.state === "paused") return;

    this.frame++;
    if (this.messageTimer > 0) this.messageTimer--;
    if (this.flash > 0) this.flash--;

    if (this.state === "levelClear") {
      this.levelClearTimer--;
      if (this.levelClearTimer <= 0) {
        this.levelIndex++;
        if (this.levelIndex >= LEVELS.length) {
          this.state = "win";
          this.message = "MISSION COMPLETE";
          this.saveHi();
        } else {
          this.startLevel();
        }
      }
      // still allow player drift
      updatePlayer(this.player, 1);
      return;
    }

    const scroll = CONFIG.SCROLL_BASE * (this.level.scroll || 1);
    this.scrollX += scroll;
    this.progress += scroll;

    updatePlayer(this.player, 1);
    if (KEY.fire) playerFire(this.player, this.bullets);

    // power activate
    if (KEY.power) {
      if (!this._powerLatched) {
        applyPower(this.player);
        this._powerLatched = true;
      }
    } else {
      this._powerLatched = false;
    }

    // level flow
    if (!this.bossSpawned) {
      this.spawnWaves();
      if (this.progress >= this.level.length) {
        // clear remaining fodder gradually then boss
        if (this.enemies.length === 0) {
          this.spawnBoss();
        }
      }
    }

    // enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      updateEnemy(e, this.player, this.level, this.bullets);
      if (e.x + e.w < -40 || e.y < -80 || e.y > CONFIG.H + 80) e.alive = false;
    }
    this.enemies = this.enemies.filter((e) => e.alive);

    // boss
    if (this.boss && this.boss.alive) {
      updateBoss(this.boss, this.player, this.level, this.bullets);
    }

    // bullets
    for (const b of this.bullets) {
      b.x += b.vx;
      b.y += b.vy;
      if (b.homing && this.player.alive && !b.friendly) {
        const dx = this.player.x - b.x;
        const dy = this.player.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        b.vx += (dx / d) * 0.08;
        b.vy += (dy / d) * 0.08;
        const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        const max = 3.5 * (this.level.bulletMul || 1);
        if (sp > max) {
          b.vx = (b.vx / sp) * max;
          b.vy = (b.vy / sp) * max;
        }
      }
      if (b.kind === "missile" && b.y > CONFIG.H - 55) {
        b.vy = 0;
        b.y = CONFIG.H - 55;
        b.vx = 5;
      }
    }
    this.bullets = this.bullets.filter(
      (b) => b.x > -40 && b.x < CONFIG.W + 80 && b.y > -40 && b.y < CONFIG.H + 40
    );

    // capsules
    for (const c of this.capsules) {
      c.x += c.vx;
      c.y += Math.sin(this.frame * 0.08 + c.x) * 0.6;
    }
    this.capsules = this.capsules.filter((c) => c.x > -20);

    // collisions: player bullets vs enemies
    for (const b of this.bullets) {
      if (!b.friendly) continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (rectsOverlap(b, e)) {
          e.hp -= b.dmg;
          if (b.kind !== "laser") b.x = -999; // remove non-laser
          if (e.hp <= 0) this.killEnemy(e);
        }
      }
      if (this.boss && this.boss.alive && rectsOverlap(b, this.boss)) {
        this.boss.hp -= b.dmg;
        if (b.kind !== "laser") b.x = -999;
        if (this.frame % 3 === 0) {
          this.addExplosion(b.x, b.y, 10);
        }
        if (this.boss.hp <= 0) {
          this.boss.alive = false;
          this.score += this.boss.score;
          for (let i = 0; i < 12; i++) {
            this.addExplosion(
              this.boss.x + rand(0, this.boss.w),
              this.boss.y + rand(0, this.boss.h),
              25
            );
          }
          // bonus capsule spray
          for (let i = 0; i < 3; i++) {
            this.capsules.push({
              x: this.boss.x + this.boss.w / 2,
              y: this.boss.y + 20 + i * 30,
              w: 16,
              h: 16,
              vx: -1,
              vy: 0,
            });
          }
          this.state = "levelClear";
          this.levelClearTimer = 150;
          this.message = "STAGE CLEAR";
          this.messageTimer = 150;
          this.saveHi();
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.x > -50);

    // enemy bullets / bodies vs player
    const hb = playerHitbox(this.player);
    for (const b of this.bullets) {
      if (b.friendly) continue;
      if (rectsOverlap(b, hb)) {
        b.x = -999;
        this.damagePlayer();
      }
    }
    for (const e of this.enemies) {
      if (rectsOverlap(e, hb)) this.damagePlayer();
    }
    if (this.boss && this.boss.alive && rectsOverlap(this.boss, hb)) {
      this.damagePlayer();
    }

    // capsules
    for (const c of this.capsules) {
      if (rectsOverlap(c, this.player)) {
        c.x = -999;
        collectCapsule(this.player);
        this.score += 50;
      }
    }
    this.capsules = this.capsules.filter((c) => c.x > -20);

    // explosions
    for (const ex of this.explosions) ex.age++;
    this.explosions = this.explosions.filter((ex) => ex.age < ex.life);

    // terrain hazard on volcano / fortress edges
    const theme = this.level.theme;
    if (this.player.alive && this.player.invuln <= 0) {
      if (theme === "volcano" || theme === "organic") {
        if (this.player.y < 36 || this.player.y + this.player.h > CONFIG.H - 42) {
          this.damagePlayer();
        }
      }
      if (theme === "fortress" || theme === "hybrid" || theme === "final") {
        if (this.player.y < 40 || this.player.y + this.player.h > CONFIG.H - 44) {
          this.damagePlayer();
        }
      }
    }
  },

  draw(ctx) {
    // Title uses the HTML video intro, not canvas
    if (this.state === "title") return;

    if (this.level) {
      Draw.background(ctx, this.level, this.scrollX, this.frame);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, CONFIG.W, CONFIG.H);
    }

    // capsules
    for (const c of this.capsules) Draw.capsule(ctx, c, this.frame);

    // enemies
    for (const e of this.enemies) Draw.enemy(ctx, e);

    // boss
    if (this.boss && this.boss.alive) Draw.boss(ctx, this.boss);

    // player
    if (this.player && this.player.alive) {
      Draw.xelon(
        ctx,
        this.player.x,
        this.player.y,
        this.player.w,
        this.player.h,
        this.player.invuln,
        this.player.flame
      );
      if (this.player.shield > 0) {
        Draw.shield(
          ctx,
          this.player.x,
          this.player.y,
          this.player.w,
          this.player.h,
          this.player.shield
        );
      }
      const opts = getOptionPositions(this.player);
      for (const o of opts) Draw.option(ctx, o.x, o.y, this.frame);
    }

    // bullets
    for (const b of this.bullets) Draw.bullet(ctx, b);

    // explosions
    for (const ex of this.explosions) Draw.explosion(ctx, ex);

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,80,80,${this.flash / 40})`;
      ctx.fillRect(0, 0, CONFIG.W, CONFIG.H);
    }

    Draw.hud(ctx, this);

    // messages
    if (this.messageTimer > 0 || this.state === "gameover" || this.state === "win") {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(CONFIG.W / 2 - 160, CONFIG.H / 2 - 30, 320, 50);
      ctx.fillStyle = this.state === "gameover" ? "#f66" : "#fff";
      ctx.font = "bold 22px monospace";
      ctx.textAlign = "center";
      ctx.fillText(this.message, CONFIG.W / 2, CONFIG.H / 2 + 5);
      ctx.textAlign = "left";
      if (this.state === "gameover" || this.state === "win") {
        ctx.fillStyle = "#aaa";
        ctx.font = "14px monospace";
        ctx.textAlign = "center";
        ctx.fillText("PRESS ENTER FOR TITLE", CONFIG.W / 2, CONFIG.H / 2 + 40);
        ctx.textAlign = "left";
      }
    }

    if (this.state === "paused") {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, CONFIG.W, CONFIG.H);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", CONFIG.W / 2, CONFIG.H / 2);
      ctx.textAlign = "left";
    }
  },

  drawTitle(ctx) {
    ctx.fillStyle = "#050814";
    ctx.fillRect(0, 0, CONFIG.W, CONFIG.H);
    // stars
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = `rgba(200,220,255,${0.2 + (i % 5) * 0.15})`;
      ctx.fillRect((i * 97) % CONFIG.W, (i * 53) % CONFIG.H, 2, 2);
    }
    Draw.xelon(ctx, CONFIG.W / 2 - 80, CONFIG.H / 2 - 40, 100, 48, 0, this.frame * 0.3);

    ctx.fillStyle = "#8cf";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.fillText("XELON", CONFIG.W / 2, 120);
    ctx.fillStyle = "#aaa";
    ctx.font = "14px monospace";
    ctx.fillText("GRADIUS-TYPE HORIZONTAL SHOOTER", CONFIG.W / 2, 150);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px monospace";
    ctx.fillText("PRESS ENTER TO START", CONFIG.W / 2, CONFIG.H - 100);
    ctx.fillStyle = "#888";
    ctx.font = "12px monospace";
    ctx.fillText("12 STAGES  ·  POWER METER  ·  OPTIONS  ·  BOSSES", CONFIG.W / 2, CONFIG.H - 70);
    ctx.fillText("HI " + String(this.hiScore).padStart(8, "0"), CONFIG.W / 2, CONFIG.H - 40);
    ctx.textAlign = "left";
  },
};
