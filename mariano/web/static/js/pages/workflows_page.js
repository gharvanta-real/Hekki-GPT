/**
 * workflows_page.js — Autonomous Workflow Engine & Pipeline Studio for Hekki.
 * Features: Visual DAG pipelines, real-time node triggers, live step execution logs.
 */

export class WorkflowsPage {
  constructor(showToast) {
    this._showToast = (title, msg, dur) => {
      if (typeof showToast === 'function') showToast(title, msg, dur);
    };
    this._root = null;
    this._mounted = false;
    this._workflows = [];
    this._activeRun = null;
    this._pollInterval = null;
    window.workflowsPageInstance = this;
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
    const defaultWorkflows = [
      {
        id: "morning_digest",
        name: "Autonomous Tech & Market Digest",
        description: "Scrapes latest tech news and stock trends, summarizes key points with Gemini, and saves a daily briefing note.",
        category: "Intelligence",
        icon: "globe",
        enabled: true,
        schedule: "0 8 * * *",
        nodes: [
          { id: "n1", type: "trigger", label: "Schedule Trigger (Daily 8:00 AM)", config: { schedule: "0 8 * * *" } },
          { id: "n2", type: "scraper", label: "Scrape Tech & Market News", config: { sources: ["TechCrunch", "HackerNews", "NSE/BSE"] } },
          { id: "n3", type: "agent", label: "Analyze & Synthesize Insights", config: { prompt: "Summarize top breakthroughs." } },
          { id: "n4", type: "save", label: "Save to Knowledge Memory", config: { target: "memory_digest" } }
        ]
      },
      {
        id: "code_review_pipeline",
        name: "Automated Codebase Sentinel",
        description: "Monitors local file changes, checks code style/security, and flags potential bugs.",
        category: "Development",
        icon: "code",
        enabled: true,
        schedule: "On File Change",
        nodes: [
          { id: "n1", type: "trigger", label: "Watchdog File Trigger", config: { watch_dir: "./" } },
          { id: "n2", type: "agent", label: "Static Code Inspection", config: { prompt: "Verify file integrity." } },
          { id: "n3", type: "notify", label: "System Toast Alert", config: { severity: "info" } }
        ]
      },
      {
        id: "knowledge_builder",
        name: "Concept Triples Extractor",
        description: "Extracts entities, concepts, and relationships from recent chats and builds the interactive Mind Map.",
        category: "Research",
        icon: "git-branch",
        enabled: true,
        schedule: "Hourly",
        nodes: [
          { id: "n1", type: "trigger", label: "Hourly Sync Trigger", config: { interval_m: 60 } },
          { id: "n2", type: "agent", label: "Extract Entity Triples", config: { prompt: "Extract semantic triples." } },
          { id: "n3", type: "save", label: "Sync with Knowledge Graph", config: { target: "knowledge_graph.json" } }
        ]
      }
    ];

    try {
      const res = await fetch('/api/workflows');
      if (res.ok) {
        const d = await res.json();
        this._workflows = (d.workflows && d.workflows.length > 0) ? d.workflows : defaultWorkflows;
      } else {
        this._workflows = defaultWorkflows;
      }
    } catch (e) {
      console.warn('Workflows fallback used:', e);
      this._workflows = defaultWorkflows;
    }
    this.render();
  }

  render() {
    if (!this._root) return;
    this._root.innerHTML = `
      <div class="workflows-wrapper" style="display:flex; flex-direction:column; width:100%; height:100%; flex:1; min-width:0; overflow-y:auto; padding:40px 24px 48px; background:var(--bg); color:var(--text); font-family:var(--font); box-sizing:border-box;">
        <div style="max-width:860px; margin:0 auto; width:100%;">
          
          <!-- Header -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; width:100%; gap:12px; flex-wrap:wrap;">
            <div>
              <h1 style="font-size:18px; font-weight:400; color:var(--text); margin:0;">Autonomous Workflow Studio</h1>
              <p style="font-size:13px; color:var(--text-3); margin-top:2px; font-weight:400;">Build, schedule, and execute multi-step automated agent pipelines.</p>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <button onclick="window.workflowsPageInstance.openCreateModal()" style="height:34px; padding:0 16px; background:var(--card); border:1px solid var(--border) !important; border-radius:17px; color:var(--text); font-size:13px; font-weight:400; cursor:pointer; display:flex; align-items:center; gap:6px; transition:background 0.15s ease;">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>Create Workflow</span>
              </button>
              <button onclick="window.workflowsPageInstance.runAll()" style="height:34px; padding:0 16px; background:var(--card); border:none !important; border-radius:17px; color:var(--text); font-size:13px; font-weight:400; cursor:pointer; display:flex; align-items:center; gap:6px; transition:background 0.15s ease;">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <span>Execute All</span>
              </button>
            </div>
          </div>

          <!-- Active Execution Banner (if running) -->
          <div id="wf-live-run-container">
            ${this._renderLiveRunBanner()}
          </div>

          <!-- Workflows Grid -->
          <div style="display:grid; grid-template-columns:1fr; gap:16px; margin-top:16px;">
            ${this._workflows.map(wf => this._renderWorkflowCard(wf)).join('')}
          </div>

        </div>

        <!-- Create Workflow Modal -->
        <div id="wf-create-modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); display:none; align-items:center; justify-content:center; z-index:10000;">
          <div style="background:var(--card); width:100%; max-width:520px; border-radius:17px; padding:24px; border:1px solid var(--border); box-shadow:none !important; display:flex; flex-direction:column; gap:16px;">
            
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h2 style="font-size:16px; font-weight:400; color:var(--text); margin:0;">Create Autonomous Workflow</h2>
              <button onclick="window.workflowsPageInstance.closeCreateModal()" style="background:transparent; border:none; color:var(--text-3); font-size:18px; cursor:pointer;">✕</button>
            </div>

            <div style="display:flex; flex-direction:column; gap:12px;">
              <style>
                #wf-create-modal input::placeholder,
                #wf-create-modal textarea::placeholder {
                  font-weight: 400 !important;
                  color: var(--text-3) !important;
                  opacity: 0.7 !important;
                  font-family: var(--font) !important;
                  font-size: 12.5px !important;
                }
                #wf-create-modal select,
                #wf-create-modal input,
                #wf-create-modal textarea,
                #wf-create-modal button {
                  font-weight: 400 !important;
                  font-family: var(--font) !important;
                }
              </style>
              <div>
                <label style="font-size:11.5px; color:var(--text-3); display:block; margin-bottom:4px; font-weight:400;">Workflow Name</label>
                <input type="text" id="new-wf-name" placeholder="e.g., Crypto Market & News Alert" style="width:100%; height:34px; padding:0 12px; background:var(--input-bg); border:1px solid var(--border) !important; border-radius:10px; color:var(--text); font-size:13px; font-weight:400; outline:none !important; box-sizing:border-box;" />
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                  <label style="font-size:11.5px; color:var(--text-3); display:block; margin-bottom:4px; font-weight:400;">Category</label>
                  <select id="new-wf-cat" style="width:100%; height:34px; padding:0 10px; background:var(--input-bg); border:1px solid var(--border) !important; border-radius:10px; color:var(--text); font-size:12.5px; font-weight:400; outline:none !important; box-sizing:border-box;">
                    <option value="Intelligence">Intelligence</option>
                    <option value="Development">Development</option>
                    <option value="Research">Research</option>
                    <option value="Automation">Automation</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:11.5px; color:var(--text-3); display:block; margin-bottom:4px; font-weight:400;">Trigger Type</label>
                  <select id="new-wf-trigger" style="width:100%; height:34px; padding:0 10px; background:var(--input-bg); border:1px solid var(--border) !important; border-radius:10px; color:var(--text); font-size:12.5px; font-weight:400; outline:none !important; box-sizing:border-box;">
                    <option value="manual">Manual Trigger</option>
                    <option value="daily">Daily Schedule (8:00 AM)</option>
                    <option value="hourly">Hourly</option>
                    <option value="file">On File Change</option>
                  </select>
                </div>
              </div>

              <div>
                <label style="font-size:11.5px; color:var(--text-3); display:block; margin-bottom:4px; font-weight:400;">Description</label>
                <input type="text" id="new-wf-desc" placeholder="What does this autonomous pipeline do?" style="width:100%; height:34px; padding:0 12px; background:var(--input-bg); border:1px solid var(--border) !important; border-radius:10px; color:var(--text); font-size:13px; font-weight:400; outline:none !important; box-sizing:border-box;" />
              </div>

              <div>
                <label style="font-size:11.5px; color:var(--text-3); display:block; margin-bottom:4px; font-weight:400;">Agent Prompt / Reasoning Task</label>
                <textarea id="new-wf-prompt" placeholder="e.g. Scrape the top headlines from target sources, filter for major breakthrough points, and summarize into 3 actionable bullets." style="width:100%; height:70px; padding:8px 12px; background:var(--input-bg); border:1px solid var(--border) !important; border-radius:10px; color:var(--text); font-size:12.5px; outline:none !important; resize:none; font-weight:400; box-sizing:border-box;"></textarea>
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; align-items:center; gap:10px; margin-top:10px;">
              <button onclick="window.workflowsPageInstance.closeCreateModal()" style="height:34px; padding:0 16px; background:var(--input-bg); border:1px solid var(--border) !important; border-radius:17px; color:var(--text); font-size:13px; font-weight:400; cursor:pointer; transition:background 0.12s;">Cancel</button>
              <button onclick="window.workflowsPageInstance.saveNewWorkflow()" style="height:34px; padding:0 18px; background:var(--input-bg); border:1px solid var(--border) !important; border-radius:17px; color:var(--text); font-size:13px; font-weight:400; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:background 0.12s;">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <span>Deploy Workflow</span>
              </button>
            </div>

          </div>
        </div>

      </div>
    `;

    if (window.lucide) lucide.createIcons({ parent: this._root });
  }

  _renderLiveRunBanner() {
    if (!this._activeRun) return '';
    const run = this._activeRun;
    const isRunning = run.status === 'running';

    return `
      <div style="background:var(--card); border-radius:17px; padding:18px 20px; margin-bottom:20px; border:1px solid var(--border) !important; box-shadow:none !important;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="width:8px; height:8px; border-radius:50%; background:var(--text-2); ${isRunning ? 'animation: pulse 1.2s infinite;' : ''}"></span>
            <span style="font-size:14px; font-weight:400; color:var(--text);">${esc(run.workflow_name)}</span>
            <span style="font-size:12px; color:var(--text-3); background:var(--input-bg); padding:2px 8px; border-radius:12px; font-weight:400;">${run.nodes_completed} / ${run.total_nodes} Steps</span>
          </div>
          <span style="font-size:12px; font-weight:400; color:var(--text-2); text-transform:none;">${run.status}</span>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
          ${(run.steps || []).map((st, i) => `
            <div style="display:flex; align-items:flex-start; gap:10px; font-size:12.5px; padding:8px 12px; background:var(--input-bg); border-radius:10px;">
              <span style="font-weight:400; color:var(--text-2); min-width:20px;">#${i+1}</span>
              <div style="flex:1; min-width:0;">
                <div style="font-weight:400; color:var(--text);">${esc(st.label)}</div>
                <div style="color:var(--text-3); font-size:11.5px; margin-top:2px; font-weight:400;">${esc(st.output || 'Executing task node...')}</div>
              </div>
              <span style="font-size:11px; color:var(--text-3); font-weight:400;">${st.duration_ms ? `${st.duration_ms}ms` : ''}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  _renderWorkflowCard(wf) {
    const nodes = wf.nodes || [];
    return `
      <div style="background:var(--card); border-radius:17px; padding:18px 20px; display:flex; flex-direction:column; gap:14px; border:1px solid var(--border) !important; box-shadow:none !important; transition:background 0.15s ease;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:14px;">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:14.5px; font-weight:400; color:var(--text);">${esc(wf.name)}</span>
              <span style="font-size:11px; font-weight:400; color:var(--text-3); background:var(--input-bg); padding:2px 8px; border-radius:12px;">${esc(wf.category || 'General')}</span>
            </div>
            <p style="font-size:12.5px; color:var(--text-3); margin-top:4px; margin-bottom:0; line-height:1.4; font-weight:400;">${esc(wf.description)}</p>
          </div>
          <button onclick="window.workflowsPageInstance.runWorkflow('${wf.id}')" style="height:32px; padding:0 14px; background:var(--input-bg); border:none !important; border-radius:16px; color:var(--text); font-size:12.5px; font-weight:400; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.15s ease; flex-shrink:0;">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span>Run Trigger</span>
          </button>
        </div>

        <!-- Visual Pipeline Steps -->
        <div style="display:flex; align-items:center; gap:8px; overflow-x:auto; padding-top:4px; padding-bottom:4px;">
          ${nodes.map((n, idx) => `
            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
              <div style="background:var(--input-bg); padding:6px 12px; border-radius:12px; display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-2); font-weight:400;">
                <span style="width:5px; height:5px; border-radius:50%; background:var(--text-3);"></span>
                <span>${esc(n.label)}</span>
              </div>
              ${idx < nodes.length - 1 ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--text-3);"><polyline points="9 18 15 12 9 6"/></svg>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  async runWorkflow(wfId) {
    try {
      this._showToast('Workflow Studio', 'Triggering autonomous pipeline…', 2000);
      const res = await fetch(`/api/workflows/${wfId}/run`, { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        this._activeRun = d.run;
        this._startPolling(d.run.run_id);
        this.render();
      }
    } catch (e) {
      this._showToast('Workflow Studio', `Error: ${e.message}`, 3000);
    }
  }

  async runAll() {
    for (const wf of this._workflows) {
      await this.runWorkflow(wf.id);
      break; // Run primary
    }
  }

  _startPolling(runId) {
    if (this._pollInterval) clearInterval(this._pollInterval);
    this._pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/workflows/runs/${runId}`);
        if (res.ok) {
          const d = await res.json();
          this._activeRun = d.run;
          const banner = this._root ? this._root.querySelector('#wf-live-run-container') : null;
          if (banner) banner.innerHTML = this._renderLiveRunBanner();
          if (d.run.status !== 'running') {
            clearInterval(this._pollInterval);
            this._pollInterval = null;
            this._showToast('Workflow Studio', 'Pipeline completed successfully!', 3000);
          }
        }
      } catch (e) {}
    }, 900);
  }

  openCreateModal() {
    const m = this._root ? this._root.querySelector('#wf-create-modal') : null;
    if (m) m.style.display = 'flex';
  }

  closeCreateModal() {
    const m = this._root ? this._root.querySelector('#wf-create-modal') : null;
    if (m) m.style.display = 'none';
  }

  async saveNewWorkflow() {
    const name = this._root.querySelector('#new-wf-name')?.value.trim();
    const cat = this._root.querySelector('#new-wf-cat')?.value || 'Automation';
    const trigger = this._root.querySelector('#new-wf-trigger')?.value || 'manual';
    const desc = this._root.querySelector('#new-wf-desc')?.value.trim();
    const prompt = this._root.querySelector('#new-wf-prompt')?.value.trim();

    if (!name) {
      this._showToast('Workflow Studio', 'Please provide a Workflow Name.', 2500);
      return;
    }

    const triggerLabels = {
      manual: 'Manual Trigger',
      daily: 'Schedule Trigger (Daily 8:00 AM)',
      hourly: 'Hourly Sync Trigger',
      file: 'Watchdog File Trigger'
    };

    const newWf = {
      id: 'wf_' + Date.now(),
      name,
      category: cat,
      description: desc || 'Custom multi-step autonomous agent workflow.',
      enabled: true,
      schedule: trigger,
      nodes: [
        { id: 'n1', type: 'trigger', label: triggerLabels[trigger] || 'Trigger Active', config: { trigger } },
        { id: 'n2', type: 'agent', label: 'Reasoning & Execution Task', config: { prompt: prompt || 'Execute agent task.' } },
        { id: 'n3', type: 'save', label: 'Commit Results to Memory', config: { target: 'memory' } }
      ]
    };

    try {
      this._showToast('Workflow Studio', 'Deploying new workflow…', 2000);
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWf)
      });
      if (res.ok) {
        this.closeCreateModal();
        this._workflows.unshift(newWf);
        this.render();
        this._showToast('Workflow Studio', `Workflow "${name}" deployed!`, 3000);
      }
    } catch (e) {
      this._workflows.unshift(newWf);
      this.closeCreateModal();
      this.render();
      this._showToast('Workflow Studio', `Workflow "${name}" created locally!`, 3000);
    }
  }
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

