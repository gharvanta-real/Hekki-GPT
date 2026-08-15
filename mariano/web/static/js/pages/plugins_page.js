/**
 * plugins_page.js — ChatGPT-Style Full-Page Plugins & MCP Connectors Hub for Hekki.
 *
 * Fully integrated with Hekki's Legacy CSS Tokens (var(--bg), var(--card), etc.).
 * Views: 'catalog' (2-column grid) | 'detail' (Tools & How-To-Use Table + Metadata)
 */

import { getCompanyLogoSvg } from './plugins_icons.js';

export class PluginsPage {
  constructor(showToast) {
    this._showToast = (title, msg, dur) => {
      if (typeof showToast === 'function') showToast(title, msg, dur);
    };
    this._view = 'catalog';
    this._selectedPluginId = null;
    this._searchQuery = '';
    this._root = null;
    this._mounted = false;
    this._mcpServers = [];
    this._allSkills = [];

    window.pluginsPageInstance = this;

    this._catalog = [
      {
        id: 'github', name: 'GitHub', icon: 'github', category: 'Featured',
        subtitle: 'Manage PRs, issues, CI/CD, and publish flows',
        description: 'Connect GitHub to let Hekki inspect repositories, create issues, review pull requests, and commit code changes directly via standard GitHub MCP protocol.',
        capabilities: ['Interactive', 'Write', 'Code Search'], developer: 'Official Hekki MCP Integration', transport: 'stdio (Local Process)', command: 'npx -y @modelcontextprotocol/server-github', badge: 'GitHub MCP',
        tools: [
          { name: 'list_issues', desc: 'List open/closed issues in a repository', example: '@GitHub list open issues in owner/repo' },
          { name: 'create_issue', desc: 'Create a new issue with title and body', example: '@GitHub create issue "Fix navbar overflow"' },
          { name: 'get_pull_request', desc: 'Inspect PR diffs, review comments, and status', example: '@GitHub show details of PR #42' },
          { name: 'search_code', desc: 'Search code across repository files', example: '@GitHub search_code "def react_loop"' }
        ]
      },
      {
        id: 'gdrive', name: 'Google Drive', icon: 'cloud', category: 'Featured',
        subtitle: 'Work across Drive files, Docs, Sheets, and Slides',
        description: 'Connect Google Drive to allow Hekki to search documents, read spreadsheets, summarize PDF uploads, and extract context from cloud storage.',
        capabilities: ['Read', 'Search', 'Document Analysis'], developer: 'Official Hekki MCP Integration', transport: 'stdio (Local Process)', command: 'npx -y @modelcontextprotocol/server-gdrive', badge: 'G-Drive MCP',
        tools: [
          { name: 'search_files', desc: 'Search files and folders by name or keyword', example: '@GoogleDrive search files "Q3 Financials"' },
          { name: 'read_file_content', desc: 'Read text/PDF document content', example: '@GoogleDrive read content of "Summary.pdf"' },
          { name: 'upload_file', desc: 'Upload local file to Google Drive folder', example: '@GoogleDrive upload "chart.png" to Drive' }
        ]
      },
      {
        id: 'slack', name: 'Slack', icon: 'message-square', category: 'Featured',
        subtitle: 'Read and manage Slack channels and messages',
        description: 'Connect Slack workspace so Hekki can monitor team discussions, post automated channel digests, and summarize unread threads.',
        capabilities: ['Interactive', 'Messaging', 'Write'], developer: 'Official Hekki MCP Integration', transport: 'stdio (Local Process)', command: 'npx -y @modelcontextprotocol/server-slack', badge: 'Slack MCP',
        tools: [
          { name: 'list_channels', desc: 'List all public/private Slack channels', example: '@Slack list all channels' },
          { name: 'read_channel_history', desc: 'Fetch recent messages from a channel', example: '@Slack get recent messages from #general' },
          { name: 'post_message', desc: 'Send message or notification to channel', example: '@Slack post "Deployment done" to #dev' }
        ]
      },
      {
        id: 'brave_search', name: 'Brave Search', icon: 'globe', category: 'Featured',
        subtitle: 'Private web search and deep online research',
        description: 'Empower Hekki with privacy-first real-time web search capabilities powered by the Brave Search API.',
        capabilities: ['Read', 'Search', 'Real-time Web'], developer: 'Hekki Agentic Research', transport: 'stdio (Local Process)', command: 'npx -y @modelcontextprotocol/server-brave-search', badge: 'Brave MCP',
        tools: [
          { name: 'web_search', desc: 'Execute real-time web search with domain filters', example: '@BraveSearch search AI news today' },
          { name: 'local_search', desc: 'Search local news, places, and info', example: '@BraveSearch search local weather updates' }
        ]
      },
      {
        id: 'notion', name: 'Notion', icon: 'file-text', category: 'Productivity',
        subtitle: 'Notion workflows for specs, research, and databases',
        description: 'Integrate Notion to allow Hekki to write daily journal notes, query project tracker databases, and update specification docs.',
        capabilities: ['Interactive', 'Write', 'Database Query'], developer: 'Notion Official / MCP Community', transport: 'stdio (Local Process)', command: 'npx -y @notionhq/notion-mcp-server', badge: 'Notion MCP',
        tools: [
          { name: 'query_database', desc: 'Filter and sort records in Notion DB', example: '@Notion query Tasks database' },
          { name: 'create_page', desc: 'Create a new Notion page under a parent', example: '@Notion create page "Meeting Notes"' },
          { name: 'append_block', desc: 'Append text or headings to an existing page', example: '@Notion append note to Daily Journal' }
        ]
      },
      {
        id: 'filesystem', name: 'Filesystem Workspace', icon: 'folder', category: 'Productivity',
        subtitle: 'Safe local file system CRUD and folder indexing',
        description: 'Grant Hekki direct access to explore, edit, create, and organize local directory paths on your device.',
        capabilities: ['Read', 'Write', 'Local Disk'], developer: 'Hekki Core Safety Engine', transport: 'stdio (Local Process)', command: 'npx -y @modelcontextprotocol/server-filesystem /', badge: 'Filesystem MCP',
        tools: [
          { name: 'list_directory', desc: 'List files and subfolders in path', example: '@Filesystem list directory C:/Users' },
          { name: 'read_file', desc: 'Read content of text/markdown/code file', example: '@Filesystem read file config.json' },
          { name: 'write_file', desc: 'Create or overwrite file with content', example: '@Filesystem write to log.txt' }
        ]
      },
      {
        id: 'postgres', name: 'PostgreSQL Database', icon: 'database', category: 'Development & Data',
        subtitle: 'Execute SQL queries, inspect tables, and analyze schema',
        description: 'Connect any local or remote PostgreSQL database to let Hekki execute read/write SQL queries and run data analytics.',
        capabilities: ['Data Analysis', 'SQL Query', 'Read/Write'], developer: 'Official Hekki MCP Integration', transport: 'stdio (Local Process)', command: 'npx -y @modelcontextprotocol/server-postgres', badge: 'Postgres MCP',
        tools: [
          { name: 'execute_query', desc: 'Run read-only SELECT SQL queries', example: '@Postgres SELECT * FROM users LIMIT 10' },
          { name: 'list_tables', desc: 'List all tables and column schemas', example: '@Postgres show all tables' },
          { name: 'describe_table', desc: 'Inspect column types and primary keys', example: '@Postgres describe table orders' }
        ]
      },
      {
        id: 'sqlite', name: 'SQLite Database', icon: 'hard-drive', category: 'Development & Data',
        subtitle: 'Query Hekki internal DB and local SQLite files',
        description: 'Connect local SQLite databases (including Hekki memory DB) for instant structured queries and tabular extraction.',
        capabilities: ['Read', 'SQL Query', 'Local DB'], developer: 'Hekki Internal Engine', transport: 'stdio (Local Process)', command: 'uvx mcp-server-sqlite --db-path data/hekki.db', badge: 'SQLite MCP',
        tools: [
          { name: 'read_query', desc: 'Run SELECT SQL queries on local SQLite DB', example: '@SQLite SELECT * FROM memory_ledger' },
          { name: 'list_tables', desc: 'View list of tables in SQLite file', example: '@SQLite list tables in hekki.db' }
        ]
      },
      {
        id: 'gmail', name: 'Gmail / Email', icon: 'mail', category: 'Productivity',
        subtitle: 'Read inbox threads, compose drafts, and auto-reply',
        description: 'Connect Gmail or IMAP/SMTP email server so Hekki can read unread threads, compose formal replies, summarize long email chains, and draft outbox messages.',
        capabilities: ['Read', 'Write', 'Email'], developer: 'Official Hekki MCP Integration', transport: 'stdio (Local Process)', command: 'npx -y @modelcontextprotocol/server-gmail', badge: 'Gmail MCP',
        tools: [
          { name: 'list_messages', desc: 'Fetch recent inbox email threads or search by sender', example: '@Email list unread messages from boss@company.com' },
          { name: 'send_email', desc: 'Send new email or compose message draft', example: '@Email send email to client@acme.com "Weekly Status Report"' },
          { name: 'get_thread', desc: 'Summarize full email conversation thread', example: '@Email summarize thread "Project Budget Approval"' }
        ]
      },
      {
        id: 'gcalendar', name: 'Google Calendar', icon: 'calendar', category: 'Productivity',
        subtitle: 'Manage meetings, check availability, and schedule events',
        description: 'Connect Google Calendar to let Hekki inspect your daily agenda, find open meeting slots, send invites, and set reminder alerts.',
        capabilities: ['Calendar', 'Schedule', 'Read/Write'], developer: 'Official Hekki MCP Integration', transport: 'stdio (Local Process)', command: 'npx -y @modelcontextprotocol/server-gcalendar', badge: 'Calendar MCP',
        tools: [
          { name: 'list_events', desc: 'View upcoming schedule for today or specific date', example: '@GoogleCalendar list events for today' },
          { name: 'create_event', desc: 'Schedule a new calendar meeting with attendees', example: '@GoogleCalendar schedule meeting "Team Sync" today at 4pm' }
        ]
      },
      {
        id: 'linear', name: 'Linear / Jira', icon: 'check-square', category: 'Productivity',
        subtitle: 'Sprint tracking, ticket creation, and project status',
        description: 'Connect Linear or Jira workspace to allow Hekki to inspect active sprint tickets, update task statuses, create issues, and assign team members.',
        capabilities: ['Task Tracking', 'Sprint Management', 'Write'], developer: 'Linear MCP Community', transport: 'stdio (Local Process)', command: 'npx -y @linear/mcp-server', badge: 'Linear MCP',
        tools: [
          { name: 'list_issues', desc: 'List active sprint tickets or assigned issues', example: '@Linear list my assigned sprint tickets' },
          { name: 'create_ticket', desc: 'Create new issue ticket with priority and label', example: '@Linear create ticket "Fix auth token expiry bug"' }
        ]
      },
      {
        id: 'figma', name: 'Figma', icon: 'figma', category: 'Development & Data',
        subtitle: 'Inspect design files, extract CSS tokens, and export assets',
        description: 'Connect Figma workspace so Hekki can inspect design frames, extract CSS color tokens & layout dimensions, and inspect design handoffs.',
        capabilities: ['Design Specs', 'CSS Export', 'Read'], developer: 'Figma MCP Community', transport: 'stdio (Local Process)', command: 'npx -y @figma/mcp-server', badge: 'Figma MCP',
        tools: [
          { name: 'get_file_nodes', desc: 'Inspect design frame layers and CSS properties', example: '@Figma inspect frame "Dashboard Header"' },
          { name: 'export_assets', desc: 'Export SVG/PNG icons or assets from design file', example: '@Figma export SVG icon "btn_search"' }
        ]
      }
    ];
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
      const [mcpRes, skillsRes] = await Promise.all([
        fetch('/api/mcp/servers').catch(() => null),
        fetch('/api/skills').catch(() => null)
      ]);
      if (mcpRes && mcpRes.ok) {
        const d = await mcpRes.json();
        this._mcpServers = d.servers || [];
      }
      if (skillsRes && skillsRes.ok) {
        this._allSkills = await skillsRes.json();
      }
    } catch(e) { console.warn('PluginsPage load error:', e); }
    this.render();
  }

  render() {
    if (!this._root) return;
    if (this._view === 'detail') this._renderDetail();
    else this._renderCatalog();
  }

  _isPluginConnected(item) {
    if (!item) return false;
    return this._mcpServers.some(s => (s.enabled || s.connected) && (s.id === item.id || s.name.toLowerCase() === item.name.toLowerCase()));
  }

  _renderCatalogGrid() {
    const gridContainer = this._root ? this._root.querySelector('#plugins-grid-container') : null;
    if (!gridContainer) return;

    const activeInput = document.activeElement;
    const isSearchInput = activeInput && activeInput.id === 'plugins-search-input';
    const selStart = isSearchInput ? activeInput.selectionStart : null;
    const selEnd = isSearchInput ? activeInput.selectionEnd : null;

    const seenPills = new Set();
    const installedList = [];
    for (const s of this._mcpServers) {
      if (!s.enabled && !s.connected) continue;
      const catItem = this._catalog.find(c => c.id === s.id || c.name.toLowerCase() === s.name.toLowerCase());
      const key = catItem ? catItem.id : s.id;
      if (seenPills.has(key)) continue;
      seenPills.add(key);
      installedList.push({ id: key, name: catItem ? catItem.name : s.name });
    }

    const filtered = this._catalog.filter(item => {
      if (!this._searchQuery) return true;
      const q = this._searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
    });
    const categories = ['Featured', 'Productivity', 'Development & Data'];

    gridContainer.innerHTML = `
      <div style="margin-bottom:24px;">
        <div style="font-size:13px; font-weight:500; color:var(--text-3); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
          <span>Connected Connectors</span>
          <span style="font-size:12px; background:var(--input-bg); padding:1px 8px; border-radius:20px; color:var(--text-2);">${installedList.length}</span>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          ${installedList.length === 0 ? `
            <div style="font-size:13px; color:var(--text-3); background:var(--card); border:none !important; padding:8px 14px; border-radius:20px; width:100%; box-sizing:border-box;">
              No active MCP connectors yet. Click the <strong>＋ icon</strong> on any plugin below to connect.
            </div>
          ` : installedList.map(s => {
            return `
              <div onclick="window.pluginsPageInstance.showDetail('${s.id}')" style="display:flex; align-items:center; gap:8px; background:var(--card); border:none !important; padding:6px 14px; border-radius:20px; cursor:pointer; transition:background 0.15s ease;">
                ${getCompanyLogoSvg(s.id, 16)}
                <span style="font-size:13.5px; font-weight:500; color:var(--text);">${esc(s.name)}</span>
                <span style="width:6px; height:6px; border-radius:50%; background:#16a34a; margin-left:2px;"></span>
              </div>`;
          }).join('')}
        </div>
      </div>

      ${categories.map(cat => {
        const items = filtered.filter(i => i.category === cat);
        if (items.length === 0) return '';
        return `
          <div style="margin-bottom:28px;">
            <h3 style="font-size:14px; font-weight:600; color:var(--text); margin-bottom:10px;">${cat}</h3>
            <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px;">
              ${items.map(item => this._renderPluginCard(item)).join('')}
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
      <div class="plugins-wrapper" style="display:flex; flex-direction:column; width:100%; height:100%; flex:1; min-width:0; overflow-y:auto; padding:40px 24px 48px; background:var(--bg); color:var(--text); font-family:var(--font); box-sizing:border-box;">
        <div style="max-width:780px; margin:0 auto; width:100%;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px; margin-bottom:24px; width:100%;">
            <div>
              <h1 style="font-size:19px; font-weight:600; color:var(--text); margin:0;">Plugins &amp; Connectors</h1>
              <p style="font-size:13px; color:var(--text-3); margin-top:2px;">Work with Hekki across your favorite tools, services, and databases.</p>
            </div>
            <div style="position:relative; width:220px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:14px; height:14px; color:var(--text-3); pointer-events:none;"><path d="M29,27.5859l-7.5521-7.5521a11.0177,11.0177,0,1,0-1.4141,1.4141L27.5859,29ZM4,13a9,9,0,1,1,9,9A9.01,9.01,0,0,1,4,13Z"/></svg>
              <input type="text" id="plugins-search-input" placeholder="Search plugins..." style="width:100%; height:34px; padding:0 12px 0 34px; background:var(--input-bg); border:1px solid var(--border, rgba(255,255,255,0.08)) !important; border-radius:17px; color:var(--text); font-size:13px; outline:none !important; box-shadow:none !important;" />
            </div>
          </div>
          <div id="plugins-grid-container"></div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons({ parent: this._root });
    const input = this._root.querySelector('#plugins-search-input');
    if (input) {
      input.addEventListener('input', (e) => {
        this._searchQuery = e.target.value;
        this._renderCatalogGrid();
      });
    }
  }

  _renderCatalog() {
    if (!this._root.querySelector('#plugins-grid-container')) {
      this._buildShell();
    }
    this._renderCatalogGrid();
  }

  _renderPluginCard(item) {
    const isConnected = this._isPluginConnected(item);
    return `
      <div onclick="window.pluginsPageInstance.showDetail('${item.id}')" style="background:var(--card); border:1px solid var(--border, rgba(255,255,255,0.06)) !important; outline:none !important; border-radius:12px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px; cursor:pointer; transition:background 0.15s ease;" onmouseover="this.style.background='var(--hover)';" onmouseout="this.style.background='var(--card)';">
        <div style="display:flex; gap:12px; align-items:center; flex:1; min-width:0;">
          <div style="width:38px; height:38px; border-radius:10px; background:var(--input-bg); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--text);">
            ${getCompanyLogoSvg(item.id, 20)}
          </div>
          <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
            <div style="font-size:15px; font-weight:500; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(item.name)}</div>
            <div style="font-size:13.5px; color:var(--text-3); line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(item.subtitle)}</div>
          </div>
        </div>
        <button onclick="event.stopPropagation(); window.pluginsPageInstance.toggleConnect('${item.id}')" title="${isConnected ? 'Disconnect' : 'Connect'} ${esc(item.name)}" style="width:34px; height:34px; min-width:34px; min-height:34px; border-radius:8px; background:${isConnected ? 'rgba(22,163,74,0.12)' : 'var(--input-bg)'}; border:none !important; outline:none !important; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease; color:${isConnected ? '#16a34a' : 'var(--text)'};">
          ${isConnected ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="#16a34a" style="width:14px;height:14px;display:block;flex-shrink:0;"><polygon points="13 24 4 15 5.414 13.586 13 21.171 26.586 7.586 28 9 13 24"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;display:block;flex-shrink:0;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>'}
        </button>
      </div>
    `;
  }

  showDetail(pluginId) {
    this._selectedPluginId = pluginId;
    this._view = 'detail';
    this.render();
  }

  showCatalog() {
    this._view = 'catalog';
    this.render();
  }

  _renderDetail() {
    const item = this._catalog.find(c => c.id === this._selectedPluginId) || {
      id: this._selectedPluginId, name: this._selectedPluginId, icon: 'plug', subtitle: 'MCP Connected Plugin',
      description: 'Connected MCP Server tool module.', capabilities: ['Read/Write'], developer: 'MCP Integration',
      transport: 'stdio', command: 'N/A', badge: 'MCP', tools: [{ name: 'run_tool', desc: 'Execute tool command', example: `@${this._selectedPluginId} run command` }]
    };

    const isConnected = this._isPluginConnected(item);
    const tools = item.tools || [];

    this._root.innerHTML = `
      <div class="plugins-detail-wrapper" style="display:flex; flex-direction:column; width:100%; height:100%; flex:1; min-width:0; overflow-y:auto; padding:40px 24px 48px; background:var(--bg); color:var(--text); font-family:var(--font); box-sizing:border-box;">
        <div style="max-width:780px; margin:0 auto 20px; width:100%;">
          <button onclick="window.pluginsPageInstance.showCatalog()" style="background:transparent; border:none; color:var(--text-2); font-size:13px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:6px; padding:0;">
            <i data-lucide="chevron-left" style="width:16px; height:16px;"></i> Plugins
          </button>
        </div>

        <div style="max-width:780px; margin:0 auto; width:100%;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; gap:20px;">
            <div style="display:flex; align-items:center; gap:14px;">
              <div style="width:52px; height:52px; border-radius:12px; background:var(--input-bg); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--text);">
                ${getCompanyLogoSvg(item.id, 28)}
              </div>
              <div>
                <h1 style="font-size:20px; font-weight:600; color:var(--text); margin:0;">${esc(item.name)}</h1>
                <p style="font-size:12.5px; color:var(--text-3); margin-top:2px;">${esc(item.subtitle)}</p>
              </div>
            </div>
            <button onclick="window.pluginsPageInstance.toggleConnect('${item.id}')" style="padding:6px 18px; border-radius:20px; border:none !important; font-size:12.5px; font-weight:600; cursor:pointer; transition:all 0.15s ease; ${isConnected ? 'background:rgba(239,68,68,0.1); color:#ef4444;' : 'background:var(--text); color:var(--bg);'}">
              ${isConnected ? 'Disconnect' : '＋ Connect'}
            </button>
          </div>

          <div style="font-size:13px; color:var(--text-2); line-height:1.6; margin-bottom:28px;">${esc(item.description)}</div>

          <!-- SKILL BADGE -->
          <div style="margin-bottom:28px;">
            <div style="font-size:14px; font-weight:600; color:var(--text); margin-bottom:8px;">Skill Badge</div>
            <div style="display:inline-flex; align-items:center; gap:8px; background:var(--input-bg); padding:6px 16px; border-radius:20px; font-size:13px; font-weight:500; color:var(--text);">
              ${getCompanyLogoSvg(item.id, 16)}
              <span>${esc(item.name)}</span>
            </div>
          </div>

          <!-- TOOLS & COMMANDS TABLE -->
          <div style="margin-bottom:36px;">
            <div style="font-size:14px; font-weight:600; color:var(--text); margin-bottom:4px;">Available Tools &amp; Commands</div>
            <p style="font-size:13px; color:var(--text-3); margin-top:0; margin-bottom:16px;">Tools exposed to Hekki for direct invocation via natural language prompts.</p>
            
            <div style="width:100%;">
              <div style="display:grid; grid-template-columns:160px 1fr 1fr; gap:16px; padding:8px 0; border-bottom:1px solid var(--border); font-size:12.5px; font-weight:500; color:var(--text-3);">
                <div>Tool Function</div>
                <div>Description</div>
                <div>How to Use (Prompt)</div>
              </div>
              
              ${tools.map(t => `
                <div style="display:grid; grid-template-columns:160px 1fr 1fr; gap:16px; padding:12px 0; border-bottom:1px solid var(--border); font-size:13px; align-items:center;">
                  <div style="font-family:var(--font-mono); font-weight:500; color:var(--text); font-size:13px;">${esc(t.name)}</div>
                  <div style="color:var(--text-2); line-height:1.4; font-weight:400;">${esc(t.desc)}</div>
                  <div style="font-family:var(--font-mono); color:var(--text-2); font-size:12.5px; font-weight:400;">${esc(t.example)}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- SYSTEM METADATA -->
          <div style="margin-bottom:28px;">
            <div style="font-size:14px; font-weight:600; color:var(--text); margin-bottom:12px;">System Metadata</div>
            <div style="width:100%;">
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Capabilities</span>
                <span style="color:var(--text); font-weight:400;">${(item.capabilities||[]).join(', ')}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Developer</span>
                <span style="color:var(--text); font-weight:400;">${esc(item.developer)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Category</span>
                <span style="color:var(--text); font-weight:400;">${esc(item.category)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Transport Protocol</span>
                <span style="color:var(--text); font-weight:400;">${esc(item.transport)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Executable Command</span>
                <span style="color:var(--text-2); font-family:var(--font-mono); font-size:11.5px; font-weight:400;">${esc(item.command)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:12.5px;">
                <span style="color:var(--text-3);">Status</span>
                <span style="font-weight:500; color:${isConnected ? '#16a34a' : 'var(--text-3)'}">${isConnected ? 'Connected' : 'Not Connected'}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    lucide.createIcons();
  }

  async toggleConnect(pluginId) {
    const item = this._catalog.find(c => c.id === pluginId);
    if (!item) return;
    const existing = this._mcpServers.find(s => s.id === pluginId || s.name.toLowerCase() === item.name.toLowerCase());

    try {
      if (existing) {
        this._showToast('MCP Connectors', `Disconnecting ${item.name}…`, 2500);
        const res = await fetch(`/api/mcp/servers/${existing.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to disconnect');
        this._showToast('MCP Connectors', `Disconnected ${item.name}`, 2500);
      } else {
        this._showToast('MCP Connectors', `Connecting ${item.name}…`, 2500);
        const body = {
          id: item.id,
          name: item.name, transport: 'stdio', enabled: true,
          command: item.command.split(' ')[0], args: item.command.split(' ').slice(1),
          env: item.envVar ? { [item.envVar]: '' } : {}
        };
        const res = await fetch('/api/mcp/servers', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Failed to connect');
        this._showToast('MCP Connectors', `Connected ${item.name}!`, 2500);
      }
    } catch (err) {
      this._showToast('MCP Connectors', `Error: ${err.message}`, 3000);
    }
    await this._loadData();
  }
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

