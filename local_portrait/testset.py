"""Explicit developer test set only. No ordinary visitor portraits saved.
Store exactly three fixed, normalized PNG crops outside source and web root.
"""
from pathlib import Path
import io
import os
import tempfile

from PIL import Image

SLOTS = ("kaal-bril","lang-haar","krullen")
ROOT = Path(__file__).resolve().parents[1] / ".stickerwall-testset"


def slot_path(slot, root=None):
    if slot not in SLOTS:
        raise ValueError("Onbekend testportret")
    root = Path(root) if root is not None else ROOT
    if root.is_symlink():
        raise ValueError("Onveilige testmap")
    path = root / (slot + ".png")
    if path.is_symlink():
        raise ValueError("Onveilig testbestand")
    return path


def save(slot, image, root=None):
    path = slot_path(slot,root)
    if image.size != (512,576):
        raise ValueError("Bewaar een uitsnede van 512 × 576 pixels.")
    path.parent.mkdir(parents=True,exist_ok=True)
    # Strip original filename, metadata and EXIF. Only the exact crop is retained.
    out = io.BytesIO()
    image.convert("RGB").save(out,format="PNG",optimize=True)
    fd,name=tempfile.mkstemp(prefix=".crop-",dir=path.parent)
    try:
        with os.fdopen(fd,"wb") as stream:
            stream.write(out.getvalue())
        Path(name).replace(path)
    finally:
        Path(name).unlink(missing_ok=True)


def read(slot, root=None):
    path=slot_path(slot,root)
    return path.read_bytes() if path.is_file() else None


def remove(slot, root=None):
    slot_path(slot,root).unlink(missing_ok=True)
