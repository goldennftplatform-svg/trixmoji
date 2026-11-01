/**
 * DOSWAPZ - Sync activated Pond0x rig wallets from Dune into store.
 *
 * GET  /api/pond-rigs-sync   → status
 * POST /api/pond-rigs-sync  → pull Dune or accept { wallets: [] }
 *
 * Auth for POST:
 *   Authorization: Bearer <POND_RIGS_SYNC_SECRET>
 *   x-pond-rigs-secret: <POND_RIGS_SYNC_SECRET>
 *
 * Env: DUNE_API_KEY, DUNE_POND_RIG_QUERY_ID, POND_RIGS_SYNC_SECRET
 */

const {
  connectNetlifyBlobs,
  loadStore,
  saveStore,
  walletsFromDuneRows,
  isValidSolanaAddress,
  normalizeWallet
} = require('./lib/pond-rigs-store');
const { syncFromDune, uniqueWallets } = require('./lib/pond-rigs-dune');
const { rateLimitOrReject } = require('./lib/rate-limit');

function getSecret(req) {
  const h = req.headers || {};
  const auth = h.authorization || h.Authorization || '';
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const custom = h['x-pond-rigs-secret'] || h['X-Pond-Rigs-Secret'];
  if (custom) return String(custom).trim();
  return '';
}

function authorized(req) {
  const expected = (process.env.POND_RIGS_SYNC_SECRET || '').trim();
  if (!expected) return false;
  if (req.isScheduled === true) return true;
  const got = getSecret(req);
  return got && got === expected;
}

module.exports = async function handler(req, res) {
  if (req.__netlifyEvent) {
    connectNetlifyBlobs(req.__netlifyEvent);
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-pond-rigs-secret');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (rateLimitOrReject(req, res, { prefix: 'pond-rigs-sync', perMinute: 30, perDay: 500 })) {
    return;
  }

  if (req.method === 'GET') {
    const store = await loadStore({ force: true });
    return res.status(200).json({
      ok: true,
      count: store.count || 0,
      updatedAt: store.updatedAt,
      source: store.source,
      queryId: store.queryId || process.env.DUNE_POND_RIG_QUERY_ID || null,
      mode: process.env.POND_COMMUNITY_MODE || 'rigs_only',
      hasKv: !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
      hasDuneKey: !!process.env.DUNE_API_KEY,
      hasSyncSecret: !!process.env.POND_RIGS_SYNC_SECRET,
      gate: 'old_rails_requires_activated_rig'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!authorized(req)) {
    return res.status(401).json({
      error: 'Unauthorized',
      hint: 'Set POND_RIGS_SYNC_SECRET and send Authorization: Bearer <secret>'
    });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    let result;

    if (Array.isArray(body.wallets) && body.wallets.length) {
      const wallets = uniqueWallets(
        body.wallets.map(normalizeWallet).filter(isValidSolanaAddress)
      );
      const saved = await saveStore({
        wallets: wallets,
        updatedAt: new Date().toISOString(),
        source: body.source || 'manual_post',
        queryId: body.queryId || process.env.DUNE_POND_RIG_QUERY_ID || null
      });
      result = {
        count: saved.data.count,
        updatedAt: saved.data.updatedAt,
        source: saved.data.source,
        wrote: saved.wrote,
        writeErrors: saved.writeErrors || [],
        queryId: saved.data.queryId,
        persistOk: !!(saved.wrote && saved.wrote.length)
      };
    } else if (Array.isArray(body.rows) && body.rows.length) {
      const wallets = uniqueWallets(walletsFromDuneRows(body.rows));
      const saved = await saveStore({
        wallets: wallets,
        updatedAt: new Date().toISOString(),
        source: body.source || 'manual_rows',
        queryId: body.queryId || null
      });
      result = {
        count: saved.data.count,
        updatedAt: saved.data.updatedAt,
        source: saved.data.source,
        wrote: saved.wrote,
        writeErrors: saved.writeErrors || [],
        queryId: saved.data.queryId,
        persistOk: !!(saved.wrote && saved.wrote.length)
      };
    } else {
      result = await syncFromDune({
        queryId: body.queryId,
        apiKey: body.apiKey
      });
    }

    return res.status(200).json(Object.assign({ ok: true }, result));
  } catch (err) {
    return res.status(err.status && err.status >= 400 ? err.status : 502).json({
      error: 'Sync failed',
      detail: String(err && err.message ? err.message : err),
      rowCount: err.rowCount,
      sampleKeys: err.sampleKeys,
      hint: err.sampleKeys
        ? 'Check query columns include a Solana wallet/address field'
        : undefined
    });
  }
};
