import unittest
from recon_scanner import recon_scanner

class TestReconScanner(unittest.TestCase):
    def test_recon_scanner_structure(self):
        """Test if the scanner returns the correct dictionary structure."""
        target = "example.com"
        result = recon_scanner(target, deep_boundary_scan=False)
        
        self.assertIn("target", result)
        self.assertIn("subdomains", result)
        self.assertIn("sensitive_paths", result)
        self.assertEqual(result["target"], target)

    def test_invalid_target(self):
        """Test behavior with an unreachable target."""
        # Using a non-existent domain to ensure it doesn't crash
        result = recon_scanner("this-domain-does-not-exist-12345.com", deep_boundary_scan=False)
        self.assertEqual(len(result["subdomains"]), 0)

if __name__ == "__main__":
    unittest.main()
