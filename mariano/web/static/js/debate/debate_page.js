import { ChatSessionManager, enhanceCodeBlocks, enhanceMarkdownContent } from '../chat.js';
const appendHudLog = (msg) => { console.log("[DEBATE HUD LOG]", msg); };
import { router } from '../router.js';
import { showToast } from '../components/toast.js';


let ALPHA_NAME = 'Tony Stark';
let BETA_NAME  = 'Bruce Banner';
const USER_NAME  = 'You';

let _debateRunning = false;
let _currentTurn = null;
let _summaryCard = null;
let _roundNum = 0;
let _paused = false;
let _voiceEnabled = false;
let _chunkCount = 0;

// ── Init ────────────────────────────────────────────────────────────────────
export function initDebatePage() {
  _buildLayout();
  if (window.lucide) lucide.createIcons();
  _bindEvents();
  _syncTopbarModelTags();
}

// ── Layout builder ──────────────────────────────────────────────────────────
function _buildLayout() {
  const pane = document.getElementById('debate-pane');
  if (!pane) return;

  pane.innerHTML = `
    <div class="debate-layout">

      <!-- Collapsible Sidebar (Left Side, Full Height) -->
      <div class="debate-sidebar" style="padding-top: 0;">
        <!-- Nav Header (With Back Chevron right before Collapsible Icon) -->
        <div class="nav-header" style="display: flex; align-items: center; justify-content: space-between; height: 48px; padding: 0 12px 0 16px; flex-shrink: 0;">
          <div class="nav-header-title" style="font-weight: 600; font-size: 16px; color: var(--text-primary); margin: 0; padding: 0; display: flex; align-items: center; gap: 8px; flex: 1;">
            Hekki
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button class="icon-btn" id="btn-debate-sidebar-back" title="Back to Chat" style="border: none; background: transparent; cursor: pointer;">
              <i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i>
            </button>
            <button class="icon-btn" id="btn-debate-search-nav" title="Search Chat History" style="border: none; background: transparent; cursor: pointer;">
              <i data-lucide="search" style="width: 15px; height: 15px;"></i>
            </button>
            <button class="icon-btn" id="btn-debate-sidebar-toggle" title="Toggle Sidebar" style="border: none; background: transparent; cursor: pointer;">
              <i data-lucide="panel-left-close" style="width: 15px; height: 15px;"></i>
            </button>
          </div>
        </div>

        <!-- Scrollable Inner Content Area -->
        <div class="debate-sidebar-inner" style="padding-top: 0;">
          <!-- Section Header -->
          <div class="debate-sidebar-section-label" style="margin-top: 0; padding-top: 0;">Actions</div>

          <!-- Sidebar Controls List -->
          <div class="debate-sidebar-controls-list">
            <button class="debate-list-btn" id="btn-sidebar-new-debate" title="New Debate">
              <i data-lucide="message-circle-plus" style="width:15px; height:15px; margin-right:8px;"></i>
              <span>New Debate</span>
            </button>
            <button class="debate-list-btn" id="btn-sidebar-research-directory" title="Research Directory">
              <i data-lucide="book-open" style="width:15px; height:15px; margin-right:8px;"></i>
              <span>Research Directory</span>
            </button>
            <button class="debate-list-btn" id="btn-sidebar-voice" title="Toggle Voice Speak">
              <span id="btn-sidebar-voice-icon-wrap" style="display:inline-flex; align-items:center; margin-right:8px;">
                <i data-lucide="volume-x" style="width:15px; height:15px;"></i>
              </span>
              <span id="lbl-sidebar-voice">Voice: Off</span>
            </button>
            <button class="debate-list-btn" id="btn-sidebar-reset" title="Reset Debate Room">
              <i data-lucide="rotate-ccw" style="width:15px; height:15px; margin-right:8px;"></i>
              <span>Reset Room</span>
            </button>
          </div>

          <div class="debate-sidebar-divider" style="margin: 0 0 2px 0;"></div>

          <!-- Participants Section -->
          <details class="debate-sidebar-details">
            <summary class="debate-sidebar-summary">
              <span class="summary-title">Participants</span>
              <i data-lucide="chevron-right" class="accordion-chevron"></i>
            </summary>
            <div class="details-content">
              <div class="debate-participants-list" style="display:flex; flex-direction:column; gap:4px;">
                
                <!-- Participant 1 -->
                <div class="debate-participant-card" id="dp-alpha" style="display:flex; align-items:center; justify-content:space-between; padding:4px 6px 4px 2px; background:transparent; border:none; border-bottom: 1px solid var(--border);">
                  <div class="dp-avatar dp-alpha" style="width:24px; height:24px; border-radius:50%; background:var(--hover); color:var(--text); display:flex; align-items:center; justify-content:center; font-weight:500; font-size:11.5px;">T</div>
                  <div class="dp-info" style="flex-grow:1; min-width:0; margin-left:8px; display:flex; flex-direction:column; gap:1px;">
                    <div class="dp-name" style="font-size:12px; font-weight:600; color:var(--text); line-height: 1.1;">Tony Stark</div>
                    <select class="debate-model-select" id="select-alpha-model" style="width:100%; cursor:pointer; color:var(--text);">
                      <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash</option>
                      <option value="qwen">Qwen (Optional)</option>
                    </select>
                    <div class="dp-status" id="dp-alpha-status" style="font-size:10px; color:var(--text); opacity:0.9; line-height: 1.1; margin-top: 1px;">Idle</div>
                  </div>
                  <div class="dp-indicator" id="dp-alpha-dot" style="width:6px; height:6px; border-radius:50%; background:transparent; margin-left:6px;"></div>
                </div>

                <!-- Participant 2 -->
                <div class="debate-participant-card" id="dp-beta" style="display:flex; align-items:center; justify-content:space-between; padding:4px 6px 4px 2px; background:transparent; border:none; border-bottom: 1px solid var(--border);">
                  <div class="dp-avatar dp-beta" style="width:24px; height:24px; border-radius:50%; background:var(--hover); color:var(--text); display:flex; align-items:center; justify-content:center; font-weight:500; font-size:11.5px;">B</div>
                  <div class="dp-info" style="flex-grow:1; min-width:0; margin-left:8px; display:flex; flex-direction:column; gap:1px;">
                    <div class="dp-name" style="font-size:12px; font-weight:600; color:var(--text); line-height: 1.1;">Bruce Banner</div>
                    <select class="debate-model-select" id="select-beta-model" style="width:100%; cursor:pointer; color:var(--text);">
                      <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash</option>
                      <option value="qwen">Qwen (Optional)</option>
                    </select>
                    <div class="dp-status" id="dp-beta-status" style="font-size:10px; color:var(--text); opacity:0.9; line-height: 1.1; margin-top: 1px;">Idle</div>
                  </div>
                  <div class="dp-indicator" id="dp-beta-dot" style="width:6px; height:6px; border-radius:50%; background:transparent; margin-left:6px;"></div>
                </div>

                <!-- Participant 3 (User / Observer) -->
                <div class="debate-participant-card" id="dp-user" style="display:flex; align-items:center; justify-content:space-between; padding:4px 6px 4px 2px; background:transparent; border:none;">
                  <div class="dp-avatar dp-user" style="width:24px; height:24px; border-radius:50%; background:var(--hover); color:var(--text); display:flex; align-items:center; justify-content:center; font-weight:500; font-size:11.5px;">U</div>
                  <div class="dp-info" style="flex-grow:1; min-width:0; margin-left:8px; display:flex; flex-direction:column; gap:1px;">
                    <div class="dp-name" style="font-size:12px; font-weight:600; color:var(--text); line-height: 1.1;">You</div>
                    <div class="dp-model" style="font-size:10px; color:var(--text); opacity:0.9; margin-top:1px; line-height: 1.1;">Observer</div>
                    <div class="dp-status" id="dp-user-status" style="font-size:10px; color:var(--text); opacity:0.9; line-height: 1.1; margin-top: 1px;">Active</div>
                  </div>
                  <div class="dp-indicator active" id="dp-user-dot" style="width:6px; height:6px; border-radius:50%; background:var(--green); margin-left:6px;"></div>
                </div>

              </div>
            </div>
          </details>

          <div class="debate-sidebar-divider"></div>

          <!-- Flow Section -->
          <details class="debate-sidebar-details">
            <summary class="debate-sidebar-summary">
              <span class="summary-title">Flow</span>
              <i data-lucide="chevron-right" class="accordion-chevron"></i>
            </summary>
            <div class="details-content">
              <div class="debate-flow-steps" id="debate-flow-steps">
                <div class="dfs dfs-idle" id="dfs-1">Round 1</div>
                <div class="dfs dfs-idle" id="dfs-2">Round 2</div>
                <div class="dfs dfs-idle" id="dfs-3">Round 3</div>
                <div class="dfs dfs-idle" id="dfs-s">Summary</div>
              </div>
            </div>
          </details>

          <div class="debate-sidebar-divider"></div>

          <!-- Documents Section (Persistent Saved Documentaries) -->
          <details class="debate-sidebar-details" id="debate-documents-details" style="position: relative;">
            <summary class="debate-sidebar-summary">
              <span class="summary-title">Documents</span>
              <i data-lucide="chevron-right" class="accordion-chevron"></i>
            </summary>
            <!-- Documents Options Dropdown -->
            <div class="doc-dropdown" style="position: absolute; right: 10px; top: 2px; z-index: 115;">
              <button class="debate-docs-menu-btn" id="btn-debate-docs-menu" style="background: transparent; border: none; padding: 4px; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.12s, color 0.12s;" title="Document Options">
                <i data-lucide="more-vertical" style="width: 14px; height: 14px;"></i>
              </button>
              <div class="doc-dropdown-menu" id="debate-docs-dropdown-menu" style="top: 24px;">
                <button class="dropdown-item btn-upload-doc" id="btn-debate-upload-doc" style="display: flex; align-items: center; gap: 8px;">
                  <i data-lucide="upload" style="width: 12px; height: 12px;"></i>
                  <span>Upload Document</span>
                </button>
                <button class="dropdown-item btn-export-docs" id="btn-debate-export-docs" style="display: flex; align-items: center; gap: 8px;">
                  <i data-lucide="download" style="width: 12px; height: 12px;"></i>
                  <span>Export All</span>
                </button>
                <div style="border-top: 1px solid var(--border); margin: 4px 0;"></div>
                <button class="dropdown-item btn-clear-docs" id="btn-debate-clear-docs" style="display: flex; align-items: center; gap: 8px; color: #ef4444;">
                  <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                  <span>Clean All</span>
                </button>
              </div>
              <input type="file" id="debate-doc-upload-input" accept=".txt,.md,.json" style="display: none;" />
            </div>
            <div class="details-content">
              <div class="debate-docs-list" id="debate-docs-list">
                <div class="debate-doc-empty">No saved documents yet.</div>
              </div>
            </div>
          </details>
        </div>

        <!-- Global User Profile (Anchored to bottom of sidebar) -->
        <div style="position: relative; margin-top: auto; border-top: none;">
          <!-- User Menu Dropdown (Debate Specific) -->
          <div class="user-menu-dropdown hidden" id="debate-user-menu-dropdown" style="bottom: 50px; left: 8px;">
            <div class="user-menu-header">anshu@gmail.com</div>
            <button class="user-menu-item" id="btn-debate-user-settings">
              <i data-lucide="settings" style="width:16px; height:16px;"></i>
              <span>Settings</span>
              <span class="user-menu-shortcut">Ctrl+⇧+,</span>
            </button>
            <button class="user-menu-item" id="btn-debate-user-theme">
              <i data-lucide="sun" style="width:16px; height:16px;"></i>
              <span>Toggle Theme</span>
            </button>
            <button class="user-menu-item" id="btn-debate-user-skills">
              <i data-lucide="zap" style="width:16px; height:16px;"></i>
              <span>Skills & Capabilities</span>
            </button>
            <div class="user-menu-divider"></div>
            <button class="user-menu-item" id="btn-debate-user-logout">
              <i data-lucide="log-out" style="width:16px; height:16px;"></i>
              <span>Log out</span>
            </button>
          </div>

          <!-- User Profile Action -->
          <div class="sidebar-user-profile" id="btn-debate-sidebar-user-profile" style="border-top: none;">
            <img class="sidebar-user-avatar" id="debate-sidebar-user-avatar" src="/static/avatars/3d-avatar-1.webp" alt="User Avatar" />
            <div class="sidebar-user-info">
              <div class="sidebar-user-name" id="debate-sidebar-user-name">User</div>
              <div class="sidebar-user-plan">Free plan</div>
            </div>
            <i data-lucide="chevrons-up-down" style="width:14px; height:14px; color:var(--text-3); margin-left:4px;"></i>
          </div>
        </div>

      </div>

      <!-- Main Container (Right Side) -->
      <div class="debate-main-container" style="display: flex; flex-direction: row; width: 100%; height: 100%; overflow: hidden;">
        
        <!-- Left Workspace (Contains Topbar + Chat Content) -->
        <div id="debate-workspace-left" style="display: flex; flex-direction: column; flex: 1; min-width: 0; height: 100%; overflow: hidden; position: relative;">
          <!-- Topbar -->
          <div class="debate-topbar">
            <div class="debate-topbar-left">
              <button class="icon-btn" id="btn-debate-sidebar-toggle-main" title="Toggle Sidebar" style="margin-right: 8px; border: none; background: transparent; cursor: pointer; display: none;">
                <i data-lucide="sidebar" style="width: 14px; height: 14px;"></i>
              </button>
              <div class="debate-topbar-title" style="display: flex; align-items: center; gap: 8px;">
                <span>Debate Playground</span>
              </div>
              <span style="color: var(--border); font-weight: 300; margin-left: 8px;">|</span>
              <button class="debate-topbar-btn" id="btn-debate-copy-all" title="Copy All Debate Content" style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: none !important; background: transparent; border-radius: 4px; cursor: pointer; color: var(--text-secondary); transition: color 0.12s, background-color 0.12s; margin-left: 4px;">
                <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
              </button>
            </div>
            <div class="debate-topbar-controls">
              <div class="debate-status-pill" id="debate-status-pill">
                <span class="dot"></span>
                <span id="debate-status-text">Ready</span>
              </div>
              <div class="debate-round-pill" id="debate-round-pill" style="display:none">
                Round <strong id="debate-round-num">1</strong> / <span id="debate-round-total">3</span>
              </div>
              <button class="debate-topbar-btn" id="btn-debate-pause" style="display:none">
                <i data-lucide="pause" style="width:14px; height:14px; margin-right:4px;"></i><span>Pause</span>
              </button>
              
              <!-- VS chips added at right end -->
              <div class="debate-model-tags">
                <span class="debate-model-tag alpha-tag">
                  <span class="tag-name">Tony Stark</span><span class="tag-model"> · Iron Man</span>
                </span>
                <span class="debate-model-vs">vs</span>
                <span class="debate-model-tag beta-tag">
                  <span class="tag-name">Bruce Banner</span><span class="tag-model"> · Hulk</span>
                </span>
              </div>
            </div>
          </div>

          <!-- Content area -->
          <div class="debate-content-area" id="debate-content-area" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; position: relative;">
            
            <!-- Thread (Active Debate Room) -->
            <div class="debate-thread" id="debate-thread" style="flex: 1; overflow-y: auto;">
              <div class="debate-empty-state" id="debate-empty-state">
                <div class="des-icon">
                  <img src="/static/hekki.png" alt="Logo" style="width: 44px; height: 44px; border-radius: 50%; object-fit: contain; pointer-events: none;" />
                </div>
                <div class="des-title">Start a Debate</div>
                <div class="des-subtitle">Type a topic below — Alpha and Beta will argue it out across 3 rounds. You can intervene anytime.</div>
              </div>
            </div>

            <!-- Documentary Reader Panel (Hidden initially) -->
            <div class="debate-doc-viewer" id="debate-doc-viewer" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 100;">
              <div class="doc-viewer-header">
                <button class="debate-back-btn" id="btn-doc-close" title="Back to Debate">
                  <i data-lucide="chevron-left" style="width:18px; height:18px;"></i>
                </button>
                <div class="doc-viewer-controls">
                  <button class="doc-viewer-btn" id="btn-doc-go-chat" title="View Chat Transcript" style="display: none; margin-right: 6px;">
                    <i data-lucide="message-square" style="width:14px; height:14px; margin-right:4px;"></i><span>Chat</span>
                  </button>
                  <button class="doc-viewer-btn" id="btn-doc-copy" title="Copy to Clipboard">
                    <i data-lucide="copy" style="width:14px; height:14px; margin-right:4px;"></i><span>Copy</span>
                  </button>
                  <button class="doc-viewer-btn" id="btn-doc-voice">
                    <i data-lucide="volume-x" style="width:14px; height:14px; margin-right:4px;"></i><span>Voice: Off</span>
                  </button>
                  <div class="doc-dropdown">
                    <button class="doc-viewer-btn dropdown-toggle" id="btn-doc-export">
                      <i data-lucide="download" style="width:14px; height:14px; margin-right:4px;"></i><span>Export</span>
                      <i data-lucide="chevron-down" style="width:12px; height:12px; margin-left:4px;"></i>
                    </button>
                    <div class="doc-dropdown-menu" id="doc-export-menu">
                      <button class="dropdown-item" data-format="pdf">Export to PDF</button>
                      <button class="dropdown-item" data-format="word">Export to Word</button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="doc-viewer-content" id="doc-viewer-content">
                <!-- Rendered document gets inserted here -->
              </div>
            </div>

            <!-- Documentary Directory Viewer (Two-Column Layout) -->
            <div class="debate-doc-viewer" id="debate-directory-viewer" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 100;">
              <div class="doc-viewer-header">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <button class="debate-back-btn" id="btn-dir-close" title="Back to Debate">
                    <i data-lucide="chevron-left" style="width:18px; height:18px;"></i>
                  </button>
                  <div style="font-weight: 600; color: var(--text-primary); font-size: 13px; display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="library" style="width:16px; height:16px; color: #d97706;"></i>
                    <span>Research Spec Directory</span>
                  </div>
                </div>
                <div class="doc-viewer-controls">
                  <button class="doc-viewer-btn" id="btn-dir-copy" title="Copy to Clipboard">
                    <i data-lucide="copy" style="width:14px; height:14px; margin-right:4px;"></i><span>Copy</span>
                  </button>
                </div>
              </div>
              <div class="directory-container" style="display: flex; flex: 1; overflow: hidden; height: calc(100% - 48px);">
                <!-- Left Panel: Index Page (ToC) -->
                <div class="directory-sidebar">
                  <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-3); margin-bottom: 12px; letter-spacing: 0.04em; padding: 0 2px;">Topics Index</div>
                  <div class="directory-topics-list" id="directory-topics-list" style="display: flex; flex-direction: column; gap: 8px;">
                    <!-- Injected dynamically -->
                  </div>
                </div>
                <!-- Right Panel: Clean Spec Content -->
                <div class="directory-content" id="directory-content-area">
                  <div class="directory-empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin: auto; max-width: 400px; text-align: center; color: var(--text-secondary);">
                    <i data-lucide="book-open" style="width: 40px; height: 40px; color: var(--text-3); margin-bottom: 12px; opacity: 0.6;"></i>
                    <h3 style="font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">Select a Research Topic</h3>
                    <p style="font-size: 12px; color: var(--text-3); line-height: 1.5;">Click on any topic from the index list on the left to read its full clean specification sheet, proposed designs, and test protocols.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Input area -->
            <div class="debate-input-area" id="debate-input-area">
              <!-- Active status indicator card (attached to input area, floats above it) -->
              <div class="debate-active-search-card" id="debate-active-search-card" style="display: none; align-items: center; justify-content: space-between; width: 100%; max-width: 720px; box-sizing: border-box; margin: 0 auto -12px auto; padding: 10px 16px 20px 16px; background: var(--bg); border: 1px solid var(--border); border-bottom: none; border-radius: var(--radius-lg) var(--radius-lg) 0 0; box-shadow: var(--shadow); font-size: 11.5px; opacity: 0; transform: translateY(15px); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); position: relative; z-index: 1;">
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                  <span class="status-spinner-wrap" style="display: inline-flex; align-items: center; justify-content: center; color: var(--text-secondary); animation: spin 1.2s linear infinite;">
                    <i data-lucide="loader-2" style="width: 14px; height: 14px;"></i>
                  </span>
                  <div style="display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1;">
                    <span class="status-title" style="font-weight: 500; color: var(--text-3); font-size: 9.5px; letter-spacing: 0.02em;">Research task</span>
                    <span class="status-query" id="debate-active-search-query" style="color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; font-weight: 400;">Searching...</span>
                  </div>
                </div>
                <div class="status-badge" id="debate-active-search-badge" style="font-size: 9.5px; font-weight: 600; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.02em;">ALPHA</div>
              </div>

              <!-- Active progress indicator card (attached to input area, floats above it) -->
              <div class="debate-active-progress-card" id="debate-active-progress-card" style="display: none; align-items: center; justify-content: space-between; width: 100%; max-width: 720px; box-sizing: border-box; margin: 0 auto -12px auto; padding: 10px 16px 20px 16px; background: var(--sidebar-bg); border: 1px solid var(--border); border-bottom: none; border-radius: var(--radius-lg) var(--radius-lg) 0 0; box-shadow: var(--shadow); font-size: 11.5px; opacity: 0; transform: translateY(15px); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); position: relative; z-index: 1;">
                <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                  <!-- Left side: Monochromatic progress bar line container -->
                  <div style="width: 80px; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; position: relative; flex-shrink: 0;">
                    <div id="debate-progress-bar-fill" style="width: 5%; height: 100%; background: var(--text-primary); border-radius: 2px; position: absolute; left: 0; top: 0; transition: width 0.4s ease;"></div>
                  </div>
                  <!-- Middle: Status text and percentage -->
                  <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                    <span id="debate-progress-text" style="color: var(--text-primary); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">Tony Stark is responding...</span>
                    <span id="debate-progress-pct" style="display: none;">5%</span>
                  </div>
                </div>
                <!-- Right side: Rounded AI avatar representation -->
                <div id="debate-progress-avatar" style="width: 20px; height: 20px; border-radius: 50%; background: var(--text-primary); color: var(--bg); display: flex; align-items: center; justify-content: center; font-weight: 400; font-size: 9.5px; flex-shrink: 0; text-transform: uppercase;">T</div>
              </div>

              <div class="debate-input-wrapper" id="debate-input-capsule" style="position: relative; z-index: 2; display: flex; flex-direction: column; align-items: stretch; gap: 0; padding: 8px 14px;">
                <div class="input-preview-area hidden" id="preview-area-debate"></div>
                <div class="input-capsule-row" style="display: flex; flex-direction: row; align-items: center; gap: 8px; width: 100%;">
                  <!-- Attachment button (plus) -->
                  <button class="cap-icon-btn" id="btn-attach-debate" title="Attach" style="flex-shrink: 0;">
                    <i data-lucide="plus"></i>
                  </button>

                  <textarea
                    class="debate-textarea"
                    id="debate-input"
                    rows="1"
                    placeholder="Enter a topic to debate… e.g. 'Is AI replacing human creativity?'"
                    style="flex: 1; resize: none; outline: none; border: none; background: transparent; padding: 3px 0; min-height: 24px; height: 24px; color:var(--text); font-family:var(--font); font-size:14px; line-height:1.45; max-height:200px; overflow-y:hidden; display:block;"
                  ></textarea>
                  
                  <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    <!-- Rounds Dropdown -->
                    <select class="debate-rounds-select" id="select-debate-rounds">
                      <option value="2">2 Rounds</option>
                      <option value="3" selected>3 Rounds</option>
                      <option value="4">4 Rounds</option>
                      <option value="5">5 Rounds</option>
                    </select>
                    
                    <!-- Stop Button -->
                    <button class="input-action-btn" id="btn-debate-stop" title="Stop Generation" style="display: none; color: #ef4444;">
                      <i data-lucide="square" style="width: 13px; height: 13px; fill: currentColor;"></i>
                    </button>
                    
                    <!-- Intervene Button -->
                    <button class="submit-btn" id="btn-debate-intervene" title="Send Message" style="display: none;">
                      <i data-lucide="arrow-up" style="width: 14px; height: 14px; stroke-width: 2.5;"></i>
                    </button>
                    
                    <!-- Start Button -->
                    <button class="submit-btn" id="btn-debate-start" title="Start Debate">
                      <i data-lucide="arrow-up" style="width: 14px; height: 14px; stroke-width: 2.5;"></i>
                    </button>
                  </div>
                </div>
              </div>
              <div class="bottom-disclaimer">
                Hekki can make mistakes. Verify important info.
              </div>
            </div>

          </div>
        </div>



      </div>
    </div>
    </div>
  `;
}

// ── Event bindings ──────────────────────────────────────────────────────────
function _bindEvents() {
  const $ = (id) => document.getElementById(id);

  if (window.setup3DAvatar) window.setup3DAvatar();

  const textarea = $('debate-input');
  if (textarea) {
    textarea.style.overflowY = 'hidden';
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
      textarea.style.overflowY = textarea.scrollHeight > 100 ? 'auto' : 'hidden';
    });
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (_debateRunning) {
          _interveneDebate();
        } else {
          _startDebate();
        }
      }
    });
  }

  $('btn-debate-start')?.addEventListener('click', _startDebate);
  $('btn-debate-intervene')?.addEventListener('click', _interveneDebate);
  $('btn-debate-stop')?.addEventListener('click', _stopDebateOnly);
  $('btn-debate-pause')?.addEventListener('click', _togglePause);
  $('btn-debate-voice')?.addEventListener('click', _toggleVoice);
  $('btn-sidebar-voice')?.addEventListener('click', _toggleVoice);
  $('btn-input-voice')?.addEventListener('click', _toggleVoice);
  $('btn-input-attach')?.addEventListener('click', _openDirectoryViewer);
  $('btn-debate-reset')?.addEventListener('click', _resetDebate);
  $('btn-sidebar-new-debate')?.addEventListener('click', _resetDebate);
  $('btn-sidebar-reset')?.addEventListener('click', _resetDebate);
  $('btn-debate-back')?.addEventListener('click', () => {
    router.navigateTo('chat');
  });
  $('btn-debate-sidebar-back')?.addEventListener('click', () => {
    router.navigateTo('chat');
  });

  const _updateDebateCollapseIcons = (isCollapsed) => {
    ['btn-debate-sidebar-toggle'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const icon = btn.querySelector('i[data-lucide]');
      if (icon) {
        icon.setAttribute('data-lucide', isCollapsed ? 'panel-left-open' : 'panel-left-close');
        if (window.lucide) lucide.createIcons();
      }
    });
  };

  const toggleDebateSidebar = () => {
    const layout = document.querySelector('.debate-layout');
    if (layout) {
      layout.classList.toggle('collapsed-sidebar');
      const isCollapsed = layout.classList.contains('collapsed-sidebar');
      _updateDebateCollapseIcons(isCollapsed);
    }
  };
  document.getElementById('btn-debate-sidebar-toggle')?.addEventListener('click', toggleDebateSidebar);
  document.getElementById('btn-debate-sidebar-toggle-main')?.addEventListener('click', toggleDebateSidebar);
  // Documentary Viewer bindings
  $('btn-doc-close')?.addEventListener('click', _closeDocViewer);
  $('btn-doc-voice')?.addEventListener('click', _toggleDocVoice);
  
  const exportBtn = $('btn-doc-export');
  const exportMenu = $('doc-export-menu');
  if (exportBtn && exportMenu) {
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu.classList.toggle('show');
    });
    document.addEventListener('click', () => {
      exportMenu.classList.remove('show');
    });
  }

  exportMenu?.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const format = e.target.getAttribute('data-format');
      _exportDoc(format);
    });
  });

  // Research Directory event bindings
  $('btn-sidebar-research-directory')?.addEventListener('click', _openDirectoryViewer);
  $('btn-dir-close')?.addEventListener('click', _closeDirectoryViewer);

  // Simulation Viewer event bindings (removed)

  // Copy buttons event bindings
  $('btn-doc-copy')?.addEventListener('click', () => {
    _copyActiveDocumentary('btn-doc-copy', window._currentDocumentary);
  });
  $('btn-dir-copy')?.addEventListener('click', () => {
    _copyActiveDocumentary('btn-dir-copy', window._currentDirectoryDoc);
  });
  $('btn-debate-copy-all')?.addEventListener('click', _copyAllDebateContent);

  // Documents 3-dot dropdown menu bindings
  const docsMenuBtn = $('btn-debate-docs-menu');
  const docsDropdownMenu = $('debate-docs-dropdown-menu');
  if (docsMenuBtn && docsDropdownMenu) {
    docsMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      $('doc-export-menu')?.classList.remove('show');
      docsDropdownMenu.classList.toggle('show');
    });
    document.addEventListener('click', () => {
      docsDropdownMenu.classList.remove('show');
    });
  }

  // Action: Clean All Saved Documents
  const clearDocsBtn = $('btn-debate-clear-docs');
  if (clearDocsBtn) {
    clearDocsBtn.addEventListener('click', () => {
      if (window.showCustomConfirm) {
        window.showCustomConfirm(
          'Clean All Documents',
          'Are you sure you want to delete all saved documents? This cannot be undone.',
          (confirmed) => {
            if (confirmed) {
              localStorage.removeItem('mariano_docs');
              _refreshSavedDocsList();
              showToast('Documents Cleared', 'All saved documents have been deleted.', 3000);
            }
          }
        );
      } else {
        if (confirm('Delete all saved documents?')) {
          localStorage.removeItem('mariano_docs');
          _refreshSavedDocsList();
        }
      }
    });
  }

  // Action: Upload Document
  const uploadDocsBtn = $('btn-debate-upload-doc');
  const uploadInput = $('debate-doc-upload-input');
  if (uploadDocsBtn && uploadInput) {
    uploadDocsBtn.addEventListener('click', () => {
      uploadInput.value = ''; // Reset
      uploadInput.click();
    });
    
    uploadInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const defaultTitle = file.name.replace(/\.[^/.]+$/, "");
        
        if (window.showCustomPrompt) {
          window.showCustomPrompt(
            'Document Title',
            'Enter a title for the uploaded document:',
            defaultTitle,
            (title) => {
              if (title && title.trim()) {
                const newDoc = {
                  title: title.trim(),
                  content: content
                };
                _saveDocumentary(newDoc);
                _refreshSavedDocsList();
                showToast('Document Uploaded', `"${newDoc.title}" uploaded successfully.`, 3000);
              }
            }
          );
        } else {
          const title = prompt('Enter a title for the uploaded document:', defaultTitle);
          if (title && title.trim()) {
            const newDoc = {
              title: title.trim(),
              content: content
            };
            _saveDocumentary(newDoc);
            _refreshSavedDocsList();
          }
        }
      };
      reader.readAsText(file);
    });
  }

  // Action: Export All Documents
  const exportDocsBtn = $('btn-debate-export-docs');
  if (exportDocsBtn) {
    exportDocsBtn.addEventListener('click', () => {
      try {
        const listJson = localStorage.getItem('mariano_docs');
        const list = listJson ? JSON.parse(listJson) : [];
        if (list.length === 0) {
          showToast('Export Failed', 'No documents to export.', 3000);
          return;
        }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(list, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `mariano_debate_documents_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('Export Successful', `Exported ${list.length} documents.`, 3000);
      } catch (e) {
        console.error('Failed to export documents', e);
        showToast('Export Error', 'An error occurred during export.', 3000);
      }
    });
  }

  // Load existing documentaries from local storage
  _refreshSavedDocsList();

  const selectAlpha = $('select-alpha-model');
  const selectBeta = $('select-beta-model');
  if (selectAlpha) selectAlpha.addEventListener('change', _syncTopbarModelTags);
  if (selectBeta) selectBeta.addEventListener('change', _syncTopbarModelTags);

  // ── Debate User Profile Bindings ──
  const debateUserProfileBtn = $('btn-debate-sidebar-user-profile');
  const debateUserMenuDropdown = $('debate-user-menu-dropdown');
  if (debateUserProfileBtn && debateUserMenuDropdown) {
    debateUserProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      debateUserMenuDropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
      debateUserMenuDropdown.classList.add('hidden');
    });
  }

  $('btn-debate-user-settings')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (debateUserMenuDropdown) debateUserMenuDropdown.classList.add('hidden');
    document.getElementById('btn-user-settings')?.click();
  });

  $('btn-debate-user-theme')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (debateUserMenuDropdown) debateUserMenuDropdown.classList.add('hidden');
    document.getElementById('btn-user-theme')?.click();
  });

  $('btn-debate-user-logout')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (debateUserMenuDropdown) debateUserMenuDropdown.classList.add('hidden');
    document.getElementById('btn-user-logout')?.click();
  });
}


function _toggleVoice() {
  _voiceEnabled = !_voiceEnabled;

  // 1. Update Topbar Voice Button
  const topBtn = document.getElementById('btn-debate-voice');
  if (topBtn) {
    topBtn.innerHTML = _voiceEnabled
      ? `<i data-lucide="volume-2" style="width:14px; height:14px; margin-right:4px;"></i><span>Voice: On</span>`
      : `<i data-lucide="volume-x" style="width:14px; height:14px; margin-right:4px;"></i><span>Voice: Off</span>`;
    if (window.lucide) lucide.createIcons({ parent: topBtn });
  }

  // 2. Update Sidebar List Voice Button Icon & Label
  const sideIconWrap = document.getElementById('btn-sidebar-voice-icon-wrap');
  if (sideIconWrap) {
    sideIconWrap.innerHTML = _voiceEnabled
      ? `<i data-lucide="volume-2" style="width:15px; height:15px;"></i>`
      : `<i data-lucide="volume-x" style="width:15px; height:15px;"></i>`;
    if (window.lucide) lucide.createIcons({ parent: sideIconWrap });
  }

  // 3. Update Sidebar List Voice Label Text
  const sideLbl = document.getElementById('lbl-sidebar-voice');
  if (sideLbl) {
    sideLbl.textContent = _voiceEnabled ? 'Voice: On' : 'Voice: Off';
  }

  // 4. Update Input Mic Button
  const inputVoiceBtn = document.getElementById('btn-input-voice');
  if (inputVoiceBtn) {
    if (_voiceEnabled) {
      inputVoiceBtn.classList.add('active');
      inputVoiceBtn.title = 'Voice Speak: On';
    } else {
      inputVoiceBtn.classList.remove('active');
      inputVoiceBtn.title = 'Voice Speak: Off';
    }
  }

  if (!_voiceEnabled && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function _speakText(text, character) {
  if (!_voiceEnabled) return;
  if (!window.speechSynthesis) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Clean the text from markdown syntax (like *, #, -, etc.) before speaking
  const cleanText = text
    .replace(/[*#`_\-\[\]()]/g, '')
    .replace(/\$[^\$]+\$/g, '') // remove inline math
    .trim();

  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  const voices = window.speechSynthesis.getVoices();

  // Try to find custom voice properties depending on participant role
  if (character === 'alpha') {
    // Tony Stark: confident, slightly faster paced
    const maleVoice = voices.find(v => 
      v.name.toLowerCase().includes('david') || 
      v.name.toLowerCase().includes('male') || 
      v.name.toLowerCase().includes('google us english') ||
      v.lang.startsWith('en-US')
    );
    if (maleVoice) utterance.voice = maleVoice;
    utterance.rate = 1.1;
    utterance.pitch = 1.05;
  } else if (character === 'beta') {
    // Bruce Banner: calm, academic, slower paced
    const betaVoice = voices.find(v => 
      v.name.toLowerCase().includes('zira') || 
      v.name.toLowerCase().includes('google uk english male') ||
      v.name.toLowerCase().includes('daniel') ||
      v.lang.startsWith('en-GB')
    );
    if (betaVoice) utterance.voice = betaVoice;
    utterance.rate = 0.95;
    utterance.pitch = 0.9;
  }

  window.speechSynthesis.speak(utterance);
}

// ── Start ───────────────────────────────────────────────────────────────────
function _getModelFriendlyName(id) {
  if (id === 'gemini-3.1-flash-lite') return 'Gemini 3.1 Flash';
  if (id === 'qwen') return 'Qwen';
  return id;
}

function _syncTopbarModelTags() {
  const modelAlpha = document.getElementById('select-alpha-model')?.value || '';
  const modelBeta = document.getElementById('select-beta-model')?.value || '';
  const alphaModelEl = document.querySelector('.debate-model-tag.alpha-tag .tag-model');
  const betaModelEl = document.querySelector('.debate-model-tag.beta-tag .tag-model');
  if (alphaModelEl) alphaModelEl.textContent = ` · ${_getModelFriendlyName(modelAlpha)}`;
  if (betaModelEl) betaModelEl.textContent = ` · ${_getModelFriendlyName(modelBeta)}`;
}

function _startDebate() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  const input = document.getElementById('debate-input');
  const topic = input?.value?.trim();
  if (!topic) {
    input?.focus();
    return;
  }

  input.value = '';
  input.style.height = 'auto';

  // 1. Create a playground chat session in LocalStorage
  ChatSessionManager.createPlaygroundChat(topic);

  // 2. Hide empty state
  document.getElementById('debate-empty-state')?.remove();

  // 3. Append user topic bubble
  _appendUserBubble(topic);
  ChatSessionManager.appendPlaygroundMessage('user', topic);

  const ws = window.socket;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    _appendSystemBubble('WebSocket not connected. Please refresh.');
    return;
  }

  const modelAlpha = document.getElementById('select-alpha-model')?.value || '';
  const modelBeta = document.getElementById('select-beta-model')?.value || '';
  const rounds = parseInt(document.getElementById('select-debate-rounds')?.value || '3', 10);

  // Update topbar badges & rounds
  const alphaModelEl = document.querySelector('.debate-model-tag.alpha-tag .tag-model');
  const betaModelEl = document.querySelector('.debate-model-tag.beta-tag .tag-model');
  if (alphaModelEl) alphaModelEl.textContent = ` · ${_getModelFriendlyName(modelAlpha)}`;
  if (betaModelEl) betaModelEl.textContent = ` · ${_getModelFriendlyName(modelBeta)}`;

  const totalRoundsSpan = document.getElementById('debate-round-total');
  if (totalRoundsSpan) totalRoundsSpan.textContent = rounds;

  ws.send(JSON.stringify({ 
    type: 'debate_start', 
    topic, 
    rounds: rounds,
    model_alpha: modelAlpha,
    model_beta: modelBeta
  }));
  _setRunningState(true);
  _setFlowStep(1, 'active');
}

// ── Intervene ───────────────────────────────────────────────────────────────
function _interveneDebate() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  const input = document.getElementById('debate-input');
  const msg = input?.value?.trim();
  if (!msg) return;

  input.value = '';
  input.style.height = 'auto';

  _appendUserBubble(msg, true);
  ChatSessionManager.appendPlaygroundMessage('user', msg, { isIntervention: true });

  const ws = window.socket;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'debate_intervene', message: msg }));
  }
}

// ── Pause/Resume ─────────────────────────────────────────────────────────────
function _togglePause() {
  const btn = document.getElementById('btn-debate-pause');
  _paused = !_paused;
  if (_paused && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  const ws = window.socket;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: _paused ? 'debate_pause' : 'debate_resume' }));
  }
  if (btn) {
    btn.innerHTML = _paused 
      ? `<i data-lucide="play" style="width:14px; height:14px; margin-right:4px;"></i><span>Resume</span>`
      : `<i data-lucide="pause" style="width:14px; height:14px; margin-right:4px;"></i><span>Pause</span>`;
    if (window.lucide) lucide.createIcons({ parent: btn });
  }
}

function _stopDebateOnly() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  const ws = window.socket;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'debate_stop' }));
  }
  _setRunningState(false);
  _paused = false;
  
  const pauseBtn = document.getElementById('btn-debate-pause');
  if (pauseBtn) {
    pauseBtn.innerHTML = `<i data-lucide="pause" style="width:14px; height:14px; margin-right:4px;"></i><span>Pause</span>`;
    if (window.lucide) lucide.createIcons({ parent: pauseBtn });
  }
}

// ── Reset ───────────────────────────────────────────────────────────────────
function _resetDebate() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  const ws = window.socket;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'debate_stop' }));
  }
  _setRunningState(false);
  _currentTurn = null;
  _roundNum = 0;
  _paused = false;
  _hideActiveSearch();

  const pauseBtn = document.getElementById('btn-debate-pause');
  if (pauseBtn) {
    pauseBtn.innerHTML = `<i data-lucide="pause" style="width:14px; height:14px; margin-right:4px;"></i><span>Pause</span>`;
    if (window.lucide) lucide.createIcons({ parent: pauseBtn });
  }

  const thread = document.getElementById('debate-thread');
  if (thread) {
    thread.innerHTML = `
      <div class="debate-empty-state" id="debate-empty-state">
        <div class="des-icon">
          <img src="/static/hekki.png" alt="Logo" style="width: 44px; height: 44px; border-radius: 50%; object-fit: contain; pointer-events: none;" />
        </div>
        <div class="des-title">Start a Debate</div>
        <div class="des-subtitle">Type a topic below — Alpha and Beta will argue it out across 3 rounds. You can intervene anytime.</div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  ['1','2','3','s'].forEach(s => _setFlowStep(s, 'idle'));
  _setParticipantStatus('alpha', 'Idle');
  _setParticipantStatus('beta', 'Idle');
  _setDot('alpha', false);
  _setDot('beta', false);
  _setDot('user', true);
  _setStatusPill('idle', 'Ready');
  document.getElementById('debate-round-pill').style.display = 'none';

  // Restore agent name defaults
  ALPHA_NAME = 'Tony Stark';
  BETA_NAME  = 'Bruce Banner';

  const dpAlphaName = document.querySelector('#dp-alpha .dp-name');
  const dpAlphaAvatar = document.querySelector('#dp-alpha .dp-avatar');
  if (dpAlphaName) dpAlphaName.textContent = ALPHA_NAME;
  if (dpAlphaAvatar) dpAlphaAvatar.textContent = ALPHA_NAME.charAt(0);

  const dpBetaName = document.querySelector('#dp-beta .dp-name');
  const dpBetaAvatar = document.querySelector('#dp-beta .dp-avatar');
  if (dpBetaName) dpBetaName.textContent = BETA_NAME;
  if (dpBetaAvatar) dpBetaAvatar.textContent = BETA_NAME.charAt(0);

  const alphaTagLabel = document.querySelector('.debate-model-tag.alpha-tag .tag-name');
  const alphaTagSub = document.querySelector('.debate-model-tag.alpha-tag .tag-model');
  if (alphaTagLabel) alphaTagLabel.textContent = ALPHA_NAME;
  if (alphaTagSub) alphaTagSub.textContent = ' · Applied Physics';

  const betaTagLabel = document.querySelector('.debate-model-tag.beta-tag .tag-name');
  const betaTagSub = document.querySelector('.debate-model-tag.beta-tag .tag-model');
  if (betaTagLabel) betaTagLabel.textContent = BETA_NAME;
  if (betaTagSub) betaTagSub.textContent = ' · Biophysics';
}

// ── Debate event handler ─────────────────────────────────────────────────────
export function handleDebateEvent(event) {
  const { kind, sender, target, data, round } = event;

  switch (kind) {
    case 'init': {
      ALPHA_NAME = event.alpha_name || 'Tony Stark';
      BETA_NAME = event.beta_name || 'Bruce Banner';

      const dpAlphaName = document.querySelector('#dp-alpha .dp-name');
      const dpAlphaAvatar = document.querySelector('#dp-alpha .dp-avatar');
      if (dpAlphaName) dpAlphaName.textContent = ALPHA_NAME;
      if (dpAlphaAvatar) dpAlphaAvatar.textContent = ALPHA_NAME.charAt(0);

      const dpBetaName = document.querySelector('#dp-beta .dp-name');
      const dpBetaAvatar = document.querySelector('#dp-beta .dp-avatar');
      if (dpBetaName) dpBetaName.textContent = BETA_NAME;
      if (dpBetaAvatar) dpBetaAvatar.textContent = BETA_NAME.charAt(0);

      const alphaTagLabel = document.querySelector('.debate-model-tag.alpha-tag .tag-name');
      const alphaTagSub = document.querySelector('.debate-model-tag.alpha-tag .tag-model');
      if (alphaTagLabel) alphaTagLabel.textContent = ALPHA_NAME;
      if (alphaTagSub) {
        const sub = ALPHA_NAME === 'Tony Stark' ? ' · Applied Physics' :
                    ALPHA_NAME === 'Bruce Banner' ? ' · Biophysics' :
                    ALPHA_NAME === 'Shuri' ? ' · Advanced Systems' :
                    '';
        if (sub) alphaTagSub.textContent = sub;
      }

      const betaTagLabel = document.querySelector('.debate-model-tag.beta-tag .tag-name');
      const betaTagSub = document.querySelector('.debate-model-tag.beta-tag .tag-model');
      if (betaTagLabel) betaTagLabel.textContent = BETA_NAME;
      if (betaTagSub) {
        const sub = BETA_NAME === 'Tony Stark' ? ' · Applied Physics' :
                    BETA_NAME === 'Bruce Banner' ? ' · Biophysics' :
                    BETA_NAME === 'Shuri' ? ' · Advanced Systems' :
                    '';
        if (sub) betaTagSub.textContent = sub;
      }
      appendHudLog(`[INFO] Debate initialized with Alpha: ${ALPHA_NAME}, Beta: ${BETA_NAME}`);
      break;
    }

    case 'search_start': {
      _setParticipantStatus(sender, `🔍 Searching…`);
      _setDot(sender, true);
      _setStatusPill('running', `${_nameOf(sender)} searching web…`);
      appendHudLog(`[EXEC] ${_nameOf(sender)} web search query: "${data}"`);
      _showActiveSearch(sender, data);
      break;
    }

    case 'search_done': {
      _setParticipantStatus(sender, `completed Ready`);
      _setDot(sender, false);
      appendHudLog(`completed Success: ${_nameOf(sender)} web search completed (${data})`);
      _hideActiveSearch();
      break;
    }

    case 'turn_start': {
      _roundNum = round;
      document.getElementById('debate-round-num').textContent =
        sender === 'synthesis' ? '✦' : round;
      document.getElementById('debate-round-pill').style.display = 'flex';
      _showActiveProgress(sender, sender === 'synthesis' ? 'Collaborating on solution...' : `${_nameOf(sender)} is responding...`);

      if (sender === 'synthesis') {
        _setParticipantStatus('alpha', 'Collaborating…');
        _setParticipantStatus('beta', 'Collaborating…');
        _setDot('alpha', true);
        _setDot('beta', true);
        _setStatusPill('running', '⚡ Synthesis Round · Converging on joint solution');
        appendHudLog('[INFO] Synthesis round started — both agents converging on ONE solution');
      } else {
        _setParticipantStatus('alpha', sender === 'alpha' ? 'Speaking…' : 'Listening');
        _setParticipantStatus('beta', sender === 'beta' ? 'Speaking…' : 'Listening');
        _setDot('alpha', sender === 'alpha');
        _setDot('beta', sender === 'beta');
        _setStatusPill('running', `Round ${round} · ${_nameOf(sender)} speaking`);
        appendHudLog(`[INFO] Debate round ${round}: ${_nameOf(sender)} starting response generation`);
      }
      _setDot('user', false);
      _setFlowStep(round, 'active');

      const dirLabel = _dirLabel(sender, target, round);
      _currentTurn = _appendStreamBubble(sender, dirLabel, round);
      
      // Store new turn container in memory
      ChatSessionManager.appendPlaygroundMessage(sender, '', { round });
      window._currentStreamingText = '';
      break;
    }

    case 'chunk': {
      if (_currentTurn) {
        _currentTurn.append(data);
        _scrollThread();
        _chunkCount++;
        const pct = Math.min(5 + Math.floor((_chunkCount / 80) * 90), 98);
        _updateActiveProgress(pct);
        
        // Update streamed text in local storage
        window._currentStreamingText = (window._currentStreamingText || '') + data;
        ChatSessionManager.updateLastPlaygroundMessage(window._currentStreamingText);
      }
      break;
    }

    case 'turn_end': {
      _hideActiveProgress();
      if (_currentTurn) {
        const fullText = window._currentStreamingText || '';
        _currentTurn.finalize();
        _currentTurn = null;
        _speakText(fullText, sender);
      }
      window._currentStreamingText = '';
      _setParticipantStatus(sender, 'Done');
      _setDot(sender, false);
      _setFlowStep(_roundNum, 'done');
      _scrollThread();
      appendHudLog(`completed Success: ${_nameOf(sender)} round ${_roundNum} turn end`);
      break;
    }

    case 'simulation_run_start': {
      if (window.showSimulationLoading) {
        window.showSimulationLoading(`Autonomous solve starting: ${data.name}`);
      }
      appendHudLog(`[INFO] AI autonomously triggered Modulus simulation run: ${data.name}`);
      break;
    }

    case 'simulation_run_done': {
      if (window.hideSimulationLoading) {
        window.hideSimulationLoading();
      }
      const selectElement = document.getElementById('select-active-simulation');
      if (selectElement && window.loadSimulationList) {
        window.loadSimulationList().then(() => {
          selectElement.value = data.filename;
          if (window.loadSimulationDetail) {
            window.loadSimulationDetail(data.filename);
          }
        });
      }
      if (window.showToast) {
        window.showToast("Autonomous Simulation Complete", `AI solved and loaded ${data.name} in 3D.`, 4000);
      }
      appendHudLog(`completed Success: AI autonomously ran Modulus simulation: ${data.name}`);
      break;
    }

    case 'summary_start': {
      _summaryCard = _createSummaryCard();
      _setStatusPill('running', 'Generating summary…');
      _setFlowStep('s', 'active');
      appendHudLog(`[INFO] Debate loop ended; generating final summary card`);
      _showActiveProgress('synthesis', 'Generating final summary...');
      
      // Store summary block start in memory
      ChatSessionManager.appendPlaygroundMessage('summary', '');
      window._currentStreamingText = '';
      break;
    }

    case 'summary_chunk': {
      if (_summaryCard) {
        const body = _summaryCard.querySelector('.debate-summary-body');
        _chunkCount++;
        const pct = Math.min(5 + Math.floor((_chunkCount / 80) * 90), 98);
        _updateActiveProgress(pct);
        window._currentStreamingText = (window._currentStreamingText || '') + data;
        if (body) {
          body.innerHTML = window.marked 
            ? marked.parse(window._currentStreamingText) 
            : _escape(window._currentStreamingText);
          enhanceMarkdownContent(body);
        }
        _scrollThread();
        ChatSessionManager.updateLastPlaygroundMessage(window._currentStreamingText);
      }
      break;
    }

    case 'summary_end': {
      _hideActiveProgress();
      window._currentStreamingText = '';
      _setRunningState(false);
      _setStatusPill('idle', 'Debate complete');
      _setParticipantStatus('alpha', 'Done');
      _setParticipantStatus('beta', 'Done');
      _setDot('alpha', false);
      _setDot('beta', false);
      _setDot('user', true);
      _setFlowStep('s', 'done');
      _scrollThread();
      appendHudLog(`completed Success: Debate summary completed`);
      break;
    }

    case 'doc_start': {
      _setStatusPill('running', 'Compiling Research Documentary…');
      appendHudLog(`[INFO] Compiling full debate transcript into research documentary...`);
      break;
    }

    case 'doc_ready': {
      _setStatusPill('idle', 'Document Ready');
      const payload = event.payload;
      if (payload) {
        _saveDocumentary(payload);
        _refreshSavedDocsList();
        _refreshDirectoryTopics();
        _openDocumentary(payload);
        appendHudLog(`completed Success: Research documentary compiled: "${payload.title}"`);
      } else {
        appendHudLog(`✕ Failed: Received empty documentary payload`);
      }
      break;
    }

    case 'error': {
      _setRunningState(false);
      _setStatusPill('idle', 'Error occurred');
      _setParticipantStatus(sender, 'Failed');
      _setDot(sender, false);
      _appendSystemBubble(`Error: ${data}`);
      appendHudLog(`✕ Failed: Debate error in agent ${_nameOf(sender)}: ${data}`);
      break;
    }
  }
}

// ── Bubble builders ──────────────────────────────────────────────────────────
function _appendUserBubble(text, isIntervention = false) {
  const thread = document.getElementById('debate-thread');

  const msg = document.createElement('div');
  msg.className = 'debate-msg debate-msg-user';
  msg.innerHTML = `
    <div class="debate-badge-row center">
      <span class="debate-sender-badge user-badge">${isIntervention ? '💬 You intervened' : '🎯 You'}</span>
      <span class="debate-target-badge">→ All</span>
    </div>
    <div class="debate-bubble user-bubble">${_escape(text)}</div>
  `;
  thread.appendChild(msg);
  _scrollThread();
}

function _appendSystemBubble(text) {
  const thread = document.getElementById('debate-thread');
  const msg = document.createElement('div');
  msg.className = 'debate-msg debate-msg-system';
  msg.innerHTML = `<div class="debate-bubble system-bubble">${_escape(text)}</div>`;
  thread.appendChild(msg);
  _scrollThread();
}

function _appendStreamBubble(sender, [from, to], round) {
  const thread = document.getElementById('debate-thread');

  // Synthesis round — special centered card
  if (sender === 'synthesis') {
    const sep = document.createElement('div');
    sep.className = 'debate-round-sep synthesis-sep';
    sep.innerHTML = `<span>⚡ Synthesis Round — Joint Solution</span>`;
    thread.appendChild(sep);

    const card = document.createElement('div');
    card.className = 'debate-msg synthesis-card';
    card.innerHTML = `
      <div class="debate-badge-row left">
        <span class="debate-sender-badge synthesis-badge">⚡ Tony + Bruce</span>
        <span class="debate-arrow">→</span>
        <span class="debate-target-badge">Joint Solution</span>
      </div>
      <div class="debate-bubble synthesis-bubble">
        <span class="debate-typing"><span></span><span></span><span></span></span>
      </div>
    `;
    thread.appendChild(card);
    _scrollThread();

    const bubble = card.querySelector('.debate-bubble');
    let text = '';
    let initialized = false;

    return {
      append(chunk) {
        if (!initialized) {
          bubble.innerHTML = '';
          initialized = true;
        }
        text += chunk;
        bubble.innerHTML = window.marked ? marked.parse(text) : _escape(text);
        enhanceMarkdownContent(bubble);
      },
      finalize() {
        bubble.innerHTML = window.marked ? marked.parse(text) : _escape(text);
        enhanceMarkdownContent(bubble);
        _makeBubbleCollapsibleAndCopyable(bubble, text);
      },
      getText() { return text; }
    };
  }

  // Regular alpha/beta round separator on Alpha's first turn each round
  if (sender === 'alpha') {
    const sep = document.createElement('div');
    sep.className = 'debate-round-sep';
    sep.innerHTML = `<span>Round ${round}</span>`;
    thread.appendChild(sep);
  }

  const isAlpha = sender === 'alpha';
  const msg = document.createElement('div');
  msg.className = `debate-msg ${isAlpha ? 'debate-msg-alpha' : 'debate-msg-beta'}`;
  msg.innerHTML = `
    <div class="debate-badge-row ${isAlpha ? 'left' : 'right'}">
      <span class="debate-sender-badge ${isAlpha ? 'alpha-badge' : 'beta-badge'}">${from}</span>
      <span class="debate-arrow">→</span>
      <span class="debate-target-badge">${to}</span>
    </div>
    <div class="debate-bubble ${isAlpha ? 'alpha-bubble' : 'beta-bubble'}">
      <span class="debate-typing"><span></span><span></span><span></span></span>
    </div>
  `;
  thread.appendChild(msg);
  _scrollThread();

  const bubble = msg.querySelector('.debate-bubble');
  let text = '';
  let initialized = false;

  return {
    append(chunk) {
      if (!initialized) {
        bubble.innerHTML = '';
        initialized = true;
      }
      text += chunk;
      bubble.innerHTML = window.marked ? marked.parse(text) : _escape(text);
      enhanceMarkdownContent(bubble);
    },
    finalize() {
      bubble.innerHTML = window.marked ? marked.parse(text) : _escape(text);
      if (window.marked) {
        enhanceCodeBlocks(bubble);
      }
      if (window.renderMathInElement) {
        renderMathInElement(bubble, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
          ],
          throwOnError: false
        });
      }
      _makeBubbleCollapsibleAndCopyable(bubble, text);
    }
  };
}

function _makeBubbleCollapsibleAndCopyable(bubble, text) {
  if (!bubble || !bubble.parentNode) return;
  if (bubble.parentNode.querySelector('.bubble-control-bar')) return;

  setTimeout(() => {
    const height = bubble.scrollHeight;
    const isLong = height > 280; // Collapse if content height is over 280px

    const ctrlBar = document.createElement('div');
    ctrlBar.className = 'bubble-control-bar';

    let toggleBtnHtml = '';
    if (isLong) {
      bubble.classList.add('collapsible-bubble');
      toggleBtnHtml = `
        <button class="btn-bubble-toggle">
          <i data-lucide="chevron-down" style="width:14px; height:14px; margin-right:4px;"></i>
          <span>Show More</span>
        </button>
      `;
    }

    ctrlBar.innerHTML = `
      ${toggleBtnHtml}
      <button class="btn-bubble-copy" title="Copy Turn Text">
        <i data-lucide="copy" style="width:14px; height:14px; margin-right:4px;"></i>
        <span>Copy</span>
      </button>
    `;

    bubble.parentNode.appendChild(ctrlBar);
    if (window.lucide) lucide.createIcons({ parent: ctrlBar });

    if (isLong) {
      const toggleBtn = ctrlBar.querySelector('.btn-bubble-toggle');
      toggleBtn.addEventListener('click', () => {
        const isExpanded = bubble.classList.toggle('expanded');
        toggleBtn.innerHTML = isExpanded
          ? `<i data-lucide="chevron-up" style="width:14px; height:14px; margin-right:4px;"></i><span>Show Less</span>`
          : `<i data-lucide="chevron-down" style="width:14px; height:14px; margin-right:4px;"></i><span>Show More</span>`;
        if (window.lucide) lucide.createIcons({ parent: toggleBtn });
      });
    }

    const copyBtn = ctrlBar.querySelector('.btn-bubble-copy');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.innerHTML = `<i data-lucide="check" style="width:14px; height:14px; margin-right:4px; color: #16a34a;"></i><span style="color: #16a34a;">Copied!</span>`;
        if (window.lucide) lucide.createIcons({ parent: copyBtn });
        setTimeout(() => {
          copyBtn.innerHTML = `<i data-lucide="copy" style="width:14px; height:14px; margin-right:4px;"></i><span>Copy</span>`;
          if (window.lucide) lucide.createIcons({ parent: copyBtn });
        }, 2000);
      });
    });
  }, 50);
}

function _createSummaryCard() {
  const thread = document.getElementById('debate-thread');

  const sep = document.createElement('div');
  sep.className = 'debate-round-sep';
  sep.innerHTML = `<span>Debate Summary</span>`;
  thread.appendChild(sep);

  const card = document.createElement('div');
  card.className = 'debate-summary-card';
  card.innerHTML = `
    <div class="debate-summary-icon">📋</div>
    <div class="debate-summary-body"></div>
  `;
  thread.appendChild(card);
  _scrollThread();
  return card;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function _dirLabel(sender, target, round) {
  const from = sender === 'alpha' ? ALPHA_NAME : BETA_NAME;
  const to   = target === 'all'   ? 'All'
             : target === 'alpha' ? ALPHA_NAME
             : BETA_NAME;
  return [from, to];
}

function _nameOf(s) {
  return s === 'alpha' ? ALPHA_NAME : s === 'beta' ? BETA_NAME : USER_NAME;
}

function _setParticipantStatus(who, text) {
  const el = document.getElementById(`dp-${who}-status`);
  if (el) el.textContent = text;
  const card = document.getElementById(`dp-${who}`);
  if (card) {
    card.classList.toggle('dp-active', text === 'Thinking…');
  }
}

function _setDot(who, active) {
  const dot = document.getElementById(`dp-${who}-dot`);
  if (dot) dot.classList.toggle('active', active);
}

function _setStatusPill(state, text) {
  const pill = document.getElementById('debate-status-pill');
  const label = document.getElementById('debate-status-text');
  if (pill) pill.className = `debate-status-pill${state === 'running' ? ' running' : ''}`;
  if (label) label.textContent = text;
}

function _setFlowStep(num, state) {
  const el = document.getElementById(`dfs-${num}`);
  if (!el) return;
  el.className = `dfs dfs-${state}`;
}

function _setRunningState(running) {
  _debateRunning = running;
  const startBtn    = document.getElementById('btn-debate-start');
  const pauseBtn    = document.getElementById('btn-debate-pause');
  const interveneBtn = document.getElementById('btn-debate-intervene');
  const stopBtn      = document.getElementById('btn-debate-stop');
  const hintEl      = document.getElementById('debate-input-hint');
  const textarea    = document.getElementById('debate-input');

  const selectAlpha  = document.getElementById('select-alpha-model');
  const selectBeta   = document.getElementById('select-beta-model');
  const selectRounds = document.getElementById('select-debate-rounds');

  if (selectAlpha)  selectAlpha.disabled = running;
  if (selectBeta)   selectBeta.disabled  = running;
  if (selectRounds) {
    selectRounds.disabled = running;
    selectRounds.style.display = running ? 'none' : 'block';
  }

  if (startBtn)     startBtn.style.display    = running ? 'none' : 'flex';
  if (pauseBtn)     pauseBtn.style.display    = running ? 'flex' : 'none';
  if (interveneBtn) interveneBtn.style.display = running ? 'flex' : 'none';
  if (stopBtn)      stopBtn.style.display      = running ? 'flex' : 'none';

  if (textarea) textarea.placeholder = running
    ? 'Intervene mid-debate… (press Enter)'
    : 'Enter a topic to debate… e.g. "Is AI replacing human creativity?"';

  if (hintEl) hintEl.textContent = running ? 'Enter to intervene' : 'Enter to start';

  if (!running) {
    _setStatusPill('idle', 'Ready');
  }
}

function _scrollThread() {
  const thread = document.getElementById('debate-thread');
  if (thread) thread.scrollTop = thread.scrollHeight;
}

function _escape(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _resetDebateUIOnly() {
  _setRunningState(false);
  _currentTurn = null;
  _roundNum = 0;
  _paused = false;
  _hideActiveSearch();

  const thread = document.getElementById('debate-thread');
  if (thread) {
    thread.innerHTML = `
      <div class="debate-empty-state" id="debate-empty-state">
        <div class="des-icon">
          <img src="/static/hekki.png" alt="Logo" style="width: 44px; height: 44px; border-radius: 50%; object-fit: contain; pointer-events: none;" />
        </div>
        <div class="des-title">Start a Debate</div>
        <div class="des-subtitle">Type a topic below — Alpha and Beta will argue it out across 3 rounds. You can intervene anytime.</div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  ['1','2','3','s'].forEach(s => _setFlowStep(s, 'idle'));
  _setParticipantStatus('alpha', 'Idle');
  _setParticipantStatus('beta', 'Idle');
  _setDot('alpha', false);
  _setDot('beta', false);
  _setDot('user', true);
  _setStatusPill('idle', 'Ready');
  document.getElementById('debate-round-pill').style.display = 'none';

  // Restore agent name defaults
  ALPHA_NAME = 'Tony Stark';
  BETA_NAME  = 'Bruce Banner';

  const dpAlphaName = document.querySelector('#dp-alpha .dp-name');
  const dpAlphaAvatar = document.querySelector('#dp-alpha .dp-avatar');
  if (dpAlphaName) dpAlphaName.textContent = ALPHA_NAME;
  if (dpAlphaAvatar) dpAlphaAvatar.textContent = ALPHA_NAME.charAt(0);

  const dpBetaName = document.querySelector('#dp-beta .dp-name');
  const dpBetaAvatar = document.querySelector('#dp-beta .dp-avatar');
  if (dpBetaName) dpBetaName.textContent = BETA_NAME;
  if (dpBetaAvatar) dpBetaAvatar.textContent = BETA_NAME.charAt(0);

  const alphaTagLabel = document.querySelector('.debate-model-tag.alpha-tag .tag-name');
  const alphaTagSub = document.querySelector('.debate-model-tag.alpha-tag .tag-model');
  if (alphaTagLabel) alphaTagLabel.textContent = ALPHA_NAME;
  if (alphaTagSub) alphaTagSub.textContent = ' · Applied Physics';

  const betaTagLabel = document.querySelector('.debate-model-tag.beta-tag .tag-name');
  const betaTagSub = document.querySelector('.debate-model-tag.beta-tag .tag-model');
  if (betaTagLabel) betaTagLabel.textContent = BETA_NAME;
  if (betaTagSub) betaTagSub.textContent = ' · Biophysics';
}

window.loadDebateHistory = function(chat) {
  _resetDebateUIOnly();
  
  const thread = document.getElementById('debate-thread');
  if (!thread) return;

  if (chat.messages && chat.messages.length > 0) {
    document.getElementById('debate-empty-state')?.remove();
  } else {
    return;
  }

  chat.messages.forEach(msg => {
    if (msg.role === 'user') {
      _appendUserBubble(msg.text, msg.isIntervention);
    } else if (msg.role === 'alpha') {
      const dirLabel = _dirLabel('alpha', 'beta', msg.round);
      const stream = _appendStreamBubble('alpha', dirLabel, msg.round);
      stream.append(msg.text);
      stream.finalize();
      _setFlowStep(msg.round, 'done');
    } else if (msg.role === 'beta') {
      const dirLabel = _dirLabel('beta', 'alpha', msg.round);
      const stream = _appendStreamBubble('beta', dirLabel, msg.round);
      stream.append(msg.text);
      stream.finalize();
      _setFlowStep(msg.round, 'done');
    } else if (msg.role === 'synthesis') {
      const stream = _appendStreamBubble('synthesis', ['Tony + Bruce', 'Joint Solution'], msg.round);
      stream.append(msg.text);
      stream.finalize();
      _setFlowStep('s', 'done');
    } else if (msg.role === 'summary') {
      const card = _createSummaryCard();
      const body = card.querySelector('.debate-summary-body');
      if (body) {
        body.innerHTML = window.marked ? marked.parse(msg.text) : _escape(msg.text);
        enhanceMarkdownContent(body);
      }
      _setFlowStep('s', 'done');
    }
  });

  const hasSummary = chat.messages.some(m => m.role === 'summary');
  if (hasSummary) {
    _setStatusPill('idle', 'Debate complete');
    _setParticipantStatus('alpha', 'Done');
    _setParticipantStatus('beta', 'Done');
    _setDot('user', true);
  } else {
    _setStatusPill('idle', 'Interrupted');
    _setParticipantStatus('alpha', 'Ready');
    _setParticipantStatus('beta', 'Ready');
  }
  
  _scrollThread();
};


// ── Documentary Viewer Helpers ──────────────────────────────────────────────
let _docUtterances = [];
let _currentUtteranceIndex = 0;
let _docSpeaking = false;

function _saveDocumentary(doc) {
  try {
    const listJson = localStorage.getItem('mariano_docs');
    const list = listJson ? JSON.parse(listJson) : [];
    
    // Add unique timestamp and link active chat session
    doc.timestamp = Date.now();
    doc.dateStr = new Date().toLocaleString();
    doc.chat_id = localStorage.getItem('mariano_active_chat_id');
    
    // Ensure we don't save duplicates with exact same title
    const filtered = list.filter(item => item.title !== doc.title);
    filtered.unshift(doc); // Add to top
    
    localStorage.setItem('mariano_docs', JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to save documentary', e);
  }
}

function _refreshSavedDocsList() {
  const container = document.getElementById('debate-docs-list');
  if (!container) return;

  try {
    const listJson = localStorage.getItem('mariano_docs');
    const list = listJson ? JSON.parse(listJson) : [];

    if (list.length === 0) {
      container.innerHTML = `<div class="debate-doc-empty">No saved documents yet.</div>`;
      return;
    }

    container.innerHTML = '';
    list.forEach(doc => {
      const item = document.createElement('div');
      item.className = 'debate-doc-item';
      if (window._currentDocumentary && window._currentDocumentary.timestamp === doc.timestamp) {
        item.classList.add('active');
      }
      item.innerHTML = `
        <div class="debate-doc-item-title" title="${_escape(doc.title)}">${_escape(doc.title)}</div>
        <div class="debate-doc-item-meta">${doc.dateStr}</div>
      `;
      item.addEventListener('click', () => {
        _openDocumentary(doc);
      });
      container.appendChild(item);
    });
  } catch (e) {
    console.error('Failed to load documentaries list', e);
  }
}

function _openDocumentary(doc) {
  window._currentDocumentary = doc;
  
  // Update active status in list
  document.querySelectorAll('.debate-doc-item').forEach(item => {
    const title = item.querySelector('.debate-doc-item-title').textContent;
    if (title === doc.title) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Toggle "Go to Chat" button based on associated chat session
  const goChatBtn = document.getElementById('btn-doc-go-chat');
  if (goChatBtn) {
    goChatBtn.style.display = 'inline-flex';
    goChatBtn.onclick = (e) => {
      e.stopPropagation();
      _closeDocViewer();
      if (doc.chat_id) {
        ChatSessionManager.loadChat(doc.chat_id);
      }
    };
  }

  // Hide debate thread, input areas, and debate topbar
  document.getElementById('debate-thread').style.display = 'none';
  document.getElementById('debate-input-area').style.display = 'none';
  const debateTopbar = document.querySelector('.debate-topbar');
  if (debateTopbar) debateTopbar.style.display = 'none';

  // Show documentary viewer
  const viewer = document.getElementById('debate-doc-viewer');
  viewer.style.display = 'flex';

  // Render contents
  const content = document.getElementById('doc-viewer-content');
  
  let sectionsHtml = '';
  doc.sections.forEach(sec => {
    let sourcesHtml = '';
    if (sec.sources && sec.sources.length > 0) {
      sourcesHtml = `<div class="doc-sec-sources">Sources: `;
      sec.sources.forEach(src => {
        sourcesHtml += `<a href="${_escape(src.url)}" target="_blank" rel="noopener noreferrer">${_escape(src.title)}</a>`;
      });
      sourcesHtml += `</div>`;
    }

    const bodyHtml = window.marked ? marked.parse(sec.body) : _escape(sec.body);

    sectionsHtml += `
      <div class="doc-sec ${sec.type}">
        <span class="doc-sec-badge">${sec.type}</span>
        <div class="doc-sec-heading">${_escape(sec.heading)}</div>
        <div class="doc-sec-body">${bodyHtml}</div>
        ${sourcesHtml}
      </div>
    `;
  });

  content.innerHTML = `
    <div class="doc-hdr">
      <div class="doc-title">${_escape(doc.title)}</div>
      <div class="doc-subtitle">${doc.dateStr} &nbsp;·&nbsp; compiled by MARIANO Research</div>
    </div>
    ${sectionsHtml}
  `;

  // Reset speech button state
  _docSpeaking = false;
  const voiceBtn = document.getElementById('btn-doc-voice');
  if (voiceBtn) {
    voiceBtn.innerHTML = `<i data-lucide="volume-x" style="width:14px; height:14px; margin-right:4px;"></i><span>Voice: Off</span>`;
    if (window.lucide) lucide.createIcons({ parent: voiceBtn });
  }
}

function _closeDocViewer() {
  // Cancel speech
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  _docSpeaking = false;

  window._currentDocumentary = null;

  // Show debate thread, input areas, and debate topbar
  document.getElementById('debate-thread').style.display = 'flex';
  document.getElementById('debate-input-area').style.display = 'flex';
  const debateTopbar = document.querySelector('.debate-topbar');
  if (debateTopbar) debateTopbar.style.display = 'flex';

  // Hide documentary viewer
  document.getElementById('debate-doc-viewer').style.display = 'none';

  // Remove active highlight from sidebar items
  document.querySelectorAll('.debate-doc-item').forEach(item => {
    item.classList.remove('active');
  });
}

function _toggleDocVoice() {
  const doc = window._currentDocumentary;
  if (!doc) return;

  _docSpeaking = !_docSpeaking;
  const btn = document.getElementById('btn-doc-voice');
  if (!btn) return;

  if (_docSpeaking) {
    btn.innerHTML = `<i data-lucide="volume-2" style="width:14px; height:14px; margin-right:4px;"></i><span>Voice: On</span>`;
    if (window.lucide) lucide.createIcons({ parent: btn });

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    _docUtterances = [];
    _currentUtteranceIndex = 0;

    _queueDocSpeech(doc.title);
    _queueDocSpeech(`Overview: ${doc.subtitle}`);

    doc.sections.forEach(sec => {
      _queueDocSpeech(`${sec.type} section: ${sec.heading}`);
      _queueDocSpeech(sec.body);
    });

    _playNextDocUtterance();
  } else {
    btn.innerHTML = `<i data-lucide="volume-x" style="width:14px; height:14px; margin-right:4px;"></i><span>Voice: Off</span>`;
    if (window.lucide) lucide.createIcons({ parent: btn });
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

function _queueDocSpeech(text) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.onend = () => {
    if (_docSpeaking) {
      _currentUtteranceIndex++;
      _playNextDocUtterance();
    }
  };
  _docUtterances.push(u);
}

function _playNextDocUtterance() {
  if (!window.speechSynthesis) return;
  if (_currentUtteranceIndex < _docUtterances.length && _docSpeaking) {
    window.speechSynthesis.speak(_docUtterances[_currentUtteranceIndex]);
  } else {
    _docSpeaking = false;
    const btn = document.getElementById('btn-doc-voice');
    if (btn) {
      btn.innerHTML = `<i data-lucide="volume-x" style="width:14px; height:14px; margin-right:4px;"></i><span>Voice: Off</span>`;
      if (window.lucide) lucide.createIcons({ parent: btn });
    }
  }
}

function _getBorderColor(type) {
  switch (type) {
    case 'abstract': return '#888888';
    case 'finding': return '#4f46e5';
    case 'definition': return '#0d9488';
    case 'hypothesis': return '#d97706';
    case 'data_point': return '#2563eb';
    case 'conclusion': return '#16a34a';
    default: return '#cccccc';
  }
}

function _exportDoc(format) {
  const doc = window._currentDocumentary;
  if (!doc) return;

  if (format === 'pdf') {
    window.print();
    return;
  }

  if (format === 'word') {
    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>${doc.title}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333333; margin: 40px; }
          h1 { font-size: 24pt; font-weight: bold; color: #111111; margin-bottom: 5px; }
          .subtitle { font-size: 11pt; color: #666666; margin-bottom: 30px; border-bottom: 1px solid #eeeeee; padding-bottom: 10px; }
          .section { margin-bottom: 25px; padding: 15px; border-left: 3px solid #888888; background-color: #fafafa; }
          .section-heading { font-size: 14pt; font-weight: bold; color: #111111; margin-bottom: 6px; }
          .section-body { font-size: 11pt; color: #444444; }
          .badge { font-size: 9pt; font-weight: bold; text-transform: uppercase; color: #666666; display: inline-block; margin-bottom: 8px; }
          .sources { font-size: 9pt; color: #777777; margin-top: 8px; }
        </style>
      </head>
      <body>
        <h1>${doc.title}</h1>
        <div class="subtitle">${doc.dateStr} &nbsp;·&nbsp; compiled by MARIANO Research</div>
    `;

    doc.sections.forEach(sec => {
      htmlContent += `
        <div class="section" style="border-left: 3px solid ${_getBorderColor(sec.type)};">
          <div class="badge" style="font-weight: bold;">[${sec.type.toUpperCase()}]</div>
          <div class="section-heading" style="font-weight: bold;">${sec.heading}</div>
          <div class="section-body">${sec.body}</div>
      `;
      if (sec.sources && sec.sources.length > 0) {
        htmlContent += `<div class="sources">Sources: `;
        sec.sources.forEach(src => {
          htmlContent += `<a href="${src.url}">${src.title}</a> &nbsp; `;
        });
        htmlContent += `</div>`;
      }
      htmlContent += `</div>`;
    });

    htmlContent += `</body></html>`;

    const blob = new Blob(['\ufeff' + htmlContent], {
      type: 'application/msword'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

function _openDirectoryViewer() {
  // Hide debate thread, inputs, other doc views, and debate topbar
  document.getElementById('debate-thread').style.display = 'none';
  document.getElementById('debate-input-area').style.display = 'none';
  document.getElementById('debate-doc-viewer').style.display = 'none';
  const debateTopbar = document.querySelector('.debate-topbar');
  if (debateTopbar) debateTopbar.style.display = 'none';

  // Show directory viewer
  const viewer = document.getElementById('debate-directory-viewer');
  if (viewer) {
    viewer.style.display = 'flex';
    if (window.lucide) lucide.createIcons({ parent: viewer });
  }

  // Load and refresh topics list
  _refreshDirectoryTopics();
}

function _closeDirectoryViewer() {
  const viewer = document.getElementById('debate-directory-viewer');
  if (viewer) {
    viewer.style.display = 'none';
  }

  // Show debate thread, input areas, and debate topbar
  document.getElementById('debate-thread').style.display = 'flex';
  document.getElementById('debate-input-area').style.display = 'flex';
  const debateTopbar = document.querySelector('.debate-topbar');
  if (debateTopbar) debateTopbar.style.display = 'flex';
}

function _refreshDirectoryTopics() {
  const container = document.getElementById('directory-topics-list');
  if (!container) return;

  try {
    const listJson = localStorage.getItem('mariano_docs');
    const list = listJson ? JSON.parse(listJson) : [];

    if (list.length === 0) {
      container.innerHTML = `<div style="font-size: 11px; color: var(--text-3); text-align: center; margin-top: 20px;">No saved documents yet.</div>`;
      const contentArea = document.getElementById('directory-content-area');
      if (contentArea) {
        contentArea.innerHTML = `
          <div class="directory-empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin: auto; max-width: 400px; text-align: center; color: var(--text-secondary);">
            <i data-lucide="book-open" style="width: 40px; height: 40px; color: var(--text-3); margin-bottom: 12px; opacity: 0.6;"></i>
            <h3 style="font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">Select a Research Topic</h3>
            <p style="font-size: 12px; color: var(--text-3); line-height: 1.5;">Click on any topic from the index list on the left to read its full clean specification sheet, proposed designs, and test protocols.</p>
          </div>
        `;
        if (window.lucide) lucide.createIcons({ parent: contentArea });
      }
      return;
    }

    container.innerHTML = '';
    list.forEach(doc => {
      const btn = document.createElement('button');
      btn.className = 'directory-topic-btn';
      if (window._currentDirectoryDoc && window._currentDirectoryDoc.timestamp === doc.timestamp) {
        btn.classList.add('active');
      }
      btn.innerHTML = `
        <div class="dir-topic-title" title="${_escape(doc.title)}">${_escape(doc.title)}</div>
        <div class="dir-topic-date">${doc.dateStr}</div>
      `;
      btn.addEventListener('click', () => {
        _selectDirectoryTopic(doc, btn);
      });
      container.appendChild(btn);
    });

    // Auto-select first document if nothing selected yet
    if (!window._currentDirectoryDoc && list.length > 0) {
      const firstBtn = container.querySelector('.directory-topic-btn');
      _selectDirectoryTopic(list[0], firstBtn);
    } else if (window._currentDirectoryDoc) {
      const selected = list.find(d => d.timestamp === window._currentDirectoryDoc.timestamp);
      if (selected) {
        const index = list.indexOf(selected);
        const btn = container.querySelectorAll('.directory-topic-btn')[index];
        _selectDirectoryTopic(selected, btn);
      }
    }
  } catch (e) {
    console.error('Failed to load directory topics', e);
  }
}

function _selectDirectoryTopic(doc, activeBtn) {
  window._currentDirectoryDoc = doc;
  
  // Highlight active button
  document.querySelectorAll('.directory-topic-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  if (activeBtn) activeBtn.classList.add('active');

  const contentArea = document.getElementById('directory-content-area');
  if (!contentArea) return;

  let sectionsHtml = '';
  doc.sections.forEach(sec => {
    let sourcesHtml = '';
    if (sec.sources && sec.sources.length > 0) {
      sourcesHtml = `<div class="doc-sec-sources">Sources: `;
      sec.sources.forEach(src => {
        sourcesHtml += `<a href="${_escape(src.url)}" target="_blank" rel="noopener noreferrer">${_escape(src.title)}</a>`;
      });
      sourcesHtml += `</div>`;
    }

    const bodyHtml = window.marked ? marked.parse(sec.body) : `<p>${_escape(sec.body)}</p>`;

    sectionsHtml += `
      <div class="doc-sec ${sec.type}">
        <span class="doc-sec-badge">${sec.type}</span>
        <div class="doc-sec-heading">${_escape(sec.heading)}</div>
        <div class="doc-sec-body">${bodyHtml}</div>
        ${sourcesHtml}
      </div>
    `;
  });

  contentArea.innerHTML = `
    <div class="directory-content-hdr">
      <div class="title">${_escape(doc.title)}</div>
      <div class="subtitle">${doc.dateStr} &nbsp;·&nbsp; compiled by MARIANO Research</div>
    </div>
    <div style="max-width: 800px; width: 100%; margin: 0 auto; display: flex; flex-direction: column;">
      ${sectionsHtml}
    </div>
  `;
}

function _copyActiveDocumentary(btnId, doc) {
  if (!doc) return;

  const btn = document.getElementById(btnId);
  if (!btn) return;

  // Convert documentary to clean markdown format
  const markdownText = _documentaryToMarkdown(doc);

  // Copy to clipboard
  navigator.clipboard.writeText(markdownText).then(() => {
    // Copy Success UX: green check icon and Copied! text
    btn.innerHTML = `<i data-lucide="check" style="width:14px; height:14px; margin-right:4px; color: #16a34a;"></i><span style="color: #16a34a;">Copied!</span>`;
    if (window.lucide) lucide.createIcons({ parent: btn });

    // Reset back after 3 seconds (3000ms)
    setTimeout(() => {
      btn.innerHTML = `<i data-lucide="copy" style="width:14px; height:14px; margin-right:4px;"></i><span>Copy</span>`;
      if (window.lucide) lucide.createIcons({ parent: btn });
    }, 3000);
  }).catch(err => {
    console.error('Failed to copy text: ', err);
  });
}

function _documentaryToMarkdown(doc) {
  let md = `# ${doc.title}\n${doc.subtitle}\n\n`;
  doc.sections.forEach(sec => {
    md += `## ${sec.heading} (${sec.type.toUpperCase()})\n${sec.body}\n\n`;
    if (sec.sources && sec.sources.length > 0) {
      md += `Sources:\n`;
      sec.sources.forEach(src => {
        md += `- [${src.title}](${src.url})\n`;
      });
      md += `\n`;
    }
  });
  return md;
}function _copyAllDebateContent() {
  const activeId = localStorage.getItem('mariano_active_chat_id');
  if (!activeId) return;

  const chat = ChatSessionManager.getChat(activeId);
  if (!chat || !chat.messages || chat.messages.length === 0) return;

  let textToCopy = `# Debate: ${chat.title}\n\n`;

  chat.messages.forEach(msg => {
    if (msg.role === 'user') {
      textToCopy += `### User (Intervention):\n${msg.text}\n\n`;
    } else if (msg.role === 'alpha') {
      textToCopy += `### Tony Stark (Alpha) — Round ${msg.round}:\n${msg.text}\n\n`;
    } else if (msg.role === 'beta') {
      textToCopy += `### Bruce Banner (Beta) — Round ${msg.round}:\n${msg.text}\n\n`;
    } else if (msg.role === 'synthesis') {
      textToCopy += `### Joint Solution (Synthesis):\n${msg.text}\n\n`;
    } else if (msg.role === 'summary') {
      textToCopy += `### Research Synthesis Summary:\n${msg.text}\n\n`;
    }
  });

  navigator.clipboard.writeText(textToCopy.trim()).then(() => {
    const copyBtn = document.getElementById('btn-debate-copy-all');
    if (copyBtn) {
      copyBtn.innerHTML = `<i data-lucide="check" style="width: 14px; height: 14px; color: #16a34a;"></i>`;
      if (window.lucide) lucide.createIcons({ parent: copyBtn });

      setTimeout(() => {
        copyBtn.innerHTML = `<i data-lucide="copy" style="width: 14px; height: 14px;"></i>`;
        if (window.lucide) lucide.createIcons({ parent: copyBtn });
      }, 2000);
    }
  }).catch(err => {
    console.error('Failed to copy debate content: ', err);
  });
}

// Simulation Viewer helpers removed

function _showActiveSearch(sender, query) {
  _hideActiveProgress();
  const card = document.getElementById('debate-active-search-card');
  const queryEl = document.getElementById('debate-active-search-query');
  const badge = document.getElementById('debate-active-search-badge');
  if (!card || !queryEl || !badge) return;

  let displayName = sender.toUpperCase();
  let badgeBg = 'rgba(59, 130, 246, 0.15)';
  let badgeColor = '#60a5fa';

  if (sender === 'alpha') {
    displayName = ALPHA_NAME;
    badgeBg = 'rgba(239, 68, 68, 0.08)';
    badgeColor = '#ef4444';
  } else if (sender === 'beta') {
    displayName = BETA_NAME;
    badgeBg = 'rgba(16, 185, 129, 0.08)';
    badgeColor = '#10b981';
  } else if (sender === 'system') {
    displayName = 'ArXiv Research';
    badgeBg = 'rgba(168, 85, 247, 0.08)';
    badgeColor = '#a855f7';
  }

  badge.textContent = displayName;
  badge.style.background = badgeBg;
  badge.style.color = badgeColor;
  
  queryEl.textContent = `Searching: "${query}"`;

  if (window.lucide) {
    const wrap = card.querySelector('.status-spinner-wrap');
    if (wrap) lucide.createIcons({ parent: wrap });
  }

  card.style.display = 'flex';
  requestAnimationFrame(() => {
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  });
}

function _hideActiveSearch() {
  const card = document.getElementById('debate-active-search-card');
  if (!card) return;
  card.style.opacity = '0';
  card.style.transform = 'translateY(15px)';
  setTimeout(() => {
    if (card.style.opacity === '0') {
      card.style.display = 'none';
    }
  }, 250);
}

function _showActiveProgress(sender, statusText) {
  _hideActiveSearch();
  const card = document.getElementById('debate-active-progress-card');
  const textEl = document.getElementById('debate-progress-text');
  const pctEl = document.getElementById('debate-progress-pct');
  const barFill = document.getElementById('debate-progress-bar-fill');
  const avatar = document.getElementById('debate-progress-avatar');
  if (!card || !textEl || !pctEl || !barFill || !avatar) return;

  _chunkCount = 0;
  barFill.style.width = '5%';
  pctEl.textContent = '5%';
  textEl.textContent = statusText;

  let avatarInitials = 'S';
  let avatarBg = 'var(--text-primary)';
  let avatarColor = 'var(--bg)';

  if (sender === 'alpha') {
    avatarInitials = ALPHA_NAME.charAt(0);
    avatarBg = '#ef4444';
    avatarColor = '#ffffff';
  } else if (sender === 'beta') {
    avatarInitials = BETA_NAME.charAt(0);
    avatarBg = '#10b981';
    avatarColor = '#ffffff';
  } else if (sender === 'synthesis') {
    avatarInitials = '✦';
    avatarBg = 'linear-gradient(90deg, #b45309, #d97706)';
    avatarColor = '#ffffff';
  }

  avatar.textContent = avatarInitials;
  avatar.style.background = avatarBg;
  avatar.style.color = avatarColor;

  card.style.display = 'flex';
  requestAnimationFrame(() => {
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  });
}

function _updateActiveProgress(pct) {
  const pctEl = document.getElementById('debate-progress-pct');
  const barFill = document.getElementById('debate-progress-bar-fill');
  if (!pctEl || !barFill) return;
  barFill.style.width = `${pct}%`;
  pctEl.textContent = `${pct}%`;
}

function _hideActiveProgress() {
  const card = document.getElementById('debate-active-progress-card');
  const pctEl = document.getElementById('debate-progress-pct');
  const barFill = document.getElementById('debate-progress-bar-fill');
  if (!card) return;
  if (barFill && pctEl) {
    barFill.style.width = '100%';
    pctEl.textContent = '100%';
  }
  setTimeout(() => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(15px)';
    setTimeout(() => {
      if (card.style.opacity === '0') {
        card.style.display = 'none';
      }
    }, 250);
  }, 300);
}
