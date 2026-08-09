/**
 * skills_page.js — ChatGPT/Plugins-Style Full-Page Skills & Capabilities Hub for Hekki.
 *
 * Fully integrated with Hekki's Legacy CSS Tokens (var(--bg), var(--card), etc.).
 * Views: 'catalog' (2-column grid categorized) | 'detail' (Parameters & Metadata Table)
 */

function getSkillRealLogoSvg(name, size = 18) {
  const norm = String(name || '').toLowerCase();
  
  if (norm.includes('generate_image') || norm.includes('image_gen')) {
    return `<img src="/static/icons/skills/Generate Image.png" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('news')) {
    return `<img src="/static/icons/skills/News Fetch.png" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('remind')) {
    return `<img src="/static/icons/skills/Reminder.png" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('schedule')) {
    return `<img src="/static/icons/skills/Schedule.png" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('stock')) {
    return `<img src="/static/icons/skills/Stock Data.png" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('translate') || norm.includes('lang')) {
    return `<img src="/static/icons/skills/Translator.png" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('wiki')) {
    return `<img src="/static/icons/skills/Wikipedia Search.png" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('coder') || norm.includes('refactor')) {
    return `<img src="/static/icons/skills/Coder Refactor.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('security') || norm.includes('recon') || norm.includes('red_team') || norm.includes('boundary')) {
    return `<img src="/static/icons/skills/Red Team Ops.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('debate') || norm.includes('argument')) {
    return `<img src="/static/icons/skills/Expert Debate.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('recycler') || norm.includes('recycle') || norm.includes('trash')) {
    return `<img src="/static/icons/skills/Recycler.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('brain') || norm.includes('mind') || norm.includes('ai')) {
    return `<img src="/static/icons/3147639.webp" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('task') || norm.includes('run_command') || norm.includes('control')) {
    return `<img src="/static/icons/skills/Manage Task.png" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('file') || norm.includes('write') || norm.includes('read_file')) {
    return `<img src="/static/icons/skills/file.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('folder') || norm.includes('filesystem') || norm.includes('directory')) {
    return `<img src="/static/icons/skills/Folder-icon.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('search')) {
    return `<img src="/static/icons/google.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('scrape') || norm.includes('browser')) {
    return `<img src="/static/icons/chrome.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('data') || norm.includes('postgres')) {
    return `<img src="/static/icons/postgresql.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('memory') || norm.includes('sqlite')) {
    return `<img src="/static/icons/sqlite.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  }
  if (norm.includes('research')) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path fill="#4285F4" d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/><path fill="#FBBC05" d="M19 2l-1.25 3.75L14 7l3.75 1.25L19 12l1.25-3.75L24 7l-3.75-1.25z"/></svg>`;
  }
  if (norm.includes('image') || norm.includes('vision')) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><circle cx="12" cy="12" r="3" fill="#EA4335"/><path fill="#4285F4" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>`;
  }
  if (norm.includes('weather') || norm.includes('brief') || norm.includes('morning')) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path fill="#FBBC05" d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z"/><path fill="#EA4335" d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" stroke="#FBBC05" stroke-width="2" stroke-linecap="round"/></svg>`;
  }
  if (norm.includes('calc') || norm.includes('physics') || norm.includes('math')) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><rect width="18" height="18" x="3" y="3" fill="#2563EB" rx="4"/><path fill="#FFFFFF" d="M7 7h10v2H7V7zm0 5h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v5h-2v-5zm-8 4h2v2H7v-2zm4 0h2v2h-2v-2z"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path fill="#2563EB" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;
}

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
    this.render();
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

  _renderCatalog() {
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

    this._root.innerHTML = `
      <div class="skills-wrapper" style="display:flex; flex-direction:column; width:100%; height:100%; flex:1; min-width:0; overflow-y:auto; padding:40px 24px 48px; background:var(--bg); color:var(--text); font-family:var(--font); box-sizing:border-box;">
        <div style="max-width:780px; margin:0 auto; width:100%;">
          
          <!-- TOP HEADER -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px; margin-bottom:24px; width:100%;">
            <div>
              <h1 style="font-size:18px; font-weight:600; color:var(--text); margin:0;">Capabilities &amp; Skills</h1>
              <p style="font-size:12px; color:var(--text-3); margin-top:2px;">Manage autonomous tool capabilities powering Hekki.</p>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="position:relative; width:220px;">
                <i data-lucide="search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:13px; height:13px; color:var(--text-3);"></i>
                <input type="text" id="skills-search-input" value="${esc(this._searchQuery)}" placeholder="Search skills..." style="width:100%; height:30px; padding:0 12px 0 32px; background:var(--input-bg); border:none !important; border-radius:20px; color:var(--text); font-size:11.5px; outline:none !important; box-shadow:none !important;" />
              </div>
              <button onclick="window.skillsPageInstance.cleanStats()" title="Reset call statistics across all capabilities" style="height:30px; padding:0 14px; background:var(--input-bg); border:none !important; border-radius:20px; color:var(--text-2); font-size:11.5px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:5px; transition:background 0.15s ease;" onmouseover="this.style.background='var(--hover)';" onmouseout="this.style.background='var(--input-bg)';">
                <i data-lucide="refresh-cw" style="width:12px; height:12px;"></i>
                <span>Clean Stats</span>
              </button>
            </div>
          </div>

          <!-- ACTIVE SKILLS PILLS (COLLAPSIBLE, DEFAULT COLLAPSED) -->
          <div style="margin-bottom:24px;">
            <div onclick="window.skillsPageInstance.toggleActiveCollapsible()" style="font-size:11.5px; font-weight:600; color:var(--text-3); margin-bottom:8px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; user-select:none; padding:4px 10px; border-radius:20px; transition:all 0.15s ease;" onmouseover="this.style.background='var(--hover)';" onmouseout="this.style.background='transparent';">
              <i data-lucide="${this._activeCollapsibleOpen ? 'chevron-down' : 'chevron-right'}" style="width:14px; height:14px;"></i>
              <span>Active Capabilities</span>
              <span style="font-size:10.5px; background:var(--input-bg); padding:1px 8px; border-radius:20px; color:var(--text-2);">${activeList.length}</span>
              <span style="font-size:10px; color:var(--text-3); font-weight:400; margin-left:2px;">(${this._activeCollapsibleOpen ? 'collapse' : 'expand'})</span>
            </div>
            <div style="display:${this._activeCollapsibleOpen ? 'flex' : 'none'}; gap:8px; flex-wrap:wrap; align-items:center; margin-top:6px;">
              ${activeList.length === 0 ? `
                <div style="font-size:11.5px; color:var(--text-3); background:var(--card); border:none !important; padding:8px 14px; border-radius:20px; width:100%; box-sizing:border-box;">
                  No active capabilities. Click the <strong>＋ icon</strong> on any skill below to enable.
                </div>
              ` : activeList.map(s => `
                <div onclick="window.skillsPageInstance.showDetail('${s.name}')" style="display:flex; align-items:center; gap:8px; background:var(--card); border:none !important; padding:6px 14px; border-radius:20px; cursor:pointer; transition:background 0.15s ease;" onmouseover="this.style.background='var(--hover)';" onmouseout="this.style.background='var(--card)';">
                  ${getSkillRealLogoSvg(s.name, 16)}
                  <span style="font-size:12px; font-weight:600; color:var(--text);">${esc(formatSkillName(s.name))}</span>
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
                <h3 style="font-size:13px; font-weight:600; color:var(--text); margin-bottom:10px;">${cat}</h3>
                <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px;">
                  ${items.map(item => this._renderSkillCard(item)).join('')}
                </div>
              </div>
            `;
          }).join('')}

        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    const input = this._root.querySelector('#skills-search-input');
    if (input) {
      input.addEventListener('input', (e) => {
        this._searchQuery = e.target.value;
        this._renderCatalog();
      });
    }
  }

  _renderSkillCard(item) {
    const isEnabled = item.enabled !== false;
    const friendlyName = formatSkillName(item.name);
    return `
      <div onclick="window.skillsPageInstance.showDetail('${item.name}')" style="background:var(--card); border:none !important; outline:none !important; border-radius:14px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px; cursor:pointer; transition:background 0.15s ease;" onmouseover="this.style.background='var(--hover)';" onmouseout="this.style.background='var(--card)';">
        <div style="display:flex; gap:12px; align-items:center; flex:1; min-width:0;">
          <div style="width:36px; height:36px; border-radius:10px; background:var(--input-bg); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--text);">
            ${getSkillRealLogoSvg(item.name, 20)}
          </div>
          <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
            <div style="font-size:13px; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(friendlyName)}</div>
            <div style="font-size:11.5px; color:var(--text-3); line-height:1.25; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(item.description || 'Autonomous capability module')}</div>
          </div>
        </div>
        <button onclick="event.stopPropagation(); window.skillsPageInstance.toggleSkill('${item.name}')" title="${isEnabled ? 'Disable' : 'Enable'} ${esc(friendlyName)}" style="width:26px; height:26px; border-radius:50%; background:var(--input-bg); border:none !important; outline:none !important; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease; color:${isEnabled ? '#16a34a' : 'var(--text)'};">
          <i data-lucide="${isEnabled ? 'check' : 'plus'}" style="width:14px; height:14px;"></i>
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
            <div style="font-size:13px; font-weight:600; color:var(--text); margin-bottom:8px;">Skill Badge</div>
            <div style="display:inline-flex; align-items:center; gap:8px; background:var(--input-bg); padding:6px 16px; border-radius:20px; font-size:12px; font-weight:600; color:var(--text);">
              ${getSkillRealLogoSvg(item.name, 16)}
              <span>${esc(friendlyName)}</span>
            </div>
          </div>

          <!-- PARAMETERS & METHODS TABLE -->
          <div style="margin-bottom:36px;">
            <div style="font-size:14px; font-weight:600; color:var(--text); margin-bottom:4px;">Available Parameters &amp; Methods</div>
            <p style="font-size:12px; color:var(--text-3); margin-top:0; margin-bottom:16px;">Function parameters registered for Gemini and Ollama tool invocation.</p>
            
            <div style="width:100%;">
              <div style="display:grid; grid-template-columns:160px 1fr 1fr; gap:16px; padding:8px 0; border-bottom:1px solid var(--border); font-size:11.5px; font-weight:600; color:var(--text-3);">
                <div>Parameter / Argument</div>
                <div>Description &amp; Type</div>
                <div>How to Use (Prompt)</div>
              </div>
              
              ${paramKeys.length === 0 ? `
                <div style="display:grid; grid-template-columns:160px 1fr 1fr; gap:16px; padding:12px 0; border-bottom:1px solid var(--border); font-size:12px; align-items:center;">
                  <div style="font-family:var(--font-mono); font-weight:600; color:var(--text); font-size:12px;">execute()</div>
                  <div style="color:var(--text-2); line-height:1.4; font-weight:400;">No input arguments required.</div>
                  <div style="font-family:var(--font-mono); color:var(--text-2); font-size:11.5px; font-weight:400;">${esc(examplePrompt)}</div>
                </div>
              ` : paramKeys.map(pk => {
                const pinfo = paramsObj[pk] || {};
                const ptype = pinfo.type || 'string';
                const isReq = reqList.includes(pk);
                const pdesc = pinfo.description || pk;
                return `
                  <div style="display:grid; grid-template-columns:160px 1fr 1fr; gap:16px; padding:12px 0; border-bottom:1px solid var(--border); font-size:12px; align-items:center;">
                    <div style="font-family:var(--font-mono); font-weight:600; color:var(--text); font-size:12px;">
                      ${esc(pk)} ${isReq ? '<span style="color:#ef4444; font-size:10px;">*</span>' : ''}
                    </div>
                    <div style="color:var(--text-2); line-height:1.4; font-weight:400;">
                      ${esc(pdesc)} <span style="font-size:11px; color:var(--text-3); font-family:var(--font-mono);">(${esc(ptype)})</span>
                    </div>
                    <div style="font-family:var(--font-mono); color:var(--text-2); font-size:11.5px; font-weight:400;">${esc(examplePrompt)}</div>
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
