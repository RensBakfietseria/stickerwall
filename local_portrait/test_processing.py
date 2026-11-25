"""Tests for local comparison contracts; no model downloads or private photos."""
import io
import hashlib
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

try:
    from . import processing, server
    from .download_assets import git_blob_sha, ASSET_LIST
except ImportError:
    import processing
    import server
    from download_assets import git_blob_sha, ASSET_LIST


class ProcessingTests(unittest.TestCase):
    def setUp(self):
        self.image = Image.new("RGB", (512, 576), (220, 210, 200))

    def test_png_encoding(self):
        with Image.open(io.BytesIO(processing._encode_png(self.image))) as im:
            self.assertEqual(im.size, self.image.size)

    def test_style_ids_and_separate_pinned_assets(self):
        self.assertEqual(processing.STYLES, ("opensketch", "contour", "anime"))
        self.assertEqual(len({entry[2] for entry in ASSET_LIST}), 3)
        self.assertEqual({entry[0] for entry in ASSET_LIST},
                         {p.name for p in processing.MODEL_PATHS.values()})

    def test_each_model_is_invoked_and_errors_independent(self):
        def fake(source, style):
            self.assertIs(source, self.image)
            if style == "contour":
                raise RuntimeError("model ontbreekt")
            return processing._encode_png(source)
        with patch.object(processing, "informative_drawings", side_effect=fake) as run:
            results = processing.compare(self.image)
            self.assertEqual([x.args[1] for x in run.call_args_list], list(processing.STYLES))
            self.assertTrue(results["opensketch"]["ok"])
            self.assertTrue(results["anime"]["ok"])
            self.assertFalse(results["contour"]["ok"])

    def test_git_blob_sha(self):
        self.assertEqual(git_blob_sha(b"hello"), hashlib.sha1(b"blob 5\x00hello").hexdigest())

    def test_no_hidden_remote_entrypoint(self):
        code = Path(server.__file__).read_text(encoding="utf-8")
        engine = Path(processing.__file__).read_text(encoding="utf-8")
        self.assertNotIn("urllib.request", code)
        self.assertNotIn("urllib.request", engine)
        self.assertNotIn("subprocess", engine)
        self.assertIn('HOST = "127.0.0.1"', code)


if __name__ == "__main__":
    unittest.main()
