/**
 * 21st.dev Liquid Mesh Gradient Shader (Lighter Soft Blue Adjustment)
 * Top-Left Soft White Glow -> Light Sky Blue (#82C2FF) -> Soft Periwinkle (#6E80FF) -> Soft Ultramarine (#6855FF)
 * Zero dark blue saturation. Soft, dreamy, bright liquid waves with fine film grain.
 */
(function() {
  class RibbonGradientOrb {
    constructor(canvasEl) {
      this.canvas = typeof canvasEl === 'string' ? document.getElementById(canvasEl) : canvasEl;
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.running = false;
      this.startTime = null;
      this.animId = null;

      // Internal resolution
      this.res = 64;

      // Pre-generate analog film grain table
      this.grainTable = new Float32Array(this.res * this.res);
      for (let i = 0; i < this.grainTable.length; i++) {
        this.grainTable[i] = (Math.random() - 0.5) * 9.0;
      }
    }

    start() {
      if (this.running || !this.ctx) return;
      this.running = true;
      this.startTime = performance.now();
      this.loop();
    }

    stop() {
      this.running = false;
      if (this.animId) cancelAnimationFrame(this.animId);
    }

    loop() {
      if (!this.running) return;

      if (this.canvas.width !== this.res) this.canvas.width = this.res;
      if (this.canvas.height !== this.res) this.canvas.height = this.res;

      const now = performance.now();
      const t = (now - this.startTime) / 1000.0;
      const waveClock = t * 0.9;

      const res = this.res;
      const ctx = this.ctx;
      const imgData = ctx.createImageData(res, res);
      const data = imgData.data;

      for (let py = 0; py < res; py++) {
        const ny = (py / (res - 1)) * 2 - 1; // -1 to +1
        for (let px = 0; px < res; px++) {
          const nx = (px / (res - 1)) * 2 - 1; // -1 to +1

          const idx = (py * res + px) * 4;

          // Circular boundary clip
          const distSq = nx * nx + ny * ny;
          if (distSq > 1.0) {
            data[idx + 3] = 0; // Transparent background
            continue;
          }

          // Top-Left radial distance origin (-1.25, -1.25)
          const dx = nx + 1.25;
          const dy = ny + 1.25;
          const distTL = Math.sqrt(dx * dx + dy * dy) / 2.8;

          // Dreamy liquid wave offsets
          const wave1 = Math.sin(nx * 2.2 + ny * 1.8 + waveClock) * 0.10;
          const wave2 = Math.cos(nx * 1.5 - ny * 2.1 + waveClock * 0.7) * 0.08;

          let val = distTL + wave1 + wave2;
          val = Math.max(0.0, Math.min(1.0, val));

          // Lighter Palette Interpolation (White -> Lighter Sky Blue -> Soft Periwinkle -> Soft Ultramarine)
          let r, g, b;
          if (val < 0.40) {
            // Soft White (#FFFFFF) to Lighter Sky Blue (#82C2FF)
            const f = val / 0.40;
            const sf = f * f * (3.0 - 2.0 * f);
            r = 255 + (130 - 255) * sf;
            g = 255 + (194 - 255) * sf;
            b = 255 + (255 - 255) * sf;
          } else if (val < 0.72) {
            // Lighter Sky Blue (#82C2FF) to Soft Periwinkle (#6E80FF)
            const f = (val - 0.40) / 0.32;
            const sf = f * f * (3.0 - 2.0 * f);
            r = 130 + (110 - 130) * sf;
            g = 194 + (128 - 194) * sf;
            b = 255 + (255 - 255) * sf;
          } else {
            // Soft Periwinkle (#6E80FF) to Soft Ultramarine (#6855FF)
            const f = (val - 0.72) / 0.28;
            const sf = f * f * (3.0 - 2.0 * f);
            r = 110 + (104 - 110) * sf;
            g = 128 + (85 - 128) * sf;
            b = 255 + (255 - 255) * sf;
          }

          // Subtle Film Grain Overlay
          const grain = this.grainTable[py * res + px];
          r = Math.max(0, Math.min(255, r + grain));
          g = Math.max(0, Math.min(255, g + grain));
          b = Math.max(0, Math.min(255, b + grain));

          data[idx]     = r | 0;
          data[idx + 1] = g | 0;
          data[idx + 2] = b | 0;

          // Crisp circular edge antialiasing
          const alpha = distSq > 0.88 ? Math.max(0, 1.0 - (distSq - 0.88) / 0.12) : 1.0;
          data[idx + 3] = (alpha * 255) | 0;
        }
      }

      ctx.putImageData(imgData, 0, 0);

      this.animId = requestAnimationFrame(() => this.loop());
    }
  }

  window.RibbonGradientOrb = RibbonGradientOrb;
})();
