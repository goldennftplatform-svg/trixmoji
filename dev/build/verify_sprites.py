"""Verify baked sprites for background bleed and full-body coverage."""
import os
import sys

from PIL import Image

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
SRC = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters", "sprites")
OUT = os.path.join(ROOT, "dev", "build")


def opaque_rows(img):
    px = img.load()
    w, h = img.size
    rows = []
    for y in range(h):
        if any(px[x, y][3] > 128 for x in range(w)):
            rows.append(y)
    return rows


def bright_in_zone(img, x0, x1, y0, y1):
    px = img.load()
    w, h = img.size
    bright = 0
    total = 0
    for y in range(int(h * y0), int(h * y1)):
        for x in range(int(w * x0), int(w * x1)):
            if px[x, y][3] < 128:
                continue
            total += 1
            r, g, b, a = px[x, y]
            if r > 210 and g > 210 and b > 210:
                bright += 1
    return bright, total


def save_check(slug):
    path = os.path.join(SRC, slug + ".png")
    img = Image.open(path).convert("RGBA")
    comp = Image.new("RGBA", img.size, (26, 26, 26, 255))
    comp.paste(img, (0, 0), img)
    comp.save(os.path.join(OUT, slug + "_verify.png"))
    return img


def main():
    checks = {
        "jimmy-edgar": ("leg gap", 0.35, 0.65, 0.45, 0.82),
        "ansem": ("left arm gap", 0.10, 0.45, 0.30, 0.65),
    }
    full_body = ["michael-saylor", "crypto-bitlord", "donalt"]

    print("=== SPRITE VERIFICATION ===")
    for slug in ["jimmy-edgar", "ansem", "michael-saylor", "crypto-bitlord", "donalt"]:
        img = save_check(slug)
        w, h = img.size
        rows = opaque_rows(img)
        top, bottom = (rows[0], rows[-1]) if rows else (0, 0)
        body_h = bottom - top + 1
        print(f"\n{slug}: {w}x{h}, opaque rows {top}-{bottom} (body_h={body_h}, fill={body_h/h:.0%})")

        # bottom 15% opaque coverage
        px = img.load()
        bottom_zone = sum(
            1 for y in range(int(h * 0.85), h) for x in range(w) if px[x, y][3] > 128
        )
        print(f"  bottom 15% opaque pixels: {bottom_zone}")

        if slug in checks:
            _, x0, x1, y0, y1 = checks[slug]
            bright, total = bright_in_zone(img, x0, x1, y0, y1)
            print(f"  {checks[slug][0]} bright pixels: {bright}/{total}")

        if slug in full_body:
            ok = body_h >= h * 0.88 and bottom_zone > 20
            print(f"  full-body check: {'PASS' if ok else 'FAIL'}")


if __name__ == "__main__":
    main()