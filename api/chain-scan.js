/**
 * Solana-wide trend scan (not a single token).
 * Trix Market + DexScreener boosts/pairs → BUY / SELL / WATCH heuristics.
 * GET /api/chain-scan
 */
const { rateLimitOrReject } = require('./lib/rate-limit');

const TRIX_TRENDING = 'https://trix.market/api/trending';
const DEX_BOOSTS = 'https://api.dexscreener.com/token-boosts/top/v1';
const DEX_TOKENS = 'https://api.dexscreener.com/latest/dex/tokens/';
const MAX_TOKENS = 24;

function cors(res) {
 res.setHeader('Access-Control-Allow-Origin', '*');
 res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
 res.setHeader('Cache-Control', 'public, max-age=30');
}

function num(v) {
 const n = Number(v);
 return Number.isFinite(n) ? n : null;
}

function classify(t) {
 const ch1 = num(t.change1h) || 0;
 const ch24 = num(t.change24h) || 0;
 const vol = num(t.volume24h) || 0;
 const liq = num(t.liquidity) || 0;
 const buys = num(t.buys1h) || 0;
 const sells = num(t.sells1h) || 0;
 const flow = buys + sells > 0 ? buys / (buys + sells) : 0.5;
 let action = 'WATCH';
 let reason = 'NO CLEAR EDGE';
 if (vol >= 3000 && liq >= 2500 && ch1 >= 8 && flow >= 0.55) {
 action = 'BUY';
 reason = '1H UP + BUY FLOW + LIQ';
 } else if (vol >= 8000 && ch24 >= 40 && ch1 > 0 && liq >= 4000) {
 action = 'BUY';
 reason = '24H TREND STILL GREEN';
 } else if (ch1 <= -10 && vol >= 3000 && flow <= 0.45) {
 action = 'SELL';
 reason = '1H DUMP + SELL FLOW';
 } else if (ch24 <= -35 && ch1 < 0 && vol >= 5000) {
 action = 'SELL';
 reason = '24H BLEED';
 }
 const score = Math.round((vol || 0) * (Math.abs(ch1) + 1) * (liq > 0 ? 1 : 0.4));
 return { action, reason, score, flow: Math.round(flow * 100) };
}

function fromTrix(raw, source) {
 if (!raw) return null;
 const mint = (raw.mint || raw.mintAddress || '').trim();
 if (!mint) return null;
 return {
 mint,
 symbol: String(raw.symbol || 'TOKEN').replace(/^\$/, '').toUpperCase().slice(0, 16),
 name: String(raw.name || raw.symbol || 'TOKEN').slice(0, 48),
 priceUsd: num(raw.price),
 change1h: num(raw.change1h),
 change24h: num(raw.change24h),
 volume24h: num(raw.volume24h),
 liquidity: num(raw.liquidity),
 marketCap: num(raw.marketCap),
 dexId: raw.dexId || 'trix',
 source
 };
}

function fromDexPair(pair) {
 if (!pair || pair.chainId !== 'solana') return null;
 const base = pair.baseToken || {};
 const mint = String(base.address || '').trim();
 if (!mint) return null;
 const tx = (pair.txns && (pair.txns.h1 || pair.txns.h24)) || {};
 return {
 mint,
 symbol: String(base.symbol || 'TOKEN').replace(/^\$/, '').toUpperCase().slice(0, 16),
 name: String(base.name || base.symbol || 'TOKEN').slice(0, 48),
 priceUsd: num(pair.priceUsd),
 change1h: num(pair.priceChange && pair.priceChange.h1),
 change24h: num(pair.priceChange && pair.priceChange.h24),
 volume24h: num(pair.volume && pair.volume.h24),
 liquidity: num(pair.liquidity && pair.liquidity.usd),
 marketCap: num(pair.marketCap) || num(pair.fdv),
 buys1h: num(tx.buys),
 sells1h: num(tx.sells),
 dexId: pair.dexId || 'dex',
 pairAddress: pair.pairAddress || null,
 source: 'dexscreener'
 };
}

async function fetchJson(url) {
 const res = await fetch(url, { headers: { Accept: 'application/json' } });
 if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
 return res.json();
}

async function loadTrix() {
 const data = await fetchJson(TRIX_TRENDING);
 const out = [];
 ['trending', 'topGainers', 'recentlyGraduated'].forEach((key) => {
 const arr = data && data[key];
 if (!Array.isArray(arr)) return;
 arr.slice(0, 12).forEach((item) => {
 const t = fromTrix(item, 'trix-' + key);
 if (t) out.push(t);
 });
 });
 return out;
}

async function loadBoostMints() {
 const data = await fetchJson(DEX_BOOSTS);
 if (!Array.isArray(data)) return [];
 return data
 .filter((x) => x && x.chainId === 'solana' && x.tokenAddress)
 .slice(0, 20)
 .map((x) => String(x.tokenAddress));
}

async function loadDexPairs(mints) {
 const unique = [];
 const seen = {};
 mints.forEach((m) => {
 if (!m || seen[m]) return;
 seen[m] = true;
 unique.push(m);
 });
 const chunk = unique.slice(0, 30);
 if (!chunk.length) return [];
 const data = await fetchJson(DEX_TOKENS + chunk.join(','));
 const pairs = Array.isArray(data.pairs) ? data.pairs : [];
 const best = {};
 pairs.forEach((pair) => {
 const t = fromDexPair(pair);
 if (!t) return;
 const prev = best[t.mint];
 const liq = t.liquidity || 0;
 if (!prev || liq > (prev.liquidity || 0)) best[t.mint] = t;
 });
 return Object.keys(best).map((k) => best[k]);
}

function merge(rows) {
 const byMint = {};
 rows.forEach((t) => {
 if (!t || !t.mint) return;
 const prev = byMint[t.mint];
 if (!prev) {
 byMint[t.mint] = t;
 return;
 }
 byMint[t.mint] = Object.assign({}, prev, t, {
 volume24h: Math.max(prev.volume24h || 0, t.volume24h || 0),
 liquidity: Math.max(prev.liquidity || 0, t.liquidity || 0),
 marketCap: t.marketCap || prev.marketCap,
 change1h: t.change1h != null ? t.change1h : prev.change1h,
 change24h: t.change24h != null ? t.change24h : prev.change24h,
 source: prev.source + '+' + t.source
 });
 });
 return Object.keys(byMint).map((k) => {
 const t = byMint[k];
 const c = classify(t);
 return Object.assign({}, t, c);
 });
}

module.exports = async function handler(req, res) {
 cors(res);
 if (req.method === 'OPTIONS') return res.status(204).end();
 if (req.method !== 'GET' && req.method !== 'HEAD') {
 return res.status(405).json({ error: 'GET only' });
 }
 if (rateLimitOrReject(req, res, { prefix: 'chain-scan', perMinute: 20, perDay: 400 })) return;

 try {
 const trix = await loadTrix().catch(() => []);
 const boosts = await loadBoostMints().catch(() => []);
 const extra = trix.map((t) => t.mint).concat(boosts);
 const dex = await loadDexPairs(extra).catch(() => []);
 const ranked = merge(trix.concat(dex))
 .sort((a, b) => (b.score || 0) - (a.score || 0))
 .slice(0, MAX_TOKENS);
 const buys = ranked.filter((t) => t.action === 'BUY').length;
 const sells = ranked.filter((t) => t.action === 'SELL').length;
 return res.status(200).json({
 ok: true,
 updatedAt: new Date().toISOString(),
 chain: 'solana',
 counts: { tokens: ranked.length, buy: buys, sell: sells, watch: ranked.length - buys - sells },
 tokens: ranked,
 links: { swap: '/classic/pages/doswapz/swap.html' }
 });
 } catch (err) {
 return res.status(502).json({ ok: false, error: err.message || 'scan failed', tokens: [] });
 }
};
