"""End-to-end smoke test with a SYNTHETIC face-like drawing, no real photos.

Checks that all three actual ONNX models execute, not that portraits look good.
Requires dependencies and pinned assets downloaded by setup.
"""
import io
from pathlib import Path

from PIL import Image, ImageDraw

try:
    from .processing import compare, readiness, STYLES
except ImportError:
    from processing import compare, readiness, STYLES


def main():
    engines = readiness()
    print("Engine readiness:", engines)
    for style in STYLES:
        assert engines[style]["ready"], f"ONNX model missing: {style}"

    image = Image.new("RGB", (512, 576), "#e6dbcf")
    draw = ImageDraw.Draw(image)
    draw.ellipse((115, 45, 399, 455), outline="#29231d", width=14, fill="#ede2d4")
    draw.arc((170, 170, 230, 230), 180, 360, fill="#161616", width=9)
    draw.arc((290, 170, 350, 230), 180, 360, fill="#161616", width=9)
    draw.line((252, 230, 239, 320, 263, 315), fill="#212121", width=10)
    draw.arc((215, 315, 305, 395), 5, 165, fill="#212121", width=10)
    outputs = compare(image)
    assert len({outputs[name].get('png') for name in STYLES}) == 3, 'Models must produce independent results.'
    for name in STYLES:
        result = outputs[name]
        if not result["ok"]:
            raise AssertionError(f"{name} failed: {result['error']}")
        import base64
        decoded = base64.b64decode(result["png"])
        with Image.open(io.BytesIO(decoded)) as im:
            assert im.size == image.size, (name, im.size)
            extrema = im.convert("L").getextrema()
            assert extrema[1] > extrema[0], f"{name}: blank output {extrema}"
        print(f"PASS {name}, {result['elapsed_ms']} ms, {len(decoded)} output bytes")
    print("All three original offline models executed; actual photo-quality still requires user testing.")


if __name__ == "__main__":
    main()
