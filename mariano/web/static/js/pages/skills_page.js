/**
 * skills_page.js — ChatGPT/Plugins-Style Full-Page Skills & Capabilities Hub for Hekki.
 *
 * Fully integrated with Hekki's Legacy CSS Tokens (var(--bg), var(--card), etc.).
 * Views: 'catalog' (2-column grid categorized) | 'detail' (Parameters & Metadata Table)
 */

import { getSkillRealLogoSvg } from './skills_icons.js';

function formatSkillName(name) {
  return String(name || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getSkillCategory(name, tags) {
  const n = (name || '').toLowerCase();
  if (n.includes('research') || n.includes('memory') || n.includes('brief') || n.includes('translate') || n.includes('physics') || n.includes('analyzer')) {
    return 'Core Intelligence';
  }
  if (n.includes('file') || n.includes('run_command') || n.includes('terminal')) {
    return 'System & Files';
  }
  if (n.includes('web') || n.includes('search') || n.includes('scrape') || n.includes('news') || n.includes('stock') || n.includes('weather') || n.includes('wiki')) {
    return 'Web & Search';
  }
  return 'Media & Utilities';
}

function getSkillExamplePrompt(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('deep_research')) return '@DeepResearch research quantum computing advancements';
  if (n.includes('file_manager')) return '@FileManager list files in C:/Users/anshu/Downloads';
  if (n.includes('run_command')) return '@RunCommand execute python --version';
  if (n.includes('generate_image')) return '@GenerateImage create a futuristic cyberpunk neon city';
  if (n.includes('image_analysis')) return '@ImageAnalysis analyze chart image and summarize data';
  if (n.includes('memory_ops')) return '@MemoryOps search memory for user preferences';
  if (n.includes('morning_briefing')) return '@MorningBriefing generate daily briefing and weather';
  if (n.includes('news_fetch')) return '@NewsFetch fetch latest AI technology news';
  if (n.includes('reminder')) return '@Reminder remind me to check deployment in 30 mins';
  if (n.includes('stock_data')) return '@StockData get stock price and trends for AAPL';
  if (n.includes('translator')) return '@Translator translate "Hello world" to Hindi';
  if (n.includes('weather')) return '@Weather get weather forecast for Mumbai';
  if (n.includes('web_scraper')) return '@WebScraper extract text from https://example.com';
  if (n.includes('web_search')) return '@WebSearch search web for latest Python 3.12 features';
  if (n.includes('wikipedia_search')) return '@WikipediaSearch search Wikipedia for Quantum Mechanics';
  if (n.includes('physics_solver')) return '@PhysicsSolver solve velocity of falling object after 5s';
  if (n.includes('data_analyzer')) return '@DataAnalyzer analyze data inside sales_report.csv';
  return `@${formatSkillName(name).replace(/\s+/g, '')} execute operation`;
}

export class SkillsPage {
  constructor(showToast) {
    this._showToast = (title, msg, dur) => {
      if (typeof showToast === 'function') showToast(title, msg, dur);
    };
    this._view = 'catalog';
    this._selectedSkillName = null;
    this._searchQuery = '';
    this._root = null;
    this._mounted = false;
    this._activeCollapsibleOpen = false;
    this._skills = [];

    window.skillsPageInstance = this;
  }

  toggleActiveCollapsible() {
    this._activeCollapsibleOpen = !this._activeCollapsibleOpen;
    this._renderCatalogGrid();
  }

  mount(container) {
    this._root = container;
    if (this._root) {
      this._root.style.display = 'flex';
      this._root.style.flex = '1';
      this._root.style.width = '100%';
      this._root.style.height = '100%';
      this._root.style.minWidth = '0';
      this._root.style.overflow = 'hidden';
    }
    this._mounted = true;
    this._loadData();
  }

  refresh() {
    if (!this._mounted) return;
    this._loadData();
  }

  async _loadData() {
    try {
      const res = await fetch('/api/skills');
      if (res.ok) {
        this._skills = await res.json();
      }
    } catch (e) {
      console.warn('SkillsPage load error:', e);
    }
    this.render();
  }

  render() {
    if (!this._root) return;
    if (this._view === 'detail') this._renderDetail();
    else this._renderCatalog();
  }

  showDetail(skillName) {
    this._selectedSkillName = skillName;
    this._view = 'detail';
    this.render();
  }

  showCatalog() {
    this._view = 'catalog';
    this.render();
  }

  _renderCatalogGrid() {
    const gridContainer = this._root ? this._root.querySelector('#skills-grid-container') : null;
    if (!gridContainer) return;

    const activeInput = document.activeElement;
    const isSearchInput = activeInput && activeInput.id === 'skills-search-input';
    const selStart = isSearchInput ? activeInput.selectionStart : null;
    const selEnd = isSearchInput ? activeInput.selectionEnd : null;

    const activeList = this._skills.filter(s => s.enabled !== false);
    const filtered = this._skills.filter(item => {
      if (!this._searchQuery) return true;
      const q = this._searchQuery.toLowerCase();
      const fn = formatSkillName(item.name).toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const category = getSkillCategory(item.name, item.tags).toLowerCase();
      return item.name.toLowerCase().includes(q) || fn.includes(q) || desc.includes(q) || category.includes(q);
    });

    const categories = ['Core Intelligence', 'System & Files', 'Web & Search', 'Media & Utilities'];

    gridContainer.innerHTML = `
      <!-- ACTIVE SKILLS PILLS (COLLAPSIBLE, DEFAULT COLLAPSED) -->
      <div style="margin-bottom:24px;">
        <div onclick="window.skillsPageInstance.toggleActiveCollapsible()" style="font-size:13px; font-weight:500; color:var(--text-3); margin-bottom:8px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; user-select:none; padding:4px 10px; border-radius:20px; transition:all 0.15s ease;" onmouseover="this.style.background='var(--hover)';" onmouseout="this.style.background='transparent';">
          <i data-lucide="${this._activeCollapsibleOpen ? 'chevron-down' : 'chevron-right'}" style="width:15px; height:15px;"></i>
          <span>Active Capabilities</span>
          <span style="font-size:12px; background:var(--input-bg); padding:1px 8px; border-radius:20px; color:var(--text-2);">${activeList.length}</span>
          <span style="font-size:11px; color:var(--text-3); font-weight:400; margin-left:2px;">(${this._activeCollapsibleOpen ? 'collapse' : 'expand'})</span>
        </div>
        <div style="display:${this._activeCollapsibleOpen ? 'flex' : 'none'}; gap:8px; flex-wrap:wrap; align-items:center; margin-top:6px;">
          ${activeList.length === 0 ? `
            <div style="font-size:13px; color:var(--text-3); background:var(--card); border:none !important; padding:8px 14px; border-radius:20px; width:100%; box-sizing:border-box;">
              No active capabilities. Click the <strong>＋ icon</strong> on any skill below to enable.
            </div>
          ` : activeList.map(s => `
            <div onclick="window.skillsPageInstance.showDetail('${s.name}')" style="display:flex; align-items:center; gap:8px; background:var(--card); border:none !important; padding:6px 14px; border-radius:20px; cursor:pointer; transition:background 0.15s ease;" onmouseover="this.style.background='var(--hover)';" onmouseout="this.style.background='var(--card)';">
              ${getSkillRealLogoSvg(s.name, 16)}
              <span style="font-size:13.5px; font-weight:500; color:var(--text);">${esc(formatSkillName(s.name))}</span>
              <span style="width:6px; height:6px; border-radius:50%; background:#16a34a; margin-left:2px;"></span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- CATEGORIZED 2-COLUMN GRID -->
      ${categories.map(cat => {
        const items = filtered.filter(i => getSkillCategory(i.name, i.tags) === cat);
        if (items.length === 0) return '';
        return `
          <div style="margin-bottom:28px;">
            <h3 style="font-size:14px; font-weight:600; color:var(--text); margin-bottom:10px;">${cat}</h3>
            <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px;">
              ${items.map(item => this._renderSkillCard(item)).join('')}
            </div>
          </div>
        `;
      }).join('')}
    `;

    if (window.lucide) lucide.createIcons({ parent: gridContainer });

    if (isSearchInput && document.body.contains(activeInput)) {
      activeInput.focus();
      if (selStart !== null && selEnd !== null) {
        try { activeInput.setSelectionRange(selStart, selEnd); } catch (e) {}
      }
    }
  }

  _buildShell() {
    this._root.innerHTML = `
      <div class="skills-wrapper" style="display:flex; flex-direction:column; width:100%; height:100%; flex:1; min-width:0; overflow-y:auto; padding:40px 24px 48px; background:var(--bg); color:var(--text); font-family:var(--font); box-sizing:border-box;">
        <div style="max-width:780px; margin:0 auto; width:100%;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px; margin-bottom:24px; width:100%;">
            <div>
              <h1 style="font-size:19px; font-weight:600; color:var(--text); margin:0;">Capabilities &amp; Skills</h1>
              <p style="font-size:13px; color:var(--text-3); margin-top:2px;">Manage autonomous tool capabilities powering Hekki.</p>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="position:relative; width:220px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:14px; height:14px; color:var(--text-3); pointer-events:none;"><path d="M29,27.5859l-7.5521-7.5521a11.0177,11.0177,0,1,0-1.4141,1.4141L27.5859,29ZM4,13a9,9,0,1,1,9,9A9.01,9.01,0,0,1,4,13Z"/></svg>
                <input type="text" id="skills-search-input" placeholder="Search skills..." style="width:100%; height:34px; padding:0 12px 0 34px; background:var(--input-bg); border:1px solid var(--border, rgba(255,255,255,0.08)) !important; border-radius:17px; color:var(--text); font-size:13px; outline:none !important; box-shadow:none !important;" />
              </div>
              <button onclick="window.skillsPageInstance.cleanStats()" title="Reset call statistics" style="height:34px; padding:0 14px; background:var(--input-bg); border:1px solid var(--border, rgba(255,255,255,0.08)) !important; border-radius:17px; color:var(--text-2); font-size:12.5px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:5px; transition:background 0.15s ease;" onmouseover="this.style.background='var(--hover)';" onmouseout="this.style.background='var(--input-bg)';">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:block;"><path d="M26,16A10,10,0,1,1,16,6v4l5-5L16,0V4A12,12,0,1,0,28,16Z"/></svg>
                <span>Clean Stats</span>
              </button>
            </div>
          </div>
          <div id="skills-grid-container"></div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ parent: this._root });
    const input = this._root.querySelector('#skills-search-input');
    if (input) {
      input.addEventListener('input', (e) => {
        this._searchQuery = e.target.value;
        this._renderCatalogGrid();
      });
    }
  }

  _renderCatalog() {
    if (!this._root.querySelector('#skills-grid-container')) {
      this._buildShell();
    }
    this._renderCatalogGrid();
  }

  _renderSkillCard(item) {
    const isEnabled = item.enabled !== false;
    const friendlyName = formatSkillName(item.name);
    const examplePrompt = getSkillExamplePrompt(item.name);

    return `
      <div onclick="window.skillsPageInstance.showDetail('${item.name}')" style="background:var(--card); border:1px solid var(--border, rgba(255,255,255,0.06)) !important; outline:none !important; border-radius:12px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px; cursor:pointer; transition:background 0.15s ease;" onmouseover="this.style.background='var(--hover)';" onmouseout="this.style.background='var(--card)';">
        <div style="display:flex; gap:12px; align-items:center; flex:1; min-width:0;">
          <div style="width:38px; height:38px; border-radius:10px; background:var(--input-bg); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--text);">
            ${getSkillRealLogoSvg(item.name, 20)}
          </div>
          <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
            <div style="font-size:15px; font-weight:500; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(friendlyName)}</div>
            <div style="font-size:13.5px; color:var(--text-3); line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(examplePrompt)}</div>
          </div>
        </div>
        <button onclick="event.stopPropagation(); window.skillsPageInstance.toggleSkill('${item.name}')" title="${isEnabled ? 'Disable' : 'Enable'} ${esc(friendlyName)}" style="width:34px; height:34px; min-width:34px; min-height:34px; border-radius:8px; background:${isEnabled ? 'rgba(22,163,74,0.12)' : 'var(--input-bg)'}; border:none !important; outline:none !important; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease; color:${isEnabled ? '#16a34a' : 'var(--text)'};">
          ${isEnabled ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="#16a34a" style="width:14px;height:14px;display:block;flex-shrink:0;"><polygon points="13 24 4 15 5.414 13.586 13 21.171 26.586 7.586 28 9 13 24"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;display:block;flex-shrink:0;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>'}
        </button>
      </div>
    `;
  }

  _renderDetail() {
    const item = this._skills.find(s => s.name === this._selectedSkillName) || {
      name: this._selectedSkillName, description: 'Autonomous capability module.', version: '1.0.0', enabled: true,
      parameters: { properties: {} }, stats: { call_count: 0, avg_latency_ms: 0, success_rate: 1.0 }
    };

    const isEnabled = item.enabled !== false;
    const friendlyName = formatSkillName(item.name);
    const category = getSkillCategory(item.name, item.tags);
    const examplePrompt = getSkillExamplePrompt(item.name);

    // Extract parameter definitions from JSON Schema
    const paramsObj = (item.parameters && item.parameters.properties) ? item.parameters.properties : {};
    const reqList = (item.parameters && item.parameters.required) ? item.parameters.required : [];
    const paramKeys = Object.keys(paramsObj);

    const stats = item.stats || { call_count: 0, avg_latency_ms: 0, success_rate: 1.0 };
    const successPct = Math.round((stats.success_rate || 1.0) * 100);

    this._root.innerHTML = `
      <div class="skills-detail-wrapper" style="display:flex; flex-direction:column; width:100%; height:100%; flex:1; min-width:0; overflow-y:auto; padding:40px 24px 48px; background:var(--bg); color:var(--text); font-family:var(--font); box-sizing:border-box;">
        
        <!-- BACK BUTTON -->
        <div style="max-width:780px; margin:0 auto 20px; width:100%;">
          <button onclick="window.skillsPageInstance.showCatalog()" style="background:transparent; border:none; color:var(--text-2); font-size:13px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:6px; padding:0;">
            <i data-lucide="chevron-left" style="width:16px; height:16px;"></i> Skills
          </button>
        </div>

        <div style="max-width:780px; margin:0 auto; width:100%;">
          
          <!-- DETAIL HEADER -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; gap:20px;">
            <div style="display:flex; align-items:center; gap:14px;">
              <div style="width:52px; height:52px; border-radius:12px; background:var(--input-bg); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--text);">
                ${getSkillRealLogoSvg(item.name, 28)}
              </div>
              <div>
                <h1 style="font-size:20px; font-weight:600; color:var(--text); margin:0;">${esc(friendlyName)}</h1>
                <p style="font-size:12.5px; color:var(--text-3); margin-top:2px;">v${esc(item.version || '1.0.0')} &bull; ${esc(category)}</p>
              </div>
            </div>
            <button onclick="window.skillsPageInstance.toggleSkill('${item.name}')" style="padding:6px 18px; border-radius:20px; border:none !important; font-size:12.5px; font-weight:600; cursor:pointer; transition:all 0.15s ease; ${isEnabled ? 'background:rgba(239,68,68,0.1); color:#ef4444;' : 'background:var(--text); color:var(--bg);'}">
              ${isEnabled ? 'Disable Capability' : '＋ Enable Capability'}
            </button>
          </div>

          <!-- DESCRIPTION -->
          <div style="font-size:13px; color:var(--text-2); line-height:1.6; margin-bottom:28px;">${esc(item.description || 'No detailed description provided for this capability module.')}</div>

          <!-- SKILL BADGE -->
          <div style="margin-bottom:28px;">
            <div style="font-size:14px; font-weight:600; color:var(--text); margin-bottom:8px;">Skill Badge</div>
            <div style="display:inline-flex; align-items:center; gap:8px; background:var(--input-bg); padding:6px 16px; border-radius:20px; font-size:13px; font-weight:500; color:var(--text);">
              ${getSkillRealLogoSvg(item.name, 16)}
              <span>${esc(friendlyName)}</span>
            </div>
          </div>

          <!-- PARAMETERS & METHODS TABLE -->
          <div style="margin-bottom:36px;">
            <div style="font-size:14px; font-weight:600; color:var(--text); margin-bottom:4px;">Available Parameters &amp; Methods</div>
            <p style="font-size:13px; color:var(--text-3); margin-top:0; margin-bottom:16px;">Function parameters registered for Gemini and Ollama tool invocation.</p>
            
            <div style="width:100%;">
              <div style="display:grid; grid-template-columns:160px 1fr 1fr; gap:16px; padding:8px 0; border-bottom:1px solid var(--border); font-size:12.5px; font-weight:500; color:var(--text-3);">
                <div>Parameter / Argument</div>
                <div>Description &amp; Type</div>
                <div>How to Use (Prompt)</div>
              </div>
              
              ${paramKeys.length === 0 ? `
                <div style="display:grid; grid-template-columns:160px 1fr 1fr; gap:16px; padding:12px 0; border-bottom:1px solid var(--border); font-size:13px; align-items:center;">
                  <div style="font-family:var(--font-mono); font-weight:500; color:var(--text); font-size:13px;">execute()</div>
                  <div style="color:var(--text-2); line-height:1.4; font-weight:400;">No input arguments required.</div>
                  <div style="font-family:var(--font-mono); color:var(--text-2); font-size:12.5px; font-weight:400;">${esc(examplePrompt)}</div>
                </div>
              ` : paramKeys.map(pk => {
                const pinfo = paramsObj[pk] || {};
                const ptype = pinfo.type || 'string';
                const isReq = reqList.includes(pk);
                const pdesc = pinfo.description || pk;
                return `
                  <div style="display:grid; grid-template-columns:160px 1fr 1fr; gap:16px; padding:12px 0; border-bottom:1px solid var(--border); font-size:13px; align-items:center;">
                    <div style="font-family:var(--font-mono); font-weight:500; color:var(--text); font-size:13px;">
                      ${esc(pk)} ${isReq ? '<span style="color:#ef4444; font-size:10px;">*</span>' : ''}
                    </div>
                    <div style="color:var(--text-2); line-height:1.4; font-weight:400;">
                      ${esc(pdesc)} <span style="font-size:12px; color:var(--text-3); font-family:var(--font-mono);">(${esc(ptype)})</span>
                    </div>
                    <div style="font-family:var(--font-mono); color:var(--text-2); font-size:12.5px; font-weight:400;">${esc(examplePrompt)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- SYSTEM METADATA & TELEMETRY TABLE -->
          <div style="margin-bottom:28px;">
            <div style="font-size:14px; font-weight:600; color:var(--text); margin-bottom:12px;">System Metadata &amp; Telemetry</div>
            <div style="width:100%;">
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Category</span>
                <span style="color:var(--text); font-weight:400;">${esc(category)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Version</span>
                <span style="color:var(--text); font-weight:400;">v${esc(item.version || '1.0.0')}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Total Call Invocations</span>
                <span style="color:var(--text); font-family:var(--font-mono); font-size:11.5px; font-weight:400;">${stats.call_count || 0} calls</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Average Execution Latency</span>
                <span style="color:var(--text); font-family:var(--font-mono); font-size:11.5px; font-weight:400;">${stats.avg_latency_ms || 0} ms</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Success Rate</span>
                <span style="color:var(--text); font-family:var(--font-mono); font-size:11.5px; font-weight:400;">${successPct}%</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Execution Status</span>
                <span style="font-weight:500; color:${isEnabled ? '#16a34a' : 'var(--text-3)'}">${isEnabled ? 'Active' : 'Disabled'}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  }

  async toggleSkill(skillName) {
    const item = this._skills.find(s => s.name === skillName);
    if (!item) return;
    const isCurrentlyEnabled = item.enabled !== false;
    const nextState = !isCurrentlyEnabled;
    const friendly = formatSkillName(skillName);

    try {
      const res = await fetch('/api/skills/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: skillName, enabled: nextState })
      });
      if (res.ok) {
        item.enabled = nextState;
        this._showToast('Skills Engine', `${nextState ? 'Enabled' : 'Disabled'} capability "${friendly}"`, 2500);
      } else {
        throw new Error('Toggle failed');
      }
    } catch (e) {
      this._showToast('Skills Engine', `Failed to toggle ${friendly}`, 3000);
    }
    await this._loadData();
  }

  async cleanStats() {
    try {
      const res = await fetch('/api/skills/clean', { method: 'POST' });
      if (res.ok) {
        this._showToast('Skills Telemetry', 'Successfully reset call counts and latencies across all skills', 2500);
      } else {
        throw new Error('Clean failed');
      }
    } catch (e) {
      this._showToast('Skills Telemetry', 'Failed to clean statistics', 3000);
    }
    await this._loadData();
  }
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
