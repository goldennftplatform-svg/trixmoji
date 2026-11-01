/* Spawn hollow floating buttons into a .float-field */
function hollowSpawn(field, items) {
  if (typeof field === 'string') field = document.getElementById(field);
  items.forEach(function (cfg) {
    var a = document.createElement('a');
    a.className = 'hollow-btn' + (cfg.cls ? ' ' + cfg.cls : '');
    a.href = cfg.href;
    a.style.left = cfg.x + '%';
    a.style.top = cfg.y + '%';
    a.style.setProperty('--dur', (4.5 + Math.random() * 5) + 's');
    a.style.setProperty('--delay', (-Math.random() * 6) + 's');
    if (cfg.ring) a.style.setProperty('--ring', cfg.ring + 'px');
    if (cfg.color) a.style.color = cfg.color;
    a.innerHTML =
      '<div class="hollow-ring"><span class="glyph">' + cfg.glyph + '</span></div>' +
      '<span class="hollow-label">' + cfg.label + '</span>' +
      (cfg.tag ? '<span class="hollow-tag">' + cfg.tag + '</span>' : '');
    field.appendChild(a);
  });
}

function hollowParallax(selector) {
  document.addEventListener('mousemove', function (e) {
    var nx = (e.clientX / window.innerWidth - 0.5) * 2;
    var ny = (e.clientY / window.innerHeight - 0.5) * 2;
    document.querySelectorAll(selector || '.hollow-btn').forEach(function (btn, i) {
      var d = 3 + (i % 4) * 2;
      btn.style.marginLeft = (nx * d) + 'px';
      btn.style.marginTop = (ny * d) + 'px';
    });
  });
}

function hollowMandelBg(canvasId, palette, opts) {
  opts = opts || {};
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = opts.w || 320;
  var H = opts.h || 240;
  var opacity = opts.opacity != null ? opts.opacity : 0.55;

  function pal(n) { return palette[Math.abs(n) % palette.length]; }

  function resize() {
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.opacity = opacity;
  }

  resize();
  window.addEventListener('resize', resize);

  var running = true;
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
  });

  (function loop() {
    if (!running) {
      requestAnimationFrame(loop);
      return;
    }
    var img = ctx.createImageData(W, H);
    var d = img.data;
    var t = Date.now() * (opts.speed || 0.00008);
    var scale = opts.scale || 2.4;
    var step = opts.fast ? 2 : 1;
    for (var py = 0; py < H; py += step) {
      for (var px = 0; px < W; px += step) {
        var x0 = (px / W - 0.5) * scale + Math.sin(t + py * 0.008) * 0.1;
        var y0 = (py / H - 0.5) * scale * (H / W) + Math.cos(t * 0.65) * 0.07;
        var x = 0, y = 0, iter = 0, max = opts.iter || 36;
        while (x * x + y * y <= 4 && iter < max) {
          var xt = x * x - y * y + x0;
          y = 2 * x * y + y0;
          x = xt;
          iter++;
        }
        var idx = (py * W + px) * 4;
        var col = iter === max ? 0 : (iter % (palette.length - 1)) + 1;
        var hex = pal(col);
        d[idx] = parseInt(hex.slice(1, 3), 16);
        d[idx + 1] = parseInt(hex.slice(3, 5), 16);
        d[idx + 2] = parseInt(hex.slice(5, 7), 16);
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    requestAnimationFrame(loop);
  })();
}