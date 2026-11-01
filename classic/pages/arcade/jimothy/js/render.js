/**
 * High-quality render path: PBR-friendly setup, golden-hour grade, soft post.
 * Works with Three.js r128 (no EffectComposer dependency).
 */
(function (global) {
  "use strict";

  function configureRenderer(renderer) {
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    // Soft shadows — PCFSoft is best available in r128 without VSM extras
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Keep classic light falloff — physicallyCorrect washes the golden-hour look in r128
    if (renderer.physicallyCorrectLights !== undefined) {
      renderer.physicallyCorrectLights = false;
    }
    // Prefer high anisotropy when GPU allows
    const gl = renderer.getContext();
    const maxAniso = gl && gl.getParameter
      ? gl.getParameter(gl.MAX_TEXTURE_MAX_ANISOTROPY_EXT || 0x84ff)
      : 8;
    renderer.capabilities = renderer.capabilities || {};
    renderer.userData = renderer.userData || {};
    renderer.userData.maxAnisotropy = Math.min(16, maxAniso || 8);
    return renderer;
  }

  /** Procedural HDR-ish gradient env for reflections on glass/metal */
  function createEnvMap(renderer) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const g = c.getContext("2d");
    // Sky upper half
    const sky = g.createLinearGradient(0, 0, 0, 128);
    sky.addColorStop(0, "#2a4a78");
    sky.addColorStop(0.35, "#6a88a8");
    sky.addColorStop(0.55, "#c8a878");
    sky.addColorStop(0.72, "#e8b868");
    sky.addColorStop(1, "#a86840");
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 128);
    // Ground / bounce lower half
    const gnd = g.createLinearGradient(0, 128, 0, 256);
    gnd.addColorStop(0, "#8a7060");
    gnd.addColorStop(0.4, "#5a5040");
    gnd.addColorStop(1, "#2a2820");
    g.fillStyle = gnd;
    g.fillRect(0, 128, 512, 128);
    // Soft sun bloom on horizon
    const sun = g.createRadialGradient(100, 130, 4, 100, 130, 90);
    sun.addColorStop(0, "rgba(255,240,200,0.95)");
    sun.addColorStop(0.25, "rgba(255,190,100,0.45)");
    sun.addColorStop(1, "rgba(255,160,60,0)");
    g.fillStyle = sun;
    g.fillRect(0, 0, 512, 256);

    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;

    // PMREM if available for proper IBL
    if (THREE.PMREMGenerator) {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        // r128: fromEquirectangular expects texture
        const rt = pmrem.fromEquirectangular(tex);
        pmrem.dispose();
        tex.dispose();
        return rt.texture;
      } catch (e) {
        return tex;
      }
    }
    return tex;
  }

  /**
   * Fullscreen post: color grade, vignette, mild bloom lift, film grain.
   * render() draws scene → RT → graded quad to screen.
   */
  function createPostFX(renderer, scene, camera) {
    const w = renderer.domElement.width || window.innerWidth;
    const h = renderer.domElement.height || window.innerHeight;
    const rt = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      encoding: THREE.sRGBEncoding,
    });
    rt.texture.generateMipmaps = false;

    const uniforms = {
      tDiffuse: { value: rt.texture },
      uRes: { value: new THREE.Vector2(w, h) },
      uTime: { value: 0 },
      uExposure: { value: 0.98 },
      uVignette: { value: 0.22 },
      uWarmth: { value: 0.07 },
      uContrast: { value: 1.04 },
      uBloom: { value: 0.08 },
      uGrain: { value: 0.018 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: [
        "varying vec2 vUv;",
        "void main(){",
        "  vUv = uv;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform sampler2D tDiffuse;",
        "uniform vec2 uRes;",
        "uniform float uTime;",
        "uniform float uExposure;",
        "uniform float uVignette;",
        "uniform float uWarmth;",
        "uniform float uContrast;",
        "uniform float uBloom;",
        "uniform float uGrain;",
        "varying vec2 vUv;",
        "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }",
        "void main(){",
        "  vec2 uv = vUv;",
        "  // tiny CA only at frame edge (doesn't halo characters)",
        "  float edge = smoothstep(0.25, 0.72, length(uv - 0.5));",
        "  float ca = 0.0007 * edge;",
        "  float r = texture2D(tDiffuse, uv + vec2(ca, 0.0)).r;",
        "  float g = texture2D(tDiffuse, uv).g;",
        "  float b = texture2D(tDiffuse, uv - vec2(ca, 0.0)).b;",
        "  vec3 col = vec3(r,g,b);",
        "  // subtle highlight lift (not full bloom)",
        "  vec2 px = 2.5 / uRes;",
        "  vec3 blur = texture2D(tDiffuse, uv + px * vec2( 1.0, 0.0)).rgb;",
        "  blur += texture2D(tDiffuse, uv + px * vec2(-1.0, 0.0)).rgb;",
        "  blur += texture2D(tDiffuse, uv + px * vec2( 0.0, 1.0)).rgb;",
        "  blur += texture2D(tDiffuse, uv + px * vec2( 0.0,-1.0)).rgb;",
        "  blur *= 0.25;",
        "  float lum = dot(col, vec3(0.299,0.587,0.114));",
        "  col += max(blur - col, 0.0) * uBloom * smoothstep(0.7, 1.0, lum);",
        "  // gentle grade (ACES already on renderer — keep this light)",
        "  col *= uExposure;",
        "  col = (col - 0.5) * uContrast + 0.5;",
        "  col.r += uWarmth * 0.05;",
        "  col.b -= uWarmth * 0.035;",
        "  // vignette",
        "  float d = length(uv - 0.5);",
        "  col *= 1.0 - d * d * uVignette * 1.35;",
        "  // fine grain",
        "  float n = hash(uv * uRes + fract(uTime) * 60.0) - 0.5;",
        "  col += n * uGrain;",
        "  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);",
        "}",
      ].join("\n"),
      depthTest: false,
      depthWrite: false,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    const postScene = new THREE.Scene();
    const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postScene.add(quad);

    let enabled = true;
    let time = 0;

    function setSize(width, height) {
      const pr = renderer.getPixelRatio();
      rt.setSize(Math.floor(width * pr), Math.floor(height * pr));
      uniforms.uRes.value.set(width * pr, height * pr);
    }

    function render(dt) {
      time += dt || 0.016;
      uniforms.uTime.value = time;
      if (!enabled) {
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
        return;
      }
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    }

    return {
      render,
      setSize,
      setEnabled: (v) => {
        enabled = !!v;
      },
      uniforms,
      rt,
    };
  }

  /** Soft radial shadow texture for characters */
  function softShadowTexture() {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 60);
    grd.addColorStop(0, "rgba(0,0,0,0.55)");
    grd.addColorStop(0.45, "rgba(0,0,0,0.22)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.LinearEncoding;
    return t;
  }

  global.JIMPTHY_RENDER = {
    configureRenderer,
    createEnvMap,
    createPostFX,
    softShadowTexture,
  };
})(window);
