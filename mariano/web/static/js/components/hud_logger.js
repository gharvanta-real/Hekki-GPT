/**
 * hud_logger.js — Floating process HUD execution log manager
 */

export const HudLogger = {
  logs: [
    { type: 'info', text: 'System initialized.', timestamp: new Date().toLocaleTimeString() }
  ],
  append(type, text) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { type, text, timestamp };
    this.logs.push(logEntry);

    const tab = window.tabs?.map.get('tab-process-hud');
    if (tab) {
      const shadow = tab.view.firstChild?.shadowRoot;
      const container = shadow?.getElementById('hud-log-container');
      if (container) {
        const line = document.createElement('div');
        line.className = 'log-line';
        line.innerHTML = `
          <span class="log-time">[${timestamp}]</span>
          <span class="log-text ${type}">${text}</span>
        `;
        container.appendChild(line);
        const view = tab.view.firstChild;
        if (view) view.scrollTop = view.scrollHeight;
      }
    }
  },
  show() {
    if (!window.tabs) return;

    const key = 'tab-process-hud';
    const appPane = document.getElementById('app-pane');
    const resizer = document.getElementById('app-pane-resizer');

    if (!window.tabs.map.has(key)) {
      const html = `
        <div style="padding: 16px; min-height: 100%; box-sizing: border-box; background: var(--bg); color: var(--text);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">
            <span style="font-size: 13.5px; font-weight: 600; color: var(--text);">Process Execution Logs</span>
            <button id="btn-copy-hud-logs" style="background: var(--sidebar-bg); color: var(--text); border: none; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">Copy Logs</button>
          </div>
          <div id="hud-log-container" style="display: flex; flex-direction: column; gap: 6px; font-family: monospace; font-size: 13.5px;"></div>
        </div>
      `;
      const css = `
        :host {
          background: var(--bg) !important;
        }
        .log-line {
          display: flex;
          gap: 8px;
          line-height: 1.5;
          font-family: monospace;
        }
        .log-time {
          color: var(--text-3);
          flex-shrink: 0;
        }
        .log-text {
          word-break: break-all;
          color: var(--text);
        }
        .log-text.exec { color: var(--text-primary); }
        .log-text.success { color: var(--green, #16a34a); }
        .log-text.failed { color: #dc2626; }
        .log-text.info { color: var(--text-3); }

        :host-context(body.dark) .log-text.exec { color: var(--text-primary); }
        :host-context(body.dark) .log-text.success { color: #34d399; }
        :host-context(body.dark) .log-text.failed { color: #f87171; }
      `;
      window.tabs.createTab('process-hud', 'Process HUD', html, css, '', 'terminal');

      const tab = window.tabs.map.get(key);
      const shadow = tab?.view.firstChild?.shadowRoot;
      const container = shadow?.getElementById('hud-log-container');
      const copyBtn = shadow?.getElementById('btn-copy-hud-logs');

      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const logText = window.HudLogger.logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.text}`).join('\n');
          navigator.clipboard.writeText(logText).then(() => {
            if (window.showToast) window.showToast('Logs Copied', 'All execution logs copied to clipboard', 2500);
          });
        });
      }

      if (container) {
        this.logs.forEach(log => {
          const line = document.createElement('div');
          line.className = 'log-line';
          line.innerHTML = `
            <span class="log-time">[${log.timestamp}]</span>
            <span class="log-text ${log.type}">${log.text}</span>
          `;
          container.appendChild(line);
        });
        const view = tab.view.firstChild;
        if (view) view.scrollTop = view.scrollHeight;
      }
    } else {
      if (appPane && appPane.classList.contains('hidden-pane')) {
        window.tabs.switchTo(key);
      } else if (window.tabs.active === key) {
        appPane?.classList.add('hidden-pane');
        resizer?.classList.add('hidden-pane');
      } else {
        window.tabs.switchTo(key);
      }
    }
  }
};

window.HudLogger = HudLogger;
