"""Two real OFFLINE portrait engines for the Stickerwall comparison.

Inputs are Pillow images in memory. G'MIC requires a temporary PNG; it is
written under a TemporaryDirectory that disappears after each request.
Informative Drawings uses the published 512x512 ONNX model with CPU inference.
"""
from __future__ import annotations

import io
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent
ASSETS = HERE / "assets"
MODEL = ASSETS / "opensketch_style_512x512.onnx"
GMIC_FILTER = ASSETS / "claude_lion.gmic"
GMIC_PARAMETERS = "0,0,2,1,15,15,1,0,6,2,2,0,0,0,50,50"


def find_gmic() -> str | None:
    custom = os.environ.get("STICKERWALL_GMIC", "").strip().strip('"')
    if custom:
        return custom if Path(custom).is_file() else None
    return shutil.which("gmic") or shutil.which("gmic.exe")


def readiness() -> dict:
    return {
        "gmic": {
            "ready": bool(find_gmic() and GMIC_FILTER.is_file()),
            "executable": bool(find_gmic()),
            "filter": GMIC_FILTER.is_file(),
        },
        "informative": {
            "ready": MODEL.is_file(),
            "model": MODEL.is_file(),
        },
    }


def _encode_png(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.convert("RGB").save(output, format="PNG", optimize=True)
    return output.getvalue()


def gmic_lineart(source: Image.Image) -> bytes:
    executable = find_gmic()
    if not executable:
        raise RuntimeError("G'MIC CLI ontbreekt. Installeer gmic.exe en voeg deze toe aan PATH, of zet STICKERWALL_GMIC.")
    if not GMIC_FILTER.is_file():
        raise RuntimeError("Het Claude Lion-filter ontbreekt. Voer setup.ps1 opnieuw uit.")
    with tempfile.TemporaryDirectory(prefix="stickerwall-portret-") as workspace:
        root = Path(workspace)
        original = root / "input.png"
        result = root / "result.png"
        source.convert("RGB").save(original, "PNG")
        # No shell. Only trusted local executable, pinned script and generated paths.
        command = [
            executable, str(original), "-m", str(GMIC_FILTER),
            "cl_lineart", GMIC_PARAMETERS, "output", str(result),
        ]
        try:
            proc = subprocess.run(
                command,
                capture_output=True,
                timeout=90,
                check=False,
                env={**os.environ, "GMIC_DISABLE_UPDATE": "1"},
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("G'MIC duurde langer dan 90 seconden.") from exc
        if proc.returncode or not result.is_file():
            details = proc.stderr.decode("utf-8", "replace")[-800:]
            raise RuntimeError("G'MIC kon de Line Art-filter niet uitvoeren. " + details)
        with Image.open(result) as image:
            return _encode_png(image)


_SESSION = None


def informative_drawings(source: Image.Image) -> bytes:
    global _SESSION
    if not MODEL.is_file():
        raise RuntimeError("Informative Drawings-model ontbreekt. Voer setup.ps1 opnieuw uit.")
    # No downloading packages/models inside the request handler.
    import numpy as np
    import onnxruntime as ort

    if _SESSION is None:
        options = ort.SessionOptions()
        options.intra_op_num_threads = max(1, min(4, os.cpu_count() or 1))
        _SESSION = ort.InferenceSession(
            str(MODEL), sess_options=options, providers=["CPUExecutionProvider"]
        )

    image = source.convert("RGB")
    original_size = image.size
    # Preserve face proportions; model input must be 512x512.
    scaled = ImageOps.contain(image, (512, 512), Image.Resampling.LANCZOS)
    square = Image.new("RGB", (512, 512), "white")
    left, top = (512 - scaled.width) // 2, (512 - scaled.height) // 2
    square.paste(scaled, (left, top))
    tensor = np.asarray(square, dtype=np.float32).transpose(2, 0, 1)[None, ...]
    input_name = _SESSION.get_inputs()[0].name
    output = _SESSION.run(None, {input_name: tensor})[0]
    gray = np.asarray(output).squeeze()
    if gray.ndim != 2:
        raise RuntimeError("Het ONNX-model heeft een onverwachte outputvorm.")
    gray = np.clip(gray * 255, 0, 255).astype("uint8")
    result = Image.fromarray(gray, "L")
    result = result.crop((left, top, left + scaled.width, top + scaled.height))
    result = result.resize(original_size, Image.Resampling.LANCZOS)
    return _encode_png(result)


def compare(source: Image.Image) -> dict:
    engines = [
        ("gmic", gmic_lineart),
        ("informative", informative_drawings),
    ]
    result = {}
    for key, worker in engines:
        begin = time.perf_counter()
        try:
            import base64
            png = worker(source)
            result[key] = {
                "ok": True,
                "png": base64.b64encode(png).decode("ascii"),
                "elapsed_ms": round((time.perf_counter() - begin) * 1000),
            }
        except Exception as exc:
            # Engines are isolated: one may work when the other is missing.
            result[key] = {"ok": False, "error": str(exc)}
    return result
