# HD display previews

All 10,000 supplied source PNGs in `TRIX-PHUNKS/assets-v2` are 960×960. The existing mint PNGs are smaller (256×256). Enlarging the mint files cannot recover the source detail, so the explorer now displays lossless WebP copies of the full-resolution source art instead of using AI upscaling.

- HD URL: `/assets/ethscriptions/phunks/hd/{id}.webp`
- Mint image URL: `/assets/ethscriptions/phunks/img/{id}.png`
- IDs: 0 through 9999
- 10,000 decoded WebPs pixel-verified against the source originals
- Total WebP payload: 510,730,966 bytes (~487 MiB)
- Manifest: `assets/ethscriptions/phunks/hd/manifest.json`
- Explorer: `/classic/pages/phunk-market-preview.html`

HD previews are display assets. **No mint PNG, Merkle leaf, deployed contract, or existing on-chain content was changed.** Each detail panel links separately to the HD preview and the actual mint image. Replacing an already-inscribed image is not possible through this display update.

## Regenerate

With the original V2 source folder alongside DOSWAPZ:

```sh
python -m pip install Pillow
python dev/scripts/build-phunk-hd.py --workers 8
```

The script writes only the `hd/` directory, validates dimensions and exact decoded RGBA pixels, and publishes the full manifest only after all 10,000 succeed. `--limit 16` makes a small test batch without replacing the full manifest. Pillow must have WebP support. Netlify serves the committed files; regeneration is not part of its build.

The explorer loads 40 cards per page, lazy-loads images, and falls back to the mint PNG if an HD file fails. The local ten-piece sandbox uses the same HD source previews, while ownership remains simulated.

## DOSWAPZ integration

If the developer's separate DOSWAPZ frontend needs the sharper art, resolve HD URLs against `https://trixmoji.netlify.app`, and fall back to the corresponding mint PNG. Label them as source-art previews, not newly-upgraded on-chain content. Never replace `picture.uri` or the bytes passed to the existing mint contract with HD preview data: that would invalidate the artwork proof.
