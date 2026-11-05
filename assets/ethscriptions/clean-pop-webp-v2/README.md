# Clean Pop lossless WebP candidate

This separate, experimental candidate is generated from the Clean Pop V1
PNGs. Every image must pass a full decoded-RGBA comparison before publication
in this folder. It is not the existing V1 mint and does not alter V1 assets.

The candidate manifest commits to `data:image/webp;base64,...` URIs. It is a
local preparation artifact, not an approved or deployed mint contract. Before
relaunch, separately review the artwork, protocol uniqueness, contract,
wallet flow, creator approval, marketplace support and any legacy policies.

## Prepared candidate

- Pieces: 0–9999; every decoded RGBA image matched its PNG source.
- Candidate root: `0xfe6a7cece9e254f117607c2ef328ca17e47141be89c50a893d1547bc2bc838cc`
- Files: 10,000 unique WebP data URIs; maximum image size 29,492 bytes.
- Candidate source includes every number. Reservation policy is a property of
  the future contract and is not implemented by this artwork manifest.
- Verify exact file/URI hashes and all Merkle proofs with
  `node dev/clean-pop/verify-webp-v2.cjs` from the project root.
- Regeneration requires Python, Pillow with WebP support, and the approved V1
  PNG source files. The conversion script refuses to replace an existing
  manifest and checks existing WebPs before reusing them.

## Local minter candidate

The separate candidate source is `api/lib/clean-pop-webp-minter.sol` and its
build artifact is `assets/data/clean-pop-webp-v2-candidate.json`. It retains
the existing V1 creator, site, price, per-wallet limit, initial paused state,
and primary-sale split. It deliberately omits the legacy reservation and
replacement-delivery paths. This is a separate collection and does not modify
the deployed V1 minter or escrow.

The existing V1 mint remains unchanged. A separate candidate page is prepared
at `classic/pages/clean-pop-webp-v2-mint.html`, and a separate marketplace mode
uses `classic/pages/trixmoji-market.html?collection=webp-v2`. The WebP mint,
preflight, verification, inventory and marketplace functions target only the
candidate minter and use separate saved-request storage. The candidate creator
deployment and sale controls are at `classic/pages/clean-pop-webp-v2-setup.html`.
Mint and market operations fail closed if the exact candidate runtime is not
deployed. These pages and functions have not been published or enabled on
mainnet.

Run `node dev/clean-pop/check-webp-v2-mainnet.cjs` for a read-only deployment
simulation. The script verifies the deterministic factory, target address,
payload, runtime hash and candidate artwork root; it never signs or submits.
Verify sale terms, review and publish the candidate before deployment. Local
escrow tests use a mocked indexer and do not establish a live Ethscriptions
transfer or marketplace integration. Purchases and auctions still use the
existing wallet-session and verifier backend; that dependency is not removed.
