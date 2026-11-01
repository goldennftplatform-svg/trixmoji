"""Analyze extraction issues for problem characters."""
import os
import sys

from PIL import Image

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
sys.path.insert(0, os.path.dirname(__file__))
from degen_extract import extract_character, is_edge_bg, is_matte_bg

SRC = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters")
OUT = os.path.join(ROOT, "dev", "build")

SLUGS = [
    "crypto-bitlord", "michael-saylor", "donalt", "ansem", "jimmy-edgar",
]


def gap_bright_pixels(cut, bbox):
    px = cut.load()
    w, h = cut.size
    minx, miny, maxx, maxy = bbox
    bright = 0
    matte = 0
    for y in range(miny, maxy + 1):
        for x in range(minx, maxx + 1):
            if px[x, y][3] < 128:
                continue
            rx = (x - minx) / max(1, maxx - minx)
            ry = (y - miny) / max(1, maxy - miny)
            r, g, b, a = px[x, y]
            if is_matte_bg(r, g, b):
                matte += 1
            if r > 200 and g > 200 and b > 200:
                bright += 1
            # ansem arm gap zone
            if 0.15 < rx < 0.45 and 0.35 < ry < 0.65:
                pass
    return bright, matte


def main():
    for slug in SLUGS:
        jpg = Image.open(os.path.join(SRC, slug + ".jpg"))
        cut = extract_character(jpg)
        bbox = cut.getbbox()
        png_path = os.path.join(SRC, "sprites", slug + ".png")
        png = Image.open(png_path) if os.path.exists(png_path) else None
        print(f"{slug}: src={jpg.size} cut_bbox={bbox}")
        if bbox:
            ch = bbox[3] - bbox[1] + 1
            cw = bbox[2] - bbox[0] + 1
            print(f"  cut size {cw}x{ch}, src height ratio {ch/jpg.size[1]:.2f}")
            bright, matte = gap_bright_pixels(cut, bbox)
            print(f"  bright pixels in bbox: {bright}, matte bleed: {matte}")
        if png:
            print(f"  baked png: {png.size}")
        cropped = cut.crop(bbox) if bbox else cut
        comp = Image.new("RGBA", cropped.size, (26, 26, 26, 255))
        comp.paste(cropped, (0, 0), cropped)
        comp.save(os.path.join(OUT, f"{slug}_extract_check.png"))


if __name__ == "__main__":
    main()