"""Run with python -m unittest discover -s local_portrait -p 'test_*.py'."""
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

try:
    from . import processing, server
    from .download_assets import git_blob_sha
except ImportError:
    import processing
    import server
    from download_assets import git_blob_sha


class ProcessingTests(unittest.TestCase):
    def setUp(self):
        self.image = Image.new("RGB", (512, 576), (220, 210, 200))

    def test_png_encoding(self):
        data = processing._encode_png(self.image)
        self.assertTrue(data.startswith(b"\x89PNG\r\n\x1a\n"))
        with Image.open(io.BytesIO(data)) as decoded:
            self.assertEqual(decoded.size, (512, 576))

    def test_gmic_missing_reports_failure_without_fallback_filter(self):
        with patch.object(processing, "find_gmic", return_value=None):
            results = processing.compare(self.image)
            self.assertFalse(results["gmic"]["ok"])
            self.assertIn("G'MIC CLI ontbreekt", results["gmic"]["error"])

    def test_git_blob_sha(self):
        import hashlib
        data = b"hello"
        self.assertEqual(
            git_blob_sha(data),
            hashlib.sha1(b"blob 5\x00hello").hexdigest(),
        )

    def test_no_hidden_remote_entrypoint(self):
        source = Path(server.__file__).read_text(encoding="utf-8")
        self.assertNotIn("urllib.request", source)
        self.assertNotIn("http.client", source)
        self.assertIn('HOST = "127.0.0.1"', source)

    def test_independent_engine_results(self):
        with patch.object(processing, "gmic_lineart", return_value=processing._encode_png(self.image)), \
             patch.object(processing, "informative_drawings", side_effect=RuntimeError("model ontbreekt")):
            result = processing.compare(self.image)
            self.assertTrue(result["gmic"]["ok"])
            self.assertFalse(result["informative"]["ok"])


if __name__ == "__main__":
    unittest.main()
