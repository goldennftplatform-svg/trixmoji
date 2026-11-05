#!/usr/bin/env python3
"""Prepare a separate, resumable, pixel-verified WebP candidate. No chain calls."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image, features
import base64, hashlib, json, os, statistics, sys, time

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets' / 'ethscriptions' / 'clean-pop-v1'
DEST = ROOT / 'assets' / 'ethscriptions' / 'clean-pop-webp-v2'
COUNT = 10000
WORKERS = 4

def sha(data): return hashlib.sha256(data).digest()

def convert(token):
    source = SOURCE / f'{token}.png'
    target = DEST / f'{token}.webp'
    tmp = DEST / f'.{token}.webp.part'
    if tmp.exists(): raise RuntimeError(f'An unfinished temporary file exists: {tmp}')
    with Image.open(source) as image:
        image.load()
        rgba = image.convert('RGBA')
        expected = sha(rgba.tobytes())
        dimensions = rgba.size
        if not target.exists():
            try:
                with tmp.open('xb') as output:
                    rgba.save(output, 'WEBP', lossless=True, quality=100, method=2, exact=True)
            except Exception:
                tmp.unlink(missing_ok=True)
                raise
    candidate = target if target.exists() else tmp
    try:
        with Image.open(candidate) as image:
            image.load()
            if image.size != dimensions or sha(image.convert('RGBA').tobytes()) != expected:
                raise RuntimeError(f'Decoded pixels differ for #{token}')
        if candidate == tmp:
            if target.exists(): raise RuntimeError(f'Output appeared during conversion: {target}')
            os.rename(tmp, target)
    except Exception:
        if candidate == tmp: tmp.unlink(missing_ok=True)
        raise
    raw = target.read_bytes()
    uri = b'data:image/webp;base64,' + base64.b64encode(raw)
    return {'id': token, 'image': f'{token}.webp', 'sha256': sha(raw).hex(),
            'pixelSha256RGBA': expected.hex(), 'contentSha256': sha(uri).hex(),
            'fileBytes': len(raw), 'uriBytes': len(uri),
            'sourcePngBytes': source.stat().st_size, 'width': dimensions[0], 'height': dimensions[1]}

def make_manifest(rows):
    leaf_count = 1 << (COUNT - 1).bit_length()
    leaves = [bytes.fromhex(row['contentSha256']) for row in rows] + [bytes(32)] * (leaf_count - COUNT)
    levels = [leaves]
    while len(levels[-1]) > 1:
        cur = levels[-1]
        levels.append([sha(cur[i] + cur[i + 1]) for i in range(0, len(cur), 2)])
    for row in rows:
        position = row['id']; proof = []
        for level in levels[:-1]:
            proof.append('0x' + level[position ^ 1].hex()); position //= 2
        row['proof'] = proof
    unique = len({row['contentSha256'] for row in rows})
    return {'version': 'clean-pop-lossless-webp-candidate', 'count': COUNT,
            'mimeType': 'image/webp', 'root': '0x' + levels[-1][0].hex(),
            'hashAlgorithm': 'sha256(exact UTF-8 data URI); ordered pairs; zero padded to 16384',
            'pixelVerification': 'decoded RGBA SHA-256 equality', 'uniqueContentUris': unique,
            'totalBytes': sum(row['fileBytes'] for row in rows),
            'maxFileBytes': max(row['fileBytes'] for row in rows),
            'minFileBytes': min(row['fileBytes'] for row in rows),
            'over30000Bytes': sum(row['fileBytes'] > 30000 for row in rows),
            'note': 'Candidate only; not approved, deployed, or checked for on-chain uniqueness.',
            'files': rows}

def main():
    if not DEST.is_dir() or not SOURCE.is_dir() or not features.check('webp'):
        raise RuntimeError('Source/output folder or Pillow WebP support unavailable')
    manifest_path = DEST / 'manifest.json'
    if manifest_path.exists(): raise RuntimeError('A manifest already exists; refusing to replace it')
    start = time.monotonic(); rows = []; errors = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(convert, i): i for i in range(COUNT)}
        for future in as_completed(futures):
            try: rows.append(future.result())
            except Exception as error:
                errors.append({'id': futures[future], 'error': str(error)})
            done = len(rows) + len(errors)
            if done % 250 == 0 or done == COUNT:
                print(json.dumps({'processed': done, 'verified': len(rows), 'failed': len(errors), 'seconds': round(time.monotonic()-start)}), flush=True)
    if errors:
        print(json.dumps({'errors': errors}, indent=2), file=sys.stderr)
        raise RuntimeError('Some files failed; no manifest was written. Fix and rerun.')
    rows.sort(key=lambda x: x['id'])
    manifest = make_manifest(rows)
    tmp = DEST / '.manifest.json.part'
    with tmp.open('x', encoding='utf8') as output: json.dump(manifest, output, separators=(',', ':'))
    if manifest_path.exists(): raise RuntimeError('Manifest appeared during generation')
    os.rename(tmp, manifest_path)
    print(json.dumps({k: manifest[k] for k in ['count','root','uniqueContentUris','totalBytes','minFileBytes','maxFileBytes','over30000Bytes']}, indent=2), flush=True)
    print('Average WebP bytes:', round(statistics.mean(row['fileBytes'] for row in rows)), flush=True)

if __name__ == '__main__': main()
