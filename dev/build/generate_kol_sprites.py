"""Generate original NES-style KOL fighter sprites — inspired by references, not cutouts."""
import os
from PIL import Image, ImageDraw

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
SPRITE_DIR = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters", "sprites")

W, H = 32, 48          # logical NES grid
SCALE = 3              # 96 x 144 native pixels
DISPLAY_H = 140
HEIGHTS = {"degen": 220, "pauly0x": 160}
BLK = (0, 0, 0)


def canvas():
    return Image.new("RGBA", (W * SCALE, H * SCALE), (0, 0, 0, 0))


def P(x, y):
    """Logical coord -> pixel coord (top-left of cell)."""
    return x * SCALE, y * SCALE


def R(d, x, y, w, h, fill, outline=BLK):
    x0, y0 = P(x, y)
    d.rectangle([x0, y0, x0 + w * SCALE - 1, y0 + h * SCALE - 1], fill=fill, outline=outline)


def fighter(d, skin, hair_c, top, pants, shoes, **kw):
    stance = kw.get("stance", 1)
    o = BLK

    # legs + shoes
    R(d, 9 + stance, 34, 5, 10, pants, o)
    R(d, 17 - stance, 34, 5, 10, pants, o)
    R(d, 8 + stance, 43, 7, 2, shoes)
    R(d, 16 - stance, 43, 7, 2, shoes)

    # belt
    R(d, 10, 32, 12, 2, (40, 30, 20), o)
    R(d, 14, 32, 4, 2, (210, 170, 60))

    # torso
    R(d, 10, 18, 12, 15, top, o)

    if kw.get("tie"):
        R(d, 14, 19, 2, 12, kw["tie"])
    if kw.get("zipper"):
        for zy in range(19, 31):
            R(d, 15, zy, 1, 1, (210, 190, 80))
    for bx, by, bw, bh, bc in kw.get("logos", []):
        R(d, bx, by, bw, bh, bc, o)
    for bx, by, bw, bh, bc in kw.get("patches", []):
        R(d, bx, by, bw, bh, bc, o)
    for by in kw.get("buttons", []):
        R(d, 15, by, 1, 1, (200, 50, 50))

    # arms
    R(d, 5, 20, 4, 8, top, o)
    R(d, 6, 28, 3, 3, skin, o)
    R(d, 23, 18, 4, 7, top, o)
    R(d, 24, 25, 3, 3, skin, o)

    if kw.get("bottle"):
        R(d, 2, 20, 3, 10, (130, 85, 40), o)
        R(d, 2, 18, 3, 2, (230, 210, 90))
    if kw.get("wave"):
        R(d, 24, 14, 3, 5, skin, o)

    # headwear
    if kw.get("hat"):
        R(d, 9, 6, 14, 3, kw["hat"], o)
        R(d, 10, 9, 12, 1, kw["hat"])
    if kw.get("crown"):
        R(d, 10, 5, 12, 2, (220, 180, 50), o)
        x0, y0 = P(12, 5)
        d.polygon([(x0, y0), (x0 + SCALE, y0 - SCALE * 2), (x0 + SCALE * 2, y0)], fill=(220, 180, 50))
        x0, y0 = P(16, 5)
        d.polygon([(x0, y0), (x0 + SCALE, y0 - SCALE * 3), (x0 + SCALE * 2, y0)], fill=(220, 180, 50))
    if kw.get("food"):
        for fx, fy, fc in [(11, 3, (60, 140, 60)), (15, 2, (200, 70, 50)), (13, 1, (230, 200, 80))]:
            R(d, fx, fy, 2, 2, fc)

    if kw.get("dog"):
        R(d, 9, 10, 14, 8, hair_c, o)
        R(d, 8, 9, 4, 4, hair_c, o)
        R(d, 20, 9, 4, 4, hair_c, o)
        R(d, 12, 13, 2, 2, (255, 255, 255))
        R(d, 17, 13, 2, 2, (255, 255, 255))
        R(d, 13, 14, 1, 1, o)
        R(d, 18, 14, 1, 1, o)
        R(d, 14, 16, 3, 1, o)
        if kw.get("hat"):
            R(d, 8, 7, 16, 2, kw["hat"], o)
    else:
        R(d, 11, 10, 10, 8, skin, o)
        R(d, 10, 7, 12, 4, hair_c, o)
        if kw.get("beard"):
            R(d, 11, 15, 10, 3, hair_c)
        if kw.get("shades"):
            R(d, 12, 12, 8, 2, (15, 15, 15))
            R(d, 13, 12, 2, 1, (50, 50, 50))
            R(d, 17, 12, 2, 1, (50, 50, 50))
        else:
            R(d, 13, 12, 2, 2, (255, 255, 255))
            R(d, 17, 12, 2, 2, (255, 255, 255))
            R(d, 14, 13, 1, 1, o)
            R(d, 18, 13, 1, 1, o)
            R(d, 15, 15, 2, 1, o)

    if kw.get("fur"):
        R(d, 8, 17, 3, 4, (245, 245, 240), o)
        R(d, 21, 17, 3, 4, (245, 245, 240), o)
        R(d, 9, 18, 1, 1, (120, 50, 150))
        R(d, 22, 18, 1, 1, (120, 50, 150))
    if kw.get("cape"):
        R(d, 21, 18, 3, 16, (100, 40, 140), o)
    if kw.get("eth"):
        x0, y0 = P(14, 20)
        d.polygon([(x0 + SCALE, y0), (x0, y0 + SCALE * 3), (x0 + SCALE * 2, y0 + SCALE * 6),
                   (x0 + SCALE * 4, y0 + SCALE * 3)], fill=(80, 130, 255), outline=(140, 180, 255))


SPECS = {
    "degen": dict(skin=(235, 195, 150), hair_c=(120, 80, 50), top=(248, 248, 242),
                 pants=(55, 75, 150), shoes=(25, 25, 30), shades=True, stance=1,
                 logos=[(11, 22, 10, 2, (20, 20, 20))]),
    "ansem": dict(skin=(125, 82, 52), hair_c=(18, 18, 28), top=(18, 18, 28),
                  pants=(72, 78, 92), shoes=(92, 58, 34), shades=True, zipper=True, stance=2),
    "jason-williams": dict(skin=(198, 140, 90), hair_c=(92, 58, 28), top=(92, 58, 28),
                           pants=(92, 58, 28), shoes=(72, 48, 28), hat=(92, 58, 28), stance=1,
                           logos=[(12, 20, 8, 6, (32, 42, 88))]),
    "dogedesigner": dict(skin=(210, 175, 120), hair_c=(148, 98, 48), top=(210, 175, 120),
                         pants=(108, 78, 48), shoes=(88, 58, 32), dog=True, hat=(148, 98, 48),
                         logos=[(14, 20, 2, 3, (245, 245, 240))], stance=1),
    "roger-ver": dict(skin=(232, 190, 140), hair_c=(28, 22, 18), top=(36, 52, 110),
                      pants=(36, 52, 110), shoes=(88, 58, 32), beard=True, stance=2,
                      patches=[(11, 21, 2, 2, (220, 60, 40))],
                      logos=[(11, 24, 10, 1, (220, 180, 50)), (11, 26, 10, 1, (220, 180, 50))]),
    "bitboy": dict(skin=(232, 190, 140), hair_c=(18, 14, 10), top=(32, 42, 96),
                   pants=(32, 42, 96), shoes=(25, 25, 30), beard=True, stance=2,
                   buttons=[20, 22, 24, 26]),
    "jimmy-edgar": dict(skin=(198, 140, 90), hair_c=(0, 0, 0), top=(28, 38, 82),
                        pants=(28, 38, 82), shoes=(245, 245, 240), zipper=True, stance=1,
                        logos=[(12, 20, 8, 6, (15, 15, 15))]),
    "michael-saylor": dict(skin=(232, 190, 140), hair_c=(80, 80, 88), top=(28, 38, 100),
                           pants=(28, 38, 100), shoes=(25, 25, 30), tie=(200, 40, 40), stance=2),
    "crypto-bitlord": dict(skin=(198, 140, 90), hair_c=(24, 28, 72), top=(24, 28, 72),
                          pants=(24, 28, 72), shoes=(24, 28, 72), crown=True, fur=True,
                          cape=True, stance=2, logos=[(11, 19, 10, 8, (110, 48, 140))]),
    "donalt": dict(skin=(232, 190, 140), hair_c=(140, 145, 155), top=(28, 38, 88),
                   pants=(36, 48, 100), shoes=(25, 25, 30), zipper=True, stance=2,
                   patches=[(11, 21, 3, 2, (40, 80, 180)), (17, 21, 3, 2, (40, 80, 180))]),
    "vitalik-buterin": dict(skin=(232, 190, 140), hair_c=(22, 18, 16), top=(16, 16, 22),
                            pants=(48, 52, 68), shoes=(25, 25, 30), eth=True, stance=1),
    "pauly0x": dict(skin=(198, 140, 90), hair_c=(40, 28, 18), top=(248, 248, 242),
                    pants=(55, 75, 150), shoes=(92, 58, 32), hat=(200, 40, 40),
                    food=True, bottle=True, wave=True, beard=True, stance=2,
                    logos=[(10, 22, 12, 2, (200, 40, 40)), (12, 25, 8, 2, (200, 40, 40))]),
}


def save_sprite(img, slug):
    bbox = img.getbbox()
    if not bbox:
        return None
    cropped = img.crop(bbox)
    th = HEIGHTS.get(slug, DISPLAY_H)
    tw = max(1, int(cropped.width * th / cropped.height))
    baked = cropped.resize((tw, th), Image.NEAREST)
    path = os.path.join(SPRITE_DIR, slug + ".png")
    baked.save(path, "PNG")
    return baked, path


def build_all():
    os.makedirs(SPRITE_DIR, exist_ok=True)
    baked = []
    for slug, spec in SPECS.items():
        img = canvas()
        d = ImageDraw.Draw(img)
        fighter(d, **spec)
        result = save_sprite(img, slug)
        if result:
            baked.append((slug, result[0]))
            print(f"Wrote {slug}.png {result[0].size}")
    return baked


def build_preview(baked):
    pad, cols = 16, 4
    cell_w = max(b.width for _, b in baked) + pad * 2
    cell_h = DISPLAY_H + 40
    rows = (len(baked) + cols - 1) // cols
    sheet = Image.new("RGBA", (cell_w * cols, cell_h * rows), (26, 26, 26, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (slug, img) in enumerate(baked):
        col, row = i % cols, i // cols
        x = col * cell_w + (cell_w - img.width) // 2
        y = row * cell_h + 24
        sheet.paste(img, (x, y), img)
        draw.text((col * cell_w + 8, row * cell_h + 4), slug.upper(), fill=(248, 216, 120))
    out = os.path.join(ROOT, "assets", "images", "kol-fighter", "original-sprites-preview.png")
    sheet.save(out, "PNG")
    print(f"Preview: {out}")
    return out


def main():
    baked = build_all()
    build_preview(baked)
    print(f"Done: {len(baked)}/12 original sprites")


if __name__ == "__main__":
    main()