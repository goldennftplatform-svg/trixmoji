/** Load and prepare sprites (chroma-key black backgrounds) */

const Assets = {
  xelon: null,
  xelonReady: false,

  load() {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      // Never block the game if image is slow/missing
      setTimeout(finish, 4000);

      const img = new Image();
      img.onload = () => {
        try {
          this.xelon = this.knockoutBlack(img, 28);
          this.xelonReady = true;
        } catch (err) {
          console.warn("XELON process failed", err);
        }
        finish();
      };
      img.onerror = () => {
        console.warn("Failed to load xelon sprite; using fallback draw.");
        finish();
      };
      img.src = "assets/xelon.jpg";
    });
  },

  /** Make near-black pixels transparent so the art sits cleanly on any stage */
  knockoutBlack(img, threshold) {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      // pure / near-black bg
      if (r < threshold && g < threshold && b < threshold) {
        d[i + 3] = 0;
      } else if (r < threshold + 20 && g < threshold + 20 && b < threshold + 20) {
        // soft edge fade
        d[i + 3] = Math.min(d[i + 3], ((r + g + b) / 3 / (threshold + 20)) * 255);
      }
    }
    ctx.putImageData(data, 0, 0);
    return c;
  },
};
