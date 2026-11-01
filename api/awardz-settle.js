/**
 * Close ended Awardz periods, compute USD-book payout, leftover = conversion residual.
 *
 * POST /api/awardz-settle
 * Header x-awardz-admin: AWARDZ_ADMIN_SECRET (required for HTTP)
 * Body { pay: true } required to attempt AUTO_PAY sends.
 * Cron (Netlify schedule) computes winners only — never sends.
 */
const crypto = require('crypto');
const storeLib = require('./lib/awardz-store');
const { fetchUsdPrices } = require('./lib/awardz-oracle');
const { payAll, autoPayOn } = require('./lib/awardz-payout');
const periods = require('./lib/awardz-periods');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function adminOk(req) {
  const secret = String(process.env.AWARDZ_ADMIN_SECRET || '').trim();
  if (!secret) return false;
  const h = req.headers || {};
  const got = String(h['x-awardz-admin'] || h['X-Awardz-Admin'] || '').trim();
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

async function settleOpen(store, prices) {
  const now = Date.now();
  const done = [];
  periods.kinds().forEach(function (kind) {
    storeLib.ensurePeriod(store, kind, now);
    storeLib.ensurePeriod(store, kind, now - 86400000);
    storeLib.ensurePeriod(store, kind, now - 8 * 86400000);
  });
  const ids = Object.keys(store.periods || {});
  for (let i = 0; i < ids.length; i++) {
    const p = store.periods[ids[i]];
    if (!p || p.status !== 'open') continue;
    if (now < Number(p.end)) continue;
    const math = storeLib.computeSettle(p, prices);
    p.status = 'settled';
    p.settle = {
      at: now,
      prices: { sol: prices.sol, eth: prices.eth, source: prices.source },
      type: math.type,
      poolUsd: math.poolUsd,
      inventoryUsd: math.inventoryUsd,
      payUsd: math.payUsd,
      capBound: !!math.capBound,
      payouts: math.payouts,
      house: { sol: math.house.sol, eth: String(math.house.eth) },
      housePublic: {
        sol: storeLib.formatNative(math.house.sol, 'sol'),
        eth: storeLib.formatNative(String(math.house.eth), 'eth')
      },
      winnersPublic: (math.winners || []).map(function (w) {
        return { username: w.username, score: w.score, chain: w.chain };
      }),
      payoutStatus: 'pending'
    };
    done.push(p.id);
  }
  return done;
}

async function runSettle(opts) {
  opts = opts || {};
  const wantPay = !!opts.pay;
  const store = await storeLib.loadStore();
  const prices = await fetchUsdPrices();
  const closed = await settleOpen(store, prices);
  if (!wantPay) {
    const saved = await storeLib.saveStore(store);
    return { ok: true, saved: saved, closed: closed, paid: false, autoPay: autoPayOn() };
  }
  const pending = [];
  Object.keys(store.periods || {}).forEach(function (id) {
    const p = store.periods[id];
    if (p && p.settle && p.settle.payoutStatus === 'pending' && p.settle.payouts && p.settle.payouts.length) {
      pending.push(p);
    }
  });
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i];
    const results = await payAll(p.settle.payouts);
    p.settle.payoutResults = results.map(function (r) {
      return {
        to: r.to,
        chain: r.chain,
        amount: r.amount,
        username: r.username,
        result: r.result
      };
    });
    const sent = results.every(function (r) {
      return r.result && (r.result.ok || (r.result.skipped && r.result.reason === 'zero'));
    });
    const skipped = results.every(function (r) {
      return r.result && r.result.skipped;
    });
    p.settle.payoutStatus = sent ? 'sent' : skipped ? 'awaiting_payout' : 'needs_manual';
    p.settle.autoPay = autoPayOn();
  }
  const saved = await storeLib.saveStore(store);
  return { ok: true, saved: saved, closed: closed, paid: true, autoPay: autoPayOn() };
}

module.exports = async function handler(req, res) {
  try {
    if (req.__netlifyEvent) storeLib.connectNetlifyBlobs(req.__netlifyEvent);
  } catch (e) {}

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-awardz-admin');
    return send(res, 204, {});
  }
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'POST only' });
  }
  if (!adminOk(req)) return send(res, 401, { error: 'Unauthorized' });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    const result = await runSettle({ pay: body.pay === true });
    return send(res, 200, result);
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
  }
};

module.exports.runSettle = runSettle;
