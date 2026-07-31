/**
 * overlay_preload.js — Electron contextBridge preload for Hekki Quick Voice Overlay
 * Exposes overlayAPI to the overlay renderer (overlay.html)
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  /** Send a text query to main process → backend */
  sendQuery: (text) => ipcRenderer.invoke('overlay-query', { text }),

  /** Open the main Hekki application window */
  openMain: () => ipcRenderer.send('overlay-open-main'),

  /** Hide/close the overlay window */
  close: () => ipcRenderer.send('overlay-close'),

  /** Get current theme from settings */
  getTheme: () => ipcRenderer.invoke('overlay-get-theme'),

  /** Request resize of both width and height (preferred) */
  resizeBoth: (width, height) => ipcRenderer.send('overlay-resize', { width, height }),

  /** Request resize height only (legacy compat) */
  resizeHeight: (height) => ipcRenderer.send('overlay-resize-height', height),

  /** Listen for theme updates from main process */
  onThemeUpdate: (callback) => ipcRenderer.on('overlay-theme-update', (_event, theme) => callback(theme)),

  /** Open external link in default browser */
  openExternal: (url) => ipcRenderer.send('open-external', url),

  /** Check if running in Electron */
  isElectron: true,
});
