/**
 * font_manager.js — Typography & Font persistence engine for Hekki
 */

export const FONT_MAP = {
  'google-sans': {
    font:  '"Google Sans", "Google Sans Flex", "Open Sans", sans-serif',
    serif: '"Google Sans", "Google Sans Flex", sans-serif',
    ai:    '"Google Sans", "Google Sans Flex", sans-serif'
  },
  'segoe-ui': {
    font:  '"Segoe WPC", "Segoe UI", -apple-system-body, ui-sans-serif, "system-ui", sans-serif',
    serif: '"Segoe WPC", "Segoe UI", sans-serif',
    ai:    '"Segoe WPC", "Segoe UI", sans-serif'
  },
  'inter': {
    font:  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    serif: '"Inter", sans-serif',
    ai:    '"Inter", sans-serif'
  },
  'plus-jakarta': {
    font:  '"Plus Jakarta Sans", "Inter", sans-serif',
    serif: '"Plus Jakarta Sans", sans-serif',
    ai:    '"Plus Jakarta Sans", sans-serif'
  },
  'outfit': {
    font:  '"Outfit", "Plus Jakarta Sans", sans-serif',
    serif: '"Outfit", sans-serif',
    ai:    '"Outfit", sans-serif'
  },
  'open-sans': {
    font:  '"Open Sans", "Google Sans", sans-serif',
    serif: '"Open Sans", "Google Sans", sans-serif',
    ai:    '"Open Sans", "Google Sans", sans-serif'
  },
  'roboto': {
    font:  '"Roboto", "Open Sans", sans-serif',
    serif: '"Roboto", sans-serif',
    ai:    '"Roboto", sans-serif'
  },
  'system': {
    font:  '-apple-system-body, ui-sans-serif, -apple-system, "system-ui", "Segoe UI", Helvetica, "Apple Color Emoji", Arial, "sans-serif", "Segoe UI Emoji", "Segoe UI Symbol"',
    serif: '-apple-system-body, ui-sans-serif, -apple-system, "system-ui", "Segoe UI", Helvetica, "Apple Color Emoji", Arial, "sans-serif", "Segoe UI Emoji", "Segoe UI Symbol"',
    ai:    '-apple-system-body, ui-sans-serif, -apple-system, "system-ui", "Segoe UI", Helvetica, "Apple Color Emoji", Arial, "sans-serif", "Segoe UI Emoji", "Segoe UI Symbol"'
  },
  'jetbrains-mono': {
    font:  '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
    serif: '"JetBrains Mono", monospace',
    ai:    '"JetBrains Mono", monospace'
  },
  'fira-code': {
    font:  '"Fira Code", "JetBrains Mono", ui-monospace, monospace',
    serif: '"Fira Code", monospace',
    ai:    '"Fira Code", monospace'
  },
  'anthropic': {
    font:  '"anthropic-sans", system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    serif: '"anthropic-serif", "Anthropic Serif Fallback Georgia", Georgia, "Times New Roman", serif',
    ai:    '"anthropic-serif", "Anthropic Serif Fallback Georgia", Georgia, "Times New Roman", serif'
  }
};

export function restoreFont() {
  const key = localStorage.getItem('hekki_font') || 'segoe-ui';
  const cfg = FONT_MAP[key] || FONT_MAP['segoe-ui'];
  document.documentElement.style.setProperty('--font', cfg.font);
  document.documentElement.style.setProperty('--font-sans', cfg.font);
  document.documentElement.style.setProperty('--font-serif', cfg.serif);
  document.documentElement.style.setProperty('--font-ai', cfg.ai);
}

// Immediate execution on module evaluation for zero flash
restoreFont();
