/* === chat_minimap.js — Interactive Chat Minimap & Quick Jump Dropdown === */

export class ChatMinimapManager {
  constructor(options = {}) {
    this.containerSelector = options.containerSelector || '#chat-log';
    this.paneSelector = options.paneSelector || '#chat-pane';
    this.isDebate = options.isDebate || false;
    
    this.minimapEl = null;
    this.stripEl = null;
    this.dropdownEl = null;
    this.scrollBtn = null;
    this.scrollContainer = null;
    
    this.userMessages = [];
    this.activeTurnIndex = 0;
    this.observer = null;
    this.hoverTimer = null;
    
    this.init();
  }

  init() {
    const parentPane = document.querySelector(this.paneSelector);
    if (!parentPane) return;

    // Check if minimap or center scroll btn already exists in pane
    let existingContainer = parentPane.querySelector('.chat-minimap-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    let existingCenterBtn = parentPane.querySelector('.chat-center-scroll-btn');
    if (existingCenterBtn) {
      existingCenterBtn.remove();
    }

    // Build DOM structure
    this.minimapEl = document.createElement('div');
    this.minimapEl.className = 'chat-minimap-container hidden';
    
    this.minimapEl.innerHTML = `
      <div class="minimap-dropdown-popup" id="minimap-dropdown">
        <div class="minimap-dropdown-list" id="minimap-dropdown-list"></div>
      </div>
      
      <div class="minimap-bar-strip" id="minimap-bar-strip" title="Hover / Click to view quick questions menu"></div>
    `;


    parentPane.appendChild(this.minimapEl);

    // Floating centered scroll-to-bottom arrow button directly above input bar
    this.centerScrollBtn = document.createElement('button');
    this.centerScrollBtn.className = 'chat-center-scroll-btn';
    this.centerScrollBtn.title = 'Jump to latest message';
    this.centerScrollBtn.innerHTML = '<i data-lucide="arrow-down-circle" style="width:24px;height:24px;"></i>';
    if (window.lucide) lucide.createIcons({ parent: this.centerScrollBtn });
    parentPane.appendChild(this.centerScrollBtn);

    this.stripEl = this.minimapEl.querySelector('#minimap-bar-strip');
    this.dropdownEl = this.minimapEl.querySelector('#minimap-dropdown');
    this.scrollBtn = null;


    if (window.lucide) lucide.createIcons();

    this.bindEvents();
    this.refresh();
  }


  bindEvents() {
    // Hover events on strip to show dropdown
    this.stripEl.addEventListener('mouseenter', () => {
      clearTimeout(this.hoverTimer);
      this.openDropdown();
    });

    this.minimapEl.addEventListener('mouseleave', () => {
      this.hoverTimer = setTimeout(() => {
        this.closeDropdown();
      }, 250);
    });

    this.dropdownEl.addEventListener('mouseenter', () => {
      clearTimeout(this.hoverTimer);
    });

    // Toggle on click
    this.stripEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    });

    // Scroll to bottom buttons
    if (this.scrollBtn) {
      this.scrollBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.scrollToBottom();
      });
    }


    if (this.centerScrollBtn) {
      this.centerScrollBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.scrollToBottom();
      });
    }


    // Close dropdown on outside document click
    document.addEventListener('click', (e) => {
      if (this.minimapEl && !this.minimapEl.contains(e.target)) {
        this.closeDropdown();
      }
    });
  }

  findScrollContainer() {
    if (this.isDebate) {
      return document.querySelector('#debate-stream-container') ||
             document.querySelector('.debate-reader-scroll') ||
             document.querySelector('.debate-layout');
    }
    return document.querySelector('#chat-log') || document.querySelector(this.containerSelector);
  }

  refresh() {
    this.scrollContainer = this.findScrollContainer();
    if (!this.scrollContainer) return;

    // Attach scroll listener once
    if (!this.scrollContainer._minimapBound) {
      this.scrollContainer._minimapBound = true;
      this.scrollContainer.addEventListener('scroll', () => this.updateActiveDashOnScroll());
    }

    // Observe message DOM changes
    if (!this.observer) {
      this.observer = new MutationObserver(() => {
        this.updateMessages();
      });
      this.observer.observe(this.scrollContainer, { childList: true, subtree: true });
    }

    this.updateMessages();
  }

  updateMessages() {
    if (!this.scrollContainer) return;

    let nodes = [];
    if (this.isDebate) {
      nodes = Array.from(this.scrollContainer.querySelectorAll('.debate-turn-card, .user-prompt-card'));
    } else {
      nodes = Array.from(this.scrollContainer.querySelectorAll('.msg-group.user, .msg.user'));
      // Filter out child nodes if parent container is already in the list
      nodes = nodes.filter(node => !nodes.some(parent => parent !== node && parent.contains(node)));
    }

    // Filter out invalid/empty nodes
    this.userMessages = nodes.filter(node => {
      const text = node.innerText || node.textContent || '';
      return text.trim().length > 0;
    });

    // Show or hide minimap container based on whether messages exist
    if (this.userMessages.length === 0) {
      this.minimapEl.classList.add('hidden');
      if (this.centerScrollBtn) this.centerScrollBtn.classList.remove('visible');
      return;
    }

    this.minimapEl.classList.remove('hidden');
    this.renderStripsAndDropdown();
    this.updateActiveDashOnScroll();
  }

  renderStripsAndDropdown() {
    this.stripEl.innerHTML = '';
    const listEl = this.minimapEl.querySelector('#minimap-dropdown-list');
    listEl.innerHTML = '';

    this.userMessages.forEach((msgNode, idx) => {
      // Clean up question text for preview
      let rawText = msgNode.innerText || msgNode.textContent || '';
      let cleanText = rawText.replace(/\[Attached Image:[^\]]+\]/g, '')
                             .replace(/\[Attached File:[^\]]+\]/g, '')
                             .replace(/^(\/(?:web|code|pdf|image|debate))/i, '')
                             .replace(/\s+/g, ' ')
                             .trim();

      if (!cleanText) cleanText = `Question #${idx + 1}`;


      // 1. Create Mini Dash Line
      const dash = document.createElement('div');
      dash.className = 'minimap-dash';
      dash.dataset.index = idx;
      dash.title = cleanText;
      
      dash.addEventListener('click', (e) => {
        e.stopPropagation();
        this.scrollToMessage(idx);
      });

      this.stripEl.appendChild(dash);

      // 2. Create Dropdown Item
      const item = document.createElement('div');
      item.className = 'minimap-item';
      item.dataset.index = idx;
      item.textContent = cleanText;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.scrollToMessage(idx);
        this.closeDropdown();
      });

      listEl.appendChild(item);
    });
  }

  updateActiveDashOnScroll() {
    const homeScreen = document.getElementById('home-screen');
    const isOnHomeScreen = homeScreen && !homeScreen.classList.contains('hidden');
    const chatLog = document.getElementById('chat-log');
    const hasMessages = chatLog ? chatLog.children.length > 0 : false;

    if (isOnHomeScreen || !hasMessages || !this.scrollContainer || this.userMessages.length === 0) {
      if (this.centerScrollBtn) this.centerScrollBtn.classList.remove('visible');
      return;
    }

    const containerRect = this.scrollContainer.getBoundingClientRect();
    let currentIdx = 0;
    let minDistance = Infinity;

    this.userMessages.forEach((msgNode, idx) => {
      const rect = msgNode.getBoundingClientRect();
      const distance = Math.abs(rect.top - containerRect.top);
      if (distance < minDistance) {
        minDistance = distance;
        currentIdx = idx;
      }
    });

    this.activeTurnIndex = currentIdx;

    // Update active class on dashes and dropdown items
    const dashes = this.stripEl.querySelectorAll('.minimap-dash');
    dashes.forEach((d, i) => {
      if (i === currentIdx) d.classList.add('active-dash');
      else d.classList.remove('active-dash');
    });

    const items = this.minimapEl.querySelectorAll('.minimap-item');
    items.forEach((item, i) => {
      if (i === currentIdx) item.classList.add('active');
      else item.classList.remove('active');
    });

    // Toggle centered scroll-to-bottom arrow button right above input bar when scrolled up
    const distanceToBottom = this.scrollContainer.scrollHeight - (this.scrollContainer.scrollTop + this.scrollContainer.clientHeight);
    if (!isOnHomeScreen && distanceToBottom > 100 && this.userMessages.length > 0) {
      if (this.centerScrollBtn) this.centerScrollBtn.classList.add('visible');
    } else {
      if (this.centerScrollBtn) this.centerScrollBtn.classList.remove('visible');
    }
  }


  scrollToMessage(index) {
    const targetNode = this.userMessages[index];
    if (!targetNode) return;

    targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Flash highlight animation on target node
    targetNode.classList.remove('minimap-target-highlight');
    void targetNode.offsetWidth; // trigger reflow
    targetNode.classList.add('minimap-target-highlight');

    setTimeout(() => {
      targetNode.classList.remove('minimap-target-highlight');
    }, 1300);
  }

  scrollToBottom() {
    if (!this.scrollContainer) return;
    this.scrollContainer.scrollTo({
      top: this.scrollContainer.scrollHeight,
      behavior: 'smooth'
    });
  }

  openDropdown() {
    if (this.dropdownEl) this.dropdownEl.classList.add('open');
  }

  closeDropdown() {
    if (this.dropdownEl) this.dropdownEl.classList.remove('open');
  }

  toggleDropdown() {
    if (this.dropdownEl) this.dropdownEl.classList.toggle('open');
  }

  destroy() {
    if (this.observer) this.observer.disconnect();
    if (this.minimapEl) this.minimapEl.remove();
  }
}
