"""DEGEN character sprite preview sheet."""
from PIL import Image, ImageDraw

OUT = r"C:\Users\franc\Desktop\DOSWAPZ-v2\assets\images\kol-fighter\characters\degen-nes-preview.png"
REF = r"C:\Users\franc\Desktop\DOSWAPZ-v2\assets\images\kol-fighter\characters\degen.jpg"

C = {
    "K": (24, 24, 24), "W": (252, 252, 252), "G": (216, 216, 216), "S": (232, 168, 120),
    "H": (106, 74, 42), "B": (58, 90, 154), "D": (42, 64, 120), "U": (224, 224, 224), ".": None
}

IDLE = [
    "......WWWWWW......",
    ".....WWWWWWWW.....",
    "....HHHWWWWWW.....",
    "....KKKWWWWWW.....",
    "....SSSWWWWWW.....",
    "....SSSWWWWWW.....",
    "...WWWWWWWWWWWW...",
    "...WWKKKKKKWWWW...",
    "...WWWWWWWWWWWW...",
    "...WWWWWWWWWWWW...",
    "....WWWWWWWWWW....",
    "....BBB..BBB......",
    "....BBB..BBB......",
    "....BBB..BBB......",
    "....DDD..DDD......",
    "....KKK..KKK......",
    "....KU...UK.......",
]

KICK = [
    "......WWWWWW......",
    ".....WWWWWWWW.....",
    "....HHHWWWWWW.....",
    "....KKKWWWWWW.....",
    "....SSSWWWWWW.....",
    "....SSSWWWWWW.....",
    "...WWWWWWWWWWWW...",
    "...WWKKKKKKWWWW...",
    "...WWWWWWWWWWWW...",
    "...WWWWWWWWWWWW...",
    "....WWWWWWWWWW....",
    "....BBB...........",
    "....BBBBBBBBBBBB..",
    "....BBBBBBBBBBBB..",
    "....DDD...........",
    "....KKK...........",
    "....KU............",
]

POSES = [("IDLE", IDLE), ("KICK", KICK), ("PUNCH", IDLE), ("WALK", IDLE)]


def draw_grid(grid, scale=4):
    rows, cols = len(grid), len(grid[0])
    img = Image.new("RGBA", (cols * scale, rows * scale), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            col = C.get(ch)
            if not col:
                continue
            for dy in range(scale):
                for dx in range(scale):
                    px[x * scale + dx, y * scale + dy] = col + (255,)
    return img


def main():
    sheet = Image.new("RGB", (640, 400), (192, 176, 208))
    draw = ImageDraw.Draw(sheet)
    draw.rectangle([0, 0, 639, 28], fill=(24, 24, 24))
    draw.text((8, 8), "DEGEN — Character 1/12 — NES 8-bit (from your reference)", fill=(248, 216, 120))

    ref = Image.open(REF).convert("RGB")
    ref.thumbnail((120, 160), Image.NEAREST)
    sheet.paste(ref, (20, 50))

    draw.text((20, 220), "YOUR REFERENCE", fill=(24, 24, 24))
    draw.text((20, 235), "labeled photo", fill=(24, 24, 24))

    x = 180
    for label, grid in POSES:
        spr = draw_grid(grid, 5)
        sheet.paste(spr, (x, 60), spr)
        draw.text((x, 150), label, fill=(24, 24, 24))
        x += spr.width + 24

    draw.rectangle([0, 280, 639, 399], fill=(184, 136, 80))
    draw.rectangle([0, 280, 639, 281], fill=(24, 24, 24))
    big = draw_grid(KICK, 8)
    sheet.paste(big, (80, 290), big)
    idle = draw_grid(IDLE, 8)
    sheet.paste(idle, (400, 290), idle)
    draw.text((80, 370), "KICK pose", fill=(252, 252, 252))
    draw.text((400, 370), "IDLE pose", fill=(252, 252, 252))

    sheet.save(OUT, "PNG")
    print("Wrote", OUT)


if __name__ == "__main__":
    main()