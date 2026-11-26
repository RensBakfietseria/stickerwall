import io
import tempfile
import unittest
import zipfile
from pathlib import Path

import update


def bundle(files):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        for name, data in files.items():
            archive.writestr("repo/" + name, data)
    return stream.getvalue()


class UpdateTests(unittest.TestCase):
    def test_archive_excludes_assets_and_environment(self):
        files = {path: b"source" for path in update.REQUIRED}
        files["local_portrait/assets/model.onnx"] = b"model"
        files[".local-portrait-venv/Scripts/python.exe"] = b"python"
        files["photos/portrait.png"] = b"private"
        files[".stickerwall-testset/kaal-bril.png"] = b"private"
        self.assertEqual(set(update.archive_files(bundle(files))), update.REQUIRED)

    def test_bad_archive(self):
        with self.assertRaises(ValueError):
            update.archive_files(bundle({"../outside": b"x"}))
        with self.assertRaises(ValueError):
            update.archive_files(bundle({"stickerwall.html": b"x"}))

    def test_apply_and_noop_preserve_models(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            model = root / "local_portrait/assets/model.onnx"
            model.parent.mkdir(parents=True)
            model.write_bytes(b"keep")
            calls = []
            def install(root, py, node):
                calls.append((py, node))
                (root / "dist-stickerwall").mkdir(exist_ok=True)
                (root / "dist-stickerwall/stickerwall.html").write_bytes(b"new")
            files = {"stickerwall.html": b"new", "package-lock.json": b"lock"}
            self.assertTrue(update.apply_release(root, files, "a"*40, install))
            self.assertFalse(update.apply_release(root, files, "a"*40, install))
            self.assertEqual(calls, [(False, True)])
            self.assertEqual(model.read_bytes(), b"keep")

    def test_failure_restores_source_and_dist(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "stickerwall.html").write_bytes(b"old")
            (root / "dist-stickerwall").mkdir()
            built = root / "dist-stickerwall/stickerwall.html"
            built.write_bytes(b"old build")
            def fail(root, py, node):
                built.write_bytes(b"broken")
                raise RuntimeError("test")
            with self.assertRaises(RuntimeError):
                update.apply_release(root, {"stickerwall.html": b"new", "update.cmd": b"new"}, "b"*40, fail)
            self.assertEqual((root / "stickerwall.html").read_bytes(), b"old")
            self.assertEqual(built.read_bytes(), b"old build")
            self.assertFalse((root / "update.cmd").exists())
            self.assertFalse((root / update.STATE).exists())


if __name__ == "__main__":
    unittest.main()
