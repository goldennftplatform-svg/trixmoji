/**
 * Proper sky dome + day / night lighting controller.
 * Drives sun/moon, ambient, fog, street lamps, window glow, post grade.
 */
(function (global) {
  "use strict";

  const DAY = {
    sunColor: new THREE.Color(0xffc878),
    sunIntensity: 2.35,
    hemiSky: new THREE.Color(0xffe2c0),
    hemiGround: new THREE.Color(0x4a4035),
    hemiIntensity: 0.55,
    ambient: new THREE.Color(0xb89870),
    ambientIntensity: 0.14,
    fillColor: new THREE.Color(0x90a8c0),
    fillIntensity: 0.28,
    bounceColor: new THREE.Color(0xd0a070),
    bounceIntensity: 0.18,
    fog: new THREE.Color(0xc4a888),
    fogDensity: 0.0075,
    bg: new THREE.Color(0xc8b090),
    exposure: 1.08,
    warmth: 0.07,
    vignette: 0.22,
    grain: 0.018,
    bloom: 0.08,
    dustColor: new THREE.Color(0xffe0b0),
    dustOpacity: 0.24,
    lampIntensity: 0,
    lampEmissive: 0.15,
    windowEmissiveScale: 0.35,
    flareOpacity: 0.85,
    sunElev: 0.38, // 0..1 height factor
  };

  const NIGHT = {
    sunColor: new THREE.Color(0xa0b8e0), // moonlight cast
    sunIntensity: 0.22,
    hemiSky: new THREE.Color(0x1a2848),
    hemiGround: new THREE.Color(0x0a0c10),
    hemiIntensity: 0.22,
    ambient: new THREE.Color(0x304060),
    ambientIntensity: 0.08,
    fillColor: new THREE.Color(0x4060a0),
    fillIntensity: 0.12,
    bounceColor: new THREE.Color(0x203040),
    bounceIntensity: 0.04,
    fog: new THREE.Color(0x0c1018),
    fogDensity: 0.011,
    bg: new THREE.Color(0x060810),
    exposure: 0.92,
    warmth: -0.04,
    vignette: 0.32,
    grain: 0.028,
    bloom: 0.14,
    dustColor: new THREE.Color(0x8899bb),
    dustOpacity: 0.1,
    lampIntensity: 1.15,
    lampEmissive: 1.4,
    windowEmissiveScale: 1.0,
    flareOpacity: 0.15,
    sunElev: 0.55, // moon height
  };

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function lerpColor(out, a, b, t) {
    out.r = lerp(a.r, b.r, t);
    out.g = lerp(a.g, b.g, t);
    out.b = lerp(a.b, b.b, t);
    return out;
  }

  function createSkyDome() {
    const uniforms = {
      uNight: { value: 0 },
      uSunDir: { value: new THREE.Vector3(-0.6, 0.35, 0.4).normalize() },
    };
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms,
      vertexShader: [
        "varying vec3 vWorld;",
        "void main(){",
        "  vec4 wp = modelMatrix * vec4(position,1.0);",
        "  vWorld = normalize(wp.xyz);",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform float uNight;",
        "uniform vec3 uSunDir;",
        "varying vec3 vWorld;",
        "float hash(vec3 p){",
        "  p = fract(p * 0.3183099 + vec3(0.1,0.2,0.3));",
        "  p *= 17.0;",
        "  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));",
        "}",
        "void main(){",
        "  vec3 d = normalize(vWorld);",
        "  float h = d.y * 0.5 + 0.5; // 0 horizon-ish bottom, 1 zenith",
        "  // --- DAY sky ---",
        "  vec3 dayZenith = vec3(0.22, 0.40, 0.72);",
        "  vec3 dayMid    = vec3(0.55, 0.68, 0.82);",
        "  vec3 dayHaze   = vec3(0.90, 0.72, 0.48);",
        "  vec3 dayGround = vec3(0.72, 0.52, 0.32);",
        "  vec3 dayCol = mix(dayGround, dayHaze, smoothstep(0.0, 0.42, h));",
        "  dayCol = mix(dayCol, dayMid, smoothstep(0.35, 0.7, h));",
        "  dayCol = mix(dayCol, dayZenith, smoothstep(0.55, 1.0, h));",
        "  // sun disc + glow",
        "  float sunDot = max(dot(d, normalize(uSunDir)), 0.0);",
        "  float sunDisc = smoothstep(0.9992, 0.9998, sunDot);",
        "  float sunGlow = pow(sunDot, 32.0) * 0.55 + pow(sunDot, 8.0) * 0.15;",
        "  dayCol += vec3(1.0, 0.85, 0.45) * sunGlow * (1.0 - uNight);",
        "  dayCol += vec3(1.0, 0.95, 0.8) * sunDisc * 1.4 * (1.0 - uNight);",
        "  // soft clouds (day only)",
        "  float cloud = 0.0;",
        "  vec2 cu = d.xz / max(d.y + 0.15, 0.05);",
        "  cloud += smoothstep(0.55, 0.75, hash(vec3(cu * 2.1, 1.0)));",
        "  cloud += 0.5 * smoothstep(0.6, 0.8, hash(vec3(cu * 4.3 + 2.0, 2.0)));",
        "  cloud *= smoothstep(0.05, 0.35, d.y) * (1.0 - uNight) * 0.22;",
        "  dayCol = mix(dayCol, vec3(1.0, 0.96, 0.9), cloud);",
        "  // --- NIGHT sky ---",
        "  vec3 nightZenith = vec3(0.02, 0.04, 0.10);",
        "  vec3 nightMid    = vec3(0.04, 0.07, 0.16);",
        "  vec3 nightHaze   = vec3(0.10, 0.12, 0.20);",
        "  vec3 nightCol = mix(nightHaze, nightMid, smoothstep(0.0, 0.5, h));",
        "  nightCol = mix(nightCol, nightZenith, smoothstep(0.4, 1.0, h));",
        "  // city light dome glow on horizon",
        "  float cityGlow = exp(-max(d.y, 0.0) * 6.0) * 0.35;",
        "  nightCol += vec3(0.35, 0.22, 0.08) * cityGlow;",
        "  // stars",
        "  float stars = 0.0;",
        "  if (d.y > 0.05) {",
        "    vec3 sp = d * 180.0;",
        "    float s = hash(floor(sp));",
        "    stars = smoothstep(0.97, 0.995, s) * smoothstep(0.05, 0.3, d.y);",
        "    // twinkle-ish via secondary hash",
        "    stars *= 0.55 + 0.45 * hash(floor(sp * 1.7));",
        "  }",
        "  nightCol += vec3(0.85, 0.9, 1.0) * stars;",
        "  // moon disc (opposite-ish sun dir inverted)",
        "  vec3 moonDir = normalize(vec3(-uSunDir.x * 0.3, abs(uSunDir.y) + 0.2, -uSunDir.z));",
        "  float moonDot = max(dot(d, moonDir), 0.0);",
        "  float moonDisc = smoothstep(0.9985, 0.9995, moonDot);",
        "  float moonGlow = pow(moonDot, 48.0) * 0.35;",
        "  nightCol += vec3(0.75, 0.82, 1.0) * moonGlow;",
        "  nightCol += vec3(0.9, 0.92, 1.0) * moonDisc;",
        "  // blend",
        "  vec3 col = mix(dayCol, nightCol, uNight);",
        "  gl_FragColor = vec4(col, 1.0);",
        "}",
      ].join("\n"),
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(320, 64, 32), mat);
    mesh.name = "jimpthySkyDome";
    mesh.frustumCulled = false;
    mesh.renderOrder = -1000;
    return { mesh, uniforms, mat };
  }

  function create(scene, opts) {
    opts = opts || {};
    const state = {
      scene,
      mode: "day", // day | night
      blend: 0, // 0 day → 1 night (smoothed)
      target: 0,
      speed: 1.6,
      lamps: [],
      windows: [],
      post: null,
      playerX: 0,
      playerZ: 0,
    };

    // Lights
    const sun = new THREE.DirectionalLight(DAY.sunColor, DAY.sunIntensity);
    sun.name = "jimothySun";
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 180;
    sun.shadow.camera.left = -55;
    sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 55;
    sun.shadow.camera.bottom = -55;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.028;
    sun.shadow.radius = 2.5;
    sun.position.set(-58, 22, 32);
    scene.add(sun);
    scene.add(sun.target);

    const hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemiIntensity);
    hemi.name = "jimothyHemi";
    scene.add(hemi);

    const ambient = new THREE.AmbientLight(DAY.ambient, DAY.ambientIntensity);
    ambient.name = "jimothyAmbient";
    scene.add(ambient);

    const fill = new THREE.DirectionalLight(DAY.fillColor, DAY.fillIntensity);
    fill.name = "jimothyFill";
    fill.position.set(45, 18, -25);
    scene.add(fill);

    const bounce = new THREE.DirectionalLight(DAY.bounceColor, DAY.bounceIntensity);
    bounce.name = "jimothyBounce";
    bounce.position.set(10, 3, 20);
    scene.add(bounce);

    // Moon key (low, cool) — ramps up at night; sun dims
    const moon = new THREE.DirectionalLight(0xc0d0f0, 0);
    moon.name = "jimothyMoon";
    moon.position.set(40, 50, -30);
    moon.castShadow = false;
    scene.add(moon);

    // Sky dome
    const sky = createSkyDome();
    scene.add(sky.mesh);

    // Sun flare sprite
    const fc = document.createElement("canvas");
    fc.width = 256;
    fc.height = 256;
    const fg = fc.getContext("2d");
    const fgrd = fg.createRadialGradient(128, 128, 4, 128, 128, 128);
    fgrd.addColorStop(0, "rgba(255,250,230,1)");
    fgrd.addColorStop(0.15, "rgba(255,210,120,0.65)");
    fgrd.addColorStop(0.4, "rgba(255,170,70,0.15)");
    fgrd.addColorStop(1, "rgba(255,130,30,0)");
    fg.fillStyle = fgrd;
    fg.fillRect(0, 0, 256, 256);
    const flare = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(fc),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: DAY.flareOpacity,
      })
    );
    flare.scale.set(48, 48, 1);
    flare.position.set(-70, 40, 20);
    flare.name = "jimothyFlare";
    scene.add(flare);

    // Atmospheric dust / night particles
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 160;
      pos[i * 3 + 1] = Math.random() * 16;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 160;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: DAY.dustColor,
      size: 0.05,
      transparent: true,
      opacity: DAY.dustOpacity,
      depthWrite: false,
    });
    const dust = new THREE.Points(geo, dustMat);
    dust.name = "jimothyDust";
    scene.add(dust);

    scene.fog = new THREE.FogExp2(DAY.fog.getHex(), DAY.fogDensity);
    scene.background = DAY.bg.clone();

    state.sun = sun;
    state.moon = moon;
    state.hemi = hemi;
    state.ambient = ambient;
    state.fill = fill;
    state.bounce = bounce;
    state.sky = sky;
    state.flare = flare;
    state.dust = dust;
    state.dustMat = dustMat;
    state._tmpC = new THREE.Color();

    function applyLighting(t) {
      // t = 0 day, 1 night
      const sunI = lerp(DAY.sunIntensity, 0.05, t);
      const moonI = lerp(0, 0.55, t);

      sun.intensity = sunI;
      lerpColor(state._tmpC, DAY.sunColor, new THREE.Color(0x6080b0), Math.min(1, t * 1.4));
      sun.color.copy(state._tmpC);

      moon.intensity = moonI;

      hemi.intensity = lerp(DAY.hemiIntensity, NIGHT.hemiIntensity, t);
      lerpColor(hemi.color, DAY.hemiSky, NIGHT.hemiSky, t);
      lerpColor(hemi.groundColor, DAY.hemiGround, NIGHT.hemiGround, t);

      ambient.intensity = lerp(DAY.ambientIntensity, NIGHT.ambientIntensity, t);
      lerpColor(ambient.color, DAY.ambient, NIGHT.ambient, t);

      fill.intensity = lerp(DAY.fillIntensity, NIGHT.fillIntensity, t);
      lerpColor(fill.color, DAY.fillColor, NIGHT.fillColor, t);

      bounce.intensity = lerp(DAY.bounceIntensity, NIGHT.bounceIntensity, t);
      lerpColor(bounce.color, DAY.bounceColor, NIGHT.bounceColor, t);

      // Fog
      if (scene.fog) {
        lerpColor(scene.fog.color, DAY.fog, NIGHT.fog, t);
        scene.fog.density = lerp(DAY.fogDensity, NIGHT.fogDensity, t);
      }
      lerpColor(scene.background, DAY.bg, NIGHT.bg, t);

      // Sky shader
      sky.uniforms.uNight.value = t;

      // Sun direction for sky + light position
      const elev = lerp(DAY.sunElev, 0.15, t); // sun sinks as night comes
      const az = -0.75;
      const sunDir = new THREE.Vector3(
        Math.sin(az) * Math.cos(elev * Math.PI * 0.5),
        Math.sin(elev * Math.PI * 0.45) + 0.05,
        Math.cos(az) * Math.cos(elev * Math.PI * 0.5)
      ).normalize();
      sky.uniforms.uSunDir.value.copy(sunDir);

      // Place sun light from direction (relative to player when updated)
      const dist = 70;
      sun.position.set(
        state.playerX - sunDir.x * dist,
        Math.max(8, sunDir.y * dist),
        state.playerZ - sunDir.z * dist
      );
      sun.target.position.set(state.playerX, 0, state.playerZ);
      if (sun.target.updateMatrixWorld) sun.target.updateMatrixWorld();

      moon.position.set(
        state.playerX + 40,
        55,
        state.playerZ - 30
      );

      flare.position.copy(sun.position).multiplyScalar(0.9);
      flare.material.opacity = lerp(DAY.flareOpacity, NIGHT.flareOpacity, t);
      flare.visible = t < 0.85;

      dustMat.color.lerpColors(DAY.dustColor, NIGHT.dustColor, t);
      dustMat.opacity = lerp(DAY.dustOpacity, NIGHT.dustOpacity, t);

      // Street lamps
      const lampI = lerp(DAY.lampIntensity, NIGHT.lampIntensity, t);
      const lampE = lerp(DAY.lampEmissive, NIGHT.lampEmissive, t);
      for (let i = 0; i < state.lamps.length; i++) {
        const L = state.lamps[i];
        if (L.light) {
          L.light.intensity = lampI * (L.power != null ? L.power : 1);
          L.light.visible = lampI > 0.05;
        }
        if (L.bulbMat) {
          L.bulbMat.emissiveIntensity = lampE;
          if (L.bulbMat.color) {
            L.bulbMat.color.set(t > 0.3 ? 0xffe8b0 : 0x887860);
          }
        }
      }

      // Window glow
      const wScale = lerp(DAY.windowEmissiveScale, NIGHT.windowEmissiveScale, t);
      for (let i = 0; i < state.windows.length; i++) {
        const W = state.windows[i];
        if (!W.mat) continue;
        const base = W.baseEi != null ? W.baseEi : 0.12;
        W.mat.emissiveIntensity = base * (0.4 + wScale * 1.8);
        // lit rooms brighter at night
        if (W.lit) {
          W.mat.emissiveIntensity = base * (0.5 + wScale * 3.2);
        }
      }

      // Post FX grade
      if (state.post && state.post.uniforms) {
        const u = state.post.uniforms;
        if (u.uExposure) u.uExposure.value = lerp(DAY.exposure, NIGHT.exposure, t);
        if (u.uWarmth) u.uWarmth.value = lerp(DAY.warmth, NIGHT.warmth, t);
        if (u.uVignette) u.uVignette.value = lerp(DAY.vignette, NIGHT.vignette, t);
        if (u.uGrain) u.uGrain.value = lerp(DAY.grain, NIGHT.grain, t);
        if (u.uBloom) u.uBloom.value = lerp(DAY.bloom, NIGHT.bloom, t);
      }
    }

    function setMode(mode) {
      state.mode = mode === "night" ? "night" : "day";
      state.target = state.mode === "night" ? 1 : 0;
    }

    function toggle() {
      setMode(state.mode === "night" ? "day" : "night");
      return state.mode;
    }

    function isNight() {
      return state.mode === "night";
    }

    function bindLamps(list) {
      state.lamps = list || [];
    }

    function bindWindows(list) {
      state.windows = list || [];
    }

    function setPost(post) {
      state.post = post;
    }

    function registerLamp(entry) {
      state.lamps.push(entry);
    }

    function registerWindow(entry) {
      state.windows.push(entry);
    }

    function update(dt, px, pz) {
      if (px != null) state.playerX = px;
      if (pz != null) state.playerZ = pz;

      // Smooth blend toward target
      const k = 1 - Math.exp(-(dt || 0.016) * state.speed);
      state.blend = lerp(state.blend, state.target, k);
      // Snap close enough
      if (Math.abs(state.blend - state.target) < 0.001) state.blend = state.target;

      applyLighting(state.blend);

      // Shadow frustum follows player
      if (sun.shadow && sun.shadow.camera) {
        const sc = sun.shadow.camera;
        const r = 42;
        sc.left = -r;
        sc.right = r;
        sc.top = r;
        sc.bottom = -r;
        sc.updateProjectionMatrix();
      }

      // Dust drift
      dust.rotation.y += (dt || 0) * 0.02;
    }

    // Initial apply
    applyLighting(0);

    return {
      sun,
      moon,
      hemi,
      ambient,
      fill,
      bounce,
      dust,
      flare,
      sky: sky.mesh,
      setMode,
      toggle,
      isNight,
      getMode: () => state.mode,
      getBlend: () => state.blend,
      bindLamps,
      bindWindows,
      registerLamp,
      registerWindow,
      setPost,
      update,
      // legacy helpers
      updateSunShadows: function (px, pz) {
        state.playerX = px;
        state.playerZ = pz;
        update(0, px, pz);
      },
    };
  }

  global.JIMPTHY_SKY = {
    create,
    DAY,
    NIGHT,
  };
})(window);
