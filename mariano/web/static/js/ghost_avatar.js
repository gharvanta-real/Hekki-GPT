/**
 * MARIANO Dynamic Reactive Ghost Avatar Engine
 * Real-time state-reactive mascot animation using sliced sprite sheets.
 */

export class GhostAvatarEngine {
  constructor() {
    this.sprites = {
      idle: [
        '/static/assets/ghost/sprites/ghost_frame_01.png',
        '/static/assets/ghost/sprites/ghost_frame_06.png',
        '/static/assets/ghost/sprites/ghost_frame_22.png',
        '/static/assets/ghost/sprites/ghost_frame_26.png',
        '/static/assets/ghost/sprites/ghost_frame_27.png',
        '/static/assets/ghost/sprites/ghost_frame_28.png'
      ],
      thinking: [
        '/static/assets/ghost/sprites/ghost_frame_08.png',
        '/static/assets/ghost/sprites/ghost_frame_09.png',
        '/static/assets/ghost/sprites/ghost_frame_10.png',
        '/static/assets/ghost/sprites/ghost_frame_11.png',
        '/static/assets/ghost/sprites/ghost_frame_12.png',
        '/static/assets/ghost/sprites/ghost_frame_13.png',
        '/static/assets/ghost/sprites/ghost_frame_14.png'
      ],
      coding: [
        '/static/assets/ghost/sprites/ghost_frame_33.png',
        '/static/assets/ghost/sprites/ghost_frame_31.png'
      ],
      success: [
        '/static/assets/ghost/sprites/ghost_frame_20.png',
        '/static/assets/ghost/sprites/ghost_frame_21.png',
        '/static/assets/ghost/sprites/ghost_frame_29.png',
        '/static/assets/ghost/sprites/ghost_frame_30.png'
      ],
      sleeping: [
        '/static/assets/ghost/sprites/ghost_frame_35.png'
      ]
    };

    this.currentState = 'idle';
    this.activeContainers = new Set();
    this.animTimer = null;
    this.frameIndex = 0;
    this.lastActivityTime = Date.now();

    this._initActivityWatcher();
    this._startLoop();
  }

  _initActivityWatcher() {
    if (typeof window === 'undefined') return;
    const resetTimer = () => {
      this.lastActivityTime = Date.now();
      if (this.currentState === 'sleeping') {
        this.setState('idle');
      }
    };

    window.addEventListener('mousemove', resetTimer, { passive: true });
    window.addEventListener('keydown', resetTimer, { passive: true });

    // Check for sleep state every 30s
    setInterval(() => {
      if (Date.now() - this.lastActivityTime > 180000 && this.currentState === 'idle') {
        this.setState('sleeping');
      }
    }, 30000);
  }

  setState(newState) {
    if (!this.sprites[newState]) return;
    if (this.currentState === newState && newState !== 'thinking') return;
    this.currentState = newState;
    this.frameIndex = 0;
    this.updateAllContainers();
  }

  registerContainer(containerEl, size = 34) {
    if (!containerEl) return;
    containerEl.dataset.ghostAvatar = 'true';
    containerEl.style.width = size + 'px';
    containerEl.style.height = size + 'px';
    containerEl.style.display = 'inline-flex';
    containerEl.style.alignItems = 'center';
    containerEl.style.justifyContent = 'center';
    containerEl.style.position = 'relative';

    this.activeContainers.add(containerEl);
    this.renderContainer(containerEl, size);

    // Hover interactive reaction
    containerEl.addEventListener('mouseenter', () => {
      if (this.currentState === 'idle' || this.currentState === 'sleeping') {
        const hoverSprite = '/static/assets/ghost/sprites/ghost_frame_04.png';
        const img = containerEl.querySelector('img.ghost-avatar-img');
        if (img) img.src = hoverSprite;
      }
    });

    containerEl.addEventListener('mouseleave', () => {
      this.renderContainer(containerEl, size);
    });
  }

  renderContainer(containerEl, size = 34) {
    const frameList = this.sprites[this.currentState] || this.sprites.idle;
    const spriteUrl = frameList[this.frameIndex % frameList.length];

    let img = containerEl.querySelector('img.ghost-avatar-img');
    if (!img) {
      img = document.createElement('img');
      img.className = 'ghost-avatar-img ghost-float-anim';
      img.style.cssText = `width:${size}px; height:${size}px; object-fit:contain; pointer-events:none; transition:transform 0.2s ease, opacity 0.15s ease;`;
      containerEl.innerHTML = '';
      containerEl.appendChild(img);
    }
    img.src = spriteUrl;
  }

  updateAllContainers() {
    this.activeContainers.forEach(container => {
      if (document.body.contains(container)) {
        const size = parseInt(container.style.width) || 34;
        this.renderContainer(container, size);
      } else {
        this.activeContainers.delete(container);
      }
    });
  }

  _startLoop() {
    setInterval(() => {
      const frameList = this.sprites[this.currentState] || this.sprites.idle;
      if (frameList.length > 1) {
        this.frameIndex = (this.frameIndex + 1) % frameList.length;
        this.updateAllContainers();
      }
    }, this.currentState === 'thinking' ? 250 : 1800);
  }
}

export const ghostAvatar = new GhostAvatarEngine();
if (typeof window !== 'undefined') {
  window.ghostAvatar = ghostAvatar;
}
