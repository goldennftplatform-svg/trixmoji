"""DEGEN — from-scratch 32-bit pixel fighter matching reference silhouette."""
import os
from PIL import Image, ImageDraw

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
OUT_DIR = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters", "sprites")
PREVIEW_DIR = os.path.join(ROOT, "dev", "build")

# Target native resolution ~ half reference density, 32-bit palette depth
W, H = 112, 224
DISPLAY_H = 220


def draw_degen():
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    OL = (10, 10, 14)
    hood = (250, 250, 246)
    hood_hi = (255, 255, 253)
    hood_lo = (228, 228, 222)
    hood_sh = (205, 205, 198)
    skin = (235, 192, 152)
    skin_sh = (210, 165, 125)
    hair = (122, 76, 40)
    hair_dk = (92, 56, 28)
    jean = (62, 92, 172)
    jean_hi = (88, 118, 198)
    jean_lo = (42, 62, 132)
    belt = (30, 24, 18)
    buckle = (215, 175, 68)
    shoe = (24, 24, 30)
    sole = (218, 218, 212)
    glass = (14, 14, 18)
    glass_hi = (55, 55, 62)

    cx = 56

    # --- shoes (black + white sole) ---
    d.rectangle([38, 208, 50, 218], fill=shoe, outline=OL)
    d.rectangle([62, 208, 74, 218], fill=shoe, outline=OL)
    d.rectangle([36, 218, 52, 222], fill=sole, outline=OL)
    d.rectangle([60, 218, 76, 222], fill=sole, outline=OL)

    # --- jeans ---
    d.rectangle([40, 162, 52, 208], fill=jean, outline=OL)
    d.rectangle([60, 162, 72, 208], fill=jean, outline=OL)
    d.line([(42, 162), (42, 206)], fill=jean_lo, width=1)
    d.line([(50, 162), (50, 206)], fill=jean_hi, width=1)
    d.line([(62, 162), (62, 206)], fill=jean_lo, width=1)
    d.line([(70, 162), (70, 206)], fill=jean_hi, width=1)
    d.line([(40, 178), (52, 178)], fill=jean_lo, width=1)
    d.line([(60, 178), (72, 178)], fill=jean_lo, width=1)

    # --- belt ---
    d.rectangle([38, 154, 74, 162], fill=belt, outline=OL)
    d.rectangle([52, 155, 60, 161], fill=buckle, outline=OL)

    # --- hoodie torso ---
    d.rectangle([34, 84, 78, 154], fill=hood, outline=OL)
    d.rectangle([36, 86, 76, 152], fill=hood_hi)

    for y in range(86, 152):
        d.point((35, y), fill=hood_lo)
        d.point((77, y), fill=hood_lo)
        d.point((36, y), fill=hood_sh)

    # kangaroo pocket hint
    d.arc([44, 118, 68, 132], 0, 180, fill=hood_sh, width=1)

    # drawstrings
    d.line([(50, 78), (50, 96)], fill=hood_sh, width=2)
    d.line([(62, 78), (62, 96)], fill=hood_sh, width=2)
    d.ellipse([48, 94, 52, 98], fill=hood_sh)
    d.ellipse([60, 94, 64, 98], fill=hood_sh)

    # --- sleeves + arms at sides (reference pose) ---
    d.rectangle([24, 90, 34, 132], fill=hood, outline=OL)
    d.rectangle([78, 90, 88, 132], fill=hood, outline=OL)
    # cuffs
    d.rectangle([24, 128, 34, 134], fill=hood_lo, outline=OL)
    d.rectangle([78, 128, 88, 134], fill=hood_lo, outline=OL)
    # hands
    d.rectangle([22, 134, 36, 144], fill=skin, outline=OL)
    d.rectangle([76, 134, 90, 144], fill=skin, outline=OL)
    d.line([(24, 140), (34, 140)], fill=skin_sh, width=1)
    d.line([(78, 140), (88, 140)], fill=skin_sh, width=1)

    # --- DEGEN text ---
    font_block = [
        # D
        "11110",
        "10001",
        "10001",
        "10001",
        "10001",
        "10001",
        "11110",
        # E
        "11111",
        "10000",
        "11110",
        "10000",
        "10000",
        "10000",
        "11111",
        # G
        "01111",
        "10000",
        "10000",
        "10111",
        "10001",
        "10001",
        "01110",
        # E (repeat)
        "11111",
        "10000",
        "11110",
        "10000",
        "10000",
        "10000",
        "11111",
        # N
        "10001",
        "11001",
        "10101",
        "10011",
        "10001",
        "10001",
        "10001",
    ]

    letters = [font_block[i:i+7] for i in range(0, 35, 7)]
    tx, ty = 30, 104
    for li, letter in enumerate(letters):
        lx = tx + li * 10
        for row, line in enumerate(letter):
            for col, ch in enumerate(line):
                if ch == "1":
                    d.rectangle([lx + col, ty + row, lx + col, ty + row], fill=OL)

    # --- hood wrapping head ---
    d.polygon([(30, 52), (82, 52), (86, 68), (84, 84), (26, 84), (24, 68)], fill=hood, outline=OL)
    d.polygon([(32, 54), (80, 54), (82, 68), (80, 80), (28, 80), (26, 68)], fill=hood_hi)
    # hood inner shadow
    d.arc([28, 48, 84, 90], 180, 360, fill=hood_sh, width=2)

    # hair tufts peeking from hood
    d.polygon([(34, 58), (42, 52), (44, 62), (36, 68)], fill=hair)
    d.polygon([(68, 52), (76, 58), (74, 68), (66, 62)], fill=hair)
    d.rectangle([38, 50, 74, 56], fill=hair_dk)

    # face
    d.rectangle([42, 64, 70, 82], fill=skin, outline=OL)
    d.rectangle([44, 66, 68, 80], fill=skin)

    # sunglasses
    d.rectangle([44, 68, 68, 76], fill=glass, outline=OL)
    d.rectangle([46, 70, 54, 74], fill=glass_hi)
    d.rectangle([58, 70, 66, 74], fill=glass_hi)
    d.line([(55, 68), (55, 76)], fill=OL, width=1)
    d.point((48, 71), fill=(120, 120, 128))
    d.point((62, 71), fill=(120, 120, 128))

    # mouth
    d.line([(52, 78), (60, 78)], fill=OL, width=1)

    return img


def save_outputs(native):
    bbox = native.getbbox()
    cropped = native.crop(bbox) if bbox else native
    th = DISPLAY_H
    tw = max(1, int(cropped.width * th / cropped.height))
    game = cropped.resize((tw, th), Image.NEAREST)

    sprite_path = os.path.join(OUT_DIR, "degen.png")
    game.save(sprite_path, "PNG")

    native_path = os.path.join(PREVIEW_DIR, "degen-32bit-native.png")
    native.save(native_path, "PNG")

    preview = Image.new("RGBA", (560, 300), (26, 26, 26, 255))
    draw = ImageDraw.Draw(preview)
    draw.text((16, 8), "YOUR REFERENCE", fill=(248, 216, 120))
    draw.text((296, 8), "NEW 32-BIT DEGEN (from scratch)", fill=(136, 255, 136))

    ref_path = r"C:\Users\franc\Downloads\DEGEN.jpg"
    if os.path.exists(ref_path):
        ref = Image.open(ref_path).convert("RGBA")
        rb = ref.getbbox()
        if rb:
            ref = ref.crop(rb)
        ref_h = 230
        ref_w = max(1, int(ref.width * ref_h / ref.height))
        ref = ref.resize((ref_w, ref_h), Image.NEAREST)
        preview.paste(ref, (16, 40), ref)

    preview.paste(game, (300, 40), game)
    compare_path = os.path.join(PREVIEW_DIR, "degen-32bit-compare.png")
    preview.save(compare_path, "PNG")

    solo = Image.new("RGBA", (game.width + 48, game.height + 48), (26, 26, 26, 255))
    solo.paste(game, (24, 24), game)
    solo_path = os.path.join(PREVIEW_DIR, "degen-32bit-solo.png")
    solo.save(solo_path, "PNG")

    return sprite_path, compare_path, solo_path, game.size


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    native = draw_degen()
    paths = save_outputs(native)
    print(f"Game sprite: {paths[0]} {paths[3]}")
    print(f"Compare: {paths[1]}")
    print(f"Solo: {paths[2]}")


if __name__ == "__main__":
    main()