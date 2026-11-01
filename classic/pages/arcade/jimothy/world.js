/**
 * TRUE 3D block — GTA-style geometry.
 * Reference image = art direction only (palette, vibe). NO photo billboards.
 */
(function (global) {
  "use strict";

  // —— Procedural materials (look like the ref, not the photo itself) ——
  const Tex = {
    canvas(w, h, fn) {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      fn(c.getContext("2d"), w, h);
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = 8;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
      return t;
    },
    brick() {
      const t = this.canvas(512, 512, (g, w, h) => {
        g.fillStyle = "#6a6058";
        g.fillRect(0, 0, w, h);
        const bw = 60,
          bh = 28;
        for (let row = 0; row < h / bh + 2; row++) {
          const off = (row % 2) * (bw * 0.5);
          for (let col = -1; col < w / bw + 2; col++) {
            const x = col * bw + off;
            const y = row * bh;
            const n = (row * 19 + col * 37) % 45;
            g.fillStyle = `rgb(${135 + n},${92 + (n % 18)},${68 + (n % 12)})`;
            g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
            g.fillStyle = `rgba(40,28,18,${0.06 + (n % 8) / 100})`;
            g.fillRect(x + 5, y + 5, bw - 12, bh - 12);
            g.strokeStyle = "rgba(210,180,150,0.12)";
            g.strokeRect(x + 2, y + 2, bw - 4, bh - 4);
          }
        }
      });
      t.repeat.set(2.2, 2.2);
      return t;
    },
    plaster() {
      const t = this.canvas(512, 512, (g, w, h) => {
        g.fillStyle = "#b5a48c";
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 5000; i++) {
          const n = Math.random();
          g.fillStyle = `rgba(${100 + n * 60},${90 + n * 50},${70 + n * 40},${0.04 + n * 0.05})`;
          g.fillRect(Math.random() * w, Math.random() * h, 3, 2);
        }
      });
      t.repeat.set(1.5, 1.5);
      return t;
    },
    asphalt() {
      const t = this.canvas(512, 512, (g, w, h) => {
        g.fillStyle = "#58544c";
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 12000; i++) {
          const v = 65 + Math.random() * 55;
          g.fillStyle = `rgba(${v},${v - 3},${v - 8},0.25)`;
          g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
        }
        for (let i = 0; i < 20; i++) {
          g.fillStyle = `rgba(35,32,28,${0.08 + Math.random() * 0.1})`;
          g.beginPath();
          g.ellipse(Math.random() * w, Math.random() * h, 30 + Math.random() * 60, 15 + Math.random() * 30, 0, 0, Math.PI * 2);
          g.fill();
        }
      });
      t.repeat.set(2, 6);
      return t;
    },
    /** Weathered green paint — same grain language as asphalt/plaster */
    carPaint(seed) {
      seed = seed || 0;
      const t = this.canvas(512, 512, (g, w, h) => {
        // base green matching ref muscle car
        g.fillStyle = seed ? "#248a34" : "#2d9a3c";
        g.fillRect(0, 0, w, h);
        // micro grain (same style as asphalt grit)
        for (let i = 0; i < 14000; i++) {
          const v = Math.random();
          const dark = v > 0.55;
          g.fillStyle = dark
            ? `rgba(20,50,25,${0.08 + Math.random() * 0.12})`
            : `rgba(180,220,160,${0.04 + Math.random() * 0.08})`;
          g.fillRect(Math.random() * w, Math.random() * h, 1 + (Math.random() > 0.9 ? 2 : 0), 1);
        }
        // dirt / dust patches (street-worn, like building plaster dirt)
        for (let i = 0; i < 18; i++) {
          g.fillStyle = `rgba(90,75,50,${0.06 + Math.random() * 0.1})`;
          g.beginPath();
          g.ellipse(
            Math.random() * w,
            Math.random() * h,
            20 + Math.random() * 50,
            12 + Math.random() * 30,
            Math.random(),
            0,
            Math.PI * 2
          );
          g.fill();
        }
        // faint rust freckles near edges
        for (let i = 0; i < 40; i++) {
          g.fillStyle = `rgba(120,70,40,${0.1 + Math.random() * 0.15})`;
          g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
      });
      t.repeat.set(2, 2);
      return t;
    },
    /** Dull chrome / steel — fits block materials, not shiny plastic */
    metalWorn() {
      const t = this.canvas(256, 256, (g, w, h) => {
        const grd = g.createLinearGradient(0, 0, w, h);
        grd.addColorStop(0, "#9aa2aa");
        grd.addColorStop(0.5, "#6a727a");
        grd.addColorStop(1, "#4a5258");
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 80; i++) {
          g.strokeStyle = `rgba(220,230,240,${0.04 + Math.random() * 0.06})`;
          g.beginPath();
          g.moveTo(0, Math.random() * h);
          g.lineTo(w, Math.random() * h);
          g.stroke();
        }
        for (let i = 0; i < 200; i++) {
          g.fillStyle = `rgba(30,30,30,${Math.random() * 0.12})`;
          g.fillRect(Math.random() * w, Math.random() * h, 2, 1);
        }
      });
      t.repeat.set(1, 1);
      return t;
    },
    rubber() {
      const t = this.canvas(256, 256, (g, w, h) => {
        g.fillStyle = "#1a1a1a";
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) {
          g.strokeStyle = `rgba(40,40,40,0.5)`;
          g.beginPath();
          g.arc(w / 2, h / 2, 20 + i * 3, 0, Math.PI * 2);
          g.stroke();
        }
        for (let i = 0; i < 3000; i++) {
          g.fillStyle = `rgba(${20 + Math.random() * 30},${20 + Math.random() * 30},${20 + Math.random() * 30},0.3)`;
          g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
        }
      });
      return t;
    },
  };

  function M(opts) {
    opts = opts || {};
    const o = {
      color: opts.color != null ? opts.color : 0xffffff,
      roughness: opts.rough != null ? opts.rough : 0.85,
      metalness: opts.metal != null ? opts.metal : 0.05,
      flatShading: false,
    };
    if (opts.map) o.map = opts.map;
    if (opts.emissive != null) {
      o.emissive = opts.emissive;
      o.emissiveIntensity = opts.emissiveIntensity != null ? opts.emissiveIntensity : 0.1;
    }
    return new THREE.MeshStandardMaterial(o);
  }

  function setupSky(scene) {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const g = c.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, "#4a6a98");
    grd.addColorStop(0.4, "#8a9ab0");
    grd.addColorStop(0.55, "#d0b888");
    grd.addColorStop(0.72, "#e0c090");
    grd.addColorStop(1, "#b88858");
    g.fillStyle = grd;
    g.fillRect(0, 0, 4, 256);
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(110, 32, 16),
      new THREE.MeshBasicMaterial({
        map: (() => {
          const t = new THREE.CanvasTexture(c);
          t.encoding = THREE.sRGBEncoding;
          return t;
        })(),
        side: THREE.BackSide,
      })
    );
    scene.add(sky);
    return sky;
  }

  /**
   * Fixed sun in world space. Player moves → shadow maps update relative to sun.
   * Call updateSunShadows(playerX, playerZ) each frame so the shadow camera
   * stays centered on the player (sun direction stays fixed).
   */
  function setupLights(scene) {
    // Key sun — FIXED world direction (golden hour from NW)
    const sun = new THREE.DirectionalLight(0xffe2b0, 2.05);
    sun.name = "jimothySun";
    sun.position.set(-40, 32, 28); // fixed sky position
    sun.target.position.set(0, 0, 14); // aim at block center
    scene.add(sun);
    scene.add(sun.target);

    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    // Ortho volume around player (updated each frame)
    const s = 22;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 1.5;

    // Soft sky only — no second moving key light
    scene.add(new THREE.HemisphereLight(0xb0c4e0, 0x6a5840, 0.5));
    scene.add(new THREE.AmbientLight(0xa88868, 0.26));
    // Fixed cool fill (no shadows) opposite side
    const fill = new THREE.DirectionalLight(0x90a8c8, 0.22);
    fill.position.set(25, 12, -18);
    fill.castShadow = false;
    scene.add(fill);

    return sun;
  }

  /** Keep shadow frustum on player; sun direction never changes */
  function updateSunShadows(sun, playerX, playerZ) {
    if (!sun) return;
    // Shadow camera looks along fixed sun ray, centered on player
    const dir = new THREE.Vector3(-40, 32, 28).normalize();
    const dist = 55;
    sun.position.set(
      playerX + dir.x * dist,
      dir.y * dist,
      playerZ + dir.z * dist
    );
    sun.target.position.set(playerX, 0, playerZ);
    sun.target.updateMatrixWorld();
    sun.shadow.camera.updateProjectionMatrix();
  }

  // —— Muscle car: denser mesh + same procedural texture language as the street ——
  function createMuscleCar(variant) {
    variant = variant || 0;
    const car = new THREE.Group();
    car.name = "muscleCar";

    const paintMap = Tex.carPaint(variant);
    const metalMap = Tex.metalWorn();
    const rubberMap = Tex.rubber();

    // Same material stack as buildings/road: MeshStandard + procedural maps
    const paint = M({ map: paintMap, rough: 0.42, metal: 0.35 });
    const paintDark = M({
      map: paintMap,
      color: 0xb0b0b0,
      rough: 0.5,
      metal: 0.3,
    });
    const chrome = M({ map: metalMap, rough: 0.28, metal: 0.85 });
    const glass = M({ color: 0x1a2835, rough: 0.12, metal: 0.45 });
    const rubber = M({ map: rubberMap, rough: 0.95, metal: 0.02 });
    const steel = M({ map: metalMap, color: 0xaaaaaa, rough: 0.45, metal: 0.7 });
    const blackTrim = M({ color: 0x1c1c1c, rough: 0.75, metal: 0.08 });
    const redLens = M({
      color: 0x8a1520,
      rough: 0.4,
      metal: 0.15,
      emissive: 0x300810,
      emissiveIntensity: 0.2,
    });

    function add(mesh, cast, recv) {
      mesh.castShadow = cast !== false;
      mesh.receiveShadow = recv !== false;
      car.add(mesh);
      return mesh;
    }

    // —— Body volumes (more broken-up = reads more realistic under fixed sun) ——
    add(new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.48, 4.35), paint)).position.set(0, 0.62, 0.05);

    // Sill / rocker panels
    add(new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.2), paintDark)).position.set(0, 0.34, 0);

    // Wheel-arch blisters (side volume)
    [-1, 1].forEach((s) => {
      const archF = add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, 0.85), paint));
      archF.position.set(s * 0.98, 0.55, 1.25);
      const archR = add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, 0.85), paint));
      archR.position.set(s * 0.98, 0.55, -1.3);
    });

    // Hood (longer, slightly higher)
    add(new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.14, 1.6), paint)).position.set(0, 0.92, 1.25);
    // Center scoop
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.75), paintDark)).position.set(0, 1.02, 1.2);
    // Hood seams (thin dark lines as boxes)
    [-0.45, 0.45].forEach((x) => {
      const seam = add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 1.4), blackTrim), false, true);
      seam.position.set(x, 1.0, 1.25);
    });

    // A-pillars + cabin glass
    add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 1.55), glass)).position.set(0, 1.18, -0.12);
    // Roof skin
    add(new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.07, 1.45), paintDark)).position.set(0, 1.48, -0.18);
    // C-pillar fastback wedges
    [-1, 1].forEach((s) => {
      const pillar = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.7), paint));
      pillar.position.set(s * 0.82, 1.2, -0.75);
      pillar.rotation.x = 0.15;
    });

    // Trunk deck
    add(new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.26, 1.0), paint)).position.set(0, 0.88, -1.55);
    // Rear lip spoiler tiny
    add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.18), paintDark)).position.set(0, 1.05, -2.0);

    // Front valance + bumper
    add(new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.22, 0.35), paintDark)).position.set(0, 0.4, 2.15);
    add(new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.14, 0.22), chrome)).position.set(0, 0.36, 2.32);
    // Grill stack
    add(new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.32, 0.1), blackTrim)).position.set(0, 0.62, 2.28);
    for (let i = 0; i < 5; i++) {
      const bar = add(new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.025, 0.04), chrome), false, true);
      bar.position.set(0, 0.5 + i * 0.06, 2.34);
    }
    // Headlight housings
    [-0.65, 0.65].forEach((x) => {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.12), chrome)).position.set(x, 0.62, 2.3);
      const lens = add(
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 0.06, 14),
          M({ color: 0xe8eef5, rough: 0.2, metal: 0.25, emissive: 0x667788, emissiveIntensity: 0.15 })
        ),
        false,
        true
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(x, 0.62, 2.36);
    });

    // Rear bumper + lights
    add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.14, 0.2), chrome)).position.set(0, 0.35, -2.28);
    [-0.58, 0.58].forEach((x) => {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.08), redLens)).position.set(x, 0.78, -2.2);
    });
    // Plate
    add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.03), M({ color: 0xd8d0c0, rough: 0.7 })), false, true).position.set(
      0,
      0.48,
      -2.32
    );
    // Exhaust tips
    [-0.45, 0.45].forEach((x) => {
      const exh = add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.28, 10), steel));
      exh.rotation.x = Math.PI / 2;
      exh.position.set(x, 0.22, -2.42);
    });

    // Side chrome spear
    [-1, 1].forEach((s) => {
      const strip = add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, 3.6), chrome), false, true);
      strip.position.set(s * 1.01, 0.58, 0.05);
    });

    // Door cut lines
    [-1, 1].forEach((s) => {
      const door = add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 1.1), blackTrim), false, true);
      door.position.set(s * 1.0, 0.7, 0.15);
    });

    // Mirrors
    [-1, 1].forEach((s) => {
      const arm = add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.14), blackTrim));
      arm.position.set(s * 0.95, 1.08, 0.55);
      const glassM = add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.04), chrome), false, true);
      glassM.position.set(s * 1.05, 1.1, 0.55);
    });

    // Wheels — fuller tire + rim with same metal/rubber maps
    function wheel(x, z) {
      const grp = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 20), rubber);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      tire.receiveShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.32, 14), steel);
      rim.rotation.z = Math.PI / 2;
      rim.castShadow = true;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.34, 10), chrome);
      hub.rotation.z = Math.PI / 2;
      // lug nuts
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const lug = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), chrome);
        lug.position.set(Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.16);
        hub.add(lug);
      }
      grp.add(tire, rim, hub);
      grp.position.set(x, 0.38, z);
      car.add(grp);
    }
    wheel(-0.95, 1.38);
    wheel(0.95, 1.38);
    wheel(-0.95, -1.42);
    wheel(0.95, -1.42);

    // Under-shadow mesh (helps read contact with street)
    const contact = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 4.6),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.02;
    car.add(contact);

    return car;
  }

  function buildBlock(scene) {
    const root = new THREE.Group();
    root.name = "gta-block";
    const colliders = [];
    function col(minX, maxX, minZ, maxZ) {
      colliders.push({ minX, maxX, minZ, maxZ });
    }

    const brickMap = Tex.brick();
    const plasterMap = Tex.plaster();
    const asphaltMap = Tex.asphalt();

    // Ground plane (large) for depth
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      M({ color: 0x6a6048, rough: 1, metal: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    root.add(ground);

    // Road — thick enough to read as volume with curbs
    const roadW = 11;
    const roadL = 32;
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(roadW, 0.12, roadL),
      M({ map: asphaltMap, rough: 0.95, metal: 0 })
    );
    road.position.set(0, 0.05, roadL / 2 - 2);
    road.receiveShadow = true;
    road.castShadow = true;
    root.add(road);

    // Yellow center dashes (3D boxes so they cast/receive light)
    for (let z = 2; z < roadL - 2; z += 3) {
      const dash = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.03, 1.4),
        M({ color: 0xd4b028, rough: 0.65, metal: 0.05 })
      );
      dash.position.set(0, 0.13, z);
      root.add(dash);
    }

    // Sidewalks as raised slabs
    [-1, 1].forEach((side) => {
      const sw = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.18, roadL),
        M({ color: 0x8a8680, rough: 0.9, metal: 0 })
      );
      sw.position.set(side * (roadW / 2 + 1.35), 0.1, roadL / 2 - 2);
      sw.receiveShadow = true;
      sw.castShadow = true;
      root.add(sw);
      // curb face
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.22, roadL),
        M({ color: 0x787470, rough: 0.88 })
      );
      curb.position.set(side * (roadW / 2 + 0.05), 0.12, roadL / 2 - 2);
      curb.castShadow = true;
      root.add(curb);
    });

    // —— Buildings with real depth ——
    function building(x, z, w, d, floors, opts) {
      opts = opts || {};
      const fh = 3.1;
      const h = floors * fh;
      const g = new THREE.Group();
      const bodyMat = M({
        map: opts.plaster ? plasterMap : brickMap,
        rough: 0.9,
        metal: 0.02,
      });

      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
      body.position.y = h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      // Parapet / roof ledge (depth cue)
      const ledge = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.35, 0.35, d + 0.35),
        M({ color: 0x4a4035, rough: 0.92 })
      );
      ledge.position.y = h + 0.1;
      ledge.castShadow = true;
      g.add(ledge);
      // Roof slab inset
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w - 0.2, 0.15, d - 0.2),
        M({ color: 0x3a3830, rough: 0.95 })
      );
      roof.position.y = h + 0.28;
      g.add(roof);

      // Recessed windows (inset = reads as 3D)
      const cols = Math.max(2, Math.floor(w / 2.0));
      for (let f = 0; f < floors; f++) {
        for (let c = 0; c < cols; c++) {
          const wx = -w / 2 + 1.05 + c * ((w - 2.1) / Math.max(1, cols - 1));
          const wy = fh * 0.55 + f * fh;
          // hole frame (outer)
          const frame = new THREE.Mesh(
            new THREE.BoxGeometry(1.05, 1.35, 0.2),
            M({ color: 0x3a3832, rough: 0.85 })
          );
          frame.position.set(wx, wy, d / 2 - 0.05);
          // glass inset
          const win = new THREE.Mesh(
            new THREE.BoxGeometry(0.85, 1.15, 0.08),
            M({
              color: 0x1a2835,
              rough: 0.15,
              metal: 0.4,
              emissive: 0x0a1008,
              emissiveIntensity: 0.15,
            })
          );
          win.position.set(wx, wy, d / 2 + 0.02);
          g.add(frame, win);
        }
      }

      // Ground metal shutter (volume)
      if (opts.shutter) {
        const shut = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.7, 2.4, 0.25),
          M({ color: 0x5a626c, rough: 0.4, metal: 0.55 })
        );
        shut.position.set(0, 1.2, d / 2 + 0.05);
        shut.castShadow = true;
        g.add(shut);
        for (let i = 0; i < 10; i++) {
          const rib = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.7, 0.05, 0.08),
            M({ color: 0x3a424c, rough: 0.45, metal: 0.5 })
          );
          rib.position.set(0, 0.25 + i * 0.22, d / 2 + 0.18);
          g.add(rib);
        }
      }

      // Fire escape — full 3D scaffold
      if (opts.escape) {
        const rail = M({ color: 0x3a444e, rough: 0.4, metal: 0.65 });
        for (let f = 0; f < floors; f++) {
          const plat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.0), rail);
          plat.position.set(w / 2 + 0.65, fh * (f + 0.9), 0.15);
          plat.castShadow = true;
          g.add(plat);
          // railing posts
          for (let p = 0; p < 4; p++) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.05), rail);
            post.position.set(w / 2 + 0.2 + p * 0.4, fh * (f + 0.9) + 0.3, 0.6);
            g.add(post);
          }
          const railBar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.05), rail);
          railBar.position.set(w / 2 + 0.65, fh * (f + 0.9) + 0.55, 0.6);
          g.add(railBar);
          // ladder
          const lad = new THREE.Mesh(new THREE.BoxGeometry(0.4, fh * 0.75, 0.08), rail);
          lad.position.set(w / 2 + 1.1, fh * (f + 0.45), 0.4);
          g.add(lad);
        }
      }

      // Graffiti as thin extruded color blobs (still geometry-ish planes on surface)
      if (opts.graffiti !== false) {
        const colors = [0xe83d9a, 0x40d0e8, 0xf0e040, 0x50e060, 0xffffff];
        for (let i = 0; i < 5; i++) {
          const tag = new THREE.Mesh(
            new THREE.BoxGeometry(0.8 + Math.random() * 1.2, 0.5 + Math.random() * 0.6, 0.04),
            M({ color: colors[(opts.seed + i) % 5], rough: 0.95 })
          );
          tag.position.set(
            -w * 0.25 + i * 0.55,
            1.2 + (i % 3) * 0.7,
            d / 2 + 0.14
          );
          g.add(tag);
        }
      }

      // AC unit on roof for silhouette
      if (floors >= 2) {
        const ac = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.7, 0.9),
          M({ color: 0x6a7078, rough: 0.5, metal: 0.4 })
        );
        ac.position.set(w * 0.2, h + 0.7, 0);
        ac.castShadow = true;
        g.add(ac);
      }

      g.position.set(x, 0, z);
      root.add(g);
      col(x - w / 2 - 0.15, x + w / 2 + 0.15, z - d / 2 - 0.15, z + d / 2 + 0.15);
      return g;
    }

    // 1–2 block corner
    building(-9.2, 9, 7.5, 8.5, 2, { seed: 1, escape: true });
    building(-9.2, 19, 7.2, 7.5, 2, { seed: 2, plaster: true, shutter: true });
    building(9.2, 12, 7.5, 9, 2, { seed: 3, escape: true, shutter: true });
    building(9.2, 23, 6.8, 7.5, 3, { seed: 4, plaster: true });
    building(-2.5, 29, 5.5, 5.5, 2, { seed: 5, plaster: true, graffiti: false });
    building(4, 29.5, 5.5, 5.5, 2, { seed: 6 });

    // Utility poles (3D)
    function pole(x, z) {
      const p = new THREE.Group();
      const wood = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.15, 9, 10),
        M({ color: 0x3a3020, rough: 0.95 })
      );
      wood.position.y = 4.5;
      wood.castShadow = true;
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.12, 0.14),
        M({ color: 0x2a2820, rough: 0.9 })
      );
      arm.position.y = 8.3;
      arm.castShadow = true;
      // transformer
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.55, 0.35),
        M({ color: 0x4a5040, rough: 0.6, metal: 0.3 })
      );
      box.position.set(0.3, 7.6, 0);
      p.add(wood, arm, box);
      p.position.set(x, 0, z);
      root.add(p);
    }
    pole(-5.9, 6);
    pole(-5.9, 17);
    pole(5.9, 11);
    pole(5.9, 22);

    // Wire between poles (tube curves)
    function wire(ax, ay, az, bx, by, bz) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(ax, ay, az),
        new THREE.Vector3((ax + bx) / 2, Math.min(ay, by) - 1.1, (az + bz) / 2),
        new THREE.Vector3(bx, by, bz),
      ]);
      const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 16, 0.025, 5, false),
        M({ color: 0x1a1a18, rough: 0.7, metal: 0.4 })
      );
      root.add(mesh);
    }
    wire(-5.9, 8.3, 6, -5.9, 8.3, 17);
    wire(5.9, 8.3, 11, 5.9, 8.3, 22);

    // —— CARS (true 3D meshes, same texture language as street) ——
    const car1 = createMuscleCar(0);
    car1.position.set(2.6, 0, 14.5);
    car1.rotation.y = -0.25;
    root.add(car1);
    col(0.4, 4.8, 12.2, 16.8);

    const car2 = createMuscleCar(1);
    car2.position.set(-2.4, 0, 21);
    car2.rotation.y = Math.PI + 0.3;
    root.add(car2);
    col(-4.6, -0.2, 18.7, 23.3);

    // Dumpsters 3D
    function dumpster(x, z) {
      const d = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1.15, 1.2),
        M({ color: 0x3a5c48, rough: 0.7, metal: 0.2 })
      );
      body.position.y = 0.58;
      body.castShadow = true;
      body.receiveShadow = true;
      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.1, 1.25),
        M({ color: 0x2a4030, rough: 0.65, metal: 0.25 })
      );
      lid.position.set(0, 1.2, 0.05);
      lid.rotation.x = -0.15;
      lid.castShadow = true;
      const wheelL = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.1, 10),
        M({ color: 0x1a1a1a, rough: 0.9 })
      );
      wheelL.rotation.z = Math.PI / 2;
      wheelL.position.set(-0.55, 0.12, 0.45);
      d.add(body, lid, wheelL);
      d.position.set(x, 0, z);
      root.add(d);
      col(x - 0.9, x + 0.9, z - 0.75, z + 0.75);
    }
    dumpster(-5.0, 11);
    dumpster(5.1, 18);

    // Bollards
    function bollard(x, z) {
      const b = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.16, 0.7, 12),
        M({ color: 0x4a6080, rough: 0.45, metal: 0.5 })
      );
      b.position.set(x, 0.35, z);
      b.castShadow = true;
      root.add(b);
    }
    bollard(-5.3, 7.5);
    bollard(5.3, 12.5);

    // Tire on side
    const tire = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.13, 12, 20),
      M({ color: 0x141414, rough: 0.92 })
    );
    tire.position.set(4.8, 0.38, 10);
    tire.rotation.y = 0.4;
    tire.castShadow = true;
    root.add(tire);

    // Litter (small 3D scraps)
    const LCOLS = [0xc8b090, 0x3a5040, 0xe8c040, 0x806060, 0x90a0b0, 0xe080a0];
    for (let i = 0; i < 50; i++) {
      const m = new THREE.Mesh(
        Math.random() > 0.5
          ? new THREE.BoxGeometry(0.15 + Math.random() * 0.2, 0.04, 0.12 + Math.random() * 0.12)
          : new THREE.SphereGeometry(0.07 + Math.random() * 0.06, 6, 5),
        M({ color: LCOLS[i % LCOLS.length], rough: 0.95 })
      );
      m.position.set((Math.random() - 0.5) * 8.5, 0.12, 3 + Math.random() * 24);
      m.rotation.set(Math.random(), Math.random() * 4, Math.random());
      m.castShadow = true;
      root.add(m);
    }

    // Pennants on string (simple boxes)
    const FC = [0xe04060, 0x40c070, 0xf0d040, 0x4080e0];
    for (let i = 0; i < 8; i++) {
      const f = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.45, 0.28),
        M({ color: FC[i % 4], rough: 0.85 })
      );
      f.position.set(-5.7, 6.5, 7 + i * 1.15);
      f.rotation.z = 0.2;
      f.castShadow = true;
      root.add(f);
    }

    // Distant low buildings for depth (far block)
    for (let i = 0; i < 4; i++) {
      const far = new THREE.Mesh(
        new THREE.BoxGeometry(4 + Math.random() * 2, 4 + Math.random() * 3, 4),
        M({ map: i % 2 ? plasterMap : brickMap, rough: 0.92 })
      );
      far.position.set(-12 + i * 8, far.geometry.parameters.height / 2, 38 + Math.random() * 4);
      far.castShadow = true;
      far.receiveShadow = true;
      root.add(far);
    }

    scene.add(root);
    return { root, colliders, roadL, roadW };
  }

  global.JIMOTHY_WORLD = {
    buildBlock,
    setupSky,
    setupLights,
    updateSunShadows,
    createMuscleCar,
  };
})(window);
