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

function freePort8000(callback) {
    if (process.platform === 'win32') {
        // Kill orphan processes bound to port 8000 or old hekki_backend processes
        exec('for /f "tokens=5" %a in (\'netstat -aon ^| findstr :8000 ^| findstr LISTENING\') do taskkill /F /PID %a', () => {
            setTimeout(callback, 300);
        });
    } else {
        exec('fuser -k 8000/tcp', () => {
            setTimeout(callback, 300);
        });
    }
}

function startBackend() {
    const isPackaged = app.isPackaged;
    let backendPath;
    let args = [];

    if (isPackaged) {
        // In production, the executable is placed in resources/backend/hekki_backend.exe
        backendPath = path.join(process.resourcesPath, 'backend', 'hekki_backend.exe');

        if (!fs.existsSync(backendPath)) {
            // Check fallback locations if missing
            const altPath = path.join(app.getAppPath(), '..', 'backend', 'hekki_backend.exe');
            const devDistPath = path.join(__dirname, 'backend_dist', 'hekki_backend.exe');
            if (fs.existsSync(altPath)) {
                backendPath = altPath;
            } else if (fs.existsSync(devDistPath)) {
                backendPath = devDistPath;
            } else {
                console.warn(`Backend executable not found at ${backendPath}. Falling back to system python.`);
                backendPath = 'python';
                const runWebResource = path.join(process.resourcesPath, 'run_web.py');
                args = [fs.existsSync(runWebResource) ? runWebResource : path.join(__dirname, 'run_web.py')];
            }
        }
    } else {
        // In development, run python run_web.py
        backendPath = 'python';
        args = [path.join(__dirname, 'run_web.py')];
    }

    // Check if server is already running on port 8000 before spawning
    http.get('http://localhost:8000', (res) => {
        if (res.statusCode === 200) {
            console.log('Backend server is already running and healthy on port 8000.');
            isServerReady = true;
            return;
        } else {
            spawnBackendProcess(backendPath, args, isPackaged);
        }
    }).on('error', () => {
        // Port 8000 not serving 200 OK -> free port 8000 of zombie processes, then spawn
        freePort8000(() => {
            spawnBackendProcess(backendPath, args, isPackaged);
        });
    });
}

function spawnBackendProcess(backendPath, args, isPackaged) {
    console.log(`Starting backend: ${backendPath} with args: ${args.join(' ')}`);
    
    try {
        backendProcess = spawn(backendPath, args, {
            cwd: (isPackaged && backendPath.endsWith('.exe')) ? path.dirname(backendPath) : __dirname,
            windowsHide: true,
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        backendProcess.on('error', (err) => {
            console.error('Backend process spawn error:', err);
            if (!isServerReady && !isQuitting) {
                dialog.showErrorBox(
                    'Backend Spawn Failed',
                    `Failed to launch the backend process (${backendPath}):\n${err.message}\n\n` +
                    `Please ensure python or hekki_backend.exe is installed and not blocked by antivirus.`
                );
                app.quit();
            }
        });

        backendProcess.stdout.on('data', (data) => {
            console.log(`Backend stdout: ${data.toString()}`);
        });

        backendProcess.stderr.on('data', (data) => {
            console.error(`Backend stderr: ${data.toString()}`);
        });

        backendProcess.on('close', (code) => {
            console.log(`Backend process exited with code ${code}`);
            if (!isServerReady && !isQuitting) {
                dialog.showErrorBox(
                    'Backend Server Failed',
                    `The backend server process exited unexpectedly (code ${code !== null ? code : 1}).\n\n` +
                    `Please check if another instance of Hekki or a server is already running on port 8000.`
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
                    content: 'Click the tray icon to reopen Hekki.'
                });
            }
        }
    });
}

// ── System Tray ────────────────────────────────────────────────────
function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'hekki.ico');
    tray = new Tray(iconPath);
    tray.setToolTip('Hekki — AI Assistant');

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

        if (launchHidden) {
            // Background-only start: just keep tray, no main window
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
