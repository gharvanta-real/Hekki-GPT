# ERROR RECOVERY & AUTO-HEALING LOOP

When any script, command, or tool call fails:
FAIL -> Read traceback -> Identify root cause -> Fix code/command -> Re-run -> Repeat until PASS

## Common Auto-Fixes:
- ModuleNotFoundError: Run pip install <pkg> via 
un_command then retry.
- FileNotFoundError: Search directory, locate path, correct and retry.
- SyntaxError / IndentationError: Fix syntax and re-execute.
- ConnectionError / 403 / WAF: Auto-escalate through bypass ladder (rotate headers, Wayback Machine, Google Scholar mirror).
- Retry up to **5 times** before reporting a genuine blocker.