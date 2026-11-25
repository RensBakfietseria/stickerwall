"""ONE-TIME online setup: pinned and integrity-checked third-party assets.

Never imported by the local photo server or browser.
Model/code are not committed to the Stickerwall repository.
"""
from __future__ import annotations

import hashlib
from pathlib import Path
import urllib.request

HERE = Path(__file__).resolve().parent
ASSETS = HERE / "assets"

ASSET_LIST = (
    (
        "opensketch_style_512x512.onnx",
        "https://raw.githubusercontent.com/Kazuhito00/Informative-Drawings-ONNX-Sample/541eb96e237d1f68fc68b4219958347c84b6dd2f/model/opensketch_style_512x512.onnx",
        "0a93ec290a23ab6c3c045541366e51eb8e05aeab",
        17925367,
    ),
    (
        "contour_style_512x512.onnx",
        "https://raw.githubusercontent.com/Kazuhito00/Informative-Drawings-ONNX-Sample/541eb96e237d1f68fc68b4219958347c84b6dd2f/model/contour_style_512x512.onnx",
        "32699e18159e104abbf794377d168cdbd72e2a16",
        17925367,
    ),
    (
        "anime_style_512x512.onnx",
        "https://raw.githubusercontent.com/Kazuhito00/Informative-Drawings-ONNX-Sample/541eb96e237d1f68fc68b4219958347c84b6dd2f/model/anime_style_512x512.onnx",
        "5bb3c667c13aabb18dccf82efdf2dfbe0f9f755e",
        17925367,
    ),
)


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    for filename, url, expected_sha, expected_size in ASSET_LIST:
        path = ASSETS / filename
        if path.exists() and git_blob_sha(path.read_bytes()) == expected_sha:
            print(f"OK: {filename} (reeds gecontroleerd)")
            continue
        print(f"Downloaden (alleen tijdens installatie): {filename}")
        with urllib.request.urlopen(url, timeout=90) as response:
            data = response.read(expected_size + 1)
        if len(data) != expected_size or git_blob_sha(data) != expected_sha:
            raise SystemExit(f"Integriteitscontrole mislukt: {filename}. Bestand niet geïnstalleerd.")
        temp = path.with_suffix(".download")
        temp.write_bytes(data)
        temp.replace(path)
        print(f"OK: {filename}, {len(data) // 1024} KB, gecontroleerde Git SHA")
    print("Drie ONNX-modellen klaar. Nu mag internet worden uitgeschakeld.")


if __name__ == "__main__":
    main()
