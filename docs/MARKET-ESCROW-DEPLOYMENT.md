# TRIXMOJI market escrow deployment

This is the separate Chopper/Ethereum-Phunks-based resale and auction contract from the companion fork's `trixmoji/contracts/TrixmojiMarket.sol`. It is **not** the already-deployed Clean Pop mint contract. No escrow deployment is performed by building the project or opening this document.

## Constructor addresses

- Creator and 2.5% royalty recipient: `0x915A3D363D0a4e4470B531f008F5142c540E5417`
- Separate immutable verifier, supplied by the operator: `0x5f5d219c6B3f732eBDCe4BFD9c4655957Ff472C4`
- Ethereum mainnet chain ID: `1`
- Reviewed creation-bytecode hash: `0xc18f4597e4b6f88db18ca526cefda84615bc18159f7b3545bd2029bb9c2aa468`
- Compiler: Solidity `0.8.20+commit.a1b79de6`, optimizer 200, Shanghai target.

The verifier is immutable: verify the operator controls that address and can use it for the protected signing service **before approving deployment**. Never send a private key or recovery phrase to this page or in chat.

## Deployment procedure

1. Resolve any pending creator-wallet transactions first. Open `/classic/pages/market-escrow-deploy.html` in a browser with the creator wallet available.
2. Connect the creator on Ethereum mainnet. Confirm the immutable verifier address belongs to the operator and will be available to the protected service.
3. Click **PREPARE ESCROW DEPLOYMENT**. Preparation checks the creator, chain, creation-bytecode hash, creator's pending/latest nonces, the tentative CREATE address, available balance and gas estimate. It sends nothing.
4. Review the full creator, verifier, gas estimate and tentative address. The address can change if the creator's nonce changes before the transaction. Click **APPROVE DEPLOYMENT IN WALLET** and approve the transaction once. The transaction has zero ETH value plus gas.
5. Save the transaction hash and use **VERIFY DEPLOYMENT**. Verification checks the sender, creation input hash, receipt, created address, code, `creator()`, `verifier()` and 250 basis-point royalty. The displayed runtime hash must be pinned when configuring the service. The verifier's actual signing service, indexer and UI are **not** created by deployment.
6. If a submitted transaction has no returned hash, inspect wallet Activity and resolve any open approval. The page's no-hash recovery checks the creator's original nonce and tentative address before clearing the local intent; pending-count checks cannot see every private or smart-wallet request. Never retry while the transaction's outcome is unknown.

## Before depositing real pieces

The fork's sandbox and local EVM tests are not proof of live settlement. The hosted service needs a protected signer controlled by the configured verifier, authenticated requests, atomic rate limits, the Clean Pop provenance registry, a current Ethscriptions indexer, listing discovery, and the real-wallet UI. The separate resale contract should be independently reviewed, and a deliberately selected asset with consenting wallets should be used for the first end-to-end deposit, five-block cooldown, listing, purchase, indexed transfer and credit withdrawal test. Do not send real pieces to a new market address before those pieces are in place.

Sale proceeds are credited on-chain for withdrawal: 97.5% seller and 2.5% creator. Auctions need a settlement transaction after expiry. The code is GPL-3.0 with the upstream Ethscriptions escrow implementation retained under its MIT notice; consult the companion repository for attribution.
