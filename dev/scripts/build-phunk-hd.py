"""Build display-only lossless WebP previews from the supplied full-resolution art.

Never overwrites the PNGs committed by the Ethereum minter's Merkle root.
Requires Pillow with WebP support: python -m pip install Pillow
"""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
from PIL import Image, features

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT.parent / 'TRIX-PHUNKS' / 'assets-v2'
DEST = ROOT / 'assets' / 'ethscriptions' / 'phunks' / 'hd'

def build(index):
    source = SOURCE / f'{index}.png'
    target = DEST / f'{index}.webp'
    raw = source.read_bytes()
    with Image.open(source) as original:
        image = original.convert('RGBA')
        if image.size != (960, 960):
            raise ValueError(f'{source.name}: expected 960x960, got {image.size}')
        temporary = target.with_suffix('.tmp.webp')
        image.save(temporary, 'WEBP', lossless=True, method=4, exact=True)
        with Image.open(temporary) as check:
            if check.size != image.size or check.convert('RGBA').tobytes() != image.tobytes():
                temporary.unlink(missing_ok=True)
                raise ValueError(f'{index}: lossless pixel verification failed')
        temporary.replace(target)
    return {'id': index, 'sourceSha256': hashlib.sha256(raw).hexdigest(),
            'bytes': target.stat().st_size}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit', type=int, default=10000)
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    if not 1 <= args.limit <= 10000 or not 1 <= args.workers <= 16:
        parser.error('limit must be 1..10000; workers must be 1..16')
    if not features.check('webp'):
        raise RuntimeError('This Pillow installation has no WebP encoder')
    DEST.mkdir(parents=True, exist_ok=True)
    rows = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for row in pool.map(build, range(args.limit)):
            rows.append(row)
            if len(rows) % 1000 == 0:
                print(f'Verified {len(rows)}/{args.limit}', flush=True)
    total = sum(row['bytes'] for row in rows)
    report = {'count': len(rows), 'dimensions': [960, 960], 'format': 'lossless WebP',
              'source': 'TRIX-PHUNKS/assets-v2', 'pixelVerified': True,
              'purpose': 'Display previews only; not on-chain content', 'totalBytes': total, 'files': rows}
    # Only publish the full manifest after every item succeeds.
    if args.limit == 10000:
        (DEST / 'manifest.json').write_text(json.dumps(report, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({key: value for key, value in report.items() if key != 'files'}, indent=2))

if __name__ == '__main__':
    main()
