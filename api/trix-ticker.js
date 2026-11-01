/**
 * DOSWAPZ - Trix Market token catalog proxy (full list for swap dropdown + ticker).
 * Avoids browser CORS on trix.market.
 */

const fs = require('fs');
const path = require('path');

const SECTIONS = ['trending', 'recentlyGraduated', 'topGainers'];
const MAX_TOKENS = 80;

function readBundled() {
 const filePath = path.join(__dirname, '..', 'assets', 'data', 'trix-ticker.json');
 return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function flattenTrending(data) {
 const out = [];
 SECTIONS.forEach((key) => {
 const arr = data && data[key];
 if (Array.isArray(arr)) out.push(...arr);
 });
 const seen = new Set();
 return out.filter((t) => {
 if (!t || !t.mint || seen.has(t.mint)) return false;
 seen.add(t.mint);
 return true;
 });
}

function mapToken(t) {
 return {
 mint: t.mint,
 symbol: String(t.symbol || 'TOKEN').replace(/^\$/, '').toUpperCase(),
 name: t.name || t.symbol || 'TOKEN',
 price: typeof t.price === 'number' ? t.price : null,
 change24h: typeof t.change24h === 'number' ? t.change24h : null,
 marketCap: typeof t.marketCap === 'number' ? t.marketCap : null
 };
}

function sortByMcap(tokens) {
 return tokens
 .slice()
 .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
}

const { rateLimitOrReject } = require('./lib/rate-limit');

module.exports = async function handler(req, res) {
 res.setHeader('Access-Control-Allow-Origin', '*');
 res.setHeader('Cache-Control', 'public, max-age=120');

 if (req.method === 'OPTIONS') return res.status(204).end();
 if (req.method !== 'GET' && req.method !== 'HEAD') {
 return res.status(405).json({ error: 'GET only' });
 }

 if (rateLimitOrReject(req, res, { prefix: 'trix-ticker', perMinute: 40, perDay: 1200 })) {
 return;
 }

 // Optional ?limit= for lighter clients; default = full catalog for ticker/dropdown parity
 const qLimit = req.query && req.query.limit != null ? Number(req.query.limit) : NaN;
 const limit = Number.isFinite(qLimit) && qLimit > 0
 ? Math.min(MAX_TOKENS, Math.floor(qLimit))
 : MAX_TOKENS;

 try {
 const apiRes = await fetch('https://trix.market/api/trending', {
 headers: { Accept: 'application/json' }
 });
 if (!apiRes.ok) throw new Error('Trix HTTP ' + apiRes.status);
 const data = await apiRes.json();
 const tokens = sortByMcap(flattenTrending(data).map(mapToken)).slice(0, limit);
 if (!tokens.length) throw new Error('No Trix tokens');

 return res.status(200).json({
 updatedAt: new Date().toISOString(),
 source: 'trix.market/api/trending',
 tokens,
 count: tokens.length
 });
 } catch (err) {
 try {
 const bundled = readBundled();
 const tokens = sortByMcap((bundled.tokens || []).map(mapToken)).slice(0, limit);
 return res.status(200).json({
 updatedAt: bundled.updatedAt || null,
 tokens,
 count: tokens.length,
 source: (bundled.source || '/assets/data/trix-ticker.json') + ' (fallback)',
 fallbackReason: err.message || String(err)
 });
 } catch (e) {
 return res.status(503).json({ error: 'Trix ticker unavailable', tokens: [] });
 }
 }
};
