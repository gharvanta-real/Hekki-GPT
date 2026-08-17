/**
 * graph_page.js — Interactive Knowledge Graph & Visual Mind-Map Studio for Hekki.
 * Features: HTML5 Canvas physics-based force-directed graph, node search, zoom/pan & note inspector.
 */

export class GraphPage {
  constructor(showToast) {
    this._showToast = (title, msg, dur) => {
      if (typeof showToast === 'function') showToast(title, msg, dur);
    };
    this._root = null;
    this._mounted = false;
    this._canvas = null;
    this._ctx = null;
    this._nodes = [];
    this._links = [];
    this._selectedNode = null;
    this._searchQuery = '';
    this._zoom = 1.0;
    this._panX = 0;
    this._panY = 0;
    this._isDragging = false;
    this._draggedNode = null;
    this._animId = null;
    window.graphPageInstance = this;
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
    const defaultNodes = [
      { id: "c_hekki", label: "Hekki Assistant", category: "Core", radius: 22, color: "#3b82f6", notes: "Autonomous AI Agent platform & local desktop runtime." },
      { id: "c_agent", label: "Agentic Loop", category: "Architecture", radius: 16, color: "#10b981", notes: "ReAct tool execution, planner, observer & memory." },
      { id: "c_memory", label: "Memory Ledger", category: "Memory", radius: 15, color: "#8b5cf6", notes: "Semantic SQLite vector store and persistent profile facts." },
      { id: "c_skills", label: "Modular Skills", category: "Execution", radius: 15, color: "#f59e0b", notes: "Decoupled capability modules registered with Gemini Tools API." },
      { id: "c_mcp", label: "MCP Protocol", category: "Integration", radius: 16, color: "#06b6d4", notes: "Model Context Protocol bridge for GitHub, Slack, Notion, Postgres." },
      { id: "c_vision", label: "Computer Vision", category: "Sensory", radius: 14, color: "#ec4899", notes: "Screen capture, OCR, visual inspection & floating HUD." },
      { id: "c_debate", label: "Multi-Persona Debate", category: "Reasoning", radius: 15, color: "#6366f1", notes: "3-agent adversarial consensus protocol." },
      { id: "c_coder", label: "Coder FSM", category: "Development", radius: 15, color: "#14b8a6", notes: "Full autonomous coding assistant with file patch generator." },
      { id: "c_workflows", label: "Workflow Engine", category: "Automation", radius: 15, color: "#f43f5e", notes: "Multi-step automated DAG pipelines and agentic triggers." },
      { id: "c_graph", label: "Knowledge Graph", category: "Intelligence", radius: 16, color: "#eab308", notes: "Interactive conceptual relationship explorer & mind-map." },
      { id: "c_python", label: "Python & FastAPI", category: "Technology", radius: 13, color: "#64748b", notes: "High performance async web and orchestration backend." },
      { id: "c_gemini", label: "Google Gemini 3.1", category: "Model", radius: 17, color: "#3b82f6", notes: "Multimodal reasoning LLM with function calling." }
    ];

    const defaultLinks = [
      { source: "c_hekki", target: "c_agent", label: "orchestrates" },
      { source: "c_hekki", target: "c_gemini", label: "powered by" },
      { source: "c_agent", target: "c_skills", label: "invokes" },
      { source: "c_agent", target: "c_memory", label: "reads & updates" },
      { source: "c_skills", target: "c_mcp", label: "integrates via" },
      { source: "c_agent", target: "c_vision", label: "observes via" },
      { source: "c_agent", target: "c_debate", label: "resolves with" },
      { source: "c_agent", target: "c_coder", label: "spawns" },
      { source: "c_hekki", target: "c_workflows", "label": "schedules" },
      { source: "c_memory", target: "c_graph", label: "visualizes into" },
      { source: "c_hekki", target: "c_python", label: "built on" },
      { source: "c_coder", target: "c_python", label: "analyzes" }
    ];

    try {
      const res = await fetch('/api/graph');
      if (res.ok) {
        const d = await res.json();
        const nodes = (d.nodes && d.nodes.length > 0) ? d.nodes : defaultNodes;
        const links = (d.links && d.links.length > 0) ? d.links : defaultLinks;
        this._initPhysicsNodes(nodes, links);
      } else {
        this._initPhysicsNodes(defaultNodes, defaultLinks);
      }
    } catch (e) {
      console.warn('Knowledge Graph fallback used:', e);
      this._initPhysicsNodes(defaultNodes, defaultLinks);
    }
    this.render();
  }

  _initPhysicsNodes(nodes, links) {
    const width = this._root ? this._root.clientWidth || 800 : 800;
    const height = this._root ? this._root.clientHeight || 600 : 600;
    const cx = width / 2;
    const cy = height / 2;

    this._nodes = nodes.map((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      const dist = 140 + Math.random() * 80;
      return {
        ...n,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: n.radius || 15
      };
    });

    this._links = links;
  }

  render() {
    if (!this._root) return;
    this._root.innerHTML = `
      <div style="display:flex; width:100%; height:100%; flex:1; min-width:0; position:relative; background:var(--bg); color:var(--text); font-family:var(--font); overflow:hidden;">
        
        <!-- Canvas Visualizer -->
        <canvas id="kg-canvas" style="width:100%; height:100%; display:block; cursor:grab;"></canvas>

        <!-- Top Header & Search Overlay -->
        <div style="position:absolute; top:20px; left:24px; right:24px; display:flex; justify-content:space-between; align-items:center; pointer-events:none; z-index:10;">
          <div style="pointer-events:auto; background:var(--card); padding:10px 18px; border-radius:17px; display:flex; align-items:center; gap:12px; border:none !important;">
            <div>
              <div style="font-size:14.5px; font-weight:400; color:var(--text);">Knowledge Graph Studio</div>
              <div style="font-size:12px; color:var(--text-3); font-weight:400;">${this._nodes.length} Concepts &bull; ${this._links.length} Relations</div>
            </div>
          </div>

          <div style="display:flex; gap:8px; pointer-events:auto;">
            <div style="position:relative; width:220px;">
              <input type="text" id="kg-search" placeholder="Search concepts..." style="width:100%; height:34px; padding:0 12px 0 14px; background:var(--card); border:none !important; border-radius:17px; color:var(--text); font-size:13px; outline:none !important; box-shadow:none !important; font-weight:400;" />
            </div>
            <button onclick="window.graphPageInstance.resetView()" title="Reset View" style="width:34px; height:34px; background:var(--card); border:none !important; border-radius:17px; color:var(--text); cursor:pointer; display:flex; align-items:center; justify-content:center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            </button>
          </div>
        </div>

        <!-- Node Details Sidebar Overlay (if selected) -->
        <div id="kg-details-pane" style="position:absolute; top:74px; right:24px; width:300px; max-height:calc(100% - 100px); background:var(--card); border-radius:17px; padding:18px; display:${this._selectedNode ? 'block' : 'none'}; border:none !important; box-shadow:none !important; z-index:10; overflow-y:auto;">
          ${this._renderSelectedDetails()}
        </div>

      </div>
    `;

    this._canvas = this._root.querySelector('#kg-canvas');
    if (this._canvas) {
      this._ctx = this._canvas.getContext('2d');
      this._setupCanvasEvents();
      this._startSimulation();
    }

    const searchInp = this._root.querySelector('#kg-search');
    if (searchInp) {
      searchInp.value = this._searchQuery;
      searchInp.addEventListener('input', (e) => {
        this._searchQuery = e.target.value.toLowerCase();
      });
    }
  }

  _renderSelectedDetails() {
    if (!this._selectedNode) return '';
    const node = this._selectedNode;
    const connected = this._links.filter(l => l.source === node.id || l.target === node.id || (l.source.id === node.id) || (l.target.id === node.id));

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span style="font-size:11px; font-weight:400; color:var(--text-3); text-transform:none; background:var(--input-bg); padding:2px 8px; border-radius:10px;">${esc(node.category || 'Concept')}</span>
        <button onclick="window.graphPageInstance.clearSelection()" style="background:transparent; border:none; color:var(--text-3); cursor:pointer; font-size:14px;">✕</button>
      </div>
      <h3 style="font-size:15px; font-weight:400; color:var(--text); margin:0 0 6px 0;">${esc(node.label)}</h3>
      <p style="font-size:12.5px; color:var(--text-2); line-height:1.5; margin:0 0 16px 0; font-weight:400;">${esc(node.notes || 'No extended notes.')}</p>

      <div style="font-size:12px; font-weight:400; color:var(--text-3); margin-bottom:8px;">Connected Relations (${connected.length})</div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${connected.map(l => {
          const isSource = (l.source === node.id || l.source.id === node.id);
          const targetId = isSource ? (l.target.id || l.target) : (l.source.id || l.source);
          const targetNode = this._nodes.find(n => n.id === targetId);
          return `
            <div style="background:var(--input-bg); padding:8px 10px; border-radius:10px; font-size:12px; display:flex; justify-content:space-between; font-weight:400;">
              <span style="color:var(--text-3);">${esc(l.label || 'relates to')}</span>
              <span style="color:var(--text);">${esc(targetNode ? targetNode.label : targetId)}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  clearSelection() {
    this._selectedNode = null;
    const pane = this._root ? this._root.querySelector('#kg-details-pane') : null;
    if (pane) pane.style.display = 'none';
  }

  resetView() {
    this._zoom = 1.0;
    this._panX = 0;
    this._panY = 0;
    this.clearSelection();
  }

  _setupCanvasEvents() {
    if (!this._canvas) return;
    let startX = 0, startY = 0;

    const getMousePos = (e) => {
      const rect = this._canvas.getBoundingClientRect();
      const clientX = (e.clientX - rect.left - rect.width / 2 - this._panX) / this._zoom + rect.width / 2;
      const clientY = (e.clientY - rect.top - rect.height / 2 - this._panY) / this._zoom + rect.height / 2;
      return { x: clientX, y: clientY };
    };

    this._canvas.addEventListener('mousedown', (e) => {
      const pos = getMousePos(e);
      const clicked = this._nodes.find(n => Math.hypot(n.x - pos.x, n.y - pos.y) <= n.radius + 4);
      if (clicked) {
        this._draggedNode = clicked;
        this._selectedNode = clicked;
        const pane = this._root.querySelector('#kg-details-pane');
        if (pane) {
          pane.innerHTML = this._renderSelectedDetails();
          pane.style.display = 'block';
        }
      } else {
        this._isDragging = true;
        startX = e.clientX - this._panX;
        startY = e.clientY - this._panY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this._draggedNode) {
        const pos = getMousePos(e);
        this._draggedNode.x = pos.x;
        this._draggedNode.y = pos.y;
      } else if (this._isDragging) {
        this._panX = e.clientX - startX;
        this._panY = e.clientY - startY;
      }
    });

    window.addEventListener('mouseup', () => {
      this._draggedNode = null;
      this._isDragging = false;
    });

    this._canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this._zoom = Math.max(0.4, Math.min(2.5, this._zoom * zoomFactor));
    });
  }

  _startSimulation() {
    if (this._animId) cancelAnimationFrame(this._animId);

    const step = () => {
      this._updatePhysics();
      this._drawCanvas();
      this._animId = requestAnimationFrame(step);
    };
    step();
  }

  _updatePhysics() {
    const width = this._canvas ? this._canvas.clientWidth : 800;
    const height = this._canvas ? this._canvas.clientHeight : 600;
    const cx = width / 2;
    const cy = height / 2;

    // Node repulsion & center gravity
    for (let i = 0; i < this._nodes.length; i++) {
      const a = this._nodes[i];
      if (a === this._draggedNode) continue;

      a.vx += (cx - a.x) * 0.0006;
      a.vy += (cy - a.y) * 0.0006;

      for (let j = i + 1; j < this._nodes.length; j++) {
        const b = this._nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 180) {
          const force = (180 - dist) / dist * 0.12;
          a.vx -= dx * force;
          a.vy -= dy * force;
          b.vx += dx * force;
          b.vy += dy * force;
        }
      }

      a.x += a.vx;
      a.y += a.vy;
      a.vx *= 0.85;
      a.vy *= 0.85;
    }
  }

  _drawCanvas() {
    if (!this._canvas || !this._ctx) return;
    const ctx = this._ctx;
    const w = this._canvas.clientWidth;
    const h = this._canvas.clientHeight;

    if (this._canvas.width !== w || this._canvas.height !== h) {
      this._canvas.width = w;
      this._canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2 + this._panX, h / 2 + this._panY);
    ctx.scale(this._zoom, this._zoom);
    ctx.translate(-w / 2, -h / 2);

    const isDark = document.body.classList.contains('dark') || document.body.classList.contains('oled');

    // Draw Links
    ctx.lineWidth = 1.2;
    for (const link of this._links) {
      const src = this._nodes.find(n => n.id === (link.source.id || link.source));
      const tgt = this._nodes.find(n => n.id === (link.target.id || link.target));
      if (!src || !tgt) continue;

      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.stroke();

      // Label on link
      if (link.label && this._zoom >= 0.8) {
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2;
        ctx.fillStyle = isDark ? '#71717a' : '#a1a1aa';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(link.label, mx, my - 3);
      }
    }

    // Draw Nodes
    for (const node of this._nodes) {
      const isSelected = this._selectedNode === node;
      const isMatched = !this._searchQuery || node.label.toLowerCase().includes(this._searchQuery);

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + (isSelected ? 3 : 0), 0, Math.PI * 2);
      ctx.fillStyle = isMatched ? (node.color || '#3b82f6') : (isDark ? '#3f3f46' : '#cbd5e1');
      ctx.fill();

      if (isSelected) {
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = isDark ? '#f4f4f5' : '#09090b';
      ctx.font = `${isSelected ? '600' : '500'} 12px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y + node.radius + 14);
    }

    ctx.restore();
  }
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
