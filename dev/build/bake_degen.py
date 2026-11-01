"""Bake DEGEN sprite — original JPG, white hoodie + DEGEN text."""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from degen_extract import extract_degen

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
JPG = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters", "degen.jpg")
OUT = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters", "sprites", "degen.png")
CHECK = os.path.join(ROOT, "dev", "build", "degen-cutout-check.png")
TARGET_H = 220


def main():
    ref = Image.open(JPG)
    cropped = extract_degen(ref)
    bbox = cropped.getbbox()
    if not bbox:
        raise SystemExit("DEGEN extraction failed — empty bbox")
    cropped = cropped.crop(bbox)
    scale = TARGET_H / cropped.height
    tw = max(1, int(cropped.width * scale))
    sprite = cropped.resize((tw, TARGET_H), Image.NEAREST)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sprite.save(OUT, "PNG")

    comp = Image.new("RGBA", sprite.size, (26, 26, 26, 255))
    comp.paste(sprite, (0, 0), sprite)
    comp.save(CHECK, "PNG")
    print(f"Wrote {OUT} {sprite.size}")
    print(f"Check {CHECK}")


if __name__ == "__main__":
    main()