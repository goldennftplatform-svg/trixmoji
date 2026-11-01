"""DEGEN pose sheet — same reference art, shifted for each NES frame."""
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(__file__))
from degen_extract import extract_degen

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
REF = ROOT + r"\assets\images\kol-fighter\characters\degen.jpg"
OUT = ROOT + r"\assets\images\kol-fighter\characters\degen-poses-preview.png"
TARGET_H = 220


def base_sprite(ref):
    stripped = extract_degen(ref)
    bbox = stripped.getbbox()
    cropped = stripped.crop(bbox) if bbox else stripped
    scale = TARGET_H / cropped.height
    tw = max(1, int(cropped.width * scale))
    return cropped.resize((tw, TARGET_H), Image.NEAREST)


def pose(sprite, kind):
    w, h = sprite.size
    pad_x = int(w * 0.35)
    pad_y = int(h * 0.2)
    sheet = Image.new("RGBA", (w + pad_x * 2, h + pad_y), (0, 0, 0, 0))
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    layer.paste(sprite, (0, 0))

    if kind == "walk1":
        layer = layer.rotate(-2, resample=Image.NEAREST, expand=True)
        sheet.paste(layer, (pad_x - 2, pad_y - 4), layer)
    elif kind == "walk2":
        layer = layer.rotate(2, resample=Image.NEAREST, expand=True)
        sheet.paste(layer, (pad_x + 3, pad_y - 2), layer)
    elif kind == "punch":
        layer = layer.rotate(-6, resample=Image.NEAREST, expand=True)
        sheet.paste(layer, (pad_x + 10, pad_y - 6), layer)
    elif kind == "kick":
        layer = layer.rotate(5, resample=Image.NEAREST, expand=True)
        sheet.paste(layer, (pad_x + 12, pad_y - 10), layer)
    elif kind == "jump":
        layer = layer.rotate(-3, resample=Image.NEAREST, expand=True)
        sheet.paste(layer, (pad_x, pad_y - 14), layer)
    elif kind == "crouch":
        squish = layer.resize((w, int(h * 0.74)), Image.NEAREST)
        sheet.paste(squish, (pad_x, pad_y + 6), squish)
    elif kind == "hit":
        layer = layer.rotate(9, resample=Image.NEAREST, expand=True)
        sheet.paste(layer, (pad_x - 12, pad_y - 8), layer)
    else:
        sheet.paste(sprite, (pad_x, pad_y), sprite)
    return sheet


def main():
    ref = Image.open(REF)
    sprite = base_sprite(ref)
    names = ["idle", "walk1", "walk2", "punch", "kick", "jump", "crouch", "hit"]
    sheet = Image.new("RGB", (920, 340), (17, 17, 17))
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 12), "DEGEN poses — same labeled reference art (NOT redrawn)", fill=(248, 216, 120))

    x = 20
    y = 50
    for i, name in enumerate(names):
        frame = pose(sprite, name)
        thumb = frame.copy()
        thumb.thumbnail((100, 200), Image.NEAREST)
        sheet.paste(thumb, (x, y), thumb)
        draw.text((x, y + 205), name.upper(), fill=(136, 255, 136))
        x += 110
        if i == 3:
            x = 20
            y = 170

    sheet.save(OUT, "PNG")
    print("Wrote", OUT)


if __name__ == "__main__":
    main()