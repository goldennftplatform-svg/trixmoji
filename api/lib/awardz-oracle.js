/**
 * Awardz USD oracle — SOL + ETH spot. No haircut. No fee.
 * CoinGecko → Coinbase → DexScreener.
 */
const STALE_MS = 2 * 60 * 1000;

async function fetchJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(function () {
    ctrl.abort();
  }, timeoutMs || 8000);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fromCoinGecko() {
  const data = await fetchJson(
    'https://api.coingecko.com/api/v3/simple/price?ids=solana,ethereum&vs_currencies=usd',
    8000
  );
  const sol = Number(data && data.solana && data.solana.usd);
  const eth = Number(data && data.ethereum && data.ethereum.usd);
  if (!(sol > 0) || !(eth > 0)) throw new Error('CoinGecko empty');
  return { sol: sol, eth: eth, source: 'coingecko' };
}

async function fromCoinbase() {
  const solP = fetchJson('https://api.coinbase.com/v2/prices/SOL-USD/spot', 8000);
  const ethP = fetchJson('https://api.coinbase.com/v2/prices/ETH-USD/spot', 8000);
  const solJ = await solP;
  const ethJ = await ethP;
  const sol = Number(solJ && solJ.data && solJ.data.amount);
  const eth = Number(ethJ && ethJ.data && ethJ.data.amount);
  if (!(sol > 0) || !(eth > 0)) throw new Error('Coinbase empty');
  return { sol: sol, eth: eth, source: 'coinbase' };
}

async function fromDex() {
  const solJ = await fetchJson(
    'https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112',
    8000
  );
  const ethJ = await fetchJson(
    'https://api.dexscreener.com/latest/dex/tokens/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    8000
  );
  function px(j) {
    const pairs = (j && j.pairs) || [];
    for (let i = 0; i < pairs.length; i++) {
      const n = Number(pairs[i].priceUsd);
      if (n > 0) return n;
    }
    return 0;
  }
  const sol = px(solJ);
  const eth = px(ethJ);
  if (!(sol > 0) || !(eth > 0)) throw new Error('DexScreener empty');
  return { sol: sol, eth: eth, source: 'dexscreener' };
}

async function fetchUsdPrices() {
  const errs = [];
  const fns = [fromCoinGecko, fromCoinbase, fromDex];
  for (let i = 0; i < fns.length; i++) {
    try {
      const p = await fns[i]();
      return {
        sol: p.sol,
        eth: p.eth,
        source: p.source,
        ts: Date.now()
      };
    } catch (e) {
      errs.push(String(e && e.message ? e.message : e));
    }
  }
  throw new Error('Oracle failed: ' + errs.join(' | '));
}

function isFresh(prices) {
  if (!prices || !(prices.sol > 0) || !(prices.eth > 0)) return false;
  return Date.now() - Number(prices.ts || 0) < STALE_MS;
}

module.exports = {
  STALE_MS,
  fetchUsdPrices,
  isFresh
};
