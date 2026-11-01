/**
 * DOSWAPZ Meme Lab — all client-side.
 * Image never leaves the browser. No upload API.
 */
(function (global) {
  'use strict';

  var MAX_EDGE = 1400;
  var MIN_EDGE = 320;
  var fonts = {
    impact: 'Impact, Haettenschweiler, "Arial Black", sans-serif',
    vt: '"VT323", "Courier New", monospace',
    comic: '"Comic Sans MS", "Comic Sans", cursive',
    serif: 'Georgia, "Times New Roman", serif',
    mono: '"Courier New", Consolas, monospace'
  };

  var canvas;
  var ctx;
  var img = null;
  var templateId = '';
  var texts = [];
  var selected = null;
  var filter = 'none';
  var flipH = false;
  var flipV = false;
  var stamp = true;
  var drag = null;
  var uid = 1;

  function $(id) {
    return document.getElementById(id);
  }

  function nextId() {
    return 't' + uid++;
  }

  function defaultTexts() {
    return [
      layer({ text: 'TOP TEXT', y: 0.08, size: 56 }),
      layer({ text: 'BOTTOM TEXT', y: 0.88, size: 56 })
    ];
  }

  function layer(opts) {
    opts = opts || {};
    return {
      id: opts.id || nextId(),
      text: opts.text != null ? opts.text : 'TEXT',
      x: opts.x != null ? opts.x : 0.5,
      y: opts.y != null ? opts.y : 0.5,
      size: opts.size || 48,
      color: opts.color || '#ffffff',
      stroke: opts.stroke || '#000000',
      strokeW: opts.strokeW != null ? opts.strokeW : 6,
      font: opts.font || 'impact',
      align: opts.align || 'center',
      caps: opts.caps !== false,
      maxW: opts.maxW != null ? opts.maxW : 0.92
    };
  }

  function fitSize(w, h) {
    var scale = 1;
    var longest = Math.max(w, h);
    if (longest > MAX_EDGE) scale = MAX_EDGE / longest;
    if (Math.min(w, h) * scale < MIN_EDGE) {
      scale = MIN_EDGE / Math.min(w, h);
      if (Math.max(w, h) * scale > MAX_EDGE) scale = MAX_EDGE / Math.max(w, h);
    }
    return { w: Math.round(w * scale), h: Math.round(h * scale) };
  }

  function setCanvasSize(w, h) {
    var fit = fitSize(w, h);
    canvas.width = fit.w;
    canvas.height = fit.h;
  }

  function wrapLines(ctx2, text, maxWidth) {
    var words = String(text || '').split(/\s+/);
    var lines = [];
    var cur = '';
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + ' ' + words[i] : words[i];
      if (ctx2.measureText(test).width > maxWidth && cur) {
        lines.push(cur);
        cur = words[i];
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  function applyFilter() {
    if (filter === 'none') return;
    var w = canvas.width;
    var h = canvas.height;
    if (filter === 'crt') {
      ctx.fillStyle = 'rgba(0,255,65,0.08)';
      ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 3) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(0, y, w, 1);
      }
      return;
    }
    if (filter === 'vhs') {
      var snap = ctx.getImageData(0, 0, w, h);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255,0,80,0.12)';
      ctx.fillRect(2, 0, w, h);
      ctx.fillStyle = 'rgba(0,220,255,0.1)';
      ctx.fillRect(-2, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.putImageData(snap, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (var i = 0; i < h; i += 4) ctx.fillRect(0, i, w, 1);
      return;
    }
    var data = ctx.getImageData(0, 0, w, h);
    var d = data.data;
    var x, p, r, g, b, n;
    if (filter === 'gray') {
      for (p = 0; p < d.length; p += 4) {
        n = 0.3 * d[p] + 0.59 * d[p + 1] + 0.11 * d[p + 2];
        d[p] = d[p + 1] = d[p + 2] = n;
      }
    } else if (filter === 'invert') {
      for (p = 0; p < d.length; p += 4) {
        d[p] = 255 - d[p];
        d[p + 1] = 255 - d[p + 1];
        d[p + 2] = 255 - d[p + 2];
      }
    } else if (filter === 'fried') {
      for (p = 0; p < d.length; p += 4) {
        r = Math.min(255, d[p] * 1.45 + 18);
        g = Math.min(255, d[p + 1] * 1.15);
        b = Math.max(0, d[p + 2] * 0.65 - 10);
        d[p] = r;
        d[p + 1] = g;
        d[p + 2] = b;
      }
    } else if (filter === 'pixel') {
      var block = Math.max(4, Math.round(w / 80));
      ctx.putImageData(data, 0, 0);
      for (var yy = 0; yy < h; yy += block) {
        for (var xx = 0; xx < w; xx += block) {
          var sample = ctx.getImageData(xx, yy, 1, 1).data;
          ctx.fillStyle = 'rgb(' + sample[0] + ',' + sample[1] + ',' + sample[2] + ')';
          ctx.fillRect(xx, yy, block, block);
        }
      }
      return;
    }
    ctx.putImageData(data, 0, 0);
  }

  function drawTemplateBackground() {
    var w = canvas.width;
    var h = canvas.height;
    if (templateId === 'crt') {
      ctx.fillStyle = '#020805';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#33ff66';
      ctx.lineWidth = 8;
      ctx.strokeRect(16, 16, w - 32, h - 32);
      ctx.fillStyle = '#145522';
      ctx.font = '28px "VT323", monospace';
      ctx.fillText('DOSWAPZ // MEME LAB', 32, 48);
      return;
    }
    if (templateId === 'two') {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, w, h / 2 - 3);
      ctx.fillRect(0, h / 2 + 3, w, h / 2);
      ctx.fillStyle = '#333';
      ctx.fillRect(0, h / 2 - 3, w, 6);
      return;
    }
    if (templateId === 'three') {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, w, h);
      var sl = h / 3;
      ctx.fillStyle = '#181818';
      ctx.fillRect(0, 0, w, sl - 2);
      ctx.fillStyle = '#222';
      ctx.fillRect(0, sl + 2, w, sl - 4);
      ctx.fillStyle = '#181818';
      ctx.fillRect(0, sl * 2 + 2, w, sl);
      return;
    }
    if (templateId === 'grid') {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      return;
    }
    if (templateId === 'brain') {
      var cols = ['#3a2a44', '#4a3358', '#6a3a7a', '#9a44aa'];
      var bh = h / 4;
      for (var i = 0; i < 4; i++) {
        ctx.fillStyle = cols[i];
        ctx.fillRect(0, i * bh, w, bh + 1);
      }
      return;
    }
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);
  }

  function drawImage() {
    var w = canvas.width;
    var h = canvas.height;
    ctx.save();
    if (flipH || flipV) {
      ctx.translate(flipH ? w : 0, flipV ? h : 0);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    }
    if (img) {
      ctx.drawImage(img, 0, 0, w, h);
    } else {
      drawTemplateBackground();
    }
    ctx.restore();
    applyFilter();
  }

  function fontFace(t) {
    return fonts[t.font] || fonts.impact;
  }

  function displayText(t) {
    var s = String(t.text || '');
    return t.caps ? s.toUpperCase() : s;
  }

  function drawTextLayer(t, showBox) {
    var w = canvas.width;
    var h = canvas.height;
    var px = t.x * w;
    var py = t.y * h;
    var size = Math.max(12, Number(t.size) || 48);
    ctx.font = '900 ' + size + 'px ' + fontFace(t);
    ctx.textAlign = t.align || 'center';
    ctx.textBaseline = 'middle';
    var maxWidth = Math.max(40, (t.maxW || 0.92) * w);
    var lines = wrapLines(ctx, displayText(t), maxWidth);
    var lineH = size * 1.12;
    var totalH = lines.length * lineH;
    var startY = py - totalH / 2 + lineH / 2;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = t.stroke || '#000';
    ctx.fillStyle = t.color || '#fff';
    ctx.lineWidth = Math.max(0, Number(t.strokeW) || 0);
    var maxLineW = 0;
    for (var i = 0; i < lines.length; i++) {
      var lw = ctx.measureText(lines[i]).width;
      if (lw > maxLineW) maxLineW = lw;
      var y = startY + i * lineH;
      if (ctx.lineWidth > 0) ctx.strokeText(lines[i], px, y, maxWidth);
      ctx.fillText(lines[i], px, y, maxWidth);
    }
    if (showBox) {
      var left = t.align === 'left' ? px : t.align === 'right' ? px - maxLineW : px - maxLineW / 2;
      ctx.strokeStyle = '#33ff66';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(left - 8, py - totalH / 2 - 8, maxLineW + 16, totalH + 16);
      ctx.setLineDash([]);
    }
    t._hit = {
      x: (t.align === 'left' ? px : t.align === 'right' ? px - maxLineW : px - maxLineW / 2) - 10,
      y: py - totalH / 2 - 10,
      w: maxLineW + 20,
      h: totalH + 20
    };
  }

  function drawStamp() {
    if (!stamp) return;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#33ff66';
    ctx.font = '16px "VT323", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('DOSWAPZ', canvas.width - 10, canvas.height - 8);
    ctx.restore();
  }

  function render() {
    if (!canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawImage();
    for (var i = 0; i < texts.length; i++) {
      drawTextLayer(texts[i], selected && selected.id === texts[i].id);
    }
    drawStamp();
  }

  function hitTest(mx, my) {
    for (var i = texts.length - 1; i >= 0; i--) {
      var b = texts[i]._hit;
      if (!b) continue;
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return texts[i];
    }
    return null;
  }

  function pointerPos(ev) {
    var r = canvas.getBoundingClientRect();
    var src = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
    return {
      x: ((src.clientX - r.left) / r.width) * canvas.width,
      y: ((src.clientY - r.top) / r.height) * canvas.height
    };
  }

  function select(t) {
    selected = t;
    syncEditor();
    render();
  }

  function syncEditor() {
    var empty = $('mlEmptyEdit');
    var form = $('mlEdit');
    if (!form) return;
    if (!selected) {
      if (empty) empty.style.display = 'block';
      form.style.display = 'none';
      return;
    }
    if (empty) empty.style.display = 'none';
    form.style.display = 'block';
    $('mlText').value = selected.text;
    $('mlSize').value = selected.size;
    $('mlSizeVal').textContent = selected.size;
    $('mlColor').value = selected.color;
    $('mlStroke').value = selected.stroke;
    $('mlStrokeW').value = selected.strokeW;
    $('mlFont').value = selected.font;
    $('mlAlign').value = selected.align;
    $('mlCaps').checked = !!selected.caps;
  }

  function fromEditor() {
    if (!selected) return;
    selected.text = $('mlText').value;
    selected.size = Number($('mlSize').value);
    selected.color = $('mlColor').value;
    selected.stroke = $('mlStroke').value;
    selected.strokeW = Number($('mlStrokeW').value);
    selected.font = $('mlFont').value;
    selected.align = $('mlAlign').value;
    selected.caps = $('mlCaps').checked;
    $('mlSizeVal').textContent = selected.size;
    render();
  }

  function setStatus(msg) {
    var el = $('mlStatus');
    if (el) el.textContent = msg || '';
  }

  function loadImage(file) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
      setStatus('Need an image file (png / jpg / webp / gif).');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setStatus('Image too large (12MB max).');
      return;
    }
    var url = URL.createObjectURL(file);
    var im = new Image();
    im.onload = function () {
      img = im;
      templateId = '';
      setCanvasSize(im.naturalWidth || im.width, im.naturalHeight || im.height);
      render();
      URL.revokeObjectURL(url);
      setStatus('Loaded ' + canvas.width + 'x' + canvas.height + ' — stays in this browser.');
      showStage();
    };
    im.onerror = function () {
      URL.revokeObjectURL(url);
      setStatus('Could not read that image.');
    };
    im.src = url;
  }

  function showStage() {
    var drop = $('mlDrop');
    var stage = $('mlStage');
    if (drop) drop.style.display = 'none';
    if (stage) stage.style.display = 'block';
  }

  function applyTemplate(id) {
    img = null;
    templateId = id;
    var sizes = {
      square: [900, 900],
      wide: [1200, 675],
      two: [900, 1000],
      three: [800, 1100],
      grid: [900, 900],
      crt: [900, 700],
      brain: [800, 1100]
    };
    var s = sizes[id] || [900, 900];
    setCanvasSize(s[0], s[1]);
    if (id === 'two') {
      texts = [
        layer({ text: 'EXPECTATION', y: 0.08, size: 48 }),
        layer({ text: 'REALITY', y: 0.58, size: 48 })
      ];
    } else if (id === 'three') {
      texts = [
        layer({ text: 'PANEL 1', y: 0.08, size: 40 }),
        layer({ text: 'PANEL 2', y: 0.42, size: 40 }),
        layer({ text: 'PANEL 3', y: 0.75, size: 40 })
      ];
    } else if (id === 'brain') {
      texts = [
        layer({ text: 'SMALL BRAIN', y: 0.12, size: 36 }),
        layer({ text: 'BIGGER', y: 0.37, size: 36 }),
        layer({ text: 'GALAXY', y: 0.62, size: 36 }),
        layer({ text: 'UNIVERSE', y: 0.87, size: 36 })
      ];
    } else if (id === 'grid') {
      texts = [
        layer({ text: 'TL', x: 0.25, y: 0.25, size: 40 }),
        layer({ text: 'TR', x: 0.75, y: 0.25, size: 40 }),
        layer({ text: 'BL', x: 0.25, y: 0.75, size: 40 }),
        layer({ text: 'BR', x: 0.75, y: 0.75, size: 40 })
      ];
    } else if (id === 'crt') {
      texts = [
        layer({ text: 'WAGMI', y: 0.45, size: 72, font: 'vt', color: '#33ff66', stroke: '#003300' }),
        layer({ text: 'OR WHATEVER', y: 0.82, size: 40, font: 'vt', color: '#ffd700', stroke: '#000' })
      ];
    } else {
      texts = defaultTexts();
    }
    selected = texts[0];
    syncEditor();
    render();
    showStage();
    setStatus('Template ready. Add your photo or just type.');
  }

  function addText() {
    var t = layer({ text: 'NEW TEXT', y: 0.5, size: 44 });
    texts.push(t);
    select(t);
    setStatus('Drag the new text on the image.');
  }

  function removeText() {
    if (!selected) return;
    texts = texts.filter(function (t) {
      return t.id !== selected.id;
    });
    selected = texts[0] || null;
    syncEditor();
    render();
  }

  function downloadPng() {
    var keep = selected;
    selected = null;
    render();
    canvas.toBlob(function (blob) {
      selected = keep;
      render();
      if (!blob) {
        setStatus('Export failed.');
        return;
      }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'doswapz-meme-' + Date.now() + '.png';
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
      }, 2000);
      setStatus('Downloaded PNG. Nothing was uploaded.');
    }, 'image/png');
  }

  async function copyPng() {
    if (!navigator.clipboard || !window.ClipboardItem) {
      setStatus('Copy not supported here — use Download.');
      return;
    }
    var keep = selected;
    selected = null;
    render();
    canvas.toBlob(async function (blob) {
      selected = keep;
      render();
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setStatus('Copied image. Paste it anywhere.');
      } catch (e) {
        setStatus('Copy blocked — use Download.');
      }
    }, 'image/png');
  }

  function bindCanvas() {
    function down(ev) {
      ev.preventDefault();
      var p = pointerPos(ev);
      var hit = hitTest(p.x, p.y);
      if (hit) {
        select(hit);
        drag = { id: hit.id, dx: p.x - hit.x * canvas.width, dy: p.y - hit.y * canvas.height };
      } else {
        selected = null;
        syncEditor();
        render();
      }
    }
    function move(ev) {
      if (!drag) return;
      ev.preventDefault();
      var t = texts.filter(function (x) {
        return x.id === drag.id;
      })[0];
      if (!t) return;
      var p = pointerPos(ev);
      t.x = Math.max(0.04, Math.min(0.96, (p.x - drag.dx) / canvas.width));
      t.y = Math.max(0.04, Math.min(0.96, (p.y - drag.dy) / canvas.height));
      render();
    }
    function up() {
      drag = null;
    }
    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
  }

  function bindUi() {
    var file = $('mlFile');
    if (file) {
      file.addEventListener('change', function () {
        if (file.files && file.files[0]) loadImage(file.files[0]);
        file.value = '';
      });
    }
    var drop = $('mlDrop');
    var stage = $('mlStageWrap') || document.body;
    ['dragenter', 'dragover'].forEach(function (ev) {
      stage.addEventListener(ev, function (e) {
        e.preventDefault();
        if (drop) drop.classList.add('hot');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      stage.addEventListener(ev, function (e) {
        e.preventDefault();
        if (drop) drop.classList.remove('hot');
      });
    });
    stage.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadImage(f);
    });
    document.addEventListener('paste', function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image/') === 0) {
          loadImage(items[i].getAsFile());
          e.preventDefault();
          return;
        }
      }
    });

    document.querySelectorAll('[data-template]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyTemplate(btn.getAttribute('data-template'));
      });
    });

    ['mlText', 'mlSize', 'mlColor', 'mlStroke', 'mlStrokeW', 'mlFont', 'mlAlign', 'mlCaps'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', fromEditor);
    });

    if ($('mlAdd')) $('mlAdd').onclick = addText;
    if ($('mlRemove')) $('mlRemove').onclick = removeText;
    if ($('mlDownload')) $('mlDownload').onclick = downloadPng;
    if ($('mlCopy')) $('mlCopy').onclick = copyPng;
    if ($('mlFlipH'))
      $('mlFlipH').onclick = function () {
        flipH = !flipH;
        render();
      };
    if ($('mlFlipV'))
      $('mlFlipV').onclick = function () {
        flipV = !flipV;
        render();
      };
    if ($('mlStamp')) {
      $('mlStamp').checked = stamp;
      $('mlStamp').onchange = function () {
        stamp = $('mlStamp').checked;
        render();
      };
    }
    if ($('mlFilter')) {
      $('mlFilter').onchange = function () {
        filter = $('mlFilter').value;
        render();
      };
    }
    if ($('mlClear'))
      $('mlClear').onclick = function () {
        img = null;
        templateId = '';
        texts = defaultTexts();
        selected = texts[0];
        filter = 'none';
        flipH = flipV = false;
        if ($('mlFilter')) $('mlFilter').value = 'none';
        setCanvasSize(900, 900);
        if ($('mlDrop')) $('mlDrop').style.display = 'flex';
        if ($('mlStage')) $('mlStage').style.display = 'none';
        syncEditor();
        render();
        setStatus('Cleared. Image never left this machine.');
      };
  }

  function init() {
    canvas = $('mlCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    texts = defaultTexts();
    selected = texts[0];
    setCanvasSize(900, 900);
    bindCanvas();
    bindUi();
    syncEditor();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.DOSWAPZ_MEME = { loadImage: loadImage, render: render };
})(typeof window !== 'undefined' ? window : this);
