/**
 * history_page.js — ChatGPT-Style Full-Page Search Chats & Recent History for Hekki.
 *
 * Same max-width (~780px) and clean aesthetic as PluginsPage.
 * Features: Search input, 'Recent' section, clean list rows (title left, date right),
 * soft hover background, immediate session loading & deletion.
 */

import { router } from '/static/js/router.js';
import { ChatSessionManager } from '/static/js/chat/session.js';

export class HistoryPage {
  constructor(chatSessionManager) {
    this.chatSessionManager = chatSessionManager || ChatSessionManager || window.ChatSessionManager;
    this._searchQuery = '';
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
    
    return isSameYear ? `${day} ${month}` : `${day} ${month} ${d.getFullYear()}`;
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

  render() {
    if (!this._root) return;
    const mgr = this.chatSessionManager || ChatSessionManager || window.ChatSessionManager;
    const chats = mgr ? mgr.getChats() : [];

    const q = this._searchQuery.toLowerCase().trim();
    const filtered = chats.filter(chat => {
      if (!q) return true;
      const cleanT = this.stripMarkdown(chat.title || '').toLowerCase();
      if (cleanT.includes(q)) return true;
      return (chat.messages || []).some(m => (m.text || '').toLowerCase().includes(q));
    });

    this._root.innerHTML = `
      <div class="history-wrapper" style="display:flex; flex-direction:column; width:100%; height:100%; flex:1; min-width:0; overflow-y:auto; padding:40px 24px 48px; background:var(--bg); color:var(--text); font-family:var(--font); box-sizing:border-box;">
        <div style="max-width:780px; margin:0 auto; width:100%;">
          
          <!-- SEARCH INPUT HEADER -->
          <div style="margin-bottom:32px; display:flex; justify-content:center;">
            <div style="position:relative; width:100%; max-width:540px;">
              <i data-lucide="search" style="position:absolute; left:14px; top:50%; transform:translateY(-50%); width:15px; height:15px; color:var(--text-3); pointer-events:none;"></i>
              <input type="text" id="history-search-input" value="${esc(this._searchQuery)}" placeholder="Search chats..." style="width:100%; height:42px; padding:0 38px 0 38px; background:var(--input-bg); border:none !important; border-radius:21px; color:var(--text); font-size:13.5px; font-family:var(--font); outline:none !important; box-shadow:none !important;" autocomplete="off" />
              ${this._searchQuery ? `
                <button id="history-search-clear" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:var(--text-3); cursor:pointer; display:flex; align-items:center; justify-content:center; padding:4px;">
                  <i data-lucide="x" style="width:14px; height:14px;"></i>
                </button>
              ` : ''}
            </div>
          </div>

          <!-- RECENT SECTION -->
          <div style="margin-bottom:12px; font-size:13px; font-weight:600; color:var(--text-3);">
            ${q ? `Search Results (${filtered.length})` : 'Recent'}
          </div>

          <!-- CHAT HISTORY LIST -->
          <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
            ${filtered.length === 0 ? `
              <div style="padding:24px 0; text-align:center; color:var(--text-3); font-size:13px; background:var(--input-bg); border-radius:14px;">
                ${q ? `No conversations matching "${esc(q)}"` : 'No chat history found.'}
              </div>
            ` : filtered.map(chat => {
              const cleanTitle = this.stripMarkdown(chat.title || 'Untitled Chat');
              const dateStr = this.formatDate(chat.updatedAt || chat.createdAt || chat.timestamp);
              return `
                <div class="history-item-row" data-id="${chat.id}" style="display:flex; align-items:center; justify-content:space-between; padding:14px 18px; background:var(--input-bg); border-radius:14px; border:none !important; box-shadow:none !important; cursor:pointer; transition:all 0.15s ease;" onmouseover="this.style.background='var(--hover)';" onmouseout="this.style.background='var(--input-bg)';">
                  <div style="font-size:13.5px; font-weight:500; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:16px; flex:1; min-width:0;">
                    ${esc(cleanTitle)}
                  </div>
                  <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
                    <span style="font-size:12px; color:var(--text-3); font-weight:400;">${esc(dateStr)}</span>
                    <button class="history-del-btn" data-id="${chat.id}" title="Delete chat" style="background:transparent; border:none; color:var(--text-3); opacity:0.6; cursor:pointer; padding:3px; display:flex; align-items:center; justify-content:center; transition:opacity 0.15s ease;" onmouseover="this.style.opacity='1'; this.style.color='#ef4444';" onmouseout="this.style.opacity='0.6'; this.style.color='var(--text-3)';">
                      <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
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

    const input = this._root.querySelector('#history-search-input');
    if (input) {
      input.focus();
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

    // Row Click & Delete events
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

    this._root.querySelectorAll('.history-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
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
