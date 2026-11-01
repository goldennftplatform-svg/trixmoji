"""Gameplay preview — labeled character sprites on fight-screen background."""
from collections import deque

from PIL import Image

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
BG = ROOT + r"\assets\images\kol-fighter\screens\dogedesigner.jpg"
P1 = ROOT + r"\assets\images\kol-fighter\characters\degen.jpg"
P2 = ROOT + r"\assets\images\kol-fighter\characters\dogedesigner.jpg"
OUT = ROOT + r"\assets\images\kol-fighter\gameplay-preview.png"
W, H = 640, 360
GROUND = 292


def is_bg(r, g, b):
    if r > 248 and g > 248 and b > 248:
        return True
    if 118 <= r <= 205 and abs(r - g) < 10 and abs(g - b) < 10:
        return True
    return False


def strip_bg(img):
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    seen = set()
    q = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if (x, y) in seen:
            continue
        seen.add((x, y))
        r, g, b, a = px[x, y]
        if not is_bg(r, g, b):
            continue
        px[x, y] = (r, g, b, 0)
        if x:
            q.append((x - 1, y))
        if x + 1 < w:
            q.append((x + 1, y))
        if y:
            q.append((x, y - 1))
        if y + 1 < h:
            q.append((x, y + 1))
    return rgba


frame = Image.open(BG).convert("RGBA").resize((W, H), Image.NEAREST)
top_y, floor_y, src_x, src_w = 54, 248, 300, 40
bg_h, floor_h = floor_y - top_y, GROUND + 48 - floor_y
mid = frame.crop((src_x, top_y, src_x + src_w, top_y + bg_h))
floor = frame.crop((src_x, floor_y, src_x + src_w, floor_y + floor_h))
frame.paste(mid.resize((src_x, bg_h), Image.NEAREST), (0, top_y))
frame.paste(mid.resize((src_x, bg_h), Image.NEAREST), (W - src_x, top_y))
frame.paste(floor.resize((src_x, floor_h), Image.NEAREST), (0, floor_y))
frame.paste(floor.resize((src_x, floor_h), Image.NEAREST), (W - src_x, floor_y))
degen = strip_bg(Image.open(P1))
doge = strip_bg(Image.open(P2))

for spr, cx, th in ((degen, 168, 132), (doge, 472, 130)):
    scale = th / spr.height
    tw, th2 = max(1, int(spr.width * scale)), max(1, int(th))
    s = spr.resize((tw, th2), Image.NEAREST)
    frame.paste(s, (cx - tw // 2, GROUND - th2), s)

frame.convert("RGB").save(OUT, "PNG")
print("Wrote", OUT)