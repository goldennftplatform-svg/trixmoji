/**
 * CITY ONLY â€” dense architecture pass.
 * No raccoon, no cars, no balls/cubes/collectibles.
 * Focus: cracked asphalt, barrier, brick facades, fire escapes,
 * poles/wires, lamps, golden-hour haze.
 */
(function (global) {
  "use strict";

  // Shared env map for glass / metal reflections (set from main after renderer ready)
  let _envMap = null;
  function setEnvMap(env) {
    _envMap = env;
  }

  function M(o) {
    o = o || {};
    const mat = new THREE.MeshStandardMaterial({
      color: o.color != null ? o.color : 0xffffff,
      roughness: o.rough != null ? o.rough : 0.85,
      metalness: o.metal != null ? o.metal : 0.05,
      emissive: o.emissive || 0x000000,
      emissiveIntensity: o.ei != null ? o.ei : 0,
      flatShading: !!o.flat,
      envMapIntensity: o.env != null ? o.env : 0.35,
    });
    if (o.map) mat.map = o.map;
    if (o.normalMap) {
      mat.normalMap = o.normalMap;
      mat.normalScale = new THREE.Vector2(
        o.normalScale != null ? o.normalScale : 0.6,
        o.normalScale != null ? o.normalScale : 0.6
      );
    }
    if (o.bumpMap) {
      mat.bumpMap = o.bumpMap;
      mat.bumpScale = o.bumpScale != null ? o.bumpScale : 0.04;
    }
    if (o.roughMap) mat.roughnessMap = o.roughMap;
    if (o.aoMap) {
      mat.aoMap = o.aoMap;
      mat.aoMapIntensity = o.ao != null ? o.ao : 0.85;
    }
    if (_envMap && o.env !== 0) {
      mat.envMap = _envMap;
    }
    if (o.transparent) mat.transparent = true;
    if (o.opacity != null) mat.opacity = o.opacity;
    return mat;
  }

  /** Glass panes — Physical when available for clearer reflections */
  function glassMat(opts) {
    opts = opts || {};
    const base = {
      color: opts.color != null ? opts.color : 0x1a3040,
      roughness: opts.rough != null ? opts.rough : 0.12,
      metalness: opts.metal != null ? opts.metal : 0.55,
      emissive: opts.emissive || 0x0a1410,
      emissiveIntensity: opts.ei != null ? opts.ei : 0.12,
      envMapIntensity: 1.1,
      transparent: true,
      opacity: opts.opacity != null ? opts.opacity : 0.92,
    };
    let mat;
    if (THREE.MeshPhysicalMaterial) {
      mat = new THREE.MeshPhysicalMaterial(
        Object.assign({}, base, {
          clearcoat: 0.45,
          clearcoatRoughness: 0.25,
          reflectivity: 0.6,
          transmission: 0.08,
        })
      );
    } else {
      mat = new THREE.MeshStandardMaterial(base);
    }
    if (_envMap) mat.envMap = _envMap;
    return mat;
  }

  function texCanvas(w, h, draw, opts) {
    opts = opts || {};
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = opts.linear ? THREE.LinearEncoding : THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 16;
    t.needsUpdate = true;
    if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
    return t;
  }

  /** Derive a rough greyscale normal-ish bump from an albedo canvas texture */
  function makeRoughFromAlbedo(albedoTex, amount) {
    amount = amount || 1;
    const img = albedoTex.image;
    if (!img || !img.width) return null;
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) | 0;
      // invert slightly so dark cracks = rougher
      const r = Math.max(0, Math.min(255, 40 + (255 - lum) * 0.55 * amount));
      d[i] = d[i + 1] = d[i + 2] = r;
    }
    g.putImageData(data, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.LinearEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.repeat.copy(albedoTex.repeat);
    t.needsUpdate = true;
    return t;
  }

  /** Fake normal map from height-ish greyscale (central differences) */
  function makeNormalFromAlbedo(albedoTex, strength) {
    strength = strength != null ? strength : 1.8;
    const img = albedoTex.image;
    if (!img || !img.width) return null;
    const w = img.width;
    const h = img.height;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const src = g.getImageData(0, 0, w, h).data;
    const out = g.createImageData(w, h);
    const lum = (x, y) => {
      const i = ((y + h) % h) * w + ((x + w) % w);
      const o = i * 4;
      return (src[o] + src[o + 1] + src[o + 2]) / 3 / 255;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (lum(x + 1, y) - lum(x - 1, y)) * strength;
        const dy = (lum(x, y + 1) - lum(x, y - 1)) * strength;
        const nx = -dx;
        const ny = -dy;
        const nz = 1;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        const i = (y * w + x) * 4;
        out.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
        out.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
        out.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
        out.data[i + 3] = 255;
      }
    }
    g.putImageData(out, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.LinearEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.repeat.copy(albedoTex.repeat);
    t.needsUpdate = true;
    return t;
  }

  /** High-detail cracked asphalt */
  function asphaltTex() {
    return texCanvas(
      1024,
      1024,
      (g, w, h) => {
        // base grey-brown
        g.fillStyle = "#3f3d37";
        g.fillRect(0, 0, w, h);

        // grit (noise via imageData for speed)
        const img = g.getImageData(0, 0, w, h);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const n = (Math.random() - 0.5) * 36;
          d[i] = Math.max(0, Math.min(255, d[i] + n));
          d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n - 2));
          d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n - 6));
        }
        g.putImageData(img, 0, 0);

        // large worn patches
        for (let i = 0; i < 40; i++) {
          const v = 50 + Math.random() * 30;
          g.fillStyle = `rgba(${v},${v - 3},${v - 10},0.22)`;
          g.beginPath();
          g.ellipse(
            Math.random() * w,
            Math.random() * h,
            40 + Math.random() * 120,
            20 + Math.random() * 80,
            Math.random() * Math.PI,
            0,
            Math.PI * 2
          );
          g.fill();
        }

        // deep cracks â€” multi-branch
        for (let i = 0; i < 90; i++) {
          g.strokeStyle = `rgba(12,10,8,${0.45 + Math.random() * 0.4})`;
          g.lineWidth = 1 + Math.random() * 2.5;
          g.lineCap = "round";
          g.beginPath();
          let x = Math.random() * w;
          let y = Math.random() * h;
          g.moveTo(x, y);
          for (let j = 0; j < 10 + Math.floor(Math.random() * 8); j++) {
            x += (Math.random() - 0.5) * 100;
            y += (Math.random() - 0.35) * 70;
            g.lineTo(x, y);
          }
          g.stroke();
          // side branches
          if (Math.random() > 0.5) {
            g.beginPath();
            g.moveTo(x - 40, y - 20);
            g.lineTo(x + 30, y + 50);
            g.stroke();
          }
        }

        // hairline cracks
        g.lineWidth = 0.6;
        for (let i = 0; i < 120; i++) {
          g.strokeStyle = `rgba(20,18,14,${0.2 + Math.random() * 0.25})`;
          g.beginPath();
          let x = Math.random() * w;
          let y = Math.random() * h;
          g.moveTo(x, y);
          for (let j = 0; j < 5; j++) {
            x += (Math.random() - 0.5) * 40;
            y += (Math.random() - 0.3) * 30;
            g.lineTo(x, y);
          }
          g.stroke();
        }

        // oil / wet stains
        for (let i = 0; i < 28; i++) {
          g.fillStyle = `rgba(18,20,16,${0.1 + Math.random() * 0.18})`;
          g.beginPath();
          g.ellipse(
            Math.random() * w,
            Math.random() * h,
            20 + Math.random() * 70,
            10 + Math.random() * 35,
            Math.random(),
            0,
            Math.PI * 2
          );
          g.fill();
        }

        // faded yellow ghost paint
        g.fillStyle = "rgba(200,175,90,0.07)";
        for (let y = 0; y < h; y += 110) g.fillRect(w / 2 - 10, y, 20, 48);

        // pothole pits
        for (let i = 0; i < 12; i++) {
          const cx = Math.random() * w;
          const cy = Math.random() * h;
          const r = 15 + Math.random() * 35;
          const grd = g.createRadialGradient(cx, cy, 2, cx, cy, r);
          grd.addColorStop(0, "rgba(25,22,18,0.55)");
          grd.addColorStop(0.6, "rgba(40,38,32,0.25)");
          grd.addColorStop(1, "rgba(50,48,42,0)");
          g.fillStyle = grd;
          g.beginPath();
          g.ellipse(cx, cy, r, r * 0.7, Math.random(), 0, Math.PI * 2);
          g.fill();
        }
      },
      { repeat: [1.2, 12] }
    );
  }

  function asphaltBump() {
    return texCanvas(1024, 1024, (g, w, h) => {
      g.fillStyle = "#808080";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40000; i++) {
        const v = 100 + Math.random() * 55;
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
      }
      g.strokeStyle = "#404040";
      g.lineWidth = 2;
      for (let i = 0; i < 50; i++) {
        g.beginPath();
        let x = Math.random() * w,
          y = Math.random() * h;
        g.moveTo(x, y);
        for (let j = 0; j < 8; j++) {
          x += (Math.random() - 0.5) * 80;
          y += (Math.random() - 0.3) * 50;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    });
  }

  function concreteTex() {
    return texCanvas(
      1024,
      1024,
      (g, w, h) => {
        g.fillStyle = "#8a8780";
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 35000; i++) {
          const v = 90 + Math.random() * 60;
          g.fillStyle = `rgba(${v},${v - 1},${v - 6},0.2)`;
          g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
        // formwork joints
        g.strokeStyle = "rgba(55,52,45,0.28)";
        g.lineWidth = 3;
        for (let y = 0; y < h; y += 96) {
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(w, y);
          g.stroke();
        }
        for (let x = 0; x < w; x += 160) {
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x, h);
          g.stroke();
        }
        // bolt holes along form lines
        for (let y = 48; y < h; y += 96) {
          for (let x = 40; x < w; x += 80) {
            g.fillStyle = "rgba(40,38,34,0.35)";
            g.beginPath();
            g.arc(x, y, 3, 0, Math.PI * 2);
            g.fill();
          }
        }
        // water stains / rust streaks
        for (let i = 0; i < 18; i++) {
          const x = Math.random() * w;
          const grd = g.createLinearGradient(x, 0, x, h);
          grd.addColorStop(0, "rgba(90,70,50,0.18)");
          grd.addColorStop(1, "rgba(70,75,70,0)");
          g.fillStyle = grd;
          g.fillRect(x - 12, Math.random() * h * 0.3, 24 + Math.random() * 20, h * 0.7);
        }
        // dark spalling patches
        for (let i = 0; i < 15; i++) {
          g.fillStyle = `rgba(60,58,52,${0.1 + Math.random() * 0.15})`;
          g.beginPath();
          g.ellipse(Math.random() * w, Math.random() * h, 30, 50, 0, 0, Math.PI * 2);
          g.fill();
        }
      },
      { repeat: [1.5, 2.5] }
    );
  }

  function brickTex(seed) {
    seed = seed || 0;
    return texCanvas(
      1024,
      1024,
      (g, w, h) => {
        // mortar base
        g.fillStyle = "#6a645c";
        g.fillRect(0, 0, w, h);
        const bw = 58,
          bh = 26;
        for (let row = 0; row < h / bh + 3; row++) {
          const off = (row % 2) * (bw / 2);
          for (let col = -1; col < w / bw + 3; col++) {
            const n = (row * 19 + col * 37 + seed * 11) % 55;
            // varied brick colors â€” red/brown/orange
            const r = 105 + n + (seed % 20);
            const gg = 62 + (n % 22);
            const b = 48 + (n % 16);
            g.fillStyle = `rgb(${r},${gg},${b})`;
            const x = col * bw + off + 2;
            const y = row * bh + 2;
            g.fillRect(x, y, bw - 4, bh - 4);
            // brick face variation
            g.fillStyle = `rgba(30,20,15,${0.04 + (n % 10) / 120})`;
            g.fillRect(x + 3, y + 3, bw - 10, bh - 10);
            // edge highlight
            g.fillStyle = "rgba(255,220,180,0.06)";
            g.fillRect(x, y, bw - 4, 2);
            // dark bottom edge
            g.fillStyle = "rgba(20,10,5,0.12)";
            g.fillRect(x, y + bh - 6, bw - 4, 2);
          }
        }
        // vertical water streaks
        for (let i = 0; i < 14; i++) {
          const x = Math.random() * w;
          const grd = g.createLinearGradient(x, 0, x, h);
          grd.addColorStop(0, "rgba(40,35,30,0.2)");
          grd.addColorStop(1, "rgba(40,35,30,0)");
          g.fillStyle = grd;
          g.fillRect(x, 0, 4 + Math.random() * 8, h);
        }
      },
      { repeat: [2.8, 4] }
    );
  }

  function sidewalkTex() {
    return texCanvas(
      512,
      512,
      (g, w, h) => {
        g.fillStyle = "#6e6c64";
        g.fillRect(0, 0, w, h);
        const tile = 64;
        for (let y = 0; y < h; y += tile) {
          for (let x = 0; x < w; x += tile) {
            const n = ((x / tile + y / tile) * 7) % 11;
            g.fillStyle = `rgb(${108 + n * 2},${105 + n},${98 + n})`;
            g.fillRect(x + 1, y + 1, tile - 2, tile - 2);
            // grit
            for (let i = 0; i < 40; i++) {
              const v = 90 + Math.random() * 40;
              g.fillStyle = `rgba(${v},${v},${v - 5},0.15)`;
              g.fillRect(x + Math.random() * tile, y + Math.random() * tile, 1, 1);
            }
            g.strokeStyle = "rgba(35,32,28,0.45)";
            g.lineWidth = 1.5;
            g.strokeRect(x + 0.5, y + 0.5, tile - 1, tile - 1);
            // corner chips
            if (n % 3 === 0) {
              g.fillStyle = "rgba(50,48,42,0.3)";
              g.fillRect(x + 2, y + 2, 6, 6);
            }
          }
        }
      },
      { repeat: [2.2, 14] }
    );
  }

  /** Soft spray-paint graffiti texture (not flat colored boxes) */
  function graffitiTex() {
    return texCanvas(512, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const cols = ["#e040a0", "#40d0e0", "#f0e040", "#ffffff", "#50e060", "#ff6030", "#c060ff"];
      // fill some tags as abstract shapes
      for (let t = 0; t < 8; t++) {
        g.globalAlpha = 0.75 + Math.random() * 0.2;
        g.fillStyle = cols[t % cols.length];
        g.strokeStyle = cols[(t + 2) % cols.length];
        g.lineWidth = 4 + Math.random() * 6;
        g.beginPath();
        let x = 20 + Math.random() * (w - 80);
        let y = 30 + Math.random() * (h - 60);
        g.moveTo(x, y);
        for (let i = 0; i < 6; i++) {
          x += 15 + Math.random() * 40;
          y += (Math.random() - 0.5) * 50;
          g.lineTo(x, Math.max(10, Math.min(h - 10, y)));
        }
        g.stroke();
        // bubble letter blobs
        g.beginPath();
        g.ellipse(
          40 + t * 55 + Math.random() * 20,
          h / 2 + (Math.random() - 0.5) * 40,
          18 + Math.random() * 22,
          22 + Math.random() * 20,
          Math.random(),
          0,
          Math.PI * 2
        );
        g.fill();
      }
      // drip
      g.globalAlpha = 0.5;
      for (let i = 0; i < 20; i++) {
        g.fillStyle = cols[i % cols.length];
        const x = Math.random() * w;
        g.fillRect(x, 80 + Math.random() * 60, 2 + Math.random() * 3, 20 + Math.random() * 50);
      }
    });
  }

  function metalMat(color) {
    return M({ color: color || 0x4a5058, rough: 0.38, metal: 0.72, env: 0.85 });
  }

  function woodMat() {
    return M({ color: 0x4a3a28, rough: 0.92, metal: 0.02 });
  }

  /** Detailed multi-floor building with ledges, mullions, pipes, AC */
  function addBuilding(root, x, z, w, d, floors, opts) {
    opts = opts || {};
    const fh = 3.2;
    const h = floors * fh;
    const g = new THREE.Group();
    const bodyMat = M({
      map: opts.brick ? opts.brickMap : opts.concreteMap,
      normalMap: opts.brick
        ? opts.brickNormal || null
        : opts.concreteNormal || null,
      normalScale: opts.brick ? 0.7 : 0.5,
      roughMap: opts.brick ? opts.brickRough || null : opts.concreteRough || null,
      rough: opts.brick ? 0.88 : 0.91,
      metal: 0.02,
      env: 0.18,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
    // AO uv2 = uv for standard material aoMap if present
    if (body.geometry.attributes.uv && !body.geometry.attributes.uv2) {
      body.geometry.setAttribute("uv2", body.geometry.attributes.uv);
    }
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    // Floor ledges / belt courses
    for (let f = 1; f <= floors; f++) {
      const ledge = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.18, 0.14, d + 0.18),
        M({ color: 0x5a554c, rough: 0.88 })
      );
      ledge.position.y = f * fh;
      ledge.castShadow = true;
      g.add(ledge);
    }

    // Cornice
    const cornice = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.5, 0.4, d + 0.5),
      M({ color: 0x4a453c, rough: 0.88 })
    );
    cornice.position.y = h + 0.15;
    cornice.castShadow = true;
    g.add(cornice);
    // second cornice ring
    const corn2 = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.25, 0.2, d + 0.25),
      M({ color: 0x3a3830, rough: 0.9 })
    );
    corn2.position.y = h + 0.45;
    g.add(corn2);

    // Roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.25, 0.18, d - 0.25),
      M({ color: 0x323028, rough: 0.95 })
    );
    roof.position.y = h + 0.55;
    g.add(roof);

    // Parapet walls
    const parapetH = 0.7;
    [
      [0, d / 2 - 0.1, w, 0.18],
      [0, -d / 2 + 0.1, w, 0.18],
      [w / 2 - 0.1, 0, 0.18, d],
      [-w / 2 + 0.1, 0, 0.18, d],
    ].forEach((p) => {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(p[2], parapetH, p[3]),
        M({ color: 0x4a4840, rough: 0.9 })
      );
      wall.position.set(p[0], h + 0.9, p[1]);
      wall.castShadow = true;
      g.add(wall);
    });

    // AC units + chimneys on roof
    for (let i = 0; i < 1 + (floors > 2 ? 1 : 0); i++) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 1.2), metalMat(0x6a7078));
      ac.position.set(-w * 0.22 + i * 2.0, h + 1.05, -d * 0.12);
      ac.castShadow = true;
      g.add(ac);
      // vents
      for (let v = 0; v < 3; v++) {
        const vent = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 0.08, 0.9),
          metalMat(0x3a4048)
        );
        vent.position.set(-w * 0.22 + i * 2.0 - 0.4 + v * 0.4, h + 1.5, -d * 0.12);
        g.add(vent);
      }
    }
    if (floors >= 3) {
      const chim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.38, 2.4, 10),
        M({ color: 0x5a5048, rough: 0.9 })
      );
      chim.position.set(w * 0.22, h + 1.75, d * 0.18);
      chim.castShadow = true;
      g.add(chim);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 0.12, 10),
        M({ color: 0x3a3830, rough: 0.85 })
      );
      cap.position.set(w * 0.22, h + 3.0, d * 0.18);
      g.add(cap);
    }

    // Windows with frames, glass, mullions, sills
    const faces = [
      { nx: 0, nz: 1, ox: 0, oz: d / 2 },
      { nx: 0, nz: -1, ox: 0, oz: -d / 2 },
      { nx: 1, nz: 0, ox: w / 2, oz: 0 },
      { nx: -1, nz: 0, ox: -w / 2, oz: 0 },
    ];
    faces.forEach((face, fi) => {
      if (opts.skipFace === fi) return;
      const across = face.nx === 0 ? w : d;
      const cols = Math.max(2, Math.floor(across / 1.85));
      for (let f = 0; f < floors; f++) {
        if (f === 0 && opts.shutter && (fi === 0 || fi === 2)) continue;
        for (let c = 0; c < cols; c++) {
          const t = -across / 2 + 1.0 + c * ((across - 2.0) / Math.max(1, cols - 1));
          const wy = fh * 0.52 + f * fh;
          const lit = (f + c + opts.seed) % 5 !== 0;

          let px = face.ox;
          let pz = face.oz;
          if (face.nx === 0) {
            px = t;
            pz = face.oz + face.nz * 0.04;
          } else {
            pz = t;
            px = face.ox + face.nx * 0.04;
          }

          // recessed frame
          const frame = new THREE.Mesh(
            new THREE.BoxGeometry(
              face.nx === 0 ? 1.15 : 0.16,
              1.45,
              face.nx === 0 ? 0.16 : 1.15
            ),
            M({ color: 0x2a2824, rough: 0.85 })
          );
          frame.position.set(px, wy, pz);
          g.add(frame);

          // glass pane — reflective physical material
          const baseEi = lit ? 0.18 + (f % 2) * 0.07 : 0.04;
          const winMat = glassMat({
            color: lit ? 0x243848 : 0x0a1018,
            rough: lit ? 0.1 : 0.35,
            metal: 0.45,
            emissive: lit ? 0xffc878 : 0x040608,
            ei: baseEi,
            opacity: lit ? 0.88 : 0.95,
          });
          if (opts.nightWindows) {
            opts.nightWindows.push({ mat: winMat, baseEi: baseEi, lit: !!lit });
          }
          const win = new THREE.Mesh(
            new THREE.BoxGeometry(
              face.nx === 0 ? 0.95 : 0.08,
              1.25,
              face.nx === 0 ? 0.08 : 0.95
            ),
            winMat
          );
          win.position.set(
            face.nx === 0 ? px : px + face.nx * 0.07,
            wy,
            face.nx === 0 ? pz + face.nz * 0.07 : pz
          );
          g.add(win);

          // mullion cross
          const mullV = new THREE.Mesh(
            new THREE.BoxGeometry(
              face.nx === 0 ? 0.06 : 0.1,
              1.2,
              face.nx === 0 ? 0.1 : 0.06
            ),
            M({ color: 0x1e1c18, rough: 0.7 })
          );
          mullV.position.copy(win.position);
          mullV.position.y = wy;
          g.add(mullV);
          const mullH = new THREE.Mesh(
            new THREE.BoxGeometry(
              face.nx === 0 ? 0.9 : 0.1,
              0.06,
              face.nx === 0 ? 0.1 : 0.9
            ),
            M({ color: 0x1e1c18, rough: 0.7 })
          );
          mullH.position.copy(win.position);
          g.add(mullH);

          // sill
          const sill = new THREE.Mesh(
            new THREE.BoxGeometry(
              face.nx === 0 ? 1.2 : 0.22,
              0.1,
              face.nx === 0 ? 0.28 : 1.2
            ),
            M({ color: 0x4a453c, rough: 0.9 })
          );
          sill.position.set(
            px,
            wy - 0.75,
            pz + (face.nz || 0) * 0.1 + (face.nx || 0) * 0.1
          );
          g.add(sill);

          // lintel
          const lintel = new THREE.Mesh(
            new THREE.BoxGeometry(
              face.nx === 0 ? 1.25 : 0.2,
              0.12,
              face.nx === 0 ? 0.22 : 1.25
            ),
            M({ color: 0x3a3830, rough: 0.88 })
          );
          lintel.position.set(px, wy + 0.78, pz + (face.nz || 0) * 0.06);
          g.add(lintel);

          // facade AC unit on some windows
          if (fi === 0 && f > 0 && c % 3 === 1) {
            const fac = new THREE.Mesh(
              new THREE.BoxGeometry(0.7, 0.45, 0.55),
              metalMat(0x8a9098)
            );
            fac.position.set(px, wy - 0.15, d / 2 + 0.4);
            fac.castShadow = true;
            g.add(fac);
          }
        }
      }
    });

    // Metal roll-down shutter
    if (opts.shutter) {
      const shut = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.72, 2.55, 0.22),
        metalMat(0x5a626c)
      );
      shut.position.set(0, 1.28, d / 2 + 0.1);
      shut.castShadow = true;
      g.add(shut);
      for (let i = 0; i < 14; i++) {
        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.72, 0.06, 0.05),
          metalMat(0x3a424c)
        );
        rib.position.set(0, 0.25 + i * 0.18, d / 2 + 0.22);
        g.add(rib);
      }
      // shutter housing box above
      const house = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.76, 0.4, 0.4),
        metalMat(0x4a5058)
      );
      house.position.set(0, 2.7, d / 2 + 0.2);
      g.add(house);
    }

    // Fire escape â€” on street-facing side (flipEscape puts it on +X of building)
    if (opts.escape) {
      const rail = metalMat(0x3a444e);
      const s = opts.flipEscape ? 1 : -1;
      const ex = s * (w / 2 + 0.7);
      for (let f = 0; f < floors; f++) {
        const y = fh * (f + 0.82);
        const plat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 1.15), rail);
        plat.position.set(ex, y, 0.15);
        plat.castShadow = true;
        g.add(plat);
        for (let k = 0; k < 6; k++) {
          const gr = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.02, 0.035), rail);
          gr.position.set(ex, y + 0.04, -0.4 + k * 0.2);
          g.add(gr);
        }
        for (let p = 0; p < 5; p++) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), rail);
          post.position.set(ex - s * (0.55 - p * 0.32), y + 0.32, 0.68);
          g.add(post);
        }
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.04, 0.04), rail);
        topRail.position.set(ex, y + 0.6, 0.68);
        g.add(topRail);
        const midRail = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.03, 0.03), rail);
        midRail.position.set(ex, y + 0.32, 0.68);
        g.add(midRail);
        if (f < floors - 1) {
          for (let side = -1; side <= 1; side += 2) {
            const sideRail = new THREE.Mesh(
              new THREE.BoxGeometry(0.04, fh * 0.75, 0.04),
              rail
            );
            sideRail.position.set(ex + s * 0.45 + side * 0.18, y + fh * 0.4, 0.35);
            g.add(sideRail);
          }
          for (let r = 0; r < 6; r++) {
            const rung = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.035, 0.035), rail);
            rung.position.set(ex + s * 0.45, y + 0.25 + r * 0.32, 0.4);
            g.add(rung);
          }
        }
      }
      const drop = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 0.06), rail);
      drop.position.set(ex + s * 0.45, 1.1, 0.35);
      g.add(drop);
    }

    // Downspout / drain pipe
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, h * 0.95, 8),
      metalMat(0x5a6058)
    );
    pipe.position.set(w / 2 - 0.2, h * 0.48, d / 2 + 0.12);
    pipe.castShadow = true;
    g.add(pipe);
    // elbow at top
    const elbow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8),
      metalMat(0x5a6058)
    );
    elbow.rotation.z = Math.PI / 2;
    elbow.position.set(w / 2 - 0.4, h * 0.95, d / 2 + 0.12);
    g.add(elbow);

    // Electrical meter boxes
    const meter = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.2), metalMat(0x3a4840));
    meter.position.set(-w * 0.3, 1.4, d / 2 + 0.12);
    meter.castShadow = true;
    g.add(meter);
    const conduit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 2.5, 6),
      metalMat(0x2a2a28)
    );
    conduit.position.set(-w * 0.3, 2.9, d / 2 + 0.1);
    g.add(conduit);

    // Graffiti as textured planes (spray look)
    if (opts.graffiti !== false && opts.grafMap) {
      for (let i = 0; i < 3; i++) {
        const tag = new THREE.Mesh(
          new THREE.PlaneGeometry(1.8 + Math.random() * 1.2, 0.9 + Math.random() * 0.7),
          M({
            map: opts.grafMap,
            rough: 0.95,
            transparent: true,
            opacity: 0.92,
          })
        );
        tag.position.set(-w * 0.2 + i * 1.4, 1.1 + (i % 2) * 0.6, d / 2 + 0.13);
        g.add(tag);
      }
    }

    // Door + frame + steps
    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 2.45, 0.15),
      M({ color: 0x2e2a24, rough: 0.85 })
    );
    doorFrame.position.set(w * 0.28, 1.22, d / 2 + 0.06);
    g.add(doorFrame);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 2.2, 0.1),
      M({ color: 0x3a3028, rough: 0.78 })
    );
    door.position.set(w * 0.28, 1.15, d / 2 + 0.12);
    door.castShadow = true;
    g.add(door);
    // door panels
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.85, 0.04),
          M({ color: 0x2a221c, rough: 0.8 })
        );
        panel.position.set(w * 0.28 - 0.22 + c * 0.44, 0.7 + r * 1.0, d / 2 + 0.18);
        g.add(panel);
      }
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), metalMat(0xc0c8d0));
    knob.position.set(w * 0.28 + 0.4, 1.15, d / 2 + 0.2);
    g.add(knob);
    // stoop steps
    for (let s = 0; s < 2; s++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(1.6 - s * 0.15, 0.14, 0.4),
        M({ color: 0x6a6860, rough: 0.9 })
      );
      step.position.set(w * 0.28, 0.07 + s * 0.14, d / 2 + 0.35 + s * 0.2);
      step.castShadow = true;
      g.add(step);
    }

    // Awning over storefront
    if (opts.awning) {
      const awn = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.85, 0.08, 1.4),
        M({ color: opts.awnColor || 0x8a3030, rough: 0.85 })
      );
      awn.position.set(0, 2.9, d / 2 + 0.75);
      awn.rotation.x = 0.12;
      awn.castShadow = true;
      g.add(awn);
      // stripes
      for (let i = 0; i < 6; i++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.12, 0.02, 1.35),
          M({ color: 0xf0e8d8, rough: 0.9 })
        );
        stripe.position.set(-w * 0.35 + i * w * 0.14, 2.92, d / 2 + 0.75);
        stripe.rotation.x = 0.12;
        g.add(stripe);
      }
      // support rods
      [-1, 1].forEach((s) => {
        const rod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6),
          metalMat(0x3a3a38)
        );
        rod.position.set(s * w * 0.3, 2.5, d / 2 + 0.9);
        rod.rotation.x = 0.5;
        g.add(rod);
      });
    }

    if (opts.rotY) g.rotation.y = opts.rotY;
    g.position.set(x, 0, z);
    root.add(g);
    if (opts.colliders) {
      const hw = w / 2 + 0.2;
      const hd = d / 2 + 0.2;
      // AABB (ignore rot for 0/PI; for PI/2 swap)
      const r = ((opts.rotY || 0) + 0.01) % (Math.PI / 2);
      if (Math.abs((opts.rotY || 0) % Math.PI) > 0.5 && Math.abs((opts.rotY || 0) % Math.PI) < 2.5) {
        // ~90 deg
        opts.colliders.push({ minX: x - hd, maxX: x + hd, minZ: z - hw, maxZ: z + hw });
      } else {
        opts.colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });
      }
    }
    return g;
  }

  /**
   * Few-block open world (3x3 lots) for mechanics work.
   * Playable streets + filled lots + distant skyline ring.
   * No cars / collectible toys — architecture + city furniture only.
   * Returns colliders + bounds for the game.
   */
  function buildCity(scene, options) {
    options = options || {};
    const root = new THREE.Group();
    root.name = "open-city";
    const colliders = [];
    const nightLamps = [];
    const nightWindows = [];

    const asphaltMap = asphaltTex();
    asphaltMap.repeat.set(10, 10);
    const asphaltBumpMap = asphaltBump();
    asphaltBumpMap.repeat.set(10, 10);
    const asphaltNormal = makeNormalFromAlbedo(asphaltMap, 2.2);
    const asphaltRough = makeRoughFromAlbedo(asphaltMap, 1.1);
    const concreteMap = concreteTex();
    const concreteNormal = makeNormalFromAlbedo(concreteMap, 1.4);
    const concreteRough = makeRoughFromAlbedo(concreteMap, 0.9);
    const brickMapA = brickTex(0);
    const brickMapB = brickTex(7);
    const brickMapC = brickTex(13);
    const brickNormalA = makeNormalFromAlbedo(brickMapA, 1.6);
    const brickRoughA = makeRoughFromAlbedo(brickMapA, 1.0);
    const brickNormalB = makeNormalFromAlbedo(brickMapB, 1.6);
    const sideMap = sidewalkTex();
    sideMap.repeat.set(4, 4);
    const sideNormal = makeNormalFromAlbedo(sideMap, 1.2);
    const sideRough = makeRoughFromAlbedo(sideMap, 0.85);
    const grafMap = graffitiTex();

    // —— Grid: 3x3 building lots, roads between ——
    const BLOCK = 26; // lot size
    const ROAD = 14; // street width
    const CELL = BLOCK + ROAD; // 40
    const GRID = 3;
    const half = ((GRID - 1) * CELL) / 2; // 40
    const citySpan = GRID * CELL + ROAD; // 134
    const halfCity = citySpan / 2; // 67

    // Dirt underlay beyond city
    const dirt = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 320),
      M({ color: 0x524e42, rough: 1 })
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = -0.06;
    dirt.receiveShadow = true;
    root.add(dirt);

    // Full asphalt plate for the neighborhood — PBR with normal + roughness
    const roadPlate = new THREE.Mesh(
      new THREE.BoxGeometry(citySpan + 8, 0.14, citySpan + 8),
      M({
        map: asphaltMap,
        bumpMap: asphaltBumpMap,
        bumpScale: 0.035,
        normalMap: asphaltNormal,
        normalScale: 0.85,
        roughMap: asphaltRough,
        rough: 0.92,
        metal: 0.04,
        env: 0.15,
      })
    );
    roadPlate.position.y = 0.05;
    roadPlate.receiveShadow = true;
    roadPlate.castShadow = true;
    root.add(roadPlate);

    // Yellow dashes — N/S streets (along Z) at each road centerline
    function roadCenters() {
      const list = [];
      for (let i = 0; i <= GRID; i++) {
        list.push(-half - BLOCK / 2 - ROAD / 2 + i * CELL);
      }
      return list;
    }
    const roadsX = roadCenters(); // vertical streets (run along Z)
    const roadsZ = roadCenters(); // horizontal streets (run along X)

    function addDashes(axis, pos, from, to) {
      for (let t = from; t < to; t += 3.2) {
        const d = new THREE.Mesh(
          new THREE.BoxGeometry(axis === "z" ? 0.14 : 1.35, 0.03, axis === "z" ? 1.35 : 0.14),
          M({ color: 0xd4a820, rough: 0.5 })
        );
        if (axis === "z") d.position.set(pos, 0.14, t);
        else d.position.set(t, 0.14, pos);
        root.add(d);
      }
    }
    roadsX.forEach((x) => addDashes("z", x, -halfCity + 2, halfCity - 2));
    roadsZ.forEach((z) => addDashes("x", z, -halfCity + 2, halfCity - 2));

    // White edge lines + crosswalks at intersections
    roadsX.forEach((rx) => {
      roadsZ.forEach((rz) => {
        // skip edge intersections slightly for variety
        for (let i = 0; i < 6; i++) {
          const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(ROAD - 2.5, 0.025, 0.4),
            M({ color: 0xd0c8b0, rough: 0.7 })
          );
          stripe.position.set(rx, 0.135, rz - 3.5 + i * 0.55);
          root.add(stripe);
        }
        for (let i = 0; i < 6; i++) {
          const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.025, ROAD - 2.5),
            M({ color: 0xd0c8b0, rough: 0.7 })
          );
          stripe.position.set(rx - 3.5 + i * 0.55, 0.135, rz);
          root.add(stripe);
        }
      });
    });

    // Manholes scattered on roads
    for (let i = 0; i < 18; i++) {
      const rx = roadsX[i % roadsX.length];
      const rz = roadsZ[Math.floor(i / 2) % roadsZ.length];
      const ox = (i % 3) - 1;
      const mh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.06, 16),
        metalMat(0x3a3a36)
      );
      mh.position.set(rx + ox * 1.5, 0.13, rz + ((i * 7) % 11) - 5);
      mh.castShadow = true;
      root.add(mh);
    }

    // Sidewalk helper (raised tile slab)
    function addSidewalk(x, z, w, d) {
      const sw = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.2, d),
        M({
          map: sideMap,
          normalMap: sideNormal,
          normalScale: 0.55,
          roughMap: sideRough,
          rough: 0.88,
          metal: 0.02,
          env: 0.12,
        })
      );
      sw.position.set(x, 0.14, z);
      sw.receiveShadow = true;
      sw.castShadow = true;
      root.add(sw);
    }

    // Building lot placement
    const brickMaps = [brickMapA, brickMapB, brickMapC];
    const brickNormals = [brickNormalA, brickNormalB, brickNormalA];
    const brickRoughs = [brickRoughA, brickRoughA, brickRoughA];
    let seed = 0;
    for (let gx = 0; gx < GRID; gx++) {
      for (let gz = 0; gz < GRID; gz++) {
        const cx = -half + gx * CELL;
        const cz = -half + gz * CELL;
        const lotPad = 1.2;
        const lotW = BLOCK - lotPad * 2;
        const lotD = BLOCK - lotPad * 2;

        // Sidewalk ring around the lot (between building and road)
        const swW = 2.4;
        addSidewalk(cx, cz - lotD / 2 - swW / 2, lotW + swW * 2, swW);
        addSidewalk(cx, cz + lotD / 2 + swW / 2, lotW + swW * 2, swW);
        addSidewalk(cx - lotW / 2 - swW / 2, cz, swW, lotD);
        addSidewalk(cx + lotW / 2 + swW / 2, cz, swW, lotD);

        // Fill lot with 1–2 buildings (variety)
        const floors = 2 + ((gx * 3 + gz * 2) % 4);
        const brick = (gx + gz) % 2 === 0;
        const twin = (gx + gz) % 3 === 0;

        if (twin) {
          // Two buildings side by side
          const bw = lotW * 0.46;
          const bd = lotD * 0.88;
          addBuilding(root, cx - lotW * 0.26, cz, bw, bd, floors, {
            brick,
            brickMap: brickMaps[seed % 3],
            brickNormal: brickNormals[seed % 3],
            brickRough: brickRoughs[seed % 3],
            concreteMap,
            concreteNormal,
            concreteRough,
            shutter: seed % 2 === 0,
            escape: seed % 2 === 1,
            awning: seed % 3 === 0,
            awnColor: [0x8a3030, 0x305080, 0x206040][seed % 3],
            graffiti: true,
            grafMap,
            seed: seed++,
            colliders,
            flipEscape: true,
            nightWindows,
          });
          addBuilding(root, cx + lotW * 0.26, cz, bw, bd, floors + (seed % 2), {
            brick: !brick,
            brickMap: brickMaps[seed % 3],
            brickNormal: brickNormals[seed % 3],
            brickRough: brickRoughs[seed % 3],
            concreteMap,
            concreteNormal,
            concreteRough,
            shutter: seed % 3 === 1,
            escape: seed % 2 === 0,
            awning: false,
            graffiti: seed % 2 === 0,
            grafMap,
            seed: seed++,
            colliders,
            flipEscape: true,
            nightWindows,
          });
        } else {
          // One main building + optional rear shed
          addBuilding(root, cx, cz, lotW * 0.88, lotD * 0.82, floors, {
            brick,
            brickMap: brickMaps[seed % 3],
            brickNormal: brickNormals[seed % 3],
            brickRough: brickRoughs[seed % 3],
            concreteMap,
            concreteNormal,
            concreteRough,
            shutter: (gx + gz) % 3 === 1,
            escape: (gx + gz) % 2 === 0,
            awning: (gx * 2 + gz) % 4 === 0,
            awnColor: [0x8a3030, 0x305080, 0x6a4020][seed % 3],
            graffiti: true,
            grafMap,
            seed: seed++,
            colliders,
            flipEscape: gx < GRID / 2,
            nightWindows,
          });
        }

        // Alley dumpster in lot corner
        if ((gx + gz) % 2 === 0) {
          const dx = cx + lotW * 0.35;
          const dz = cz + lotD * 0.35;
          const dump = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 1.2, 1.2),
            M({ color: 0x3a5c48, rough: 0.62, metal: 0.28 })
          );
          dump.position.set(dx, 0.6, dz);
          dump.castShadow = true;
          root.add(dump);
          colliders.push({
            minX: dx - 0.85,
            maxX: dx + 0.85,
            minZ: dz - 0.7,
            maxZ: dz + 0.7,
          });
        }
      }
    }

    // —— Street furniture along every corridor ——
    roadsX.forEach((rx, ri) => {
      for (let z = -halfCity + 6; z < halfCity - 6; z += 16) {
        // poles left/right of this N-S road
        [-1, 1].forEach((side) => {
          const px = rx + side * (ROAD / 2 - 0.6);
          // skip if near a building lot center too much — still fine on sidewalk
          const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.11, 0.14, 10.5, 8),
            woodMat()
          );
          pole.position.set(px, 5.25, z + ri * 2);
          pole.castShadow = true;
          root.add(pole);
          const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.12), woodMat());
          arm.position.set(px, 9.8, z + ri * 2);
          root.add(arm);
        });
        // wire across road
        const y = 9.7;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(rx - ROAD / 2 + 0.5, y, z),
          new THREE.Vector3(rx, y - 0.7, z + 0.2),
          new THREE.Vector3(rx + ROAD / 2 - 0.5, y, z),
        ]);
        root.add(
          new THREE.Mesh(
            new THREE.TubeGeometry(curve, 12, 0.016, 3, false),
            M({ color: 0x1a1a16, rough: 0.7, metal: 0.35 })
          )
        );
      }
    });

    // Street lamps along E-W roads — real PointLights for night shading
    roadsZ.forEach((rz, ri) => {
      for (let x = -halfCity + 8; x < halfCity - 8; x += 18) {
        const side = ri % 2 === 0 ? 1 : -1;
        const lamp = new THREE.Group();
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.1, 7.2, 8),
          metalMat(0x3a3a36)
        );
        post.position.y = 3.6;
        post.castShadow = true;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.25, 0.4), metalMat(0x222220));
        head.position.set(0.9, 7.0, 0);
        const bulbMat = M({
          color: 0xffe8c0,
          rough: 0.35,
          metal: 0.1,
          emissive: 0xffc878,
          ei: 0.15,
          env: 0.2,
        });
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bulbMat);
        bulb.position.set(0.9, 6.85, 0);
        // Point light — off by day, sky controller ramps intensity at night
        const pl = new THREE.PointLight(0xffc878, 0, 22, 2);
        pl.position.set(0.9, 6.7, 0);
        pl.castShadow = false; // many lamps; avoid shadow budget blowup
        lamp.add(post, head, bulb, pl);
        lamp.position.set(x, 0, rz + side * (ROAD / 2 - 0.8));
        lamp.rotation.y = side > 0 ? 0 : Math.PI;
        root.add(lamp);
        nightLamps.push({ light: pl, bulbMat, power: 0.85 + (ri % 3) * 0.1 });
      }
    });
    // A few extra lamps on N-S roads so night streets are lit both ways
    roadsX.forEach((rx, ri) => {
      for (let z = -halfCity + 14; z < halfCity - 14; z += 28) {
        const side = ri % 2 === 0 ? 1 : -1;
        const lamp = new THREE.Group();
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.1, 7.2, 8),
          metalMat(0x3a3a36)
        );
        post.position.y = 3.6;
        post.castShadow = true;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.25, 0.4), metalMat(0x222220));
        head.position.set(0.9, 7.0, 0);
        const bulbMat = M({
          color: 0xffe8c0,
          rough: 0.35,
          emissive: 0xffc878,
          ei: 0.15,
        });
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bulbMat);
        bulb.position.set(0.9, 6.85, 0);
        const pl = new THREE.PointLight(0xffd090, 0, 20, 2);
        pl.position.set(0.9, 6.7, 0);
        lamp.add(post, head, bulb, pl);
        lamp.position.set(rx + side * (ROAD / 2 - 0.8), 0, z);
        lamp.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        root.add(lamp);
        nightLamps.push({ light: pl, bulbMat, power: 0.75 });
      }
    });

    // Hydrants + mailboxes on main streets
    [
      [roadsX[1] + 5.5, roadsZ[1] + 4],
      [roadsX[2] - 5.5, roadsZ[2] - 3],
      [roadsX[0] + 5.2, roadsZ[1] + 6],
      [roadsX[1] - 5.2, roadsZ[0] + 5],
    ].forEach((p, i) => {
      const hyd = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.2, 0.65, 8),
        M({ color: 0xb02828, rough: 0.45, metal: 0.35 })
      );
      hyd.position.set(p[0], 0.32, p[1]);
      hyd.castShadow = true;
      root.add(hyd);
      if (i % 2 === 0) {
        const mail = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.8, 0.35),
          M({ color: 0x2858a0, rough: 0.5, metal: 0.28 })
        );
        mail.position.set(p[0] + 1.2, 0.55, p[1] + 2);
        mail.castShadow = true;
        root.add(mail);
      }
    });

    // Light street litter
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.08 + Math.random() * 0.12, 0.02, 0.06 + Math.random() * 0.1),
        M({
          color: [0x8a8070, 0x5a5040, 0x3a4038, 0x6a6050][i % 4],
          rough: 0.95,
        })
      );
      m.position.set(
        (Math.random() - 0.5) * citySpan * 0.9,
        0.14,
        (Math.random() - 0.5) * citySpan * 0.9
      );
      m.rotation.y = Math.random() * 6;
      root.add(m);
    }

    // —— Fill BACKGROUND: skyline ring outside playable streets ——
    const skylineInner = halfCity + 6;
    const skylineOuter = halfCity + 55;
    for (let i = 0; i < 48; i++) {
      const ang = (i / 48) * Math.PI * 2 + (i % 3) * 0.05;
      const dist = skylineInner + 8 + (i % 5) * 9 + Math.random() * 6;
      const sx = Math.cos(ang) * dist;
      const sz = Math.sin(ang) * dist;
      const h = 8 + (i % 7) * 3.5 + Math.random() * 6;
      const bw = 5 + (i % 4) * 2;
      const bd = 5 + ((i + 2) % 4) * 2;
      const mat =
        i % 3 === 0
          ? M({ map: brickMaps[i % 3], rough: 0.92 })
          : M({
              color: new THREE.Color().setHSL(0.08, 0.05, 0.3 + (i % 5) * 0.04),
              rough: 0.95,
            });
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), mat);
      b.position.set(sx, h / 2, sz);
      b.castShadow = true;
      b.receiveShadow = true;
      root.add(b);
      // simple window strip
      if (i % 2 === 0) {
        for (let f = 0; f < Math.min(5, Math.floor(h / 3.2)); f++) {
          const win = new THREE.Mesh(
            new THREE.BoxGeometry(bw * 0.7, 0.5, 0.08),
            M({ color: 0x1a2430, rough: 0.2, emissive: 0x101820, ei: 0.12 })
          );
          win.position.set(sx, 1.8 + f * 3.0, sz + bd / 2);
          root.add(win);
        }
      }
      // roof box
      if (h > 14) {
        const ac = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 0.7, 1.2),
          metalMat(0x6a7078)
        );
        ac.position.set(sx, h + 0.4, sz);
        root.add(ac);
      }
    }

    // Extra mid-distance filler blocks (closes gaps in skyline)
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2 + 0.4;
      const dist = halfCity + 4 + (i % 3) * 5;
      const sx = Math.cos(ang) * dist;
      const sz = Math.sin(ang) * dist;
      // only place if outside the asphalt plate
      if (Math.abs(sx) < halfCity - 2 && Math.abs(sz) < halfCity - 2) continue;
      const h = 6 + (i % 4) * 2.5;
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(8 + (i % 3), h, 8 + ((i + 1) % 3)),
        M({ map: concreteMap, rough: 0.92 })
      );
      b.position.set(sx, h / 2, sz);
      b.castShadow = true;
      b.receiveShadow = true;
      root.add(b);
    }

    // Invisible playable bounds (edge of few-block map)
    const bound = halfCity - 1;
    colliders.push({ minX: -bound - 3, maxX: -bound, minZ: -bound - 5, maxZ: bound + 5 });
    colliders.push({ minX: bound, maxX: bound + 3, minZ: -bound - 5, maxZ: bound + 5 });
    colliders.push({ minX: -bound - 5, maxX: bound + 5, minZ: -bound - 3, maxZ: -bound });
    colliders.push({ minX: -bound - 5, maxX: bound + 5, minZ: bound, maxZ: bound + 3 });

    scene.add(root);
    // Fog/background owned by sky system when present; fallback day haze here
    if (!scene.fog) {
      scene.fog = new THREE.FogExp2(0xc4a888, 0.0075);
    }
    if (!scene.background) {
      scene.background = new THREE.Color(0xc8b090);
    }

    return {
      root,
      colliders,
      bounds: bound,
      // Spawn on a clear road intersection (not inside a building lot)
      spawn: { x: -20, z: -20 },
      mapSize: citySpan,
      ROAD,
      GRID,
      CELL,
      nightLamps,
      nightWindows,
      lotCenters: (() => {
        const c = [];
        for (let gx = 0; gx < GRID; gx++) {
          for (let gz = 0; gz < GRID; gz++) {
            c.push({ x: -half + gx * CELL, z: -half + gz * CELL });
          }
        }
        return c;
      })(),
    };
  }

  /**
   * Lighting + sky. Prefer JIMPTHY_SKY when available.
   */
  function setupCityLights(scene) {
    if (global.JIMPTHY_SKY && typeof global.JIMPTHY_SKY.create === "function") {
      const skyCtrl = global.JIMPTHY_SKY.create(scene);
      return {
        sun: skyCtrl.sun,
        dust: skyCtrl.dust,
        flare: skyCtrl.flare,
        sky: skyCtrl.sky,
        skyCtrl,
      };
    }
    // Minimal fallback (no sky.js)
    const sun = new THREE.DirectionalLight(0xffc878, 2.35);
    sun.name = "jimothySun";
    sun.position.set(-58, 22, 32);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);
    scene.add(sun.target);
    scene.add(new THREE.HemisphereLight(0xffe2c0, 0x4a4035, 0.55));
    scene.add(new THREE.AmbientLight(0xb89870, 0.14));
    scene.background = new THREE.Color(0xc8b090);
    scene.fog = new THREE.FogExp2(0xc4a888, 0.0075);
    return { sun, skyCtrl: null };
  }

  function updateSunShadows(sun, px, pz) {
    if (!sun) return;
    sun.position.set(px - 48, 24, pz + 28);
    sun.target.position.set(px, 0, pz);
    if (sun.target.updateMatrixWorld) sun.target.updateMatrixWorld();
    if (sun.shadow && sun.shadow.camera) {
      const sc = sun.shadow.camera;
      const r = 42;
      sc.left = -r;
      sc.right = r;
      sc.top = r;
      sc.bottom = -r;
      sc.updateProjectionMatrix();
    }
  }

  global.JIMPTHY_CITY = {
    buildCity,
    setupCityLights,
    updateSunShadows,
    setEnvMap,
  };
})(window);
