# Copy/paste: connect DOSWAPZ to the hosted Phunks mint and wallet gallery

TRIXMOJI PHUNKS are Ethereum Ethscriptions, not ERC-721 or ERC-1155 tokens. A wallet's ordinary NFT tab may not display them. Ownership is read from the Ethscriptions protocol indexer; no self-hosted node is required.

Our mint and purchase records live on `https://trixmoji.netlify.app`. Please keep this as the single checkout/order backend. DOSWAPZ and this Netlify site do not share account cookies or local browser storage.

## Minimal integration — paste these links on the DOSWAPZ collections page

```html
<div class="row">
  <a class="btn" href="https://trixmoji.netlify.app/ethscriptions/past#collections">
    MINT TRIXMOJI PHUNKS
  </a>
  <a class="btn" href="https://trixmoji.netlify.app/ethscriptions/past#mine">
    MY PHUNKS · CONNECT WALLET
  </a>
</div>
<p>
  Ethereum Ethscriptions. Connect your minting wallet to view purchases,
  artwork, and indexed ownership. These may not appear in your wallet’s
  standard NFT tab. No site account or signature is needed to view this
  public gallery; minting does require a paid transaction.
</p>
```

Wait for the gallery update to finish publishing on Netlify before testing the second link. On the MY COLLECTION tab, click CONNECT WALLET · VIEW MY PHUNKS, then choose the wallet used to mint.

This view reads settled purchase records from the backend, not just browser localStorage. It works after clearing browser history or connecting from another device. Each receipt has artwork, a transaction link, and an Ethscription explorer link. Current ownership is independently checked:

- IN THIS WALLET: the indexer currently identifies the connected wallet as owner.
- NOW IN ANOTHER WALLET: the purchase record remains but ownership has changed.
- CURRENT OWNERSHIP UNAVAILABLE: the indexer failed; do not interpret the purchase receipt as verified present ownership.

This is a public purchase gallery, **not an authenticated account login**. It only includes settled purchases made on this mint site; incoming transfers and purchases made elsewhere are not discovered by this endpoint.

## If you want the gallery rendered inside DOSWAPZ itself

The link integration above requires no backend changes. An embedded or native gallery is additional work:

1. Native integration: add a server-side DOSWAPZ proxy to the fixed upstream endpoint `https://trixmoji.netlify.app/api/ethscriptions?wallet=ADDRESS&page=0`; validate ADDRESS as a 20-byte Ethereum address, bound page to a non-negative integer, set a timeout, and forward only public gallery data. Never accept a caller-controlled upstream host.
2. Connect the wallet on DOSWAPZ and use that address to request the proxy. No private keys or payment signatures are needed for a read-only gallery. Render `gallery.items` safely with textContent and validated image/link URLs.
3. Artwork preview URLs from the API are root-relative. Resolve them against **https://trixmoji.netlify.app**, not doswapz.com. Otherwise the image may 404 or show a stale file.
4. Do not display the purchase-history list as full wallet holdings. Honor the ownership status and explain the incoming-transfer limitation.
5. Do not copy the Netlify order store into an independent DOSWAPZ backend; it will diverge. Do not share user account cookies between domains.

Direct cross-origin browser fetch is not configured; use the fixed server proxy or simply use the links. Cross-origin iframe embedding is currently blocked by the mint site's `X-Frame-Options: SAMEORIGIN`. Do not paste an iframe without coordinating the embedding headers and wallet behavior first.

## Confirmed first mint

- Piece: #419
- Creation transaction: `0x68f93845ad5afd466664a88223b1bd61f7f02988cd3bb600030ff430705771ea`
- Initial/current owner at verification: `0x47cf60bdd877203264921d05ce26f81f6d36aa3e`
- Creator contract: `0x64a0ca6fe1f944de3210a64bd1dab0619725281d`
- Artwork: https://trixmoji.netlify.app/assets/ethscriptions/phunks/img/419.png

The independent indexer returned the creation, image content, and owner successfully. Wallet gallery visibility is separate from on-chain ownership.
