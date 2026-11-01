/**
 * Live $PORK pasture feed.
 * GET /api/pork-pasture
 *
 * Aggregates Ethereum DexScreener pairs + GeckoTerminal trades for
 * 0xb9f599ce614Feb2e1BBe58F180F370D05b39344E and classifies each
 * print as a PORK buy or sell.
 */

const { rateLimitOrReject } = require('./lib/rate-limit');

const PORK = '0xb9f599ce614feb2e1bbe58f180f370d05b39344e';
const DEX_URL = 'https://api.dexscreener.com/latest/dex/tokens/' + PORK;
const GT_POOLS = 'https://api.geckoterminal.com/api/v2/networks/eth/tokens/' + PORK + '/pools?page=1';
const CACHE_MS = 10000;
const FETCH_MS = 8000;
const MAX_TRADES = 48;
const TOP_POOLS = 3;

let cache = { at: 0, body: null };

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=8');
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function lower(v) {
  return String(v || '').toLowerCase();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_MS)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  return res.json();
}

function windowTxns(txns, key) {
  const w = (txns && txns[key]) || {};
  return { buys: num(w.buys), sells: num(w.sells) };
}

function orientPair(pair) {
  const base = lower(pair.baseToken && pair.baseToken.address);
  const quote = lower(pair.quoteToken && pair.quoteToken.address);
  const raw = {
    m5: windowTxns(pair.txns, 'm5'),
    h1: windowTxns(pair.txns, 'h1'),
    h24: windowTxns(pair.txns, 'h24')
  };
  const flip = quote === PORK && base !== PORK;
  const flipWin = (w) => (flip ? { buys: w.sells, sells: w.buys } : w);
  return {
    pairAddress: pair.pairAddress || null,
    dexId: pair.dexId || null,
    url: pair.url || null,
    priceUsd: num(pair.priceUsd),
    marketCap: num(pair.marketCap) || num(pair.fdv),
    liquidity: num(pair.liquidity && pair.liquidity.usd),
    volume24h: num(pair.volume && pair.volume.h24),
    change: {
      m5: num(pair.priceChange && pair.priceChange.m5),
      h1: num(pair.priceChange && pair.priceChange.h1),
      h24: num(pair.priceChange && pair.priceChange.h24)
    },
    porkIs: base === PORK ? 'base' : quote === PORK ? 'quote' : 'none',
    base: pair.baseToken ? pair.baseToken.symbol : null,
    quote: pair.quoteToken ? pair.quoteToken.symbol : null,
    m5: flipWin(raw.m5),
    h1: flipWin(raw.h1),
    h24: flipWin(raw.h24)
  };
}

function porkSide(fromAddr, toAddr) {
  const from = lower(fromAddr);
  const to = lower(toAddr);
  if (to === PORK) return 'buy';
  if (from === PORK) return 'sell';
  return null;
}

function herdCount(n) {
  const x = Math.max(0, num(n));
  return Math.max(5, Math.min(30, Math.round(3.2 * Math.sqrt(x + 1))));
}

async function loadPasture() {
  const now = Date.now();
  if (cache.body && now - cache.at < CACHE_MS) return cache.body;

  const dexP = fetchJson(DEX_URL).catch((err) => ({ __err: err.message }));
  const gtP = fetchJson(GT_POOLS).catch((err) => ({ __err: err.message }));
  const [dex, gt] = await Promise.all([dexP, gtP]);

  const rawPairs = Array.isArray(dex && dex.pairs) ? dex.pairs : [];
  const ethPairs = rawPairs
    .filter((p) => lower(p.chainId) === 'ethereum')
    .map(orientPair)
    .filter((p) => p.porkIs !== 'none');

  ethPairs.sort((a, b) => b.liquidity - a.liquidity);
  const primary =
    ethPairs.find((p) => p.porkIs === 'base' && p.liquidity > 0) || ethPairs[0] || null;

  let flow = { buys24: 0, sells24: 0, buys1h: 0, sells1h: 0, buys5m: 0, sells5m: 0 };
  let volume24h = 0;
  let liquidity = 0;
  ethPairs.forEach((p) => {
    flow.buys24 += p.h24.buys;
    flow.sells24 += p.h24.sells;
    flow.buys1h += p.h1.buys;
    flow.sells1h += p.h1.sells;
    flow.buys5m += p.m5.buys;
    flow.sells5m += p.m5.sells;
    volume24h += p.volume24h;
    liquidity += p.liquidity;
  });

  const pools = Array.isArray(gt && gt.data) ? gt.data : [];
  const ranked = pools
    .map((p) => {
      const a = p.attributes || {};
      return {
        address: a.address || String(p.id || '').replace(/^eth_/, ''),
        name: a.name || '',
        volume: num(a.volume_usd && a.volume_usd.h24)
      };
    })
    .filter((p) => p.address)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, TOP_POOLS);

  const tradeSets = await Promise.all(
    ranked.map((p) =>
      fetchJson(
        'https://api.geckoterminal.com/api/v2/networks/eth/pools/' +
          encodeURIComponent(p.address) +
          '/trades?trade_volume_in_usd_greater_than=0'
      )
        .then((j) => ({ pool: p, data: j.data || [] }))
        .catch(() => ({ pool: p, data: [] }))
    )
  );

  const seen = new Set();
  const trades = [];
  tradeSets.forEach((set) => {
    set.data.forEach((row) => {
      const a = row.attributes || {};
      const tx = lower(a.tx_hash);
      if (!tx || seen.has(tx)) return;
      const side = porkSide(a.from_token_address, a.to_token_address);
      if (!side) return;
      seen.add(tx);
      trades.push({
        id: tx,
        side,
        usd: Math.round(num(a.volume_in_usd) * 100) / 100,
        ts: a.block_timestamp || null,
        tx: a.tx_hash,
        pair: set.pool.name || null,
        etherscan: 'https://etherscan.io/tx/' + a.tx_hash
      });
    });
  });

  trades.sort((a, b) => Date.parse(b.ts || 0) - Date.parse(a.ts || 0));
  const clipped = trades.slice(0, MAX_TRADES);
  const usdVals = clipped.map((t) => t.usd).sort((a, b) => a - b);
  const median = usdVals.length ? usdVals[Math.floor(usdVals.length / 2)] : 20;
  const whaleCut = Math.max(80, median * 3);
  clipped.forEach((t) => {
    t.whale = t.usd >= whaleCut;
  });

  const buyShare =
    flow.buys24 + flow.sells24 > 0 ? flow.buys24 / (flow.buys24 + flow.sells24) : 0.5;

  const body = {
    ok: true,
    token: {
      symbol: 'PORK',
      name: 'PepeFork',
      address: '0xb9f599ce614Feb2e1BBe58F180F370D05b39344E',
      chain: 'ethereum'
    },
    priceUsd: primary ? primary.priceUsd : 0,
    marketCap: primary ? primary.marketCap : 0,
    liquidity,
    volume24h,
    change: primary ? primary.change : { m5: 0, h1: 0, h24: 0 },
    flow: Object.assign({}, flow, { buyShare }),
    herds: {
      buys: herdCount(flow.buys24),
      sells: herdCount(flow.sells24)
    },
    trades: clipped,
    pairs: ethPairs.slice(0, 6).map((p) => ({
      pairAddress: p.pairAddress,
      dexId: p.dexId,
      url: p.url,
      base: p.base,
      quote: p.quote,
      liquidity: p.liquidity,
      volume24h: p.volume24h,
      h24: p.h24
    })),
    pairUrl: primary && primary.url ? primary.url : 'https://dexscreener.com/ethereum/' + PORK,
    sources: {
      dex: dex && dex.__err ? dex.__err : 'dexscreener',
      gecko: gt && gt.__err ? gt.__err : 'geckoterminal'
    },
    updatedAt: new Date().toISOString()
  };

  cache = { at: Date.now(), body };
  return body;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  if (rateLimitOrReject(req, res, { prefix: 'pork-pasture', perMinute: 40, perDay: 2000 })) return;

  try {
    const body = await loadPasture();
    return res.status(200).json(body);
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: err.message || String(err),
      token: {
        symbol: 'PORK',
        address: '0xb9f599ce614Feb2e1BBe58F180F370D05b39344E'
      }
    });
  }
};
