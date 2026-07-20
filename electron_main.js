const { app, BrowserWindow, dialog, nativeTheme, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');

let backendProcess = null;
let isServerReady = false;

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

function createWindow() {
    const savedTheme = getThemeFromSettings();
    applyNativeTheme(savedTheme);

    const isDark = savedTheme !== 'light';
    const bgColor   = isDark ? '#0d0d0d' : '#f5f5f5';
    const overlayBg = isDark ? '#161616' : '#f0f0f0';
    const overlayFg = isDark ? '#e0e0e0' : '#111111';
    const overlayHover = isDark ? '#2a2a2a' : '#e0e0e0';

    const win = new BrowserWindow({
        width: 1100,
        height: 750,
        title: "Hekki",
        icon: path.join(__dirname, 'assets', 'hekki.ico'),
        autoHideMenuBar: true,
        backgroundColor: bgColor,
        // titleBarStyle + titleBarOverlay give us custom-colored caption buttons
        // while keeping the standard Minimize / Maximize / Close behaviour.
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

    win.loadURL('http://localhost:8000');

    // ── Live theme sync from renderer ──────────────────────────────────────
    // The frontend calls window.electronAPI.setTheme('dark'|'light') when
    // the user toggles the theme, and we update the titlebar overlay instantly.
    ipcMain.on('set-theme', (_event, theme) => {
        applyNativeTheme(theme);
        const dark = theme !== 'light';
        win.setTitleBarOverlay({
            color:       dark ? '#161616' : '#f0f0f0',
            symbolColor: dark ? '#e0e0e0' : '#111111',
            height: 32
        });
    });
}

app.whenReady().then(() => {
    const savedTheme = getThemeFromSettings();
    createSplashWindow(savedTheme);

    startBackend();
    checkServerReady(() => {
        isServerReady = true;
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
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    cleanupBackend();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    cleanupBackend();
});
