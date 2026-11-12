# Trix Hunt local playtest

Run from the repository root with `python -m http.server 8765` and open
`http://localhost:8765/trix-hunt/`. The server must expose the repository root
because the game loads the existing TrixMoji artwork and metadata by URL.

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

Run the engine checks with `node --test trix-hunt/engine.test.cjs`.
