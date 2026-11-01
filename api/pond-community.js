/**
 * DOSWAPZ - Pond community gate for OLD REWARDS-POOL RAILS only.
 * GET /api/pond-community?wallet={SOLANA_PUBKEY}
 *
 * STRICT MODE: wallet must be on the activated-rigs list
 * (synced from Dune Pond0x activated rigs via /api/pond-rigs-sync,
 *  or bundled/bootstrap seed of that same list).
 *
 * The activated-rigs DB IS the allowlist. No separate operator allowlist bypass.
 * Optional BLOCKLIST still denies even if on the rig list.
 *
 * Regular DOSWAPZ Jupiter swap stays open to any Solana wallet.
 *
 * Env:
 *   POND_COMMUNITY_BLOCKLIST — optional deny list
 *   (POND_COMMUNITY_ALLOWLIST is ignored — rig list only)
 */

const {
  connectNetlifyBlobs,
  hasActivatedRig,
  loadStore
} = require('./lib/pond-rigs-store');

const { rateLimitOrReject } = require('./lib/rate-limit');

function isValidSolanaAddress(addr) {
  return typeof addr === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

function parseList(envVal) {
  if (!envVal || typeof envVal !== 'string') return [];
  return envVal
    .split(/[\s,]+/)
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
}

module.exports = async function handler(req, res) {
  if (req.__netlifyEvent) {
    connectNetlifyBlobs(req.__netlifyEvent);
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=15');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (rateLimitOrReject(req, res, { prefix: 'pond-community', perMinute: 20, perDay: 400 })) {
    return;
  }

  var wallet = ((req.query && req.query.wallet) || '').trim();
  if (!isValidSolanaAddress(wallet)) {
    return res.status(400).json({
      error: 'Invalid Solana wallet address',
      allowed: false,
      gate: 'old_rails',
      openPath: 'jupiter'
    });
  }

  var blocklist = parseList(process.env.POND_COMMUNITY_BLOCKLIST);

  var base = {
    wallet: wallet,
    gate: 'old_rails',
    openPath: 'jupiter',
    mode: 'activated_rigs_only',
    cary0x: false,
    jupiterSwap: '/classic/pages/doswapz/swap.html',
    rule: 'Only wallets on the Pond activated-rigs list may use old rails. That list is the allowlist.'
  };

  if (blocklist.indexOf(wallet) !== -1) {
    return res.status(200).json(
      Object.assign({}, base, {
        allowed: false,
        reason: 'blocklist',
        activatedRig: false,
        message:
          'Wallet is blocked from OLD REWARDS-POOL RAILS. Use regular Jupiter swap — open to any Solana wallet.'
      })
    );
  }

  var rigStore = await loadStore();
  var onRigList = await hasActivatedRig(wallet);
  var rigMeta = {
    rigDbCount: rigStore.count || 0,
    rigDbUpdatedAt: rigStore.updatedAt || null,
    rigDbSource: rigStore.source || null,
    activatedRig: onRigList
  };

  if (onRigList) {
    return res.status(200).json(
      Object.assign({}, base, rigMeta, {
        allowed: true,
        reason: 'activated_rig',
        reasons: ['activated_rig'],
        message:
          'Activated Pond0x rig on DOSWAPZ list — OLD REWARDS-POOL RAILS unlocked.'
      })
    );
  }

  var emptyDb = !(rigStore.count > 0);
  return res.status(200).json(
    Object.assign({}, base, rigMeta, {
      allowed: false,
      reason: emptyDb ? 'rig_db_empty' : 'not_activated_rig',
      reasons: [],
      message: emptyDb
        ? 'Activated-rig list not loaded yet. Old rails locked. Use regular Jupiter, or sync Dune activated rigs.'
        : 'OLD REWARDS-POOL RAILS require an activated Pond0x mining rig on the list. Regular Jupiter stays open to any Solana wallet.',
      howToQualify:
        'Activate a mining rig on Pond0x. After the list syncs (Dune → /api/pond-rigs-sync), reconnect here. Or use /classic/pages/doswapz/swap.html (open Jupiter).'
    })
  );
};
