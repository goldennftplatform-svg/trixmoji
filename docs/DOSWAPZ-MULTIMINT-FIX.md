# Wallet connection stall / multi-select checkout patch

The reported screenshot stops at wallet selection, before artwork reservation or transaction approval. The browser has several injected wallet extensions and two entries labeled MetaMask. This is not evidence of a contract batch-mint failure.

Merge the latest changes from `goldennftplatform-svg/trixmoji`:

- `assets/js/core/ethscription-checkout.js`: prefer EIP-6963 identities, avoid legacy provider aliases when announced wallets exist, request accounts directly inside the wallet button click, and report pending requests / connection timeouts.
- In the Phunks click handler in `classic/pages/ethscriptions.html`, show “Wallet connected. Checking Ethereum mainnet…” after choosing a provider, and use `EthscriptionCheckout.requestAccounts(eth)` rather than a raw `eth_requestAccounts` call.

**Preserve DOSWAPZ's own `/api/phunks` routing, `phunkAsset` URL normalization, and gallery configuration. Do not overwrite the customized HTML or checkout configuration wholesale.** The reference uses its own same-origin backend; DOSWAPZ must retain its proxy.

Update the checkout script cache version and deploy DOSWAPZ production. The companion Netlify deployment alone does not update JavaScript served from doswapz.com.

Expected sequence for four covers:

1. Select covers, click MINT 4, choose the intended wallet.
2. Approve connection if requested. Already-connected wallets may not show a connection popup.
3. Check network, reserve artworks, estimate the first mint.
4. Review price/gas on the PAGE and click CONTINUE TO WALLET.
5. Approve that piece's transaction. Wait for receipt and indexing.
6. Repeat the review and transaction approval for each remaining piece.

This is four sequential transactions, not four Ethscriptions in one Ethereum transaction. If a previous request is pending, open the extension icon and resolve it; don't clear payment history or send duplicates. If the UI is still stuck, capture the visible status and browser console error, noting the exact wallet extension selected. This patch improves the connection path and diagnostics; the original user's specific extension behavior still requires a live retest.

Verification: 23 Node tests pass, including four sequential mocked submissions/reconciliations, wrong-network/account checks, pending-wallet requests and timeouts. Browser check confirms only one MetaMask entry with EIP-6963 plus a legacy wrapper, and the pending-request explanation displays without sending a payment.
