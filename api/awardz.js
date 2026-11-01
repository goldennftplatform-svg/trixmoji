/**
 * GET  /api/awardz          public pools + live USD prices (real totals, $0 if empty)
 * POST /api/awardz          { action: 'intent' | 'confirm' }
 *
 * No line-item fee. USD book from live spot. Leftover coins if price rises stay with DOSWAPZ (conversion residual). Entertainment cap. Not a house game.
 */
const { rateLimitOrReject } = require('./lib/rate-limit');
const { readSession } = require('./lib/x-session');
const { fetchUsdPrices } = require('./lib/awardz-oracle');
const { verifyDeposit } = require('./lib/awardz-chain');
const { isSolanaAddress, isEvmAddress, normalizeAddress } = require('./lib/chain-address');
const storeLib = require('./lib/awardz-store');

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  return {};
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

module.exports = async function handler(req, res) {
  cors(res);
  try {
    if (req.__netlifyEvent) storeLib.connectNetlifyBlobs(req.__netlifyEvent);
  } catch (e) {}

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    if (rateLimitOrReject(req, res, { prefix: 'awardz-get', perMinute: 60, perDay: 2000 })) return;
    try {
      const store = await storeLib.loadStore();
      const prices = await fetchUsdPrices();
      res.status(200).json(storeLib.snapshot(store, prices));
    } catch (e) {
      res.status(503).json({ ok: false, error: String(e && e.message ? e.message : e) });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'GET or POST' });
    return;
  }

  if (rateLimitOrReject(req, res, { prefix: 'awardz-post', perMinute: 20, perDay: 80 })) return;

  if (!storeLib.liveEnabled()) {
    res.status(403).json({ ok: false, error: 'Awardz is not live' });
    return;
  }

  const user = readSession(req);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Connect with X first', needLogin: true });
    return;
  }

  const body = parseBody(req);
  const action = String(body.action || '').toLowerCase();

  if (action === 'intent') {
    const lock = String(body.lock || '').toLowerCase();
    const chain = String(body.chain || '').toLowerCase();
    const from = normalizeAddress(body.from);
    const usd = Number(body.usd);
    if (lock !== 'day' && lock !== 'week' && lock !== 'month') {
      res.status(400).json({ ok: false, error: 'lock must be day, week, or month' });
      return;
    }
    if (chain !== 'sol' && chain !== 'eth') {
      res.status(400).json({ ok: false, error: 'chain must be sol or eth' });
      return;
    }
    if (chain === 'sol' && !isSolanaAddress(from)) {
      res.status(400).json({ ok: false, error: 'Connect a Solana wallet first' });
      return;
    }
    if (chain === 'eth' && !isEvmAddress(from)) {
      res.status(400).json({ ok: false, error: 'Connect an Ethereum wallet first' });
      return;
    }
    if (!Number.isFinite(usd) || usd < storeLib.MIN_USD) {
      res.status(400).json({ ok: false, error: 'Minimum is $' + storeLib.MIN_USD + ' USD worth' });
      return;
    }
    if (usd > storeLib.MAX_USD) {
      res.status(400).json({
        ok: false,
        error: 'Max $' + storeLib.MAX_USD + ' USD worth per entry (entertainment only — do not send the bag)'
      });
      return;
    }
    const banned = String(process.env.AWARDZ_BAN_XIDS || '')
      .split(',')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    if (banned.indexOf(String(user.id)) >= 0) {
      res.status(403).json({ ok: false, error: 'This account is not eligible for Awardz prizes' });
      return;
    }
    if (!body.acks || body.acks.vol !== true || body.acks.pvp !== true || body.acks.lose !== true) {
      res.status(400).json({ ok: false, error: 'Acknowledgments required' });
      return;
    }

    let prices;
    try {
      prices = await fetchUsdPrices();
    } catch (e) {
      res.status(503).json({ ok: false, error: 'USD oracle unavailable' });
      return;
    }
    const px = chain === 'sol' ? prices.sol : prices.eth;
    const amountNative = storeLib.nativeForUsd(usd, chain, px);
    const usdNotional = storeLib.usdFromNative(amountNative, chain, px);
    const now = Date.now();
    const loaded = await storeLib.loadStore();
    const period = storeLib.ensurePeriod(loaded, lock, now);
    const closePad = chain === 'eth' ? 20 * 60 * 1000 : 5 * 60 * 1000;
    if (!period || period.status !== 'open' || now >= Number(period.end) - closePad) {
      res.status(400).json({
        ok: false,
        error: 'Too close to lock close (or already closed). Wait for the next lock so your send can confirm. We do not take last-second entries.'
      });
      return;
    }
    const intent = {
      id: storeLib.newId(),
      xid: String(user.id),
      username: String(user.username),
      lock: lock,
      periodId: period.id,
      chain: chain,
      from: from,
      amountNative: amountNative,
      usd: Math.round(usdNotional * 100) / 100,
      priceUsd: px,
      to: chain === 'sol' ? storeLib.SOL_TREASURY : storeLib.ETH_TREASURY,
      createdAt: now,
      expiresAt: now + storeLib.INTENT_MS,
      status: 'open'
    };

    const store = loaded;
    if (!store.intents) store.intents = {};
    intent.acks = { vol: true, pvp: true, lose: true };
    store.intents[intent.id] = intent;
    Object.keys(store.intents).forEach(function (k) {
      if (store.intents[k].expiresAt < now - 86400000) delete store.intents[k];
    });
    const saved = await storeLib.saveStore(store);
    if (!saved) {
      res.status(503).json({ ok: false, error: 'Could not persist intent' });
      return;
    }
    res.status(200).json({
      ok: true,
      intent: {
        id: intent.id,
        lock: intent.lock,
        chain: intent.chain,
        from: intent.from,
        to: intent.to,
        amountNative: intent.amountNative,
        usd: intent.usd,
        priceUsd: intent.priceUsd,
        expiresAt: intent.expiresAt,
        display: storeLib.formatNative(intent.amountNative, intent.chain)
      },
      prices: prices
    });
    return;
  }

  if (action === 'confirm') {
    const intentId = String(body.intentId || '').trim();
    const txid = String(body.txid || '').trim();
    if (!intentId || !txid) {
      res.status(400).json({ ok: false, error: 'intentId and txid required' });
      return;
    }
    const store = await storeLib.loadStore();
    if (!store.intents) store.intents = {};
    const intent = store.intents[intentId];
    if (!intent) {
      res.status(404).json({ ok: false, error: 'Unknown intent' });
      return;
    }
    if (String(intent.xid) !== String(user.id)) {
      res.status(403).json({ ok: false, error: 'Intent belongs to another X account' });
      return;
    }
    if (intent.status === 'credited') {
      res.status(200).json({ ok: true, already: true });
      return;
    }
    if (Date.now() > Number(intent.expiresAt)) {
      res.status(400).json({ ok: false, error: 'Intent expired. Make a new one.' });
      return;
    }
    if (store.usedTx && store.usedTx[txid]) {
      res.status(400).json({ ok: false, error: 'Transaction already credited' });
      return;
    }

    try {
      await verifyDeposit(intent.chain, txid, intent.from, intent.amountNative);
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e && e.message ? e.message : e) });
      return;
    }

    const now = Date.now();
    const period = storeLib.ensurePeriod(store, intent.lock, now);
    if (now >= Number(period.end) || period.status !== 'open') {
      res.status(400).json({ ok: false, error: 'That lock already closed' });
      return;
    }
    period.entries.push({
      xid: intent.xid,
      username: intent.username,
      chain: intent.chain,
      from: intent.from,
      amountNative: intent.amountNative,
      usdNotional: intent.usd,
      priceUsd: intent.priceUsd,
      txid: txid,
      ts: now,
      intentId: intent.id
    });
    intent.status = 'credited';
    intent.txid = txid;
    if (!store.usedTx) store.usedTx = {};
    store.usedTx[txid] = intent.id;
    const saved = await storeLib.saveStore(store);
    if (!saved) {
      res.status(503).json({ ok: false, error: 'Could not persist entry' });
      return;
    }
    res.status(200).json({
      ok: true,
      credited: true,
      usd: intent.usd,
      period: storeLib.publicPeriod(period, now)
    });
    return;
  }

  res.status(400).json({ ok: false, error: 'action must be intent or confirm' });
};
