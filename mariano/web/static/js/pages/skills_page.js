/**
 * skills_page.js — Full-page Skills & Tools Management.
 *
 * Responsibilities:
 *   - List all available skills from /api/skills
 *   - Display skills as modern, premium cards
 *   - Search and filter skills by name/tags
 *   - Toggle enabled/disabled state of skills via API
 *   - Reset/Clean stats and enable all skills via API
 *
 * Usage (called by router.js callback):
 *   import { SkillsPage } from '/static/js/pages/skills_page.js';
 *   const page = new SkillsPage(showToast);
 *   page.mount(document.getElementById('skills-pane'));
 */

function getSkillIcon(name) {
  const normName = name.toLowerCase();
  if (normName.includes('search') || normName.includes('wiki')) return 'search';
  if (normName.includes('scrape') || normName.includes('web')) return 'globe';
  if (normName.includes('code') || normName.includes('run')) return 'code';
  if (normName.includes('stock') || normName.includes('trend')) return 'trending-up';
  if (normName.includes('news')) return 'newspaper';
  if (normName.includes('cpu') || normName.includes('system_info')) return 'cpu';
  if (normName.includes('excel') || normName.includes('sheet') || normName.includes('table')) return 'table';
  if (normName.includes('memory')) return 'brain';
  if (normName.includes('weather')) return 'cloud-sun';
  if (normName.includes('file')) return 'folder';
  if (normName.includes('control') || normName.includes('terminal')) return 'terminal';
  if (normName.includes('pdf') || normName.includes('text')) return 'file-text';
  if (normName.includes('calc') || normName.includes('math')) return 'calculator';
  if (normName.includes('lang') || normName.includes('translate')) return 'languages';
  if (normName.includes('research') || normName.includes('microscope')) return 'microscope';
  if (normName.includes('brief') || normName.includes('sun')) return 'sun';
  if (normName.includes('remind') || normName.includes('alarm') || normName.includes('bell')) return 'bell';
  if (normName.includes('image') || normName.includes('vision') || normName.includes('photo')) return 'image';
  if (normName.includes('evolver') || normName.includes('sparkle')) return 'aperture';
  if (normName.includes('ui') || normName.includes('builder') || normName.includes('layout')) return 'layout';
  return 'compass';
}

function formatSkillName(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export class SkillsPage {
  constructor(showToast) {
    this._showToast = showToast || (() => {});
    this._skills = [];
    this._searchQuery = '';
    this._root = null;
    this._mounted = false;
  }

  /** Mount the skills manager into the given container element. */
  mount(container) {
    if (this._mounted && this._root === container) {
      console.log('[SkillsPage] Already mounted, refreshing...');
      this.refresh();
      return;
    }
    console.log('[SkillsPage] Mounting into:', container?.id);
    this._root = container;
    this._mounted = true;
    this._renderLayout();
    this._load();
  }

  /** Refresh skills list. */
  refresh() {
    if (!this._mounted) return;
    this._load();
  }

  // ── Load Data ──────────────────────────────────────────

  async _load() {
    this._renderLoading();
    try {
      const res = await fetch('/api/skills');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this._skills = await res.json();
      this._renderSkills();
    } catch (err) {
      this._renderError(err.message);
    }
  }

  // ── API Handlers ──────────────────────────────────────

  async _toggleSkill(name, enabled) {
    try {
      const res = await fetch('/api/skills/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, enabled })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      // Update local state
      const skill = this._skills.find(s => s.name === name);
      if (skill) {
        skill.enabled = enabled;
      }
      this._renderSkills();
      
      this._showToast(
        enabled ? 'Skill Enabled' : 'Skill Disabled',
        `Successfully ${enabled ? 'enabled' : 'disabled'} "${formatSkillName(name)}" tool.`,
        2500
      );
    } catch (err) {
      this._showToast('Action Failed', `Failed to toggle skill: ${err.message}`, 3000);
      this._load(); // Reload to sync with backend
    }
  }

  async _cleanStats() {
    try {
      const res = await fetch('/api/skills/clean', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      this._showToast('Stats Cleaned', 'Successfully reset latency and call statistics across all capabilities.', 2500);
      this._load();
    } catch (err) {
      this._showToast('Action Failed', `Failed to clean stats: ${err.message}`, 3000);
    }
  }

  async _enableAllSkills() {
    try {
      // Toggle all disabled skills back to enabled
      const disabledSkills = this._skills.filter(s => !s.enabled);
      if (disabledSkills.length === 0) {
        this._showToast('Active Skills', 'All skills are already enabled.', 2000);
        return;
      }

      await Promise.all(disabledSkills.map(s => 
        fetch('/api/skills/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: s.name, enabled: true })
        })
      ));

      this._showToast('All Enabled', 'Successfully restored all skills to active state.', 2500);
      this._load();
    } catch (err) {
      this._showToast('Action Failed', `Failed to restore default skills: ${err.message}`, 3000);
    }
  }

  // ── UI Rendering ───────────────────────────────────────

  _renderLayout() {
    if (!this._root) return;
    this._root.innerHTML = `
      <div id="skills-page-wrapper">
        <div class="skills-header">
          <div class="skills-title-group">
            <h1 class="skills-heading">Capabilities Engine</h1>
            <p class="skills-subheading">Enable, disable, and monitor autonomous tool registry modules.</p>
          </div>
          <div class="skills-controls">
            <div class="skills-search-wrapper">
              <i data-lucide="search" class="search-icon"></i>
              <input type="text" placeholder="Search capabilities..." id="skills-search-input" value="${this._searchQuery}">
            </div>
            <button class="skills-btn danger" id="btn-skills-clean" title="Reset latency and call statistics across all skills">
              <i data-lucide="refresh-cw"></i>
              <span>Clean Stats</span>
            </button>
          </div>
        </div>
        <div class="skills-top-fadeout"></div>
        <div class="skills-body" id="skills-body-content">
          <!-- Dynamically populated skills grid goes here -->
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    // Bind controls
    const searchInput = this._root.querySelector('#skills-search-input');
    searchInput?.addEventListener('input', (e) => {
      this._searchQuery = e.target.value.toLowerCase().trim();
      this._renderSkills();
    });

    this._root.querySelector('#btn-skills-clean')?.addEventListener('click', () => {
      if (window.showCustomConfirm) {
        window.showCustomConfirm(
          'Reset Statistics',
          'Are you sure you want to clear latencies, success rates, and call counts for all skills?',
          (yes) => { if (yes) this._cleanStats(); }
        );
      } else {
        if (confirm('Clear statistics for all skills?')) this._cleanStats();
      }
    });
  }

  _renderLoading() {
    const body = this._root?.querySelector('#skills-body-content');
    if (!body) return;

    // Create 5 skeleton rows mimicking actual skills-row structure
    const skeletonRows = Array(5).fill(0).map(() => `
      <div class="skills-row" style="pointer-events:none; opacity:0.8;">
        <div class="skills-col-info">
          <div class="skills-title-row" style="display:flex; align-items:center; gap:8px;">
            <div class="skeleton-shimmer skeleton-circle" style="width:24px; height:24px; opacity:0.15"></div>
            <div class="skeleton-shimmer skeleton-bar" style="width:140px; height:13px; opacity:0.15; margin:0"></div>
            <div class="skeleton-shimmer skeleton-bar" style="width:40px; height:10px; opacity:0.1; margin:0"></div>
            <div class="skeleton-shimmer skeleton-bar" style="width:50px; height:14px; border-radius:10px; opacity:0.1; margin:0"></div>
          </div>
          <div class="skeleton-shimmer skeleton-bar" style="width:85%; height:11px; margin-top:8px; opacity:0.1"></div>
        </div>
        <div class="skills-col-tags">
          <div class="skills-tags-list" style="display:flex; gap:6px;">
            <div class="skeleton-shimmer skeleton-bar" style="width:45px; height:18px; border-radius:12px; opacity:0.08; margin:0"></div>
            <div class="skeleton-shimmer skeleton-bar" style="width:55px; height:18px; border-radius:12px; opacity:0.08; margin:0"></div>
          </div>
        </div>
        <div class="skills-col-action">
          <div class="skeleton-shimmer" style="width:34px; height:18px; border-radius:10px; opacity:0.12"></div>
        </div>
      </div>
    `).join('');

    body.innerHTML = `
      <div class="skills-list-view">
        <div class="skills-row-header">
          <div class="skills-col-info">Skill Name & Description</div>
          <div class="skills-col-tags">Tags</div>
          <div class="skills-col-action">Toggle</div>
        </div>
        ${skeletonRows}
      </div>
    `;
  }

  _renderError(msg) {
    const body = this._root?.querySelector('#skills-body-content');
    if (!body) return;
    body.innerHTML = `
      <div class="skills-empty">
        <div class="skills-empty-icon"><i data-lucide="alert-circle" style="color:var(--orange)"></i></div>
        <div class="skills-empty-text" style="color:var(--orange)">Failed to load skills: ${msg}</div>
        <button class="skills-btn" onclick="location.reload()" style="margin-top:12px">Retry Connection</button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  _renderSkills() {
    const body = this._root?.querySelector('#skills-body-content');
    if (!body) return;

    // Filter skills by search query
    const filtered = this._skills.filter(s => {
      const nameMatch = s.name.toLowerCase().includes(this._searchQuery);
      const descMatch = (s.description || '').toLowerCase().includes(this._searchQuery);
      const tagMatch = (s.tags || []).some(t => t.toLowerCase().includes(this._searchQuery));
      return nameMatch || descMatch || tagMatch;
    });

    if (filtered.length === 0) {
      body.innerHTML = `
        <div class="skills-empty">
          <div class="skills-empty-icon"><i data-lucide="inbox"></i></div>
          <div class="skills-empty-text">No capabilities match your search</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:4px">Try searching for code, search, files, or api.</div>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    body.innerHTML = `
      <div class="skills-list-view">
        <div class="skills-row-header">
          <div class="skills-col-info">Skill Name & Description</div>
          <div class="skills-col-tags">Tags</div>
          <div class="skills-col-action">Toggle</div>
        </div>
        ${filtered.map(s => this._buildSkillRow(s)).join('')}
      </div>
    `;

    // Compile SVG Lucide outline icons
    if (window.lucide) lucide.createIcons();

    // Bind individual card toggle switches
    body.querySelectorAll('.skill-toggle-input').forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        const skillName = e.target.dataset.name;
        const enabled = e.target.checked;
        this._toggleSkill(skillName, enabled);
      });
    });
  }

  _buildSkillRow(s) {
    const isEnabled = s.enabled !== false; // Default to true if not specified
    const iconName = getSkillIcon(s.name);
    const friendlyName = formatSkillName(s.name);

    // Build tags markup
    const tagsMarkup = (s.tags || []).slice(0, 3).map(tag => `
      <span class="skill-row-tag">${this._escapeHtml(tag)}</span>
    `).join('');

    return `
      <div class="skills-row ${isEnabled ? '' : 'disabled-row'}">
        <div class="skills-col-info">
          <div class="skills-title-row">
            <span class="skills-icon-wrapper"><i data-lucide="${iconName}"></i></span>
            <span class="skills-name-text">${this._escapeHtml(friendlyName)}</span>
            <span class="skills-ver-text">v${s.version || '1.0.0'}</span>
            <span class="skills-status-badge ${isEnabled ? 'active' : 'inactive'}">${isEnabled ? 'Active' : 'Disabled'}</span>
          </div>
          <div class="skills-desc-text">${this._escapeHtml(s.description || 'No description provided.')}</div>
        </div>
        <div class="skills-col-tags">
          <div class="skills-tags-list">${tagsMarkup}</div>
        </div>
        <div class="skills-col-action">
          <label class="skills-toggle">
            <input type="checkbox" class="skill-toggle-input" data-name="${s.name}" ${isEnabled ? 'checked' : ''}>
            <span class="skills-toggle-track"></span>
          </label>
        </div>
      </div>
    `;
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
