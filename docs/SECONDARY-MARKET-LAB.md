# Secondary market test lab

The existing Ethereum mainnet mint is unchanged. A separate, local-only resale/auction lab is available in:

https://github.com/goldennftplatform-svg/ethereumphunks.com/tree/market/trixmoji

Auction reference fork:
https://github.com/goldennftplatform-svg/auction-house/tree/main/trixmoji

Run `npm ci --ignore-scripts`, `npm test`, and `npm run sandbox` from the companion project's `trixmoji` directory. Open http://127.0.0.1:8895 on that computer.

This test UI executes Solidity on a disposable local EVM using generated accounts/fake ETH. It demonstrates deposit, five-block cooldown, listing, buying, cancelling/returning, auctions, outbid refunds, settlement, royalties, and withdrawals. It does not connect a real browser wallet or move existing Phunks.

**There is no live resale address yet. Do not send your real Ethscriptions to the local sandbox contract address or to the mint contract as a resale deposit.**

Mainnet requires a reviewed separate resale-contract deployment, an immutable trusted verification signer with a protected signing service, protocol-aware deposit/current-owner verification, persistent listing discovery, a live wallet adapter, and a real deposit/buy/indexer check. The sandbox itself must never be deployed publicly. The companion README details these requirements.

The Crypto-Phunks auction contract is ERC-721-specific. Our Ethscriptions adaptation uses the Ethereum-Phunks escrow/ESIP-2 mechanism instead, preserving existing minted assets.
