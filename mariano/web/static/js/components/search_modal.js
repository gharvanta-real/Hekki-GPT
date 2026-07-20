/**
 * search_modal.js — Centralized search overlay modal component.
 * Features content search, markdown strip-cleaning, and visual deletion transition.
 */

export class SearchModal {
  constructor(chatSessionManager) {
    this.chatSessionManager = chatSessionManager;
    this.modal = null;
    this.init();
  }

  init() {
    if (document.getElementById('search-history-modal')) return;

    const modalHTML = `
      <div id="search-history-modal" class="modal-overlay hidden">
        <div class="modal-box search-modal-box">
          <div class="modal-header">
            <h3>Search Conversations</h3>
            <button class="icon-btn" id="search-modal-close" title="Close">
              <i data-lucide="x"></i>
            </button>
          </div>
          <div class="modal-body search-modal-body">
            <div class="search-input-wrapper">
              <i data-lucide="search" class="search-input-icon"></i>
              <input type="text" id="search-modal-input" placeholder="Search chats by title or message content..." autocomplete="off">
            </div>
            <div id="search-results-list" class="search-results-container"></div>
          </div>
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = modalHTML.trim();
    this.modal = container.firstChild;
    document.body.appendChild(this.modal);

    this.input = document.getElementById('search-modal-input');
    this.list = document.getElementById('search-results-list');
    this.btnClose = document.getElementById('search-modal-close');
    this.btnOpen = document.getElementById('btn-search-nav');

    this.bindEvents();
  }

  bindEvents() {
    const openModal = () => {
      this.modal.classList.remove('hidden');
      this.input.value = '';
      this.renderSearchResults('');
      setTimeout(() => this.input.focus(), 120);
    };

    const closeModal = () => {
      this.modal.classList.add('hidden');
    };

    if (this.btnOpen) {
      this.btnOpen.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openModal();
      });
    }

    this.btnClose?.addEventListener('click', closeModal);
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) closeModal();
    });

    this.input.addEventListener('input', () => {
      this.renderSearchResults(this.input.value);
    });
  }

  stripMarkdown(str) {
    if (!str) return '';
    return str
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/#+\s+/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
  }

  renderSearchResults(query) {
    const q = query.toLowerCase().trim();
    const chats = this.chatSessionManager.getChats();
    this.list.innerHTML = '';

    const filtered = chats.filter(chat => {
      if (!q) return true;
      if (chat.title.toLowerCase().includes(q)) return true;
      return chat.messages.some(msg => msg.text.toLowerCase().includes(q));
    });

    if (filtered.length === 0) {
      this.list.innerHTML = `
        <div class="search-empty-state">
          <i data-lucide="search-code" class="empty-icon"></i>
          <div>No conversations matching "${this._escapeHtml(query)}" found.</div>
        </div>
      `;
      if (window.lucide) lucide.createIcons({ parent: this.list });
      return;
    }

    filtered.forEach(chat => {
      const item = document.createElement('div');
      item.className = 'search-result-item';

      let preview = '';
      if (chat.messages.length > 0) {
        if (q) {
          const matchMsg = chat.messages.find(m => m.text.toLowerCase().includes(q));
          if (matchMsg) {
            const idx = matchMsg.text.toLowerCase().indexOf(q);
            const start = Math.max(0, idx - 30);
            preview = (start > 0 ? '...' : '') + matchMsg.text.substring(start, start + 75) + (start + 75 < matchMsg.text.length ? '...' : '');
          } else {
            preview = chat.messages[chat.messages.length - 1].text;
          }
        } else {
          preview = chat.messages[chat.messages.length - 1].text;
        }
      } else {
        preview = 'No messages';
      }

      const cleanTitle = this.stripMarkdown(chat.title);
      const cleanPreview = this.stripMarkdown(preview);
      const badgeText = cleanTitle.substring(0, 1).toUpperCase() || 'C';

      item.innerHTML = `
        <div class="search-result-left">
          <div class="search-result-badge">${badgeText}</div>
          <div class="search-result-info">
            <span class="search-result-title">${this._escapeHtml(cleanTitle)}</span>
            <span class="search-result-preview">${this._escapeHtml(cleanPreview)}</span>
          </div>
        </div>
        <button class="search-result-delete-btn" title="Delete immediately">
          <i data-lucide="trash-2"></i>
        </button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.search-result-delete-btn')) return;
        this.chatSessionManager.loadChat(chat.id);
        this.modal.classList.add('hidden');
      });

      const delBtn = item.querySelector('.search-result-delete-btn');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Immediate visual deletion feedback (micro-animation)
        item.style.opacity = '0';
        item.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
          this.chatSessionManager.deleteChat(chat.id);
          this.renderSearchResults(this.input.value);
        }, 150);
      });

      this.list.appendChild(item);
    });

    if (window.lucide) lucide.createIcons({ parent: this.list });
  }

  _escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}
