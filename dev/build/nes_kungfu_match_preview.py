"""Recreate NES Kung Fu screenshot layout — purple wall, kick pose, KOL palettes."""
from PIL import Image, ImageDraw

OUT = r"C:\Users\franc\Desktop\DOSWAPZ-v2\assets\images\kol-fighter\nes-kungfu-match-preview.png"
W, H = 640, 360
GROUND = 268

STAGE = {
    "wall": (192, 176, 208),
    "floor": (184, 136, 80),
    "black": (24, 24, 24),
    "red": (216, 48, 48),
    "beige": (240, 216, 160),
}

PLAYER_KICK = [
    "....HHHH......",
    "...SSSSS......",
    "...SSSSS......",
    "..BBBBBBB.....",
    "..BBBBBBB.....",
    "..BBBBBBB.....",
    "...OOOOO......",
    "..AAA.........",
    "..AAA.........",
    "..BBBBBBBBBBBB",
    "..BBBBBBBBBBBB",
    "..BBB.........",
    "...BB.........",
    "...B..........",
]

ENEMY_IDLE = [
    "....EEEE....",
    "...SSSSS....",
    "...SSSSS....",
    "..VVVVVVV...",
    "..VVVVVVV...",
    "..PPPPPPP...",
    "..PPPPPPP...",
    ".AAA...AAA..",
    ".AAA...AAA..",
    "..OOO..OOO..",
    "..OOO..OOO..",
    "...O....O...",
]

ENEMY_HIT = [
    ".....EEEE...",
    "....SSSSS...",
    "...VVVVVV...",
    "..VVVVVVV...",
    "...PPPPPP...",
    ".AAA....AAA.",
    "PPP......PPP",
    "OOO......OOO",
    ".O........O.",
]


def pal_player():
    return {"H": (24, 24, 24), "S": (240, 168, 120), "B": (252, 252, 252), "O": (24, 24, 24), "A": (252, 252, 252), ".": None}


def pal_opponent():
    return {"E": (240, 160, 64), "S": (240, 160, 96), "V": (136, 88, 184), "P": (136, 184, 248), "A": (136, 88, 184), "O": (24, 24, 24), ".": None}


def draw_frame(draw, grid, pal, cx, feet, scale=3):
    rows = len(grid)
    cols = len(grid[0])
    ox = cx - (cols * scale) // 2
    oy = feet - rows * scale
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            c = pal.get(ch)
            if not c:
                continue
            draw.rectangle([ox + x * scale, oy + y * scale, ox + (x + 1) * scale - 1, oy + (y + 1) * scale - 1], fill=c)
            draw.rectangle([ox + x * scale, oy + y * scale, ox + (x + 1) * scale - 1, oy + (y + 1) * scale - 1], outline=STAGE["black"])


def meander(draw, y):
    draw.rectangle([0, y, W, y + 12], fill=STAGE["red"])
    u = 8
    for x in range(0, W, u * 2):
        draw.rectangle([x, y + 2, x + u - 1, y + 3], fill=STAGE["beige"])
        draw.rectangle([x + u, y + 6, x + u * 2 - 1, y + 7], fill=STAGE["beige"])
    draw.rectangle([0, y, W, y], fill=STAGE["black"])
    draw.rectangle([0, y + 11, W, y + 11], fill=STAGE["black"])


def main():
    img = Image.new("RGB", (W, H), STAGE["wall"])
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 10, W, 11], fill=STAGE["black"])
    draw.rectangle([0, 12, W, 15], fill=STAGE["red"])
    draw.rectangle([0, 16, W, 18], fill=STAGE["beige"])
    draw.rectangle([0, 19, W, 21], fill=STAGE["red"])
    px = W // 2 - 6
    draw.rectangle([px, 0, px + 11, 21], fill=STAGE["black"])
    draw.rectangle([px, 0, px + 11, 2], fill=STAGE["red"])
    draw.rectangle([px, 8, px + 11, 9], fill=STAGE["red"])

    draw.rectangle([0, GROUND, W, H - 14], fill=STAGE["floor"])
    draw.rectangle([0, GROUND, W, GROUND + 1], fill=STAGE["black"])
    meander(draw, H - 14)

    draw_frame(draw, PLAYER_KICK, pal_player(), 200, GROUND, 3)
    draw_frame(draw, ENEMY_HIT, pal_opponent(), 430, GROUND, 3)
    draw_frame(draw, ENEMY_IDLE, pal_opponent(), 500, GROUND, 3)

    draw.rectangle([0, 0, W, 26], fill=(0, 0, 0))
    draw.text((8, 6), "NES KUNG FU (1985) — match your reference screenshot", fill=(255, 255, 120))
    draw.text((8, 16), "DEGEN = white gi palette from your photo | CPU = purple-vest enemy style + KOL colors", fill=(200, 220, 255))

    img.save(OUT, "PNG")
    print("Wrote", OUT)


if __name__ == "__main__":
    main()