import tempfile
import unittest
from pathlib import Path
from PIL import Image
import testset


class TestSetTests(unittest.TestCase):
    def test_explicit_crops_persist_replace_and_remove(self):
        with tempfile.TemporaryDirectory() as work:
            root=Path(work)/".stickerwall-testset"
            self.assertIsNone(testset.read("kaal-bril",root))
            testset.save("kaal-bril",Image.new("RGB",(512,576),"red"),root)
            self.assertTrue(testset.read("kaal-bril",root).startswith(b"\x89PNG"))
            testset.save("kaal-bril",Image.new("RGB",(512,576),"blue"),root)
            with Image.open(root/"kaal-bril.png") as im:
                self.assertEqual(im.getpixel((0,0)),(0,0,255))
            self.assertIsNone(testset.read("lang-haar",root))
            testset.remove("kaal-bril",root)
            self.assertIsNone(testset.read("kaal-bril",root))
            with self.assertRaises(ValueError):
                testset.save("../x",Image.new("RGB",(512,576)),root)
            with self.assertRaises(ValueError):
                testset.save("krullen",Image.new("RGB",(500,500)),root)
