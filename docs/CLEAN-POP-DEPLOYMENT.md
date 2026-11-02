# Clean Pop V1 deployment status

The approved 10,000 PNGs are packaged under `assets/ethscriptions/clean-pop-v1/` at 1536×1536. All files were decoded, checked for duplicate pixels, copied byte-for-byte, and verified against their ordered SHA-256 Merkle proofs. `manifest.json` includes source-file hashes, pixel hashes, exact data-URI hashes, sizes, and proofs.

## Implemented

- Separate `api/lib/clean-pop-minter.sol`, Solidity 0.8.20, immutable artwork root.
- Public mint starts paused and can be paused by the configured creator.
- Existing legacy-minted token numbers cannot be sold through the public Clean Pop mint.
- Creator-only replacement delivery to an explicit recipient, no mint price, project pays transaction gas. Works while the public sale is paused.
- Per-token and per-legacy-ID replay protection; reentrancy guard; creation event precedes payouts.
- Manual eligibility model: the creator MUST verify the legacy ID, piece number and current holder off chain. The contract does NOT prove those ownership facts.
- Separate deployment UI: `/classic/pages/clean-pop-setup.html`. It checks exact deployed runtime, saves pending transactions, and requires creator wallet approval.

## Verified locally

`cd dev/clean-pop` then `npm ci --ignore-scripts`, `npm run build`, `npm test`.

The Ganache simulation covers paused sale, owner-only controls, legacy reservation, exact payload events, incorrect price/art, repeated public mint, and project-paid delivery/replay. Its Shanghai gas figures are NOT a current mainnet quote. Mainnet estimates must come from a current RPC.

## Mainnet deployment verified

Clean Pop V1 was deployed to `0x11019B7af0F833f5695a44584c5B31Bb1D0baabC` in transaction [`0xe14f013e5a3d28d368e01384e5dcb1351417cccc3a1da3d1499e2ec8eae6a77a`](https://etherscan.io/tx/0xe14f013e5a3d28d368e01384e5dcb1351417cccc3a1da3d1499e2ec8eae6a77a). The deployment page verified the exact runtime. Public minting remains paused.

## Original-minter reissues

The creator can now use `/classic/pages/clean-pop-delivery.html` to deliver the matching Clean Pop piece to a manually verified recipient. The page only permits the 12 indexed legacy mint records in `assets/data/clean-pop-legacy-mints.json`; it fetches the exact approved PNG and Merkle proof, checks the paused/legacy/replay state on-chain, simulates the transaction, and then asks the creator wallet to approve it. Each delivery uses the legacy Ethscription creation transaction as the permanent replay-protected claim ID. The old asset stays untouched.

The original minter policy is a manual policy: verify each claimant and destination wallet before clicking the delivery button. Record the resulting Clean Pop transaction hash with the claimant record. Do not enter a recipient based solely on an unauthenticated message.

## Not completed — do not enable public sales yet

- Independent Ethscriptions indexing of a first confirmed replacement.
- Versioned public checkout integration and legacy recovery regression testing.

Keep `PHUNK_MINT_ENABLED=false`. This existing variable still controls the LEGACY checkout. This deployment page does not automatically migrate the checkout.

## Deployment

The deployment is complete. Use `https://trixmoji.netlify.app/classic/pages/clean-pop-setup.html` only to verify the deployed runtime. Never use the legacy `phunk-setup.html` for this collection.
