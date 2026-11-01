/**
 * DOSWAPZ Phunk Lab - base head (locked) + user paint layer on top
 * Optional Ethereum inscription with CLASSIFIED stamp on final export
 */
(function () {
 const SIZE = 24;
 const SCALE = 18;
 const STORAGE_KEY = 'doswapz_phunk_gate';

 const PALETTE = [
 '#000000', '#ffffff', '#638596', '#e8b090', '#c68642', '#8d5524',
 '#1a1a1a', '#4a3020', '#c45c6e', '#e53935', '#e60000', '#ff6600',
 '#ffcc00', '#33cc33', '#0066cc', '#9933ff', '#ff66cc', '#00ffff',
 '#888888', '#2a2a2a', '#f0d0b0', '#5c4033', '#00ff41', '#9944ff'
 ];

 let baseHead = [];
 let userLayer = [];
 let selectedGender = null;
 let currentColor = '#e8b090';
 let tool = 'pencil';
 let drawing = false;
 let showGrid = true;
 let lastInscribed = false;
 let gasEstimateTimer = null;

 const genderScreen = document.getElementById('genderScreen');
 const paintScreen = document.getElementById('paintScreen');
 const canvas = document.getElementById('phunkCanvas');
 const gridCanvas = document.getElementById('phunkGrid');
 const preview = document.getElementById('phunkPreview');
 const toolStatus = document.getElementById('toolStatus');
 const colorPicker = document.getElementById('colorPicker');
 const stampSample = document.getElementById('phunkStampSample');

 if (!canvas || !window.PHUNK_BASES) return;

 const ctx = canvas.getContext('2d');
 const gridCtx = gridCanvas.getContext('2d');
 const previewCtx = preview.getContext('2d');

 function basementUrl() {
 if (window.DOSWAPZ_ERA && typeof DOSWAPZ_ERA.isOrbit === 'function' && DOSWAPZ_ERA.isOrbit()) {
 return '/orbit/pages/basement.html';
 }
 if (location.pathname.indexOf('/orbit/') >= 0) {
 return '/orbit/pages/basement.html';
 }
 return '/classic/pages/basement.html';
 }

 function gateCheck() {
 if (sessionStorage.getItem(STORAGE_KEY) === 'unlocked') return true;
 window.location.replace(basementUrl());
 return false;
 }

 if (!gateCheck()) return;

 function emptyUserLayer() {
 userLayer = [];
 for (let y = 0; y < SIZE; y++) {
 userLayer[y] = [];
 for (let x = 0; x < SIZE; x++) {
 userLayer[y][x] = null;
 }
 }
 }

 function pixelAt(x, y) {
 const u = userLayer[y][x];
 if (u !== null && u !== undefined) return u;
 return baseHead[y][x];
 }

 function buildStampedExport() {
 if (!window.PHUNK_EXPORT) return null;
 return PHUNK_EXPORT.renderPixels(pixelAt, SIZE, { stamped: true });
 }

 function buildPlainExport() {
 if (window.PHUNK_EXPORT) {
 return PHUNK_EXPORT.renderPixels(pixelAt, SIZE, { stamped: false, scale: 1 });
 }
 const out = document.createElement('canvas');
 out.width = SIZE;
 out.height = SIZE;
 const octx = out.getContext('2d');
 for (let y = 0; y < SIZE; y++) {
 for (let x = 0; x < SIZE; x++) {
 const c = pixelAt(x, y);
 if (c) {
 octx.fillStyle = c;
 octx.fillRect(x, y, 1, 1);
 }
 }
 }
 return out;
 }

 function scheduleGasEstimate() {
 if (!window.PHUNK_INSCRIBE || !PHUNK_INSCRIBE.isConnected() || !window.PHUNK_EXPORT) return;
 if (gasEstimateTimer) clearTimeout(gasEstimateTimer);
 gasEstimateTimer = setTimeout(function () {
 const stamped = buildStampedExport();
 if (!stamped) return;
 PHUNK_INSCRIBE.refreshGasEstimate(PHUNK_EXPORT.toPngBase64(stamped));
 }, 900);
 }

 function refreshStampSample() {
 if (!stampSample || !window.PHUNK_EXPORT) return;
 const stamped = buildStampedExport();
 if (!stamped) return;
 stampSample.width = stamped.width;
 stampSample.height = stamped.height;
 const sctx = stampSample.getContext('2d');
 sctx.clearRect(0, 0, stampSample.width, stampSample.height);
 sctx.drawImage(stamped, 0, 0, stampSample.width, stampSample.height);
 }

 function setColor(color) {
 if (!color) return;
 currentColor = color.toLowerCase();
 if (colorPicker) colorPicker.value = currentColor;
 const prev = document.getElementById('colorPreview');
 if (prev) prev.style.background = currentColor;
 document.querySelectorAll('.swatch').forEach(function (el) {
 el.classList.toggle('active', (el.dataset.color || '').toLowerCase() === currentColor);
 });
 }

 function drawAll() {
 scheduleGasEstimate();
 ctx.clearRect(0, 0, canvas.width, canvas.height);
 for (let y = 0; y < SIZE; y++) {
 for (let x = 0; x < SIZE; x++) {
 const c = pixelAt(x, y);
 if (c) {
 ctx.fillStyle = c;
 ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
 }
 }
 }

 gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
 if (showGrid) {
 gridCtx.strokeStyle = 'rgba(153, 68, 255, 0.2)';
 gridCtx.lineWidth = 1;
 for (let i = 0; i <= SIZE; i++) {
 const p = i * SCALE + 0.5;
 gridCtx.beginPath();
 gridCtx.moveTo(p, 0);
 gridCtx.lineTo(p, canvas.height);
 gridCtx.stroke();
 gridCtx.beginPath();
 gridCtx.moveTo(0, p);
 gridCtx.lineTo(canvas.width, p);
 gridCtx.stroke();
 }
 }

 previewCtx.clearRect(0, 0, preview.width, preview.height);
 if (lastInscribed && window.PHUNK_EXPORT) {
 const stamped = buildStampedExport();
 previewCtx.drawImage(stamped, 0, 0, preview.width, preview.height);
 preview.classList.add('stamped-live');
 } else {
 previewCtx.drawImage(canvas, 0, 0, preview.width, preview.height);
 preview.classList.remove('stamped-live');
 }
 }

 function cellFromEvent(e) {
 const rect = canvas.getBoundingClientRect();
 if (!rect.width || !rect.height) return null;
 // Map CSS pixels -> canvas buffer pixels, then -> 24×24 cell.
 // Fixes misaligned paint when the canvas is CSS-scaled (zoom, max-width, DPR).
 const px = (e.clientX - rect.left) * (canvas.width / rect.width);
 const py = (e.clientY - rect.top) * (canvas.height / rect.height);
 const x = Math.floor(px / SCALE);
 const y = Math.floor(py / SCALE);
 if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return null;
 return { x: x, y: y };
 }

 function updateHoverCell(cell) {
 const hover = document.getElementById('phunkHover');
 if (!hover || !canvas) return;
 if (!cell) {
 hover.style.display = 'none';
 return;
 }
 const rect = canvas.getBoundingClientRect();
 const cellCss = rect.width / SIZE;
 hover.style.display = 'block';
 hover.style.width = cellCss + 'px';
 hover.style.height = cellCss + 'px';
 hover.style.left = (cell.x * cellCss) + 'px';
 hover.style.top = (cell.y * cellCss) + 'px';
 }

 function floodFill(sx, sy, fillColor) {
 const target = pixelAt(sx, sy);
 if (target === fillColor) return;
 const stack = [[sx, sy]];
 const seen = new Set();
 while (stack.length) {
 const pair = stack.pop();
 const x = pair[0];
 const y = pair[1];
 const key = x + ',' + y;
 if (seen.has(key)) continue;
 seen.add(key);
 if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) continue;
 if (pixelAt(x, y) !== target) continue;
 userLayer[y][x] = fillColor;
 stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
 }
 }

 function applyTool(x, y) {
 if (tool === 'pencil') {
 userLayer[y][x] = currentColor;
 } else if (tool === 'eraser') {
 userLayer[y][x] = null;
 } else if (tool === 'fill') {
 floodFill(x, y, currentColor);
 } else if (tool === 'picker') {
 const picked = pixelAt(x, y);
 if (picked) {
 setColor(picked);
 setTool('pencil');
 }
 return;
 }
 lastInscribed = false;
 drawAll();
 refreshStampSample();
 }

 function setTool(t) {
 tool = t;
 const labels = { pencil: 'PENCIL', eraser: 'ERASER', fill: 'FILL', picker: 'EYEDROPPER' };
 if (toolStatus) toolStatus.textContent = 'TOOL: ' + (labels[t] || t.toUpperCase());
 document.querySelectorAll('.tool-btn').forEach(function (btn) {
 btn.classList.toggle('active', btn.dataset.tool === t);
 });
 canvas.style.cursor = t === 'picker' ? 'copy' : t === 'fill' ? 'cell' : 'crosshair';
 }

 function buildPalette() {
 const wrap = document.getElementById('palette');
 if (!wrap) return;
 wrap.innerHTML = '';
 PALETTE.forEach(function (color) {
 const sw = document.createElement('button');
 sw.type = 'button';
 sw.className = 'swatch';
 sw.dataset.color = color;
 sw.style.background = color;
 sw.title = color;
 sw.addEventListener('click', function () { setColor(color); });
 wrap.appendChild(sw);
 });
 setColor(currentColor);
 }

 async function startPaint(gender) {
 const url = gender === 'female' ? PHUNK_BASES.FEMALE_URL : PHUNK_BASES.MALE_URL;
 const hint = document.getElementById('genderHint');
 if (hint) hint.textContent = 'Loading base head...';

 try {
 baseHead = await PHUNK_BASES.loadGrid(url);
 selectedGender = gender;
 emptyUserLayer();
 lastInscribed = false;
 } catch (err) {
 if (hint) hint.textContent = 'Failed to load base head. Refresh and try again.';
 return;
 }

 if (hint) {
 hint.innerHTML =
 (gender === 'female' ? 'FEMALE' : 'MALE') + ' base head loaded.<br>' +
 'Add hair, hats, shades - whatever you want on top.<br>' +
 'Eraser only removes <em>your</em> pixels (base head stays).<br>' +
 'Inscribe on Ethereum = CLASSIFIED stamp locked on final image.';
 }

 genderScreen.style.display = 'none';
 paintScreen.style.display = 'block';
 buildPalette();
 setTool('pencil');
 drawAll();
 refreshStampSample();
 }

 document.getElementById('btnMale')?.addEventListener('click', function () { startPaint('male'); });
 document.getElementById('btnFemale')?.addEventListener('click', function () { startPaint('female'); });

 canvas.addEventListener('mousedown', function (e) {
 e.preventDefault();
 const cell = cellFromEvent(e);
 updateHoverCell(cell);
 if (!cell) return;
 if (tool === 'picker' || tool === 'fill') {
 applyTool(cell.x, cell.y);
 return;
 }
 drawing = true;
 applyTool(cell.x, cell.y);
 });

 canvas.addEventListener('mousemove', function (e) {
 const cell = cellFromEvent(e);
 updateHoverCell(cell);
 if (!drawing || tool === 'fill' || tool === 'picker') return;
 if (cell) applyTool(cell.x, cell.y);
 });

 canvas.addEventListener('mouseleave', function () {
 updateHoverCell(null);
 });

 window.addEventListener('mouseup', function () { drawing = false; });

 window.addEventListener('resize', function () {
 updateHoverCell(null);
 });

 document.querySelectorAll('.tool-btn').forEach(function (btn) {
 btn.addEventListener('click', function () { setTool(btn.dataset.tool); });
 });

 colorPicker?.addEventListener('input', function (e) { setColor(e.target.value); });

 document.getElementById('btnReset')?.addEventListener('click', function () {
 emptyUserLayer();
 lastInscribed = false;
 drawAll();
 refreshStampSample();
 });

 document.getElementById('btnGrid')?.addEventListener('click', function () {
 showGrid = !showGrid;
 drawAll();
 });

 document.getElementById('btnDownload')?.addEventListener('click', function () {
 const out = buildPlainExport();
 const a = document.createElement('a');
 const g = selectedGender || 'phunk';
 a.download = 'doswapz-' + g + '-phunk-' + Date.now() + '.png';
 a.href = out.toDataURL('image/png');
 a.click();
 });

 document.getElementById('btnDownloadStamped')?.addEventListener('click', function () {
 if (!window.PHUNK_EXPORT) return;
 const out = buildStampedExport();
 const a = document.createElement('a');
 const g = selectedGender || 'phunk';
 a.download = 'doswapz-' + g + '-phunk-classified-' + Date.now() + '.png';
 a.href = PHUNK_EXPORT.toPngDataUrl(out);
 a.click();
 });

 document.getElementById('btnInscribe')?.addEventListener('click', async function () {
 if (!window.PHUNK_INSCRIBE || !window.PHUNK_EXPORT) {
 PHUNK_INSCRIBE && PHUNK_INSCRIBE.setStatus('Inscription module not loaded.', '#ff5555');
 return;
 }
 if (!PHUNK_INSCRIBE.isConnected()) {
 const ok = await PHUNK_INSCRIBE.connect();
 if (!ok) return;
 }
 const stamped = buildStampedExport();
 const b64 = PHUNK_EXPORT.toPngBase64(stamped);
 const result = await PHUNK_INSCRIBE.inscribeStampedPng(b64, {
 gender: selectedGender,
 size: SIZE
 });
 if (result) {
 lastInscribed = true;
 drawAll();
 refreshStampSample();
 }
 });

 if (window.PHUNK_INSCRIBE) {
 PHUNK_INSCRIBE.bindUi();
 }

 if (stampSample) {
 refreshStampSample();
 }
})();