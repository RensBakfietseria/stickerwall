"""Conservative, face-anchored collage cutout. Uses existing BiSeNet and AnimeGAN.

The old 0.8 drawing mask is unchanged. For color, do not flood-fill large holes
between hair and neck/clothes. A face-relative envelope limits false positives.
"""
from PIL import Image, ImageFilter
from head_mask import parse_labels, largest_component, head_classes


def collage_mask(labels, size):
    import numpy as np
    # Face, ears and features, without hair/hat. Use main face to establish scale.
    face = Image.fromarray(np.isin(labels, range(1,14)).astype("uint8")*255,"L")
    face = largest_component(face.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5)))
    box = face.getbbox()
    if not box:
        raise RuntimeError("Geen gezicht gevonden. Kies een duidelijk portret.")
    x0,y0,x1,y1=box
    fw,fh=x1-x0,y1-y0
    if fw<24 or fh<30:
        raise RuntimeError("Gezicht te klein. Zoom verder in.")
    yy,xx=np.indices(labels.shape)
    cx=(x0+x1)/2
    valid=head_classes(labels)
    # Long hair is allowed below chin, but not a shirt/neck in the center.
    envelope=(xx>=cx-1.25*fw)&(xx<=cx+1.25*fw)&(yy>=y0-0.8*fh)&(yy<=y1+1.05*fh)
    neck=(yy>y1+0.07*fh)&(abs(xx-cx)<0.22*fw)
    raw=Image.fromarray((valid & envelope & ~neck).astype("uint8")*255,"L")
    # Open narrow bridges, close only small gaps; keep the connected head.
    opened=raw.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    joined=opened.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    kept=largest_component(joined)
    # Restore nearby edge pixels, but never include explicit clothing or neck.
    expanded=kept.filter(ImageFilter.MaxFilter(5))
    final=(np.asarray(expanded)>127)&(np.asarray(raw)>127)
    # Keep tiny holes from causing noisy edges; preserve open spaces between hair.
    mask=Image.fromarray(final.astype("uint8")*255,"L").filter(ImageFilter.MedianFilter(3))
    mask=Image.fromarray(((np.asarray(mask)>127)&~np.isin(labels,[14,15,16])).astype("uint8")*255,"L")
    if not mask.getbbox() or (np.asarray(mask)[int((y0+y1)/2),int(cx)] == 0 and not np.any(final[y0:y1,x0:x1])):
        raise RuntimeError("Hoofdsegmentatie niet bruikbaar. Kadreer de foto opnieuw.")
    w,h=size
    return mask.resize(size,Image.Resampling.NEAREST), (cx*w/512,y1*h/512,fh*h/512)


def prepare_collage(source, labels):
    mask, anchor=collage_mask(labels,source.size)
    box=mask.getbbox()
    if not box:
        raise RuntimeError("Geen hoofd gevonden.")
    x0,y0,x1,y1=box
    margin=max(4,round(max(x1-x0,y1-y0)*0.07))
    box=(max(0,x0-margin),max(0,y0-margin),min(source.width,x1+margin),min(source.height,y1+margin))
    mask=mask.crop(box)
    source=source.crop(box).convert("RGB")
    white=Image.new("RGB",source.size,"white")
    isolated=Image.composite(source,white,mask)
    # Normalize tight crop for the existing cartoon model, without stretching.
    scale=min(512/source.width,512/source.height)
    target=(max(1,round(source.width*scale)),max(1,round(source.height*scale)))
    isolated=isolated.resize(target,Image.Resampling.LANCZOS)
    mask=mask.resize(target,Image.Resampling.NEAREST)
    ax,ay,fh=anchor
    return isolated,mask,{"x":(ax-box[0])/source.width,"y":(ay-box[1])/source.height,"faceHeight":fh/source.height}


def make_collectible(source, parsing_session, anime_session_factory, cartoon_image):
    labels=parse_labels(source,parsing_session)
    isolated,mask,anchor=prepare_collage(source,labels)
    color=cartoon_image(isolated,mask,anime_session_factory(),"animegan").convert("RGBA")
    color.putalpha(mask.filter(ImageFilter.GaussianBlur(0.65)))
    return color,anchor
