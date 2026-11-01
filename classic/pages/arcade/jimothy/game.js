/**
 * JIMOTHY — GTA-style 3D block (visual pass)
 * Real meshes only. Reference image = palette/vibe, not pasted photos.
 */
(function () {
  "use strict";

  if (typeof THREE === "undefined" || !window.JIMOTHY_WORLD) {
    document.body.innerHTML =
      "<p style='color:#fff;padding:24px;font-family:sans-serif'>Load via http://127.0.0.1:8765/</p>";
    return;
  }

  const ASSET = "assets/";
  const canvas = document.getElementById("c");
  const minimap = document.getElementById("minimap");
  const mctx = minimap ? minimap.getContext("2d") : null;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  if ("physicallyCorrectLights" in renderer) renderer.physicallyCorrectLights = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc8b090);
  // Haze that still lets you read depth
  scene.fog = new THREE.Fog(0xc4a878, 12, 70);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 160);

  JIMOTHY_WORLD.setupSky(scene);
  const sun = JIMOTHY_WORLD.setupLights(scene);

  let world = null;
  let mode = "title";
  const keys = Object.create(null);
  let stick = { x: 0, y: 0 };
  let sprintBtn = false;
  let lookL = false;
  let lookR = false;
  let yaw = Math.PI * 0.85;
  let pitch = 0.12;
  let mouseDrag = false;
  let lastMX = 0;
  let lastMY = 0;
  let clock = 0;
  let jimothyTextures = null;

  const player = {
    x: 0,
    z: 8,
    facing: 0,
    speed: 0,
    root: null,
    sprite: null,
  };

  const loader = new THREE.TextureLoader();
  function loadTex(url) {
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (t) => {
          t.encoding = THREE.sRGBEncoding;
          t.anisotropy = 4;
          resolve(t);
        },
        undefined,
        reject
      );
    });
  }

  function setMode(m) {
    mode = m;
    const overlay = document.getElementById("overlay");
    const hud = document.getElementById("hud");
    const touch = document.getElementById("touch");
    ["title", "help", "pause", "win", "over"].forEach((id) => {
      const p = document.getElementById("panel-" + id);
      if (p) p.classList.add("hidden");
    });
    if (m === "play") {
      overlay.classList.add("hidden");
      hud.classList.remove("hidden");
      if (window.matchMedia("(hover: none), (max-width: 700px)").matches) {
        touch.classList.remove("hidden");
      }
    } else {
      overlay.classList.remove("hidden");
      hud.classList.add("hidden");
      touch.classList.add("hidden");
      const p = document.getElementById("panel-" + m);
      if (p) p.classList.remove("hidden");
    }
  }

  function makeJimothy() {
    if (player.root) scene.remove(player.root);
    const root = new THREE.Group();

    // Soft blob shadow under character
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 16),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.04;
    root.add(shadow);

    if (jimothyTextures) {
      // Standard material so fixed sun casts a real player shadow
      const mat = new THREE.MeshStandardMaterial({
        map: jimothyTextures.front,
        transparent: true,
        alphaTest: 0.12,
        side: THREE.DoubleSide,
        roughness: 0.9,
        metalness: 0.02,
      });
      const sprite = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.45), mat);
      sprite.position.y = 0.75;
      sprite.castShadow = true;
      sprite.receiveShadow = true;
      root.add(sprite);
      player.sprite = sprite;
    } else {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0x6e6e76, roughness: 0.85 })
      );
      body.scale.set(1.1, 0.85, 1);
      body.position.y = 0.7;
      body.castShadow = true;
      body.receiveShadow = true;
      const pack = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.4, 0.2),
        new THREE.MeshStandardMaterial({ color: 0xe8c040, roughness: 0.6 })
      );
      pack.position.set(0, 0.85, -0.35);
      pack.castShadow = true;
      root.add(body, pack);
      player.sprite = body;
    }

    root.position.set(player.x, 0, player.z);
    scene.add(root);
    player.root = root;
  }

  function updateJimothySprite() {
    if (!player.sprite || !jimothyTextures) return;
    // Billboard toward camera for Jimothy art; world around is real 3D
    const camAng = Math.atan2(camera.position.x - player.x, camera.position.z - player.z);
    let rel = player.facing - camAng;
    while (rel < -Math.PI) rel += Math.PI * 2;
    while (rel > Math.PI) rel -= Math.PI * 2;
    const a = Math.abs(rel);
    let tex = jimothyTextures.front;
    if (a < Math.PI * 0.25) tex = jimothyTextures.front;
    else if (a > Math.PI * 0.75) tex = jimothyTextures.back;
    else if (rel > 0) tex = jimothyTextures.side_l;
    else tex = jimothyTextures.side_r;
    if (player.sprite.material && player.sprite.material.map !== tex) {
      player.sprite.material.map = tex;
      player.sprite.material.needsUpdate = true;
    }
    if (player.sprite.isMesh && player.sprite.geometry.type === "PlaneGeometry") {
      player.sprite.rotation.y = camAng;
      const bob = player.speed > 0.1 ? Math.sin(clock * 10) * 0.03 : 0;
      player.sprite.position.y = 0.75 + bob;
    }
  }

  function blocked(nx, nz) {
    if (Math.abs(nx) > 5.0) return true;
    if (nz < 1.5 || nz > 27) return true;
    if (!world) return false;
    for (const c of world.colliders) {
      if (nx > c.minX && nx < c.maxX && nz > c.minZ && nz < c.maxZ) return true;
    }
    return false;
  }

  function enterWorld() {
    if (world && world.root) scene.remove(world.root);
    world = JIMOTHY_WORLD.buildBlock(scene);
    player.x = 0;
    player.z = 8;
    player.facing = 0;
    yaw = Math.PI * 0.9;
    pitch = 0.1;
    makeJimothy();
    document.getElementById("m-title").textContent = "3D BLOCK";
    document.getElementById("m-desc").textContent =
      "Real meshes · GTA-style volume · walk to inspect";
    document.getElementById("hp-fill").style.width = "100%";
    document.getElementById("hp-txt").textContent = "—";
    document.getElementById("money").textContent = "★ 3D";
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = "Walk around the car — it's solid 3D";
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2800);
    }
  }

  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "Escape") {
      if (mode === "play") setMode("pause");
      else if (mode === "pause") setMode("play");
      else if (mode === "help") setMode("title");
    }
  });
  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (mode !== "play") return;
    mouseDrag = true;
    lastMX = e.clientX;
    lastMY = e.clientY;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!mouseDrag || mode !== "play") return;
    yaw -= (e.clientX - lastMX) * 0.005;
    pitch += (e.clientY - lastMY) * 0.003;
    pitch = Math.max(-0.15, Math.min(0.45, pitch));
    lastMX = e.clientX;
    lastMY = e.clientY;
  });
  canvas.addEventListener("pointerup", () => {
    mouseDrag = false;
  });
  canvas.addEventListener("pointercancel", () => {
    mouseDrag = false;
  });

  // Touch
  const stickEl = document.getElementById("stick");
  const knob = document.getElementById("knob");
  function setStickUI(cx, cy) {
    if (!stickEl) return;
    const r = stickEl.getBoundingClientRect();
    let dx = cx - (r.left + r.width / 2);
    let dy = cy - (r.top + r.height / 2);
    const max = r.width * 0.38;
    const len = Math.hypot(dx, dy) || 1;
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    stick.x = dx / max;
    stick.y = dy / max;
    if (knob) knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
  function clearStickUI() {
    stick.x = 0;
    stick.y = 0;
    if (knob) knob.style.transform = "translate(-50%, -50%)";
  }
  if (stickEl) {
    stickEl.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      stickEl.setPointerCapture(e.pointerId);
      setStickUI(e.clientX, e.clientY);
    });
    stickEl.addEventListener("pointermove", (e) => {
      if (e.buttons) setStickUI(e.clientX, e.clientY);
    });
    stickEl.addEventListener("pointerup", clearStickUI);
    stickEl.addEventListener("pointercancel", clearStickUI);
  }
  function hold(id, on, off) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      on();
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => el.addEventListener(ev, off));
  }
  hold("btn-sprint", () => (sprintBtn = true), () => (sprintBtn = false));
  hold("look-l", () => (lookL = true), () => (lookL = false));
  hold("look-r", () => (lookR = true), () => (lookR = false));

  document.getElementById("btn-start").onclick = () => {
    enterWorld();
    setMode("play");
  };
  document.getElementById("btn-resume").onclick = () => setMode("play");
  document.getElementById("btn-quit").onclick = () => setMode("title");
  document.getElementById("btn-help").onclick = () => setMode("help");
  document.getElementById("btn-help-close").onclick = () => setMode("title");

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function update(dt) {
    if (mode !== "play") return;
    clock += dt;

    if (keys.KeyQ || lookL) yaw += 1.4 * dt;
    if (keys.KeyE || lookR) yaw -= 1.4 * dt;

    let ir = 0;
    let ifw = 0;
    if (keys.KeyA || keys.ArrowLeft) ir -= 1;
    if (keys.KeyD || keys.ArrowRight) ir += 1;
    if (keys.KeyW || keys.ArrowUp) ifw += 1;
    if (keys.KeyS || keys.ArrowDown) ifw -= 1;
    ir += stick.x;
    ifw += -stick.y;
    const ilen = Math.hypot(ir, ifw);
    if (ilen > 1) {
      ir /= ilen;
      ifw /= ilen;
    }

    const sprint = (keys.ShiftLeft || keys.ShiftRight || sprintBtn) && ilen > 0.1;
    const spd = sprint ? 7 : 4;

    // Move relative to camera yaw (GTA-style)
    const mx = -Math.sin(yaw) * ifw + Math.cos(yaw) * ir;
    const mz = -Math.cos(yaw) * ifw - Math.sin(yaw) * ir;

    if (ilen > 0.05) {
      const nx = player.x + mx * spd * dt;
      const nz = player.z + mz * spd * dt;
      if (!blocked(nx, player.z)) player.x = nx;
      if (!blocked(player.x, nz)) player.z = nz;
      player.facing = Math.atan2(mx, mz);
      player.speed = spd;
    } else player.speed = 0;

    if (player.root) {
      player.root.position.set(player.x, 0, player.z);
      updateJimothySprite();
    }

    // Fixed sun direction; shadow volume follows player so cast shadows stay sharp
    JIMOTHY_WORLD.updateSunShadows(sun, player.x, player.z);

    // GTA chase cam: behind, elevated, slight pitch
    const camDist = 6.5;
    const camH = 2.4 + pitch * 3;
    const lx = player.x;
    const ly = 1.1;
    const lz = player.z;
    const cx = player.x + Math.sin(yaw) * camDist;
    const cy = camH;
    const cz = player.z + Math.cos(yaw) * camDist;
    camera.position.set(cx, cy, cz);
    camera.lookAt(lx, ly, lz);

    drawMinimap();
  }

  function drawMinimap() {
    if (!mctx || !minimap) return;
    const w = minimap.width;
    const h = minimap.height;
    mctx.clearRect(0, 0, w, h);
    mctx.fillStyle = "#2a2820";
    mctx.beginPath();
    mctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
    mctx.fill();
    mctx.save();
    mctx.beginPath();
    mctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2);
    mctx.clip();
    const scale = 2.5;
    const ox = w / 2 - player.x * scale;
    const oy = h / 2 - player.z * scale;
    mctx.fillStyle = "#555248";
    mctx.fillRect(-5.5 * scale + ox, 0, 11 * scale, 32 * scale);
    if (world) {
      mctx.fillStyle = "#7a7060";
      for (const c of world.colliders) {
        mctx.fillRect(
          c.minX * scale + ox,
          c.minZ * scale + oy,
          (c.maxX - c.minX) * scale,
          (c.maxZ - c.minZ) * scale
        );
      }
    }
    mctx.fillStyle = "#fff";
    mctx.beginPath();
    mctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
    mctx.fill();
    mctx.restore();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (mode === "title" && world) {
      clock += dt;
      // Orbit showcase so you SEE depth / car volume on title
      yaw = Math.PI * 0.7 + clock * 0.15;
      const dist = 9;
      const focus = new THREE.Vector3(2.6, 0.8, 14.5); // look at the 3D car
      camera.position.set(
        focus.x + Math.sin(yaw) * dist,
        3.2,
        focus.z + Math.cos(yaw) * dist
      );
      camera.lookAt(focus);
      JIMOTHY_WORLD.updateSunShadows(sun, focus.x, focus.z);
    } else {
      update(dt);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // UI copy
  const titleP = document.querySelector("#panel-title p");
  if (titleP) {
    titleP.textContent =
      "True 3D GTA-style block. Buildings, car, curbs, poles are meshes with shadows — not pasted photos. Reference only guided the look.";
  }
  const tag = document.querySelector("#panel-title .tag");
  if (tag) tag.textContent = "REAL 3D · GTA CAMERA";
  const startBtn = document.getElementById("btn-start");
  startBtn.textContent = "ENTER 3D BLOCK";

  // Build world immediately (no photo env deps)
  world = JIMOTHY_WORLD.buildBlock(scene);
  player.x = 0;
  player.z = 8;

  // Load Jimothy art optional; world works without it
  Promise.all([
    loadTex(ASSET + "jimothy_front.png"),
    loadTex(ASSET + "jimothy_side_r.png"),
    loadTex(ASSET + "jimothy_back.png"),
    loadTex(ASSET + "jimothy_side_l.png"),
  ])
    .then(([front, side_r, back, side_l]) => {
      jimothyTextures = { front, side_r, back, side_l };
      makeJimothy();
      setMode("title");
      requestAnimationFrame(frame);
    })
    .catch(() => {
      makeJimothy();
      setMode("title");
      requestAnimationFrame(frame);
    });
})();
