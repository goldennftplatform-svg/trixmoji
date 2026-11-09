#!/usr/bin/env python3
"""Build the approved 768px TrixMoji candidate without touching source art."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image, features
import base64, hashlib, json, os, statistics, sys, time

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT.parent / 'TrixMoji-assets-v2'
METADATA = SOURCE / 'metadata-2p5'
DEST = ROOT / 'assets' / 'ethscriptions' / 'trixmoji-launch'
COUNT = 10000
WORKERS = 6
SIZE = (768, 768)

def sha(data): return hashlib.sha256(data).digest()

def convert(token):
    source = SOURCE / f'{token}.webp'; meta = METADATA / f'{token}.json'
    target = DEST / f'{token}.webp'; target_meta = DEST / f'{token}.json'
    tmp = DEST / f'.{token}.webp.part'
    # Only this builder uses these private per-token temporary paths. A stopped
    # run may leave one behind; it was never published as a finished image.
    if tmp.exists(): tmp.unlink()
    metadata_bytes = meta.read_bytes(); metadata = json.loads(metadata_bytes)
    if metadata.get('seller_fee_basis_points') != 250 or metadata.get('image') != f'{token}.webp' or metadata.get('properties', {}).get('edition') != token:
        raise RuntimeError(f'Metadata mismatch for #{token}')
    # Finished files were renamed into place only after pixel verification in
    # this builder. Recover their manifest rows without resizing them again.
    # This recovery is intended only for the isolated, initially empty output
    # directory created for this run.
    if target.exists():
        with Image.open(target) as image:
            image.load()
            if image.size != SIZE: raise RuntimeError(f'Unexpected output dimensions for #{token}')
            expected = sha(image.convert('RGBA').tobytes())
        if target_meta.exists():
            if target_meta.read_bytes() != metadata_bytes: raise RuntimeError(f'Existing metadata differs for #{token}')
        else:
            with target_meta.open('xb') as output: output.write(metadata_bytes)
        raw = target.read_bytes(); uri = b'data:image/webp;base64,' + base64.b64encode(raw)
        return {'id': token, 'image': f'{token}.webp', 'metadata': f'{token}.json', 'sha256': sha(raw).hex(),
                'pixelSha256RGBA': expected.hex(), 'contentSha256': sha(uri).hex(), 'fileBytes': len(raw),
                'uriBytes': len(uri), 'sourceBytes': source.stat().st_size, 'width': SIZE[0], 'height': SIZE[1]}
    with Image.open(source) as image:
        image.load()
        if image.size != (3840, 3840): raise RuntimeError(f'Unexpected source dimensions for #{token}')
        resized = image.convert('RGBA').resize(SIZE, Image.Resampling.LANCZOS)
        expected = sha(resized.tobytes())
        if not target.exists():
            try:
                with tmp.open('xb') as output: resized.save(output, 'WEBP', lossless=True, quality=100, method=2, exact=True)
            except Exception:
                tmp.unlink(missing_ok=True); raise
    candidate = target if target.exists() else tmp
    try:
        with Image.open(candidate) as image:
            image.load()
            if image.size != SIZE or sha(image.convert('RGBA').tobytes()) != expected:
                raise RuntimeError(f'Decoded pixels differ from approved resized artwork for #{token}')
        if candidate == tmp:
            if target.exists(): raise RuntimeError(f'Output appeared during conversion: {target}')
            os.rename(tmp, target)
    except Exception:
        if candidate == tmp: tmp.unlink(missing_ok=True)
        raise
    if target_meta.exists():
        if target_meta.read_bytes() != metadata_bytes: raise RuntimeError(f'Existing metadata differs for #{token}')
    else:
        with target_meta.open('xb') as output: output.write(metadata_bytes)
    raw = target.read_bytes(); uri = b'data:image/webp;base64,' + base64.b64encode(raw)
    return {'id': token, 'image': f'{token}.webp', 'metadata': f'{token}.json', 'sha256': sha(raw).hex(),
            'pixelSha256RGBA': expected.hex(), 'contentSha256': sha(uri).hex(), 'fileBytes': len(raw),
            'uriBytes': len(uri), 'sourceBytes': source.stat().st_size, 'width': SIZE[0], 'height': SIZE[1]}

def make_manifest(rows):
    size = 1 << (COUNT - 1).bit_length()
    levels = [[bytes.fromhex(row['contentSha256']) for row in rows] + [bytes(32)] * (size - COUNT)]
    while len(levels[-1]) > 1:
        current = levels[-1]; levels.append([sha(current[i] + current[i + 1]) for i in range(0, len(current), 2)])
    for row in rows:
        position = row['id']; proof = []
        for level in levels[:-1]: proof.append('0x' + level[position ^ 1].hex()); position //= 2
        row['proof'] = proof
    return {'version': 'trixmoji-launch-candidate', 'count': COUNT, 'dimensions': list(SIZE), 'sourceDimensions': [3840,3840],
            'mimeType': 'image/webp', 'root': '0x' + levels[-1][0].hex(),
            'hashAlgorithm': 'sha256(exact UTF-8 data URI); ordered pairs; zero padded to 16384',
            'pixelVerification': 'decoded RGBA SHA-256 equality against Lanczos-resized source',
            'royaltyBasisPoints': 250, 'uniqueContentUris': len({row['contentSha256'] for row in rows}),
            'totalBytes': sum(row['fileBytes'] for row in rows), 'maxFileBytes': max(row['fileBytes'] for row in rows),
            'minFileBytes': min(row['fileBytes'] for row in rows), 'over30000Bytes': sum(row['fileBytes'] > 30000 for row in rows),
            'note': 'Candidate only; resized from artist originals, not deployed or checked for on-chain uniqueness.', 'files': rows}

def main():
    if not SOURCE.is_dir() or not METADATA.is_dir() or not DEST.is_dir() or not features.check('webp'):
        raise RuntimeError('Source/output/metadata folder or Pillow WebP support unavailable')
    target = DEST / 'manifest.json'
    if target.exists(): raise RuntimeError('Manifest already exists; refusing to overwrite.')
    rows = []; errors = []; start = time.monotonic()
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(convert, i): i for i in range(COUNT)}
        for future in as_completed(futures):
            try: rows.append(future.result())
            except Exception as error: errors.append({'id': futures[future], 'error': str(error)})
            done = len(rows) + len(errors)
            if done % 250 == 0 or done == COUNT:
                print(json.dumps({'processed':done,'verified':len(rows),'failed':len(errors),'seconds':round(time.monotonic()-start)}),flush=True)
    if errors:
        print(json.dumps({'errors':errors},indent=2),file=sys.stderr)
        raise RuntimeError('Some files failed; no manifest was written. Inspect and rerun.')
    rows.sort(key=lambda row: row['id']); manifest = make_manifest(rows)
    tmp = DEST / '.manifest.json.part'
    with tmp.open('x', encoding='utf8') as output: json.dump(manifest,output,separators=(',',':'))
    if target.exists(): raise RuntimeError('Manifest appeared during generation')
    os.rename(tmp,target)
    print(json.dumps({k:manifest[k] for k in ['count','root','uniqueContentUris','totalBytes','minFileBytes','maxFileBytes','over30000Bytes']},indent=2),flush=True)
    print('Average image bytes:',round(statistics.mean(row['fileBytes'] for row in rows)),flush=True)

if __name__ == '__main__': main()
