"""Cartoonlab 0.7: reuse semantic regions for adaptive print finishing.

Only local CPU inference. One active ONNX session at a time.
No image files, subprocesses, network calls or facial identification.
"""
from __future__ import annotations
import base64
import io
import os
from pathlib import Path
import time

from PIL import Image, ImageOps

try:
    from .head_mask import isolate, apply_silhouette, normalized_tensor
except ImportError:
    from head_mask import isolate, apply_silhouette, normalized_tensor

ASSETS = Path(__file__).resolve().parent / "assets"
STYLES = ("opensketch", "contour", "anime", "contourplus", "u2net")
MODEL_PATHS = {style: ASSETS / f"{style}_style_512x512.onnx" for style in STYLES[:3]}
MODEL_PATHS["bisenet"] = ASSETS / "bisenet_resnet18.onnx"
MODEL_PATHS["u2net"] = ASSETS / "u2net_portrait.onnx"
_SESSION = None
_SESSION_STYLE = None


def readiness():
    ready = {key: {"ready": path.is_file(), "model": path.is_file()} for key, path in MODEL_PATHS.items()}
    ready["contourplus"] = {"ready": ready["bisenet"]["ready"] and ready["contour"]["ready"]}
    ready["u2net"]["ready"] = ready["u2net"]["ready"] and ready["bisenet"]["ready"]
    return ready


def _encode_png(image):
    output = io.BytesIO()
    image.convert("RGBA" if image.mode == "RGBA" else "RGB").save(output, format="PNG", optimize=True)
    return output.getvalue()


def get_session(style):
    global _SESSION, _SESSION_STYLE
    path = MODEL_PATHS[style]
    if not path.is_file():
        raise RuntimeError(f"Model {style} ontbreekt. Voer setup.ps1 uit.")
    import onnxruntime as ort
    if _SESSION_STYLE != style or _SESSION is None:
        _SESSION = None
        _SESSION_STYLE = None
        options = ort.SessionOptions()
        options.intra_op_num_threads = max(1, min(4, os.cpu_count() or 1))
        options.inter_op_num_threads = 1
        _SESSION = ort.InferenceSession(str(path), sess_options=options, providers=["CPUExecutionProvider"])
        _SESSION_STYLE = style
    return _SESSION


def square_input(source):
    scaled = ImageOps.contain(source.convert("RGB"), (512, 512), Image.Resampling.LANCZOS)
    square = Image.new("RGB", (512, 512), "white")
    left, top = (512 - scaled.width) // 2, (512 - scaled.height) // 2
    square.paste(scaled, (left, top))
    return square, (left, top, left + scaled.width, top + scaled.height)


def informative_image(source, style):
    import numpy as np
    session = get_session(style)
    square, region = square_input(source)
    tensor = np.asarray(square, dtype=np.float32).transpose(2, 0, 1)[None]
    gray = np.asarray(session.run(None, {session.get_inputs()[0].name: tensor})[0]).squeeze()
    if gray.shape != (512, 512) or not np.isfinite(gray).all():
        raise RuntimeError("Onverwachte Informative Drawings-uitvoer.")
    result = Image.fromarray(np.clip(gray * 255, 0, 255).astype("uint8"), "L")
    return result.crop(region).resize(source.size, Image.Resampling.LANCZOS)


def informative_drawings(source, style):
    return _encode_png(informative_image(source, style))


def u2net_image(source):
    """Original portrait model, not U2-Net background-removal weights."""
    import numpy as np
    session = get_session("u2net")
    square, region = square_input(source)
    tensor = normalized_tensor(square)
    gray = np.asarray(session.run([session.get_outputs()[0].name],
                                  {session.get_inputs()[0].name: tensor})[0]).squeeze()
    if gray.shape != (512, 512) or not np.isfinite(gray).all():
        raise RuntimeError("Onverwachte U2-Net Portrait-uitvoer.")
    gray = 1 - gray
    lo, hi = float(gray.min()), float(gray.max())
    if hi - lo < 1e-6:
        raise RuntimeError("U2-Net leverde geen tekening op.")
    result = Image.fromarray(np.clip((gray - lo) / (hi - lo) * 255, 0, 255).astype("uint8"), "L")
    return result.crop(region).resize(source.size, Image.Resampling.LANCZOS)


def result(worker):
    begin = time.perf_counter()
    try:
        png = worker()
        return {"ok": True, "png": base64.b64encode(png).decode("ascii"),
                "elapsed_ms": round((time.perf_counter() - begin) * 1000)}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def compare(source, include_references=True):
    outputs = {style: result(lambda s=style: informative_drawings(source, s)) for style in STYLES[:3]} if include_references else {}
    begin = time.perf_counter()
    try:
        isolated, mask, regions = isolate(source, get_session("bisenet"))
        outputs["isolated"] = {"ok": True, "png": base64.b64encode(_encode_png(isolated)).decode("ascii"),
                               "elapsed_ms": round((time.perf_counter() - begin) * 1000)}
    except Exception as exc:
        error = {"ok": False, "error": str(exc)}
        outputs.update({key: dict(error) for key in (("isolated", "contourplus", "u2net") if include_references else ("isolated", "u2net"))})
        return outputs
    outputs["regions"] = result(lambda: _encode_png(regions))
    if include_references:
        outputs["contourplus"] = result(lambda: _encode_png(apply_silhouette(informative_image(isolated, "contour"), mask)))
    outputs["u2net"] = result(lambda: _encode_png(apply_silhouette(u2net_image(isolated), mask)))
    return outputs
