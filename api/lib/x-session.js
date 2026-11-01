/**
 * DOSWAPZ X session — HMAC cookie only.
 * Stores X user id + username. Never stores X access tokens.
 */
const crypto = require('crypto');

const SESSION_COOKIE = 'dz_x';
const OAUTH_COOKIE = 'dz_x_oa';
const SESSION_DAYS = 14;
const OAUTH_MINUTES = 10;

function sessionSecret() {
  const explicit = String(process.env.X_SESSION_SECRET || '').trim();
  if (explicit) return explicit;
  const clientSecret = String(process.env.X_CLIENT_SECRET || '').trim();
  if (!clientSecret) return '';
  return crypto.createHash('sha256').update('dz|x-session|' + clientSecret).digest('hex');
}

function xConfigured() {
  return !!(
    String(process.env.X_CLIENT_ID || '').trim() &&
    String(process.env.X_CLIENT_SECRET || '').trim()
  );
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomToken(bytes) {
  return b64url(crypto.randomBytes(bytes));
}

function sign(payload, secret) {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  return body + '.' + sig;
}

function verify(token, secret) {
  if (!token || !secret || typeof token !== 'string') return null;
  const i = token.lastIndexOf('.');
  if (i < 1) return null;
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expect = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  try {
    const json = Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function parseCookies(req) {
  const raw = (req.headers && (req.headers.cookie || req.headers.Cookie)) || '';
  const out = {};
  String(raw)
    .split(';')
    .forEach(function (part) {
      const i = part.indexOf('=');
      if (i < 1) return;
      const k = part.slice(0, i).trim();
      let v = part.slice(i + 1).trim();
      try {
        v = decodeURIComponent(v);
      } catch (e) {}
      if (k) out[k] = v;
    });
  return out;
}

function isHttpsReq(req) {
  const h = req.headers || {};
  const proto = String(h['x-forwarded-proto'] || h['X-Forwarded-Proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (proto === 'https') return true;
  const host = String(h.host || h.Host || '');
  return host.indexOf('localhost') < 0 && host.indexOf('127.0.0.1') < 0 && proto !== 'http';
}

function cookieHeader(name, value, opts) {
  opts = opts || {};
  const parts = [name + '=' + encodeURIComponent(value)];
  parts.push('Path=' + (opts.path || '/'));
  parts.push('HttpOnly');
  parts.push('SameSite=Lax');
  if (opts.maxAge != null) parts.push('Max-Age=' + String(opts.maxAge));
  if (opts.secure) parts.push('Secure');
  return parts.join('; ');
}

function clearCookieHeader(name, secure) {
  return cookieHeader(name, '', { maxAge: 0, secure: !!secure });
}

function publicOrigin(req) {
  const forced = String(process.env.X_REDIRECT_ORIGIN || '').trim().replace(/\/+$/, '');
  if (forced) return forced;
  const h = req.headers || {};
  const proto = String(h['x-forwarded-proto'] || h['X-Forwarded-Proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const host = String(h['x-forwarded-host'] || h['X-Forwarded-Host'] || h.host || h.Host || '127.0.0.1:8890')
    .split(',')[0]
    .trim();
  const useHttps = proto === 'https' || (proto !== 'http' && host.indexOf('localhost') < 0 && host.indexOf('127.0.0.1') < 0);
  return (useHttps ? 'https://' : 'http://') + host;
}

function redirectUri(req) {
  const forced = String(process.env.X_REDIRECT_URI || '').trim();
  if (forced) return forced;
  return publicOrigin(req) + '/api/auth/x';
}

function sanitizeNext(raw) {
  let n = String(raw || '').trim();
  if (!n) return '/classic/pages/arcade/scores.html';
  if (n.length > 300) n = n.slice(0, 300);
  if (n.charAt(0) !== '/') return '/classic/pages/arcade/scores.html';
  if (n.indexOf('//') === 0 || n.indexOf('\\') >= 0) return '/classic/pages/arcade/scores.html';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(n)) return '/classic/pages/arcade/scores.html';
  return n;
}

function normalizeUsername(raw) {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/[^A-Za-z0-9_]/g, '')
    .slice(0, 15);
}

function readSession(req) {
  const secret = sessionSecret();
  if (!secret) return null;
  const cookies = parseCookies(req);
  const payload = verify(cookies[SESSION_COOKIE], secret);
  if (!payload || !payload.id || !payload.username) return null;
  if (payload.exp && Date.now() > Number(payload.exp)) return null;
  const username = normalizeUsername(payload.username);
  if (!username) return null;
  return {
    id: String(payload.id),
    username: username
  };
}

function sessionCookieValue(user) {
  const secret = sessionSecret();
  const now = Date.now();
  return sign(
    {
      id: String(user.id),
      username: normalizeUsername(user.username),
      iat: now,
      exp: now + SESSION_DAYS * 24 * 60 * 60 * 1000
    },
    secret
  );
}

function oauthCookieValue(data) {
  return sign(data, sessionSecret());
}

function readOauth(req) {
  const secret = sessionSecret();
  if (!secret) return null;
  const cookies = parseCookies(req);
  const payload = verify(cookies[OAUTH_COOKIE], secret);
  if (!payload || !payload.state || !payload.verifier) return null;
  if (payload.exp && Date.now() > Number(payload.exp)) return null;
  return payload;
}

function appendCookie(res, header) {
  if (!res || typeof res.setHeader !== 'function') return;
  const prev = res._dzCookies;
  if (Array.isArray(prev)) {
    prev.push(header);
    res.setHeader('Set-Cookie', prev);
    return;
  }
  res._dzCookies = [header];
  res.setHeader('Set-Cookie', res._dzCookies);
}

function setSessionCookie(req, res, user) {
  appendCookie(
    res,
    cookieHeader(SESSION_COOKIE, sessionCookieValue(user), {
      maxAge: SESSION_DAYS * 24 * 60 * 60,
      secure: isHttpsReq(req)
    })
  );
}

function setOauthCookie(req, res, data) {
  appendCookie(
    res,
    cookieHeader(OAUTH_COOKIE, oauthCookieValue(data), {
      maxAge: OAUTH_MINUTES * 60,
      secure: isHttpsReq(req)
    })
  );
}

function clearOauthCookie(req, res) {
  appendCookie(res, clearCookieHeader(OAUTH_COOKIE, isHttpsReq(req)));
}

function clearSessionCookie(req, res) {
  appendCookie(res, clearCookieHeader(SESSION_COOKIE, isHttpsReq(req)));
}

function publicUser(user) {
  if (!user) return null;
  return { id: String(user.id), username: normalizeUsername(user.username) };
}

module.exports = {
  SESSION_COOKIE,
  OAUTH_COOKIE,
  sessionSecret,
  xConfigured,
  randomToken,
  b64url,
  parseCookies,
  publicOrigin,
  redirectUri,
  sanitizeNext,
  normalizeUsername,
  readSession,
  readOauth,
  setSessionCookie,
  setOauthCookie,
  clearOauthCookie,
  clearSessionCookie,
  publicUser
};
