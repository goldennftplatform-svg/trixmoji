# Shared online playtest

The public Sepolia playtest uses `/.netlify/functions/trix-hunt-beta` and a separate
Netlify Blobs store for simulated rounds and a shared leaderboard. Each round
has ten shots; a hit selects a simulated prize tier using the selected pack's
4%, 50% or 80% best-tier probability. Players purchase with Sepolia test ETH;
unused-shot credit requires a settlement transaction and a separate withdrawal.
Captured cards are simulated. The server stores an opaque session-token hash, uses conditional
writes and makes shot retries idempotent. The online demo pool resets per round;
it is not the market escrow or the Sepolia vault.

Hit detection is reported by the browser and player identities are not verified.
Scores, randomness and simulated refunds are therefore not proof of fair play
or ownership. The payment contract is Sepolia-only; game outcomes are self-reported
and it does not deliver Ethscriptions. Do not use this test design for real-money
or real-prize settlement. Interrupted rounds can be resumed on the same browser;
already-escaped targets are stored locally and an interrupted target can reappear.

The loopback-only development server and Sepolia experiments are separate from
the deployed online playtest. Test the shared service with
`node --test trix-hunt/beta-service.test.cjs`.
