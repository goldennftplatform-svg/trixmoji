/**
 * Phunk export - pixel render + CLASSIFIED stamp overlay for on-chain inscriptions
 */
window.PHUNK_EXPORT = (function () {
 'use strict';

 var EXPORT_SCALE = 12;
 var STAMP_SITE = 'doswapz.com';

 function drawClassifiedStamp(ctx, width, height, scale) {
 scale = scale || EXPORT_SCALE;
 var pad = Math.max(6, scale * 0.5);

 ctx.save();

 ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
 ctx.fillRect(0, 0, width, height);

 ctx.translate(width * 0.5, height * 0.46);
 ctx.rotate(-0.32);

 var fontSize = Math.round(scale * 4.2);
 ctx.font = 'bold ' + fontSize + 'px VT323, Consolas, monospace';
 ctx.textAlign = 'center';
 ctx.textBaseline = 'middle';
 ctx.lineWidth = Math.max(2, scale * 0.22);
 ctx.strokeStyle = 'rgba(220, 20, 20, 0.92)';
 ctx.fillStyle = 'rgba(180, 0, 0, 0.58)';
 ctx.strokeText('CLASSIFIED', 0, 0);
 ctx.fillText('CLASSIFIED', 0, 0);

 ctx.rotate(0.32);
 ctx.translate(-width * 0.5, -height * 0.46);

 var siteSize = Math.max(11, Math.round(scale * 1.15));
 ctx.font = siteSize + 'px VT323, Consolas, monospace';
 ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
 ctx.textAlign = 'center';
 ctx.textBaseline = 'bottom';
 ctx.fillText(STAMP_SITE, width * 0.5, height - pad);

 ctx.strokeStyle = 'rgba(220, 20, 20, 0.45)';
 ctx.lineWidth = Math.max(2, scale * 0.18);
 ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);

 ctx.restore();
 }

 function renderPixels(pixelAtFn, size, options) {
 options = options || {};
 var scale = options.scale != null ? options.scale : EXPORT_SCALE;
 var stamped = options.stamped === true;

 var out = document.createElement('canvas');
 out.width = size * scale;
 out.height = size * scale;
 var octx = out.getContext('2d');
 octx.imageSmoothingEnabled = false;

 for (var y = 0; y < size; y++) {
 for (var x = 0; x < size; x++) {
 var c = pixelAtFn(x, y);
 if (c) {
 octx.fillStyle = c;
 octx.fillRect(x * scale, y * scale, scale, scale);
 }
 }
 }

 if (stamped) drawClassifiedStamp(octx, out.width, out.height, scale);
 return out;
 }

 function toPngDataUrl(canvas) {
 return canvas.toDataURL('image/png');
 }

 function toPngBase64(canvas) {
 var url = toPngDataUrl(canvas);
 var idx = url.indexOf(',');
 return idx >= 0 ? url.slice(idx + 1) : '';
 }

 return {
 EXPORT_SCALE: EXPORT_SCALE,
 STAMP_SITE: STAMP_SITE,
 drawClassifiedStamp: drawClassifiedStamp,
 renderPixels: renderPixels,
 toPngDataUrl: toPngDataUrl,
 toPngBase64: toPngBase64
 };
})();