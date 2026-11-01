/**
 * Vantablack Market - token stats + bonding-curve progress (DexScreener proxy).
 * GET /api/vantablack-token-stats?mint=... or ?mints=a,b,c
 */

const GRADUATION_MCAP = Number(process.env.VB_GRADUATION_MCAP) || 69000;
const GRADUATED_DEX = new Set(['pumpswap', 'raydium', 'orca', 'meteora']);

const { rateLimitOrReject } = require('./lib/rate-limit');

function cors(res) {
 res.setHeader('Access-Control-Allow-Origin', '*');
 res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
 res.setHeader('Cache-Control', 'public, max-age=45');
}

function parseMints(req) {
 const q = req.query || {};
 const raw = q.mints || q.mint || '';
 return String(raw)
 .split(',')
 .map((m) => m.trim())
 .filter((m) =>
 /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m) ||
 /^0x[a-fA-F0-9]{40}$/.test(m)
 )
 .slice(0, 24);
}

function num(v) {
 const n = Number(v);
 return Number.isFinite(n) ? n : null;
}

function pickBestPair(pairs) {
 if (!Array.isArray(pairs) || !pairs.length) return null;
 return pairs
 .slice()
 .sort((a, b) => (num(b.liquidity?.usd) || num(b.marketCap) || 0) - (num(a.liquidity?.usd) || num(a.marketCap) || 0))[0];
}

function tokenMetaFromPair(pair, mint) {
 const base = pair?.baseToken || {};
 const quote = pair?.quoteToken || {};
 const match =
 (base.address && String(base.address) === mint && base) ||
 (quote.address && String(quote.address) === mint && quote) ||
 base;
 return {
 symbol: match?.symbol ? String(match.symbol).toUpperCase().slice(0, 12) : null,
 name: match?.name ? String(match.name).slice(0, 48) : null
 };
}

function sparklineFromChange(change, marketCap) {
 const mcap = num(marketCap) || 0;
 const pct = (key) => num(change && change[key]) || 0;
 const points = [
 { label: '24h', value: mcap / (1 + pct('h24') / 100) },
 { label: '6h', value: mcap / (1 + pct('h6') / 100) },
 { label: '1h', value: mcap / (1 + pct('h1') / 100) },
 { label: '5m', value: mcap / (1 + pct('m5') / 100) },
 { label: 'now', value: mcap }
 ].map((p) => ({ label: p.label, value: Math.max(0, p.value) }));
 return points;
}

function curveProgress(pair, launchType) {
 const dex = String(pair?.dexId || '').toLowerCase();
 const mcap = num(pair?.marketCap) || 0;
 const liq = num(pair?.liquidity?.usd) ?? num(pair?.liquidity) ?? 0;

 if (GRADUATED_DEX.has(dex) || (liq > 1000 && dex !== 'pumpfun')) {
 return { progress: 100, status: 'graduated', dexId: dex || 'graduated' };
 }

 if (dex === 'pumpfun' || launchType === 'curve') {
 const progress = Math.min(100, Math.round((mcap / GRADUATION_MCAP) * 1000) / 10);
 return {
 progress,
 status: progress >= 100 ? 'graduated' : 'bonding',
 dexId: 'pumpfun',
 graduationTarget: GRADUATION_MCAP
 };
 }

 if (mcap > 0) {
 return { progress: null, status: 'trading', dexId: dex || 'unknown' };
 }

 return { progress: null, status: launchType === 'classic' ? 'direct' : 'unlisted', dexId: dex || null };
}

async function fetchDexPair(mint) {
 const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + encodeURIComponent(mint), {
 headers: { Accept: 'application/json' }
 });
 if (!res.ok) throw new Error('DexScreener HTTP ' + res.status);
 const data = await res.json();
 return pickBestPair(data.pairs);
}

async function statsForMint(mint, launchType) {
 try {
 const pair = await fetchDexPair(mint);
 if (!pair) {
 return {
 mint,
 ok: true,
 symbol: null,
 name: null,
 marketCap: null,
 priceUsd: null,
 change24h: null,
 volume24h: null,
 liquidity: null,
 dexId: null,
 sparkline: [],
 curve: curveProgress(null, launchType)
 };
 }

 const meta = tokenMetaFromPair(pair, mint);
 const curve = curveProgress(pair, launchType);
 return {
 mint,
 ok: true,
 symbol: meta.symbol,
 name: meta.name,
 marketCap: num(pair.marketCap),
 priceUsd: num(pair.priceUsd),
 change24h: num(pair.priceChange?.h24),
 change1h: num(pair.priceChange?.h1),
 change5m: num(pair.priceChange?.m5),
 volume24h: num(pair.volume?.h24),
 liquidity: num(pair.liquidity?.usd) ?? num(pair.liquidity),
 dexId: pair.dexId || null,
 pairUrl: pair.url || null,
 sparkline: sparklineFromChange(pair.priceChange, pair.marketCap),
 curve
 };
 } catch (err) {
 return { mint, ok: false, error: err.message || String(err) };
 }
}

module.exports = async function handler(req, res) {
 cors(res);
 if (req.method === 'OPTIONS') return res.status(204).end();
 if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
 if (rateLimitOrReject(req, res, { prefix: 'vb-token-stats', perMinute: 30, perDay: 800 })) return;

 const mints = parseMints(req);
 if (!mints.length) return res.status(400).json({ error: 'mint or mints query required' });

 // Optional map: mint:curve,mint2:classic - also supports single launchType=curve
 const defaultLaunch = String(req.query?.launchType || '').toLowerCase() === 'curve' ? 'curve' : '';
 const typeMap = {};
 String(req.query?.types || '')
 .split(',')
 .forEach((part) => {
 const [m, t] = part.split(':');
 if (m && t) typeMap[m.trim()] = t.trim().toLowerCase() === 'curve' ? 'curve' : 'classic';
 });

 const results = await Promise.all(
 mints.map((mint) => statsForMint(mint, typeMap[mint] || defaultLaunch))
 );

 return res.status(200).json({
 updatedAt: new Date().toISOString(),
 graduationMcap: GRADUATION_MCAP,
 stats: results
 });
};