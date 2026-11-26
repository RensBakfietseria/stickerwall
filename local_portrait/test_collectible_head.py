import unittest
import numpy as np
from PIL import Image
from collectible_head import collage_mask,prepare_collage

class CollageTests(unittest.TestCase):
    def test_long_hair_and_clothing(self):
        labels=np.zeros((512,512),dtype=np.uint8)
        labels[100:260,190:322]=1
        labels[70:100,170:342]=17
        labels[90:365,158:190]=17
        labels[90:365,322:354]=17
        labels[260:365,190:322]=14
        labels[365:450,140:370]=16
        labels[420:455,350:400]=17
        mask,anchor=collage_mask(labels,(512,512))
        self.assertEqual(mask.getpixel((170,330)),255)
        self.assertEqual(mask.getpixel((250,330)),0)
        self.assertEqual(mask.getpixel((370,430)),0)
        self.assertEqual(mask.getpixel((250,390)),0)
        im,m,a=prepare_collage(Image.new("RGB",(512,512),"red"),labels)
        self.assertEqual(im.size,m.size)
        self.assertEqual(max(im.size),512)
        self.assertTrue(0<a["x"]<1 and 0<a["y"]<1)
    def test_no_face(self):
        with self.assertRaises(RuntimeError):
            collage_mask(np.zeros((512,512),dtype=np.uint8),(512,512))
