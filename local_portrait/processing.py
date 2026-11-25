"""Informative Drawings: three original pretrained ONNX styles, offline CPU.

No G'MIC executable, external process, network or image files in this path.
Use one model session at a time to keep memory bounded on an 8 GB laptop.
"""
from __future__ import annotations

import base64
import io
import os
from pathlib import Path
import time

from PIL import Image, ImageOps

ASSETS = Path(__file__).resolve().parent / "assets"
STYLES = ("opensketch", "contour", "anime")
MODEL_PATHS = {style: ASSETS / f"{style}_style_512x512.onnx" for style in STYLES}
_SESSION = None
_SESSION_STYLE = None


def readiness() -> dict:
    return {style: {"ready": path.is_file(), "model": path.is_file()}
            for style, path in MODEL_PATHS.items()}


def _encode_png(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.convert("RGB").save(output, format="PNG", optimize=True)
    return output.getvalue()


def informative_drawings(source: Image.Image, style: str) -> bytes:
    global _SESSION, _SESSION_STYLE
    if style not in MODEL_PATHS:
        raise ValueError("Onbekende portretstijl.")
    path = MODEL_PATHS[style]
    if not path.is_file():
        raise RuntimeError(f"Model {style} ontbreekt. Voer setup.ps1 uit.")
    import numpy as np
    import onnxruntime as ort

    if _SESSION_STYLE != style or _SESSION is None:
        _SESSION = None
        _SESSION_STYLE = None
        options = ort.SessionOptions()
        options.intra_op_num_threads = max(1, min(4, os.cpu_count() or 1))
        _SESSION = ort.InferenceSession(
            str(path), sess_options=options, providers=["CPUExecutionProvider"]
        )
        _SESSION_STYLE = style

    # Same RGB 0..255 NCHW preprocessing as the published ONNX conversion.
    # Preserve the input aspect ratio with white padding, then remove padding.
    image = source.convert("RGB")
    original_size = image.size
    scaled = ImageOps.contain(image, (512, 512), Image.Resampling.LANCZOS)
    square = Image.new("RGB", (512, 512), "white")
    left, top = (512 - scaled.width) // 2, (512 - scaled.height) // 2
    square.paste(scaled, (left, top))
    tensor = np.asarray(square, dtype=np.float32).transpose(2, 0, 1)[None, ...]
    output = _SESSION.run(None, {_SESSION.get_inputs()[0].name: tensor})[0]
    gray = np.asarray(output).squeeze()
    if gray.shape != (512, 512) or not np.isfinite(gray).all():
        raise RuntimeError("Het ONNX-model heeft een onverwachte output.")
    gray = np.clip(gray * 255, 0, 255).astype("uint8")
    result = Image.fromarray(gray, "L")
    result = result.crop((left, top, left + scaled.width, top + scaled.height))
    return _encode_png(result.resize(original_size, Image.Resampling.LANCZOS))


def compare(source: Image.Image) -> dict:
    result = {}
    for style in STYLES:
        begin = time.perf_counter()
        try:
            png = informative_drawings(source, style)
            result[style] = {
                "ok": True,
                "png": base64.b64encode(png).decode("ascii"),
                "elapsed_ms": round((time.perf_counter() - begin) * 1000),
            }
        except Exception as exc:
            # One missing or failing model must not hide the other results.
            result[style] = {"ok": False, "error": str(exc)}
    return result
