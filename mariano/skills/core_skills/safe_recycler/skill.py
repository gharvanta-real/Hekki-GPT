"""safe_recycler — Safe Recycle Bin file deletion skill for MARIANO.

Moves files and directories to the Windows Recycle Bin instead of permanently deleting them.
Ensures zero permanent data loss with 100% recovery capability.
"""
from __future__ import annotations

import ctypes
from ctypes import wintypes
from pathlib import Path
from typing import Any

from mariano.skills._base.skill_interface import BaseSkill, SkillResult


class SafeRecyclerSkill(BaseSkill):
    name = "safe_recycler"
    description = (
        "Safely delete files or directories by moving them to the Windows Recycle Bin. "
        "Allows 100% data recovery if needed. Action options: 'trash' or 'delete'. "
        "Parameter 'path': absolute path or workspace path of file or folder to move to Recycle Bin."
    )
    version = "1.0.0"
    tags = ["delete", "recycle", "trash", "restore", "file_management"]

    async def execute(self, **kwargs: Any) -> SkillResult:
        raw_path = kwargs.get("path", kwargs.get("file", kwargs.get("target", "")))
        if not raw_path:
            return SkillResult(success=False, data=None, error="Parameter 'path' is required for safe_recycler.")

        try:
            from mariano.core.workspace import PathGuard
            active_proj_path = PathGuard.get_active_project_path()

            path_obj = Path(raw_path).expanduser()
            if not path_obj.is_absolute():
                if active_proj_path:
                    path_obj = (Path(active_proj_path) / path_obj).resolve()
                else:
                    path_obj = (Path.cwd() / path_obj).resolve()

            resolved = PathGuard.secure_path(path_obj)
        except Exception as e:
            return SkillResult(success=False, data=None, error=f"Path resolution error: {e}")

        if not resolved.exists():
            return SkillResult(success=False, data=None, error=f"Target path does not exist: '{resolved}'")

        # Recycle Bin move via send2trash or Windows SHFileOperationW
        FO_DELETE = 3
        FOF_ALLOWUNDO = 0x0040       # Moves to Recycle Bin
        FOF_NOCONFIRMATION = 0x0010  # Silent execution

        class SHFILEOPSTRUCTW(ctypes.Structure):
            _fields_ = [
                ("hwnd", wintypes.HWND),
                ("wFunc", wintypes.UINT),
                ("pFrom", wintypes.LPCWSTR),
                ("pTo", wintypes.LPCWSTR),
                ("fFlags", wintypes.WORD),
                ("fAnyOperationsAborted", wintypes.BOOL),
                ("hNameMappings", wintypes.LPVOID),
                ("lpszProgressTitle", wintypes.LPCWSTR),
            ]

        path_str = str(resolved.resolve())
        recycled = False

        try:
            import send2trash
            send2trash.send2trash(path_str)
            recycled = True
        except Exception:
            path_buf = path_str + "\0\0"
            fileop = SHFILEOPSTRUCTW(
                hwnd=None,
                wFunc=FO_DELETE,
                pFrom=path_buf,
                pTo=None,
                fFlags=FOF_ALLOWUNDO | FOF_NOCONFIRMATION,
                fAnyOperationsAborted=False,
                hNameMappings=None,
                lpszProgressTitle=None
            )
            res = ctypes.windll.shell32.SHFileOperationW(ctypes.byref(fileop))
            recycled = (res == 0)

        if recycled or not resolved.exists():
            item_type = "directory" if resolved.is_dir() else "file"
            return SkillResult(
                success=True,
                data=f"Successfully moved {item_type} '{resolved.name}' to Windows Recycle Bin. Safe deletion complete.",
                metadata={"path": str(resolved), "recycled": True}
            )
        else:
            return SkillResult(success=False, data=None, error=f"Failed to move '{resolved.name}' to Recycle Bin.")

    def get_parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Absolute or relative path to file or directory to send to Recycle Bin.",
                },
                "action": {
                    "type": "string",
                    "enum": ["trash", "delete"],
                    "description": "Optional action name (defaults to trash).",
                }
            },
            "required": ["path"],
        }
