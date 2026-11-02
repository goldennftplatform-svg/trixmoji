# Artwork Resolution Finding

The supplied V2 files are 960×960, while the current mint PNGs are 256×256. Pixel-for-pixel conversion proved that the V2 files are faithfully preserved in `assets/ethscriptions/phunks/hd/`, but canvas dimensions alone did **not** prove a higher-detail rendition of the emoji artwork.

The collection explorer intentionally uses the verified mint images at `/assets/ethscriptions/phunks/img/{id}.png`. It must not claim that the V2 files are HD upgrades or use them for a new mint without a separate art-direction and visual-quality review.

No mint PNG, Merkle leaf, deployed contract, or existing on-chain content was changed by the V2/WebP experiment. Existing Ethscriptions cannot be overwritten.

## Before Any New Collection

1. Obtain artist-approved replacement masters, not merely larger canvases.
2. Review representative pieces at intended display and native image size.
3. Get written approval that the art is the intended replacement collection.
4. Generate a new manifest, Merkle root, contract, and test mint from those approved bytes.
5. Verify an indexed on-chain test mint before any public sale or replacement program.
