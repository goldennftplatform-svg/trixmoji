# Trix Hunt settlement — local tests only

This is an unaudited accounting experiment, not deployment-ready. It does not
connect to the browser game. No network deployment is included or intended.

## Model and integration

- Construct with an explicitly trusted operator, three **fixed test-only wei**
  prices (pack indices 0, 1, 2; conventionally $5, $7.50, $10), and a timeout
  in seconds (1 to 30 days). Prices must be positive multiples of ten wei.
  These values do not fetch or represent a live USD rate. A real product needs
  a separately designed oracle, freshness checks, rounding and quote policy.
- A wallet calls `startRound(sessionId, pack)` with the exact price. Use a
  cryptographically random nonzero bytes32 session ID; it is globally unique
  for the lifetime of this contract. Read `prices(pack)` and confirm the
  `RoundStarted` event and deadline before beginning play. There are ten shots.
- Before the deadline, the operator calls `finalizeRound(sessionId, shotsUsed,
  resultHash, claimedCapturedIds)`. The operator is fully trusted to report
  shots and captures honestly. At most one unique, nonzero claimed ID per used
  shot is accepted; the IDs are **unverified assertions**, not prizes awarded,
  inventory reservations, ownership proofs or transfer instructions. The hash
  is opaque: integrations must define and publish a canonical result encoding,
  including session and gameplay data, before computing it; the contract does
  not validate its contents. Observe `RoundFinalized` for the assertion.
- Finalization credits `(price / 10) * (10 - shotsUsed)` to the player and the
  rest to the operator. Either party calls `withdraw()` for their accumulated
  credit. A failed payment leaves credit intact. After the deadline anyone can
  call `expireRound(sessionId)` to credit the full price to the player; operator
  finalization is no longer possible. Settlement and expiry are one-shot.
- The contract has no inventory, claim function, asset transfer, owner lookup,
  or live price feed. A separate trusted service must verify actual available
  inventory, reserve it, handle delivery and confirm indexed ownership. A result
  event cannot prove that an ID exists or that delivery succeeded. Concurrent
  sessions can assert the same ID; reconciliation is entirely external.

Ethscriptions are indexed from calldata/events, not ERC-721 balances. Under
[ESIP-1](https://docs.ethscriptions.com/esips/accepted-esips/esip-1-smart-contract-ethscription-transfers),
an event constitutes a transfer only when the emitting contract actually owns
the ID according to the protocol indexer. [ESIP-2](https://docs.ethscriptions.com/esips/accepted-esips/esip-2-safe-trustless-smart-contract-ethscription-escrow)
explains that contracts cannot independently identify valid depositors and uses
conditional transfers; emitting an event alone does not prove success. This
prototype intentionally implements neither escrow nor protocol transfer events.
Do not send Ethscriptions to it; they cannot be recovered using this API.

Further work before any real-money use includes independently reviewed custody
and delivery, indexer confirmations and reorg handling, trusted-operator and
availability risks, fair/verifiable game outcomes, transaction UX, and a proper
pricing system. Operator discretion can consume all paid shots without gameplay;
expiry only protects rounds that remain unfinalized.

## Tests

The surrounding game has no Solidity test toolchain. With Node.js and npm,
install test dependencies outside the repository and point the test at them.
For example, in PowerShell (adjust the existing temporary parent as needed):

```powershell
npm install --prefix "$env:TEMP\trix-hunt-test" solc@0.8.30 ethers@6 ganache@7 --no-save --no-package-lock
$env:TRIX_TEST_DEPS="$env:TEMP\trix-hunt-test"
node --test DOSWAPZ/trix-hunt/contracts/settlement.test.cjs
```

Tests compile locally and use an in-memory Ganache chain; no RPC or deployment
to a network is required. The suite covers exact payments, invalid input,
operator authorization, replay, multiple rounds, all/zero/partial shots,
expiry, accounting, failed payouts and reentrant withdrawal attempts.
