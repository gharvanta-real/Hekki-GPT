"""Computer Use, System Control & Terminal Engine for MARIANO / Hekki.

Provides:
- Power control: shutdown, restart, sleep, lock, cancel
- Volume control: mute, up, down, set level
- File & folder operations: find, open, browse
- App launcher: 30+ apps by name (English + Hinglish)
- Process management: kill / close running apps
- Desktop automation: typing, clicks, scroll, hotkeys
- Browser search & URL navigation
- OPTIONAL secure terminal command execution (run / cmd / terminal prefix)
"""
from __future__ import annotations

import asyncio
import io
import os
import re
import subprocess
import sys
import time
import webbrowser
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pyautogui
pyautogui.FAILSAFE = False

# ── Safety blocklist for terminal execution ───────────────────────────────────
_TERMINAL_BLOCKLIST: List[str] = [
    "rm -rf", "rmdir /s", "del /s /q c:\\", "format c:", "format d:",
    "taskkill /f /im explorer", "reg delete", "reg add hklm",
    "net user administrator", "bcdedit", "diskpart",
    "shutdown /f /t 0",  # instant forced shutdown without warning
    "cipher /w",         # wipe free space
    "sfc /scannow",      # can hang for minutes
]

def _is_safe_command(cmd: str) -> Tuple[bool, str]:
    """Returns (is_safe, reason). Blocks dangerous destructive commands."""
    lower = cmd.lower().strip()
    for blocked in _TERMINAL_BLOCKLIST:
        if blocked in lower:
            return False, f"Command blocked for safety: contains '{blocked}'"
    return True, ""


# ── App Launcher Map (English + Hindi/Hinglish aliases) ──────────────────────
APP_LAUNCH_MAP: Dict[str, List[str]] = {
    # Editors / IDEs
    "vscode": ["code"],
    "vs code": ["code"],
    "visual studio code": ["code"],
    "code": ["code"],
    "notepad": ["notepad"],
    "notepad++": ["notepad++"],
    "wordpad": ["wordpad"],
    # Browsers
    "chrome": ["start chrome"],
    "google chrome": ["start chrome"],
    "edge": ["start msedge"],
    "microsoft edge": ["start msedge"],
    "firefox": ["start firefox"],
    "brave": ["start brave"],
    "opera": ["start opera"],
    # Communication
    "whatsapp": ["start whatsapp:"],
    "telegram": ["start telegram"],
    "discord": ["start discord"],
    "slack": ["start slack"],
    "teams": ["start ms-teams:"],
    "microsoft teams": ["start ms-teams:"],
    "zoom": ["start zoom"],
    "skype": ["start skype:"],
    # Productivity
    "word": ["start winword"],
    "excel": ["start excel"],
    "powerpoint": ["start powerpnt"],
    "outlook": ["start outlook"],
    "onenote": ["start onenote"],
    "excel spreadsheet": ["start excel"],
    # Media
    "spotify": ["start spotify"],
    "vlc": ["start vlc"],
    "photos": ["start ms-photos:"],
    "paint": ["mspaint"],
    "paint 3d": ["start ms-paint3d:"],
    # System
    "calculator": ["calc"],
    "calc": ["calc"],
    "task manager": ["taskmgr"],
    "taskmgr": ["taskmgr"],
    "explorer": ["explorer"],
    "file explorer": ["explorer"],
    "control panel": ["control"],
    "settings": ["start ms-settings:"],
    "windows settings": ["start ms-settings:"],
    "snipping tool": ["snippingtool"],
    "snip": ["snippingtool"],
    "camera": ["start microsoft.windows.camera:"],
    "clock": ["start ms-clock:"],
    "calendar": ["start outlookcal:"],
    # Terminal / Shell
    "cmd": ["start cmd"],
    "command prompt": ["start cmd"],
    "powershell": ["start powershell"],
    "terminal": ["start wt"],
    "windows terminal": ["start wt"],
    "git bash": ["start gitbash"],
    # Games
    "steam": ["start steam://open/main"],
    "xbox": ["start xbox:"],
    # Dev tools
    "postman": ["start postman"],
    "docker": ["start docker"],
    "android studio": ["start androidstudio"],
}

# ── Folder shortcuts ──────────────────────────────────────────────────────────
FOLDER_MAP: Dict[str, str] = {
    "downloads": str(Path.home() / "Downloads"),
    "desktop": str(Path.home() / "Desktop"),
    "documents": str(Path.home() / "Documents"),
    "pictures": str(Path.home() / "Pictures"),
    "videos": str(Path.home() / "Videos"),
    "music": str(Path.home() / "Music"),
    "appdata": str(Path.home() / "AppData"),
    "temp": os.environ.get("TEMP", "C:\\Temp"),
    "c drive": "C:\\",
    "c:": "C:\\",
}


class ComputerUseEngine:

    # ── Power Control ─────────────────────────────────────────────────────────
    @staticmethod
    def power_shutdown(delay_sec: int = 10) -> str:
        subprocess.Popen(["shutdown", "/s", "/t", str(int(delay_sec))], shell=False)
        return f"PC shutdown scheduled in {delay_sec} seconds. Type 'cancel shutdown' to abort."

    @staticmethod
    def power_restart(delay_sec: int = 10) -> str:
        subprocess.Popen(["shutdown", "/r", "/t", str(int(delay_sec))], shell=False)
        return f"PC restart scheduled in {delay_sec} seconds. Type 'cancel shutdown' to abort."

    @staticmethod
    def power_sleep() -> str:
        subprocess.Popen(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"], shell=False)
        return "Putting PC to sleep now."

    @staticmethod
    def power_lock() -> str:
        subprocess.Popen(["rundll32.exe", "user32.dll,LockWorkStation"], shell=False)
        return "Screen locked."

    @staticmethod
    def power_cancel_shutdown() -> str:
        subprocess.Popen(["shutdown", "/a"], shell=False)
        return "Shutdown / restart cancelled."

    @staticmethod
    def power_hibernate() -> str:
        subprocess.Popen(["shutdown", "/h"], shell=False)
        return "Hibernating now."

    @staticmethod
    def power_logoff() -> str:
        subprocess.Popen(["shutdown", "/l"], shell=False)
        return "Logging off now."

    # ── Volume Control ────────────────────────────────────────────────────────
    @staticmethod
    def volume_mute() -> str:
        pyautogui.press("volumemute")
        return "Volume toggled mute/unmute."

    @staticmethod
    def volume_up(steps: int = 5) -> str:
        for _ in range(steps):
            pyautogui.press("volumeup")
        return f"Volume increased."

    @staticmethod
    def volume_down(steps: int = 5) -> str:
        for _ in range(steps):
            pyautogui.press("volumedown")
        return f"Volume decreased."

    @staticmethod
    def volume_max() -> str:
        for _ in range(20):
            pyautogui.press("volumeup")
        return "Volume set to maximum."

    @staticmethod
    def volume_min() -> str:
        for _ in range(20):
            pyautogui.press("volumedown")
        return "Volume set to minimum."

    # ── App Launcher ──────────────────────────────────────────────────────────
    @staticmethod
    def launch_app(app_key: str) -> Optional[str]:
        cmds = APP_LAUNCH_MAP.get(app_key.lower().strip())
        if not cmds:
            return None
        try:
            subprocess.Popen(cmds[0], shell=True)
            return f"Opening {app_key.title()} for you!"
        except Exception as e:
            return f"Could not open {app_key}: {e}"

    # ── Folder Opener ─────────────────────────────────────────────────────────
    @staticmethod
    def open_folder(folder_key: str) -> str:
        path = FOLDER_MAP.get(folder_key.lower().strip())
        if path:
            subprocess.Popen(f'explorer "{path}"', shell=True)
            return f"Opened {folder_key.title()} folder."
        # If it looks like an absolute path, open directly
        if os.path.isdir(folder_key):
            subprocess.Popen(f'explorer "{folder_key}"', shell=True)
            return f"Opened folder: {folder_key}"
        return f"Folder not found: {folder_key}"

    # ── File Finder ───────────────────────────────────────────────────────────
    @staticmethod
    def find_file(filename: str, search_root: str = "C:\\Users") -> str:
        results: List[str] = []
        try:
            result = subprocess.run(
                ["where", "/r", search_root, filename],
                capture_output=True, text=True, timeout=8, shell=False
            )
            if result.stdout.strip():
                lines = result.stdout.strip().splitlines()[:5]
                results = lines
        except Exception as e:
            print(f"Search error: {e}")

        # Fallback: os.walk for broader search (limited depth)
        if not results:
            try:
                search_path = Path(search_root)
                for root, dirs, files in os.walk(search_path):
                    # Limit depth
                    depth = len(Path(root).relative_to(search_path).parts)
                    if depth > 5:
                        dirs.clear()
                        continue
                    for f in files:
                        if filename.lower() in f.lower():
                            results.append(str(Path(root) / f))
                            if len(results) >= 5:
                                break
                    if len(results) >= 5:
                        break
            except Exception as e:
                print(f"Fallback search error: {e}")

        if results:
            found_str = "\n".join(results[:5])
            return f"Found {len(results)} result(s):\n{found_str}"
        return f"File '{filename}' not found in {search_root}."

    # ── Process Killer ────────────────────────────────────────────────────────
    @staticmethod
    def kill_process(process_name: str) -> str:
        name = process_name.strip()
        if not name.endswith(".exe"):
            name = name + ".exe"
        try:
            result = subprocess.run(
                f"taskkill /im \"{name}\" /f",
                shell=True, capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                return f"Closed {process_name}."
            return f"Could not close {process_name}. It may not be running."
        except Exception as e:
            return f"Error closing {process_name}: {e}"

    # ── Terminal Command Execution (Optional, Safe) ───────────────────────────
    @staticmethod
    def run_terminal_command(cmd: str) -> str:
        """Execute a PowerShell/cmd command and return output (max 10s, safe-filtered)."""
        is_safe, reason = _is_safe_command(cmd)
        if not is_safe:
            return f"⚠ Blocked: {reason}"
        try:
            result = subprocess.run(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", cmd],
                capture_output=True, text=True, timeout=10,
                encoding="utf-8", errors="replace"
            )
            output = (result.stdout or "").strip()
            err = (result.stderr or "").strip()
            if output:
                # Truncate if too long
                lines = output.splitlines()
                if len(lines) > 20:
                    output = "\n".join(lines[:20]) + f"\n... ({len(lines)-20} more lines)"
                return output
            if err:
                return f"Error: {err[:300]}"
            return "Command executed (no output)."
        except subprocess.TimeoutExpired:
            return "Command timed out after 10 seconds."
        except Exception as e:
            return f"Command failed: {e}"

    # ── Desktop Automation ────────────────────────────────────────────────────
    @staticmethod
    def human_type(text: str, interval: float = 0.03) -> None:
        if not text:
            return
        pyautogui.typewrite(text, interval=interval)

    @staticmethod
    def mouse_click(x: int, y: int, right_click: bool = False, double_click: bool = False) -> None:
        pyautogui.moveTo(x, y, duration=0.25, tween=pyautogui.easeOutQuad)
        if right_click:
            pyautogui.rightClick()
        elif double_click:
            pyautogui.doubleClick()
        else:
            pyautogui.click()

    @staticmethod
    def scroll_screen(amount: int = -300) -> None:
        pyautogui.scroll(amount)

    @staticmethod
    def open_browser_search(query: str) -> str:
        import urllib.parse
        encoded = urllib.parse.quote_plus(query.strip())
        webbrowser.open(f"https://www.google.com/search?q={encoded}")
        return f"Opened Google search for '{query}'"

    @staticmethod
    def press_hotkey(*keys: str) -> None:
        pyautogui.hotkey(*keys)

    # ── Main Intent Router ────────────────────────────────────────────────────
    @classmethod
    async def execute_intent(cls, prompt: str) -> Dict[str, Any]:
        """
        Parse user intent (English + Hinglish) and execute the matching action.
        Returns {"success": bool, "action": str, "message": str}
        """
        p = prompt.strip()
        pl = p.lower()

        # ── 1. TERMINAL / RUN COMMAND ─────────────────────────────────────────
        run_prefixes = ("run ", "terminal ", "cmd ", "execute ", "chalao ", "command ")
        for prefix in run_prefixes:
            if pl.startswith(prefix):
                cmd = p[len(prefix):].strip()
                if cmd:
                    out = cls.run_terminal_command(cmd)
                    return {"success": True, "action": "terminal", "message": out}

        # ── 2. POWER CONTROL ──────────────────────────────────────────────────
        if any(k in pl for k in ("shutdown", "band kar pc", "pc band karo", "band karo computer", "pc off")):
            return {"success": True, "action": "shutdown", "message": cls.power_shutdown(10)}
        if any(k in pl for k in ("restart", "reboot", "restart karo", "dobara chalu karo")):
            return {"success": True, "action": "restart", "message": cls.power_restart(10)}
        if any(k in pl for k in ("sleep", "so jao", "hibernate nahi", "standby")):
            return {"success": True, "action": "sleep", "message": cls.power_sleep()}
        if any(k in pl for k in ("hibernate", "deep sleep")):
            return {"success": True, "action": "hibernate", "message": cls.power_hibernate()}
        if any(k in pl for k in ("lock", "lock karo", "screen lock", "lock screen")):
            return {"success": True, "action": "lock", "message": cls.power_lock()}
        if any(k in pl for k in ("log off", "logoff", "sign out", "log out")):
            return {"success": True, "action": "logoff", "message": cls.power_logoff()}
        if any(k in pl for k in ("cancel shutdown", "cancel restart", "shutdown cancel", "ruko")):
            return {"success": True, "action": "cancel_shutdown", "message": cls.power_cancel_shutdown()}

        # ── 3. VOLUME CONTROL ─────────────────────────────────────────────────
        if any(k in pl for k in ("mute", "silent", "chup karo", "awaaz band")):
            return {"success": True, "action": "volume_mute", "message": cls.volume_mute()}
        if any(k in pl for k in ("volume up", "louder", "awaaz badhao", "volume badhao", "increase volume")):
            return {"success": True, "action": "volume_up", "message": cls.volume_up(6)}
        if any(k in pl for k in ("volume down", "quieter", "awaaz kam karo", "volume kam", "decrease volume")):
            return {"success": True, "action": "volume_down", "message": cls.volume_down(6)}
        if any(k in pl for k in ("max volume", "full volume", "poori awaaz")):
            return {"success": True, "action": "volume_max", "message": cls.volume_max()}
        if any(k in pl for k in ("min volume", "minimum volume")):
            return {"success": True, "action": "volume_min", "message": cls.volume_min()}

        # ── 4. FOLDER OPERATIONS ──────────────────────────────────────────────
        for folder_key in FOLDER_MAP:
            patterns = [
                f"open {folder_key}", f"show {folder_key}", f"open my {folder_key}",
                f"{folder_key} folder", f"{folder_key} kholo", f"{folder_key} dikhao"
            ]
            if any(pat in pl for pat in patterns):
                return {"success": True, "action": "open_folder", "message": cls.open_folder(folder_key)}

        # ── 5. FILE FINDER ────────────────────────────────────────────────────
        find_patterns = [
            r"find file (.+)", r"search file (.+)", r"file dhundo (.+)",
            r"find (.+\.\w+)", r"where is (.+\.\w+)", r"(.+) file kahan hai"
        ]
        for pat in find_patterns:
            m = re.search(pat, pl)
            if m:
                filename = m.group(1).strip()
                out = cls.find_file(filename)
                return {"success": True, "action": "find_file", "message": out}

        # ── 6. APP LAUNCHER ───────────────────────────────────────────────────
        open_prefixes = ("open ", "launch ", "start ", "chalu karo ", "kholo ")
        for prefix in open_prefixes:
            if pl.startswith(prefix):
                app_key = pl[len(prefix):].strip()
                msg = cls.launch_app(app_key)
                if msg:
                    return {"success": True, "action": "app_launch", "message": msg}
                # Could be a folder shortcut too
                for fk in FOLDER_MAP:
                    if fk in app_key:
                        return {"success": True, "action": "open_folder", "message": cls.open_folder(fk)}

        # ── 7. PROCESS KILLER ─────────────────────────────────────────────────
        kill_patterns = [
            r"kill (.+)", r"close (.+)", r"band karo (.+)", r"force close (.+)",
            r"stop (.+)", r"terminate (.+)"
        ]
        for pat in kill_patterns:
            m = re.search(pat, pl)
            if m:
                proc = m.group(1).strip()
                # Don't accidentally kill system (too broad a match)
                if len(proc) > 2 and proc not in ("it", "this", "that", "app", "all"):
                    return {"success": True, "action": "kill_process", "message": cls.kill_process(proc)}

        # ── 8. BROWSER SEARCH ─────────────────────────────────────────────────
        search_prefixes = ("search ", "google ", "search on google ", "browser search ")
        for prefix in search_prefixes:
            if pl.startswith(prefix):
                q = p[len(prefix):].strip()
                if q:
                    return {"success": True, "action": "browser_search",
                            "message": cls.open_browser_search(q)}

        # ── 9. TYPING ─────────────────────────────────────────────────────────
        type_prefixes = ("type ", "write ", "type this ")
        for prefix in type_prefixes:
            if pl.startswith(prefix):
                text_to_type = p[len(prefix):]
                await asyncio.sleep(0.5)
                cls.human_type(text_to_type)
                return {"success": True, "action": "human_type", "message": "Typed text into active window."}

        # ── 10. HOTKEYS / CLIPBOARD ───────────────────────────────────────────
        if any(k in pl for k in ("copy", "ctrl c", "copy karo")):
            pyautogui.hotkey("ctrl", "c")
            return {"success": True, "action": "hotkey", "message": "Copied to clipboard."}
        if any(k in pl for k in ("paste", "ctrl v", "paste karo")):
            pyautogui.hotkey("ctrl", "v")
            return {"success": True, "action": "hotkey", "message": "Pasted from clipboard."}
        if any(k in pl for k in ("undo", "ctrl z", "wapas karo")):
            pyautogui.hotkey("ctrl", "z")
            return {"success": True, "action": "hotkey", "message": "Undo performed."}
        if any(k in pl for k in ("redo", "ctrl y")):
            pyautogui.hotkey("ctrl", "y")
            return {"success": True, "action": "hotkey", "message": "Redo performed."}
        if any(k in pl for k in ("select all", "ctrl a", "sab select karo")):
            pyautogui.hotkey("ctrl", "a")
            return {"success": True, "action": "hotkey", "message": "Selected all."}
        if any(k in pl for k in ("screenshot", "snip", "capture screen")):
            pyautogui.hotkey("win", "shift", "s")
            return {"success": True, "action": "screenshot", "message": "Screenshot snip tool opened."}

        # ── 11. SCROLL ────────────────────────────────────────────────────────
        if any(k in pl for k in ("scroll down", "neeche scroll", "page down")):
            cls.scroll_screen(-400)
            return {"success": True, "action": "scroll", "message": "Scrolled down."}
        if any(k in pl for k in ("scroll up", "upar scroll", "page up")):
            cls.scroll_screen(400)
            return {"success": True, "action": "scroll", "message": "Scrolled up."}

        # ── 12. CLICKS ────────────────────────────────────────────────────────
        if "right click" in pl:
            pos = pyautogui.position()
            cls.mouse_click(pos[0], pos[1], right_click=True)
            return {"success": True, "action": "right_click", "message": "Right clicked."}
        if "double click" in pl:
            pos = pyautogui.position()
            cls.mouse_click(pos[0], pos[1], double_click=True)
            return {"success": True, "action": "double_click", "message": "Double clicked."}

        return {"success": False, "message": "No specific system command matched."}
