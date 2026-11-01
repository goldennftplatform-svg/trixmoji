/**
 * Activated Pond0x mining-rig wallet store.
 * Backends (first available wins for writes):
 *   1) Vercel KV (KV_REST_API_URL + KV_REST_API_TOKEN)
 *   2) Netlify Blobs
 *   3) Bundled assets/data/pond-activated-rigs.json (read-only fallback)
 *
 * Lookup is O(1) via in-memory Set after load.
 */

const fs = require('fs');
const path = require('path');

const KV_KEY = 'pond:activated-rigs';
const BLOB_STORE = 'pond-rigs';
const BLOB_KEY = 'activated-rigs';
const memory = {
  set: null,
  meta: null,
  loadedAt: 0
};

const MEMORY_TTL_MS = 60 * 1000;

function emptyStore() {
  return {
    wallets: [],
    updatedAt: null,
    source: null,
    count: 0,
    queryId: null
  };
}

function bundledCandidates() {
  return [
    /* Prefer require so Netlify/esbuild can inline or resolve from included_files */
    null, // placeholder for require path handled separately
    path.join(__dirname, '..', '..', 'assets', 'data', 'pond-activated-rigs.json'),
    path.join(__dirname, '..', 'assets', 'data', 'pond-activated-rigs.json'),
    path.join(process.cwd(), 'assets', 'data', 'pond-activated-rigs.json'),
    path.join(process.cwd(), 'api', '..', 'assets', 'data', 'pond-activated-rigs.json'),
    path.join(__dirname, 'pond-activated-rigs.json')
  ];
}

function readBundled() {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const rawReq = require('../../assets/data/pond-activated-rigs.json');
    if (rawReq && (Array.isArray(rawReq.wallets) || rawReq.count)) {
      return normalizeStore(rawReq);
    }
  } catch (e0) {}

  const paths = bundledCandidates();
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    if (!p) continue;
    try {
      if (!fs.existsSync(p)) continue;
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      return normalizeStore(raw);
    } catch (e) {}
  }
  return emptyStore();
}

function normalizeWallet(w) {
  if (w == null) return '';
  return String(w).trim();
}

function isValidSolanaAddress(addr) {
  return typeof addr === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

function normalizeStore(raw) {
  const out = emptyStore();
  if (!raw || typeof raw !== 'object') return out;

  out.updatedAt = raw.updatedAt || null;
  out.source = raw.source || null;
  out.queryId = raw.queryId || null;

  const list = [];
  const seen = Object.create(null);

  if (Array.isArray(raw.wallets)) {
    for (let i = 0; i < raw.wallets.length; i++) {
      const w = normalizeWallet(raw.wallets[i]);
      if (!isValidSolanaAddress(w) || seen[w]) continue;
      seen[w] = true;
      list.push(w);
    }
  } else if (raw.wallets && typeof raw.wallets === 'object') {
    const keys = Object.keys(raw.wallets);
    for (let i = 0; i < keys.length; i++) {
      const w = normalizeWallet(keys[i]);
      if (!isValidSolanaAddress(w) || seen[w]) continue;
      seen[w] = true;
      list.push(w);
    }
  }

  out.wallets = list;
  out.count = list.length;
  return out;
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
    const { connectLambda, setEnvironmentContext } = require('@netlify/blobs');
    /* Prefer explicit Lambda blobs context when Netlify provides event.blobs */
    if (event && event.blobs && typeof connectLambda === 'function') {
      connectLambda(event);
      return true;
    }
    /* Fallback: env-injected Netlify Blobs context (some runtimes) */
    if (process.env.NETLIFY_BLOBS_CONTEXT && typeof setEnvironmentContext === 'function') {
      try {
        var ctx = process.env.NETLIFY_BLOBS_CONTEXT;
        if (typeof ctx === 'string' && ctx.charAt(0) === '{') {
          setEnvironmentContext(JSON.parse(ctx));
          return true;
        }
      } catch (e2) {}
    }
    if (typeof connectLambda === 'function' && event) {
      try {
        connectLambda(event);
        return true;
      } catch (e3) {}
    }
    return false;
  } catch (e) {
    return false;
  }
}

async function getBlobStore() {
  try {
    const blobs = require('@netlify/blobs');
    const { getStore, getDeployStore } = blobs;
    /* Prefer named site store (persists across deploys) */
    if (typeof getStore === 'function') {
      try {
        return getStore({ name: BLOB_STORE, consistency: 'strong' });
      } catch (e1) {
        try {
          return getStore(BLOB_STORE);
        } catch (e2) {}
      }
    }
    /* Deploy store last resort (scoped to deploy) */
    if (typeof getDeployStore === 'function') {
      try {
        return getDeployStore({ name: BLOB_STORE, consistency: 'strong' });
      } catch (e3) {}
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function loadFromKv() {
  const kv = await getKv();
  if (!kv) return null;
  try {
    const stored = await kv.get(KV_KEY);
    if (!stored) return null;
    return normalizeStore(stored);
  } catch (e) {
    console.warn('[pond-rigs] KV read failed', e && e.message);
    return null;
  }
}

async function loadFromBlob() {
  const store = await getBlobStore();
  if (!store) return null;
  try {
    const data = await store.get(BLOB_KEY, { type: 'json' });
    if (!data) return null;
    return normalizeStore(data);
  } catch (e) {
    console.warn('[pond-rigs] Blob read failed', e && e.message);
    return null;
  }
}

async function loadStore(opts) {
  opts = opts || {};
  const force = !!opts.force;
  const now = Date.now();
  if (!force && memory.set && memory.meta && now - memory.loadedAt < MEMORY_TTL_MS) {
    return memory.meta;
  }

  let data = await loadFromKv();
  if (!data || !data.count) {
    const blob = await loadFromBlob();
    if (blob && blob.count) data = blob;
  }
  if (!data || !data.count) {
    data = readBundled();
  }
  if (!data) data = emptyStore();

  memory.set = new Set(data.wallets);
  memory.meta = data;
  memory.loadedAt = now;
  return data;
}

async function hasActivatedRig(wallet) {
  const w = normalizeWallet(wallet);
  if (!isValidSolanaAddress(w)) return false;
  await loadStore();
  return !!(memory.set && memory.set.has(w));
}

async function saveStore(payload) {
  const data = normalizeStore(payload);
  data.updatedAt = data.updatedAt || new Date().toISOString();
  data.count = data.wallets.length;

  let wrote = [];
  let writeErrors = [];

  const kv = await getKv();
  if (kv) {
    try {
      await kv.set(KV_KEY, data);
      wrote.push('kv');
    } catch (e) {
      writeErrors.push('kv:' + String(e && e.message ? e.message : e));
      console.warn('[pond-rigs] KV write failed', e && e.message);
    }
  }

  const blob = await getBlobStore();
  if (blob) {
    try {
      if (typeof blob.setJSON === 'function') {
        await blob.setJSON(BLOB_KEY, data);
      } else if (typeof blob.set === 'function') {
        await blob.set(BLOB_KEY, JSON.stringify(data), {
          metadata: { contentType: 'application/json' }
        });
      } else {
        throw new Error('blob store has no set/setJSON');
      }
      wrote.push('blob');
    } catch (e) {
      writeErrors.push('blob:' + String(e && e.message ? e.message : e));
      console.warn('[pond-rigs] Blob write failed', e && e.message);
    }
  } else {
    writeErrors.push('blob:store_unavailable');
  }

  memory.set = new Set(data.wallets);
  memory.meta = data;
  memory.loadedAt = Date.now();

  return { data, wrote, writeErrors };
}

/**
 * Extract wallet addresses from Dune result rows (flexible column names).
 */
function walletsFromDuneRows(rows) {
  if (!Array.isArray(rows)) return [];
  const preferred = [
    'wallet',
    'wallet_address',
    'address',
    'user',
    'owner',
    'account',
    'trader',
    'signer',
    'pubkey',
    'public_key',
    'rig_wallet',
    'miner',
    'authority'
  ];
  const out = [];
  const seen = Object.create(null);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== 'object') continue;

    let found = '';
    for (let p = 0; p < preferred.length; p++) {
      const key = preferred[p];
      if (row[key] != null && isValidSolanaAddress(normalizeWallet(row[key]))) {
        found = normalizeWallet(row[key]);
        break;
      }
    }
    if (!found) {
      const keys = Object.keys(row);
      for (let k = 0; k < keys.length; k++) {
        const v = normalizeWallet(row[keys[k]]);
        if (isValidSolanaAddress(v)) {
          found = v;
          break;
        }
      }
    }
    if (found && !seen[found]) {
      seen[found] = true;
      out.push(found);
    }
  }
  return out;
}

module.exports = {
  KV_KEY,
  emptyStore,
  normalizeStore,
  normalizeWallet,
  isValidSolanaAddress,
  connectNetlifyBlobs,
  loadStore,
  hasActivatedRig,
  saveStore,
  walletsFromDuneRows,
  readBundled
};
