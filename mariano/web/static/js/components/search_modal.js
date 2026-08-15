/**
 * search_modal.js — Centralized search overlay modal component.
 * Features content search, markdown strip-cleaning, and visual deletion transition.
 */

import { router } from '/static/js/router.js';

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
          <div class="modal-header search-header-container">
            <div class="search-title-view">
              <h3>Search Conversations</h3>
            </div>
            <div class="search-input-view">
              <button class="icon-btn" id="search-input-back" title="Back to title">
                <i data-lucide="arrow-left"></i>
              </button>
              <div class="search-field-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" class="search-field-icon"><path d="M29,27.5859l-7.5521-7.5521a11.0177,11.0177,0,1,0-1.4141,1.4141L27.5859,29ZM4,13a9,9,0,1,1,9,9A9.01,9.01,0,0,1,4,13Z"/></svg>
                <input type="text" id="search-modal-input" placeholder="Search chats by title or messages..." autocomplete="off">
                <button class="icon-btn" id="search-input-clear" title="Clear text">
                  <i data-lucide="x"></i>
                </button>
              </div>
            </div>
            <div class="search-actions-view">
              <button class="icon-btn" id="search-trigger-btn" title="Open search">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor"><path d="M29,27.5859l-7.5521-7.5521a11.0177,11.0177,0,1,0-1.4141,1.4141L27.5859,29ZM4,13a9,9,0,1,1,9,9A9.01,9.01,0,0,1,4,13Z"/></svg>
              </button>
              <button class="icon-btn" id="search-modal-close" title="Close modal">
                <i data-lucide="x"></i>
              </button>
            </div>
          </div>
          <div class="modal-body search-modal-body">
            <div id="search-results-list" class="search-results-container"></div>
          </div>
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = modalHTML.trim();
    this.modal = container.firstChild;
    document.body.appendChild(this.modal);

    this.headerContainer = this.modal.querySelector('.search-header-container');
    this.input = document.getElementById('search-modal-input');
    this.list = document.getElementById('search-results-list');
    this.btnClose = document.getElementById('search-modal-close');
    this.btnOpen = document.getElementById('btn-search-nav');
    
    this.btnTrigger = document.getElementById('search-trigger-btn');
    this.btnBack = document.getElementById('search-input-back');
    this.btnClear = document.getElementById('search-input-clear');

    this.bindEvents();
    if (window.lucide) {
      lucide.createIcons({ parent: this.modal });
    }
  }

  bindEvents() {
    const openModal = () => {
      this.modal.classList.remove('hidden');
      this.headerContainer.classList.remove('search-active');
      this.input.value = '';
      if (this.btnClear) this.btnClear.style.display = 'none';
      this.renderSearchResults('');
    };

    const closeModal = () => {
      this.modal.classList.add('hidden');
      this.headerContainer.classList.remove('search-active');
      this.input.value = '';
      if (this.btnClear) this.btnClear.style.display = 'none';
    };

    document.addEventListener('click', (e) => {
      const searchBtn = e.target.closest('#btn-search-nav, #btn-debate-search-nav, .btn-open-search-modal');
      if (searchBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (router && typeof router.navigateTo === 'function') {
          router.navigateTo('history');
        } else {
          openModal();
        }
      }
    });

    this.btnClose?.addEventListener('click', closeModal);
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) closeModal();
    });

    // Expand search input field on trigger click
    if (this.btnTrigger) {
      this.btnTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        this.headerContainer.classList.add('search-active');
        setTimeout(() => this.input.focus(), 150);
      });
    }

    // Collapse search input field on back click
    if (this.btnBack) {
      this.btnBack.addEventListener('click', (e) => {
        e.stopPropagation();
        this.headerContainer.classList.remove('search-active');
        this.input.value = '';
        if (this.btnClear) this.btnClear.style.display = 'none';
        this.renderSearchResults('');
      });
    }

    // Clear input field on clear click
    if (this.btnClear) {
      this.btnClear.addEventListener('click', (e) => {
        e.stopPropagation();
        this.input.value = '';
        this.btnClear.style.display = 'none';
        this.renderSearchResults('');
        this.input.focus();
      });
    }

    this.input.addEventListener('input', () => {
      const val = this.input.value;
      if (this.btnClear) {
        this.btnClear.style.display = val ? 'flex' : 'none';
      }
      this.renderSearchResults(val);
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
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;"><rect x="12" y="12" width="2" height="12"/><rect x="18" y="12" width="2" height="12"/><path d="M4,6V8H6V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V8h2V6ZM8,28V8H24V28Z"/><rect x="12" y="2" width="8" height="2"/></svg>
        </button>
      `;
      if (window.lucide) lucide.createIcons({ parent: item });

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
