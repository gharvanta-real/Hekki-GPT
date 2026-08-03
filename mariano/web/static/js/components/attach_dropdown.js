import { showToast } from './toast.js';
import { router } from '../router.js';
import { attachmentManager } from './attachment_manager.js';

let webSearchEnabled = true;

export function initAttachDropdowns(inConversationState) {
  const $ = (id) => document.getElementById(id);
  const fileInput = $('attach-file-input');
  
  fileInput?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      await attachmentManager.addFiles(files);
      showToast('File Attached', `Selected ${files.length} file(s) for upload.`, 2500);
      fileInput.value = '';
    }
  });

  const bindBtn = (btnId) => {
    const btn = $(btnId);
    if (!btn) return;
    
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Remove existing dropdowns
      document.querySelectorAll('.attach-dropdown, .attach-sub-dropdown').forEach(d => d.remove());
      
      const dropdown = document.createElement('div');
      dropdown.className = 'attach-dropdown';

      dropdown.innerHTML = `
        <button class="attach-dropdown-item btn-add-files">
          <i data-lucide="paperclip"></i>
          <span>Add files or photos</span>
          <span class="shortcut-hint">Ctrl+U</span>
        </button>
        <button class="attach-dropdown-item btn-skills-menu">
          <i data-lucide="book-open"></i>
          <span>Skills</span>
          <i data-lucide="chevron-right" class="submenu-arrow"></i>
        </button>
        <div class="attach-dropdown-sep"></div>
        <button class="attach-dropdown-item btn-permission-menu">
          <i data-lucide="shield-check"></i>
          <span>Permission mode</span>
          <i data-lucide="chevron-right" class="submenu-arrow"></i>
        </button>
        <button class="attach-dropdown-item btn-web-search">
          <i data-lucide="globe"></i>
          <span>Web search</span>
        </button>
      `;
      
      // Add files
      dropdown.querySelector('.btn-add-files')?.addEventListener('click', () => {
        fileInput?.click();
        document.querySelectorAll('.attach-dropdown, .attach-sub-dropdown').forEach(d => d.remove());
      });
      
      const removeSubmenus = () => dropdown.querySelectorAll('.attach-sub-dropdown').forEach(s => s.remove());

      // ── Sub-menu 1: Skills > ──────────────────────────────────────────
      const skillsBtn = dropdown.querySelector('.btn-skills-menu');
      skillsBtn?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeSubmenus();

        const sub = document.createElement('div');
        sub.className = 'attach-sub-dropdown';
        sub.innerHTML = `
          <div class="sub-dropdown-header" style="font-size:10px; color:var(--text-3); padding:4px 10px 4px; font-weight:600; letter-spacing:0.04em;">REGISTERED SKILLS</div>
          <div class="attach-dropdown-item"><i data-lucide="globe"></i><span>Web Search</span></div>
          <div class="attach-dropdown-item"><i data-lucide="file-text"></i><span>File Manager</span></div>
          <div class="attach-dropdown-item"><i data-lucide="terminal"></i><span>Terminal CMD</span></div>
          <div class="attach-dropdown-item"><i data-lucide="bar-chart-3"></i><span>Data Analyzer</span></div>
          <div class="attach-dropdown-item"><i data-lucide="cloud"></i><span>Weather & News</span></div>
        `;
        skillsBtn.appendChild(sub);
        if (window.lucide) lucide.createIcons({ parent: sub });
      });

      // ── Sub-menu 2: Permission mode > ─────────────────────────────────
      const permBtn = dropdown.querySelector('.btn-permission-menu');
      permBtn?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeSubmenus();

        const policy = localStorage.getItem('mariano_permission_policy') || 'ask';
        const sub = document.createElement('div');
        sub.className = 'attach-sub-dropdown permission-sub-menu';
        sub.innerHTML = `
          <div class="sub-dropdown-header" style="font-size:10px; color:var(--text-3); padding:4px 10px 4px; font-weight:600; letter-spacing:0.04em;">PERMISSION POLICY</div>
          <button class="attach-dropdown-item btn-opt-ask ${policy === 'ask' ? 'active' : ''}">
            <i data-lucide="shield-check"></i>
            <span>Ask First (Safe)</span>
            ${policy === 'ask' ? '<i data-lucide="check" class="lucide-check-icon"></i>' : ''}
          </button>
          <button class="attach-dropdown-item btn-opt-auto ${policy === 'auto' ? 'active' : ''}">
            <i data-lucide="zap"></i>
            <span>Auto-Approve</span>
            ${policy === 'auto' ? '<i data-lucide="check" class="lucide-check-icon"></i>' : ''}
          </button>
        `;

        sub.querySelector('.btn-opt-ask')?.addEventListener('click', (e) => {
          e.stopPropagation();
          localStorage.setItem('mariano_permission_policy', 'ask');
          showToast('Permission Mode', 'Safe Mode: AI will ask for permission before running actions.', 2500);
          document.querySelectorAll('.attach-dropdown, .attach-sub-dropdown').forEach(d => d.remove());
        });

        sub.querySelector('.btn-opt-auto')?.addEventListener('click', (e) => {
          e.stopPropagation();
          localStorage.setItem('mariano_permission_policy', 'auto');
          showToast('Permission Mode', 'Unrestricted Mode: Everything auto-approved.', 2500);
          document.querySelectorAll('.attach-dropdown, .attach-sub-dropdown').forEach(d => d.remove());
        });

        permBtn.appendChild(sub);
        if (window.lucide) lucide.createIcons({ parent: sub });
      });

      // Web search toggle
      const searchBtn = dropdown.querySelector('.btn-web-search');
      if (searchBtn && webSearchEnabled) {
        searchBtn.classList.add('active');
        const check = document.createElement('i');
        check.setAttribute('data-lucide', 'check');
        check.className = 'lucide-check-icon';
        searchBtn.appendChild(check);
      }
      
      searchBtn?.addEventListener('click', () => {
        webSearchEnabled = !webSearchEnabled;
        showToast('Web Search', `Search capability ${webSearchEnabled ? 'enabled' : 'disabled'}.`, 2000);
        document.querySelectorAll('.attach-dropdown, .attach-sub-dropdown').forEach(d => d.remove());
      });
      
      btn.parentNode.appendChild(dropdown);
      if (window.lucide) lucide.createIcons({ parent: dropdown });
      
      // Dismiss on outside click
      const dismissDropdown = (ev) => {
        if (!dropdown.contains(ev.target) && !btn.contains(ev.target)) {
          document.querySelectorAll('.attach-dropdown, .attach-sub-dropdown').forEach(d => d.remove());
          document.removeEventListener('click', dismissDropdown);
        }
      };
      setTimeout(() => document.addEventListener('click', dismissDropdown), 50);
    });
  };

  bindBtn('btn-attach-home');
  bindBtn('btn-attach-conv');
}
