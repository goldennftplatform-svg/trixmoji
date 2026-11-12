# Trix Hunt local playtest

Run from the repository root with `node trix-hunt/server/leaderboard.cjs` and open
`http://127.0.0.1:8787/trix-hunt/`. The loopback-only development server supplies
the game, collection assets, and local simulated leaderboard.

This prototype runs entirely in the browser. Prices, refunds, inventory and
prizes are simulated: it does not connect a wallet, accept payments, reserve
inventory, transfer Ethscriptions or provide provably fair outcomes. The demo
pool uses collection metadata, not verified escrow ownership. Its best tier is
the simulated rank-1 CRACK inventory; other items use their best metadata rank.
Percentages are per successful hit. Each pack has ten shots. The playtest is
single-player: ammo choice controls both prize odds and target difficulty.
Each round has ten target opportunities. Targets shrink and escape after three
seconds for bullets, 2.3 seconds for shotgun, or 1.6 seconds for sniper. An
escaped target does not consume a shot; remaining simulated credits are
automatically refunded at the end along with the round's captured-prize summary.

`engine.js` separates simulated round accounting from `game.js` presentation.
Before any live-money version, replace the client-side engine and demo inventory
with independently reviewed, server- and protocol-aware settlement, custody,
randomness, refund and Ethscription indexing systems. Never treat the current
browser state as authoritative. The future domain is `trixhunt.aisp.live`;
this prototype does not configure DNS or deployment.

The leaderboard persists locally, automatically records completed rounds, and
ranks hits then accuracy. Names and results are unauthenticated simulations and
must not be trusted for real prizes. A separate fixed-price test contract exists
under `contracts/`; it is not connected to the game, custody or live USD rates.

The inventory admin at `/trix-hunt/admin.html` requires a server-verified
creator or escrow-verifier wallet signature. It shows only the creator's indexed marketplace
deposits and saves ordering centrally. This ranking does not change the demo
game, authorize deposits, approve payments or transfer prizes. Marketplace
deposits must not be treated as game prizes without a separately authorized,
independently verified allocation and transfer flow.

Run the local checks with `node --test trix-hunt/engine.test.cjs trix-hunt/inventory.test.cjs trix-hunt/server/leaderboard.test.cjs`.
