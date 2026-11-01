"""Bake every DEGEN pose (R-facing) into one static PNG — no server/JS needed."""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageOps

sys.path.insert(0, os.path.dirname(__file__))
from degen_extract import extract_degen

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
REF = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters", "degen.jpg")
OUT = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters", "degen-poses-static.png")
TARGET_H = 120

BASE_POSES = [
    ("idle", "Idle"),
    ("idleBreath", "Idle (breath)"),
    ("walkForward1", "Walk Forward 1"),
    ("walkForward2", "Walk Forward 2"),
    ("walkBackward1", "Walk Backward 1"),
    ("walkBackward2", "Walk Backward 2"),
    ("crouch", "Crouch / Kneel"),
    ("jump", "Jump"),
    ("jumpPeak", "Jump Peak"),
    ("falling", "Falling"),
    ("blockHigh", "Block High"),
    ("blockLow", "Block Low"),
    ("hitStun", "Hit Stun"),
    ("crouchHitStun", "Crouch Hit Stun"),
    ("knockdown", "Knockdown"),
    ("getUp", "Get Up"),
    ("victory", "Victory"),
    ("defeat", "Defeat"),
    ("highPunch", "High Punch"),
    ("highKick", "High Kick"),
    ("lowPunch", "Low Punch"),
    ("lowKick", "Low Kick"),
    ("medPunch", "Med Punch"),
    ("medKick", "Med Kick"),
    ("special1", "Special 1"),
    ("special2", "Special 2"),
    ("throw", "Throw"),
    ("thrown", "Thrown"),
]

RECIPES = {
    "idle": {},
    "idleBreath": {"sy": 1.02, "ty": -1},
    "walkForward1": {"rot": -0.03, "tx": -2, "ty": -4},
    "walkForward2": {"rot": 0.03, "tx": 3, "ty": -2},
    "walkBackward1": {"rot": 0.04, "tx": -4, "ty": -2},
    "walkBackward2": {"rot": -0.02, "tx": 2, "ty": -3},
    "crouch": {"sy": 0.74, "ty": 6},
    "jump": {"ty": -14, "rot": -0.05},
    "jumpPeak": {"ty": -18, "rot": 0.02},
    "falling": {"ty": -8, "rot": 0.06},
    "blockHigh": {"rot": -0.04, "ty": -2, "sy": 0.98},
    "blockLow": {"sy": 0.78, "ty": 4, "rot": -0.02},
    "hitStun": {"rot": 0.16, "tx": -12, "ty": -8},
    "crouchHitStun": {"sy": 0.72, "rot": 0.12, "tx": -8, "ty": 6},
    "knockdown": {"rot": 1.15, "tx": -18, "ty": 18, "sy": 0.52},
    "getUp": {"rot": 0.28, "ty": 4, "sy": 0.86},
    "victory": {"ty": -8, "rot": -0.08, "sx": 1.05},
    "defeat": {"rot": 0.22, "ty": 12, "sy": 0.88},
    "highPunch": {"rot": -0.1, "tx": 10, "ty": -6, "sx": 1.04},
    "highKick": {"rot": 0.08, "tx": 12, "ty": -10, "sx": 1.06},
    "lowPunch": {"sy": 0.76, "tx": 8, "ty": 4, "rot": -0.05},
    "lowKick": {"sy": 0.74, "rot": 0.12, "tx": 14, "ty": 0},
    "medPunch": {"rot": -0.08, "tx": 8, "ty": -4, "sx": 1.03},
    "medKick": {"rot": 0.06, "tx": 10, "ty": -8, "sx": 1.04},
    "special1": {"rot": -0.12, "tx": 14, "ty": -8, "sx": 1.08},
    "special2": {"rot": -0.15, "tx": 16, "ty": -10, "sx": 1.1},
    "throw": {"rot": -0.06, "tx": 6, "sx": 1.02},
    "thrown": {"rot": 0.38, "tx": -16, "ty": -4},
}


def base_sprite(ref):
    stripped = extract_degen(ref)
    bbox = stripped.getbbox()
    cropped = stripped.crop(bbox) if bbox else stripped
    scale = TARGET_H / cropped.height
    tw = max(1, int(cropped.width * scale))
    return cropped.resize((tw, TARGET_H), Image.NEAREST)


def make_pose(sprite, kind):
    dw, dh = sprite.size
    pad_x = math.ceil(dw * 0.4)
    pad_y = math.ceil(dh * 0.25)
    sheet = Image.new("RGBA", (dw + pad_x * 2, dh + pad_y), (0, 0, 0, 0))
    t = RECIPES.get(kind, {})
    cx = sheet.width // 2
    feet = sheet.height - 2

    layer = Image.new("RGBA", (dw + pad_x * 2, dh + pad_y), (0, 0, 0, 0))
    temp = Image.new("RGBA", (dw, dh), (0, 0, 0, 0))
    temp.paste(sprite, (0, 0))

    sx = t.get("sx", 1)
    sy = t.get("sy", 1)
    if sx != 1 or sy != 1:
        nw = max(1, int(dw * sx))
        nh = max(1, int(dh * sy))
        temp = temp.resize((nw, nh), Image.NEAREST)
        dw, dh = nw, nh

    rot = t.get("rot", 0)
    if rot:
        temp = temp.rotate(-math.degrees(rot), resample=Image.NEAREST, expand=True)
        dw, dh = temp.size

    tx = t.get("tx", 0)
    ty = t.get("ty", 0)
    px = cx - dw // 2 + tx
    py = feet - dh + ty
    layer.paste(temp, (px, py), temp)
    return layer


def mirror(img):
    return ImageOps.mirror(img)


def main():
    ref = Image.open(REF)
    sprite = base_sprite(ref)

    cols = 4
    cell_w, cell_h = 130, 200
    rows = math.ceil(len(BASE_POSES) * 2 / cols)
    sheet = Image.new("RGB", (cols * cell_w + 40, rows * cell_h + 80), (26, 26, 26))
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 12), "DEGEN — all poses (R = facing right, L = facing left)", fill=(248, 216, 120))

    idx = 0
    for kind, label in BASE_POSES:
        for side, pose_img in (("R", make_pose(sprite, kind)), ("L", mirror(make_pose(sprite, kind)))):
            col = idx % cols
            row = idx // cols
            x = 20 + col * cell_w
            y = 50 + row * cell_h

            thumb = pose_img.copy()
            thumb.thumbnail((90, 150), Image.NEAREST)
            tx = x + (cell_w - thumb.width) // 2
            ty = y + 8
            sheet.paste(thumb, (tx, ty), thumb)
            draw.text((x + 4, y + 162), f"{label} {side}", fill=(136, 255, 136))
            idx += 1

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet.save(OUT, "PNG")
    print("Wrote", OUT, sheet.size)


if __name__ == "__main__":
    main()