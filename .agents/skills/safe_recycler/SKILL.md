---
name: safe_recycler
description: Safely move files or directories to the Windows Recycle Bin for 100% data recovery instead of permanent deletion.
---

# Safe Recycler Skill

Use this skill whenever a file or directory needs to be deleted or removed. 

## Features
- **Zero Permanent Loss**: All items deleted via this skill are placed into the **Windows Recycle Bin**.
- **100% Recoverable**: If any file was deleted by mistake, the user can restore it directly from the Windows Recycle Bin.
- **Cross-Platform API**: Uses Python `send2trash` or native Windows Shell API `SHFileOperationW(FOF_ALLOWUNDO)`.

## Usage
Call the `safe_recycler` or `file_manager` skill with `action="delete"` or `action="trash"`:

```json
{
  "action": "trash",
  "path": "D:\\path\\to\\unwanted_folder"
}
```
