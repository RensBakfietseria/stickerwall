import unittest
from unittest.mock import patch
import numpy as np
from PIL import Image
from cartoon import cartoon_image
import processing


class CartoonTests(unittest.TestCase):
    def test_normalization_and_padding(self):
        class IO:
            name="image"
        class Fake:
            def get_inputs(self):return [IO()]
            def get_outputs(self):return [IO()]
            def run(self,names,feed):
                value=feed["image"]
                assert value.shape==(1,3,256,256)
                assert value.min()>=-1 and value.max()<=1
                return [value]
        source=Image.new("RGB",(512,576),"red")
        mask=Image.new("L",source.size,255)
        mask.paste(0,(0,0,10,10))
        result=cartoon_image(source,mask,Fake(),"photo2cartoon")
        self.assertEqual(result.size,source.size)
        self.assertEqual(result.getpixel((0,0)),(255,255,255))
        self.assertEqual(result.getpixel((200,200)),(255,0,0))

    def test_cartoon_routes_fail_independently(self):
        source=Image.new("RGB",(512,576),"red")
        mask=Image.new("L",source.size,255)
        with patch.object(processing,"get_session",return_value=object()), \
             patch.object(processing,"isolate",return_value=(source,mask,Image.new("RGB",source.size))), \
             patch.object(processing,"u2net_image",return_value=source), \
             patch.object(processing,"cartoon_image",side_effect=[RuntimeError("test"),source]):
            result=processing.compare(source,include_references=False,include_cartoons=True)
        self.assertTrue(result["u2net"]["ok"])
        self.assertFalse(result["photo2cartoon"]["ok"])
        self.assertTrue(result["animegan_u2"]["ok"])
        self.assertTrue(result["animegan_direct"]["ok"])
