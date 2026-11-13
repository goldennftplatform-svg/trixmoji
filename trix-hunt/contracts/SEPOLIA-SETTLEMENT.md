# Sepolia settlement prototype

This is a local/Sepolia-test prototype, not a deployed service. It holds Sepolia ETH temporarily for shot settlement; it has no prize or Ethscription custody, verification, or delivery. The designated operator is trusted to report shots used and an opaque result hash. Gameplay and the hash are not verified on chain and are not provably fair. The operator can claim any number of shots up to ten before the deadline.

The constructor accepts `(address priceFeed, address trustedOperator)` and rejects chains other than 11155111 and zero addresses. For Sepolia the intended Chainlink ETH/USD feed is `0x694AA1769357215DE4FAC081bf1f309aDC325306`; the immutable feed address must be supplied explicitly. Local Ganache must use chain ID 11155111 and a mock feed. Chain ID is a guard, not proof that a network or feed is authentic.

The local `/economy.html` test harness is wallet-driven and testnet-only. It
can load a completed local simulated game round, but that data is untrusted and
the operator must explicitly approve finalization. It does not transfer prizes.
The current test configuration uses the same wallet as player and operator, so
its aggregate withdrawable credit includes both refund and operator proceeds.

## Integration and ABI

Compile `TrixHuntSepoliaSettlement.sol` with Solidity 0.8.24 or compatible 0.8.x to obtain the complete JSON ABI and bytecode. Main ABI signatures (amounts are wei):

```text
constructor(address priceFeed, address trustedOperator)
quote(uint8 pack) view returns (uint256)
startRound(bytes32 sessionId, uint8 pack, uint256 maxPrice) payable
finalizeRound(bytes32 sessionId, uint8 shotsUsed, bytes32 resultHash)
expireRound(bytes32 sessionId)
withdraw()
rounds(bytes32) view returns (address player, uint64 deadline, uint8 pack, bool settled, uint256 price)
credit(address) view returns (uint256)
feed() view returns (address)
operator() view returns (address)
SHOTS() view returns (uint256)
ROUND_TIMEOUT() view returns (uint256)
MAX_FEED_AGE() view returns (uint256)
event RoundStarted(bytes32 indexed sessionId, address indexed player, uint8 pack, uint256 price, uint256 deadline)
event RoundFinalized(bytes32 indexed sessionId, uint8 shotsUsed, bytes32 resultHash, uint256 refund)
event RoundExpired(bytes32 indexed sessionId, uint256 refund)
event Withdrawal(address indexed account, uint256 amount)
```

Pack IDs 0, 1 and 2 represent $5, $7.50 and $10 respectively, each for ten shots. `quote` checks eight feed decimals, a positive answer, nonzero nonfuture update no older than two hours, and `answeredInRound >= roundId`. It converts cents to wei with ceiling division and rounds up again to a multiple of ten wei. Feed reverts propagate. Quotes can change before inclusion.

Generate a globally unique nonzero `bytes32` session ID. Read `quote(pack)`, choose a user-approved `maxPrice` in wei, then call `startRound` with `value` between the actual inclusion-time quote and `maxPrice` inclusive. If the price rises above the limit or payment is insufficient, the transaction reverts. Any excess payment becomes player withdrawal credit immediately. Store the `RoundStarted` event or inspect `rounds`: its `price` is the inclusion-time snapshot used for settlement even if the feed changes.

Before the fixed one-day deadline, only the immutable operator can finalize once with 0–10 shots and any opaque `bytes32` result hash. The player receives `(price / 10) * (10 - shotsUsed)` as credit and the operator receives the remainder. At or after the deadline, anyone can call `expireRound` once to credit the full snapshot price to the player; finalization is no longer allowed. Credits are cumulative, including overpayments, and each recipient calls `withdraw()` to pull their ETH. Failed transfers revert and preserve credit; withdrawals are reentrancy guarded. Account for gas separately.

## Local tests

The test compiles the contract and inline mock contracts, then runs in-memory Ganache with Sepolia chain ID (and a separate chain-ID-1 rejection case). With the provided dependency directory in PowerShell:

```powershell
$env:TRIX_TEST_DEPS = 'C:\Users\PreSafu\AppData\Local\Temp\opencode\trix-test'
node --test DOSWAPZ/trix-hunt/contracts/sepolia-settlement.test.cjs
```

The directory must provide `solc`, `ganache`, and `ethers`. No RPC, deployment, or live feed is used by the tests.
