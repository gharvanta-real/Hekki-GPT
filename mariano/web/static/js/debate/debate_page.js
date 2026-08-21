/**
 * debate_page.js — Hekki Arena Debate Mode entry point & coordinator (< 500 lines)
 */
import { buildDebateLayout } from './debate_layout.js';
import {
  handleDebateEvent,
  startDebate,
  interveneDebate,
  stopDebate,
  resetDebateRoom,
  syncDebateInputButtons,
  setAlphaName,
  setBetaName,
  ALPHA_NAME,
  BETA_NAME,
} from './debate_engine.js';
import {
  loadSavedDocuments,
  renderDocsList,
  openResearchDirectory,
  closeResearchDirectory,
} from './debate_research_modal.js';
import { router } from '../router.js';

export { handleDebateEvent };

export function initDebatePage() {
  buildDebateLayout();
  if (window.lucide) lucide.createIcons();
  bindDebateEvents();
  renderDocsList();
}

function bindDebateEvents() {
  const $ = (id) => document.getElementById(id);

  // Textarea auto-resize and Enter key handlers
  const textarea = $('debate-input');
  if (textarea) {
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
      syncDebateInputButtons();
    });
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const hasText = textarea.value.trim().length > 0;
        if (window._debateRunning) {
          if (hasText) interveneDebate();
          else stopDebate();
        } else {
          if (hasText) startDebate();
        }
      }
    });
  }

  // Buttons
  $('btn-debate-start')?.addEventListener('click', startDebate);
  $('btn-debate-intervene')?.addEventListener('click', interveneDebate);
  $('btn-debate-stop')?.addEventListener('click', stopDebate);
  $('btn-sidebar-reset')?.addEventListener('click', resetDebateRoom);
  $('btn-sidebar-new-debate')?.addEventListener('click', resetDebateRoom);
  $('btn-sidebar-research-directory')?.addEventListener('click', openResearchDirectory);
  $('btn-dir-close')?.addEventListener('click', closeResearchDirectory);

  // Sidebar back & forward navigation
  $('btn-debate-sidebar-back')?.addEventListener('click', () => {
    if (window.router) router.navigate('chat');
  });

  // Sidebar Toggle
  $('btn-debate-sidebar-toggle')?.addEventListener('click', () => {
    document.querySelector('.debate-sidebar')?.classList.toggle('collapsed');
  });

  // User Profile & Settings
  $('btn-debate-sidebar-user-profile')?.addEventListener('click', (e) => {
    e.stopPropagation();
    $('debate-user-menu-dropdown')?.classList.toggle('hidden');
  });

  $('btn-debate-user-settings')?.addEventListener('click', () => {
    $('debate-user-menu-dropdown')?.classList.add('hidden');
    if (window.router) router.navigate('settings');
  });

  $('btn-debate-user-theme')?.addEventListener('click', () => {
    document.getElementById('btn-user-theme')?.click();
  });

  // Participant model selectors
  $('select-alpha-model')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val.includes('gemini')) setAlphaName('Tony Stark');
    else setAlphaName('Iron Man');
  });

  $('select-beta-model')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val.includes('gemini')) setBetaName('Bruce Banner');
    else setBetaName('Hulk');
  });

  // Click outside to dismiss menus
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#debate-user-menu-dropdown') && !e.target.closest('#btn-debate-sidebar-user-profile')) {
      $('debate-user-menu-dropdown')?.classList.add('hidden');
    }
    if (!e.target.closest('#debate-docs-dropdown-menu') && !e.target.closest('#btn-debate-docs-menu')) {
      $('debate-docs-dropdown-menu')?.classList.remove('open');
    }
  });

  $('btn-debate-docs-menu')?.addEventListener('click', (e) => {
    e.stopPropagation();
    $('debate-docs-dropdown-menu')?.classList.toggle('open');
  });
}
