/**
 * Awardz Pool store — KV / Netlify Blobs / local JSON.
 * USD is the pooling unit. No line-item fee. House take = leftover crypto
 * after paying the USD book at settlement spot (solvency cap if dump).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const periods = require('./awardz-periods');
const { SOL_TREASURY, ETH_TREASURY } = require('./awardz-chain');

const KV_KEY = 'doswapz:awardz';
const BLOB_STORE = 'awardz';
const BLOB_KEY = 'pool';
const MIN_USD = 5;
const MAX_USD = 100;
const INTENT_MS = 20 * 60 * 1000;

function emptyStore() {
  return { updatedAt: null, intents: {}, periods: {}, usedTx: {} };
}

function localFilePath() {
  return path.join(__dirname, '..', '..', 'dev', 'awardz.json');
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
    fs.writeFileSync(p, JSON.stringify(store, null, 2));
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

function ensurePeriod(store, kind, ts) {
  if (!store.periods) store.periods = {};
  const m = periods.meta(kind, ts);
  if (!m) return null;
  if (!store.periods[m.id]) {
    store.periods[m.id] = {
      id: m.id,
      kind: m.kind,
      start: m.start,
      end: m.end,
      status: 'open',
      entries: [],
      scores: {},
      settle: null
    };
  }
  return store.periods[m.id];
}

function liveEnabled() {
  return String(process.env.AWARDZ_LIVE || '1') !== '0';
}

function newId() {
  return crypto.randomBytes(8).toString('hex');
}

function nativeForUsd(usd, chain, price) {
  const u = Number(usd);
  if (!(u > 0) || !(price > 0)) return null;
  if (chain === 'sol') {
    let lamports = Math.floor((u / price) * 1e9);
    if (lamports < 1) lamports = 1;
    return String(lamports);
  }
  if (chain === 'eth') {
    const giga = Math.max(1, Math.floor((u / price) * 1e9));
    return (BigInt(giga) * 1000000000n).toString();
  }
  return null;
}

function usdFromNative(amount, chain, price) {
  if (!(price > 0)) return 0;
  if (chain === 'sol') {
    const n = Number(amount);
    if (!(n > 0)) return 0;
    return (n / 1e9) * price;
  }
  if (chain === 'eth') {
    try {
      const wei = BigInt(String(amount || '0'));
      if (wei <= 0n) return 0;
      const giga = Number(wei / 1000000000n);
      return (giga / 1e9) * price;
    } catch (e) {
      return 0;
    }
  }
  return 0;
}

function formatNative(amount, chain) {
  if (chain === 'sol') {
    const n = Number(amount || 0);
    return (n / 1e9).toFixed(6) + ' SOL';
  }
  if (chain === 'eth') {
    try {
      const wei = BigInt(String(amount || '0'));
      const giga = Number(wei / 1000000000n);
      return (giga / 1e9).toFixed(6) + ' ETH';
    } catch (e) {
      return String(amount) + ' wei';
    }
  }
  return String(amount);
}

function publicEntry(e) {
  if (!e) return null;
  return {
    username: e.username,
    chain: e.chain,
    usd: Math.round(Number(e.usdNotional) * 100) / 100,
    native: formatNative(e.amountNative, e.chain),
    ts: e.ts
  };
}

function publicBoard(period) {
  const scores = period.scores || {};
  const rows = Object.keys(scores).map(function (xid) {
    const s = scores[xid];
    const stakes = (period.entries || []).filter(function (e) {
      return String(e.xid) === String(xid);
    });
    const usd = stakes.reduce(function (a, e) {
      return a + Number(e.usdNotional || 0);
    }, 0);
    return {
      username: s.username,
      score: Number(s.score) || 0,
      game: s.game || '',
      usd: Math.round(usd * 100) / 100,
      ts: s.ts || 0
    };
  });
  rows.sort(function (a, b) {
    return b.score - a.score || a.ts - b.ts;
  });
  return rows.slice(0, 25);
}

function periodUsd(period) {
  return (period.entries || []).reduce(function (a, e) {
    return a + Number(e.usdNotional || 0);
  }, 0);
}

function publicPeriod(period, now) {
  now = now || Date.now();
  const usd = periodUsd(period);
  return {
    id: period.id,
    kind: period.kind,
    start: period.start,
    end: period.end,
    status: period.status,
    usd: Math.round(usd * 100) / 100,
    n: (period.entries || []).length,
    remainMs: Math.max(0, Number(period.end) - now),
    board: publicBoard(period),
    entries: (period.entries || []).map(publicEntry),
    settle: period.settle
      ? {
          type: period.settle.type,
          poolUsd: period.settle.poolUsd,
          inventoryUsd: period.settle.inventoryUsd,
          house: period.settle.housePublic,
          winners: period.settle.winnersPublic,
          payoutStatus: period.settle.payoutStatus
        }
      : null
  };
}

function snapshot(store, prices) {
  const now = Date.now();
  const out = {};
  periods.kinds().forEach(function (kind) {
    const p = ensurePeriod(store, kind, now);
    out[kind] = publicPeriod(p, now);
  });
  return {
    ok: true,
    live: liveEnabled(),
    noFee: true,
    conversionOnly: true,
    minUsd: MIN_USD,
    maxUsd: MAX_USD,
    entertainmentOnly: true,
    addresses: { sol: SOL_TREASURY, eth: ETH_TREASURY },
    prices: prices
      ? { sol: prices.sol, eth: prices.eth, source: prices.source, ts: prices.ts }
      : null,
    periods: out,
    updatedAt: store.updatedAt || null
  };
}

function computeSettle(period, prices) {
  const entries = period.entries || [];
  const scores = period.scores || {};
  const eligible = entries.filter(function (e) {
    const s = scores[e.xid];
    return s && Number(s.score) > 0;
  });
  let invSol = 0;
  let invEth = 0n;
  let poolUsd = 0;
  entries.forEach(function (e) {
    poolUsd += Number(e.usdNotional || 0);
    if (e.chain === 'sol') invSol += Number(e.amountNative || 0);
    if (e.chain === 'eth') {
      try {
        invEth += BigInt(String(e.amountNative || '0'));
      } catch (err) {}
    }
  });
  const inv = { sol: invSol, eth: invEth };
  const invUsd = usdFromNative(inv.sol, 'sol', prices.sol) + usdFromNative(inv.eth, 'eth', prices.eth);

  if (entries.length === 0) {
    return { type: 'empty', poolUsd: 0, inventoryUsd: 0, payouts: [], house: { sol: 0, eth: 0 } };
  }

  if (eligible.length < 2) {
    const payouts = entries.map(function (e) {
      return {
        to: e.from,
        chain: e.chain,
        amount: String(e.amountNative),
        reason: 'refund_solo',
        xid: e.xid,
        username: e.username
      };
    });
    return {
      type: 'refund',
      poolUsd: poolUsd,
      inventoryUsd: invUsd,
      payouts: payouts,
      house: { sol: 0, eth: 0 },
      winners: eligible.map(function (e) {
        return { username: e.username, xid: e.xid, score: scores[e.xid] && scores[e.xid].score };
      })
    };
  }

  const byXid = {};
  eligible.forEach(function (e) {
    const sc = Number(scores[e.xid].score);
    if (!byXid[e.xid] || sc > byXid[e.xid].score) {
      byXid[e.xid] = {
        xid: e.xid,
        username: e.username,
        score: sc,
        game: scores[e.xid].game,
        from: e.from,
        chain: e.chain
      };
    }
  });
  const ranked = Object.keys(byXid)
    .map(function (k) {
      return byXid[k];
    })
    .sort(function (a, b) {
      return b.score - a.score;
    });
  const top = ranked[0].score;
  const winners = ranked.filter(function (w) {
    return w.score === top;
  });

  const payUsd = invUsd <= poolUsd ? invUsd : poolUsd;
  const payouts = [];
  const shareUsd = payUsd / winners.length;
  const used = { sol: 0, eth: 0n };

  winners.forEach(function (w) {
    const px = w.chain === 'sol' ? prices.sol : prices.eth;
    let amountStr = '0';
    if (w.chain === 'sol') {
      let amount = Math.floor((shareUsd / px) * 1e9);
      const remain = inv.sol - used.sol;
      if (amount > remain) amount = Math.max(0, Math.floor(remain));
      used.sol += amount;
      amountStr = String(amount);
    } else {
      const want = BigInt(nativeForUsd(shareUsd, 'eth', px) || '0');
      const remain = inv.eth - used.eth;
      const amount = want > remain ? remain : want;
      used.eth += amount;
      amountStr = amount.toString();
    }
    payouts.push({
      to: w.from,
      chain: w.chain,
      amount: amountStr,
      reason: 'winner',
      xid: w.xid,
      username: w.username,
      score: w.score,
      usd: Math.round(shareUsd * 100) / 100
    });
  });

  const house = {
    sol: Math.max(0, inv.sol - used.sol),
    eth: inv.eth - used.eth > 0n ? inv.eth - used.eth : 0n
  };

  return {
    type: 'payout',
    poolUsd: Math.round(poolUsd * 100) / 100,
    inventoryUsd: Math.round(invUsd * 100) / 100,
    payUsd: Math.round(payUsd * 100) / 100,
    capBound: invUsd <= poolUsd,
    payouts: payouts,
    house: house,
    winners: winners.map(function (w) {
      return { username: w.username, xid: w.xid, score: w.score, chain: w.chain };
    })
  };
}

module.exports = {
  MIN_USD,
  MAX_USD,
  INTENT_MS,
  SOL_TREASURY,
  ETH_TREASURY,
  connectNetlifyBlobs,
  loadStore,
  saveStore,
  ensurePeriod,
  liveEnabled,
  newId,
  nativeForUsd,
  usdFromNative,
  formatNative,
  snapshot,
  publicPeriod,
  computeSettle,
  periodUsd
};
