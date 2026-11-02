# Secondary market test lab

The existing Ethereum mainnet mint is unchanged. A separate, local-only resale/auction lab is available in:

https://github.com/goldennftplatform-svg/ethereumphunks.com/tree/market/trixmoji

Auction reference fork:
https://github.com/goldennftplatform-svg/auction-house/tree/main/trixmoji

Run `npm ci --ignore-scripts`, `npm test`, and `npm run sandbox` from the companion project's `trixmoji` directory. Open http://127.0.0.1:8895 on that computer.

## 10,000-piece collection explorer

The public catalogue below has artwork #0–9999 with trait filters. The local interactive lab has **10 test pieces (#0–9)** for easier escrow testing: Seller has six, Buyer and Bidder each have two; Friend starts empty and can receive gifts through SEND TO FRIEND. Use MY WALLET, MY ESCROW, FOR SALE, AUCTIONS, and ALL PIECES. Deposit automatically advances five local cooldown blocks by default. RESET 10 TEST PIECES restores starting assets and fake balances. These are simulated assets, not existing mainnet inventory.

A legacy Phunks catalogue is included at:

https://trixmoji.netlify.app/classic/pages/phunk-market-preview.html

The separate Clean Pop V1 catalogue is available at:

https://trixmoji.netlify.app/classic/pages/clean-pop-market.html

It now uses the original full collection-explorer GUI: trait sidebar, multi-select filters, search, sorting, 40-card pagination, enlarged images, and clickable trait frequencies. It renders approved Clean Pop artwork while retaining the supplied V2 trait catalogue matched by piece number. It is read-only and does not sign transactions or claim ownership/listings. The original polished trading interface remains intact in the companion project's `trixmoji/web/` directory and runs at `http://127.0.0.1:8895/`; its `/collection` route opens the trait explorer. That local trading lab has not been converted into a live-wallet Netlify resale service.

This URL updates after Netlify publishes the corresponding commit. It now has 10,000 real artwork previews, 40-card pagination, ID/trait/token search, multi-select trait filters, sorting, enlarged images, and trait frequencies. Multiple selected values within one category are OR; different categories are AND. The 315 trait values across 12 categories come from the supplied V2 metadata. This is not a value estimate or rarity rank. The catalogue accepts no payments, has no wallet signer, and does not claim artwork is minted or offered for resale. The separate PRIMARY MINT link leads to the existing real-money mint.

The compact trait catalogue is committed as `assets/data/phunk-catalog.json` (~561 KB). Regenerate with `node dev/scripts/build-phunk-catalog.cjs` when the sibling `TRIX-PHUNKS/assets-v2` metadata is available. Netlify uses the committed index and does not need the original metadata folder at build time. Metadata royalty fields are deliberately excluded from pricing.

## Small live pilot, after production work is completed

Showing 1,000 pictures does not require pre-minting them. Selling a particular piece requires it to exist as an Ethscription, be owned by the seller, and be deposited into the verified resale contract.

Before a live pilot, the missing production wallet adapter, protected verifier service and listing index must be implemented; the contract needs review and separate deployment. Then begin with one already-minted, explicitly selected piece and two consenting wallets. Verify the deposit and five-block cooldown, actual indexed custody, price and 2.5% royalty, seller-authorized listing, purchase, indexed buyer ownership, and seller withdrawal. Test cancellation/return separately. Auction settlement also needs a caller transaction after expiry.

Do not enable all 1,000 catalogue items as sales merely because their images exist. Gate live listing creation and quote signing to explicitly approved pilot asset IDs until the end-to-end mainnet behavior is proven. No mainnet resale address or production signer is configured by this preview change.

This test UI executes Solidity on a disposable local EVM using generated accounts/fake ETH. It demonstrates deposit, five-block cooldown, listing, buying, cancelling/returning, auctions, outbid refunds, settlement, royalties, and withdrawals. It does not connect a real browser wallet or move existing Phunks.

**There is no live resale address yet. Do not send your real Ethscriptions to the local sandbox contract address or to the mint contract as a resale deposit.**

Mainnet requires a reviewed separate resale-contract deployment, an immutable trusted verification signer with a protected signing service, protocol-aware deposit/current-owner verification, persistent listing discovery, a live wallet adapter, and a real deposit/buy/indexer check. The sandbox itself must never be deployed publicly. The companion README details these requirements.

The Crypto-Phunks auction contract is ERC-721-specific. Our Ethscriptions adaptation uses the Ethereum-Phunks escrow/ESIP-2 mechanism instead, preserving existing minted assets.
