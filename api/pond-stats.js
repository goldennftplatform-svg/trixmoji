/**
 * DOSWAPZ - Pond0x global Solana stats proxy.
 * GET /api/pond-stats
 */

const POND_STATS = 'https://www.pond0x.com/api/solana';

const { rateLimitOrReject } = require('./lib/rate-limit');

module.exports = async function handler(req, res) {
 res.setHeader('Access-Control-Allow-Origin', '*');
 res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
 res.setHeader('Cache-Control', 'public, max-age=30');

 if (req.method === 'OPTIONS') {
 return res.status(204).end();
 }

 if (req.method !== 'GET') {
 return res.status(405).json({ error: 'Method not allowed' });
 }

 if (rateLimitOrReject(req, res, { prefix: 'pond-stats', perMinute: 40, perDay: 1200 })) return;

 try {
 const upstream = await fetch(POND_STATS, { headers: { Accept: 'application/json' } });
 const body = await upstream.text();
 res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
 return res.status(upstream.status).send(body);
 } catch (err) {
 return res.status(502).json({ error: 'Pond stats upstream unavailable', detail: String(err.message || err) });
 }
};