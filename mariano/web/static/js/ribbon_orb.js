/**
 * MARIANO 3D Hekki Logo Animator
 * High-performance 60 FPS cross-faded 3D animation engine using Hekki Logo frames
 * extracted from 'Single image for multple animation frame.png'.
 * Stable position, zero background glow, clean transparent 3D logo morphing animation.
 */
(function() {
  const FRAME_PATHS = [
    '/static/assets/logo_anim/frame_1.png',
    '/static/assets/logo_anim/frame_2.png',
    '/static/assets/logo_anim/frame_3.png',
    '/static/assets/logo_anim/frame_4.png',
    '/static/assets/logo_anim/frame_5.png'
  ];

  const loadedImages = [];
  let isPreloading = false;

  function preloadFrames(callback) {
    if (loadedImages.length === FRAME_PATHS.length) {
      if (callback) callback();
      return;
    }
    if (isPreloading) {
      const checkInterval = setInterval(() => {
        if (loadedImages.length === FRAME_PATHS.length) {
          clearInterval(checkInterval);
          if (callback) callback();
        }
      }, 50);
      return;
    }
    isPreloading = true;
    let loadedCount = 0;
    FRAME_PATHS.forEach((path, idx) => {
      const img = new Image();
      img.src = path;
      img.onload = () => {
        loadedImages[idx] = img;
        loadedCount++;
        if (loadedCount === FRAME_PATHS.length) {
          isPreloading = false;
          if (callback) callback();
        }
      };
      img.onerror = (e) => {
        console.warn('[HekkiLogoOrb] Failed to load frame:', path, e);
      };
    });
  }

  // Preload logo animation frames on script load
  preloadFrames();

  class HekkiLogoOrb {
    constructor(canvasEl) {
      this.canvas = typeof canvasEl === 'string' ? document.getElementById(canvasEl) : canvasEl;
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.running = false;
      this.startTime = null;
      this.animId = null;
      this.res = 128; // High DPI resolution for crisp rendering
    }

    start() {
      if (this.running || !this.ctx) return;
      this.running = true;
      this.startTime = performance.now();

      if (loadedImages.length < FRAME_PATHS.length) {
        preloadFrames(() => {
          if (this.running) this.loop();
        });
      } else {
        this.loop();
      }
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

      const res = this.res;
      if (this.canvas.width !== res) this.canvas.width = res;
      if (this.canvas.height !== res) this.canvas.height = res;

      const ctx = this.ctx;
      ctx.clearRect(0, 0, res, res);

      const now = performance.now();
      const t = (now - (this.startTime || now)) / 1000.0;

      // Smooth 60 FPS cross-fading frame morphing (position perfectly stable, zero glow, clean transparent background)
      if (loadedImages.length === 5) {
        const frameSpeed = 3.2; // Frames per second
        const pos = (t * frameSpeed) % 5;
        const idx1 = Math.floor(pos) % 5;
        const idx2 = (idx1 + 1) % 5;
        const blend = pos - Math.floor(pos);

        const img1 = loadedImages[idx1];
        const img2 = loadedImages[idx2];

        const padding = 0;
        const drawSize = res - (padding * 2);

        if (img1 && img1.complete) {
          ctx.globalAlpha = 1.0 - blend;
          ctx.drawImage(img1, padding, padding, drawSize, drawSize);
        }
        if (img2 && img2.complete) {
          ctx.globalAlpha = blend;
          ctx.drawImage(img2, padding, padding, drawSize, drawSize);
        }
        ctx.globalAlpha = 1.0;
      }

      this.animId = requestAnimationFrame(() => this.loop());
    }
  }

  window.HekkiLogoOrb = HekkiLogoOrb;
  window.RibbonGradientOrb = HekkiLogoOrb;
})();
