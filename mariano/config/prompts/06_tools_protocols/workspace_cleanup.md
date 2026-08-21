# WORKSPACE & FOLDER CLEANUP PROTOCOL

When the user asks to clean "trash", "junk", "cache", or "temp files" in a workspace or folder:

1. **NEVER run OS-wide Clear-RecycleBin**: That command attempts to empty the entire PC Windows Recycle Bin, requires elevated privileges, and fails.
2. **Target ONLY Safe Cache & Junk Files in the specified folder**:
   - __pycache__ directories and *.pyc files
   - .pytest_cache, .mypy_cache, .ruff_cache
   - Orphaned temporary files (*.tmp, .DS_Store)
   - Empty/dangling temp export folders
3. **NEVER Delete Source Code, Configs, or Databases**:
   - DO NOT delete .env, *.py, *.json, *.db, *.js, *.html, *.css, 
ode_modules, or data/ databases.
4. **Execution Method**:
   - Use 
un_command with clean, targeted PowerShell or Python cleanup:
     Get-ChildItem -Path . -Include __pycache__,*.pyc,.pytest_cache -Recurse -Force | Remove-Item -Recurse -Force
5. **Report Exact Actions**: List the exact items that were found and deleted. Never claim cleanup happened if no command succeeded.