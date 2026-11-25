"""Local model contracts and head-mask tests."""
import hashlib
import io
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image

import processing
import server
from download_assets import git_blob_sha, ASSET_LIST, verified
from head_mask import build_mask, head_classes, apply_silhouette


class ProcessingTests(unittest.TestCase):
    def setUp(self):
        self.image = Image.new("RGB", (512, 576), (220, 210, 200))

    def test_png_encoding(self):
        with Image.open(io.BytesIO(processing._encode_png(self.image))) as im:
            self.assertEqual(im.size, self.image.size)

    def test_assets(self):
        self.assertEqual(len({entry[2] for entry in ASSET_LIST}), 5)
        self.assertEqual({entry[0] for entry in ASSET_LIST},
                         {p.name for p in processing.MODEL_PATHS.values()})

    def test_failed_segmentation_does_not_break_original_models(self):
        with patch.object(processing, "informative_drawings", return_value=processing._encode_png(self.image)), \
             patch.object(processing, "get_session", side_effect=RuntimeError("model ontbreekt")):
            results = processing.compare(self.image)
        self.assertTrue(results["contour"]["ok"])
        self.assertFalse(results["contourplus"]["ok"])
        self.assertFalse(results["u2net"]["ok"])

    def test_focus_runs_only_one_u2_inference(self):
        with patch.object(processing, "get_session", return_value=object()), \
             patch.object(processing, "isolate", return_value=(self.image, Image.new("L", self.image.size, 255))), \
             patch.object(processing, "u2net_image", return_value=self.image) as u2, \
             patch.object(processing, "informative_image") as refs:
            outputs = processing.compare(self.image, include_references=False)
        self.assertEqual(set(outputs), {"isolated", "u2net"})
        self.assertTrue(outputs["u2net"]["ok"])
        u2.assert_called_once()
        refs.assert_not_called()

    def test_label_mapping(self):
        self.assertEqual(head_classes(np.arange(19)).tolist(),
                         [False] + [True]*13 + [False]*3 + [True]*2)

    def test_mask_removes_background_neck_clothes_and_fills_holes(self):
        labels = np.zeros((160, 160), dtype=np.uint8)
        labels[15:100, 40:120] = 1
        labels[15:32, 40:120] = 17
        labels[50:55, 70:75] = 0
        labels[100:125, 65:95] = 14
        labels[125:, 20:140] = 16
        labels[2:4, 2:4] = 17
        mask = build_mask(labels, (160, 160))
        self.assertEqual(mask.getpixel((72,52)),255)
        self.assertEqual(mask.getpixel((80,110)),0)
        self.assertEqual(mask.getpixel((80,140)),0)
        self.assertEqual(mask.getpixel((3,3)),0)
        out = apply_silhouette(Image.new("L", mask.size, 255),mask)
        self.assertEqual(out.getpixel((0,0))[3],0)
        self.assertEqual(out.getpixel((80,70)),(255,255,255,255))
        self.assertEqual(out.getpixel((41,60)),(0,0,0,255))

    def test_invalid_mask_fails(self):
        with self.assertRaises(RuntimeError):
            build_mask(np.zeros((100,100),dtype=np.uint8),(100,100))

    def test_hash(self):
        data=b"hello"
        self.assertEqual(git_blob_sha(data),hashlib.sha1(b"blob 5\x00hello").hexdigest())
        self.assertTrue(verified(data,"sha256:"+hashlib.sha256(data).hexdigest(),5))
        self.assertFalse(verified(data,"sha256:"+"0"*64,5))

    def test_no_network_in_processing(self):
        for module in (processing,server):
            self.assertNotIn("urllib.request",Path(module.__file__).read_text(encoding="utf-8"))
        self.assertIn('HOST = "127.0.0.1"',Path(server.__file__).read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
