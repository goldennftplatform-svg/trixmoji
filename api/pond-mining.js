/**
 * DOSWAPZ - Pond mining / rig health (any wallet).
 * GET /api/pond-mining?wallet={SOLANA_PUBKEY}
 *
 * Same data path Cary's health page uses:
 *   GET https://www.cary0x.com/api/health/{wallet}
 * Plus Pond public session id when available.
 */

const HEALTH = 'https://www.cary0x.com/api/health/';
const POND_MINING_SESSION = 'https://www.pond0x.com/api/solana/mining/session/';

const { rateLimitOrReject } = require('./lib/rate-limit');

function isValidSolanaAddress(addr) {
  return typeof addr === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }
  return { ok: res.ok, status: res.status, data: data };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (rateLimitOrReject(req, res, { prefix: 'pond-mining', perMinute: 20, perDay: 500 })) {
    return;
  }

  const wallet = String((req.query && req.query.wallet) || '').trim();
  if (!isValidSolanaAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid Solana wallet address' });
  }

  try {
    const [health, session] = await Promise.all([
      fetchJson(HEALTH + encodeURIComponent(wallet)),
      fetchJson(POND_MINING_SESSION + encodeURIComponent(wallet))
    ]);

    let sessionId = null;
    if (session.ok && session.data != null) {
      if (typeof session.data === 'string' && session.data.length > 8) sessionId = session.data;
      else if (session.data && session.data.session) sessionId = String(session.data.session);
    }

    if (health.ok && health.data && health.data.stats) {
      return res.status(200).json({
        account: health.data.account || wallet,
        source: 'community_health',
        available: true,
        healthAvailable: true,
        sessionId: sessionId,
        stats: health.data.stats,
        ai_beta: Array.isArray(health.data.ai_beta) ? health.data.ai_beta : [],
        data: health.data.data || null,
        note: 'Mining health via public community health API (same feed Cary health page uses).'
      });
    }

    return res.status(200).json({
      account: wallet,
      source: 'pond0x_public_session',
      available: !!sessionId,
      healthAvailable: false,
      sessionId: sessionId,
      stats: null,
      ai_beta: [
        sessionId
          ? 'Public mining session id present; full health feed unavailable right now.'
          : 'Mining health feed unavailable for this wallet right now.'
      ],
      note: 'Community health upstream empty or down.'
    });
  } catch (err) {
    return res.status(200).json({
      account: wallet,
      source: 'error',
      available: false,
      healthAvailable: false,
      sessionId: null,
      stats: null,
      ai_beta: ['Mining lookup failed.'],
      error: String(err && err.message ? err.message : err)
    });
  }
};
