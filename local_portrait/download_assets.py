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
    (
        "bisenet_resnet18.onnx",
        "https://github.com/yakhyo/face-parsing/releases/download/weights/resnet18.onnx",
        "sha256:0d9bd318e46987c3bdbfacae9e2c0f461cae1c6ac6ea6d43bbe541a91727e33f",
        53205364,
    ),
    (
        "u2net_portrait.onnx",
        "https://github.com/cocoa-xu/U-2-Net/releases/download/onnx-20230530/u2net_portrait.onnx",
        "sha256:c82cb4ac797e4a2de23643b6cc7fc83aa0d4f03a9673b7cea09d2f4f623e82ca",
        176033758,
    ),
)


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def verified(data, expected, size):
    if len(data) != size:
        return False
    if expected.startswith("sha256:"):
        return hashlib.sha256(data).hexdigest() == expected[7:]
    return git_blob_sha(data) == expected


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    for filename, url, expected_sha, expected_size in ASSET_LIST:
        path = ASSETS / filename
        if path.exists() and verified(path.read_bytes(), expected_sha, expected_size):
            print(f"OK: {filename} (reeds gecontroleerd)")
            continue
        print(f"Downloaden (alleen tijdens installatie): {filename}")
        with urllib.request.urlopen(url, timeout=180) as response:
            data = response.read(expected_size + 1)
        if not verified(data, expected_sha, expected_size):
            raise SystemExit(f"Integriteitscontrole mislukt: {filename}. Bestand niet geïnstalleerd.")
        temp = path.with_suffix(".download")
        temp.write_bytes(data)
        temp.replace(path)
        print(f"OK: {filename}, {len(data) // 1024} KB, gecontroleerde bestandshash")
    print("ONNX-modellen voor Cartoonlab klaar. Nu mag internet worden uitgeschakeld.")


if __name__ == "__main__":
    main()
