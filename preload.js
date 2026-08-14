/**
 * preload.js — Electron contextBridge preload
 *
 * Exposes a minimal, safe API to the renderer (the web page) via
 * window.electronAPI. contextIsolation keeps Node/Electron internals
 * completely hidden from the page.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Tell the main process to update the native titlebar overlay colours.
   * @param {'dark'|'light'} theme
   */
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),

  /** Open external URLs safely in default system browser */
  openExternal: (url) => ipcRenderer.send('open-external', url),

  /** Hide the system-wide floating overlay window */
  hideOverlay: () => ipcRenderer.send('hide-overlay'),

  /** Toggle the system-wide floating overlay window */
  toggleOverlay: () => ipcRenderer.send('toggle-overlay'),

  /** Check if we are running inside Electron (vs plain browser). */
  isElectron: true,
});
