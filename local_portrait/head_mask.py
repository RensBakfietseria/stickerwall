"""BiSeNet head-only mask. Local, no identification, storage or network.

Label ordering from yakhyo/face-parsing utils/prepare_labels.py:
0 background, 1..13 face/features/ears, 14 neck, 15 necklace,
16 clothing, 17 hair, 18 hat. Preserve the head and glasses.
"""
from __future__ import annotations

from collections import deque

from PIL import Image, ImageDraw, ImageFilter, ImageOps


def normalized_tensor(image, size=512):
    import numpy as np
    pixels = np.asarray(image.convert("RGB").resize((size, size), Image.Resampling.BILINEAR), dtype=np.float32) / 255
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    return ((pixels - mean) / std).transpose(2, 0, 1)[None].astype(np.float32)


def head_classes(labels):
    import numpy as np
    return np.isin(labels, [*range(1, 14), 17, 18])


def largest_component(mask):
    """Keep the largest connected region at half resolution; remove stray specks."""
    import numpy as np
    w, h = mask.size
    small = mask.resize((max(1, w // 2), max(1, h // 2)), Image.Resampling.NEAREST)
    sw, sh = small.size
    grid = bytearray(1 if v else 0 for v in small.tobytes())
    best = []
    for start in range(len(grid)):
        if not grid[start]:
            continue
        grid[start] = 0
        queue = deque([start])
        pixels = []
        while queue:
            i = queue.popleft()
            pixels.append(i)
            x = i % sw
            for n in (i - 1 if x else -1, i + 1 if x < sw - 1 else -1,
                      i - sw if i >= sw else -1, i + sw if i < sw * (sh - 1) else -1):
                if n >= 0 and grid[n]:
                    grid[n] = 0
                    queue.append(n)
        if len(pixels) > len(best):
            best = pixels
    clean = np.zeros(sw * sh, dtype=np.uint8)
    clean[best] = 255
    return Image.fromarray(clean.reshape(sh, sw), "L").resize((w, h), Image.Resampling.NEAREST)


def build_mask(labels, size):
    import numpy as np
    if labels.ndim != 2 or labels.min() < 0 or labels.max() > 18:
        raise ValueError("Ongeldig gezichtsegmentatiemasker")
    mask = Image.fromarray(head_classes(labels).astype(np.uint8) * 255, "L")
    mask = mask.resize(size, Image.Resampling.NEAREST)
    # Close narrow gaps before selecting the head and filling enclosed holes.
    mask = mask.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))
    mask = largest_component(mask)
    padded = ImageOps.expand(mask, border=1, fill=0)
    ImageDraw.floodfill(padded, (0, 0), 128)
    filled = np.asarray(padded.crop((1, 1, size[0] + 1, size[1] + 1)))
    mask = Image.fromarray(np.where(filled == 128, 0, 255).astype(np.uint8), "L")
    mask = mask.filter(ImageFilter.MedianFilter(5))
    coverage = float(np.asarray(mask).mean() / 255)
    if not 0.025 <= coverage <= 0.96:
        raise RuntimeError("Geen bruikbaar hoofd gevonden. Kies een frontaal portret met het volledige hoofd in beeld.")
    return mask


def finishing_regions(labels, mask):
    """RGB diagnostic: red hair/hat, green facial features, blue silhouette edge.
    Regions are derived from the same semantic inference; no identity analysis.
    Unclassified areas retain the ordinary Sticker treatment.
    """
    import numpy as np
    size = mask.size
    inside = np.asarray(mask) > 127
    hair = Image.fromarray(np.isin(labels, [17, 18]).astype(np.uint8)*255, "L")
    hair = hair.resize(size, Image.Resampling.NEAREST)
    hair = np.asarray(hair) > 127
    # Brows, eyes, glasses, nose, mouth and lips, with a small local margin.
    features = Image.fromarray(np.isin(labels, [2,3,4,5,6,10,11,12,13]).astype(np.uint8)*255, "L")
    features = features.resize(size, Image.Resampling.NEAREST).filter(ImageFilter.MaxFilter(13))
    detail = (np.asarray(features) > 127) & ~hair
    edge = inside & ~(np.asarray(mask.filter(ImageFilter.MinFilter(9))) > 127)
    return Image.fromarray(np.stack([hair & inside, detail & inside, edge], axis=-1).astype(np.uint8)*255, "RGB")


def parse_labels(source, session):
    import numpy as np
    tensor = normalized_tensor(source)
    output = np.asarray(session.run([session.get_outputs()[0].name],
                                  {session.get_inputs()[0].name: tensor})[0])
    if output.shape != (1, 19, 512, 512) or not np.isfinite(output).all():
        raise RuntimeError("Onverwachte BiSeNet-uitvoer.")
    return output[0].argmax(axis=0)


def isolate(source, session):
    labels = parse_labels(source, session)
    mask = build_mask(labels, source.size)
    white = Image.new("RGB", source.size, "white")
    return Image.composite(source.convert("RGB"), white, mask), mask, finishing_regions(labels, mask)


def apply_silhouette(drawing, mask, outline=True):
    """Clip drawing to head, add controlled inner outline, retain alpha for sticker."""
    import numpy as np
    gray = drawing.convert("L").resize(mask.size, Image.Resampling.LANCZOS)
    inside = np.asarray(mask) > 127
    values = np.asarray(gray).copy()
    values[~inside] = 255
    if outline:
        inner = np.asarray(mask.filter(ImageFilter.MinFilter(7))) > 127
        values[inside & ~inner] = 0
    result = Image.fromarray(values, "L").convert("RGBA")
    result.putalpha(mask)
    return result
