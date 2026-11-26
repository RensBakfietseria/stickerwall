"""Two real pretrained cartoon generators, using existing local head isolation.

Photo2Cartoon: minivision-ai, mirrored ONNX in LiteraturePro/Photo2cartoon.
AnimeGANv2: bryandlee face_paint_512_v2, Kazuhito00 ONNX conversion.
Both expect RGB NCHW float [-1,1]. We preserve the aspect ratio with white
padding, substitute BiSeNet/manual crop for upstream alignment, and retain
the original mask to prevent generated background or clothing.
"""
from PIL import Image, ImageOps

CARTOONS = ("photo2cartoon", "animegan")
SIZES = {"photo2cartoon": 256, "animegan": 512}


def cartoon_image(source, mask, session, model):
    import numpy as np
    size = SIZES[model]
    scaled = ImageOps.contain(source.convert("RGB"), (size,size), Image.Resampling.LANCZOS)
    square = Image.new("RGB",(size,size),"white")
    x,y = (size-scaled.width)//2,(size-scaled.height)//2
    square.paste(scaled,(x,y))
    tensor = (np.asarray(square,dtype=np.float32)/127.5-1).transpose(2,0,1)[None]
    output = np.asarray(session.run([session.get_outputs()[0].name],
                                    {session.get_inputs()[0].name:tensor})[0])
    if output.shape != (1,3,size,size) or not np.isfinite(output).all():
        raise RuntimeError(f"Onverwachte cartoonuitvoer: {model} {output.shape}")
    rgb = np.clip((output[0].transpose(1,2,0)+1)*127.5,0,255).astype("uint8")
    cartoon = Image.fromarray(rgb,"RGB").crop((x,y,x+scaled.width,y+scaled.height))
    cartoon = cartoon.resize(source.size,Image.Resampling.LANCZOS)
    return Image.composite(cartoon,Image.new("RGB",source.size,"white"),mask)
