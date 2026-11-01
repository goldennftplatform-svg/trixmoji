/**
 * DOSWAPZ — Pond passport (operator session, no Cary0x).
 *
 * Env (Netlify secrets — never put in frontend JS):
 *   POND_SESSION_COOKIE   Full Cookie header value from a logged-in pond0x.com session
 *                         (must include sb-…-auth-token pieces; passport-cache optional)
 *   POND_NEXT_ACTION      Optional override (default known action id)
 *   POND_PASSPORT_CACHE   Optional: raw passport-cache JWT only (short-lived fallback)
 *
 * Flow:
 *   1) If POND_PASSPORT_CACHE set and unexpired → decode userData
 *   2) Else if POND_SESSION_COOKIE set → POST https://www.pond0x.com/ with next-action
 *   3) Parse Next.js flight body for { user, session }
 *
 * This is the operator's own Pond login — returns that account's passport,
 * only applied when the requested wallet matches user.sol.
 */

const POND_ORIGIN = 'https://www.pond0x.com';
const DEFAULT_NEXT_ACTION = '00eb55675a475f8eb5dc95c8fafc8ba5755a2dae94';

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function extractPassportCacheFromCookie(cookieStr) {
  if (!cookieStr) return '';
  const m = String(cookieStr).match(/(?:^|;\s*)passport-cache=([^;]+)/i);
  if (!m) return '';
  try {
    return decodeURIComponent(m[1].trim());
  } catch (e) {
    return m[1].trim();
  }
}

/**
 * Parse Next.js flight / RSC text for a line starting with N:{json}
 */
function parseFlightUser(text) {
  if (!text || typeof text !== 'string') return null;

  // Prefer explicit 1:{"user":...} style
  const lines = text.split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const rest = line.slice(colon + 1).trim();
    if (rest.charAt(0) !== '{') continue;
    try {
      const obj = JSON.parse(rest);
      if (obj && obj.user && typeof obj.user === 'object') return obj.user;
      if (obj && obj.sol && (obj.badges || obj.pro)) return obj;
    } catch (e) {}
  }

  // Fallback: find {"user":{...}} blob
  const idx = text.indexOf('"user":{');
  if (idx >= 0) {
    // walk back to opening {
    let start = text.lastIndexOf('{', idx);
    if (start < 0) start = idx;
    // crude brace match
    let depth = 0;
    for (let j = start; j < text.length; j++) {
      const ch = text.charAt(j);
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            const obj = JSON.parse(text.slice(start, j + 1));
            if (obj.user) return obj.user;
            if (obj.sol) return obj;
          } catch (e) {}
          break;
        }
      }
    }
  }
  return null;
}

function formatBadges(badges) {
  if (badges == null) return null;
  if (typeof badges === 'string') return badges;
  if (typeof badges !== 'object') return String(badges);
  const names = [];
  Object.keys(badges).forEach(function (k) {
    const v = badges[k];
    if (v === true || v === 'true' || v === 1 || v === '1') names.push(k);
  });
  return names.length ? names.join(',') : null;
}

function normalizePassportUser(user) {
  if (!user || typeof user !== 'object') return null;

  const pro = user.pro && typeof user.pro === 'object' ? user.pro : {};
  const swaps = pro.swaps && typeof pro.swaps === 'object' ? pro.swaps : {};
  const nestedPro = pro.pro && typeof pro.pro === 'object' ? pro.pro : {};

  const sol = user.sol || user.solAddress || null;
  const isPro =
    user.isPro === true ||
    pro.isPro === true ||
    nestedPro.isPro === true ||
    false;

  let proExpiry = null;
  if (Array.isArray(nestedPro.expiryDates) && nestedPro.expiryDates.length) {
    proExpiry = nestedPro.expiryDates[0];
  } else if (pro.expiry != null) {
    proExpiry = pro.expiry;
  }

  return {
    sol: sol,
    eth: user.eth || null,
    checkedin: user.checkedin === true,
    isPro: isPro,
    proExpiry: proExpiry,
    hasTwitter: user.hasTwitter === true || pro.hasTwitter === true,
    proSwapsSol: swaps.sol != null ? Number(swaps.sol) : null,
    proSwapsBx: swaps.bx != null ? Number(swaps.bx) : null,
    badges: formatBadges(user.badges),
    badgesRaw: user.badges || null,
    cope: user.cope === true,
    board: user.board != null ? Number(user.board) : null,
    priority: pro.priority != null ? Number(pro.priority) : user.priority_swap != null ? Number(user.priority_swap) : null,
    badgeAffirm: user.badge_affirm === true,
    minerHash: user.miner_hash || null,
    linked: Array.isArray(user.linked) ? user.linked : null,
    source: 'pond0x_session'
  };
}

function passportFromCacheJwt(jwt) {
  const payload = decodeJwtPayload(jwt);
  if (!payload) return null;
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    return { expired: true, passport: null };
  }
  const user = payload.userData || payload.user || null;
  const normalized = normalizePassportUser(user);
  if (normalized && !normalized.sol && payload.solAddress) {
    normalized.sol = payload.solAddress;
  }
  return { expired: false, passport: normalized };
}

/**
 * Build cookie jar from env. Netlify env values are size-limited, so we support:
 *   POND_SESSION_COOKIE / POND_SESSION_COOKIE_B64  — full jar (if it fits)
 *   POND_SB_AUTH_0 + POND_SB_AUTH_1                 — split Supabase auth cookie parts
 *   POND_PASSPORT_CACHE                             — short JWT (enough for dossier fields)
 */
function loadSessionCookieFromEnv() {
  const b64 = String(process.env.POND_SESSION_COOKIE_B64 || '').trim();
  if (b64) {
    try {
      return Buffer.from(b64, 'base64').toString('utf8').trim();
    } catch (e) {}
  }

  const raw = String(process.env.POND_SESSION_COOKIE || '').trim();
  if (raw && raw.length > 20) return raw;

  // Assemble from split pieces (avoids Netlify "value too long")
  const parts = [];
  const auth0 = String(process.env.POND_SB_AUTH_0 || '').trim();
  const auth1 = String(process.env.POND_SB_AUTH_1 || '').trim();
  const pass = String(process.env.POND_PASSPORT_CACHE || '').trim();
  if (auth0) {
    parts.push(
      auth0.indexOf('=') >= 0
        ? auth0
        : 'sb-vkqjvwxzsxilnsmpngmc-auth-token.0=' + auth0
    );
  }
  if (auth1) {
    parts.push(
      auth1.indexOf('=') >= 0
        ? auth1
        : 'sb-vkqjvwxzsxilnsmpngmc-auth-token.1=' + auth1
    );
  }
  if (pass) {
    parts.push(pass.indexOf('=') >= 0 ? pass : 'passport-cache=' + pass);
  }
  return parts.join('; ');
}

async function fetchPassportFromPondSession(opts) {
  opts = opts || {};
  const cookie = String(opts.cookie || loadSessionCookieFromEnv() || '').trim();
  const nextAction = String(
    opts.nextAction || process.env.POND_NEXT_ACTION || DEFAULT_NEXT_ACTION
  ).trim();

  if (!cookie) {
    return { ok: false, reason: 'no_session_cookie' };
  }

  // Fast path: passport-cache JWT inside cookie jar
  const cacheJwt = extractPassportCacheFromCookie(cookie);
  if (cacheJwt) {
    const fromCache = passportFromCacheJwt(cacheJwt);
    if (fromCache && fromCache.passport && !fromCache.expired) {
      return {
        ok: true,
        passport: fromCache.passport,
        via: 'passport-cache-cookie',
        stale: false
      };
    }
  }

  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(function () {
    if (ctrl) ctrl.abort();
  }, opts.timeoutMs || 12000);

  try {
    const res = await fetch(POND_ORIGIN + '/', {
      method: 'POST',
      headers: {
        Accept: 'text/x-component, */*',
        'Content-Type': 'text/plain;charset=UTF-8',
        'Next-Action': nextAction,
        Origin: POND_ORIGIN,
        Referer: POND_ORIGIN + '/',
        Cookie: cookie,
        'User-Agent': 'DOSWAPZ-pond-passport/1.0 (+https://doswapz.com; operator-session)'
      },
      body: '',
      signal: ctrl ? ctrl.signal : undefined,
      redirect: 'manual'
    });

    const text = await res.text();
    const user = parseFlightUser(text);
    const passport = normalizePassportUser(user);

    if (!passport) {
      return {
        ok: false,
        reason: 'parse_failed',
        status: res.status,
        hint: 'Session may be expired, or Pond changed next-action. Re-login and update POND_SESSION_COOKIE.'
      };
    }

    return {
      ok: true,
      passport: passport,
      via: 'pond_next_action',
      status: res.status
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'fetch_error',
      detail: String(err && err.message ? err.message : err)
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve passport for a requested wallet using operator session env.
 */
async function resolvePassportForWallet(wallet) {
  const w = String(wallet || '').trim();

  // 1) Explicit cache JWT env (short-lived)
  const cacheEnv = String(process.env.POND_PASSPORT_CACHE || '').trim();
  if (cacheEnv) {
    const fromEnv = passportFromCacheJwt(cacheEnv);
    if (fromEnv && fromEnv.expired) {
      return { ok: false, reason: 'passport_cache_expired' };
    }
    if (fromEnv && fromEnv.passport) {
      if (w && fromEnv.passport.sol && fromEnv.passport.sol !== w) {
        return {
          ok: false,
          reason: 'wallet_mismatch',
          passportSol: fromEnv.passport.sol,
          hint: 'Session passport is for a different wallet than requested.'
        };
      }
      return { ok: true, passport: fromEnv.passport, via: 'POND_PASSPORT_CACHE' };
    }
  }

  // 2) Session cookie → Pond
  const session = await fetchPassportFromPondSession({});
  if (!session.ok) return session;

  if (w && session.passport.sol && session.passport.sol !== w) {
    return {
      ok: false,
      reason: 'wallet_mismatch',
      passportSol: session.passport.sol,
      via: session.via,
      hint: 'Logged-in Pond session wallet does not match requested address.'
    };
  }

  return session;
}

function hasPassportEnv() {
  return !!(
    String(process.env.POND_SESSION_COOKIE || '').trim() ||
    String(process.env.POND_SESSION_COOKIE_B64 || '').trim() ||
    String(process.env.POND_PASSPORT_CACHE || '').trim() ||
    String(process.env.POND_SB_AUTH_0 || '').trim()
  );
}

module.exports = {
  DEFAULT_NEXT_ACTION,
  decodeJwtPayload,
  normalizePassportUser,
  parseFlightUser,
  resolvePassportForWallet,
  fetchPassportFromPondSession,
  hasPassportEnv,
  formatBadges
};
