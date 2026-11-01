"""Bake 8-bit NES preview from reference character photos."""
from collections import deque
from math import sin, cos, pi

from PIL import Image, ImageDraw

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
OUT = ROOT + r"\assets\images\kol-fighter\nes-8bit-game-preview.png"
DEGEN = ROOT + r"\assets\images\kol-fighter\characters\degen.jpg"
DOGE = ROOT + r"\assets\images\kol-fighter\characters\dogedesigner.jpg"
W, H = 640, 360
GROUND = 268


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
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                q.append((nx, ny))
    return rgba


def nes_q(n):
    return min(255, round(n / 51) * 51)


def to_nes_sprite(img, tw, th, ox_off=0):
    bbox = img.getbbox()
    if not bbox:
        return Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    cropped = img.crop(bbox)
    cw, ch = cropped.size
    scale = min(tw / cw, th / ch)
    dw, dh = max(1, int(cw * scale)), max(1, int(ch * scale))
    ox = (tw - dw) // 2 + ox_off
    oy = th - dh
    small = cropped.resize((dw, dh), Image.NEAREST)
    out = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    out.paste(small, (ox, oy), small)
    px = out.load()
    for y in range(th):
        for x in range(tw):
            r, g, b, a = px[x, y]
            if a < 20:
                continue
            px[x, y] = (nes_q(r), nes_q(g), nes_q(b), 255)
    return out


def draw_stage(draw):
    wall = (192, 176, 208)
    draw.rectangle([0, 0, W, H], fill=wall)
    draw.rectangle([0, 10, W, 11], fill=(24, 24, 24))
    draw.rectangle([0, 12, W, 15], fill=(216, 48, 48))
    draw.rectangle([0, 16, W, 18], fill=(240, 216, 160))
    draw.rectangle([0, 19, W, 21], fill=(216, 48, 48))
    px = W // 2 - 6
    draw.rectangle([px, 0, px + 11, 21], fill=(24, 24, 24))
    draw.rectangle([px, 0, px + 11, 2], fill=(216, 48, 48))
    draw.rectangle([0, GROUND, W, H - 14], fill=(184, 136, 80))
    draw.rectangle([0, GROUND, W, GROUND + 1], fill=(24, 24, 24))
    y = H - 14
    draw.rectangle([0, y, W, y + 12], fill=(216, 48, 48))
    for x in range(0, W, 16):
        draw.rectangle([x, y + 2, x + 7, y + 3], fill=(240, 216, 160))
        draw.rectangle([x + 8, y + 6, x + 15, y + 7], fill=(240, 216, 160))


def paste_scaled(frame, spr, cx, feet, scale=3):
    sw, sh = spr.size
    spr2 = spr.resize((sw * scale, sh * scale), Image.NEAREST)
    frame.paste(spr2, (cx - spr2.width // 2, feet - spr2.height), spr2)


def main():
    degen = strip_bg(Image.open(DEGEN))
    doge = strip_bg(Image.open(DOGE))

    kick = to_nes_sprite(degen, 42, 46)
    kpx = kick.load()
    pants = kpx[15, 38][:3]
    for x in range(18, 40):
        for y in range(34, 38):
            kpx[x, y] = pants + (255,)

    idle_cpu = to_nes_sprite(doge, 30, 46)

    frame = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(frame)
    draw_stage(draw)

    draw.rectangle([0, 22, W, 36], fill=(0, 0, 0))
    draw.text((8, 24), "1P DEGEN", fill=(252, 252, 252))
    draw.text((W - 120, 24), "CPU DOGEDESIGNER", fill=(252, 252, 252))
    draw.rectangle([40, 26, 140, 30], fill=(184, 56, 0))
    draw.rectangle([40, 26, 120, 30], fill=(252, 152, 56))
    draw.text((W // 2 - 20, 24), "R1 0-0", fill=(248, 216, 120))

    frame = frame.convert("RGBA")
    paste_scaled(frame, kick, 200, GROUND, 3)
    paste_scaled(frame, idle_cpu, 460, GROUND, 3)
    frame = frame.convert("RGB")

    draw = ImageDraw.Draw(frame)
    draw.text((8, 8), "8-BIT NES KUNG FU — your character photos downscaled to sprite frames", fill=(255, 255, 100))

    frame.save(OUT, "PNG")
    print("Wrote", OUT)


if __name__ == "__main__":
    main()