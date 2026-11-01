/**
 * Vantablack Market - shared coin catalog API.
 * GET /api/vantablack-coins -> all listed tokens (seed + community)
 * POST /api/vantablack-coins -> register a mint for everyone to see
 */

const { loadStore, addCoin, BLOCKED_MINTS } = require('./lib/vantablack-store');

function parseBody(req) {
 if (req.body && typeof req.body === 'object') return req.body;
 if (typeof req.body === 'string') {
 try {
 return JSON.parse(req.body);
 } catch (e) {
 return null;
 }
 }
 return null;
}

const { rateLimitOrReject } = require('./lib/rate-limit');

module.exports = async function handler(req, res) {
 res.setHeader('Access-Control-Allow-Origin', '*');
 res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
 res.setHeader('Cache-Control', 'public, max-age=15');

 if (req.method === 'OPTIONS') return res.status(204).end();

 if (req.method === 'POST') {
 if (rateLimitOrReject(req, res, { prefix: 'vb-coins-write', perMinute: 10, perDay: 80 })) return;
 } else if (req.method === 'GET') {
 if (rateLimitOrReject(req, res, { prefix: 'vb-coins-read', perMinute: 45, perDay: 1500 })) return;
 }

 if (req.method === 'GET') {
 const store = await loadStore();
 return res.status(200).json({
 coins: store.coins,
 updatedAt: store.updatedAt,
 backend: store.backend || 'bundled'
 });
 }

 if (req.method === 'POST') {
 res.setHeader('Cache-Control', 'no-store');
 const body = parseBody(req);
 if (!body || !body.mint) {
 return res.status(400).json({ error: 'Invalid coin payload' });
 }
 if (BLOCKED_MINTS.has(String(body.mint).trim())) {
 return res.status(400).json({ error: 'Mint blocked' });
 }

 let result;
 try {
 result = await addCoin(body);
 } catch (e) {
 return res.status(500).json({ error: e && e.message ? e.message : String(e) });
 }
 if (result.error && result.status) {
 return res.status(result.status).json({ error: result.error });
 }

 return res.status(result.duplicate ? 200 : 201).json({
 ok: true,
 coin: result.coin,
 duplicate: !!result.duplicate,
 persisted: !!result.persisted,
 backend: result.backend || null,
 persistError: result.error || null
 });
 }

 return res.status(405).json({ error: 'Method not allowed' });
};
