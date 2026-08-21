/**
 * model_selector_usage.js — Live Rate Limit Quota Submenu for Model Selector.
 */

export function openUsageSubmenu(parentRow, dropdownEl, closeSubmenu, positionPopup) {
  closeSubmenu();

  const submenu = document.createElement('div');
  submenu.id = 'model-usage-submenu';
  submenu.style.cssText = `
    position: fixed;
    z-index: 1000000;
    background: var(--bg-card, #1c1c1e);
    border: none !important;
    border-radius: var(--radius-md, 12px);
    padding: 10px 12px;
    min-width: 220px;
    max-width: 270px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: none !important;
    font-family: var(--font, sans-serif);
  `;

  const dropdownRect = dropdownEl ? dropdownEl.getBoundingClientRect() : parentRow.getBoundingClientRect();
  const parentRect = parentRow.getBoundingClientRect();
  positionPopup(submenu, parentRect, 250, true, dropdownRect);

  submenu.innerHTML = `
    <div style="font-size:11px; color:var(--text-3, #888); font-weight:500;">Live Quota & Usage</div>
    <div style="font-size:11px; color:var(--text-3); font-style:italic;">Loading live usage...</div>
  `;

  document.body.appendChild(submenu);

  submenu.addEventListener('mouseleave', (e) => {
    if (!parentRow.contains(e.relatedTarget)) {
      closeSubmenu();
    }
  });

  const ringSvg = (pct, color = '#22C55E') => {
    const radius = 8;
    const circ = 2 * Math.PI * radius;
    const strokeDashoffset = circ - (pct / 100) * circ;
    return `
      <svg width="20" height="20" viewBox="0 0 22 22" style="transform:rotate(-90deg); flex-shrink:0;">
        <circle cx="11" cy="11" r="${radius}" stroke="var(--hover, rgba(255,255,255,0.1))" stroke-width="2.5" fill="none"/>
        <circle cx="11" cy="11" r="${radius}" stroke="${color}" stroke-width="2.5" stroke-dasharray="${circ}" stroke-dashoffset="${strokeDashoffset}" stroke-linecap="round" fill="none"/>
      </svg>
    `;
  };

  fetch('/api/rate-limits/usage')
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (!data || !document.body.contains(submenu)) return;

      const dColor = data.daily?.remaining_pct < 20 ? '#EF4444' : '#22C55E';
      const mColor = data.minute?.remaining_pct < 20 ? '#EF4444' : '#22C55E';

      submenu.innerHTML = `
        <div style="font-size:11px; color:var(--text-3, #888); font-weight:500;">Active Rate Quotas</div>
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <span style="font-size:12px; font-weight:500; color:var(--text-primary, #FFF);">Daily Limit Remaining</span>
            <div style="display:flex; align-items:center; gap:5px;">
              <span style="font-size:12px; font-weight:600; color:var(--text-primary);">${data.daily?.remaining_pct ?? 100}%</span>
              ${ringSvg(data.daily?.remaining_pct ?? 100, dColor)}
            </div>
          </div>
          <span style="font-size:10px; color:var(--text-3, #888); line-height:1.3;">${data.daily?.desc ?? 'Daily API Calls'}</span>
        </div>

        <div style="height:1px; background:var(--hover, rgba(255,255,255,0.06)); margin:1px 0;"></div>

        <div style="display:flex; flex-direction:column; gap:2px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <span style="font-size:12px; font-weight:500; color:var(--text-primary, #FFF);">Minute Rate Remaining</span>
            <div style="display:flex; align-items:center; gap:5px;">
              <span style="font-size:12px; font-weight:600; color:var(--text-primary);">${data.minute?.remaining_pct ?? 100}%</span>
              ${ringSvg(data.minute?.remaining_pct ?? 100, mColor)}
            </div>
          </div>
          <span style="font-size:10px; color:var(--text-3, #888); line-height:1.3;">${data.minute?.desc ?? 'Requests per minute'}</span>
        </div>
      `;
    })
    .catch(err => {
      console.error('[ModelSelector] Failed to load usage stats:', err);
    });

  return submenu;
}

