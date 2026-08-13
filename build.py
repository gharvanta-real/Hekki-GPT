"""
===================================================================
HEKKI ASSISTANT — UNIFIED MASTER BUILD PIPELINE
===================================================================
One-click build script that compiles the complete Hekki Assistant
desktop application (Electron UI + FastAPI Backend + AI Engine)
into a final Windows NSIS Setup Installer (.exe).

Usage:
  python build.py
===================================================================
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

# Force UTF-8 output on Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

PROJECT_ROOT = Path(__file__).resolve().parent

def log(msg, symbol="🚀"):
    print(f"\n[{symbol}] {msg}")

def run_cmd(cmd, cwd=PROJECT_ROOT):
    log(f"Executing: {cmd}", "⚙️")
    result = subprocess.run(cmd, shell=True, cwd=cwd)
    if result.returncode != 0:
        log(f"Command failed with exit code {result.returncode}: {cmd}", "❌")
        sys.exit(result.returncode)

def kill_competing_processes():
    log("Terminating running app processes to release file locks...", "🛑")
    for proc_name in ["Hekki-Assistant.exe", "hekki_backend.exe", "electron.exe"]:
        try:
            subprocess.run(f"taskkill /F /IM {proc_name} /T", shell=True, capture_output=True)
        except Exception:
            pass

def clean_directory(dir_path):
    if dir_path.exists():
        log(f"Cleaning: {dir_path}", "🧹")
        def remove_readonly(func, path, excinfo):
            try:
                os.chmod(path, 0o777)
                func(path)
            except Exception:
                pass
        try:
            shutil.rmtree(dir_path, onerror=remove_readonly)
        except Exception:
            pass

def step_check_prerequisites():
    log("Checking Build Prerequisites...", "🔍")
    
    # Python check
    log(f"Python Environment: {sys.version.split()[0]}", "✅")
    
    # Check PyInstaller
    try:
        import PyInstaller
        log(f"PyInstaller Version: {PyInstaller.__version__}", "✅")
    except ImportError:
        log("PyInstaller not found. Installing via pip...", "📦")
        run_cmd(f"{sys.executable} -m pip install pyinstaller")

    # Check Node / NPX
    try:
        res = subprocess.run("npx --version", shell=True, capture_output=True, text=True)
        if res.returncode == 0:
            log(f"NPX Version: {res.stdout.strip()}", "✅")
        else:
            log("NPX check failed. Please ensure Node.js is installed.", "⚠️")
    except Exception as e:
        log(f"Warning checking NPX: {e}", "⚠️")

def step_clean():
    log("Step 1: Cleaning previous build artifacts...", "🧹")
    kill_competing_processes()
    clean_directory(PROJECT_ROOT / "build")
    clean_directory(PROJECT_ROOT / "dist")
    clean_directory(PROJECT_ROOT / "backend_dist")
    (PROJECT_ROOT / "backend_dist").mkdir(parents=True, exist_ok=True)

def step_build_pyinstaller():
    log("Step 2: Compiling Core Backend & AI Engine Executable via PyInstaller...", "🛠️")
    
    dist_dir = PROJECT_ROOT / "dist"
    
    pyinstaller_args = [
        sys.executable, "-m", "PyInstaller",
        "--clean",
        "--onefile",
        "--name=Hekki-Assistant",
        f"--distpath={dist_dir}",
        f'--icon="{PROJECT_ROOT / "assets" / "hekki.ico"}"',
        
        # Static Assets & Bundled Data
        '--add-data="mariano/web/static;mariano/web/static"',
        '--add-data="mariano/web/routes;mariano/web/routes"',
        '--add-data="mariano/skills;mariano/skills"',
        '--add-data="mariano/config/rules;mariano/config/rules"',
        '--add-data="mariano/config/prompts;mariano/config/prompts"',
        '--add-data="mariano/mcp;mariano/mcp"',
        
        # Dynamic Hidden Imports
        "--hidden-import=uvicorn.logging",
        "--hidden-import=uvicorn.loops",
        "--hidden-import=uvicorn.loops.auto",
        "--hidden-import=uvicorn.protocols",
        "--hidden-import=uvicorn.protocols.http",
        "--hidden-import=uvicorn.protocols.http.auto",
        "--hidden-import=uvicorn.protocols.websockets",
        "--hidden-import=uvicorn.protocols.websockets.auto",
        "--hidden-import=uvicorn.lifespan",
        "--hidden-import=uvicorn.lifespan.on",
        "--hidden-import=uvicorn.lifespan.off",
        "--hidden-import=fastapi",
        "--hidden-import=aiosqlite",
        "--hidden-import=pydantic_settings",
        "--hidden-import=httpx",
        "--hidden-import=httpx._client",
        "--hidden-import=pyautogui",
        "--hidden-import=pynput",
        "--hidden-import=mss",
        "--hidden-import=PIL",
        "--hidden-import=PIL.Image",
        "--hidden-import=google.genai",
        "--hidden-import=google.genai.types",
        "--hidden-import=send2trash",
        
        # Exclude Heavy Unused Modules
        "--exclude-module=transformers",
        "--exclude-module=torch",
        "--exclude-module=tensorflow",
        "--exclude-module=scipy",
        "--exclude-module=matplotlib",
        "--exclude-module=pandas",
        "--exclude-module=pyarrow",
        "--exclude-module=numba",
        "--exclude-module=llvmlite",
        "--exclude-module=gevent",
        "--exclude-module=pytest",
        "--exclude-module=tkinter",
        "--exclude-module=IPython",
        "--exclude-module=notebook",

        "run_web.py"
    ]
    
    cmd = " ".join(pyinstaller_args)
    run_cmd(cmd)
    
    output_exe = dist_dir / "Hekki-Assistant.exe"
    if not output_exe.exists():
        log("PyInstaller output executable not found!", "❌")
        sys.exit(1)
        
    size_mb = output_exe.stat().st_size / (1024 * 1024)
    log(f"PyInstaller Executable Created: {output_exe} ({size_mb:.2f} MB)", "✅")

def step_prepare_electron_resource():
    log("Step 3: Preparing Electron Backend Resource Package...", "📦")
    
    source_exe = PROJECT_ROOT / "dist" / "Hekki-Assistant.exe"
    dest_dir = PROJECT_ROOT / "backend_dist"
    dest_exe = dest_dir / "hekki_backend.exe"
    
    dest_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_exe, dest_exe)
    log(f"Copied backend executable to Electron resource path: {dest_exe}", "✅")

def step_build_electron_installer():
    log("Step 4: Compiling Desktop Electron NSIS Installer via electron-builder...", "⚡")
    run_cmd("npx electron-builder")

def step_verify_and_report():
    log("Step 5: Verifying Final Build Artifacts...", "🎯")
    
    dist_dir = PROJECT_ROOT / "dist"
    setup_files = list(dist_dir.glob("Hekki-Assistant Setup *.exe")) + list(dist_dir.glob("Hekki-Assistant-Setup.exe"))
    
    print("\n" + "=" * 65)
    print(" 🎉 HEKKI ASSISTANT BUILD COMPLETE! 🎉")
    print("=" * 65)
    
    if setup_files:
        setup_exe = setup_files[0]
        size_mb = setup_exe.stat().st_size / (1024 * 1024)
        print(f"  👉 Final Installer : {setup_exe}")
        print(f"  👉 Installer Size   : {size_mb:.2f} MB")
    
    standalone_exe = dist_dir / "Hekki-Assistant.exe"
    if standalone_exe.exists():
        size_mb = standalone_exe.stat().st_size / (1024 * 1024)
        print(f"  👉 Portable Executable : {standalone_exe} ({size_mb:.2f} MB)")
        
    print("=" * 65 + "\n")

def main():
    print("===================================================================")
    print("          HEKKI ASSISTANT UNIFIED MASTER BUILD PIPELINE            ")
    print("===================================================================")
    
    step_check_prerequisites()
    step_clean()
    step_build_pyinstaller()
    step_prepare_electron_resource()
    step_build_electron_installer()
    step_verify_and_report()

if __name__ == "__main__":
    main()
