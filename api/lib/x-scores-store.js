/**
 * X-linked score store.
 * Row shape: { username, score, extra, ts, xid }
 * Public reads never include xid.
 */
const fs = require('fs');
const path = require('path');

const KV_KEY = 'doswapz:x-scores';
const BLOB_STORE = 'x-scores';
const BLOB_KEY = 'board';
const MAX_PER_GAME = 50;
const MAX_SCORE = 999999999;

const GAMES = {
  dad: { label: 'Crypto Dad' },
  tbb: { label: '$TBB Bull Run' },
  ftwr: { label: 'FTWR' },
  mom: { label: 'Crypto Mom' },
  lily: { label: 'Lily Leap' },
  snow: { label: 'Snowman / Geoff' },
  plumber: { label: 'Plumber' },
  xelon: { label: 'Xelon' },
  sell: { label: 'Sell Sell Sell' },
  regen: { label: 'Degen Regen' },
  hfo: { label: 'Hair Force One' },
  trench: { label: 'Save the Trenchez' },
  ape: { label: 'Ape Chamber' }
};

const EXTRA_KEYS = {
  mode: function (v) {
    return String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  },
  depth: function (v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(n, 99999)) : undefined;
  },
  kills: function (v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(n, 99999)) : undefined;
  },
  flies: function (v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(n, 99999)) : undefined;
  },
  pond: function (v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(n, 999)) : undefined;
  },
  geoffComplete: function (v) {
    return v === true || v === 1 || v === '1' || v === 'true';
  },
  sats: function (v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(n, MAX_SCORE)) : undefined;
  },
  btc: function (v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(n, 1000)) : undefined;
  },
  stacked: function (v) {
    return v === true || v === 1 || v === '1' || v === 'true';
  }
};

function emptyStore() {
  return { updatedAt: null, games: {} };
}

function localFilePath() {
  return path.join(__dirname, '..', '..', 'dev', 'x-scores.json');
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
    if (event && event.blobs && typeof connectLambda === 'function') {
      connectLambda(event);
      return true;
    }
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
    const { getStore } = blobs;
    if (typeof getStore === 'function') {
      try {
        return getStore({ name: BLOB_STORE, consistency: 'strong' });
      } catch (e1) {
        try {
          return getStore(BLOB_STORE);
        } catch (e2) {}
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function readLocal() {
  try {
    const p = localFilePath();
    if (!fs.existsSync(p)) return emptyStore();
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (raw && typeof raw === 'object') return raw;
  } catch (e) {}
  return emptyStore();
}

function writeLocal(store) {
  try {
    const p = localFilePath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(store, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

async function loadStore() {
  const kv = await getKv();
  if (kv) {
    try {
      const stored = await kv.get(KV_KEY);
      if (stored && typeof stored === 'object') return stored;
    } catch (e) {}
  }
  const blobs = await getBlobStore();
  if (blobs) {
    try {
      const raw = await blobs.get(BLOB_KEY, { type: 'json' });
      if (raw && typeof raw === 'object') return raw;
    } catch (e2) {}
  }
  return readLocal();
}

async function saveStore(store) {
  store.updatedAt = new Date().toISOString();
  let ok = false;
  const kv = await getKv();
  if (kv) {
    try {
      await kv.set(KV_KEY, store);
      ok = true;
    } catch (e) {}
  }
  const blobs = await getBlobStore();
  if (blobs) {
    try {
      await blobs.setJSON(BLOB_KEY, store);
      ok = true;
    } catch (e2) {}
  }
  if (writeLocal(store)) ok = true;
  return ok;
}

function normalizeGame(raw) {
  const g = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return GAMES[g] ? g : '';
}

function sanitizeExtra(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  Object.keys(EXTRA_KEYS).forEach(function (k) {
    if (raw[k] == null || raw[k] === '') return;
    const v = EXTRA_KEYS[k](raw[k]);
    if (v !== undefined) out[k] = v;
  });
  return out;
}

function publicRow(row) {
  if (!row) return null;
  return {
    username: row.username,
    score: Number(row.score) || 0,
    extra: row.extra || {},
    ts: row.ts || 0,
    verified: true
  };
}

function listGame(store, game) {
  const list = (store.games && store.games[game]) || [];
  return list.map(publicRow).filter(Boolean);
}

function upsertScore(store, user, game, score, extra) {
  if (!store.games) store.games = {};
  if (!Array.isArray(store.games[game])) store.games[game] = [];
  const list = store.games[game];
  const xid = String(user.id);
  const row = {
    xid: xid,
    username: String(user.username),
    score: score,
    extra: extra || {},
    ts: Date.now()
  };
  const others = list.filter(function (e) {
    return String(e.xid) !== xid;
  });
  const prior = list.find(function (e) {
    return String(e.xid) === xid;
  });
  let keptOld = false;
  if (prior && Number(prior.score) > Number(score)) {
    others.push(prior);
    keptOld = true;
  } else {
    others.push(row);
  }
  others.sort(function (a, b) {
    return Number(b.score) - Number(a.score) || Number(b.ts || 0) - Number(a.ts || 0);
  });
  store.games[game] = others.slice(0, MAX_PER_GAME);
  return {
    keptOld: keptOld,
    row: publicRow(keptOld ? prior : row),
    best: keptOld ? Number(prior.score) : score
  };
}

module.exports = {
  GAMES,
  MAX_SCORE,
  connectNetlifyBlobs,
  loadStore,
  saveStore,
  normalizeGame,
  sanitizeExtra,
  listGame,
  upsertScore,
  publicRow
};
