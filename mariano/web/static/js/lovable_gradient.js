/**
 * Monochromatic Wavy Form Canvas Engine
 * High-performance 60 FPS fluid multi-layered sine wave ribbon animation
 * in sleek, premium monochromatic dark tones (#09090b charcoal, #18181b slate, #27272a zinc, #f4f4f5 silver).
 */
(function() {
  class MonochromaticWaveCanvas {
    constructor(canvasEl, options = {}) {
      this.canvas = typeof canvasEl === 'string' ? document.getElementById(canvasEl) : canvasEl;
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.running = false;
      this.startTime = null;
      this.animId = null;

      // Monochromatic Fluid Wavy Layers Configuration
      this.waves = [
        { amplitude: 22, frequency: 0.007, speed: 0.8, offset: 0.0, color1: 'rgba(24, 24, 27, 0.95)',   color2: 'rgba(9, 9, 11, 0.95)' },
        { amplitude: 28, frequency: 0.005, speed: 0.6, offset: 2.1, color1: 'rgba(39, 39, 42, 0.88)',   color2: 'rgba(15, 15, 18, 0.88)' },
        { amplitude: 18, frequency: 0.011, speed: 1.1, offset: 4.3, color1: 'rgba(63, 63, 70, 0.78)',   color2: 'rgba(24, 24, 27, 0.78)' },
        { amplitude: 32, frequency: 0.004, speed: 0.5, offset: 1.4, color1: 'rgba(113, 113, 122, 0.68)', color2: 'rgba(39, 39, 42, 0.68)' },
        { amplitude: 14, frequency: 0.014, speed: 1.5, offset: 3.5, color1: 'rgba(244, 244, 245, 0.92)', color2: 'rgba(161, 161, 170, 0.35)' }
      ];
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
      if (!this.running || !this.ctx) return;
      if (!this.canvas || !document.body.contains(this.canvas)) {
        this.stop();
        return;
      }

      const rect = this.canvas.getBoundingClientRect();
      const parentRect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : null;
      const w = Math.max(rect.width || (parentRect ? parentRect.width : 360), 100);
      const h = Math.max(rect.height || (parentRect ? parentRect.height : 360), 100);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
        this.canvas.width = Math.floor(w * dpr);
        this.canvas.height = Math.floor(h * dpr);
      }

      const ctx = this.ctx;
      ctx.save();
      ctx.scale(dpr, dpr);

      const now = performance.now();
      const t = (now - (this.startTime || now)) / 1000.0;

      // Dark Monochromatic Void Base Background (#09090b)
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, w, h);

      // Render 5 Multi-Harmonic Wavy Layers
      const centerY = h * 0.50;

      this.waves.forEach((wave, idx) => {
        ctx.beginPath();
        ctx.moveTo(0, h);

        const waveTime = t * wave.speed + wave.offset;
        
        for (let x = 0; x <= w; x += 3) {
          // Organic fluid wave math: combination of primary sine, secondary cosine, and micro-harmonic
          const y = centerY +
            Math.sin(x * wave.frequency + waveTime) * wave.amplitude +
            Math.cos(x * wave.frequency * 0.55 + waveTime * 0.75) * (wave.amplitude * 0.45) +
            Math.sin(x * wave.frequency * 1.85 - waveTime * 1.25) * (wave.amplitude * 0.25);
          
          if (x === 0) {
            ctx.lineTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.lineTo(w, h);
        ctx.closePath();

        // Sleek monochromatic vertical gradient fill for each wave
        const grad = ctx.createLinearGradient(0, centerY - wave.amplitude * 2, 0, h);
        grad.addColorStop(0, wave.color1);
        grad.addColorStop(1, wave.color2);

        ctx.fillStyle = grad;
        ctx.fill();

        // Top edge silver highlight stroke on the foreground wave crest
        if (idx === 4) {
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

      ctx.restore();
      this.animId = requestAnimationFrame(() => this.loop());
    }
  }

  window.LovableGradientCanvas = MonochromaticWaveCanvas;
  window.MonochromaticWaveCanvas = MonochromaticWaveCanvas;
})();
