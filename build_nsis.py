import os
import sys
import subprocess
from pathlib import Path

def find_makensis():
    candidates = [
        "makensis",
        r"C:\Program Files (x86)\NSIS\makensis.exe",
        r"C:\Program Files\NSIS\makensis.exe",
        r"C:\NSIS\makensis.exe",
        os.path.expanduser(r"~\AppData\Local\Programs\NSIS\makensis.exe"),
        os.path.expanduser(r"~\AppData\Local\NSIS\makensis.exe"),
    ]
    for cand in candidates:
        try:
            res = subprocess.run([cand, "/VERSION"], capture_output=True, text=True)
            if res.returncode == 0:
                print(f"Found makensis executable at: {cand} (Version: {res.stdout.strip()})")
                return cand
        except Exception:
            continue
    return None

def main():
    root = Path(__file__).resolve().parent
    nsi_path = root / "installer.nsi"
    dist_dir = root / "dist"
    setup_exe = dist_dir / "Hekki-Assistant-Setup.exe"

    print("Locating NSIS Compiler (makensis)...")
    makensis = find_makensis()
    
    if not makensis:
        print("NSIS makensis compiler is still installing or not found in standard paths.")
        print("Once NSIS installation completes, run: python build_nsis.py")
        sys.exit(1)

    print(f"Compiling NSIS Installer: {nsi_path}")
    cmd = [makensis, str(nsi_path)]
    result = subprocess.run(cmd)

    if result.returncode == 0 and setup_exe.exists():
        size_mb = setup_exe.stat().st_size / (1024 * 1024)
        print(f"\nSUCCESS! NSIS Installer compiled successfully at:")
        print(f" -> {setup_exe} ({size_mb:.2f} MB)")
    else:
        print("\nCompilation failed or setup executable not found.")
        sys.exit(1)

if __name__ == "__main__":
    main()
