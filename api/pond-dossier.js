/**
 * DOSWAPZ Pond status (safe stack — no Cary0x).
 * GET /api/pond-dossier?wallet={SOLANA_PUBKEY}
 *
 * Sources:
 *   1) DOSWAPZ activated-rigs store (old-rails gate)
 *   2) Public Pond0x luck / mining-session / global stats
 *   3) Optional operator Pond session (env) for passport fields
 *      when wallet matches the logged-in account:
 *        POND_SESSION_COOKIE, POND_NEXT_ACTION, POND_PASSPORT_CACHE
 *
 * Does NOT call Cary0x or invent passport numbers.
 */

const POND_LUCK = 'https://www.pond0x.com/api/solana/luck/';
const POND_MINING_SESSION = 'https://www.pond0x.com/api/solana/mining/session/';
const POND_GLOBAL = 'https://www.pond0x.com/api/solana';

const {
  connectNetlifyBlobs,
  hasActivatedRig,
  loadStore
} = require('./lib/pond-rigs-store');

const { resolvePassportForWallet, hasPassportEnv } = require('./lib/pond-passport');
const { fetchPublicDossier, publicDossierEnabled } = require('./lib/pond-public-dossier');

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

async function fetchJson(url, timeoutMs) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(function () {
    if (ctrl) ctrl.abort();
  }, timeoutMs || 8000);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      signal: ctrl ? ctrl.signal : undefined
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = text;
    }
    return { ok: res.ok, status: res.status, data: data };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: String(err && err.message ? err.message : err) };
  } finally {
    clearTimeout(t);
  }
}

function summarizeLuck(luckData) {
  if (!luckData || typeof luckData !== 'object' || Array.isArray(luckData)) {
    return null;
  }
  const history = Array.isArray(luckData.history) ? luckData.history : [];
  // Cap history shared to clients (privacy + payload size)
  const preview = history.slice(0, 8).map(function (h) {
    return {
      amount: h.amount,
      bonus: h.bonus,
      token: h.token || '',
      fromamt: h.fromamt || '',
      isBuy: !!h.isBuy,
      fago: h.fago || '',
      ago: h.ago || null
    };
  });
  return {
    luck: luckData.luck != null ? Number(luckData.luck) : null,
    impact: luckData.impact != null ? luckData.impact : null,
    referrals: luckData.referrals != null ? Number(luckData.referrals) : 0,
    referralTxns: luckData.referralTxns != null ? Number(luckData.referralTxns) : 0,
    associates: luckData.associates != null ? Number(luckData.associates) : 0,
    associateTxns: luckData.associateTxns != null ? Number(luckData.associateTxns) : 0,
    generated: luckData.generated != null ? Number(luckData.generated) : 0,
    historyCount: history.length,
    historyPreview: preview
  };
}

module.exports = async function handler(req, res) {
  if (req.__netlifyEvent) {
    try {
      connectNetlifyBlobs(req.__netlifyEvent);
    } catch (e) {}
  }

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

  if (rateLimitOrReject(req, res, { prefix: 'pond-dossier', perMinute: 20, perDay: 500 })) {
    return;
  }

  const wallet = String((req.query && req.query.wallet) || '').trim();
  if (!isValidSolanaAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid Solana wallet address' });
  }

  const blocklist = parseList(process.env.POND_COMMUNITY_BLOCKLIST);

  let rigStore = { count: 0, updatedAt: null, source: null };
  let activatedRig = false;
  try {
    rigStore = await loadStore();
    activatedRig = await hasActivatedRig(wallet);
  } catch (e) {
    activatedRig = false;
  }

  const onBlock = blocklist.indexOf(wallet) !== -1;
  const emptyDb = !(rigStore.count > 0);

  /* Activated-rig list IS the allowlist — no operator allowlist bypass */
  let oldRailsAllowed = false;
  let oldRailsReason = 'not_activated_rig';
  let oldRailsMessage =
    'OLD REWARDS-POOL RAILS: activated Pond0x rigs only (list = allowlist). Regular Jupiter stays open.';

  if (onBlock) {
    oldRailsAllowed = false;
    oldRailsReason = 'blocklist';
    oldRailsMessage = 'Wallet is blocklisted from old rails. Use regular DOSWAPZ Jupiter.';
  } else if (activatedRig) {
    oldRailsAllowed = true;
    oldRailsReason = 'activated_rig';
    oldRailsMessage = 'Activated Pond0x rig on list — old rails unlocked.';
  } else if (emptyDb) {
    oldRailsAllowed = false;
    oldRailsReason = 'rig_db_empty';
    oldRailsMessage =
      'Activated-rig list not loaded yet. Old rails locked until Dune sync. Use regular Jupiter anytime.';
  }

  // Parallel: public Pond stats, operator session passport, multi-wallet public dossier
  const publicJobs = Promise.all([
    fetchJson(POND_LUCK + encodeURIComponent(wallet), 3500),
    fetchJson(POND_MINING_SESSION + encodeURIComponent(wallet), 3000),
    fetchJson(POND_GLOBAL, 3000)
  ]);
  const passportJob = hasPassportEnv()
    ? resolvePassportForWallet(wallet)
    : Promise.resolve({ ok: false, reason: 'passport_env_unset' });
  const multiJob = publicDossierEnabled()
    ? fetchPublicDossier(wallet)
    : Promise.resolve({ ok: false, passport: null, luck: null, mining: null, via: [], errors: [] });

  const settled = await Promise.all([publicJobs, passportJob, multiJob]);
  const luckPack = settled[0][0];
  const sessionPack = settled[0][1];
  const globalPack = settled[0][2];
  const passportPack = settled[1];
  const multiPack = settled[2];

  // Prefer Pond public luck, then community luck
  let luck = luckPack.ok ? summarizeLuck(luckPack.data) : null;
  if (!luck && multiPack && multiPack.luck) luck = multiPack.luck;

  let miningSessionId = null;
  if (sessionPack.ok && sessionPack.data != null) {
    if (typeof sessionPack.data === 'string' && sessionPack.data.length > 8) {
      miningSessionId = sessionPack.data;
    } else if (sessionPack.data && typeof sessionPack.data === 'object' && sessionPack.data.session) {
      miningSessionId = String(sessionPack.data.session);
    }
  }

  let globalStats = null;
  if (globalPack.ok && globalPack.data && typeof globalPack.data === 'object') {
    globalStats = {
      swaps: globalPack.data.swaps != null ? Number(globalPack.data.swaps) : null,
      jackpot: globalPack.data.jackpot != null ? globalPack.data.jackpot : null,
      bonus: globalPack.data.bonus != null ? globalPack.data.bonus : null,
      lastUpdated: globalPack.data.lastUpdated || null
    };
  }

  // Operator session wins when it matches the requested wallet
  const sessionOk = !!(passportPack && passportPack.ok && passportPack.passport);
  const multiOk = !!(multiPack && multiPack.passport);
  const passport = sessionOk
    ? passportPack.passport
    : multiOk
      ? multiPack.passport
      : null;
  const passportOk = !!passport;
  const passportVia = sessionOk
    ? passportPack.via || 'operator_session'
    : multiOk
      ? 'public_multi_wallet'
      : null;

  // Mining: prefer community health (full stats) for any wallet; else session id only
  let miningOut = {
    sessionId: miningSessionId,
    healthAvailable: false,
    note: miningSessionId
      ? 'Public mining session id found.'
      : 'No public mining session id.'
  };
  if (multiPack && multiPack.mining && multiPack.mining.stats) {
    miningOut = Object.assign({}, multiPack.mining, {
      sessionId: miningSessionId,
      healthAvailable: true
    });
  }

  const sources = {
    doswapzRigs: true,
    pondLuckPublic: !!(luckPack.ok && luck),
    pondMiningSessionPublic: !!miningSessionId,
    pondGlobalPublic: !!globalStats,
    publicMultiWallet: publicDossierEnabled(),
    communityManifest: multiOk,
    communityHealth: !!(multiPack && multiPack.mining && multiPack.mining.stats),
    communityBubbles: !!(multiPack && multiPack.bubbles),
    pondPrivatePassport: sessionOk,
    pondPassportVia: passportVia,
    pondPassportConfigured: hasPassportEnv()
  };

  let classicReason = 'Passport not available for this wallet right now.';
  if (sessionOk) {
    classicReason = 'Passport from operator Pond session (matching wallet).';
  } else if (multiOk) {
    classicReason =
      'Passport from public multi-wallet lookup (same style as community dossier tools). Anyone can paste a wallet.';
  } else if (multiPack && multiPack.errors && multiPack.errors.length) {
    const hasLive =
      !!(luck || (multiPack && multiPack.mining && multiPack.mining.stats) || (multiPack && multiPack.bubbles));
    classicReason = hasLive
      ? 'Pond locked the public per-wallet swap/passport feed. Cary0x manifest now returns 500: Failed to retrieve data from pond0x. SOL/BX swap counts are only on pond0x.com while logged in. Luck / mining health can still load.'
      : 'Multi-wallet passport upstream unavailable (' +
        multiPack.errors.slice(0, 2).join(', ') +
        '). Luck/mining may still load.';
  } else if (passportPack && passportPack.reason === 'wallet_mismatch') {
    classicReason =
      'Operator session is a different wallet; using public multi-wallet lookup instead (if available).';
  }

  const body = {
    wallet: wallet,
    version: 5,
    source: passportOk
      ? sessionOk
        ? 'doswapz+operator_passport'
        : 'doswapz+public_multi_wallet'
      : 'doswapz_safe',
    generatedAt: new Date().toISOString(),
    sources: sources,

    activatedRig: activatedRig,
    rigDb: {
      count: rigStore.count || 0,
      updatedAt: rigStore.updatedAt || null,
      source: rigStore.source || null
    },
    oldRails: {
      allowed: oldRailsAllowed,
      reason: oldRailsReason,
      message: oldRailsMessage,
      openPath: '/classic/pages/doswapz/swap.html'
    },

    luck: luck,
    mining: miningOut,
    bubbles: multiPack && multiPack.bubbles ? multiPack.bubbles : null,
    global: globalStats,

    classicDossier: {
      available: passportOk,
      reason: classicReason,
      via: passportVia,
      multiWallet: !sessionOk && multiOk
    },

    proSwapsSol: passport ? passport.proSwapsSol : null,
    proSwapsBx: passport ? passport.proSwapsBx : null,
    isPro: passport ? passport.isPro : null,
    proExpiry: passport ? passport.proExpiry : null,
    hasTwitter: passport ? passport.hasTwitter : null,
    badges: passport ? passport.badges : null,
    cope: passport ? passport.cope : null,
    checkedin: passport ? passport.checkedin : null,
    board: passport ? passport.board : null,
    priority: passport ? passport.priority : null,
    eth: passport ? passport.eth : null,
    passport: passportOk
      ? {
          sol: passport.sol || wallet,
          eth: passport.eth,
          checkedin: passport.checkedin,
          isPro: passport.isPro,
          hasTwitter: passport.hasTwitter,
          proSwapsSol: passport.proSwapsSol,
          proSwapsBx: passport.proSwapsBx,
          badges: passport.badges,
          cope: passport.cope,
          board: passport.board,
          priority: passport.priority
        }
      : null,

    notes: [
      'Anyone can paste a wallet. Multi-wallet swaps/badges use public community lookup APIs when online.',
      'Old rails = activated-rig list only (not the same as dossier view).',
      'Operator Pond session used when the requested wallet matches your login.',
      'If Pond locks the public passport, SOL/BX swap counts stay blank here. Check pond0x.com while logged in. Luck/health can still load.'
    ]
  };

  return res.status(200).json(body);
};
