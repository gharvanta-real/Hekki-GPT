# 💻 Hekki AI Telephony Bridge — Installation & Setup Guide

Welcome to the **Hekki AI Telephony Bridge** installation guide! You can run or install this application on any Windows PC using **two simple methods**.

---

## ⚡ Method 1: Instant 1-Click Desktop Launch (No Installation Required)

You can launch the entire software (Rust Core Engine + SQLite Database + React Dashboard App) in **1 second** using the built-in launcher:

1. Open folder: `d:\Hekki-Assistant\`
2. Double-click the file: **`Hekki-Desktop-App.bat`**
3. **That's it!** The launcher automatically:
   - Starts the Rust Tokio Async Core Engine (Port `8443`)
   - Starts the SQLite Database API Server (Port `5000`)
   - Opens the Desktop Application Window at `http://localhost:3000/boot`

---

## 📦 Method 2: Build a Standalone Windows Installer (`.exe` Setup File)

If you want to distribute a single **`Hekki-AI-Telephony-Bridge-Setup.exe`** installer file that creates a Desktop Shortcut & Start Menu icon for any user:

### Prerequisites:
- **Node.js** (v18 or higher) installed on Windows.
- **Rust toolchain** (`cargo`) installed.

### Build Steps:
1. Open PowerShell or Command Prompt.
2. Navigate to the desktop packaging folder:
   ```cmd
   cd d:\Hekki-Assistant\zero_voip_telephony_bridge\desktop_app
   ```
3. Install packaging dependencies:
   ```cmd
   npm install
   ```
4. Run the Windows build command:
   ```cmd
   npm run build-win
   ```
5. **Output**: The installer setup file **`Hekki-AI-Telephony-Bridge-Setup.exe`** will be generated inside:
   ```
   d:\Hekki-Assistant\zero_voip_telephony_bridge\desktop_app\dist\
   ```

---

## 📱 Mobile Phone SIM Pairing Setup

To connect any mobile phone (Samsung, iPhone, Redmi, Vivo, OnePlus) to the SIM Telephony Bridge:

1. Open **`http://localhost:3000/settings`** on your desktop.
2. Click **`"Scan QR Code"`** or click **`"SIM Bridge Active 📱"`** in the topbar.
3. Open camera on your phone and scan the QR Code, or open in phone browser:
   ```
   http://<YOUR-LOCAL-IP>:3000/sim-bridge
   ```
4. Click **`"Enable AI Voice & SIM Bridge"`** on your phone.
5. Your phone will auto-register and save to the SQLite database instantly!

---

## 🗄️ System Architecture Summary

| Component | Port | Technology | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | `3000` | React + Vite + CSS Tokens | Responsive Desktop & Mobile SPA |
| **Rust Engine** | `8443` | Pure Rust + Tokio + Axum | Sub-10ms Audio WebSockets & SIM Queue |
| **Database API** | `5000` | Express + `better-sqlite3` | Thread-safe SQLite WAL Mode Persistence |

---
*Created for Hekki AI Telephony Workspace.*
