const googleIcon = `<svg class="brand-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" style="margin-right:4px; display:inline-block; vertical-align:middle;"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.62-.57-1.04-1.34-1.19-2.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`;

const MODES = [
  { id: 'fast', title: 'Fast Mode', desc: 'Fastest answers' },
  { id: 'pro', title: 'Pro Mode', desc: 'Advanced research & logic' },
  { id: 'divider', isDivider: true },
  { id: 'thinking', title: 'Deep Thinking', desc: 'Complex problem solving' }
];

export async function updateModelPills() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const cfg = await res.json();
    const currentModeId = cfg.reasoning_mode || 'fast';
    
    // Find the matching mode
    const matchedMode = MODES.find(m => m.id === currentModeId) || MODES[0];
    const label = matchedMode.title;

    document.querySelectorAll('.model-pill').forEach(btn => {
      btn.innerHTML = `${googleIcon}<span>${label}</span> <i class="mi" data-lucide="chevron-down" style="width:12px; height:12px; margin-left:4px;"></i>`;
    });
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error("Error updating model pills:", err);
  }
}

export function bindModelPills() {
  document.querySelectorAll('.model-pill').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      // Remove any existing dropdowns first
      document.querySelectorAll('.model-dropdown').forEach(el => el.remove());
      
      const dropdown = document.createElement('div');
      dropdown.className = 'model-dropdown';
      dropdown.style.position = 'fixed';
      dropdown.style.zIndex = '10000';
      dropdown.style.background = 'var(--card)';
      dropdown.style.border = '1px solid var(--border)';
      dropdown.style.borderRadius = '12px';
      dropdown.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
      dropdown.style.padding = '8px';
      dropdown.style.display = 'flex';
      dropdown.style.flexDirection = 'column';
      dropdown.style.minWidth = '230px';
      
      const btnRect = btn.getBoundingClientRect();
      let left = btnRect.left;
      if (left + 240 > window.innerWidth) {
        left = btnRect.right - 240;
      }
      if (left < 10) left = 10;
      
      dropdown.style.left = `${left}px`;
      dropdown.style.bottom = `${window.innerHeight - btnRect.top + 8}px`;

      try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const cfg = await res.json();
        const activeModeId = cfg.reasoning_mode || 'fast';

        MODES.forEach(mode => {
          if (mode.isDivider) {
            const div = document.createElement('div');
            div.className = 'dropdown-divider';
            div.style.height = '1px';
            div.style.background = 'var(--border)';
            div.style.margin = '6px 4px';
            dropdown.appendChild(div);
            return;
          }

          const item = document.createElement('button');
          item.className = 'attach-dropdown-item';
          item.style.display = 'flex';
          item.style.alignItems = 'center';
          item.style.justifyContent = 'space-between';
          item.style.padding = '12px 16px'; // Increased padding for height
          item.style.minHeight = '56px'; // Explicit min-height for extra breathing room
          item.style.borderRadius = '8px';
          item.style.border = 'none';
          item.style.background = 'transparent';
          item.style.cursor = 'pointer';
          item.style.color = 'var(--text-primary)';
          item.style.width = '100%';
          item.style.textAlign = 'left';

          const isActive = mode.id === activeModeId;

          item.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:3px; pointer-events:none;">
              <div style="font-size:12.5px; font-weight:normal; display:flex; align-items:center; gap:6px;">
                ${googleIcon}
                <span>${mode.title}</span>
              </div>
              <div style="font-size:11px; color:var(--text-3); font-weight:normal; margin-left:18px;">${mode.desc}</div>
            </div>
            ${isActive ? '<i data-lucide="check" style="width:14px; height:14px; color:var(--text-primary); margin-left:8px; pointer-events:none;"></i>' : ''}
          `;

          item.addEventListener('mouseenter', () => item.style.background = 'var(--hover)');
          item.addEventListener('mouseleave', () => item.style.background = 'transparent');

          item.addEventListener('click', async () => {
            const updatePayload = {
              reasoning_mode: mode.id
            };
            
            const upRes = await fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatePayload)
            });
            
            if (upRes.ok) {
              await updateModelPills();
            }
            dropdown.remove();
          });
          
          dropdown.appendChild(item);
        });
        
      } catch (err) {
        console.error("Error loading models list:", err);
      }
      
      document.body.appendChild(dropdown);
      if (window.lucide) lucide.createIcons({ parent: dropdown });
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.model-dropdown').forEach(el => el.remove());
  });
}
