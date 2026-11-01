/**
 * DOSWAPZ - global swap counter API.
 * Persistence order:
 * 1. Vercel KV (if KV_REST_API_URL + KV_REST_API_TOKEN)
 * 2. Netlify Blobs (default on Netlify - no extra env)
 * GET falls back to assets/data/swap-stats.json when empty.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_STATS = { total: 0, signatures: [], updatedAt: null };
const KV_KEY = 'doswapz:swap-stats';
const BLOB_STORE = 'swap-stats';
const BLOB_STATS_KEY = 'stats';
const MAX_SIG_HISTORY = 500;

function readBundledStats() {
 try {
 const statsPath = path.join(__dirname, '..', 'assets', 'data', 'swap-stats.json');
 return JSON.parse(fs.readFileSync(statsPath, 'utf8'));
 } catch (e) {
 return { ...DEFAULT_STATS };
 }
}

async function getKv() {
 if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
 try {
 const { kv } = require('@vercel/kv');
 return kv;
 } catch (e) {
 return null;
 }
}

async function getBlobStore() {
 try {
 const { getStore } = require('@netlify/blobs');
 // eventual - strong requires uncachedEdgeURL not present in all Netlify runtimes
 return getStore({ name: BLOB_STORE, consistency: 'eventual' });
 } catch (e) {
 console.warn('swap-stats blob store unavailable:', e && e.message ? e.message : e);
 return null;
 }
}

function normalizeStats(raw) {
 if (!raw || typeof raw !== 'object') return { ...DEFAULT_STATS, signatures: [] };
 const signatures = Array.isArray(raw.signatures) ? raw.signatures : [];
 let total = Math.max(0, Number(raw.total) || 0);
 // Repair desynced docs (sigs written but total stuck at 0)
 if (signatures.length > total) total = signatures.length;
 return {
 total,
 signatures,
 updatedAt: raw.updatedAt || null
 };
}

function knownSignatures(stats) {
 const set = new Set();
 (stats.signatures || []).forEach((entry) => {
 const sig = typeof entry === 'string' ? entry : entry && entry.sig;
 if (sig) set.add(String(sig));
 });
 return set;
}

function sigKey(signature) {
 // Keep blob key filesystem-safe / short enough
 return 'sig/' + String(signature).slice(0, 100);
}

async function loadFromKv() {
 const kv = await getKv();
 if (!kv) return null;
 try {
 const stored = await kv.get(KV_KEY);
 if (stored && typeof stored === 'object') {
 return { stats: normalizeStats(stored), backend: 'kv' };
 }
 } catch (e) {
 console.warn('swap-stats KV read failed:', e && e.message ? e.message : e);
 }
 return { stats: { ...DEFAULT_STATS, signatures: [] }, backend: 'kv' };
}

async function loadFromBlobs() {
 const blobs = await getBlobStore();
 if (!blobs) return null;
 try {
 const stored = await blobs.get(BLOB_STATS_KEY, { type: 'json' });
 if (stored && typeof stored === 'object') {
 return { stats: normalizeStats(stored), backend: 'blobs' };
 }
 } catch (e) {
 console.warn('swap-stats blob read failed:', e && e.message ? e.message : e);
 }
 return { stats: { ...DEFAULT_STATS, signatures: [] }, backend: 'blobs' };
}

async function loadStatsWithBackend() {
 if (await getKv()) {
 const fromKv = await loadFromKv();
 if (fromKv) return fromKv;
 }
 const fromBlobs = await loadFromBlobs();
 if (fromBlobs) return fromBlobs;
 return { stats: readBundledStats(), backend: null };
}

/**
 * First remote write: start from bundled seed total so UI doesn't reset history to 1.
 */
function withSeedBaseline(remoteStats) {
 const stats = normalizeStats(remoteStats);
 const remoteEmpty = !stats.updatedAt && (stats.total || 0) === 0 && (!stats.signatures || stats.signatures.length === 0);
 if (!remoteEmpty) return stats;
 const bundled = normalizeStats(readBundledStats());
 if ((bundled.total || 0) > 0) {
 return {
 total: bundled.total,
 signatures: [],
 updatedAt: null,
 _seeded: true
 };
 }
 return stats;
}

async function saveToKv(stats) {
 const kv = await getKv();
 if (!kv) return false;
 const payload = {
 total: stats.total,
 signatures: stats.signatures || [],
 updatedAt: new Date().toISOString()
 };
 await kv.set(KV_KEY, payload);
 return true;
}

async function saveToBlobs(stats) {
 const blobs = await getBlobStore();
 if (!blobs) return false;
 const payload = {
 total: stats.total,
 signatures: stats.signatures || [],
 updatedAt: new Date().toISOString()
 };
 await blobs.setJSON(BLOB_STATS_KEY, payload);
 return true;
}

async function blobHasSig(signature) {
 const blobs = await getBlobStore();
 if (!blobs) return false;
 try {
 const hit = await blobs.get(sigKey(signature), { type: 'text' });
 return hit != null && hit !== '';
 } catch (e) {
 return false;
 }
}

async function blobMarkSig(signature, ts) {
 const blobs = await getBlobStore();
 if (!blobs) return;
 try {
 await blobs.set(sigKey(signature), String(ts || Date.now()));
 } catch (e) {
 // non-fatal - stats doc is source of truth
 }
}

/**
 * Record a confirmed swap signature. Idempotent per signature.
 */
async function recordSignature(signature) {
 const loaded = await loadStatsWithBackend();
 let stats = withSeedBaseline(loaded.stats);
 const backendPreferred = (await getKv()) ? 'kv' : (await getBlobStore()) ? 'blobs' : null;

 if (!backendPreferred) {
 return {
 total: stats.total || 0,
 duplicate: false,
 recorded: false,
 persisted: false,
 backend: null,
 error: 'No persistence backend (KV/Blobs)'
 };
 }

 const known = knownSignatures(stats);

 // Duplicate checks: stats history + optional per-sig blob
 if (known.has(signature)) {
 return {
 total: stats.total || 0,
 duplicate: true,
 recorded: false,
 persisted: true,
 backend: backendPreferred
 };
 }
 if (backendPreferred === 'blobs' && (await blobHasSig(signature))) {
 // Sig marked but missing from history - repair total once
 if (!known.has(signature)) {
 stats.signatures = stats.signatures || [];
 stats.signatures.push({ sig: signature, ts: Date.now() });
 if (stats.signatures.length > MAX_SIG_HISTORY) {
 stats.signatures = stats.signatures.slice(-MAX_SIG_HISTORY);
 }
 if ((stats.total || 0) < stats.signatures.length) {
 stats.total = Math.max(stats.total || 0, stats.signatures.length);
 }
 // If total still looks like seed-only without this sig counted, bump once
 if (!stats.updatedAt || stats.total === 0) {
 stats.total = (stats.total || 0) + 1;
 }
 await saveToBlobs(stats);
 const reloaded = await loadFromBlobs();
 return {
 total: (reloaded && reloaded.stats.total) || stats.total,
 duplicate: true,
 recorded: false,
 persisted: true,
 backend: 'blobs'
 };
 }
 return {
 total: stats.total || 0,
 duplicate: true,
 recorded: false,
 persisted: true,
 backend: 'blobs'
 };
 }

 const ts = Date.now();
 stats.signatures = stats.signatures || [];
 stats.signatures.push({ sig: signature, ts });
 if (stats.signatures.length > MAX_SIG_HISTORY) {
 stats.signatures = stats.signatures.slice(-MAX_SIG_HISTORY);
 }
 stats.total = (stats.total || 0) + 1;

 if (backendPreferred === 'kv') {
 await saveToKv(stats);
 return {
 total: stats.total,
 duplicate: false,
 recorded: true,
 persisted: true,
 backend: 'kv'
 };
 }

 // Blobs: write stats doc first (source of truth), then per-sig mark
 await saveToBlobs(stats);
 await blobMarkSig(signature, ts);

 // Re-read to return durable total (eventual consistency)
 let total = stats.total;
 try {
 const again = await loadFromBlobs();
 if (again && again.stats && typeof again.stats.total === 'number') {
 total = Math.max(total, again.stats.total);
 }
 } catch (e) {}

 return {
 total,
 duplicate: false,
 recorded: true,
 persisted: true,
 backend: 'blobs'
 };
}

const { rateLimitOrReject } = require('./lib/rate-limit');

module.exports = async function handler(req, res) {
 res.setHeader('Access-Control-Allow-Origin', '*');
 res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
 res.setHeader('Cache-Control', 'no-store');

 if (req.method === 'OPTIONS') {
 return res.status(204).end();
 }

 if (req.method === 'POST') {
 if (rateLimitOrReject(req, res, { prefix: 'swap-stats-write', perMinute: 30, perDay: 400 })) return;
 } else if (req.method === 'GET') {
 if (rateLimitOrReject(req, res, { prefix: 'swap-stats-read', perMinute: 90, perDay: 3000 })) return;
 }

 if (req.method === 'GET') {
 const loaded = await loadStatsWithBackend();
 let stats = normalizeStats(loaded.stats);

 // Surface bundled seed when remote never written
 if ((!stats.total || stats.total === 0) && !stats.updatedAt && (!stats.signatures || !stats.signatures.length)) {
 const bundled = normalizeStats(readBundledStats());
 if ((bundled.total || 0) > 0) stats = bundled;
 }

 return res.status(200).json({
 total: stats.total || 0,
 signatures: (stats.signatures || []).slice(-50),
 updatedAt: stats.updatedAt || null,
 persisted: loaded.backend === 'kv' || loaded.backend === 'blobs',
 backend: loaded.backend || null
 });
 }

 if (req.method === 'POST') {
 const signature = String((req.body && req.body.signature) || '').trim();
 if (!signature || signature.length < 32 || signature.length > 128) {
 return res.status(400).json({ error: 'Invalid signature' });
 }
 if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(signature)) {
 return res.status(400).json({ error: 'Invalid signature format' });
 }

 try {
 const result = await recordSignature(signature);
 if (!result.persisted && !result.duplicate) {
 return res.status(503).json({
 error: result.error || 'Persistence unavailable',
 total: result.total || 0,
 recorded: false,
 persisted: false
 });
 }
 return res.status(200).json({
 total: result.total,
 recorded: !!result.recorded,
 duplicate: !!result.duplicate,
 persisted: !!result.persisted,
 backend: result.backend || null
 });
 } catch (e) {
 console.error('swap-stats POST failed:', e && e.message ? e.message : e);
 return res.status(500).json({
 error: 'Failed to record swap',
 detail: e && e.message ? e.message : String(e)
 });
 }
 }

 return res.status(405).json({ error: 'Method not allowed' });
};
