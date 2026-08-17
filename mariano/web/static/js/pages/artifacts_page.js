/**
 * artifacts_page.js — Artifacts viewer page component.
 *
 * Renders into a tab panel (app-pane side panel) or any given container.
 * Isolated from nav.js — no inline HTML strings in nav anymore.
 */

export class ArtifactsPage {
  constructor(tabs, showToast) {
    this._tabs = tabs;
    this._showToast = showToast || (() => {});
  }

  /** Open the artifacts panel in a tab. */
  open() {
    const html = `
      <div style="padding:16px;color:var(--text);font-family:var(--font, system-ui, sans-serif)">
        <h3 style="margin:0 0 12px;font-size:14px;font-weight:400;color:var(--text)">Active Artifacts</h3>
        <div style="font-size:13px;display:flex;flex-direction:column;gap:8px">
          ${this._artifactCard('notebook-pen', '#2563eb', 'UI Refactor Notes', '20 minutes ago', 'Clean Carbon layout design details')}
          ${this._artifactCard('grid-3x3', '#2563eb', 'Custom Widgets List', '1 hour ago', 'Mounted components directory')}
          ${this._artifactCard('file-text', '#16a34a', 'Research Summary', '2 hours ago', 'AI workspace storage design notes')}
        </div>
      </div>`;
    this._tabs.createTab('artifacts', 'Artifacts', html, '', '', 'bookmark');
    if (window.lucide) lucide.createIcons();
  }

  _artifactCard(icon, iconColor, title, time, subtitle) {
    return `
      <div style="border:1px solid var(--border);padding:10px;border-radius:8px;cursor:pointer;background:var(--card);transition:background .15s"
           onmouseenter="this.style.background='var(--hover)'" onmouseleave="this.style.background='var(--card)'">
        <div style="font-size:13.5px;font-weight:400;display:flex;align-items:center;gap:6px;color:var(--text)">
          <i data-lucide="${icon}" style="width:15px;height:15px;color:${iconColor}"></i>
          ${title}
        </div>
        <div style="color:var(--text-3);font-size:11.5px;margin-top:4px;font-weight:400">${time} · ${subtitle}</div>
      </div>`;
  }
}
