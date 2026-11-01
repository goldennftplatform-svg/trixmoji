"""NES Kung Fu gameplay preview — reference-based pixel fighters on blue stage."""
from collections import deque
from math import cos, sin, pi

from PIL import Image, ImageDraw, ImageFont

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
OUT = ROOT + r"\assets\images\kol-fighter\kungfu-gameplay-preview.png"
CHARS = [
    (ROOT + r"\assets\images\kol-fighter\characters\degen.jpg", "DEGEN", 140),
    (ROOT + r"\assets\images\kol-fighter\characters\dogedesigner.jpg", "DOGE", 470),
]
W, H = 640, 360
GROUND = 288


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


def nes(rgb):
    return tuple(min(255, round(c / 51) * 51) for c in rgb[:3])


def sample(img, rx, ry):
    w, h = img.size
    return nes(img.getpixel((int(w * rx), int(h * ry))))


def draw_stage(draw):
    for y in range(0, GROUND + 18, 4):
        c = (32, 88, 216) if (y // 4) % 2 else (28, 92, 255)
        draw.rectangle([0, y, W, y + 3], fill=c)
    draw.rectangle([0, GROUND + 18, W, GROUND + 28], fill=(200, 120, 24))
    draw.rectangle([0, GROUND + 28, W, H], fill=(160, 96, 16))
    draw.rectangle([24, GROUND - 60, 42, GROUND], fill=(48, 80, 168), outline=(16, 32, 96))
    draw.rectangle([W - 42, GROUND - 60, W - 24, GROUND], fill=(48, 80, 168), outline=(16, 32, 96))


def draw_nes_fighter(draw, img, cx, feet, pose, label):
    skin = sample(img, 0.52, 0.17)
    top = sample(img, 0.5, 0.4)
    pants = sample(img, 0.46, 0.7)
    shoe = sample(img, 0.5, 0.92)
    S = 4

    poses = {
        "idle": (0.5, -0.4, -2.4, -1.9),
        "punch": (0.45, -0.3, -2.35, -0.05),
        "kick": (0.4, -0.78, -2.5, -2.3),
    }
    bl, fl, ba, fa = poses[pose]

    def limb(ox, oy, length, thick, angle, color):
        dx = sin(angle) * length * S
        dy = -cos(angle) * length * S
        x1, y1 = cx + ox * S, feet + oy * S
        x2, y2 = x1 + dx, y1 + dy
        draw.line([(x1, y1), (x2, y2)], fill=color, width=thick)

    hip, shoulder = feet - 14 * S, feet - 15 * S
    limb(-4 * S, -14 * S, 11, 3, bl, pants)
    draw.rectangle([cx - 5 * S, feet - 26 * S, cx - 1 * S, feet - 23 * S], fill=shoe)
    limb(4 * S, -15 * S, 8, 3, ba, skin)
    draw.rectangle([cx - 7 * S, feet - 16 * S, cx + 7 * S, feet - 4 * S], fill=top, outline=(0, 0, 0))
    draw.rectangle([cx - 5 * S, feet - 26 * S, cx + 5 * S, feet - 18 * S], fill=skin, outline=(0, 0, 0))
    limb(4 * S, -14 * S, 11, 3, fl, pants)
    draw.rectangle([cx + 1 * S, feet - 26 * S, cx + 5 * S, feet - 23 * S], fill=shoe)
    limb(-4 * S, -15 * S, 8, 3, fa, skin)
    draw.text((cx - 24, feet - 54 * S), label, fill=(252, 252, 252))


def main():
    frame = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(frame)
    draw_stage(draw)

    draw.rectangle([0, 0, W, 22], fill=(0, 0, 0))
    draw.text((12, 4), "1P", fill=(252, 252, 252))
    draw.text((W - 36, 4), "CPU", fill=(252, 252, 252))
    draw.text((W // 2 - 10, 4), "99", fill=(248, 216, 120))
    draw.rectangle([28, 4, 148, 10], fill=(184, 56, 0))
    draw.rectangle([28, 4, 130, 10], fill=(252, 152, 56))
    draw.rectangle([W - 148, 4, W - 28, 10], fill=(184, 56, 0))
    draw.rectangle([W - 138, 4, W - 28, 10], fill=(252, 152, 56))

    degen = strip_bg(Image.open(CHARS[0][0]))
    doge = strip_bg(Image.open(CHARS[1][0]))
    draw_nes_fighter(draw, degen, CHARS[0][2], GROUND, "punch", "DEGEN")
    draw_nes_fighter(draw, doge, CHARS[1][2], GROUND, "kick", "DOGEDESIGNER")

    draw.rectangle([0, 24, W, 52], fill=(0, 0, 0))
    draw.text((12, 28), "NES KUNG FU (1985) — gameplay + graphics", fill=(255, 255, 120))
    draw.text((12, 40), "Characters styled from your labeled reference photos (colors + traits)", fill=(180, 220, 255))

    frame.save(OUT, "PNG")
    print("Wrote", OUT)


if __name__ == "__main__":
    main()