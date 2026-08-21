const { app, dialog } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');

let backendProcess = null;
let isServerReady = false;

function freePort8000(callback) {
    if (process.platform === 'win32') {
        exec('for /f "tokens=5" %a in (\'netstat -aon ^| findstr :8000 ^| findstr LISTENING\') do taskkill /F /PID %a', () => {
            setTimeout(callback, 300);
        });
    } else {
        exec('fuser -k 8000/tcp', () => {
            setTimeout(callback, 300);
        });
    }
}

function startBackend(isQuittingCheck) {
    const isPackaged = app.isPackaged;
    let backendPath;
    let args = [];

    if (isPackaged) {
        backendPath = path.join(process.resourcesPath, 'backend', 'hekki_backend.exe');
        if (!fs.existsSync(backendPath)) {
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
        backendPath = 'python';
        args = [path.join(__dirname, 'run_web.py')];
    }

    http.get('http://localhost:8000', (res) => {
        if (res.statusCode === 200) {
            console.log('Backend server is already running and healthy on port 8000.');
            isServerReady = true;
            return;
        }
        spawnBackendProcess(backendPath, args, isPackaged, isQuittingCheck);
    }).on('error', () => {
        freePort8000(() => {
            spawnBackendProcess(backendPath, args, isPackaged, isQuittingCheck);
        });
    });
}

function spawnBackendProcess(backendPath, args, isPackaged, isQuittingCheck) {
    console.log(`Starting backend: ${backendPath} with args: ${args.join(' ')}`);
    try {
        backendProcess = spawn(backendPath, args, {
            cwd: (isPackaged && backendPath.endsWith('.exe')) ? path.dirname(backendPath) : __dirname,
            windowsHide: true,
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        backendProcess.on('error', (err) => {
            console.error('Backend process spawn error:', err);
            if (!isServerReady && !isQuittingCheck()) {
                dialog.showErrorBox(
                    'Backend Spawn Failed',
                    `Failed to launch the backend process (${backendPath}):\n${err.message}\n\nPlease ensure python or hekki_backend.exe is installed.`
                );
                app.quit();
            }
        });

        backendProcess.stdout.on('data', (data) => console.log(`Backend stdout: ${data.toString()}`));
        backendProcess.stderr.on('data', (data) => console.error(`Backend stderr: ${data.toString()}`));

        backendProcess.on('close', (code) => {
            console.log(`Backend process exited with code ${code}`);
            if (!isServerReady && !isQuittingCheck()) {
                dialog.showErrorBox(
                    'Backend Server Failed',
                    `The backend server process exited unexpectedly (code ${code !== null ? code : 1}).\nPlease check if port 8000 is occupied.`
                );
                app.quit();
            }
        });
    } catch (err) {
        console.error('Failed to start backend process:', err);
        dialog.showErrorBox('Backend Error', `Failed to start Python backend server: ${err.message}`);
        app.quit();
    }
}

function checkServerReady(callback, startTime = Date.now()) {
    if (Date.now() - startTime > 240000) {
        dialog.showErrorBox('Connection Timeout', 'The Hekki backend server took too long to respond.');
        cleanupBackend();
        app.quit();
        return;
    }

    http.get('http://localhost:8000', (res) => {
        if (res.statusCode === 200) {
            isServerReady = true;
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
        console.log(`Terminating backend process PID: ${pid}`);
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

module.exports = {
    startBackend,
    checkServerReady,
    cleanupBackend,
    getIsServerReady: () => isServerReady
};
