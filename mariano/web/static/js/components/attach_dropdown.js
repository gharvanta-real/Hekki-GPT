import { showToast } from './toast.js';
import { router } from '../router.js';

let webSearchEnabled = true;

export function initAttachDropdowns(inConversationState) {
  const $ = (id) => document.getElementById(id);
  const fileInput = $('attach-file-input');
  
  fileInput?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      showToast('File Attached', `Selected ${files.length} file(s) for upload.`, 2500);
      const textarea = inConversationState.val ? $('chat-input-conv') : $('chat-input');
      if (textarea) {
        textarea.value += ' [Attached: ' + files.map(f => f.name).join(', ') + '] ';
        textarea.dispatchEvent(new Event('input'));
      }
    }
  });

  const bindBtn = (btnId) => {
    const btn = $(btnId);
    if (!btn) return;
    
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Remove any existing dropdowns
      document.querySelectorAll('.attach-dropdown').forEach(d => d.remove());
      
      const dropdown = document.createElement('div');
      dropdown.className = 'attach-dropdown';
      
      dropdown.innerHTML = `
        <button class="attach-dropdown-item btn-add-files">
          <i data-lucide="paperclip"></i>
          <span>Add files or photos</span>
          <span class="shortcut-hint">Ctrl+U</span>
        </button>
        <button class="attach-dropdown-item btn-to-project">
          <i data-lucide="folder-open"></i>
          <span>Add to project</span>
          <i data-lucide="chevron-right" class="submenu-arrow"></i>
        </button>
        <button class="attach-dropdown-item btn-skills-menu">
          <i data-lucide="book-open"></i>
          <span>Skills</span>
          <i data-lucide="chevron-right" class="submenu-arrow"></i>
        </button>
        <div class="attach-dropdown-sep"></div>
        <button class="attach-dropdown-item btn-web-search">
          <i data-lucide="globe"></i>
          <span>Web search</span>
        </button>
        <div class="attach-dropdown-sep"></div>
        <button class="attach-dropdown-item btn-debate-mode">
          <i data-lucide="swords"></i>
          <span>Debate Playground</span>
          <span style="font-size:10px; color:var(--text-3); margin-left:auto;">Alpha vs Beta</span>
        </button>
      `;
      
      // Bind item clicks
      dropdown.querySelector('.btn-add-files').addEventListener('click', () => {
        fileInput?.click();
        dropdown.remove();
      });
      
      dropdown.querySelector('.btn-to-project').addEventListener('click', () => {
        dropdown.remove();
        router.navigateTo('workspace');
        showToast('Workspace', 'Navigated to Code Workspace.', 2000);
      });
      
      dropdown.querySelector('.btn-skills-menu').addEventListener('click', () => {
        dropdown.remove();
        showToast('Active Skills', 'Registered tools: Web Search, Run Code, Excel Ops, Weather, System Info.', 3000);
      });
      
      const searchBtn = dropdown.querySelector('.btn-web-search');
      if (webSearchEnabled) {
        searchBtn.classList.add('active');
        const check = document.createElement('i');
        check.setAttribute('data-lucide', 'check');
        check.className = 'lucide-check-icon';
        searchBtn.appendChild(check);
      }
      
      searchBtn.addEventListener('click', () => {
        webSearchEnabled = !webSearchEnabled;
        showToast('Web Search', `Search capability ${webSearchEnabled ? 'enabled' : 'disabled'}.`, 2000);
        dropdown.remove();
      });
      
      dropdown.querySelector('.btn-debate-mode').addEventListener('click', () => {
        dropdown.remove();
        router.navigateTo('debate');
      });
      // Append to the button's parent capsule-left container
      btn.parentNode.appendChild(dropdown);
      
      if (window.lucide) lucide.createIcons();
      
      // Click outside to dismiss handler
      const dismissDropdown = (ev) => {
        if (!dropdown.contains(ev.target) && ev.target !== btn) {
          dropdown.remove();
          document.removeEventListener('click', dismissDropdown);
        }
      };
      setTimeout(() => document.addEventListener('click', dismissDropdown), 50);
    });
  };

  bindBtn('btn-attach-home');
  bindBtn('btn-attach-conv');
}
