/**
 * JIMPTHY open world — multi-block urban neighborhood.
 * GTA-style streets, golden-hour light, green muscle cars.
 * Reference image = art direction ONLY (no photo billboards).
 */
(function (global) {
  "use strict";

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
          }
        }
      });
      t.repeat.set(2, 2);
      return t;
    },
    plaster() {
      const t = this.canvas(256, 256, (g, w, h) => {
        g.fillStyle = "#b5a48c";
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 3000; i++) {
          const n = Math.random();
          g.fillStyle = `rgba(${100 + n * 60},${90 + n * 50},${70 + n * 40},0.08)`;
          g.fillRect(Math.random() * w, Math.random() * h, 3, 2);
        }
      });
      t.repeat.set(2, 2);
      return t;
    },
    asphalt() {
      const t = this.canvas(512, 512, (g, w, h) => {
        g.fillStyle = "#555148";
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 14000; i++) {
          const v = 60 + Math.random() * 50;
          g.fillStyle = `rgba(${v},${v - 3},${v - 8},0.22)`;
          g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
        }
        for (let i = 0; i < 25; i++) {
          g.fillStyle = `rgba(30,28,24,${0.08 + Math.random() * 0.1})`;
          g.beginPath();
          g.ellipse(Math.random() * w, Math.random() * h, 40, 20, 0, 0, Math.PI * 2);
          g.fill();
        }
      });
      t.repeat.set(3, 3);
      return t;
    },
    carPaint(seed) {
      const t = this.canvas(256, 256, (g, w, h) => {
        g.fillStyle = seed ? "#248a34" : "#2d9a3c";
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 8000; i++) {
          g.fillStyle =
            Math.random() > 0.5
              ? `rgba(20,50,25,${0.08 + Math.random() * 0.1})`
              : `rgba(180,220,160,${0.05 + Math.random() * 0.06})`;
          g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
        }
        for (let i = 0; i < 12; i++) {
          g.fillStyle = `rgba(90,75,50,${0.08 + Math.random() * 0.08})`;
          g.beginPath();
          g.ellipse(Math.random() * w, Math.random() * h, 30, 18, 0, 0, Math.PI * 2);
          g.fill();
        }
      });
      t.repeat.set(2, 2);
      return t;
    },
    metalWorn() {
      const t = this.canvas(128, 128, (g, w, h) => {
        g.fillStyle = "#7a8288";
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) {
          g.strokeStyle = `rgba(200,210,220,0.06)`;
          g.beginPath();
          g.moveTo(0, Math.random() * h);
          g.lineTo(w, Math.random() * h);
          g.stroke();
        }
      });
      return t;
    },
    rubber() {
      const t = this.canvas(128, 128, (g, w, h) => {
        g.fillStyle = "#1a1a1a";
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 20; i++) {
          g.strokeStyle = "rgba(40,40,40,0.5)";
          g.beginPath();
          g.arc(w / 2, h / 2, 10 + i * 3, 0, Math.PI * 2);
          g.stroke();
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
    c.width = 8;
    c.height = 512;
    const g = c.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0.0, "#3a5a88");
    grd.addColorStop(0.3, "#7a90b0");
    grd.addColorStop(0.5, "#c8a878");
    grd.addColorStop(0.62, "#e8b868");
    grd.addColorStop(0.78, "#f0c878");
    grd.addColorStop(1.0, "#a86840");
    g.fillStyle = grd;
    g.fillRect(0, 0, 8, 512);
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(200, 48, 24),
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

  function setupLights(scene) {
    // Low golden-hour sun — long shadows, fixed direction
    const sun = new THREE.DirectionalLight(0xffd090, 2.4);
    sun.name = "jimothySun";
    sun.position.set(-55, 20, 40);
    sun.target.position.set(0, 0, 0);
    scene.add(sun);
    scene.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 160;
    const s = 40;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 2;

    scene.add(new THREE.HemisphereLight(0xffe0b0, 0x5a4838, 0.52));
    scene.add(new THREE.AmbientLight(0xb88858, 0.2));
    const fill = new THREE.DirectionalLight(0x88a0c0, 0.16);
    fill.position.set(35, 12, -25);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffc878, 0.32);
    rim.position.set(-25, 10, 15);
    scene.add(rim);
    return sun;
  }

  function updateSunShadows(sun, px, pz) {
    if (!sun) return;
    const dir = new THREE.Vector3(-55, 20, 40).normalize();
    const dist = 70;
    sun.position.set(px + dir.x * dist, dir.y * dist, pz + dir.z * dist);
    sun.target.position.set(px, 0, pz);
    sun.target.updateMatrixWorld();
    sun.shadow.camera.updateProjectionMatrix();
  }

  function createAtmosphere(scene) {
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 120;
      pos[i * 3 + 1] = Math.random() * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xffe0b0,
        size: 0.08,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      })
    );
    scene.add(dust);

    const flareC = document.createElement("canvas");
    flareC.width = 128;
    flareC.height = 128;
    const fg = flareC.getContext("2d");
    const grd = fg.createRadialGradient(64, 64, 2, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,245,210,1)");
    grd.addColorStop(0.15, "rgba(255,200,100,0.5)");
    grd.addColorStop(0.45, "rgba(255,160,60,0.12)");
    grd.addColorStop(1, "rgba(255,140,40,0)");
    fg.fillStyle = grd;
    fg.fillRect(0, 0, 128, 128);
    const flare = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(flareC),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.9,
      })
    );
    flare.scale.set(22, 22, 1);
    flare.position.set(-60, 28, 45);
    scene.add(flare);
    return { dust, flare };
  }

  function createMuscleCar(variant) {
    const car = new THREE.Group();
    const paintMap = Tex.carPaint(variant || 0);
    const metalMap = Tex.metalWorn();
    const rubberMap = Tex.rubber();
    const paint = M({ map: paintMap, rough: 0.4, metal: 0.35 });
    const paintDark = M({ map: paintMap, color: 0xb0b0b0, rough: 0.48, metal: 0.3 });
    const chrome = M({ map: metalMap, rough: 0.28, metal: 0.85 });
    const glass = M({ color: 0x1a2835, rough: 0.12, metal: 0.4 });
    const rubber = M({ map: rubberMap, rough: 0.95 });
    const steel = M({ map: metalMap, color: 0xaaaaaa, rough: 0.45, metal: 0.7 });
    const blackTrim = M({ color: 0x1c1c1c, rough: 0.75 });
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

    add(new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.48, 4.35), paint)).position.set(0, 0.62, 0.05);
    add(new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.2), paintDark)).position.set(0, 0.34, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.14, 1.6), paint)).position.set(0, 0.92, 1.25);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.75), paintDark)).position.set(0, 1.02, 1.2);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 1.55), glass)).position.set(0, 1.18, -0.12);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.07, 1.45), paintDark)).position.set(0, 1.48, -0.18);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.26, 1.0), paint)).position.set(0, 0.88, -1.55);
    add(new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.14, 0.22), chrome)).position.set(0, 0.36, 2.32);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.32, 0.1), blackTrim)).position.set(0, 0.62, 2.28);
    add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.14, 0.2), chrome)).position.set(0, 0.35, -2.28);
    [-0.58, 0.58].forEach((x) => {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.08), redLens)).position.set(x, 0.78, -2.2);
    });
    [-0.65, 0.65].forEach((x) => {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.12), chrome)).position.set(x, 0.62, 2.3);
    });

    function wheel(x, z) {
      const grp = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 16), rubber);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.32, 12), steel);
      rim.rotation.z = Math.PI / 2;
      grp.add(tire, rim);
      grp.position.set(x, 0.38, z);
      car.add(grp);
    }
    wheel(-0.95, 1.38);
    wheel(0.95, 1.38);
    wheel(-0.95, -1.42);
    wheel(0.95, -1.42);

    const contact = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 4.6),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.02;
    car.add(contact);
    return car;
  }

  /**
   * Multi-block open neighborhood (~3x3 lots).
   * Prefers the detailed JIMPTHY_CITY builder when available.
   */
  function buildBlock(scene) {
    if (global.JIMPTHY_CITY && typeof global.JIMPTHY_CITY.buildCity === "function") {
      const city = global.JIMPTHY_CITY.buildCity(scene);
      return {
        root: city.root,
        colliders: city.colliders || [],
        bounds: city.bounds != null ? city.bounds : 60,
        spawn: city.spawn || { x: 0, z: 0 },
        mapSize: city.mapSize || 120,
        nightLamps: city.nightLamps || [],
        nightWindows: city.nightWindows || [],
        atmosphere: null,
      };
    }

    // Fallback: simple ground if city.js missing
    const root = new THREE.Group();
    root.name = "open-world-fallback";
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      M({ color: 0x555048, rough: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    root.add(ground);
    scene.add(root);
    return { root, colliders: [], bounds: 50, spawn: { x: 0, z: 0 } };
  }

  global.JIMOTHY_WORLD = {
    buildBlock,
    setupSky,
    setupLights,
    updateSunShadows,
    createMuscleCar,
  };
  // Alias used by main.js
  global.JIMPTHY_WORLD = global.JIMOTHY_WORLD;
})(window);
