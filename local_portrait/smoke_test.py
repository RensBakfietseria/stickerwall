"""Real model smoke on a public upstream sample, never on private photos."""
import base64
import io
import sys

from PIL import Image, ImageOps
from processing import compare, readiness, STYLES


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Provide the upstream public test fixture.")
    for style in STYLES:
        assert readiness()[style]["ready"], style
    with Image.open(sys.argv[1]) as fixture:
        source = ImageOps.fit(fixture.convert("RGB"),(512,576))
    outputs = compare(source)
    assert len({outputs[s].get("png") for s in STYLES}) == len(STYLES)
    for style in (*STYLES,"isolated"):
        r = outputs[style]
        assert r["ok"], (style,r.get("error"))
        with Image.open(io.BytesIO(base64.b64decode(r["png"]))) as im:
            assert im.size == source.size
            assert im.convert("L").getextrema()[0] < im.convert("L").getextrema()[1]
            if style in ("contourplus","u2net"):
                assert im.mode == "RGBA"
                assert im.getchannel("A").getextrema() == (0,255)
        print("PASS",style,r["elapsed_ms"],"ms")
    print("All five drawing variants and the isolated head executed.")


if __name__ == "__main__":
    main()
