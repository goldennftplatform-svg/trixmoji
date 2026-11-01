/**
 * Jimpthy — smooth third-person raccoon on the open city.
 * Photoreal billboard sprites, camera-relative WASD, soft accel/facing.
 */
(function (global) {
  "use strict";

  const ASSET = "assets/jimothy/";

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  function Player(scene, textures) {
    this.scene = scene;
    this.tex = textures || {};

    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.facing = 0;
    this.onGround = true;
    this.radius = 0.45;
    this.height = 1.55;
    this.belly = 40;
    this.bellyMax = 100;
    this.hp = 100;
    this.score = 0;
    this.hurtT = 0;
    this.anim = "idle";
    this.animT = 0;
    this.walkFrame = 0;
    this.facingSide = "back"; // default GTA chase view
    this.bob = 0;
    this._billYaw = 0;
    this._moveBlend = 0; // 0 idle → 1 full run (smooth)

    this.root = new THREE.Group();
    this.root.name = "jimpthy";

    // Soft contact shadow (radial gradient)
    const shadowTex =
      global.JIMPTHY_RENDER && JIMPTHY_RENDER.softShadowTexture
        ? JIMPTHY_RENDER.softShadowTexture()
        : null;
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 1.35),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        color: 0x000000,
        transparent: true,
        opacity: shadowTex ? 0.85 : 0.38,
        depthWrite: false,
      })
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.02;
    sh.renderOrder = 1;
    this.shadow = sh;
    this.root.add(sh);

    // Photoreal cutout — BasicMaterial keeps baked fur lighting
    const mat = new THREE.MeshBasicMaterial({
      map: textures.idle_front || textures.idle_back || null,
      transparent: true,
      alphaTest: 0.08,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    this.sprite = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), mat);
    this.sprite.position.y = 0.95;
    this.sprite.renderOrder = 2;
    this.root.add(this.sprite);
    scene.add(this.root);
  }

  Player.prototype.setMap = function (name) {
    const t = this.tex[name];
    if (!t || !this.sprite) return;
    if (this.sprite.material.map !== t) {
      this.sprite.material.map = t;
      this.sprite.material.needsUpdate = true;
    }
  };

  Player.prototype._pickFacing = function (camYaw) {
    // Direction camera looks on XZ (from camera toward player area)
    const viewAngle = camYaw + Math.PI;
    let rel = this.facing - viewAngle;
    while (rel < -Math.PI) rel += Math.PI * 2;
    while (rel > Math.PI) rel -= Math.PI * 2;
    const a = Math.abs(rel);
    // Dead-zones slightly wider so side/front don't flicker
    if (a < Math.PI * 0.42) this.facingSide = "back";
    else if (a > Math.PI * 0.78) this.facingSide = "front";
    else if (rel > 0) this.facingSide = "side_l";
    else this.facingSide = "side_r";
  };

  Player.prototype._updateAnim = function (moving, dt, camYaw, camPos) {
    this.animT += dt;
    this._pickFacing(camYaw);

    // Smooth move blend for bob intensity
    const targetBlend = moving ? 1 : 0;
    this._moveBlend = lerp(this._moveBlend, targetBlend, 1 - Math.exp(-dt * 10));

    if (!this.onGround && this.vy > 0.4) {
      this.anim = "jump";
      if (this.facingSide === "back" && this.tex.idle_back) this.setMap("idle_back");
      else this.setMap(this.tex.jump_front ? "jump_front" : "idle_front");
    } else if (this._moveBlend > 0.15) {
      this.anim = "walk";
      // Smooth walk cycle ~8 fps feel without hard pops
      const rate = 7 + this._moveBlend * 4;
      this.walkFrame += dt * rate;
      const f = Math.floor(this.walkFrame) % 3;
      if (this.facingSide === "back") {
        this.setMap(this.tex.walk_back ? "walk_back" : "idle_back");
      } else if (this.facingSide === "side_l") {
        this.setMap("walk_side_l_" + f);
      } else if (this.facingSide === "side_r") {
        this.setMap("walk_side_r_" + f);
      } else {
        // Front walk: alternate threeq / front for life
        this.setMap(f === 1 && this.tex.idle_threeq ? "idle_threeq" : "idle_front");
      }
    } else {
      this.anim = "idle";
      if (this.facingSide === "side_l") this.setMap("idle_side_l");
      else if (this.facingSide === "side_r") this.setMap("idle_side_r");
      else if (this.facingSide === "back") this.setMap("idle_back");
      else if (this.facingSide === "front") this.setMap("idle_front");
      else this.setMap("idle_threeq");
    }

    // Soft bob / backpack sway (continuous, not frame-stepped)
    const mb = this._moveBlend;
    const breathe = Math.sin(this.animT * (2.2 + mb * 9)) * (0.012 + mb * 0.028);
    const pack = Math.sin(this.animT * (2.0 + mb * 8) + 0.9) * (0.015 + mb * 0.02);
    this.bob = breathe;
    this.sprite.position.y =
      0.95 + this.y + breathe + mb * Math.abs(Math.sin(this.animT * 9)) * 0.035;
    this.sprite.rotation.z = pack * (0.6 + mb * 0.9) + Math.sin(this.animT * 1.6) * 0.015;
    this.sprite.scale.set(1 + pack * 0.25, 1 - pack * 0.1, 1);

    this.shadow.position.y = 0.025 + Math.min(this.y * 0.02, 0.06);
    const ss = 1 - Math.min(this.y * 0.07, 0.32);
    this.shadow.scale.set(ss, ss, ss);

    // Billboard toward camera — smooth yaw so no snap
    if (camPos) {
      const targetYaw = Math.atan2(camPos.x - this.x, camPos.z - this.z);
      this._billYaw = lerpAngle(this._billYaw, targetYaw, 1 - Math.exp(-dt * 14));
      this.sprite.rotation.y = this._billYaw;
    }

    if (this.hurtT > 0) {
      this.hurtT -= dt;
      this.sprite.material.opacity = Math.floor(this.hurtT * 12) % 2 ? 0.4 : 1;
    } else {
      this.sprite.material.opacity = 1;
    }
  };

  /**
   * Smooth third-person move: accel toward camera-relative velocity.
   */
  Player.prototype.update = function (dt, input, camYaw, blocked, foods, camPos) {
    const GRAV = -32;
    const JUMP_V = 9.2;
    const MAX_WALK = 4.8;
    const MAX_RUN = 7.6;
    const maxSpeed = input.sprint ? MAX_RUN : MAX_WALK;
    const ACCEL = input.sprint ? 28 : 20;
    const FRICTION = 16;

    // Camera-relative desired direction on XZ
    const mx = -Math.sin(camYaw) * input.z + Math.cos(camYaw) * input.x;
    const mz = -Math.cos(camYaw) * input.z - Math.sin(camYaw) * input.x;
    const inputMag = Math.hypot(input.x, input.z);
    const moving = inputMag > 0.06;

    // Desired velocity
    let tvx = 0;
    let tvz = 0;
    if (moving) {
      const inv = 1 / Math.max(0.001, Math.hypot(mx, mz));
      tvx = mx * inv * maxSpeed * Math.min(1, inputMag);
      tvz = mz * inv * maxSpeed * Math.min(1, inputMag);
      // Smooth turn toward move direction
      const wantFace = Math.atan2(mx, mz);
      this.facing = lerpAngle(this.facing, wantFace, 1 - Math.exp(-dt * 12));
    }

    // Accelerate / friction (no instant snap)
    if (moving) {
      this.vx = lerp(this.vx, tvx, 1 - Math.exp(-dt * ACCEL / maxSpeed));
      this.vz = lerp(this.vz, tvz, 1 - Math.exp(-dt * ACCEL / maxSpeed));
    } else {
      const damp = Math.exp(-dt * FRICTION);
      this.vx *= damp;
      this.vz *= damp;
      if (Math.hypot(this.vx, this.vz) < 0.05) {
        this.vx = 0;
        this.vz = 0;
      }
    }

    if (input.jumpEdge && this.onGround) {
      this.vy = JUMP_V;
      this.onGround = false;
      if (window.JIMPTHY_AUDIO) JIMPTHY_AUDIO.play("jump", { volume: 0.4 });
    }

    this.vy += GRAV * dt;

    // Integrate — separate axes for wall slide
    let nx = this.x + this.vx * dt;
    let nz = this.z + this.vz * dt;
    let ny = this.y + this.vy * dt;

    if (!blocked(nx, this.y, this.z, this.radius)) this.x = nx;
    else {
      this.vx *= 0.2;
      // micro-nudge slide try
      if (!blocked(this.x + this.vx * dt * 0.3, this.y, this.z, this.radius)) {
        this.x += this.vx * dt * 0.3;
      }
    }
    if (!blocked(this.x, this.y, nz, this.radius)) this.z = nz;
    else {
      this.vz *= 0.2;
      if (!blocked(this.x, this.y, this.z + this.vz * dt * 0.3, this.radius)) {
        this.z += this.vz * dt * 0.3;
      }
    }

    if (ny <= 0) {
      if (!this.onGround && this.vy < -2.5) {
        if (window.JIMPTHY_AUDIO) JIMPTHY_AUDIO.play("land", { volume: 0.28 });
      }
      ny = 0;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    this.y = ny;

    // Pickups
    if (foods) {
      for (const f of foods) {
        if (f.taken) continue;
        const d = Math.hypot(f.x - this.x, f.z - this.z);
        if (d < 1.2 && (input.act || d < 0.9)) {
          f.taken = true;
          if (f.mesh) f.mesh.visible = false;
          this.belly = Math.min(this.bellyMax, this.belly + f.val);
          this.score += f.big ? 50 : 20;
          this.hp = Math.min(100, this.hp + 5);
          if (window.JIMPTHY_AUDIO) JIMPTHY_AUDIO.play("eat", { volume: 0.45 });
        }
      }
    }

    this.belly = Math.max(0, this.belly - 1.1 * dt);

    // Root at ground; sprite handles jump height
    this.root.position.set(this.x, 0, this.z);
    this._updateAnim(moving, dt, camYaw, camPos || null);

    return {
      moving,
      belly: this.belly,
      score: this.score,
      dead: this.belly <= 0 || this.hp <= 0,
      won: this.belly >= this.bellyMax,
    };
  };

  Player.prototype.faceCamera = function (camPos) {
    if (!this.sprite || !camPos) return;
    const targetYaw = Math.atan2(camPos.x - this.x, camPos.z - this.z);
    // Snap only when far off; otherwise keep smooth path from update
    this._billYaw = lerpAngle(this._billYaw, targetYaw, 0.35);
    this.sprite.rotation.y = this._billYaw;
  };

  Player.prototype.hurt = function (amt) {
    if (this.hurtT > 0) return;
    this.hp -= amt;
    this.hurtT = 0.8;
    this.belly = Math.max(0, this.belly - amt * 0.2);
    if (window.JIMPTHY_AUDIO) JIMPTHY_AUDIO.play("hurt", { volume: 0.4 });
  };

  Player.prototype.reset = function (x, z) {
    this.x = x;
    this.y = 0;
    this.z = z;
    this.vx = this.vy = this.vz = 0;
    this.belly = 40;
    this.hp = 100;
    this.score = 0;
    this.onGround = true;
    this.hurtT = 0;
    this._moveBlend = 0;
    this.facing = 0;
    this.root.position.set(x, 0, z);
    if (this.tex.idle_back) this.setMap("idle_back");
    else if (this.tex.idle_front) this.setMap("idle_front");
  };

  /** Load all sprite textures (with fallbacks) */
  Player.loadTextures = function (THREE, loader) {
    const names = [
      "idle_front",
      "idle_back",
      "idle_side_l",
      "idle_side_r",
      "idle_threeq",
      "walk_back",
      "walk_side_l_0",
      "walk_side_l_1",
      "walk_side_l_2",
      "walk_side_r_0",
      "walk_side_r_1",
      "walk_side_r_2",
      "jump_front",
    ];
    const alias = {
      walk_side_l_0: "idle_side_l",
      walk_side_l_1: "idle_side_l",
      walk_side_l_2: "idle_side_l",
      walk_side_r_0: "idle_side_r",
      walk_side_r_1: "idle_side_r",
      walk_side_r_2: "idle_side_r",
      walk_back: "idle_back",
      jump_front: "idle_front",
      idle_side_l: "idle_side",
      idle_side_r: "idle_side",
    };
    return Promise.all(
      names.map(
        (n) =>
          new Promise((resolve) => {
            const tryLoad = (url, onFail) => {
              loader.load(
                url + "?v=raccoon-tp-1",
                (t) => {
                  t.encoding = THREE.sRGBEncoding;
                  t.minFilter = THREE.LinearMipmapLinearFilter;
                  t.magFilter = THREE.LinearFilter;
                  t.anisotropy = 8;
                  t.generateMipmaps = true;
                  resolve({ n, t });
                },
                undefined,
                onFail
              );
            };
            tryLoad(ASSET + n + ".png", () => {
              const fb = alias[n] || "idle_front";
              tryLoad(ASSET + fb + ".png", () => {
                // last resort: saved archive
                tryLoad(ASSET + "saved/" + n + ".png", () => {
                  tryLoad(
                    ASSET + "saved/" + (alias[n] || "idle_front") + ".png",
                    () => resolve({ n, t: null })
                  );
                });
              });
            });
          })
      )
    ).then((list) => {
      const map = {};
      list.forEach(({ n, t }) => {
        if (t) map[n] = t;
      });
      if (!map.idle_front && map.idle_threeq) map.idle_front = map.idle_threeq;
      if (!map.idle_back && map.idle_front) map.idle_back = map.idle_front;
      if (!map.idle_side_l && map.idle_side) map.idle_side_l = map.idle_side;
      if (!map.idle_side_r && map.idle_side) map.idle_side_r = map.idle_side;
      // fill walk frames from idle if missing
      for (let i = 0; i < 3; i++) {
        if (!map["walk_side_l_" + i] && map.idle_side_l) map["walk_side_l_" + i] = map.idle_side_l;
        if (!map["walk_side_r_" + i] && map.idle_side_r) map["walk_side_r_" + i] = map.idle_side_r;
      }
      return map;
    });
  };

  global.JIMPTHY_Player = Player;
})(window);
