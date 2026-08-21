/**
 * debate_layout.js — DOM layout builder & static event wiring for Debate Playground
 */

export function buildDebateLayout() {
  const pane = document.getElementById('debate-pane');
  if (!pane) return;

  pane.innerHTML = `
    <div class="debate-layout">
      <!-- Collapsible Sidebar -->
      <div class="debate-sidebar" style="padding-top: 0;">
        <div class="nav-header" style="display: flex; align-items: center; justify-content: space-between; height: 32px; padding: 0 10px; flex-shrink: 0;">
          <button class="icon-btn" id="btn-debate-sidebar-toggle" title="Toggle Sidebar" style="border: none; background: transparent; cursor: pointer; margin: 0;">
            <i data-lucide="panel-left" style="width: 16px; height: 16px;"></i>
          </button>
          <div style="display: flex; align-items: center; gap: 2px;">
            <button class="icon-btn" id="btn-debate-sidebar-back" title="Go Back" style="border: none; background: transparent; cursor: pointer;">
              <i data-lucide="arrow-left" style="width: 16px; height: 16px;"></i>
            </button>
            <button class="icon-btn" id="btn-debate-nav-forward" title="Go Forward" style="border: none; background: transparent; cursor: pointer;">
              <i data-lucide="arrow-right" style="width: 16px; height: 16px;"></i>
            </button>
          </div>
        </div>

        <div class="debate-sidebar-inner" style="padding-top: 0; gap: 0;">
          <div class="debate-sidebar-controls-list" style="gap: 0; margin-top: 0;">
            <button class="debate-list-btn" id="btn-sidebar-new-debate" title="New Debate">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="icon icon-compose" style="width:16px; height:16px; margin-right:8px; display:inline-block; vertical-align:middle; flex-shrink:0;"><path d="M10 3H7a4 4 0 0 0-4 4v9a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-4"></path><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path></svg>
              <span>New Debate</span>
            </button>
            <button class="debate-list-btn" id="btn-sidebar-research-directory" title="Research Directory">
              <i data-lucide="book-open" style="width:16px; height:16px; margin-right:8px; display:inline-block; vertical-align:middle; flex-shrink:0;"></i>
              <span>Research Directory</span>
            </button>
            <button class="debate-list-btn" id="btn-sidebar-reset" title="Reset Debate Room">
              <i data-lucide="rotate-ccw" style="width:16px; height:16px; margin-right:8px; display:inline-block; vertical-align:middle; flex-shrink:0;"></i>
              <span>Reset Room</span>
            </button>
          </div>

          <div class="debate-sidebar-divider" style="margin: 4px 0 2px 0;"></div>

          <details class="debate-sidebar-details">
            <summary class="debate-sidebar-summary">
              <span class="summary-title">Participants</span>
              <i data-lucide="chevron-right" class="accordion-chevron"></i>
            </summary>
            <div class="details-content">
              <div class="debate-participants-list" style="display:flex; flex-direction:column; gap:4px;">
                <div class="debate-participant-card" id="dp-alpha" style="display:flex; align-items:center; justify-content:space-between; padding:4px 6px 4px 2px; background:transparent; border:none;">
                  <div class="dp-avatar dp-alpha" style="width:24px; height:24px; border-radius:50%; background:var(--hover); color:var(--text); display:flex; align-items:center; justify-content:center; font-weight:500; font-size:11.5px;">T</div>
                  <div class="dp-info" style="flex-grow:1; min-width:0; margin-left:8px; display:flex; flex-direction:column; gap:1px;">
                    <div class="dp-name" style="font-size:12px; font-weight:400; color:var(--text); line-height: 1.1;">Tony Stark</div>
                    <select class="debate-model-select" id="select-alpha-model" style="width:100%; cursor:pointer; color:var(--text);">
                      <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash</option>
                      <option value="qwen">Qwen (Optional)</option>
                    </select>
                    <div class="dp-status" id="dp-alpha-status" style="font-size:10px; color:var(--text); opacity:0.9; line-height: 1.1; margin-top: 1px;">Idle</div>
                  </div>
                  <div class="dp-indicator" id="dp-alpha-dot" style="width:6px; height:6px; border-radius:50%; background:transparent; margin-left:6px;"></div>
                </div>

                <div class="debate-participant-card" id="dp-beta" style="display:flex; align-items:center; justify-content:space-between; padding:4px 6px 4px 2px; background:transparent; border:none;">
                  <div class="dp-avatar dp-beta" style="width:24px; height:24px; border-radius:50%; background:var(--hover); color:var(--text); display:flex; align-items:center; justify-content:center; font-weight:500; font-size:11.5px;">B</div>
                  <div class="dp-info" style="flex-grow:1; min-width:0; margin-left:8px; display:flex; flex-direction:column; gap:1px;">
                    <div class="dp-name" style="font-size:12px; font-weight:400; color:var(--text); line-height: 1.1;">Bruce Banner</div>
                    <select class="debate-model-select" id="select-beta-model" style="width:100%; cursor:pointer; color:var(--text);">
                      <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash</option>
                      <option value="qwen">Qwen (Optional)</option>
                    </select>
                    <div class="dp-status" id="dp-beta-status" style="font-size:10px; color:var(--text); opacity:0.9; line-height: 1.1; margin-top: 1px;">Idle</div>
                  </div>
                  <div class="dp-indicator" id="dp-beta-dot" style="width:6px; height:6px; border-radius:50%; background:transparent; margin-left:6px;"></div>
                </div>

                <div class="debate-participant-card" id="dp-user" style="display:flex; align-items:center; justify-content:space-between; padding:4px 6px 4px 2px; background:transparent; border:none;">
                  <div class="dp-avatar dp-user" style="width:24px; height:24px; border-radius:50%; background:var(--hover); color:var(--text); display:flex; align-items:center; justify-content:center; font-weight:500; font-size:11.5px;">U</div>
                  <div class="dp-info" style="flex-grow:1; min-width:0; margin-left:8px; display:flex; flex-direction:column; gap:1px;">
                    <div class="dp-name" style="font-size:12px; font-weight:400; color:var(--text); line-height: 1.1;">You</div>
                    <div class="dp-model" style="font-size:10px; color:var(--text); opacity:0.9; margin-top:1px; line-height: 1.1;">Observer</div>
                    <div class="dp-status" id="dp-user-status" style="font-size:10px; color:var(--text); opacity:0.9; line-height: 1.1; margin-top: 1px;">Active</div>
                  </div>
                  <div class="dp-indicator active" id="dp-user-dot" style="width:6px; height:6px; border-radius:50%; background:var(--green); margin-left:6px;"></div>
                </div>
              </div>
            </div>
          </details>

          <div class="debate-sidebar-divider"></div>

          <details class="debate-sidebar-details" id="debate-documents-details">
            <summary class="debate-sidebar-summary" style="display: flex; align-items: center; justify-content: space-between;">
              <span class="summary-title">Documents</span>
              <div style="display: flex; align-items: center; gap: 4px; margin-left: auto;">
                <div class="doc-dropdown" style="position: relative; display: flex; align-items: center;">
                  <button class="debate-docs-menu-btn" id="btn-debate-docs-menu" style="background: transparent; border: none; padding: 2px 4px; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.12s, color 0.12s;" title="Document Options">
                    <i data-lucide="more-vertical" style="width: 14px; height: 14px;"></i>
                  </button>
                  <div class="doc-dropdown-menu" id="debate-docs-dropdown-menu" style="top: 26px; right: 0;">
                    <button class="dropdown-item btn-upload-doc" id="btn-debate-upload-doc">
                      <i data-lucide="upload" style="width: 15px; height: 15px; margin-right: 8px;"></i>
                      <span>Upload Document</span>
                    </button>
                    <button class="dropdown-item btn-export-docs" id="btn-debate-export-docs">
                      <i data-lucide="download" style="width: 15px; height: 15px; margin-right: 8px;"></i>
                      <span>Export All</span>
                    </button>
                    <div style="border-top: 1px solid var(--border); margin: 4px 0;"></div>
                    <button class="dropdown-item btn-clear-docs" id="btn-debate-clear-docs">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 32 32" fill="currentColor" style="width:15px;height:15px;margin-right:8px;display:inline-block;"><rect x="12" y="12" width="2" height="12"/><rect x="18" y="12" width="2" height="12"/><path d="M4,6V8H6V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V8h2V6ZM8,28V8H24V28Z"/><rect x="12" y="2" width="8" height="2"/></svg>
                      <span>Clean All</span>
                    </button>
                  </div>
                  <input type="file" id="debate-doc-upload-input" accept=".txt,.md,.json" style="display: none;" />
                </div>
                <i data-lucide="chevron-right" class="accordion-chevron"></i>
              </div>
            </summary>
            <div class="details-content">
              <div class="debate-docs-list" id="debate-docs-list">
                <div class="debate-doc-empty">No saved documents yet.</div>
              </div>
            </div>
          </details>
        </div>

        <div style="position: relative; margin-top: auto; border-top: none;">
          <div class="user-menu-dropdown hidden" id="debate-user-menu-dropdown" style="bottom: 50px; left: 8px;">
            <div class="user-menu-header">User Account</div>
            <button class="user-menu-item" id="btn-debate-user-settings">
              <i data-lucide="settings" style="width: 16px; height: 16px; margin-right: 8px;"></i>
              <span>Settings</span>
              <span class="user-menu-shortcut">Ctrl+⇧+,</span>
            </button>
            <button class="user-menu-item" id="btn-debate-user-theme">
              <i data-lucide="sun" style="width: 16px; height: 16px; margin-right: 8px;"></i>
              <span>Toggle Theme</span>
            </button>
            <button class="user-menu-item" id="btn-debate-user-plugins">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-plugins" style="width:16px; height:16px; margin-right:8px; display:inline-block; vertical-align:middle; flex-shrink:0;"><path d="M9 2v6M15 2v6M12 17v5M5 8h14a1 1 0 0 1 1 1v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9a1 1 0 0 1 1-1z"></path></svg>
              <span>Plugins & Connectors</span>
            </button>
            <button class="user-menu-item" id="btn-debate-user-skills">
              <i data-lucide="blocks" style="width: 16px; height: 16px; margin-right: 8px;"></i>
              <span>Skills & Capabilities</span>
            </button>
            <div class="user-menu-divider"></div>
            <button class="user-menu-item" id="btn-debate-user-logout">
              <i data-lucide="log-out" style="width: 16px; height: 16px; margin-right: 8px; color: #ef4444;"></i>
              <span style="color:#ef4444;">Log out</span>
            </button>
          </div>

          <div class="sidebar-user-profile" id="btn-debate-sidebar-user-profile" style="border-top: none;">
            <div class="sidebar-user-avatar" id="debate-sidebar-user-avatar">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 32 32" fill="currentColor"><path d="M16 4a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm10 14h-2a8 8 0 0 0-16 0H6a10 10 0 0 1 20 0z"/></svg>
            </div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name" id="debate-sidebar-user-name">User</div>
            </div>
            <i data-lucide="settings" style="width: 16px; height: 16px; margin-left: auto; color: var(--text);"></i>
          </div>
        </div>
      </div>

      <!-- Main Container -->
      <div class="debate-main-container" style="display: flex; flex-direction: row; width: 100%; height: 100%; overflow: hidden;">
        <div id="debate-workspace-left" style="display: flex; flex-direction: column; flex: 1; min-width: 0; height: 100%; overflow: hidden; position: relative;">
          <div class="debate-topbar">
            <div class="debate-topbar-left">
              <button class="icon-btn" id="btn-debate-sidebar-toggle-main" title="Toggle Sidebar" style="margin-right: 8px; border: none; background: transparent; cursor: pointer; display: none;">
                <i data-lucide="sidebar" style="width: 14px; height: 14px;"></i>
              </button>
              <div class="debate-topbar-title" style="display: flex; align-items: center; gap: 8px;">
                <span>Debate Playground</span>
              </div>
            </div>
            <div class="debate-topbar-controls">
              <div class="debate-status-pill" id="debate-status-pill" style="display:none !important;">
                <span class="dot"></span>
                <span id="debate-status-text">Ready</span>
              </div>
              <div class="debate-round-pill" id="debate-round-pill" style="display:none !important;">
                Round <strong id="debate-round-num">1</strong> / <span id="debate-round-total">3</span>
              </div>
              <button class="debate-topbar-btn" id="btn-debate-pause" style="display:none !important;">
                <i data-lucide="pause"></i><span>Pause</span>
              </button>
            </div>
          </div>

          <div class="debate-content-area" id="debate-content-area" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; position: relative;">
            <div class="debate-thread" id="debate-thread" style="flex: 1; overflow-y: auto;">
              <div class="debate-empty-state" id="debate-empty-state">
                <div class="des-icon">
                  <img src="/static/hekki.png" alt="Logo" style="width: 44px; height: 44px; border-radius: 50%; object-fit: contain; pointer-events: none;" />
                </div>
                <div class="des-title">Start a Debate</div>
                <div class="des-subtitle">Type a topic below — Alpha and Beta will argue it out across 3 rounds. You can intervene anytime.</div>
              </div>
            </div>

            <!-- Documentary Reader Panel -->
            <div class="debate-doc-viewer" id="debate-doc-viewer" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 100;">
              <div class="doc-viewer-header">
                <button class="debate-back-btn" id="btn-doc-close" title="Back to Debate">
                  <i data-lucide="chevron-left" style="width:18px; height:18px;"></i>
                </button>
                <div class="doc-viewer-controls" style="display: flex; align-items: center; gap: 4px;">
                  <button class="doc-icon-btn" id="btn-doc-go-chat" title="View Chat" style="display: none; background: transparent; border: none !important; box-shadow: none !important; cursor: pointer; padding: 6px; border-radius: 6px; color: var(--text-secondary); align-items: center; justify-content: center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-compose" style="width:15px; height:15px; display:inline-block; vertical-align:middle; flex-shrink:0;"><path d="M10 3H7a4 4 0 0 0-4 4v9a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-4"></path><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path></svg>
                  </button>
                  <div class="doc-hdr-sep" id="sep-doc-chat" style="display: none; width: 1px; height: 16px; background: var(--border); margin: 0 4px;"></div>
                  <button class="doc-icon-btn" id="btn-doc-copy" title="Copy to Clipboard" style="background: transparent; border: none !important; box-shadow: none !important; cursor: pointer; padding: 6px; border-radius: 6px; color: var(--text-secondary); display: inline-flex; align-items: center; justify-content: center;">
                    <i data-lucide="copy" style="width: 15px; height: 15px;"></i>
                  </button>
                  <div class="doc-hdr-sep" style="width: 1px; height: 16px; background: var(--border); margin: 0 4px;"></div>
                  <div class="doc-dropdown">
                    <button class="doc-icon-btn dropdown-toggle" id="btn-doc-export" title="Export Document" style="background: transparent; border: none !important; box-shadow: none !important; cursor: pointer; padding: 6px; border-radius: 6px; color: var(--text-secondary); display: inline-flex; align-items: center; justify-content: center;">
                      <i data-lucide="download" style="width: 15px; height: 15px;"></i>
                    </button>
                    <div class="doc-dropdown-menu" id="doc-export-menu">
                      <button class="dropdown-item" data-format="pdf">
                        <i data-lucide="file-text" style="width: 15px; height: 15px; margin-right: 8px;"></i>
                        <span>Export to PDF</span>
                      </button>
                      <button class="dropdown-item" data-format="word">
                        <i data-lucide="file-text" style="width: 15px; height: 15px; margin-right: 8px;"></i>
                        <span>Export to Word</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="doc-viewer-content" id="doc-viewer-content"></div>
            </div>

            <!-- Documentary Directory Viewer -->
            <div class="debate-doc-viewer" id="debate-directory-viewer" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 100;">
              <div class="doc-viewer-header">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <button class="debate-back-btn" id="btn-dir-close" title="Back to Debate">
                    <i data-lucide="chevron-left" style="width:18px; height:18px;"></i>
                  </button>
                  <div style="font-weight: 600; color: var(--text-primary); font-size: 13px; display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="book-open" style="width: 15px; height: 15px; color: #d97706;"></i>
                    <span>Research Spec Directory</span>
                  </div>
                </div>
                <div class="doc-viewer-controls">
                  <button class="doc-icon-btn" id="btn-dir-copy" title="Copy to Clipboard" style="background: transparent; border: none !important; box-shadow: none !important; cursor: pointer; padding: 6px; border-radius: 6px; color: var(--text-secondary); display: inline-flex; align-items: center; justify-content: center;">
                    <i data-lucide="copy" style="width: 15px; height: 15px;"></i>
                  </button>
                </div>
              </div>
              <div class="directory-container" style="display: flex; flex: 1; overflow: hidden; height: calc(100% - 48px);">
                <div class="directory-sidebar">
                  <div style="font-size: 11px; font-weight: 600; color: var(--text-3); margin-bottom: 12px; padding: 0 2px;">Topics Index</div>
                  <div class="directory-topics-list" id="directory-topics-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
                </div>
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
              <div class="debate-active-search-card" id="debate-active-search-card" style="display: none; align-items: center; justify-content: space-between; width: 100%; max-width: 720px; box-sizing: border-box; margin: 0 auto 8px auto; padding: 8px 16px; background: var(--card); border: none !important; outline: none !important; border-radius: 24px; font-size: 12px; opacity: 0; transform: translateY(8px); transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); position: relative; z-index: 1;">
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                  <span class="status-spinner-wrap" style="display: inline-flex; align-items: center; justify-content: center; color: var(--text-3); animation: spin 1.2s linear infinite; flex-shrink: 0;">
                    <i data-lucide="loader-2" style="width: 14px; height: 14px;"></i>
                  </span>
                  <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                    <span class="status-query" id="debate-active-search-query" style="color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; font-weight: 400; font-size: 12.5px;">Searching...</span>
                  </div>
                </div>
                <div class="status-badge" id="debate-active-search-badge" style="font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 20px; border: none !important; background: var(--hover); color: var(--text-secondary);">Research</div>
              </div>

              <div class="debate-active-progress-card" id="debate-active-progress-card" style="display: none; align-items: center; justify-content: space-between; width: 100%; max-width: 720px; box-sizing: border-box; margin: 0 auto 8px auto; padding: 8px 16px; background: var(--card); border: none !important; outline: none !important; border-radius: 24px; font-size: 12px; opacity: 0; transform: translateY(8px); transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); position: relative; z-index: 1;">
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                  <span class="status-spinner-wrap" style="display: inline-flex; align-items: center; justify-content: center; color: var(--text-3); animation: spin 1.2s linear infinite; flex-shrink: 0;">
                    <i data-lucide="loader-2" style="width: 14px; height: 14px;"></i>
                  </span>
                  <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                    <span id="debate-progress-text" style="color: var(--text); font-weight: 400; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">Agents Collaborating...</span>
                  </div>
                </div>
                <div style="display:none !important;"><div id="debate-progress-bar-fill"></div></div>
                <span id="debate-progress-pct" style="display:none !important;">0%</span>
                <div id="debate-progress-avatar" style="display:none !important;"></div>
              </div>

              <div class="debate-input-wrapper" id="debate-input-capsule" style="position: relative; z-index: 2; display: flex; flex-direction: column; align-items: stretch; gap: 0; padding: 8px 14px;">
                <div class="input-preview-area hidden" id="preview-area-debate"></div>
                <div class="input-capsule-row" style="display: flex; flex-direction: row; align-items: center; gap: 8px; width: 100%;">
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
                    <select class="debate-rounds-select" id="select-debate-rounds">
                      <option value="2">2 Rounds</option>
                      <option value="3" selected>3 Rounds</option>
                      <option value="4">4 Rounds</option>
                      <option value="5">5 Rounds</option>
                    </select>
                    
                    <button class="submit-btn" id="btn-debate-stop" title="Stop Generation" style="display: none; background: var(--text-primary, #09090b) !important; color: var(--bg, #ffffff) !important; border: none;">
                      <i data-lucide="square" style="fill: currentColor; width: 10px; height: 10px;"></i>
                    </button>
                    
                    <button class="submit-btn" id="btn-debate-intervene" title="Send Message" style="display: none;">
                      <i data-lucide="arrow-right" style="width:15px; height:15px;"></i>
                    </button>
                    
                    <button class="submit-btn" id="btn-debate-start" title="Start Debate">
                      <i data-lucide="arrow-right" style="width:15px; height:15px;"></i>
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
  `;
}
