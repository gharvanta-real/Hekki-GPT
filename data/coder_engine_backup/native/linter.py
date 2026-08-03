"""
linter.py — Pre-flight syntax validation before writing files to disk.
Under 80 lines.
"""

from __future__ import annotations
import ast
import logging
from typing import Optional

logger = logging.getLogger("Hekki.Linter")


def validate_python_syntax(code: str) -> Optional[str]:
    """Validates Python syntax using Python's built-in ast.parse."""
    try:
        ast.parse(code)
        return None
    except SyntaxError as e:
        return f"SyntaxError at line {e.lineno}, col {e.offset}: {e.msg}"


def validate_json_syntax(code: str) -> Optional[str]:
    """Validates JSON syntax."""
    import json
    try:
        json.loads(code)
        return None
    except Exception as e:
        return f"JSONParseError: {e}"


def check_code_syntax(file_path: str, code_content: str) -> tuple[bool, str]:
    """
    Main pre-flight linter entry point.
    Returns (is_valid: bool, error_message: str).
    """
    ext = file_path.lower().split(".")[-1] if "." in file_path else ""

    if ext == "py":
        err = validate_python_syntax(code_content)
        if err:
            return False, f"Python Linter Error in {file_path}: {err}"
    elif ext == "json":
        err = validate_json_syntax(code_content)
        if err:
            return False, f"JSON Linter Error in {file_path}: {err}"

    # Basic unclosed quote / brace check for JS/HTML/CSS
    if ext in ("js", "ts", "jsx", "tsx", "html", "css"):
        if code_content.count("{") != code_content.count("}"):
            return True, "Warning: Mismatched curly braces detected"
        if code_content.count("(") != code_content.count(")"):
            return True, "Warning: Mismatched parentheses detected"

    return True, "Syntax OK"
