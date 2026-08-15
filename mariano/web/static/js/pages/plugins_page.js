/**
 * plugins_page.js — ChatGPT-Style Full-Page Plugins & MCP Connectors Hub for Hekki.
 *
 * Fully integrated with Hekki's Legacy CSS Tokens (var(--bg), var(--card), etc.).
 * Views: 'catalog' (2-column grid) | 'detail' (Tools & How-To-Use Table + Metadata)
 */

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
        <div style="font-size:11.5px; font-weight:600; color:var(--text-3); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
          <span>Connected Connectors</span>
          <span style="font-size:10.5px; background:var(--input-bg); padding:1px 8px; border-radius:20px; color:var(--text-2);">${installedList.length}</span>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          ${installedList.length === 0 ? `
            <div style="font-size:11.5px; color:var(--text-3); background:var(--card); border:none !important; padding:8px 14px; border-radius:20px; width:100%; box-sizing:border-box;">
              No active MCP connectors yet. Click the <strong>＋ icon</strong> on any plugin below to connect.
            </div>
          ` : installedList.map(s => {
            return `
              <div onclick="window.pluginsPageInstance.showDetail('${s.id}')" style="display:flex; align-items:center; gap:8px; background:var(--card); border:none !important; padding:6px 14px; border-radius:20px; cursor:pointer; transition:background 0.15s ease;">
                ${getCompanyLogoSvg(s.id, 16)}
                <span style="font-size:12px; font-weight:600; color:var(--text);">${esc(s.name)}</span>
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
            <h3 style="font-size:13px; font-weight:600; color:var(--text); margin-bottom:10px;">${cat}</h3>
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
              <h1 style="font-size:18px; font-weight:600; color:var(--text); margin:0;">Plugins &amp; Connectors</h1>
              <p style="font-size:12px; color:var(--text-3); margin-top:2px;">Work with Hekki across your favorite tools, services, and databases.</p>
            </div>
            <div style="position:relative; width:220px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:13px; height:13px; color:var(--text-3); pointer-events:none;"><path d="M29,27.5859l-7.5521-7.5521a11.0177,11.0177,0,1,0-1.4141,1.4141L27.5859,29ZM4,13a9,9,0,1,1,9,9A9.01,9.01,0,0,1,4,13Z"/></svg>
              <input type="text" id="plugins-search-input" placeholder="Search plugins..." style="width:100%; height:30px; padding:0 12px 0 32px; background:var(--input-bg); border:none !important; border-radius:20px; color:var(--text); font-size:11.5px; outline:none !important; box-shadow:none !important;" />
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
      <div onclick="window.pluginsPageInstance.showDetail('${item.id}')" style="background:var(--card); border:none !important; outline:none !important; border-radius:14px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px; cursor:pointer; transition:background 0.15s ease;" onmouseover="this.style.background='var(--hover)';" onmouseout="this.style.background='var(--card)';">
        <div style="display:flex; gap:12px; align-items:center; flex:1; min-width:0;">
          <div style="width:36px; height:36px; border-radius:10px; background:var(--input-bg); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--text);">
            ${getCompanyLogoSvg(item.id, 20)}
          </div>
          <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
            <div style="font-size:13px; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(item.name)}</div>
            <div style="font-size:11.5px; color:var(--text-3); line-height:1.25; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(item.subtitle)}</div>
          </div>
        </div>
        <button onclick="event.stopPropagation(); window.pluginsPageInstance.toggleConnect('${item.id}')" title="${isConnected ? 'Disconnect' : 'Connect'} ${esc(item.name)}" style="width:36px; height:36px; min-width:36px; min-height:36px; border-radius:10px; background:${isConnected ? 'rgba(22,163,74,0.12)' : 'var(--input-bg)'}; border:none !important; outline:none !important; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease; color:${isConnected ? '#16a34a' : 'var(--text)'};">
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

          <div style="margin-bottom:28px;">
            <div style="font-size:13px; font-weight:600; color:var(--text); margin-bottom:8px;">Skill Badge</div>
            <div style="display:inline-flex; align-items:center; gap:8px; background:var(--input-bg); padding:6px 16px; border-radius:20px; font-size:12px; font-weight:600; color:var(--text);">
              ${getCompanyLogoSvg(item.id, 16)}
              <span>${esc(item.name)}</span>
            </div>
          </div>

          <!-- AVAILABLE TOOLS & COMMANDS -->
          <div style="margin-bottom:36px;">
            <div style="font-size:14px; font-weight:600; color:var(--text); margin-bottom:4px;">Available Tools &amp; Commands</div>
            <p style="font-size:12px; color:var(--text-3); margin-top:0; margin-bottom:16px;">These function calls are automatically exposed to Hekki when connected.</p>
            <div style="width:100%;">
              <div style="display:grid; grid-template-columns:160px 1fr 1fr; gap:16px; padding:8px 0; border-bottom:1px solid var(--border); font-size:11.5px; font-weight:600; color:var(--text-3);">
                <div>Tool / Method</div>
                <div>Description</div>
                <div>How to Use (Prompt)</div>
              </div>
              ${tools.map(t => `
                <div style="display:grid; grid-template-columns:160px 1fr 1fr; gap:16px; padding:12px 0; border-bottom:1px solid var(--border); font-size:12px; align-items:center;">
                  <div style="font-family:var(--font-mono); font-weight:600; color:var(--text); font-size:12px;">${esc(t.name)}</div>
                  <div style="color:var(--text-2); line-height:1.4; font-weight:400;">${esc(t.desc)}</div>
                  <div style="font-family:var(--font-mono); color:var(--text-2); font-size:11.5px; font-weight:400;">${esc(t.example)}</div>
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

function getCompanyLogoSvg(id, size = 16) {
  const norm = String(id||'').toLowerCase();
  if (norm.includes('gmail') || norm.includes('email') || norm === 'mail') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M28,6H4A2,2,0,0,0,2,8V24a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V8A2,2,0,0,0,28,6ZM25.8,8,16,14.78,6.2,8ZM4,24V8.91l11.43,7.91a1,1,0,0,0,1.14,0L28,8.91V24Z"/></svg>`;
  }
  if (norm.includes('brave')) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="width:${size}px;height:${size}px;display:block;"><path fill="#FF1B2D" d="M12 0L2 6l3.5 13.5L12 24l6.5-4.5L22 6z"/><path fill="#FF6500" d="M12 3.2L4.5 7.6l2.6 10.3L12 21l4.9-3.1 2.6-10.3z"/><path fill="#FFF" d="M12 6.5l3.5 2.1-1.3 5.3-2.2 1.4-2.2-1.4-1.3-5.3z"/></svg>`;
  }
  if (norm.includes('calendar') || norm.includes('gcalendar')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M26,4h-4V2h-2v2h-8V2h-2v2H6C4.9,4,4,4.9,4,6v20c0,1.1,0.9,2,2,2h20c1.1,0,2-0.9,2-2V6C28,4.9,27.1,4,26,4z M26,26H6V12h20V26z M26,10H6V6h4v2h2V6h8v2h2V6h4V10z"/></svg>`;
  }
  if (norm.includes('gdrive') || norm.includes('drive')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M28,20H26v2h2v6H4V22H14V20H4a2,2,0,0,0-2,2v6a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V22A2,2,0,0,0,28,20Z"/><circle cx="7" cy="25" r="1"/><path d="M21,14a2.98,2.98,0,0,0-2,.81l-4-2.4A2.96,2.96,0,0,0,15,12a2.96,2.96,0,0,0,0-.41L18.96,9.19A3,3,0,1,0,18,7a2.93,2.93,0,0,0,0,.41L14,9.81a3,3,0,1,0,0,4.38l4,2.4A2.93,2.93,0,0,0,18,17a3,3,0,1,0,3-3Zm0-8a1,1,0,1,1-1,1A1,1,0,0,1,21,6Zm-9,7a1,1,0,1,1,1-1A1,1,0,0,1,12,13Zm9,5a1,1,0,1,1,1-1A1,1,0,0,1,21,18Z"/></svg>`;
  }
  if (norm.includes('linear')) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="width:${size}px;height:${size}px;display:block;"><path fill="#5E6AD2" d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12Z"/><path fill="#FFFFFF" d="M8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0z"/></svg>`;
  }
  if (norm.includes('figma')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M23.6,11.6c1-.6,1.7-1.5,2.1-2.6.4-1.1.4-2.2.1-3.3-.3-1.1-1-2-1.9-2.7-.9-.7-2.1-1-3.2-1h-9.2c-1.2,0-2.3.4-3.2,1C7.2,3.7,6.6,4.7,6.2,5.7,5.9,6.8,5.9,8,6.3,9c.4,1.1,1.1,2,2.1,2.6-.7.5-1.4,1.1-1.8,1.9-.4.8-.6,1.6-.6,2.5,0,.9.2,1.7.6,2.5.4.8,1,1.4,1.8,1.9-1,.6-1.7,1.5-2.1,2.6-.4,1.1-.4,2.2-.1,3.3.3,1.1,1,2,2,2.7.9.7,2.1,1,3.2,1,1.4,0,2.8-.6,3.9-1.5,1-1,1.6-2.3,1.6-3.7v-4.8c1,.9,2.3,1.4,3.6,1.4h.1c1.2,0,2.3-.4,3.2-1,.9-.7,1.6-1.6,1.9-2.7.3-1.1.3-2.2-.1-3.3C25.3,13.1,24.5,12.2,23.6,11.6ZM16.9,3.7h3.7c.5,0,1,0,1.4.2.5.2.9.4,1.2.8.4.3.6.7.8,1.2.2.5.3.9.3,1.4,0,.5-.1,1-.3,1.4-.2.4-.5.8-.8,1.2-.4.3-.8.6-1.2.8-.5.2-1,.2-1.4.2h-3.7V3.7ZM11.4,3.7h3.7v7h-3.7c-.9,0-1.8-.4-2.4-1.1-.6-.7-.9-1.6-.9-2.5s.4-1.8,1-2.4c.6-.7,1.5-1.1,2.4-1.2ZM7.8,16c0-.9.4-1.8,1.1-2.5.7-.7,1.6-1,2.6-1h3.7v7h-3.7c-1,0-1.9-.4-2.6-1C8.2,17.8,7.8,16.9,7.8,16ZM15.1,24.7c0,1-.4,1.9-1.1,2.5-.7.7-1.6,1-2.6,1-.5,0-1,0-1.4-.2-.5-.2-.9-.4-1.2-.7-.4-.3-.6-.7-.8-1.2-.2-.4-.3-.9-.3-1.4,0-.5.1-1,.3-1.4.2-.4.5-.8.8-1.2.4-.3.8-.6,1.2-.8.5-.2,1-.2,1.4-.2h3.7ZM20.6,19.5h-.1c-.9,0-1.8-.4-2.4-1.1-.6-.7-1-1.5-1-2.4,0-.9.4-1.8,1-2.4.6-.7,1.5-1,2.4-1.1h.1c.5,0,1,0,1.4.2.5.2.9.4,1.2.8.4.3.6.7.8,1.2.2.4.3.9.3,1.4,0,.5-.1,1-.3,1.4-.2.4-.5.8-.8,1.2-.4.3-.8.6-1.2.8C21.6,19.5,21.1,19.5,20.6,19.5Z"/></svg>`;
  }
  if (norm.includes('postgres')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M22.98,28.88c-4.05,0-5.59-1.06-5.59-2.83a2.21,2.21,0,0,1,2.14-2.3v-.25a1.97,1.97,0,0,1-1.54-2c0-1.24,1.06-1.86,2.21-2.12v-.09a3.62,3.62,0,0,1-2.18-3.5c0-2.44,1.72-4.07,4.97-4.07a6.68,6.68,0,0,1,2.09.3v-.39a1.53,1.53,0,0,1,1.7-1.75h1.86v2.25H26.08v.32a3.59,3.59,0,0,1,1.86,3.33c0,2.41-1.7,4.02-4.97,4.02a7.37,7.37,0,0,1-1.84-.21,1.23,1.23,0,0,0-.85,1.08c0,.6.51.9,1.56.9h3.22c2.94,0,4.21,1.26,4.21,3.43C29.28,27.52,27.58,28.88,22.98,28.88Zm1.49-4.74H20.38A1.47,1.47,0,0,0,19.76,25.38c0,.92.69,1.47,2.53,1.47h1.47c1.91,0,2.76-.48,2.76-1.49C26.52,24.6,25.97,24.14,24.47,24.14Zm.67-8.16v-.39c0-1.22-.76-1.84-2.16-1.84s-2.16.62-2.16,1.84v.39c0,1.2.76,1.84,2.16,1.84S25.14,17.17,25.14,15.97Z"/><path d="M4.6,24V7.95h7.22c2.97,0,4.76,2,4.76,4.97,0,2.99-1.79,4.97-4.76,4.97H7.64V24Zm3.04-8.74h3.91a1.69,1.69,0,0,0,1.88-1.82V12.39a1.67,1.67,0,0,0-1.88-1.79H7.64Z"/></svg>`;
  }
  if (norm.includes('word')) return `<img src="/static/icons/ms-word.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  if (norm.includes('excel')) return `<img src="/static/icons/excel.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  if (norm.includes('gcloud') || norm.includes('cloud')) return `<img src="/static/icons/google-cloud.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;" />`;
  if (norm.includes('filesystem') || norm.includes('file')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M25.7,9.3l-7-7C18.5,2.1,18.3,2,18,2H8C6.9,2,6,2.9,6,4v24c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V10C26,9.7,25.9,9.5,25.7,9.3z M18,4.4l5.6,5.6H18V4.4z M24,28H8V4h8v6c0,1.1,0.9,2,2,2h6V28z"/><rect x="10" y="22" width="12" height="2"/><rect x="10" y="16" width="12" height="2"/></svg>`;
  }
  if (norm.includes('github')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path fill-rule="evenodd" d="M16,2a14,14,0,0,0-4.43,27.28c.7.13,1-.3,1-.67s0-1.21,0-2.38c-3.89.84-4.71-1.88-4.71-1.88A3.71,3.71,0,0,0,6.24,22.3c-1.27-.86.1-.85.1-.85A2.94,2.94,0,0,1,8.48,22.9a3,3,0,0,0,4.08,1.16,2.93,2.93,0,0,1,.88-1.87c-3.1-.36-6.37-1.56-6.37-6.92a5.4,5.4,0,0,1,1.44-3.76,5,5,0,0,1,.14-3.7s1.17-.38,3.85,1.43a13.3,13.3,0,0,1,7,0c2.67-1.81,3.84-1.43,3.84-1.43a5,5,0,0,1,.14,3.7,5.4,5.4,0,0,1,1.44,3.76c0,5.38-3.27,6.56-6.39,6.91a3.33,3.33,0,0,1,.95,2.59c0,1.87,0,3.38,0,3.84s.25.81,1,.67A14,14,0,0,0,16,2Z"/></svg>`;
  }
  if (norm.includes('slack')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M9.04,19.17A2.52,2.52,0,1,1,6.52,16.65H9.04Z"/><path d="M10.31,19.17a2.52,2.52,0,0,1,5.04,0v6.31a2.52,2.52,0,1,1-5.04,0Z"/><path d="M12.83,9.04A2.52,2.52,0,1,1,15.36,6.52V9.04Z"/><path d="M12.83,10.31a2.52,2.52,0,0,1,0,5.04H6.52a2.52,2.52,0,1,1,0-5.04Z"/><path d="M22.96,12.83a2.52,2.52,0,1,1,2.52,2.52H22.96Z"/><path d="M21.69,12.83a2.52,2.52,0,0,1-5.04,0V6.52a2.52,2.52,0,1,1,5.04,0Z"/><path d="M19.17,22.96a2.52,2.52,0,1,1-2.52,2.52V22.96Z"/><path d="M19.17,21.69a2.52,2.52,0,0,1,0-5.04h6.31a2.52,2.52,0,1,1,0,5.04Z"/></svg>`;
  }
  if (norm.includes('notion')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><path d="M24,25h-3v-3h3v3ZM29,22h-3v3h3v-3ZM24,27h-3v3h3v-3ZM29,27h-3v3h3v-3ZM20,8h-8v2h8v-2ZM17,28H6v-4h2v-2h-2v-5h2v-2h-2v-5h2v-2h-2v-4h18v15h2V4c0-1.1-.9-2-2-2H6c-1.1,0-2,.9-2,2v4h-2v2h2v5h-2v2h2v5h-2v2h2v4c0,1.1.9,2,2,2h11v-2ZM20,15h-8v2h8v-2Z"/></svg>`;
  }
  if (norm.includes('sqlite') || norm.includes('sql')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;display:block;"><polygon points="24 21 24 9 22 9 22 23 30 23 30 21 24 21"/><path d="M18,9H14a2,2,0,0,0-2,2V21a2,2,0,0,0,2,2h1v2a2,2,0,0,0,2,2h2V25H17V23h1a2,2,0,0,0,2-2V11A2,2,0,0,0,18,9ZM14,21V11h4V21Z"/><path d="M8,23H2V21H8V17H4a2,2,0,0,1-2-2V11A2,2,0,0,1,4,9h6v2H4v4H8a2,2,0,0,1,2,2v4A2,2,0,0,1,8,23Z"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-plugins" style="width:${size}px; height:${size}px; display:inline-block; vertical-align:middle;"><path d="M9 2v6M15 2v6M12 17v5M5 8h14a1 1 0 0 1 1 1v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9a1 1 0 0 1 1-1z"></path></svg>`;
}
