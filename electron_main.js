const { app, BrowserWindow, dialog, nativeTheme, ipcMain, globalShortcut, screen, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');
const net = require('net');
const fs = require('fs');

let backendProcess = null;
let isServerReady = false;
let mainWindow = null;
let overlayWindow = null;
let tray = null;
let isQuitting = false;  // true only when user explicitly clicks "Quit"

function startBackend() {
    const isPackaged = app.isPackaged;
    let backendPath;
    let args = [];

    if (isPackaged) {
        // In production, the executable is placed in resources/backend/hekki_backend.exe
        backendPath = path.join(process.resourcesPath, 'backend', 'hekki_backend.exe');
    } else {
        // In development, run python run_web.py
        backendPath = 'python';
        args = [path.join(__dirname, 'run_web.py')];
    }

    console.log(`Starting backend: ${backendPath} with args: ${args}`);
    
    try {
        backendProcess = spawn(backendPath, args, {
            cwd: isPackaged ? path.dirname(backendPath) : __dirname,
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        backendProcess.stdout.on('data', (data) => {
            console.log(`Backend stdout: ${data.toString()}`);
        });

        backendProcess.stderr.on('data', (data) => {
            console.error(`Backend stderr: ${data.toString()}`);
        });

        backendProcess.on('close', (code) => {
            console.log(`Backend process exited with code ${code}`);
            if (!isServerReady) {
                dialog.showErrorBox(
                    'Backend Server Failed',
                    `The backend server process exited unexpectedly (code ${code || 1}).\n\n` +
                    `Please check if another instance of Hekki or a server is already running on port 8000. ` +
                    `You can try closing port 8000 and restarting the app.`
                );
                app.quit();
            }
        });
    } catch (err) {
        console.error('Failed to start backend process:', err);
        dialog.showErrorBox('Backend Error', `Failed to start the Python backend server: ${err.message}`);
        app.quit();
    }
}

function checkServerReady(callback, startTime = Date.now()) {
    // Timeout after 240 seconds (needed for large PyInstaller extraction on first launch)
    if (Date.now() - startTime > 240000) {
        dialog.showErrorBox(
            'Connection Timeout', 
            'The Hekki backend server took too long to respond. The application will now close.'
        );
        cleanupBackend();
        app.quit();
        return;
    }

    http.get('http://localhost:8000', (res) => {
        if (res.statusCode === 200) {
            callback();
        } else {
            setTimeout(() => checkServerReady(callback, startTime), 200);
        }
    }).on('error', () => {
        setTimeout(() => checkServerReady(callback, startTime), 200);
    });
}

function cleanupBackend() {
    if (backendProcess) {
        const pid = backendProcess.pid;
        console.log(`Terminating backend process with PID: ${pid}`);
        if (process.platform === 'win32') {
            exec(`taskkill /pid ${pid} /T /F`, (err) => {
                if (err) console.error(`Error killing backend tree: ${err.message}`);
            });
        } else {
            backendProcess.kill();
        }
        backendProcess = null;
    }
}

let splashWindow = null;

function getThemeFromSettings() {
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
            const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            if (data && data.theme) {
                return data.theme;
            }
        }
    } catch (e) {
        console.error("Failed to read settings file for theme:", e);
    }
    return 'dark'; // default theme
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

    const splashUrl = `file://${path.join(__dirname, 'splash.html')}?theme=${theme}`;
    splashWindow.loadURL(splashUrl);

    splashWindow.once('ready-to-show', () => {
        if (splashWindow) splashWindow.show();
    });
}

function applyNativeTheme(theme) {
    nativeTheme.themeSource = theme === 'light' ? 'light' : 'dark';
}

// ── Create Overlay Window ────────────────────────────────────────────────
function createOverlayWindow() {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        return;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;
    const winWidth = 440;

    overlayWindow = new BrowserWindow({
        width: winWidth,
        height: 520,
        x: Math.round((width - winWidth) / 2),
        y: 80,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        hasShadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        movable: true,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        show: false,
        title: 'Hekki Quick Voice',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'overlay_preload.js')
        }
    });

    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    const overlayPath = `file://${path.join(__dirname, 'overlay.html')}`;
    overlayWindow.loadURL(overlayPath);

    // Auto-resize based on content height
    overlayWindow.webContents.on('did-finish-load', () => {
        overlayWindow.webContents.executeJavaScript(
            'document.getElementById("overlay-root").getBoundingClientRect().height'
        ).then(h => {
            if (h && h > 0) overlayWindow.setSize(winWidth, Math.ceil(h) + 20);
        }).catch(() => {});
    });

    overlayWindow.on('blur', () => {
        // Don't auto-close on blur — user might switch windows
    });

    overlayWindow.on('closed', () => {
        overlayWindow = null;
    });
}

function toggleOverlay() {
    // Check if overlay feature is enabled
    const dataDir = app.isPackaged
        ? path.join(process.env.APPDATA || '', 'hekki', 'data')
        : path.join(__dirname, 'data');
    const settingsPath = path.join(dataDir, 'dynamic_settings.json');
    try {
        if (fs.existsSync(settingsPath)) {
            const cfg = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            if (cfg.quick_voice_enabled === false) return; // disabled in settings
        }
    } catch(e) {}

    const activeTheme = getThemeFromSettings();

    if (!overlayWindow || overlayWindow.isDestroyed()) {
        createOverlayWindow();
        overlayWindow.once('ready-to-show', () => {
            overlayWindow.webContents.send('overlay-theme-update', activeTheme);
            overlayWindow.show();
            overlayWindow.focus();
        });
    } else if (overlayWindow.isVisible()) {
        overlayWindow.hide();
    } else {
        overlayWindow.webContents.send('overlay-theme-update', activeTheme);
        overlayWindow.show();
        overlayWindow.focus();
    }
}

// ── Create Main Window ───────────────────────────────────────────────────
function createWindow() {
    const savedTheme = getThemeFromSettings();
    applyNativeTheme(savedTheme);

    const isDark = savedTheme !== 'light';
    const bgColor   = isDark ? '#0d0d0d' : '#f5f5f5';
    const overlayBg = isDark ? '#161616' : '#f0f0f0';
    const overlayFg = isDark ? '#e0e0e0' : '#111111';

    mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        title: "Hekki",
        icon: path.join(__dirname, 'assets', 'hekki.ico'),
        autoHideMenuBar: true,
        backgroundColor: bgColor,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: overlayBg,
            symbolColor: overlayFg,
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

    // ── Open external links safely in OS default browser ──────────────────
    ipcMain.on('open-external', (_event, url) => {
        if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://'))) {
            shell.openExternal(url);
        }
    });

    // ── Live theme sync from renderer ─────────────────────────────────────
    ipcMain.on('set-theme', (_event, theme) => {
        applyNativeTheme(theme);
        const dark = theme !== 'light';
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setTitleBarOverlay({
                color:       dark ? '#161616' : '#f0f0f0',
                symbolColor: dark ? '#e0e0e0' : '#111111',
                height: 32
            });
        }
    });

    // ── IPC: Overlay query → forward to backend ────────────────────────────
    ipcMain.handle('overlay-query', async (_event, { text }) => {
        return new Promise((resolve) => {
            const postData = JSON.stringify({ text });
            const req = http.request({
                hostname: 'localhost',
                port: 8000,
                path: '/api/quick-voice',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, res => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(body)); }
                    catch(e) { resolve({ response_text: 'Error parsing response.' }); }
                });
            });
            req.on('error', () => resolve({ response_text: 'Hekki backend is not reachable.' }));
            req.write(postData);
            req.end();
        });
    });

    // ── IPC: Open main window from overlay ───────────────────────────────
    ipcMain.on('overlay-open-main', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.hide();
        }
    });

    // ── IPC: Close overlay ────────────────────────────────────────────────
    ipcMain.on('overlay-close', () => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.hide();
        }
    });

    // ── IPC: Get theme for overlay ─────────────────────────────────────────
    ipcMain.handle('overlay-get-theme', () => getThemeFromSettings());

    // ── IPC: Resize overlay (width + height) ────────────────────────────────
    ipcMain.on('overlay-resize', (_event, { width, height }) => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            const targetW = Math.min(820, Math.max(340, Math.ceil(width)));
            const targetH = Math.min(720, Math.max(280, Math.ceil(height)));
            overlayWindow.setSize(targetW, targetH);
        }
    });

    // ── IPC: Resize overlay height only (legacy compat) ─────────────────────
    ipcMain.on('overlay-resize-height', (_event, height) => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            const currentSize = overlayWindow.getSize();
            const targetH = Math.min(720, Math.max(280, Math.ceil(height)));
            overlayWindow.setSize(currentSize[0], targetH);
        }
    });

    // ── Intercept close → hide to tray instead of quitting ──────────────────
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            // Show a tray notification the first time
            if (tray) {
                tray.displayBalloon({
                    iconType: 'info',
                    title: 'Hekki is still running',
                    content: 'Press Ctrl+Shift+Space anywhere or click the tray icon to reopen.'
                });
            }
        }
    });
}

// ── System Tray ────────────────────────────────────────────────────
function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'hekki.ico');
    tray = new Tray(iconPath);
    tray.setToolTip('Hekki — AI Assistant\nCtrl+Shift+Space to open Quick Voice');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open Hekki',
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
            label: 'Quick Voice  (Ctrl+Shift+Space)',
            type: 'normal',
            click: () => toggleOverlay()
        },
        { type: 'separator' },
        {
            label: 'Start with Windows',
            type: 'checkbox',
            checked: app.getLoginItemSettings().openAtLogin,
            click: (menuItem) => {
                app.setLoginItemSettings({
                    openAtLogin: menuItem.checked,
                    openAsHidden: true,   // start minimized to tray, no window
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
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    // Single click → open/focus main window
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

app.whenReady().then(() => {
    const savedTheme = getThemeFromSettings();

    // If launched with --hidden flag (auto-start from Windows startup), skip splash & main window
    const launchHidden = process.argv.includes('--hidden');

    if (!launchHidden) {
        createSplashWindow(savedTheme);
    }

    startBackend();
    checkServerReady(() => {
        isServerReady = true;
        createTray();
        setupOverlayShortcut();

        if (launchHidden) {
            // Background-only start: just keep tray + shortcut, no main window
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
        if (BrowserWindow.getAllWindows().filter(w => !w.isDestroyed() && w !== overlayWindow).length === 0) {
            createWindow();
        }
    });
});

function setupOverlayShortcut() {
    // Register Ctrl+Shift+Space global shortcut
    const registered = globalShortcut.register('CommandOrControl+Shift+Space', () => {
        toggleOverlay();
    });
    if (!registered) {
        console.warn('Global shortcut Ctrl+Shift+Space could not be registered (may be in use by another app).');
    }
}

app.on('window-all-closed', () => {
    // DON'T quit — keep running in system tray (Google Assistant behaviour)
    // Only quit when user explicitly clicks "Quit Hekki" from tray menu
    if (isQuitting) {
        cleanupBackend();
        if (process.platform !== 'darwin') {
            app.quit();
        }
    }
    // Otherwise: app stays alive silently with tray icon
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    cleanupBackend();
});
