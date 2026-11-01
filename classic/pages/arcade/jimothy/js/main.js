/**
 * JIMPTHY — main loop
 * Boots Three.js scene, world, player, camera, VHS, audio stubs.
 */
(function () {
  "use strict";

  if (typeof THREE === "undefined") {
    document.body.innerHTML =
      "<p style='color:#fff;padding:24px'>Three.js failed. Check network / CDN.</p>";
    return;
  }

  const canvas = document.getElementById("c");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (window.JIMPTHY_RENDER) {
    JIMPTHY_RENDER.configureRenderer(renderer);
  } else {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc8b090);
  scene.fog = new THREE.FogExp2(0xc4a888, 0.0075);

  const camera = new THREE.PerspectiveCamera(
    48,
    window.innerWidth / window.innerHeight,
    0.12,
    340
  );

  // World module (shared name from world.js)
  const World = window.JIMOTHY_WORLD || window.JIMPTHY_WORLD;
  if (!World) {
    document.getElementById("load-msg").textContent = "world.js missing";
    return;
  }

  // Env map for glass/metal IBL — before city build so materials pick it up
  let envMap = null;
  if (window.JIMPTHY_RENDER && JIMPTHY_RENDER.createEnvMap) {
    try {
      envMap = JIMPTHY_RENDER.createEnvMap(renderer);
      if (window.JIMPTHY_CITY && JIMPTHY_CITY.setEnvMap) {
        JIMPTHY_CITY.setEnvMap(envMap);
      }
      scene.environment = envMap;
    } catch (e) {
      console.warn("env map failed", e);
    }
  }

  // Sky + day/night lighting
  let sun = null;
  let cityLights = null;
  let skyCtrl = null;
  if (window.JIMPTHY_CITY && JIMPTHY_CITY.setupCityLights) {
    cityLights = JIMPTHY_CITY.setupCityLights(scene);
    sun = cityLights.sun;
    skyCtrl = cityLights.skyCtrl || null;
  } else {
    World.setupSky(scene);
    sun = World.setupLights(scene);
  }

  // Post-process: grade, vignette, mild bloom, grain
  let post = null;
  if (window.JIMPTHY_RENDER && JIMPTHY_RENDER.createPostFX) {
    post = JIMPTHY_RENDER.createPostFX(renderer, scene, camera);
    post.setSize(window.innerWidth, window.innerHeight);
    if (skyCtrl && skyCtrl.setPost) skyCtrl.setPost(post);
  }

  function bindWorldNight(w) {
    if (!skyCtrl || !w) return;
    if (skyCtrl.bindLamps) skyCtrl.bindLamps(w.nightLamps || []);
    if (skyCtrl.bindWindows) skyCtrl.bindWindows(w.nightWindows || []);
  }

  function syncTodButton() {
    const btn = document.getElementById("btn-tod");
    if (!btn || !skyCtrl) return;
    const night = skyCtrl.isNight && skyCtrl.isNight();
    btn.textContent = night ? "NIGHT" : "DAY";
    btn.classList.toggle("night", !!night);
  }

  function toggleDayNight() {
    if (!skyCtrl || !skyCtrl.toggle) return;
    skyCtrl.toggle();
    syncTodButton();
  }

  let world = null;
  let player = null;
  let foods = [];
  let mode = "title"; // title | play | pause | help | win | over
  let follow = new JIMPTHY_FollowCamera(camera);
  let pauseLatch = false;
  const minimap = document.getElementById("minimap");
  const mctx = minimap ? minimap.getContext("2d") : null;

  function drawMinimap() {
    if (!mctx || !player) return;
    const w = minimap.width;
    const h = minimap.height;
    mctx.clearRect(0, 0, w, h);
    mctx.fillStyle = "#1a2218";
    mctx.beginPath();
    mctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
    mctx.fill();
    mctx.save();
    mctx.beginPath();
    mctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    mctx.clip();
    const scale = 0.9;
    const ox = w / 2 - player.x * scale;
    const oy = h / 2 - player.z * scale;
    // open map plate
    const span = world && world.bounds ? world.bounds * 2 : 120;
    mctx.fillStyle = "#4a4a42";
    mctx.fillRect(-span * 0.5 * scale + ox, -span * 0.5 * scale + oy, span * scale, span * scale);
    // building blobs from colliders (skip outer walls)
    if (world && world.colliders) {
      mctx.fillStyle = "#6a6058";
      for (const c of world.colliders) {
        const w = c.maxX - c.minX;
        const d = c.maxZ - c.minZ;
        if (w > 40 || d > 40) continue; // skip bound walls
        mctx.fillRect(c.minX * scale + ox, c.minZ * scale + oy, w * scale, d * scale);
      }
    }
    // snacks
    mctx.fillStyle = "#88ffaa";
    for (const f of foods) {
      if (f.taken) continue;
      mctx.beginPath();
      mctx.arc(f.x * scale + ox, f.z * scale + oy, 2.5, 0, Math.PI * 2);
      mctx.fill();
    }
    // player blip
    mctx.fillStyle = "#ffffff";
    mctx.beginPath();
    mctx.arc(w / 2, h / 2, 3.5, 0, Math.PI * 2);
    mctx.fill();
    mctx.strokeStyle = "#33cc55";
    mctx.lineWidth = 2;
    mctx.beginPath();
    mctx.moveTo(w / 2, h / 2);
    mctx.lineTo(w / 2 + Math.sin(player.facing) * 10, h / 2 + Math.cos(player.facing) * 10);
    mctx.stroke();
    mctx.restore();
  }

  const loadMsg = document.getElementById("load-msg");
  const startBtn = document.getElementById("btn-start");
  startBtn.disabled = true;

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

  function blocked(nx, ny, nz, radius) {
    if (!world) return false;
    const r = radius != null ? radius : 0.4;
    const b = world.bounds != null ? world.bounds : 60;
    if (Math.abs(nx) > b - r || Math.abs(nz) > b - r) return true;
    for (const c of world.colliders) {
      // Circle vs AABB (expanded by radius)
      const nearestX = Math.max(c.minX, Math.min(nx, c.maxX));
      const nearestZ = Math.max(c.minZ, Math.min(nz, c.maxZ));
      const dx = nx - nearestX;
      const dz = nz - nearestZ;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  function spawnFoods() {
    foods.forEach((f) => {
      if (f.mesh) scene.remove(f.mesh);
    });
    foods = [];
    // Temporary mechanics pickups — muted, few, on roads only (not city clutter toys)
    const span = world && world.bounds ? world.bounds * 1.4 : 50;
    for (let i = 0; i < 16; i++) {
      const col = 0xc8a060;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 8),
        new THREE.MeshStandardMaterial({
          color: col,
          roughness: 0.45,
          metalness: 0.15,
          emissive: 0x604020,
          emissiveIntensity: 0.2,
        })
      );
      // Prefer road corridors (near axes / cell lines)
      const onAxis = i % 2 === 0;
      const x = onAxis
        ? (Math.random() - 0.5) * 8
        : (Math.random() - 0.5) * span;
      const z = onAxis
        ? (Math.random() - 0.5) * span
        : (Math.random() - 0.5) * 8;
      mesh.position.set(x, 0.28, z);
      mesh.castShadow = true;
      scene.add(mesh);
      foods.push({
        mesh,
        x,
        z,
        val: 14,
        big: false,
        taken: false,
        pulse: Math.random() * 5,
      });
    }
  }

  function updateHud() {
    if (!player) return;
    const b = document.getElementById("belly-fill");
    if (b) b.style.width = Math.max(0, Math.min(100, player.belly)) + "%";
    const s = document.getElementById("score");
    if (s) s.textContent = "★ " + player.score;
    const st = document.getElementById("hud-status");
    if (st) {
      st.textContent =
        player.belly < 40
          ? "Belly low — grab glowing snacks!"
          : "Explore · jump · eat snacks";
    }
  }

  function startGame() {
    if (world && world.root) scene.remove(world.root);
    world = World.buildBlock(scene);
    bindWorldNight(world);
    spawnFoods();
    const sx = (world.spawn && world.spawn.x) != null ? world.spawn.x : -20;
    const sz = (world.spawn && world.spawn.z) != null ? world.spawn.z : -20;
    if (player) {
      player.reset(sx, sz);
    }
    follow.yaw = Math.PI * 0.25;
    follow.pitch = 0.3;
    follow.dist = 7.5;
    if (follow.snapTo) follow.snapTo(sx, 0, sz);
    setMode("play");
    if (window.JIMPTHY_AUDIO) JIMPTHY_AUDIO.startMusic();
    updateHud();
    syncTodButton();
  }

  // UI
  document.getElementById("btn-start").onclick = startGame;
  document.getElementById("btn-help").onclick = () => setMode("help");
  document.getElementById("btn-help-close").onclick = () => setMode("title");
  document.getElementById("btn-resume").onclick = () => setMode("play");
  document.getElementById("btn-quit").onclick = () => {
    if (window.JIMPTHY_AUDIO) JIMPTHY_AUDIO.stopMusic();
    setMode("title");
  };
  document.getElementById("btn-pause").onclick = () => {
    if (mode === "play") setMode("pause");
  };
  document.getElementById("btn-vhs-pause").onclick = () => {
    if (window.JIMPTHY_VHS) JIMPTHY_VHS.toggle();
  };
  const todBtn = document.getElementById("btn-tod");
  if (todBtn) todBtn.onclick = toggleDayNight;
  // Pause menu night toggle via same key handled in frame
  document.getElementById("btn-again").onclick = startGame;
  document.getElementById("btn-retry").onclick = startGame;

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (post) post.setSize(window.innerWidth, window.innerHeight);
  });

  JIMPTHY_INPUT.init(canvas);
  JIMPTHY_VHS.init();

  const loader = new THREE.TextureLoader();
  let last = performance.now();
  let clock = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;

    // Pause key
    if (mode === "play" && JIMPTHY_INPUT.keys.Escape) {
      if (!pauseLatch) {
        setMode("pause");
        pauseLatch = true;
      }
    } else if (mode === "pause" && JIMPTHY_INPUT.keys.Escape) {
      if (!pauseLatch) {
        setMode("play");
        pauseLatch = true;
      }
    } else {
      pauseLatch = false;
    }

    // Day / night toggle (N) — edge trigger
    if (
      (mode === "play" || mode === "title" || mode === "pause") &&
      JIMPTHY_INPUT.keys.KeyN &&
      !JIMPTHY_INPUT.keys._nLatch
    ) {
      JIMPTHY_INPUT.keys._nLatch = true;
      toggleDayNight();
    }
    if (!JIMPTHY_INPUT.keys.KeyN) JIMPTHY_INPUT.keys._nLatch = false;

    // Dust drift
    if (world && world.atmosphere && world.atmosphere.dust) {
      world.atmosphere.dust.rotation.y = clock * 0.02;
      const p = world.atmosphere.dust.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + dt * 0.15;
        if (y > 8) y = 0.2;
        p.setY(i, y);
      }
      p.needsUpdate = true;
    }

    if (mode === "title") {
      // Cinematic orbit around spawn intersection + Jimpthy
      const t = clock * 0.16;
      const sx = (world && world.spawn && world.spawn.x) != null ? world.spawn.x : -20;
      const sz = (world && world.spawn && world.spawn.z) != null ? world.spawn.z : -20;
      if (player) {
        player.x = sx;
        player.z = sz;
        player.y = 0;
        player.root.position.set(sx, 0, sz);
        if (player.tex && player.tex.idle_back) player.setMap("idle_back");
        else if (player.tex && player.tex.idle_front) player.setMap("idle_front");
        // Soft idle bob on title
        if (player.sprite) {
          player.sprite.position.y = 0.95 + Math.sin(clock * 2.2) * 0.02;
        }
      }
      const rad = 11;
      camera.position.set(sx + Math.sin(t) * rad, 4.8, sz + Math.cos(t) * rad);
      camera.lookAt(sx, 1.1, sz);
      if (player) player.faceCamera(camera.position);
      if (skyCtrl && skyCtrl.update) {
        skyCtrl.update(dt, sx, sz);
      } else if (window.JIMPTHY_CITY && JIMPTHY_CITY.updateSunShadows) {
        JIMPTHY_CITY.updateSunShadows(sun, sx, sz);
      } else if (World.updateSunShadows) World.updateSunShadows(sun, sx, sz);
    } else if (mode === "play" && player) {
      const look = JIMPTHY_INPUT.consumeLook();
      follow.addLook(look.yaw, look.pitch);
      if (look.zoom) follow.addZoom(look.zoom);

      // Camera first so player billboard uses current cam for this frame's end
      // (player update uses previous cam pos for billboard — fine with smooth lag)
      const mv = JIMPTHY_INPUT.moveAxes();
      const st = player.update(
        dt,
        {
          x: mv.x,
          z: mv.z,
          sprint: mv.sprint,
          jumpEdge: JIMPTHY_INPUT.consumeJumpEdge(),
          act: JIMPTHY_INPUT.consumeAct(),
        },
        follow.yaw,
        blocked,
        foods,
        camera.position
      );

      // Collectible pulse
      for (const f of foods) {
        if (f.taken || !f.mesh) continue;
        f.pulse += dt * 3;
        f.mesh.position.y = 0.32 + Math.sin(f.pulse) * 0.08;
        f.mesh.rotation.y += dt;
      }

      // Smooth third-person follow
      follow.update(dt, player.x, player.y, player.z);
      if (skyCtrl && skyCtrl.update) {
        skyCtrl.update(dt, player.x, player.z);
      } else if (window.JIMPTHY_CITY && JIMPTHY_CITY.updateSunShadows) {
        JIMPTHY_CITY.updateSunShadows(sun, player.x, player.z);
      } else if (World.updateSunShadows) World.updateSunShadows(sun, player.x, player.z);

      updateHud();
      drawMinimap();

      if (st.won) {
        document.getElementById("win-text").textContent =
          "Belly full. ★ " + player.score;
        setMode("win");
        if (window.JIMPTHY_AUDIO) JIMPTHY_AUDIO.stopMusic();
      } else if (st.dead) {
        document.getElementById("over-text").textContent =
          "Starved or wiped. ★ " + player.score;
        setMode("over");
        if (window.JIMPTHY_AUDIO) JIMPTHY_AUDIO.stopMusic();
      }
    }

    if (post) post.render(dt);
    else renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // Boot: city + load raccoon sprites
  world = World.buildBlock(scene);
  bindWorldNight(world);
  if (skyCtrl && skyCtrl.update) skyCtrl.update(0, world.spawn ? world.spawn.x : -20, world.spawn ? world.spawn.z : -20);
  syncTodButton();
  loadMsg.textContent = "Loading Jimpthy…";

  JIMPTHY_Player.loadTextures(THREE, loader)
    .then((tex) => {
      const keys = Object.keys(tex);
      if (!tex.idle_front && !tex.idle_back) {
        loadMsg.textContent = "Sprites missing — check assets/jimothy/ (use http server)";
      } else {
        loadMsg.textContent = "Ready — third-person free roam.";
      }
      player = new JIMPTHY_Player(scene, tex);
      const sx = (world.spawn && world.spawn.x) != null ? world.spawn.x : -20;
      const sz = (world.spawn && world.spawn.z) != null ? world.spawn.z : -20;
      player.reset(sx, sz);
      startBtn.disabled = false;
      setMode("title");
      requestAnimationFrame(frame);
    })
    .catch((err) => {
      console.error(err);
      loadMsg.textContent = "Load failed. Open http://127.0.0.1:8765/ and hard-refresh.";
      startBtn.disabled = false;
      setMode("title");
      requestAnimationFrame(frame);
    });
})();
