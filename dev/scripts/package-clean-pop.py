"""Freeze approved Clean Pop PNGs without resizing or changing their pixels."""
import base64
import hashlib
import io
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art-candidates/clean-pop-v1/all'
DEST = ROOT / 'assets/ethscriptions/clean-pop-v1'
sha = lambda value: hashlib.sha256(value).digest()

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    rows, leaves, seen = [], [], set()
    for number in range(10000):
        raw = (SOURCE / f'{number}.png').read_bytes()
        with Image.open(io.BytesIO(raw)) as image:
            image.load()
            if image.format != 'PNG' or image.size != (1536, 1536):
                raise ValueError(f'Unexpected artwork format or dimensions: {number}')
            pixel_hash = sha(image.convert('RGB').tobytes()).hex()
        if pixel_hash in seen:
            raise ValueError(f'Duplicate rendered artwork at {number}')
        seen.add(pixel_hash)
        uri = b'data:image/png;base64,' + base64.b64encode(raw)
        leaf = sha(uri)
        leaves.append(leaf)
        target = DEST / f'{number}.png'
        if target.exists() and target.read_bytes() != raw:
            raise ValueError(f'Refusing to overwrite different frozen art: {number}')
        if not target.exists():
            target.write_bytes(raw)
        if sha(target.read_bytes()) != sha(raw):
            raise ValueError(f'Copy verification failed: {number}')
        rows.append({'id': number, 'image': f'{number}.png', 'sha256': sha(raw).hex(),
                     'pixelSha256': pixel_hash, 'contentSha256': leaf.hex(),
                     'fileBytes': len(raw), 'uriBytes': len(uri)})
        if (number + 1) % 1000 == 0:
            print(f'Verified and packaged {number + 1}/10000', flush=True)
    levels = [leaves + [bytes(32)] * (16384 - len(leaves))]
    while len(levels[-1]) > 1:
        previous = levels[-1]
        levels.append([sha(previous[i] + previous[i + 1]) for i in range(0, len(previous), 2)])
    for row in rows:
        index = row['id']
        proof = []
        for level in levels[:-1]:
            proof.append('0x' + level[index ^ 1].hex())
            index >>= 1
        row['proof'] = proof
        index, check = row['id'], bytes.fromhex(row['contentSha256'])
        for sibling in proof:
            sibling = bytes.fromhex(sibling[2:])
            check = sha(sibling + check if index & 1 else check + sibling)
            index >>= 1
        if check != levels[-1][0]:
            raise ValueError(f'Invalid proof: {row["id"]}')
    report = {'version': 'clean-pop-v1', 'count': len(rows), 'dimensions': [1536, 1536],
              'mimeType': 'image/png', 'root': '0x' + levels[-1][0].hex(),
              'hashAlgorithm': 'sha256(exact UTF-8 data URI); ordered pairs; zero padded to 16384',
              'totalBytes': sum(r['fileBytes'] for r in rows),
              'maxUriBytes': max(r['uriBytes'] for r in rows),
              'minUriBytes': min(r['uriBytes'] for r in rows),
              'deployed': False, 'files': rows}
    (DEST / 'manifest.json').write_text(json.dumps(report, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'files'}, indent=2))

if __name__ == '__main__':
    main()
