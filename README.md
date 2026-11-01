# DOSWAPZ · TRIXMOJI PHUNKS

Existing DOSWAPZ website and Netlify serverless API, with the repaired Ethereum Ethscriptions checkout. The website project lives at this repository's root.

## Netlify

Import this repository into the **existing DOSWAPZ Netlify site** if retaining its domain and stored account/order data. Creating a different Netlify site does not automatically migrate its Blobs stores.

- Production branch: `main`
- Base directory: leave blank (repository root)
- Build command: `npm ci --omit=dev`
- Publish directory: `.`
- Functions directory: `netlify/functions`
- Node version: `20`

These settings are already declared in `netlify.toml`. Keep existing site environment variables and add the mint settings from `.env.example`:

```text
PHUNK_MINT_ENABLED=false
ETH_RPC_URL=<Ethereum mainnet RPC URL, optional public fallback>
WALLETCONNECT_PROJECT_ID=<public Reown project ID for mobile QR connection>
ETHSCRIPTIONS_INDEXER_URL=https://api.ethscriptions.com/v2
```

Never commit `.env`, credentials, private keys, or `.data` account/order state.

## Mint setup

- Collection: `/ethscriptions/past#collections`
- Creator deployment screen: `/classic/pages/phunk-setup.html`
- [Launch instructions, costs, tests, and remaining verification](docs/phunk-launch.md)

The launch defaults to paused. Deploying the website does **not** deploy the Ethereum contract. The creator explicitly approves that separate transaction in their wallet. Verify deployment and a real purchase before announcing the launch.

## Local checks

```sh
npm ci --ignore-scripts
npm run test:mint
npm run audit:mint
npm run audit:mint -- --rpc --contract-checks
node dev/scripts/preview-mint.cjs
```

Read-only local preview: http://127.0.0.1:8894/ethscriptions/past#collections

The tracked artwork under `assets/ethscriptions/phunks/img/` matches the configured contract manifest. Keep the artwork, Merkle leaves, Solidity source, and deployment configuration synchronized. The separate high-resolution V2 package is not substituted into this manifest.
