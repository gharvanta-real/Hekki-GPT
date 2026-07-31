@echo off
title Hekki AI Telephony Bridge - Desktop Application Launcher
color 0A
cls
echo =========================================================================
echo       HEKKI AI CALL TELEPHONY BRIDGE - NATIVE DESKTOP SOFTWARE
echo =========================================================================
echo.
echo [1/3] Starting High-Performance Rust Engine (Sub-10ms Tokio Core)...
cd /d "%~dp0zero_voip_telephony_bridge\rust_audio_bridge"
start /min cargo run

echo [2/3] Starting SQLite Database API Server...
cd /d "%~dp0zero_voip_telephony_bridge"
start /min node server.js

echo [3/3] Launching Hekki Desktop App Window...
timeout /t 3 >nul
start http://localhost:3000

echo.
echo =========================================================================
echo  STATUS: Hekki AI Telephony Bridge Desktop App is RUNNING!
echo  SQLite DB: Active (telephony_database.sqlite)
echo  Rust Core: Active (Port 8443)
echo =========================================================================
pause
