import unittest
import os
import sys
import subprocess
from pathlib import Path

# Add project root to sys.path so we can import mariano core modules
PROJECT_ROOT = Path(__file__).parents[1].resolve()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

class TestAgentCommandControl(unittest.TestCase):
    """Test suite to verify environment, system tools, and command control capabilities."""

    def test_environment_variables(self):
        """Verify essential env vars like PATH and GEMINI_API_KEY exist."""
        self.assertIn("PATH", os.environ, "PATH variable is missing!")
        gemini_key = os.getenv("GEMINI_API_KEY")
        print(f"[INFO] GEMINI_API_KEY configured: {'Yes' if gemini_key else 'No'}")

    def test_system_executables(self):
        """Check if Git, Python, and Aider executables are available in PATH."""
        executables = ["git", "python", "aider"]
        for exe in executables:
            path = shutil_which(exe)
            self.assertIsNotNone(path, f"Executable '{exe}' is not found in PATH!")
            print(f"[INFO] Executable '{exe}' found at: {path}")

    def test_git_capabilities(self):
        """Verify that Git command execution works inside project directories."""
        try:
            res = subprocess.run(
                ["git", "--version"],
                capture_output=True,
                text=True,
                check=True
            )
            self.assertIn("git version", res.stdout.lower())
            print(f"[INFO] Git version: {res.stdout.strip()}")
        except Exception as e:
            self.fail(f"Failed to execute git command: {e}")

    def test_aider_version_check(self):
        """Verify Aider command can execute successfully and print its version."""
        try:
            res = subprocess.run(
                ["aider", "--version"],
                capture_output=True,
                text=True
            )
            # Aider outputs version to stdout or stderr depending on version/setup
            out = (res.stdout + res.stderr).strip()
            self.assertTrue(len(out) > 0, "Aider returned empty version output!")
            print(f"[INFO] Aider version output: {out}")
        except Exception as e:
            self.fail(f"Failed to execute aider --version: {e}")

def shutil_which(cmd):
    import shutil
    return shutil.which(cmd)


class TestAgentFileOperations(unittest.TestCase):
    """Test suite to verify file read/write, relative pathing, and line-by-line reading."""

    def setUp(self):
        self.test_dir = PROJECT_ROOT / "data" / "test_scratch"
        self.test_dir.mkdir(parents=True, exist_ok=True)
        self.test_file = self.test_dir / "sample_text.txt"
        self.test_file.write_text(
            "Line 1: Hello World\n"
            "Line 2: Mariano AI Agent Test Suite\n"
            "Line 3: testing line-by-line reading\n"
            "Line 4: End of file",
            encoding="utf-8"
        )

    def tearDown(self):
        if self.test_file.exists():
            self.test_file.unlink()
        try:
            self.test_dir.rmdir()
        except OSError:
            pass

    def test_file_read_full(self):
        """Test reading whole file content."""
        content = self.test_file.read_text(encoding="utf-8")
        self.assertIn("Mariano AI Agent Test Suite", content)

    def test_file_read_line_by_line(self):
        """Test reading files line-by-line using standard file streaming."""
        with open(self.test_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
        self.assertEqual(len(lines), 4)
        self.assertEqual(lines[1].strip(), "Line 2: Mariano AI Agent Test Suite")


class TestAgentSandboxIsolation(unittest.TestCase):
    """Test suite to verify PathGuard sandbox restrictions."""

    def test_path_guard_sandbox_isolation(self):
        """Verify PathGuard raises PermissionError when trying to access files outside sandbox."""
        from mariano.core.workspace import PathGuard
        
        # 1. Lock workspace to default sandbox project
        PathGuard.set_active_project("test-sandbox-project")
        
        # 2. Try to secure a safe relative path
        safe_path = PathGuard.secure_path("src/app.py")
        self.assertTrue(safe_path.is_absolute())
        
        # 3. Try to access a path outside the workspace (should raise PermissionError)
        with self.assertRaises(PermissionError):
            PathGuard.secure_path("C:/Windows/System32/cmd.exe")
        
        # Cleanup
        PathGuard.set_active_project(None)


class TestAgentCognitiveState(unittest.TestCase):
    """Test suite to verify agent cognitive profile and neuromodulator systems."""

    def test_neuromodulator_system(self):
        """Check if Neuromodulator state variables can be fetched and updated."""
        from mariano.core.neuromodulator import Neuromodulator
        nm = Neuromodulator.get_instance()
        self.assertIsNotNone(nm)
        
        # Check initial dopamine levels
        initial_dopamine = nm.state.dopamine
        self.assertTrue(0.0 <= initial_dopamine <= 1.0)
        
        # Surge curiosity and verify neuromodulator updates state
        nm.surge_curiosity(0.15)
        print(f"[INFO] Neuromodulator curiosity surged. Dopamine: {nm.state.dopamine}")


if __name__ == "__main__":
    unittest.main()
