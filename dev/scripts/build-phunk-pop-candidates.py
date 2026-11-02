"""Render non-production clean-pop candidate art from the immutable 24x24 trait map.

Outputs stay outside website assets and are never used by the legacy mint.
Run without --all to create the approval set; add --all only after approval.
"""
import argparse
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT.parent / 'TRIX-PHUNKS' / 'build'
OUT = ROOT / 'art-candidates' / 'clean-pop-v1'
GRID, CELL = 24, 64
CANVAS = GRID * CELL
LIME = (198, 243, 8, 255)
INK = (18, 23, 13, 255)
SAMPLES = (0, 1, 2, 4, 117, 344, 372, 419, 635, 999, 1201, 2345, 3456, 4567, 5678, 6789, 7890, 8901, 9998, 9999)

def read_map():
    palette = {}
    for line in (SOURCE / 'pal-map.tsv').read_text(encoding='utf-8').splitlines():
        index, value = line.split('\t', 1)
        palette[int(index)] = value
    return palette

def fonts():
    emoji = ImageFont.truetype(r'C:\Windows\Fonts\seguiemj.ttf', 47)
    label = ImageFont.truetype(r'C:\Windows\Fonts\segoeuib.ttf', 22)
    return emoji, label

def tile(draw, x=0, y=0):
    # Repeated framed tiles make the emoji matrix deliberate pop art, not a blur.
    draw.rounded_rectangle((x + 3, y + 3, x + CELL - 3, y + CELL - 3), radius=15,
                           fill=(26, 31, 18, 255), outline=(9, 12, 6, 255), width=2)
    draw.rounded_rectangle((x + 7, y + 7, x + CELL - 7, y + CELL - 7), radius=11,
                           fill=(54, 63, 35, 255))

def render(piece, pixels, palette, cells):
    image = Image.new('RGBA', (CANVAS, CANVAS), LIME)
    offset = piece * GRID * GRID * 2
    for y in range(GRID):
        for x in range(GRID):
            color_id = int.from_bytes(pixels[offset + (y * GRID + x) * 2:offset + (y * GRID + x + 1) * 2], 'little')
            symbol = palette[color_id]
            if symbol == 'EMPTY':
                continue
            image.alpha_composite(cells[symbol], (x * CELL, y * CELL))
    return image

def glyph_cells(palette, emoji_font):
    symbols = set(palette.values()) - {'EMPTY'}
    cells = {}
    for symbol in symbols:
        cell = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
        draw = ImageDraw.Draw(cell)
        tile(draw)
        if symbol != 'BLACK':
            # Windows' color emoji font supplies clean, high-resolution glyphs locally.
            box = draw.textbbox((0, 0), symbol, font=emoji_font, embedded_color=True)
            tx = (CELL - (box[2] - box[0])) / 2 - box[0]
            ty = (CELL - (box[3] - box[1])) / 2 - box[1] - 2
            draw.text((tx, ty), symbol, font=emoji_font, embedded_color=True)
        cells[symbol] = cell
    return cells

def contact_sheet(ids, output, label_font):
    size, columns, gutter = 384, 4, 24
    rows = math.ceil(len(ids) / columns)
    sheet = Image.new('RGBA', (columns * size + (columns + 1) * gutter,
                               rows * (size + 42) + (rows + 1) * gutter), INK)
    draw = ImageDraw.Draw(sheet)
    for index, piece in enumerate(ids):
        art = Image.open(output / f'{piece}.png').convert('RGBA').resize((size, size), Image.Resampling.LANCZOS)
        x = gutter + (index % columns) * (size + gutter)
        y = gutter + (index // columns) * (size + 42 + gutter)
        sheet.alpha_composite(art, (x, y))
        draw.text((x, y + size + 7), f'TRIXMOJI PHUNK #{piece}', font=label_font, fill=(238, 238, 231, 255))
    sheet.convert('RGB').save(output / 'approval-sheet.png', quality=95)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--all', action='store_true', help='Render all 10,000 only after visual approval.')
    args = parser.parse_args()
    output = OUT / ('all' if args.all else 'approval-set')
    output.mkdir(parents=True, exist_ok=True)
    palette, pixels = read_map(), (SOURCE / 'src' / 'pixels.bin').read_bytes()
    if len(pixels) != 10000 * GRID * GRID * 2:
        raise ValueError('Unexpected trait map size')
    emoji_font, label_font = fonts()
    cells = glyph_cells(palette, emoji_font)  # Fail before writing if a local glyph cannot render.
    ids = tuple(range(10000)) if args.all else SAMPLES
    for number, piece in enumerate(ids, 1):
        render(piece, pixels, palette, cells).convert('RGB').save(output / f'{piece}.png', quality=95)
        if number % 100 == 0 or number == len(ids):
            print(f'Rendered {number}/{len(ids)}')
    if not args.all:
        contact_sheet(ids, output, label_font)
    manifest = {'version': 'clean-pop-v1-candidate', 'production': False, 'dimensions': [CANVAS, CANVAS],
                'source': 'TRIX-PHUNKS/build/src/pixels.bin + pal-map.tsv', 'pieces': list(ids),
                'note': 'Approval candidate only. Never use for legacy minting or a replacement collection without written art approval.'}
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')

if __name__ == '__main__':
    main()
