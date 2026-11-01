/**
 * Shared Vantablack coin catalog storage.
 * Backends:
 * 1. Vercel KV
 * 2. Netlify Blobs - per-mint keys + aggregate index (safe under eventual consistency)
 */

const fs = require('fs');
const path = require('path');

const KV_KEY = 'vantablack:coins';
const BLOB_STORE = 'vantablack';
const BLOB_INDEX = 'coins-index';
const BLOB_PREFIX = 'coin/';
const MAX_COINS = 200;

// Formerly blocked rebrand mints (CRYPTODAD/CRYPTOMOM) - now main as SELLER/MOMS
const BLOCKED_MINTS = new Set();

// Old demos + accidental market QA tracks - never show as catalog coins
const DROP_MINTS = new Set([
 'FKaSujGciK4hhFxacUPRycsTiv5W2NirjAuYsZLgpump',
 'E2ueKQ3EDTTmCkUA17j3KeTb2u6VT91xiyECdKRzpump',
 '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
]);

function readBundled() {
 try {
 const p = path.join(__dirname, '..', '..', 'assets', 'data', 'vantablack-coins.json');
 return JSON.parse(fs.readFileSync(p, 'utf8'));
 } catch (e) {
 return { coins: [], updatedAt: null };
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

function connectNetlifyBlobs(event) {
 if (!event) return false;
 try {
 const { connectLambda } = require('@netlify/blobs');
 if (typeof connectLambda !== 'function') return false;
 connectLambda(event);
 return true;
 } catch (e) {
 return false;
 }
}

async function getBlobStore() {
 try {
 const { getStore } = require('@netlify/blobs');
 return getStore({ name: BLOB_STORE, consistency: 'eventual' });
 } catch (e) {
 console.warn('vantablack blob store unavailable:', e && e.message ? e.message : e);
 return null;
 }
}

const MAIN_SYMBOL_ORDER = ['PORK', 'PNDC', 'WPOND', 'VOID', 'TRIX', 'PAULY'];

function isSolMint(mint) {
 return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint);
}

function isEthAddress(addr) {
 return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

const EVM_CHAIN_ALIASES = {
 eth: 'ethereum',
 ethereum: 'ethereum',
 base: 'base',
 arbitrum: 'arbitrum',
 arb: 'arbitrum',
 polygon: 'polygon',
 matic: 'polygon',
 optimism: 'optimism',
 op: 'optimism',
 bsc: 'bsc',
 bnb: 'bsc',
 robinhood: 'robinhood',
 hood: 'robinhood',
 rh: 'robinhood',
 'robinhood-chain': 'robinhood'
};

function resolveChain(raw, mint) {
 const chainHint = String((raw && raw.chain) || '').toLowerCase().trim();
 if (chainHint === 'sol' || chainHint === 'solana') return 'solana';
 if (EVM_CHAIN_ALIASES[chainHint]) return EVM_CHAIN_ALIASES[chainHint];
 if (isEthAddress(mint)) return 'ethereum';
 if (isSolMint(mint)) return 'solana';
 return null;
}

function normalizeCoin(raw) {
 if (!raw || !raw.mint) return null;
 const mint = String(raw.mint).trim();
 if (BLOCKED_MINTS.has(mint) || DROP_MINTS.has(mint)) return null;

 const chain = resolveChain(raw, mint);
 if (!chain) return null;
 if (chain === 'solana' && !isSolMint(mint)) return null;
 if (chain !== 'solana' && !isEthAddress(mint)) return null;

 const ltRaw = String(raw.launchType || '').toLowerCase();
 let launchType = 'classic';
 if (ltRaw === 'curve') launchType = 'curve';
 else if (ltRaw === 'erc20' || chain !== 'solana') {
 launchType = chain === 'solana' ? 'classic' : 'erc20';
 }

 const symbol = String(raw.symbol || 'TOKEN').trim().toUpperCase().slice(0, 12);
 const sectionRaw = String(raw.section || '').toLowerCase();
 const tagRaw = String(raw.tag || '').toLowerCase();
 const isMain =
 sectionRaw === 'main' ||
 tagRaw === 'main' ||
 (raw.source === 'seed' && MAIN_SYMBOL_ORDER.indexOf(symbol) >= 0);
 const section = isMain ? 'main' : 'created';
 const featured = isMain;
 const isEvm = chain !== 'solana';
 const maxDec = isEvm ? 18 : 9;

 return {
 mint,
 symbol,
 name: String(raw.name || raw.symbol || 'Token').trim().slice(0, 48),
 decimals: Number.isFinite(Number(raw.decimals))
 ? Math.min(maxDec, Math.max(0, Number(raw.decimals)))
 : maxDec,
 creator: String(raw.creator || '').trim().slice(0, 48),
 supply: String(raw.supply || '').trim().slice(0, 32),
 chain,
 featured,
 section,
 tag: isMain
 ? 'main'
 : launchType === 'curve'
 ? 'curve'
 : String(raw.tag || 'created').trim().slice(0, 24),
 launchType,
 listedAt: raw.listedAt || raw.ts || null,
 source: raw.source || 'vantablack'
 };
}

function mergeCoins(lists) {
 const seen = new Set();
 const out = [];
 lists.flat().forEach((raw) => {
 const c = normalizeCoin(raw);
 if (!c || seen.has(c.mint.toLowerCase())) return;
 seen.add(c.mint.toLowerCase());
 out.push(c);
 });
 out.sort((a, b) => {
 if (a.section !== b.section) return a.section === 'main' ? -1 : 1;
 if (a.section === 'main') {
 const ai = MAIN_SYMBOL_ORDER.indexOf(a.symbol);
 const bi = MAIN_SYMBOL_ORDER.indexOf(b.symbol);
 if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
 }
 if (a.featured !== b.featured) return a.featured ? -1 : 1;
 return String(b.listedAt || '').localeCompare(String(a.listedAt || ''));
 });
 return out.slice(0, MAX_COINS);
}

async function loadFromKv() {
 const kv = await getKv();
 if (!kv) return null;
 try {
 const stored = await kv.get(KV_KEY);
 if (stored && Array.isArray(stored.coins)) {
 return { coins: stored.coins, updatedAt: stored.updatedAt || null, backend: 'kv' };
 }
 } catch (e) {}
 return { coins: [], updatedAt: null, backend: 'kv' };
}

async function readBlobJson(blobs, key) {
 try {
 return await blobs.get(key, { type: 'json' });
 } catch (e) {
 return null;
 }
}

async function loadFromBlobs() {
 const blobs = await getBlobStore();
 if (!blobs) return null;

 const piles = [];

 // 1) Aggregate index (primary)
 const index = await readBlobJson(blobs, BLOB_INDEX);
 if (index && Array.isArray(index.coins)) piles.push(index.coins);

 // 2) Legacy single doc
 const legacy = await readBlobJson(blobs, 'coins');
 if (legacy && Array.isArray(legacy.coins)) piles.push(legacy.coins);

 // 3) list() per-mint keys (best-effort)
 try {
 if (typeof blobs.list === 'function') {
 const listed = await blobs.list({ prefix: BLOB_PREFIX });
 const keys = (listed && listed.blobs ? listed.blobs : [])
 .map((b) => (typeof b === 'string' ? b : b.key))
 .filter(Boolean)
 .slice(0, MAX_COINS);
 const rows = await Promise.all(keys.map((k) => readBlobJson(blobs, k)));
 piles.push(rows.filter(Boolean));
 }
 } catch (e) {}

 const coins = mergeCoins(piles);
 const updatedAt =
 (index && index.updatedAt) ||
 (legacy && legacy.updatedAt) ||
 (coins[0] && coins[0].listedAt) ||
 null;

 return { coins, updatedAt, backend: 'blobs' };
}

async function loadRemoteExtra() {
 if (await getKv()) {
 const kvData = await loadFromKv();
 if (kvData) return kvData;
 }
 const blobData = await loadFromBlobs();
 if (blobData) return blobData;
 return { coins: [], updatedAt: null, backend: null };
}

async function loadStore() {
 const bundled = readBundled();
 let remote;
 try {
 remote = await loadRemoteExtra();
 } catch (e) {
 console.warn('vantablack remote load failed:', e && e.message ? e.message : e);
 remote = { coins: [], updatedAt: null, backend: null };
 }
 return {
 coins: mergeCoins([bundled.coins || [], remote.coins || []]),
 updatedAt: remote.updatedAt || bundled.updatedAt || null,
 backend: remote.backend
 };
}

async function saveCoinRemote(coin) {
 const kv = await getKv();
 if (kv) {
 const stored = (await kv.get(KV_KEY)) || { coins: [] };
 const list = Array.isArray(stored.coins) ? stored.coins.slice() : [];
 const idx = list.findIndex((c) => c && c.mint === coin.mint);
 if (idx >= 0) list[idx] = coin;
 else list.unshift(coin);
 await kv.set(KV_KEY, {
 coins: mergeCoins([list]).slice(0, MAX_COINS),
 updatedAt: new Date().toISOString()
 });
 return { ok: true, backend: 'kv' };
 }

 const blobs = await getBlobStore();
 if (!blobs) return { ok: false, backend: null };

 try {
 // Per-mint document (survives index races)
 await blobs.setJSON(BLOB_PREFIX + coin.mint, coin);

 // Aggregate index - re-read + merge so we rarely drop siblings
 const piles = [[coin]];
 const index = await readBlobJson(blobs, BLOB_INDEX);
 if (index && Array.isArray(index.coins)) piles.push(index.coins);
 const legacy = await readBlobJson(blobs, 'coins');
 if (legacy && Array.isArray(legacy.coins)) piles.push(legacy.coins);

 const payload = {
 coins: mergeCoins(piles).slice(0, MAX_COINS),
 updatedAt: new Date().toISOString()
 };
 await blobs.setJSON(BLOB_INDEX, payload);
 // Keep legacy key updated for older readers
 await blobs.setJSON('coins', payload);

 return { ok: true, backend: 'blobs' };
 } catch (e) {
 console.warn('vantablack blob write failed:', e && e.message ? e.message : e);
 return { ok: false, backend: null, error: e && e.message ? e.message : String(e) };
 }
}

async function addCoin(body) {
 const coin = normalizeCoin({
 ...body,
 listedAt: body.listedAt || new Date().toISOString(),
 source: body.source || 'vantablack'
 });
 if (!coin) return { error: 'Invalid coin payload', status: 400 };

 let store;
 try {
 store = await loadStore();
 } catch (e) {
 store = { coins: readBundled().coins || [], backend: null };
 }

 const existing = store.coins.find((c) => c.mint === coin.mint);
 if (existing) {
 // Ensure remote has it even if only bundled
 if (!store.backend || existing.source === 'seed') {
 // still ok to return existing featured seed without re-posting
 }
 return { coin: existing, persisted: true, duplicate: true, backend: store.backend || 'bundled' };
 }

 const save = await saveCoinRemote(coin);
 return {
 coin,
 persisted: save.ok,
 duplicate: false,
 backend: save.backend,
 error: save.error || null
 };
}

module.exports = {
 BLOCKED_MINTS,
 MAX_COINS,
 readBundled,
 loadStore,
 addCoin,
 normalizeCoin,
 mergeCoins,
 connectNetlifyBlobs
};
