/**
 * Multi-wallet public dossier lookup (any Solana address).
 *
 * Pond does not publish a free public passport API for arbitrary wallets.
 * The long-standing community endpoints people use for "paste wallet → stats"
 * live on cary0x.com (same data Cary's docs site shows).
 *
 * This module:
 *   - Calls those public HTTP GETs by wallet only (no user cookies, no login scrape)
 *   - Never invents numbers
 *   - Fails soft when upstream is down
 *
 * Disable with: POND_PUBLIC_DOSSIER=0
 */

const MANIFEST = 'https://www.cary0x.com/api/manifest/';
const HEALTH = 'https://www.cary0x.com/api/health/';
const LUCK = 'https://www.cary0x.com/api/luck/';
const BUBBLES = 'https://www.cary0x.com/api/bubbles/';
const POND_LUCK = 'https://www.pond0x.com/api/solana/luck/';

const { formatBadges } = require('./pond-passport');

function publicDossierEnabled() {
  const v = String(process.env.POND_PUBLIC_DOSSIER || '1').toLowerCase().trim();
  return v !== '0' && v !== 'false' && v !== 'off' && v !== 'no';
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function fetchJson(url, timeoutMs) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(function () {
    if (ctrl) ctrl.abort();
  }, timeoutMs || 10000);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': BROWSER_UA,
        Referer: 'https://www.cary0x.com/',
        Origin: 'https://www.cary0x.com'
      },
      signal: ctrl ? ctrl.signal : undefined
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = null;
    }
    return { ok: res.ok, status: res.status, data: data, text: text };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: String(err && err.message ? err.message : err)
    };
  } finally {
    clearTimeout(t);
  }
}

async function fetchJsonRetry(url, timeoutMs, tries) {
  let last = { ok: false, status: 0, data: null };
  const n = tries || 2;
  for (let i = 0; i < n; i++) {
    last = await fetchJson(url, timeoutMs);
    if (last.ok && last.data) return last;
    /* 5xx / empty: brief backoff then retry */
    if (i < n - 1) {
      await new Promise(function (r) {
        setTimeout(r, 180 + i * 220);
      });
    }
  }
  return last;
}

function normalizeManifest(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.error) return null;

  // Cary-style flat fields
  let proSwapsSol = data.proSwapsSol != null ? Number(data.proSwapsSol) : null;
  let proSwapsBx = data.proSwapsBx != null ? Number(data.proSwapsBx) : null;
  let isPro = data.isPro === true || data.isPro === 'true';
  let hasTwitter = data.hasTwitter === true || data.hasTwitter === 'true';
  let cope = data.cope === true || data.cope === 'true';
  let badges = data.badges != null ? formatBadges(data.badges) || String(data.badges) : null;
  let proExpiry = data.proExpiry != null ? data.proExpiry : null;
  let checkedin = data.checkedin === true || data.checkedin === 'true';
  let board = data.board != null ? Number(data.board) : null;

  // Nested shape (same as Pond passport)
  if (data.pro && typeof data.pro === 'object') {
    const pro = data.pro;
    if (pro.swaps) {
      if (proSwapsSol == null && pro.swaps.sol != null) proSwapsSol = Number(pro.swaps.sol);
      if (proSwapsBx == null && pro.swaps.bx != null) proSwapsBx = Number(pro.swaps.bx);
    }
    if (pro.isPro === true) isPro = true;
    if (pro.hasTwitter === true) hasTwitter = true;
  }

  // If completely empty of useful fields, treat as miss
  const hasAny =
    proSwapsSol != null ||
    proSwapsBx != null ||
    badges ||
    hasTwitter ||
    isPro ||
    board != null ||
    data.sol ||
    data.eth;

  if (!hasAny) return null;

  return {
    sol: data.sol || null,
    eth: data.eth || null,
    proSwapsSol: proSwapsSol,
    proSwapsBx: proSwapsBx,
    isPro: isPro,
    proExpiry: proExpiry,
    hasTwitter: hasTwitter,
    badges: badges,
    cope: cope,
    checkedin: checkedin,
    board: board,
    priority: data.priority_swap != null ? Number(data.priority_swap) : data.priority != null ? Number(data.priority) : null,
    source: 'public_community_manifest'
  };
}

function summarizeLuckAny(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.error) return null;
  const history = Array.isArray(data.history) ? data.history : [];
  return {
    luck: data.luck != null ? Number(data.luck) : null,
    impact: data.impact != null ? data.impact : null,
    referrals: data.referrals != null ? Number(data.referrals) : 0,
    referralTxns: data.referralTxns != null ? Number(data.referralTxns) : 0,
    associates: data.associates != null ? Number(data.associates) : 0,
    associateTxns: data.associateTxns != null ? Number(data.associateTxns) : 0,
    generated: data.generated != null ? Number(data.generated) : 0,
    historyCount: history.length,
    historyPreview: history.slice(0, 8).map(function (h) {
      return {
        amount: h.amount,
        bonus: h.bonus,
        token: h.token || '',
        fromamt: h.fromamt || '',
        isBuy: !!h.isBuy,
        fago: h.fago || '',
        ago: h.ago || null
      };
    })
  };
}

/**
 * @param {string} wallet
 * @returns {Promise<{
 *   ok: boolean,
 *   passport: object|null,
 *   luck: object|null,
 *   mining: object|null,
 *   bubbles: object|null,
 *   via: string[],
 *   errors: string[]
 * }>}
 */
async function fetchPublicDossier(wallet) {
  if (!publicDossierEnabled()) {
    return {
      ok: false,
      passport: null,
      luck: null,
      mining: null,
      bubbles: null,
      via: [],
      errors: ['public_dossier_disabled']
    };
  }

  const raw = String(wallet || '').trim();
  const w = encodeURIComponent(raw);
  /* Health / luck / bubbles are the live dossier. Manifest is currently 500
     upstream ("Failed to retrieve data from pond0x") — isolate it so it
     cannot starve the working feeds. */
  const [health, luckCary, luckPond, bubbles, manifest] = await Promise.all([
    fetchJsonRetry(HEALTH + w, 6500, 2),
    fetchJsonRetry(LUCK + w, 4000, 2),
    fetchJson(POND_LUCK + w, 4000),
    fetchJsonRetry(BUBBLES + w, 4000, 2),
    fetchJson(MANIFEST + w, 3500)
  ]);

  const via = [];
  const errors = [];

  let passport = null;
  if (manifest.ok && manifest.data) {
    passport = normalizeManifest(manifest.data);
    if (passport) via.push('community_manifest');
    else errors.push('manifest_empty_or_unparsed');
  } else {
    errors.push(
      'manifest_' +
        (manifest.status || 'err') +
        (manifest.data && manifest.data.error ? ':' + manifest.data.error : '')
    );
  }

  let luck = null;
  if (luckPond.ok && luckPond.data) {
    luck = summarizeLuckAny(luckPond.data);
    if (luck) via.push('pond_luck_public');
  }
  if (!luck && luckCary.ok && luckCary.data) {
    luck = summarizeLuckAny(luckCary.data);
    if (luck) via.push('community_luck');
  }

  let mining = null;
  if (health.ok && health.data && !health.data.error) {
    mining = {
      account: health.data.account || wallet,
      stats: health.data.stats || null,
      ai_beta: Array.isArray(health.data.ai_beta) ? health.data.ai_beta : [],
      available: !!(health.data.stats),
      source: 'community_health',
      cary0x: true
    };
    via.push('community_health');
  } else if (!health.ok) {
    errors.push('health_' + (health.status || 'err'));
  }

  let bubblesOut = null;
  if (bubbles.ok && bubbles.data && !bubbles.data.error) {
    bubblesOut = {
      bubbles: bubbles.data.bubbles != null ? Number(bubbles.data.bubbles) : null,
      boosts: Array.isArray(bubbles.data.boosts) ? bubbles.data.boosts : []
    };
    via.push('community_bubbles');
  }

  const ok = !!(passport || luck || mining || bubblesOut);
  return {
    ok: ok,
    passport: passport,
    luck: luck,
    mining: mining,
    bubbles: bubblesOut,
    via: via,
    errors: errors
  };
}

module.exports = {
  publicDossierEnabled,
  fetchPublicDossier,
  normalizeManifest
};
