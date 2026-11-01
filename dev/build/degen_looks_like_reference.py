"""DEGEN preview — playable sprite must look like the labeled reference image."""
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(__file__))
from degen_extract import extract_character

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
REF = ROOT + r"\assets\images\kol-fighter\characters\degen.jpg"
OUT = ROOT + r"\assets\images\kol-fighter\characters\degen-looks-like-reference.png"
W, H = 640, 360
GROUND = 268


def draw_stage(img):
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, W, H], fill=(192, 176, 208))
    draw.rectangle([0, 10, W, 11], fill=(24, 24, 24))
    draw.rectangle([0, 12, W, 15], fill=(216, 48, 48))
    draw.rectangle([0, 16, W, 18], fill=(240, 216, 160))
    draw.rectangle([0, 19, W, 21], fill=(216, 48, 48))
    px = W // 2 - 6
    draw.rectangle([px, 0, px + 11, 21], fill=(24, 24, 24))
    draw.rectangle([0, GROUND, W, H - 14], fill=(184, 136, 80))
    draw.rectangle([0, GROUND, W, GROUND + 1], fill=(24, 24, 24))
    y = H - 14
    draw.rectangle([0, y, W, y + 12], fill=(216, 48, 48))


def main():
    ref = Image.open(REF)
    ref_thumb = ref.copy()
    ref_thumb.thumbnail((220, 300), Image.NEAREST)

    stripped = extract_character(ref)
    bbox = stripped.getbbox()
    cropped = stripped.crop(bbox) if bbox else stripped
    target_h = 220
    scale = target_h / cropped.height
    tw = max(1, int(cropped.width * scale))
    sprite = cropped.resize((tw, target_h), Image.NEAREST)

    sheet = Image.new("RGB", (900, 420), (17, 17, 17))
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 12), "DEGEN = your labeled reference image (NOT redrawn)", fill=(248, 216, 120))

    sheet.paste(ref_thumb.convert("RGB"), (20, 40))
    draw.text((20, 350), "YOUR DEGEN.jpg", fill=(136, 255, 136))

    stage = Image.new("RGB", (W, H))
    draw_stage(stage)
    stage.paste(sprite, (W // 2 - tw // 2, GROUND - target_h), sprite)
    sheet.paste(stage, (260, 40))
    draw.text((480, 350), "IN-GAME — same art", fill=(136, 255, 136))

    sheet.save(OUT, "PNG")
    print("Wrote", OUT)


if __name__ == "__main__":
    main()