/**
 * history_page.js — Center Page Chat History for Hekki.
 *
 * Minimalist List Layout (matching ChatGPT / Hekki flat design):
 * - Centered Search Bar
 * - Filter Chips: All, General Chat, Playground
 * - "Recent" Section Subtitle
 * - Sleek List Rows with Title on Left & Red Trash Icon on Right
 * - Instant Deletion without confirmation dialogs
 */

import { router } from '/static/js/router.js';
import { ChatSessionManager } from '/static/js/chat/session.js';

export class HistoryPage {
  constructor(chatSessionManager) {
    this.chatSessionManager = chatSessionManager || ChatSessionManager || window.ChatSessionManager;
    this._searchQuery = '';
    this._activeFilter = 'all'; // 'all' | 'general' | 'playground'
    this._root = null;
    this._mounted = false;
  }

  mount(containerEl) {
    if (!containerEl) return;
    this._root = containerEl;
    this._mounted = true;
    this.render();
  }

  refresh() {
    this.render();
  }

  formatDate(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    
    const now = new Date();
    const isSameYear = d.getFullYear() === now.getFullYear();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = d.getDate();
    const month = months[d.getMonth()];
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    
    return isSameYear ? `${day} ${month}, ${hours}:${mins}` : `${day} ${month} ${d.getFullYear()}`;
  }

  cleanTitle(str) {
    if (!str) return 'Untitled Chat';
    return String(str)
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/#+\s+/g, '')
      .trim();
  }

  isPlaygroundChat(chat) {
    return Boolean(chat && (
      chat.isPlayground ||
      chat.isDebate ||
      (chat.id && (String(chat.id).startsWith('playground_') || String(chat.id).startsWith('debate_')))
    ));
  }

  render() {
    if (!this._root) return;
    const mgr = this.chatSessionManager || ChatSessionManager || window.ChatSessionManager;
    const allChats = mgr ? mgr.getChats().filter(c => !c.archived) : [];

    // Filter by category
    const generalChats = allChats.filter(c => !this.isPlaygroundChat(c));
    const playgroundChats = allChats.filter(c => this.isPlaygroundChat(c));

    let currentList = allChats;
    if (this._activeFilter === 'general') currentList = generalChats;
    if (this._activeFilter === 'playground') currentList = playgroundChats;

    // Filter by search query
    const q = this._searchQuery.toLowerCase().trim();
    const filtered = currentList.filter(chat => {
      if (!q) return true;
      const cleanT = this.cleanTitle(chat.title || '').toLowerCase();
      if (cleanT.includes(q)) return true;
      return (chat.messages || []).some(m => (m.text || '').toLowerCase().includes(q));
    });

    this._root.innerHTML = `
      <div class="history-wrapper" style="display:flex; flex-direction:column; width:100%; height:100%; flex:1; min-width:0; overflow-y:auto; padding:40px 24px 48px; background:var(--bg, #f6f7f9); color:var(--text); font-family: 'Open Sans', sans-serif; box-sizing:border-box;">
        <div style="max-width:680px; margin:0 auto; width:100%;">
          
          <!-- CENTERED SEARCH INPUT BAR -->
          <div style="margin-bottom:20px; display:flex; justify-content:center;">
            <div style="position:relative; width:100%; max-width:540px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 32 32" fill="currentColor" style="position:absolute; left:16px; top:50%; transform:translateY(-50%); width:15px; height:15px; color:var(--text-3); pointer-events:none;"><path d="M29,27.5859l-7.5521-7.5521a11.0177,11.0177,0,1,0-1.4141,1.4141L27.5859,29ZM4,13a9,9,0,1,1,9,9A9.01,9.01,0,0,1,4,13Z"/></svg>
              <input type="text" id="history-search-input" value="${esc(this._searchQuery)}" placeholder="Search chats..." style="width:100%; height:42px; padding:0 38px 0 42px; background:var(--input-bg, #ffffff); border:none !important; border-radius:21px; color:var(--text); font-size:13.5px; font-family:inherit; outline:none !important; box-shadow:none !important; box-sizing:border-box;" autocomplete="off" />
              ${this._searchQuery ? `
                <button id="history-search-clear" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:var(--text-3); cursor:pointer; display:flex; align-items:center; justify-content:center; padding:4px;">
                  <i data-lucide="x" style="width:14px; height:14px;"></i>
                </button>
              ` : ''}
            </div>
          </div>

          <!-- FILTER CHIPS BAR (Active: var(--hover) Grey Tint | Unselected: White var(--input-bg)) -->
          <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:24px;">
            <button class="history-chip ${this._activeFilter === 'all' ? 'active' : ''}" data-filter="all" style="padding:7px 18px; border-radius:9999px !important; font-size:13.5px; font-weight:400 !important; border:none !important; box-shadow:none !important; cursor:pointer; transition:all 0.15s ease; ${this._activeFilter === 'all' ? 'background:var(--hover, #e4e7eb) !important; color:var(--text-primary) !important;' : 'background:var(--input-bg, #ffffff) !important; color:var(--text-2) !important;'}">
              All (${allChats.length})
            </button>
            <button class="history-chip ${this._activeFilter === 'general' ? 'active' : ''}" data-filter="general" style="padding:7px 18px; border-radius:9999px !important; font-size:13.5px; font-weight:400 !important; border:none !important; box-shadow:none !important; cursor:pointer; transition:all 0.15s ease; ${this._activeFilter === 'general' ? 'background:var(--hover, #e4e7eb) !important; color:var(--text-primary) !important;' : 'background:var(--input-bg, #ffffff) !important; color:var(--text-2) !important;'}">
              General Chat (${generalChats.length})
            </button>
            <button class="history-chip ${this._activeFilter === 'playground' ? 'active' : ''}" data-filter="playground" style="padding:7px 18px; border-radius:9999px !important; font-size:13.5px; font-weight:400 !important; border:none !important; box-shadow:none !important; cursor:pointer; transition:all 0.15s ease; ${this._activeFilter === 'playground' ? 'background:var(--hover, #e4e7eb) !important; color:var(--text-primary) !important;' : 'background:var(--input-bg, #ffffff) !important; color:var(--text-2) !important;'}">
              Playground (${playgroundChats.length})
            </button>
          </div>

          <!-- RECENT SECTION HEADER -->
          <div style="margin-bottom:12px; font-size:12px; font-weight:600; color:var(--text-3); letter-spacing:0.02em;">
            ${q ? `Search Results (${filtered.length})` : 'Recent'}
          </div>

          <!-- CHAT HISTORY LIST ROWS (Flat list format separated by horizontal divider lines) -->
          <div style="display:flex; flex-direction:column; gap:0; width:100%; border-top:1px solid var(--border);">
            ${filtered.length === 0 ? `
              <div style="padding:28px 0; text-align:center; color:var(--text-3); font-size:13px; background:transparent;">
                ${q ? `No chats matching "${esc(q)}"` : 'No conversations found.'}
              </div>
            ` : filtered.map(chat => {
              const displayTitle = this.cleanTitle(chat.title || 'New Chat');
              const initialLetter = (displayTitle.trim()[0] || 'C').toUpperCase();
              
              return `
                <div class="history-item-row" data-id="${chat.id}" style="display:flex; align-items:center; justify-content:space-between; padding:12px 6px; background:transparent; border:none !important; border-bottom:1px solid var(--border) !important; border-radius:0 !important; box-shadow:none !important; cursor:pointer; transition:background 0.12s ease;" onmouseover="this.style.background='var(--hover)';" onmouseout="this.style.background='transparent';">
                  
                  <!-- LEFT: UNBOLD ALPHABET AVATAR & UNBOLD TITLE -->
                  <div style="display:flex; align-items:center; flex:1; min-width:0; overflow:hidden; padding-right:16px;">
                    <!-- Unbold Alphabet Avatar -->
                    <div style="width:28px; height:28px; border-radius:50%; background:var(--hover); color:var(--text-2); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:400 !important; flex-shrink:0; margin-right:12px; user-select:none;">
                      ${initialLetter}
                    </div>

                    <!-- Unbold Title Text (font-weight: 400 !important) -->
                    <div style="font-size:13.5px; font-weight:400 !important; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;">
                      ${esc(displayTitle)}
                    </div>
                  </div>

                  <!-- PERMANENT RED TRASH ICON (RIGHT) — Instant delete on click -->
                  <div style="display:flex; align-items:center; flex-shrink:0;">
                    <button class="history-del-btn" data-id="${chat.id}" title="Delete immediately" style="background:transparent; border:none !important; box-shadow:none !important; color:#ef4444 !important; opacity:0.6; cursor:pointer; padding:6px 8px; display:flex; align-items:center; justify-content:center; border-radius:6px; transition:all 0.15s ease;" onmouseover="this.style.opacity='1'; this.style.background='rgba(239,68,68,0.1)';" onmouseout="this.style.opacity='0.6'; this.style.background='transparent';">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" style="width:15px;height:15px;display:block;flex-shrink:0;pointer-events:none;"><rect x="12" y="12" width="2" height="12"/><rect x="18" y="12" width="2" height="12"/><path d="M4,6V8H6V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V8h2V6ZM8,28V8H24V28Z"/><rect x="12" y="2" width="8" height="2"/></svg>
                    </button>
                  </div>

                </div>
              `;
            }).join('')}
          </div>

        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons({ parent: this._root });

    // Search input handlers
    const input = this._root.querySelector('#history-search-input');
    if (input) {
      input.addEventListener('input', (e) => {
        this._searchQuery = e.target.value;
        this.render();
      });
    }

    const clearBtn = this._root.querySelector('#history-search-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this._searchQuery = '';
        this.render();
      });
    }

    // Filter Chips click handlers
    this._root.querySelectorAll('.history-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this._activeFilter = chip.getAttribute('data-filter') || 'all';
        this.render();
      });
    });

    // List Row click — navigate & load chat
    this._root.querySelectorAll('.history-item-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.history-del-btn')) return;
        const chatId = row.getAttribute('data-id');
        if (chatId && window.chatSessionManager) {
          window.chatSessionManager.loadChat(chatId);
          if (router) router.navigateTo('chat');
        }
      });
    });

    // Red Trash Delete Button — instant deletion WITHOUT confirmation
    this._root.querySelectorAll('.history-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const chatId = btn.getAttribute('data-id');
        if (chatId && window.chatSessionManager) {
          window.chatSessionManager.deleteChat(chatId);
          this.render();
        }
      });
    });
  }
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }


