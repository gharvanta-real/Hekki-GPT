@echo off
title MARIANO Launcher
echo ====================================================
echo  MARIANO PERSONAL ASSISTANT DESKTOP LAUNCHER
echo ====================================================
echo.

:: Check if Ollama service is running, start it if not
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo [Ollama] Ollama background service is already running.
) else (
    echo [Ollama] Ollama service not detected. Launching Ollama serve...
    start "Ollama" /B ollama serve
    timeout /t 2 /nobreak > nul
)
echo.

:: 1. Launch Python FastAPI Server in background
echo [1/3] Starting Python Backend Server...
start "MARIANO Backend" /B python run_web.py

:: 2. Wait for server port 8000 to open
echo [2/3] Waiting for server boot (3s)...
timeout /t 3 /nobreak > nul

:: 3. Launch Electron window
echo [3/3] Launching Electron Desktop GUI...
npm start

echo.
echo Application window closed. Stopping backend...
:: Clean up uvicorn server processes when Electron exits
taskkill /FI "WINDOWTITLE eq MARIANO Backend*" /T /F > nul 2>&1
echo Done.
pause
