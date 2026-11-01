# Quantum Trader Token Scout — V8

This is a live Solana trading bot. It is designed to be conservative about execution and to refuse trades when required data or safety checks are unavailable. It cannot guarantee profits or eliminate smart-contract, liquidity, API, RPC, market, or execution risk.

## What changed from V7

- Uses DexScreener token batching instead of hundreds of one-token API calls.
- Limits discovery request rate to reduce 429/rate-limit failures.
- Uses DexScreener search + profiles + boosts + GeckoTerminal as independent discovery paths.
- Keeps a persistent candidate cache so a temporary API failure does not turn the universe into zero candidates.
- Keeps persistent price history for swing detection.
- Excludes SOL, stablecoins and wrapped major assets from the swing universe.
- Does not equate a ranking score with a buy signal. A separate pullback/rebound signal is required.
- Verifies actual token balance after a confirmed BUY before creating the position record.
- Reads actual token balance again before SELL.
- Keeps Jupiter price-impact protection and preflight enabled.
- Uses confirmed commitment consistently for transaction handling.
- Adds daily loss and consecutive-loss circuit breakers.
- Writes `swing-state.json` and `live-trades.jsonl` for audit/recovery.

## Install

1. Extract the ZIP.
2. Copy your existing `.env` into the folder. Never send `.env` or the secret key to anyone.
3. In PowerShell:

```powershell
cd "C:\Users\franc\Downloads\quantum-trader-token-scout-swing-v8"
npm.cmd install
$env:ENABLE_LIVE="true"; npm.cmd run live
```

## Important

The default test trade is $0.50. Keep it there until there is enough completed trade data to evaluate the strategy. A higher balance does not prove that the strategy has an edge. Review win rate, average win/loss, fees, slippage, drawdown, and failed transactions before scaling.

The bot is not bulletproof in the literal sense. No automated trader can be. The goal here is fail-closed behavior: when discovery, routing, balance verification, or risk limits fail, the bot should skip the trade rather than guess.


STABLE FIX NOTES
- Discovery uses direct pair results first.
- Token profile/boost mints are only used as secondary refresh candidates.
- Invalid quote assets and major/stable assets are rejected.
- Recent valid candidates are retained across transient discovery failures.
- Transaction confirmation uses the blockhash fetched before submission.
