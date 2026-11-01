/**
 * Solana JSON-RPC proxy - browser-safe endpoint for token launch + reads.
 * Public RPCs block direct browser calls (403). Server-side forward fixes that.
 */

const ALLOWED_METHODS = new Set([
 'getHealth',
 'getVersion',
 'getLatestBlockhash',
 'getRecentBlockhash',
 'getMinimumBalanceForRentExemption',
 'getAccountInfo',
 'getBalance',
 'getTokenAccountsByOwner',
 'getParsedTokenAccountsByOwner',
 'getSignatureStatuses',
 'getSignaturesForAddress',
 'getTransaction',
 'getParsedTransaction',
 'getBlockHeight',
 'getEpochInfo',
 'getSlot',
 'getFeeForMessage',
 'isBlockhashValid',
 'sendTransaction',
 'simulateTransaction'
]);

const { solRpcUrls } = require('./lib/helius-rpc')

function rpcEndpoints() {
 return solRpcUrls()
}

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

function shouldRetryRpcError(err) {
 if (!err) return true;
 const code = err.code;
 const msg = String(err.message || '').toLowerCase();
 if (code === 403 || code === 429) return true;
 if (msg.includes('access forbidden') || msg.includes('rate limit') || msg.includes('too many')) return true;
 return false;
}

const { rateLimitOrReject } = require('./lib/rate-limit');

module.exports = async function handler(req, res) {
 res.setHeader('Access-Control-Allow-Origin', '*');
 res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

 if (req.method === 'OPTIONS') return res.status(204).end();
 if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

 // Tighter than general APIs - sendTransaction can be abused
 if (rateLimitOrReject(req, res, { prefix: 'solana-rpc', perMinute: 40, perDay: 2000 })) {
 return;
 }

 const body = parseBody(req);
 if (!body || typeof body.method !== 'string') {
 return res.status(400).json({
 jsonrpc: '2.0',
 error: { code: -32600, message: 'Invalid Request' },
 id: body && body.id != null ? body.id : null
 });
 }

 if (!ALLOWED_METHODS.has(body.method)) {
 return res.status(403).json({
 jsonrpc: '2.0',
 error: { code: 403, message: 'Method not allowed: ' + body.method },
 id: body.id != null ? body.id : null
 });
 }

 const endpoints = rpcEndpoints();
 let lastResponse = null;

 for (const url of endpoints) {
 try {
 const upstream = await fetch(url, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(body)
 });
 const json = await upstream.json();
 lastResponse = json;

 if (json.error && shouldRetryRpcError(json.error)) continue;
 return res.status(200).json(json);
 } catch (e) {
 lastResponse = {
 jsonrpc: '2.0',
 error: { code: -32603, message: e.message || 'RPC forward failed' },
 id: body.id != null ? body.id : null
 };
 }
 }

 return res.status(502).json(
 lastResponse || {
 jsonrpc: '2.0',
 error: { code: -32603, message: 'All Solana RPC endpoints failed' },
 id: body.id != null ? body.id : null
 }
 );
};