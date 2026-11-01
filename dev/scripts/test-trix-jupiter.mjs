/**
 * Verify Jupiter can quote trending Trix Market tokens (v1 or v2 fallback).
 */
const SOL = 'So11111111111111111111111111111111111111112';

async function v1Quote(mint) {
  const r = await fetch(
    'https://api.jup.ag/swap/v1/quote?inputMint=' + SOL + '&outputMint=' + mint + '&amount=50000000&slippageBps=100'
  );
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || j.errorCode || 'v1 fail');
  return { mode: 'v1', out: j.outAmount, route: j.routePlan?.[0]?.swapInfo?.label };
}

async function v2Quote(mint) {
  const r = await fetch(
    'https://api.jup.ag/swap/v2/order?inputMint=' + SOL + '&outputMint=' + mint + '&amount=50000000&slippageBps=100'
  );
  const j = await r.json();
  if (!r.ok || !j.outAmount) throw new Error(j.errorMessage || j.error || 'v2 fail');
  return { mode: 'v2', out: j.outAmount, route: j.routePlan?.[0]?.swapInfo?.label };
}

async function quoteToken(mint, symbol) {
  try {
    return { symbol, ...(await v1Quote(mint)) };
  } catch (e) {
    try {
      return { symbol, ...(await v2Quote(mint)) };
    } catch (e2) {
      throw new Error('v1: ' + e.message + ' | v2: ' + e2.message);
    }
  }
}

const trending = await fetch('https://trix.market/api/trending').then((r) => r.json());
const tokens = [...(trending.trending || []), ...(trending.recentlyGraduated || [])].slice(0, 6);

let ok = 0;
let fail = 0;

console.log('Trix → Jupiter quote coverage\n');
for (const t of tokens) {
  try {
    const q = await quoteToken(t.mint, t.symbol);
    ok++;
    console.log('PASS', t.symbol, q.mode, 'out=' + q.out, q.route || '');
    await new Promise((r) => setTimeout(r, 400));
  } catch (e) {
    fail++;
    console.log('FAIL', t.symbol, e.message);
  }
}

console.log('\n' + ok + ' quoted, ' + fail + ' failed (illiquid Trix coins may fail — expected)');
process.exit(ok < 2 ? 1 : 0);