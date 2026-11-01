"""Bake transparent character sprites from labeled JPGs — no backgrounds."""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from degen_extract import extract_character

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
SRC = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters")
OUT = os.path.join(SRC, "sprites")

SLUGS = [
    "degen", "ansem", "jason-williams", "dogedesigner", "roger-ver", "bitboy",
    "jimmy-edgar", "michael-saylor", "crypto-bitlord", "donalt", "vitalik-buterin", "pauly0x",
]

HEIGHTS = {"degen": 220}
DEFAULT_H = 140


def bake_one(slug):
    jpg = os.path.join(SRC, slug + ".jpg")
    if not os.path.exists(jpg):
        print("SKIP missing", jpg)
        return False
    ref = Image.open(jpg)
    cut = extract_character(ref)
    bbox = cut.getbbox()
    if not bbox:
        print("SKIP empty", slug)
        return False
    cropped = cut.crop(bbox)
    target_h = HEIGHTS.get(slug, DEFAULT_H)
    scale = target_h / cropped.height
    tw = max(1, int(cropped.width * scale))
    sprite = cropped.resize((tw, target_h), Image.NEAREST)
    png = os.path.join(OUT, slug + ".png")
    sprite.save(png, "PNG")
    print("Wrote", png, sprite.size)
    return True


def main():
    os.makedirs(OUT, exist_ok=True)
    ok = 0
    for slug in SLUGS:
        if bake_one(slug):
            ok += 1
    print(f"Done: {ok}/{len(SLUGS)} sprites")


if __name__ == "__main__":
    main()