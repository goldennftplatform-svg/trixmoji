# Copy/paste handoff for the DOSWAPZ developer

Please deploy the updated DOSWAPZ project from:

https://github.com/goldennftplatform-svg/trixmoji

Branch: `main`. The repository root is the website root, not a nested DOSWAPZ directory.

## 1. Update the existing DOSWAPZ Netlify site

Use the current site so its domain, account sessions, environment configuration, and Netlify Blobs order/account data stay associated with the deployment. Back up the `doswapz-ethscriptions` store's `board` blob first. If this is a new Netlify site, explicitly migrate required stores and settings; connecting the domain does not migrate them.

Netlify settings (already in netlify.toml):

```text
Production branch: main
Base directory: [leave blank]
Build command: npm ci --omit=dev
Publish directory: .
Functions directory: netlify/functions
Node version: 20
```

Deploy the entire updated project, including the functions, lockfile, minter data, and Merkle leaves. Uploading only ethscriptions.html is insufficient. Preserve existing environment variables for unrelated DOSWAPZ features.

Set these variables in Netlify for the functions/runtime environment:

```text
PHUNK_MINT_ENABLED=false
ETHSCRIPTIONS_INDEXER_URL=https://api.ethscriptions.com/v2
```

Optional but recommended:

```text
ETH_RPC_URL=[your Ethereum MAINNET RPC URL]
WALLETCONNECT_PROJECT_ID=[your public Reown project ID]
```

Do not enter the bracketed placeholders literally. If omitted, Ethereum RPC uses the public fallback and injected Ethereum wallets still connect. WalletConnect QR is only offered when its project ID is configured. Allowlist https://doswapz.com and any test origin in Reown, then test a real mobile session.

Run:

```sh
npm ci --ignore-scripts
npm run test:mint
npm run audit:mint
npm run audit:mint -- --rpc --contract-checks
```

The audit sends no blockchain transactions. The RPC checks use simulated state for an undeployed contract.

## 2. Contract configuration — confirmed creator

```text
Network: Ethereum mainnet
Chain ID: 1 (0x1)
Creator / 99.5% mint revenue:
0x915A3D363D0a4e4470B531f008F5142c540E5417

Site fee recipient / 0.5%:
0x15e85a85B7026875d3529EF0c6de2723C285DA11

CREATE2 factory (deployment only):
0x4e59b44847b379578588920ca78fbf26c0b4956c

Expected minter (buyer mint transactions go here):
0x64a0ca6fe1f944de3210a64bd1dab0619725281d

Supply: 10,000
Max per wallet: 20
Mint price: 0.0002 ETH (200000000000000 wei)
Artwork root:
0x6e2506cf02e828690386f45b90d7e0cfc4b0b74e0e8242a348436dd0f8074133

Expected deployed-runtime Keccak-256:
0x0496f85d4fcde8ce78dfd8a78f4502ebda8a118504a61d53c0d59161f9a85b0d
```

Use the existing `api/lib/phunk-minter.sol`, `api/lib/phunk-leaves.bin`, and `assets/data/phunk-minter.json` together. Do not put the factory address in the minter field. Do not swap in the high-resolution assets-v2 images: the current manifest commits to the website's encoded PNGs. Changing artwork, payout addresses, price, or limits requires rebuilding and revalidating the applicable contract artifacts; contract constants cannot be changed after deployment.

## 3. Deploy the contract through the creator wallet

After the website deployment, open:

https://doswapz.com/classic/pages/phunk-setup.html

1. Connect the creator wallet shown above on Ethereum mainnet.
2. Click CONNECT CREATOR · ESTIMATE GAS.
3. Review displayed addresses, artwork root, and the current gas estimate.
4. Click DEPLOY CONTRACT · WALLET APPROVAL and approve in the wallet.
5. This transaction sends **0 ETH value** to the factory, with the supplied deployment data; gas is still charged. It creates the minter, not the 10,000 artworks.
6. Save the transaction hash. Wait for confirmation, then click CHECK DEPLOYMENT.
7. Run `npm run audit:mint -- --rpc` again. Require `deployed: true` and `runtimeMatchesArtifact: true`. Also verify source/runtime correspondence before opening sales.

If deployment is pending or wallet submission has an unknown outcome, inspect its transaction before retrying. Do not increase gas to try to fix an initcode size error; this deployment's initcode is only 1,999 bytes.

## 4. Enable checkout, test one mint, then announce

Set in Netlify and redeploy:

```text
PHUNK_MINT_ENABLED=true
```

This enables public site purchases; it is not a private testing mode. Alternatively, enable the variable on a deploy preview for a controlled checkout check, noting that the contract/payment still uses real Ethereum mainnet.

Open:

https://doswapz.com/ethscriptions/past#collections

Mint one piece from a wallet with ETH for price plus gas. Verify:

- Correct 0.0002 ETH mint value, sent to the minter address.
- Successful receipt with two confirmations and the correct creation event.
- Ethscriptions indexer recognizes the transaction, content, creator contract, and buyer as initial owner.
- Creator receives 0.000199 ETH; site receives 0.000001 ETH.
- Cover reveals and the saved mint remains after refresh.
- Checking a saved mint does not open a new payment prompt.

Pause new website purchases with `PHUNK_MINT_ENABLED=false` and redeploy if needed. Reconciliation stays available. This pauses the site's checkout, not direct calls to the public contract, which has no pause function.

## 5. What changed / what not to promise

- Restored wallet chooser, network/account checks, per-piece gas review, and optional real WalletConnect.
- Fixed the PNG-buffer bug, removed the order-history reset, preserved late-confirming orders, and added conditional Netlify Blobs writes.
- Added saved-transaction recovery and protocol-aware indexer verification.
- Buyers mint directly into their wallet in the purchase transaction. No escrow key, automated inventory-transfer worker, or self-hosted node is required for this collection.
- The old separate `phunkPay` escrow-payment route is disabled. Do not restore the old pay-then-mint flow.
- Generic escrow listings elsewhere on DOSWAPZ still need escrow release; they were not converted to automatic settlement.
- Each Ethscription requires its own transaction. Selecting 20 is not a one-transaction batch mint.
- This is a site reveal, not secret art: original public image URLs and on-chain payloads remain discoverable.
- This is Ethereum Ethscriptions, not a Robinhood/Solana launch or automatic TRiX marketplace listing.
- Real mobile WalletConnect, hosted storage contention, contract deployment, and an actual paid/indexed mint must be verified in deployment. Local tests and simulations do not replace those steps.

The expanded technical notes and sampled gas estimates are in docs/phunk-launch.md.
