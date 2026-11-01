"""NES Kung Fu style confirmation — limbs animate, body anchored (not whole sprite lunging)."""
from collections import deque
from math import cos, sin, pi

from PIL import Image, ImageDraw, ImageFont

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
OUT = ROOT + r"\assets\images\kol-fighter\kungfu-style-confirm.png"
BG_PATH = ROOT + r"\assets\images\kol-fighter\screens\dogedesigner.jpg"
DEGEN = ROOT + r"\assets\images\kol-fighter\characters\degen.jpg"
DOGE = ROOT + r"\assets\images\kol-fighter\characters\dogedesigner.jpg"
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


def sample(img, x, y):
    x = max(0, min(img.width - 1, int(x)))
    y = max(0, min(img.height - 1, int(y)))
    return img.getpixel((x, y))[:3]


def limb(draw, ox, oy, length, thick, angle, color, flip=1):
    dx = sin(angle) * length * flip
    dy = -cos(angle) * length
    x2 = ox + dx
    y2 = oy + dy
    draw.line([(ox, oy), (x2, y2)], fill=color, width=thick)
    hw = thick // 2
    draw.ellipse([x2 - hw, y2 - hw, x2 + hw, y2 + hw], fill=color, outline=(0, 0, 0))


def draw_nes_ref(draw, ox, oy, label, pose):
    s = 3
    colors = {"body": (40, 40, 160), "skin": (240, 200, 160), "pants": (200, 40, 40)}
    bx, by = ox, oy + 40
    draw.text((ox - 18, oy - 14), label, fill=(255, 255, 100))
    if pose == "idle":
        bl, fl, ba, fa = 0.55, -0.45, -2.35, -2.0
    elif pose == "punch":
        bl, fl, ba, fa = 0.5, -0.35, -2.3, -0.05
    elif pose == "kick":
        bl, fl, ba, fa = 0.45, -0.8, -2.4, -2.2
    else:
        bl, fl, ba, fa = 0.75, -0.2, -2.1, -2.4
    for side, ang, col in ((-8 * s, bl, colors["pants"]), (8 * s, fl, colors["pants"])):
        limb(draw, bx + side, by, 14 * s, 4, ang, col)
    draw.rectangle([bx - 6 * s, by - 22 * s, bx + 6 * s, by - 4 * s], fill=colors["body"])
    draw.rectangle([bx - 5 * s, by - 32 * s, bx + 5 * s, by - 22 * s], fill=colors["skin"])
    for side, ang in ((-7 * s, ba), (7 * s, fa)):
        limb(draw, bx + side, by - 18 * s, 11 * s, 3, ang, colors["skin"])


def draw_kungfu_fighter(frame, img, cx, feet, pose_name, facing=1, th=120):
    w, h = img.size
    head_h = int(h * 0.3)
    torso_y = int(h * 0.24)
    torso_h = int(h * 0.34)
    skin = sample(img, w * 0.55, h * 0.18)
    top = sample(img, w * 0.5, h * 0.42)
    pants = sample(img, w * 0.45, h * 0.68)
    shoe = sample(img, w * 0.5, h * 0.9)

    poses = {
        "idle": (0.55, -0.45, -2.35, -2.0, 0),
        "walk": (0.2, 0.65, -2.0, -2.5, 0),
        "punch": (0.5, -0.35, -2.3, -0.05, 0),
        "kick": (0.45, -0.8, -2.4, -2.2, 0),
    }
    bl, fl, ba, fa, body_y = poses[pose_name]
    S = th / 96
    hip = feet - int(body_y * S)
    shoulder = hip - int(22 * S)
    draw = ImageDraw.Draw(frame)

    def L(ox, oy, length, thick, angle, color):
        flip = facing
        dx = sin(angle) * length * S * flip
        dy = -cos(angle) * length * S
        x2 = cx + ox * S * flip + dx
        y2 = hip + oy * S + dy
        x1 = cx + ox * S * flip
        y1 = hip + oy * S
        draw.line([(x1, y1), (x2, y2)], fill=color, width=max(2, int(thick * S)))
        hw = max(2, int(thick * S // 2))
        draw.ellipse([x2 - hw, y2 - hw, x2 + hw, y2 + hw], fill=color, outline=(0, 0, 0))

    L(-6, -20, 16, 6, bl, pants)
    L(6, -22, 12, 5, ba, skin)
    torso = img.crop((0, torso_y, w, torso_y + torso_h)).resize(
        (max(1, int(30 * S)), max(1, int(torso_h * 30 * S / (head_h + torso_h)))), Image.NEAREST
    )
    head = img.crop((0, 0, w, head_h)).resize(
        (max(1, int(28 * S)), max(1, int(head_h * 28 * S / (head_h + torso_h)))), Image.NEAREST
    )
    tw, th_t = torso.size
    hw, hh = head.size
    frame.paste(torso, (int(cx - tw / 2), int(hip - th_t - 8 * S)), torso)
    frame.paste(head, (int(cx - hw / 2), int(hip - th_t - hh - 10 * S)), head)
    L(6, -20, 16, 6, fl, pants)
    L(-6, -22, 12, 5, fa, skin)


def scrub_bg(frame, bg):
    top_y, floor_y, src_x, src_w = 54, 248, 300, 40
    bg_h, floor_h = floor_y - top_y, GROUND + 48 - floor_y
    mid = bg.crop((src_x, top_y, src_x + src_w, top_y + bg_h))
    floor = bg.crop((src_x, floor_y, src_x + src_w, floor_y + floor_h))
    frame.paste(mid.resize((src_x, bg_h), Image.NEAREST), (0, top_y))
    frame.paste(mid.resize((src_x, bg_h), Image.NEAREST), (W - src_x, top_y))
    frame.paste(floor.resize((src_x, floor_h), Image.NEAREST), (0, floor_y))
    frame.paste(floor.resize((src_x, floor_h), Image.NEAREST), (W - src_x, floor_y))


def main():
    bg = Image.open(BG_PATH).convert("RGBA").resize((W, H), Image.NEAREST)
    degen = strip_bg(Image.open(DEGEN))
    doge = strip_bg(Image.open(DOGE))

    frame = bg.copy()
    scrub_bg(frame, bg)
    draw = ImageDraw.Draw(frame)

    draw.rectangle([0, 0, W, 36], fill=(0, 0, 0, 180))
    draw.text((12, 8), "NES KUNG FU STYLE: feet anchored — arms/legs animate (NOT whole image lunging)", fill=(255, 255, 80))
    draw.text((12, 22), "Reference (1985)          DEGEN poses from your labeled art", fill=(180, 220, 255))

    nes_poses = [("IDLE", "idle"), ("PUNCH", "punch"), ("KICK", "kick")]
    for i, (label, pose) in enumerate(nes_poses):
        draw_nes_ref(draw, 36 + i * 56, 48, label, pose)

    labels = ["IDLE", "WALK", "PUNCH", "KICK"]
    poses = ["idle", "walk", "punch", "kick"]
    for i, (label, pose) in enumerate(zip(labels, poses)):
        x = 210 + i * 100
        draw.text((x - 16, 46), label, fill=(255, 255, 255))
        draw_kungfu_fighter(frame, degen, x, GROUND, pose, facing=1, th=108)

    draw.text((12, 168), "DOGEDESIGNER — same rig (your labeled sprite, limbs move independently)", fill=(180, 220, 255))
    for i, (label, pose) in enumerate(zip(labels, poses)):
        x = 90 + i * 130
        draw.text((x - 20, 182), label, fill=(255, 255, 255))
        draw_kungfu_fighter(frame, doge, x, GROUND + 8, pose, facing=1, th=100)

    draw.rectangle([0, GROUND + 42, W, H], fill=(0, 0, 0, 140))
    draw.text(
        (16, GROUND + 52),
        "Whole JPG sliding toward opponent = WRONG  |  Kung Fu = body stays put, punch arm / kick leg extends",
        fill=(0, 255, 100),
    )

    frame.convert("RGB").save(OUT, "PNG")
    print("Wrote", OUT)


if __name__ == "__main__":
    main()