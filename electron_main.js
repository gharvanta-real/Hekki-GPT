const { app, BrowserWindow, dialog, nativeTheme, ipcMain, globalShortcut, screen, Tray, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { startBackend, checkServerReady, cleanupBackend, getIsServerReady } = require('./electron_backend');

let mainWindow = null;
let overlayWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;

// ── Single Instance Lock ──────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    console.log('Another instance of Hekki is already running. Quitting duplicate process.');
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

function getDynamicSettings() {
    let dataDir;
    const isPackaged = app.isPackaged;
    if (isPackaged) {
        dataDir = path.join(process.env.APPDATA || path.join(process.env.HOME, 'AppData', 'Roaming'), 'hekki', 'data');
    } else {
        dataDir = path.join(__dirname, 'data');
    }
    const settingsPath = path.join(dataDir, 'dynamic_settings.json');
    try {
        if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf8')) || {};
        }
    } catch (e) {
        console.error("Failed to read settings file:", e);
    }
    return {};
}

function getThemeFromSettings() {
    return getDynamicSettings().theme || 'dark';
}

function isRunInBackgroundEnabled() {
    return getDynamicSettings().run_in_background !== false;
}

function createSplashWindow(theme) {
    splashWindow = new BrowserWindow({
        width: 500,
        height: 380,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        show: false,
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    splashWindow.loadURL(`file://${path.join(__dirname, 'splash.html')}?theme=${theme}`);
    splashWindow.once('ready-to-show', () => {
        if (splashWindow) splashWindow.show();
    });
}

function applyNativeTheme(theme) {
    nativeTheme.themeSource = theme === 'light' ? 'light' : 'dark';
}

// ── Create Main Window ───────────────────────────────────────────────────
function createWindow() {
    const savedTheme = getThemeFromSettings();
    applyNativeTheme(savedTheme);

    const isDark = savedTheme !== 'light';
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        title: "Hekki",
        icon: path.join(__dirname, 'assets', 'hekki.ico'),
        autoHideMenuBar: true,
        backgroundColor: isDark ? '#0d0d0d' : '#FCFCFC',
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: isDark ? '#181817' : '#F6F7F9',
            symbolColor: isDark ? '#e0e0e0' : '#111111',
            height: 32
        },
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadURL('http://localhost:8000');

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http:') || url.startsWith('https:')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    // ── Intercept close → hide to tray if background running is enabled ───────
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            if (isRunInBackgroundEnabled()) {
                event.preventDefault();
                mainWindow.hide();
                if (tray) {
                    tray.displayBalloon({
                        iconType: 'info',
                        title: 'Hekki is running in background',
                        content: 'Click the tray icon or press Alt+Space to reopen.'
                    });
                }
            } else {
                isQuitting = true;
                cleanupBackend();
                app.quit();
            }
        }
    });
}

// ── Floating Super AI Desktop Overlay Window ──────────────────────────────
function toggleOverlayWindow() {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        if (overlayWindow.isVisible()) {
            overlayWindow.hide();
        } else {
            overlayWindow.show();
            overlayWindow.focus();
        }
        return;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const overlayW = 420;
    const overlayH = 480;

    overlayWindow = new BrowserWindow({
        width: overlayW,
        height: overlayH,
        x: width - overlayW - 24,
        y: height - overlayH - 24,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        show: false,
        icon: path.join(__dirname, 'assets', 'hekki.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    overlayWindow.loadURL('http://localhost:8000/overlay.html');
    overlayWindow.once('ready-to-show', () => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.show();
            overlayWindow.focus();
        }
    });
}

// ── System Tray ────────────────────────────────────────────────────
function updateTrayContextMenu() {
    if (!tray) return;
    const isAutoStart = app.getLoginItemSettings().openAtLogin;
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open Hekki Hub',
            type: 'normal',
            click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.show();
                    mainWindow.focus();
                } else {
                    createWindow();
                }
            }
        },
        {
            label: 'Super AI Overlay (Alt+Space)',
            type: 'normal',
            click: () => toggleOverlayWindow()
        },
        { type: 'separator' },
        {
            label: 'Start with Windows',
            type: 'checkbox',
            checked: isAutoStart,
            click: (menuItem) => {
                app.setLoginItemSettings({
                    openAtLogin: menuItem.checked,
                    openAsHidden: true,
                    args: ['--hidden']
                });
            }
        },
        { type: 'separator' },
        {
            label: 'Quit Hekki',
            type: 'normal',
            click: () => {
                isQuitting = true;
                cleanupBackend();
                app.quit();
            }
        }
    ]);
    tray.setContextMenu(contextMenu);
}

function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'hekki.ico');
    tray = new Tray(iconPath);
    tray.setToolTip('Hekki — AI Assistant');
    updateTrayContextMenu();

    tray.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isVisible()) {
                mainWindow.focus();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        } else {
            createWindow();
        }
    });
}

// ── IPC Handlers ──────────────────────────────────────────────────────────
ipcMain.on('open-external', (_event, url) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://'))) {
        shell.openExternal(url);
    }
});

ipcMain.on('set-theme', (_event, theme) => {
    applyNativeTheme(theme);
    const dark = theme !== 'light';
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setTitleBarOverlay({
            color: dark ? '#181817' : '#F6F7F9',
            symbolColor: dark ? '#e0e0e0' : '#111111',
            height: 32
        });
    }
});

ipcMain.on('hide-overlay', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
});

ipcMain.on('toggle-overlay', () => toggleOverlayWindow());

ipcMain.handle('get-auto-start', () => {
    return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('set-auto-start', (_event, enabled) => {
    app.setLoginItemSettings({
        openAtLogin: !!enabled,
        openAsHidden: true,
        args: ['--hidden']
    });
    updateTrayContextMenu();
    return app.getLoginItemSettings().openAtLogin;
});

ipcMain.on('set-run-in-background', (_event, enabled) => {
    console.log(`[IPC] Run in background updated to: ${enabled}`);
});

// ── App Lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(() => {
    const savedTheme = getThemeFromSettings();

    try {
        globalShortcut.register('Alt+Space', () => toggleOverlayWindow());
        globalShortcut.register('Alt+V', () => toggleOverlayWindow());
        console.log('Global Desktop Overlay shortcuts registered: Alt+Space & Alt+V');
    } catch (e) {
        console.error('Failed to register global shortcuts:', e);
    }

    const launchHidden = process.argv.includes('--hidden');
    if (!launchHidden) {
        createSplashWindow(savedTheme);
    }

    startBackend(() => isQuitting);
    checkServerReady(() => {
        createTray();

        if (launchHidden) {
            console.log('Hekki started hidden in system tray.');
            return;
        }

        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.webContents.executeJavaScript('completeProgress()').catch(err => console.error(err));
            setTimeout(() => {
                createWindow();
                if (splashWindow && !splashWindow.isDestroyed()) {
                    splashWindow.close();
                    splashWindow = null;
                }
            }, 600);
        } else {
            createWindow();
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().filter(w => !w.isDestroyed()).length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (isQuitting || !isRunInBackgroundEnabled()) {
        cleanupBackend();
        if (process.platform !== 'darwin') {
            app.quit();
        }
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    cleanupBackend();
});
