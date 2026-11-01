"""Slice DEGEN Grok sprite sheet into individual pose PNGs."""
import os
import shutil

from PIL import Image, ImageOps

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
OUT_DIR = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters", "degen", "poses")
SHEET = r"C:\Users\franc\Downloads\6wCcI (1).jpg"
REF_COPY = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters", "degen", "sprite-sheet.jpg")
TARGET_H = 140

GRID = {
    (0, 0): "idle-r",
    (0, 1): "idle-l",
    (0, 2): "walk-forward-1-r",
    (0, 3): "walk-forward-1-l",
    (0, 4): "crouch-r",
    (0, 5): "crouch-l",
    (1, 0): "high-punch-r",
    (1, 1): "high-punch-l",
    (1, 2): "high-kick-r",
    (1, 3): "high-kick-l",
    (1, 4): "med-punch-r",
    (1, 5): "med-kick-l",
    (2, 0): "block-high-r",
    (2, 1): "block-high-l",
    (2, 2): "block-low-r",
    (2, 3): "block-low-l",
    (2, 4): "low-punch-r",
    (2, 5): "jump-l",
    (3, 0): "low-kick-r",
    (3, 1): "special-1-r",
    (3, 2): "special-1-l",
    (3, 3): "jump-r",
    (3, 4): "jump-peak-r",
    (3, 5): "falling-l",
}

FALLBACK = {
    "idle-breath-r": "idle-r",
    "idle-breath-l": "idle-l",
    "walk-forward-2-r": "walk-forward-1-r",
    "walk-forward-2-l": "walk-forward-1-l",
    "walk-backward-1-r": "walk-forward-1-l",
    "walk-backward-1-l": "walk-forward-1-r",
    "walk-backward-2-r": "walk-forward-1-l",
    "walk-backward-2-l": "walk-forward-1-r",
    "jump-peak-l": "jump-l",
    "falling-r": "jump-r",
    "med-punch-l": "high-punch-l",
    "med-kick-r": "high-kick-r",
    "low-punch-l": "high-punch-l",
    "low-kick-l": "high-kick-l",
    "special-2-r": "special-1-r",
    "special-2-l": "special-1-l",
    "hit-stun-r": "idle-r",
    "hit-stun-l": "idle-l",
    "crouch-hit-stun-r": "crouch-r",
    "crouch-hit-stun-l": "crouch-l",
    "knockdown-r": "crouch-r",
    "knockdown-l": "crouch-l",
    "get-up-r": "crouch-r",
    "get-up-l": "crouch-l",
    "victory-r": "idle-r",
    "victory-l": "idle-l",
    "defeat-r": "idle-r",
    "defeat-l": "idle-l",
    "throw-r": "high-punch-r",
    "throw-l": "high-punch-l",
    "thrown-r": "hit-stun-r",
    "thrown-l": "hit-stun-l",
}


def is_bg(r, g, b):
    spread = max(r, g, b) - min(r, g, b)
    avg = (r + g + b) / 3
    return spread < 40 and avg > 175


def is_sprite_pixel(r, g, b):
    if is_bg(r, g, b):
        return False
    avg = (r + g + b) / 3
    mx = max(r, g, b)
    if mx < 70 and avg < 85:
        return False
    return True


def mask_cell(cell):
    rgba = cell.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    opaque = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not is_sprite_pixel(r, g, b):
                px[x, y] = (0, 0, 0, 0)
            else:
                opaque[y][x] = True
    return rgba, opaque


def sprite_bbox(opaque, skip_top_frac=0.30):
    w = len(opaque[0])
    h = len(opaque)
    y0 = int(h * skip_top_frac)
    min_x, min_y, max_x, max_y = w, h, -1, -1
    count = 0
    for y in range(y0, h):
        for x in range(w):
            if not opaque[y][x]:
                continue
            count += 1
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)
    if max_x < min_x or count < 200:
        return None
    bh = max_y - min_y + 1
    bw = max_x - min_x + 1
    if bh < 40 or bh < bw * 0.45:
        return None
    return (min_x, min_y, max_x + 1, max_y + 1)


def extract_cell(cell):
    rgba, opaque = mask_cell(cell)
    blob = sprite_bbox(opaque)
    if not blob:
        return None
    min_x, min_y, max_x, max_y = blob
    bw, bh = max_x - min_x, max_y - min_y
    if bw < 8 or bh < 12:
        return None
    # ignore tiny text-only blobs
    if bh < 25 and bw > bh * 3:
        return None
    pad = 3
    min_x = max(0, min_x - pad)
    min_y = max(0, min_y - pad)
    max_x = min(rgba.width, max_x + pad)
    max_y = min(rgba.height, max_y + pad)
    cropped = rgba.crop((min_x, min_y, max_x, max_y))
    scale = TARGET_H / cropped.height
    nw = max(1, int(cropped.width * scale))
    return cropped.resize((nw, TARGET_H), Image.NEAREST)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    sheet = Image.open(SHEET)
    sheet.save(REF_COPY, "JPEG", quality=95)

    cols, rows = 6, 4
    cw, ch = sheet.width // cols, sheet.height // rows
    margin_x = int(cw * 0.06)
    margin_top = int(ch * 0.18)

    for (row, col), name in GRID.items():
        x0 = col * cw + margin_x
        y0 = row * ch + margin_top
        x1 = (col + 1) * cw - margin_x
        y1 = (row + 1) * ch - int(ch * 0.06)
        cell = sheet.crop((x0, y0, x1, y1))
        sprite = extract_cell(cell)
        if not sprite:
            print("SKIP", name)
            continue
        sprite.save(os.path.join(OUT_DIR, name + ".png"), "PNG")
        print("OK", name, sprite.size)

    wf_l = os.path.join(OUT_DIR, "walk-forward-1-l.png")
    wf_r = os.path.join(OUT_DIR, "walk-forward-1-r.png")
    if not os.path.isfile(wf_l) and os.path.isfile(wf_r):
        ImageOps.mirror(Image.open(wf_r)).save(wf_l, "PNG")
        print("MIRROR walk-forward-1-l")

    for dest, src in FALLBACK.items():
        sp = os.path.join(OUT_DIR, src + ".png")
        dp = os.path.join(OUT_DIR, dest + ".png")
        if os.path.isfile(sp):
            shutil.copy2(sp, dp)

    ir = os.path.join(OUT_DIR, "idle-r.png")
    if os.path.isfile(ir):
        shutil.copy2(ir, os.path.join(OUT_DIR, "idle.png"))

    print("Done:", len(os.listdir(OUT_DIR)), "files")


if __name__ == "__main__":
    main()