# Phunks launch — implementation and next steps

## Current target

DOSWAPZ's existing Ethereum mainnet Ethscriptions collection. This change does not move assets to RH or Solana and does not add a TRiX marketplace integration.

The minter accepts one artwork per transaction, creates it for the caller, and splits the purchase value 99.5% / 0.5%. No inventory signer or delivery worker is needed for this direct mint. Generic escrow listings elsewhere on this page still require escrow release; they have not been converted to automated settlement.

## Preview and checks

From the DOSWAPZ directory:

```sh
npm ci --ignore-scripts
npm run test:mint
npm run audit:mint
npm run audit:mint -- --rpc
npm run audit:mint -- --rpc --contract-checks
node dev/scripts/preview-mint.cjs
```

Preview: http://127.0.0.1:8894/ethscriptions/past#collections

The preview server is loopback-only, serves the real collection page and read-only API, and rejects POST. It does not load `.env`. Use the existing `start-site-server.js` for a full development server. The mint remains paused unless the backend environment explicitly enables it.

The audit checks all 10,000 website PNGs against the SHA-256 Merkle manifest, duplicate content, missing files, and the CREATE2 address. `--rpc` reads Ethereum and estimates gas. For an undeployed contract it uses RPC state overrides to simulate the runtime. `--contract-checks` also simulates valid mint, wrong price, invalid proof, already-minted token, and wallet-limit cases. None of these commands sign, submit, or spend funds. RPC providers must support state overrides for these simulations.

## Findings on November 1, 2026

- All 10,000 files in `assets/ethscriptions/phunks/img/` match the current manifest, with zero duplicates or missing files.
- All 10,000 supplied `../TRIX-PHUNKS/assets-v2/` files differ byte-for-byte from the website files. This is not proof of a visual difference. Do not replace the website images without regenerating the manifest and deployment artifacts together.
- The predicted minter address matches the deployment data: `0x64a0ca6fe1f944de3210a64bd1dab0619725281d`.
- At audit time there was no deployed code at that address. Estimated deployment: 490,823 gas, approximately 0.000021406 ETH at 0.043612541 gwei. This is a time-sensitive estimate, not a fee quote or a cost for 10,000 mints.
- Initcode is 1,999 bytes; artwork is now sent to the deployed minter in ordinary calls rather than embedded in deployment initcode.
- A second read-only simulation estimated the largest artwork (#133) at 3,033,322 gas: approximately 0.000129826 ETH at 0.042799878 gwei, plus the 0.0002 ETH mint price. This is one simulated sample, not a fixed price or an estimate for the entire collection.
- All five simulated contract checks passed. Runtime hash derived by executing the configured initcode with `eth_call`: `0x0496f85d4fcde8ce78dfd8a78f4502ebda8a118504a61d53c0d59161f9a85b0d`.
- Visual inspection of piece #0 shows a 256px website image and a 960px supplied V2 image of the same design. The audit compares encoded bytes, not pixel-level equivalence of all 10,000 images.

## Verification performed

- 16 Node regression tests covering checkout, history preservation, late reconciliation, indexer validation, and conditional storage conflicts.
- Browser test with a mocked wallet/API: select cover → gas review → one submitted transaction → confirmed reveal; purchase history survives refresh.
- Mobile layout checked at 390px width with no horizontal overflow.
- Operator setup tested with a non-creator wallet: deployment remained disabled and no transaction was sent.
- These tests used mocks or read-only RPC simulations; no real wallet transaction was submitted.

## Deploy and open

1. Keep `PHUNK_MINT_ENABLED=false` while staging. Back up the existing Netlify `doswapz-ethscriptions` / `board` blob before deployment. The read-time history reset has been removed.
2. Run the tests and full artwork audit. Decide whether the website's existing artwork or the separate V2 artwork is the intended final collection. A new root changes the contract bytecode and CREATE2 address.
3. Deploy the website/backend using the existing Netlify project. Use `npm ci --omit=dev`; the updated lockfile includes Netlify Blobs conditional writes. Confirm the host provides strong reads and conditional writes in a deploy preview.
4. Configure `ETH_RPC_URL` for Ethereum mainnet. The fallback is a public RPC. Configure `ETHSCRIPTIONS_INDEXER_URL` only if using a compatible V2 indexer; default is `https://api.ethscriptions.com/v2`.
5. Set `WALLETCONNECT_PROJECT_ID` to a Reown project ID, allowlisting the deployment origins there. This ID is public. Without it, injected Ethereum wallets work but the mobile QR option is not offered. Test the real QR session on a phone before advertising that support.
6. Open `/classic/pages/phunk-setup.html` with the configured creator wallet. Check recipient addresses and artwork root. Estimate deployment, then explicitly approve the one-time deployment in the wallet. The setup page never enables sales. Check the transaction and verify the deployed bytecode against the reviewed artifact/source.
7. Exercise a controlled mint after deployment, including two confirmations and independent indexer recognition, exact initial owner, content, and payout split. Mainnet minting costs real gas. The implementation has automated mock tests; these are not evidence of a successful real mint.
8. Set `PHUNK_MINT_ENABLED=true` and redeploy when opening. The collection is initialized if absent, without replacing any existing orders. The first reservation also checks the minter exists. Set false and redeploy to pause new site purchases; reconciliation of already-submitted transactions remains available. The public contract itself has no pause function.

## Purchase behavior

- EIP-6963 wallet discovery, injected-wallet fallback, optional genuine WalletConnect QR connection.
- Mainnet and account identity checked before preparing and immediately before submitting each transaction.
- Each cover has a gas review, followed by that wallet's approval. One Ethscription per transaction; selecting 20 is not one blockchain transaction.
- An intent is written to browser storage before wallet approval; returned hashes are immediately saved. Web Locks prevent simultaneous submissions from checkout tabs in the same browser. This is not a cross-device wallet lock.
- Unfinished transactions block another mint for that wallet in that browser until reconciled. Explicit user rejection is retryable. Unknown wallet outcomes remain saved for manual hash recovery.
- Submitted transactions are checked for receipt success, two blocks, expected sender/recipient/value/event, artwork commitment, and Ethscriptions V2 indexer recognition before revealing the piece. Initial ownership is verified at creation; later transfers do not erase the purchase record.
- Indexer delays or outages keep the order pending, rather than falsely claiming delivery. Retrying CHECK SAVED MINT never sends another payment.
- The pre-purchase uniqueness lookup reduces duplicate-inscription failures, but cannot atomically prevent an outside party from inscribing the same public content between that check and inclusion. The EVM contract cannot directly enforce the off-chain Ethscriptions index. Consider that protocol limitation before launch.
- Browser history survives refresh but not cleared storage or a device change. Keep transaction hashes. For a lost order ID, support can match the hash and buyer to retained backend orders.
- The backend preserves expired-order buyer information to reconcile late transactions and supersedes conflicting unfulfilled reservations only after a proven mint.
- Netlify board changes use strong reads and ETag conditional writes with bounded retries, preventing separate functions from silently overwriting each other's order changes.

## Reveal scope

The site shows covers before purchase and images after verified minting. This is a **website reveal**, not cryptographic secrecy. The old artwork URLs and the transaction payload are public. Wallet NFT galleries may not display Ethscriptions like ERC-721 NFTs; the Ethereum transaction and the Ethscriptions indexer are the evidence of creation/ownership.

## Not yet verified live

Contract deployment and source/bytecode verification, actual paid mint and indexer delivery, WalletConnect mobile session, and hosted Blobs contention. Existing project dependency advisories should be reviewed separately; no unrelated dependency sweep was performed.
