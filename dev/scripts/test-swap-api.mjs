/**
 * DOSWAPZ swap API smoke tests (Jupiter v1 quote + swap build).
 * Run: node scripts/test-swap-api.mjs
 */

const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const JUP = 'JUPyiwrYJFskUPiHa7hKqXqnRf4aU4T3Upr6hqDDVRe';
const DUMMY_PK = '11111111111111111111111111111111';

const BASES = [
  'https://api.jup.ag/swap/v1',
  'https://lite-api.jup.ag/swap/v1',
];

const PAIRS = [
  { name: 'SOL→USDC', inputMint: SOL, outputMint: USDC, amount: '1000000000', required: true },
  { name: 'USDC→BONK', inputMint: USDC, outputMint: BONK, amount: '10000000', required: true },
  { name: 'SOL→JUP', inputMint: SOL, outputMint: JUP, amount: '100000000', required: false },
];

let passed = 0;
let failed = 0;
let warned = 0;

function ok(label, detail) {
  passed++;
  console.log(`PASS  ${label}${detail ? ' — ' + detail : ''}`);
}

function fail(label, detail) {
  failed++;
  console.error(`FAIL  ${label}${detail ? ' — ' + detail : ''}`);
}

function warn(label, detail) {
  warned++;
  console.warn(`WARN  ${label}${detail ? ' — ' + detail : ''}`);
}

async function fetchQuote(base, inputMint, outputMint, amount) {
  const qs = new URLSearchParams({ inputMint, outputMint, amount, slippageBps: '50' });
  const res = await fetch(`${base}/quote?${qs}`);
  if (!res.ok) throw new Error(`quote HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

async function fetchSwapTx(base, quote, userPublicKey, retries = 4) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${base}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    });
    if (res.status === 429 && attempt < retries) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`swap HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
    return res.json();
  }
  throw new Error('swap retries exhausted');
}

async function main() {
  console.log('DOSWAPZ Jupiter swap API tests\n');

  let workingBase = null;
  for (const base of BASES) {
    try {
      const q = await fetchQuote(base, SOL, USDC, '1000000000');
      if (q.outAmount) {
        workingBase = base;
        ok('Jupiter base reachable', base);
        break;
      }
    } catch (e) {
      fail('Jupiter base', `${base} — ${e.message}`);
    }
  }

  if (!workingBase) {
    console.error('\nNo Jupiter base available. Aborting.');
    process.exit(1);
  }

  for (const pair of PAIRS) {
    try {
      const q = await fetchQuote(workingBase, pair.inputMint, pair.outputMint, pair.amount);
      if (!q.outAmount || Number(q.outAmount) <= 0) {
        fail(pair.name, 'missing outAmount');
        continue;
      }
      const route = q.routePlan?.[0]?.swapInfo?.label || 'unknown';
      ok(`${pair.name} quote`, `out=${q.outAmount} via ${route}`);
    } catch (e) {
      if (pair.required) fail(pair.name + ' quote', e.message);
      else warn(pair.name + ' quote', e.message);
    }
  }

  try {
    await new Promise((r) => setTimeout(r, 2500));
    const q = await fetchQuote(workingBase, SOL, USDC, '1000000000');
    const swap = await fetchSwapTx(workingBase, q, DUMMY_PK);
    if (swap.swapTransaction && swap.swapTransaction.length > 40) {
      ok('SOL→USDC swap tx build', `tx bytes ~${swap.swapTransaction.length}`);
    } else {
      fail('swap tx build', 'swapTransaction missing or too short');
    }
  } catch (e) {
    fail('swap tx build', e.message);
  }

  console.log(`\n${passed} passed, ${failed} failed, ${warned} warnings`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});