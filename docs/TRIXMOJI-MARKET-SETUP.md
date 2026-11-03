# Trixmoji marketplace deployment configuration

The market preview uses the Ethereum mainnet escrow recorded in
`assets/data/trixmoji-escrow-deployment.json`. The public page is
`/classic/pages/trixmoji-market.html`. The market stays closed for new trading
unless the required server settings and launch switch are present.

Set these in the Netlify site's environment settings, with Functions access:

| Variable | Value / purpose |
| --- | --- |
| `ETH_RPC_URL` | An HTTPS Ethereum mainnet RPC endpoint, e.g. `https://ethereum.publicnode.com`. |
| `TRIXMOJI_MARKET_ENABLED` | `true` enables market reads after redeployment. |
| `TRIXMOJI_MARKET_VERIFIER_KEY` | Server-side secret for the verifier address `0x5f5d219c6B3f732eBDCe4BFD9c4655957Ff472C4`; use Netlify's sensitive value controls. Never place this in source files, browser code, or chat. |
| `TRIXMOJI_MARKET_LIVE` | Keep `false` until the deployment is reviewed and a controlled live test is authorized. `true` allows trading authorizations and enables the deposit control. |
| `ACCOUNT_SESSION_SECRET` | Existing private, stable account-session signing secret; changing it signs users out. |

Hosting the verifier's private key makes it a hot signing key accessible to the
server environment. The immutable verifier cannot be changed on this deployed
contract; if the operator will not use this key in the hosting environment, a
compatible external signer integration must be implemented before launch.

Redeploy after changing environment values. Confirm the function
`/.netlify/functions/trixmoji-market` reports the expected escrow-backed data;
it must report `tradingReady: false` while the launch switch is off. The user
must sign into the DOSWAPZ account with the same Ethereum wallet used for the
market before requesting purchase or auction authorizations. Do not deposit a
real piece merely to test the page while the verifier service is unavailable.

The first live test requires consenting seller and buyer wallets, gas, and a
chosen expendable-risk piece. Verify deposit, cooldown, listing, purchase,
indexed ownership, both credits and withdrawal; test an auction separately.
The escrow's creation transaction is
`0x8836df1e8e7a303e8321ee1bf3b2e5f866ca3b1eb789b57325781ef53745a3d9`.
