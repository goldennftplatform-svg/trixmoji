# Trix giveaway vault — local prototype

`TrixGiveawayVault.sol` is an unaudited, local-only experiment, with no network
deployment or frontend/settlement integration. Tests use in-memory Ganache and
test accounts only. Do not send real assets. It follows the conditional event
and five-block delay in the existing V2_1 `EthscriptionsEscrower.sol`; the
market's fallback records potential deposits rather than verifying ownership.
See [ESIP-2](https://docs.ethscriptions.com/esips/accepted-esips/esip-2-safe-trustless-smart-contract-ethscription-escrow).
Ethscriptions are indexed from transaction calldata and protocol events, not
ERC-721 tokens or on-chain ownership balances.

The selected future depositor and curator are both
`0x47cf60BdD877203264921D05CE26F81f6d36Aa3E`.
No giveaway-vault address has been deployed or approved. The existing market
escrow does not have a free giveaway transfer function; a market deposit is not
a Trix Hunt prize allocation. Deployment and integration remain to be reviewed.
Using the depositor as curator means automated reservations need that wallet's
signing access; no unattended signing or wallet-key custody is implemented.

## Trust and operation

* Constructor takes immutable, nonzero `depositor` and `curator`. The depositor
  must be able to originate a direct transaction: contract wallets and relayers
  cannot deposit. The curator is trusted to confirm indexed custody and the
  intended winner and round before reserving. The contract does not check the
  game, round, fairness, authenticity, ownership, or indexer state. Multiple IDs
  may be reserved for the same round. A compromised or mistaken curator can
  irrevocably lock an ID to the wrong beneficiary or an unusable address.
* Deposit by sending exactly the nonzero 32-byte ID as raw calldata directly
  from the depositor to the vault with zero ETH. `PotentialDeposit` and the
  recorded block only show a call was received: they do **not** prove the ID
  exists, that the depositor owned it, or that the indexer transferred it.
* **Selector collision:** before every deposit, run the actual preflight below
  against the complete ABI for the exact contract bytecode. A match means do not
  send: Solidity dispatches to that function rather than the fallback. A
  successful transaction can leave the transfer unrecorded. An unrecorded ID
  may be eligible for the privileged rescue described below, but recovery is
  not guaranteed. Confirm the transaction succeeded and emitted
  `PotentialDeposit`, then independently confirm indexed custody and previous
  owner using a trusted, ESIP-2-compatible indexer. Handle confirmations and
  chain reorganizations externally.
* Only the curator calls `reserve(id, roundId, beneficiary)`, with a nonzero
  round ID and beneficiary other than the vault itself, for a recorded unreserved ID. This irrevocably binds
  that ID to that beneficiary and round. Neither depositor nor curator can
  cancel, replace, or override it. There is no on-chain custody verification.
* Anyone may call `claim(id)` on a reservation after five blocks have elapsed
  since its deposit. Only the fixed beneficiary is used. The depositor alone may
  instead call `recover(id)` for an unreserved ID after the same delay; its
  destination is always the depositor. Both emit the ESIP-2 conditional event
  with the depositor as previous owner, and mark the ID terminal before emitting.
  There are no external calls or callbacks in these paths.
* `DeliveryRequested` / `RecoveryRequested` and the protocol event are requests,
  **not proof of delivery**. Anyone may call `retry(id)` for either kind of
  conditional request, at least five blocks after its preceding request. The
  ESIP-2 event always uses the original depositor and the same locked winner or
  recovery recipient; status and allocation never change. `TransferRetried`,
  `requestCount` and `lastRequestBlock` record attempts, not successful
  transfers. Check indexed ownership and last sender before coordinating a
  retry: anyone can call it, even after delivery, and if the asset later returns
  to the vault with the required previous owner, another retry could transfer it
  again to that same recipient. Reorgs and indexer delays complicate this.
* Only the depositor can call `rescueUnrecorded(id, recipient)` for a nonzero ID
  whose status is `None`, to a nonzero recipient other than the vault. This is a
  **privileged ESIP-1 transfer request**: the depositor can redirect any
  unrecorded asset the indexer considers owned by the vault, including assets
  sent by someone else. ESIP-1 has no previous-owner condition. Before using it,
  the depositor must independently verify indexed current ownership **and last
  sender**, determine the proper recipient, and allow for confirmations and
  reorgs; none of that is proved or enforced on-chain. Because there is no
  recorded receipt block for an unknown ID, rescue has no on-chain cooldown;
  the depositor must wait independently. The event is not proof of delivery.
  Recorded, reserved, requested and rescued IDs cannot be rescued.
* Rescue immediately and permanently records `RescueRequested`, even when the
  ID does not exist or the indexer rejects the request. It cannot be retried or
  redirected, and a later raw deposit of that ID is rejected: this prevents a
  rescue and a later reservation from creating conflicting allocations, but can
  permanently strand assets. An unsolicited later transfer can nevertheless
  place the ID in indexed custody without a usable deposit record; protocol
  transfers occur outside this contract's control. Similarly, sent-back assets
  under any terminal ID cannot be newly allocated or rescued. The depositor
  must coordinate ownership, pending transactions, and confirmations externally.

## API and state

`depositor()`, `curator()`, `COOLDOWN_BLOCKS()`, and `entries(id)` are public
views. Entries expose `receivedBlock`, `roundId`, `beneficiary`, and `status`:
`0 None`, `1 Deposited`, `2 Reserved`, `3 DeliveryRequested`,
`4 RecoveryRequested`, `5 RescueRequested`; they also expose
`lastRequestBlock` and `requestCount`. For rescue, `beneficiary` records the
chosen recipient and `receivedBlock` is zero. Counts include the first request
and subsequent conditional retries, not confirmations. Functions are nonpayable.
Events are `PotentialDeposit`, `Reserved`, `DeliveryRequested`,
`RecoveryRequested`, `TransferRetried`, `RescueRequested`,
`ethscriptions_protocol_TransferEthscriptionForPreviousOwner(address,address,bytes32)`
with all three protocol arguments indexed, and
`ethscriptions_protocol_TransferEthscription(address,bytes32)` with both indexed.
No cancellation API exists.

## Deposit preflight

Use `vault-preflight.cjs` with the complete ABI JSON array or compiler artifact
containing `abi`, obtained from the exact compiled vault build. Verify the
artifact actually matches the intended vault bytecode/address; this script
cannot do that, check indexer state, submit the transaction, or guarantee safe
delivery. Run it for every ID immediately before sending:

```powershell
node vault-preflight.cjs path-to-vault-artifact.json 0x<64-hex-digits>
```

It exits nonzero on an invalid ID, invalid ABI, or selector collision. A zero
exit only means the supplied ABI contains no matching function selector; it is
not a custody or ownership check. The Ganache test demonstrates a 32-byte ID
starting with the `depositor()` selector succeeds as a transaction yet produces
no deposit event or entry.

## Local tests

From this folder, with the preinstalled temporary dependencies:

```powershell
$env:TRIX_TEST_DEPS='C:\Users\PreSafu\AppData\Local\Temp\opencode\trix-test'
node --test vault.test.cjs settlement.test.cjs
```

The vault suite checks deposit restrictions and forwarding, invalid values,
authorization, duplicate use, irreversible reservation, exact cooldown boundary,
permissionless delivery and retries to the locked winner, recovery, privileged
rescue, selector collisions, and raw EVM event topics. These are EVM fixture
tests only: they do not run an Ethscriptions indexer or establish protocol
acceptance, actual indexed custody, or successful delivery.

`prize-custody.cjs` is a separately testable evidence-checking building block.
It checks a pinned deployment and runtime, exact direct transaction and vault
event, cooldown and indexer freshness, indexed custody and the existing TrixMoji
registry provenance result. Its callers must independently obtain and verify all
inputs and pin the deployment artifact. It is not connected to the live admin,
does not authorize allocations or verify prize delivery, and does not replace an
independently reviewed indexer-backed integration. Run its checks from the repo
root with `node --test trix-hunt/contracts/prize-custody.test.cjs`.
