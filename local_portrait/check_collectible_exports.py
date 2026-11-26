"""CI-only independent validation of PNG density, PDF dimensions and image streams."""
import sys
from pathlib import Path
from PIL import Image
from pypdf import PdfReader

root=Path(sys.argv[1])
for filename,size in [("trading-front",(744,1039)),("trading-back",(744,1039)),("postcard-front",(1181,1772))]:
    with Image.open(root/f"sticky-wall-{filename}.png") as im:
        assert im.size==size,(filename,im.size)
        assert all(abs(n-300)<.1 for n in im.info["dpi"]), im.info
        im.verify()
for filename,mm,size in [
    ("trading-voor-en-achter",(63,88),(744,1039)),
    ("postcard-voor-en-achter",(100,150),(1181,1772)),
    ("trading-A4",(210,297),(2480,3508)),
    ("postcard-A4",(210,297),(2480,3508))
]:
    pdf=PdfReader(root/f"sticky-wall-{filename}.pdf")
    assert len(pdf.pages)==2
    for page in pdf.pages:
        assert abs(float(page.mediabox.width)*25.4/72-mm[0])<.001
        assert abs(float(page.mediabox.height)*25.4/72-mm[1])<.001
        image=page["/Resources"]["/XObject"]["/Im"].get_object()
        assert (image["/Width"],image["/Height"])==size
        assert len(image.get_data())==size[0]*size[1]*3
print("PASS: PNG 300 ppi, exact two-page card/A4 media boxes, lossless RGB streams.")
