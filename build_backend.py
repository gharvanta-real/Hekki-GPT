import os
import sys
import subprocess
import shutil
from pathlib import Path

def run_command(cmd, shell=True):
    print(f"Running command: {cmd}")
    result = subprocess.run(cmd, shell=shell)
    if result.returncode != 0:
        print(f"Error executing command: {cmd}")
        sys.exit(result.returncode)

def main():
    project_root = Path(__file__).resolve().parent
    print(f"Project root resolved to: {project_root}")
    
    # 1. Check/Install PyInstaller
    try:
        import PyInstaller
        print(f"PyInstaller is already installed. Version: {PyInstaller.__version__}")
    except ImportError:
        print("PyInstaller not found. Installing via pip...")
        run_command("pip install pyinstaller")

    # 2. Cleanup previous build artifacts
    build_dir = project_root / "build"
    dist_dir = project_root / "dist"
    backend_dist_dir = project_root / "backend_dist"

    if build_dir.exists():
        print(f"Removing old build directory: {build_dir}")
        shutil.rmtree(build_dir, ignore_errors=True)
    if backend_dist_dir.exists():
        print(f"Removing old backend_dist directory: {backend_dist_dir}")
        shutil.rmtree(backend_dist_dir, ignore_errors=True)

    # 3. Construct PyInstaller Command
    # We want a single-file executable named 'hekki_backend' inside backend_dist folder
    pyinstaller_args = [
        "pyinstaller",
        "--clean",
        "--onefile",
        "--name=hekki_backend",
        f"--distpath={backend_dist_dir}",
        
        # Include data files/folders
        # Format: source_path;dest_path
        f'--add-data="mariano/web/static;mariano/web/static"',
        f'--add-data="mariano/skills;mariano/skills"',
        f'--add-data="mariano/config/rules;mariano/config/rules"',
        
        # Hidden imports for FastAPI & Uvicorn dynamic packages
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
        # Essential computer-use and vision dependencies
        "--hidden-import=pyautogui",
        "--hidden-import=pynput",
        "--hidden-import=mss",
        "--hidden-import=PIL",
        "--hidden-import=PIL.Image",
        "--hidden-import=google.genai",
        "--hidden-import=google.genai.types",
        "--hidden-import=send2trash",
        "--hidden-import=send2trash.plat_win",
        # Exclude heavy unused machine learning and data science frameworks to speed up compilation
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
    print("Starting backend compilation...")
    run_command(cmd)
    
    # 4. Verify compilation output
    output_exe = backend_dist_dir / "hekki_backend.exe"
    if output_exe.exists():
        print(f"\nSuccess! Compiled backend executable created at: {output_exe}")
        print(f"Size: {output_exe.stat().st_size / (1024*1024):.2f} MB")
    else:
        print("\nError: Compilation finished but hekki_backend.exe was not found in backend_dist.")
        sys.exit(1)

if __name__ == "__main__":
    main()
