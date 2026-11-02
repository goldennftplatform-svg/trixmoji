# Clean Pop Candidate Art

`dev/scripts/build-phunk-pop-candidates.py` deterministically renders review-only candidate artwork from the existing `TRIX-PHUNKS/build/src/pixels.bin` placement map and `pal-map.tsv` emoji mapping.

- Style: clean local color-emoji glyphs in framed pop tiles
- Output: 1536 by 1536 PNG
- Trait layout: the original 24 by 24 cell map is retained for every piece
- Credit use: none; rendering is local
- Output directory: `art-candidates/clean-pop-v1/` (gitignored)

Commands:

```sh
python dev/scripts/build-phunk-pop-candidates.py
python dev/scripts/build-phunk-pop-candidates.py --all
```

The default command creates a 20-piece approval set and contact sheet. `--all` renders the full 10,000-piece candidate set. The renderer is intentionally separate from `assets/`, the contract manifest, the legacy mint, and marketplace code.

## Status And Guardrail

The local full render has 10,000 files with IDs 0 through 9999 and each output is 1536 by 1536. This is a candidate art direction, not a replacement collection or an on-chain upgrade.

Before creating a new collection, approve representative output at full size, freeze the renderer/version/font environment, generate hashes and a new manifest, perform a real indexed test mint, and only then decide whether to offer replacements. Never substitute these images into the legacy mint manifest.
