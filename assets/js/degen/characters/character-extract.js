/* Strip JPG matte/checkerboard - keep only pixels near body colors */
window.KOL_FIGHTER_CHAR_EXTRACT = (function () {
 'use strict';

 const work = document.createElement('canvas');
 const wctx = work.getContext('2d');
 const MAX_DIST = 28;

 function isSaturated(r, g, b) {
 return Math.max(r, g, b) - Math.min(r, g, b) > 28 || (r + g + b) / 3 < 200;
 }

 function isEdgeBg(r, g, b) {
 const spread = Math.max(r, g, b) - Math.min(r, g, b);
 const avg = (r + g + b) / 3;
 if (spread < 35 && avg >= 185) return true;
 if (spread < 15 && avg >= 115 && avg < 185) return true;
 return false;
 }

 function isMatteBg(r, g, b) {
 return isEdgeBg(r, g, b) && (r + g + b) / 3 < 245;
 }

 function floodEdges(px, w, h) {
 const seen = new Uint8Array(w * h);
 const queue = [];
 function push(x, y) {
 if (x < 0 || y < 0 || x >= w || y >= h) return;
 const idx = y * w + x;
 if (seen[idx]) return;
 const i = idx * 4;
 if (!isEdgeBg(px[i], px[i + 1], px[i + 2])) return;
 seen[idx] = 1;
 queue.push(idx);
 }
 for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
 for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
 while (queue.length) {
 const idx = queue.pop();
 px[idx * 4 + 3] = 0;
 const x = idx % w;
 const y = (idx - x) / w;
 push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
 }
 }

 function stylizeDegenHoodie(canvas) {
 const ctx = canvas.getContext('2d');
 const w = canvas.width;
 const h = canvas.height;
 const d = ctx.getImageData(0, 0, w, h);
 const px = d.data;
 const white = [252, 252, 248];
 const jean = [62, 92, 172];
 const jeanHi = [88, 118, 198];
 const jeanLo = [38, 58, 128];
 const belt = [42, 30, 22];
 const buckle = [210, 170, 65];
 const shoe = [22, 22, 28];
 const sole = [228, 228, 222];

 for (let y = 0; y < h; y++) {
 const ry = y / h;
 for (let x = 0; x < w; x++) {
 const i = (y * w + x) * 4;
 if (px[i + 3] < 128) continue;
 const r = px[i], g = px[i + 1], b = px[i + 2];
 const avg = (r + g + b) / 3;

 if (ry >= 0.87) {
 const c = ry >= 0.945 ? sole : shoe;
 px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
 continue;
 }
 if (ry >= 0.56 && ry < 0.62) {
 const c = (x / w > 0.48 && x / w < 0.58) ? buckle : belt;
 px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
 continue;
 }
 if (ry >= 0.62 && ry < 0.87) {
 const c = avg < 55 ? jeanLo : (avg > 140 ? jeanHi : jean);
 px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
 continue;
 }
 if (r > 150 && r < 250 && r > g && g > b) continue;
 if (avg < 72) continue;
 if (ry < 0.78) {
 px[i] = white[0]; px[i + 1] = white[1]; px[i + 2] = white[2];
 }
 }
 }
 ctx.putImageData(d, 0, 0);
 return canvas;
 }

 function fromCanvasInner(srcCanvas, skipMatte) {
 const w = srcCanvas.width;
 const h = srcCanvas.height;
 work.width = w;
 work.height = h;
 wctx.clearRect(0, 0, w, h);
 wctx.drawImage(srcCanvas, 0, 0);
 const src = wctx.getImageData(0, 0, w, h);
 const px = src.data;
 floodEdges(px, w, h);

 const dist = new Int32Array(w * h);
 dist.fill(1e9);
 const queue = [];

 for (let y = 0; y < h; y++) {
 for (let x = 0; x < w; x++) {
 const idx = y * w + x;
 const i = idx * 4;
 if (px[i + 3] < 128) continue;
 if (isSaturated(px[i], px[i + 1], px[i + 2])) {
 dist[idx] = 0;
 queue.push(idx);
 }
 }
 }

 for (let qi = 0; qi < queue.length; qi++) {
 const idx = queue[qi];
 const d = dist[idx];
 const x = idx % w;
 const y = (idx - x) / w;
 if (x > 0) {
 const ni = idx - 1;
 if (px[ni * 4 + 3] > 20 && dist[ni] > d + 1) { dist[ni] = d + 1; queue.push(ni); }
 }
 if (x < w - 1) {
 const ni = idx + 1;
 if (px[ni * 4 + 3] > 20 && dist[ni] > d + 1) { dist[ni] = d + 1; queue.push(ni); }
 }
 if (y > 0) {
 const ni = idx - w;
 if (px[ni * 4 + 3] > 20 && dist[ni] > d + 1) { dist[ni] = d + 1; queue.push(ni); }
 }
 if (y < h - 1) {
 const ni = idx + w;
 if (px[ni * 4 + 3] > 20 && dist[ni] > d + 1) { dist[ni] = d + 1; queue.push(ni); }
 }
 }

 const out = document.createElement('canvas');
 out.width = w;
 out.height = h;
 const outData = wctx.createImageData(w, h);
 const opx = outData.data;
 for (let idx = 0; idx < w * h; idx++) {
 const i = idx * 4;
 const matte = !skipMatte && isMatteBg(px[i], px[i + 1], px[i + 2]);
 if (dist[idx] > MAX_DIST || px[i + 3] < 20 || matte) {
 opx[i + 3] = 0;
 continue;
 }
 opx[i] = px[i];
 opx[i + 1] = px[i + 1];
 opx[i + 2] = px[i + 2];
 opx[i + 3] = 255;
 }
 out.getContext('2d').putImageData(outData, 0, 0);
 return out;
 }

 function fromImage(img) {
 work.width = img.naturalWidth || img.width;
 work.height = img.naturalHeight || img.height;
 wctx.clearRect(0, 0, work.width, work.height);
 wctx.drawImage(img, 0, 0);
 return fromCanvas(work);
 }

 function fromImageDegen(img) {
 work.width = img.naturalWidth || img.width;
 work.height = img.naturalHeight || img.height;
 wctx.clearRect(0, 0, work.width, work.height);
 wctx.drawImage(img, 0, 0);
 return fromCanvasInner(work, true);
 }

 function fromCanvas(srcCanvas) {
 return fromCanvasInner(srcCanvas, false);
 }

 function tightBounds(canvas) {
 const ctx = canvas.getContext('2d');
 const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
 let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
 for (let y = 0; y < canvas.height; y++) {
 for (let x = 0; x < canvas.width; x++) {
 if (d[(y * canvas.width + x) * 4 + 3] > 20) {
 minX = Math.min(minX, x);
 minY = Math.min(minY, y);
 maxX = Math.max(maxX, x);
 maxY = Math.max(maxY, y);
 }
 }
 }
 if (maxX < minX || maxY < minY) {
 return { minX: 0, minY: 0, cw: canvas.width, ch: canvas.height };
 }
 return { minX, minY, cw: maxX - minX + 1, ch: maxY - minY + 1 };
 }

 function toSprite(cut, targetH) {
 const b = tightBounds(cut);
 if (b.ch < 1) return cut;
 const scale = targetH / b.ch;
 const dw = Math.max(1, Math.round(b.cw * scale));
 const dh = Math.max(1, Math.round(b.ch * scale));
 const c = document.createElement('canvas');
 c.width = dw;
 c.height = dh;
 const ctx = c.getContext('2d');
 ctx.imageSmoothingEnabled = false;
 ctx.drawImage(cut, b.minX, b.minY, b.cw, b.ch, 0, 0, dw, dh);
 return c;
 }

 return { fromImage, fromImageDegen, fromCanvas, toSprite, tightBounds, isSaturated, MAX_DIST };
})();