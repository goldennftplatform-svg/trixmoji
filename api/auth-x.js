/**
 * GET /api/auth/x
 *   no code  → start Sign in with X (PKCE)
 *   ?code=   → callback, identity only, then redirect
 *
 * Query: next=/classic/pages/arcade/scores.html
 */
const { rateLimitOrReject } = require('./lib/rate-limit');
const {
  xConfigured,
  randomToken,
  sanitizeNext,
  redirectUri,
  readOauth,
  setOauthCookie,
  clearOauthCookie,
  setSessionCookie
} = require('./lib/x-session');
const { pkcePair, authorizeUrl, identityFromCode } = require('./lib/x-oauth');

function bounce(res, next, qs) {
  const dest = sanitizeNext(next) + (qs ? (sanitizeNext(next).indexOf('?') >= 0 ? '&' : '?') + qs : '');
  if (typeof res.redirect === 'function') {
    res.status(302).redirect(dest);
    return;
  }
  res.setHeader('Location', dest);
  res.status(302).end('');
}

function htmlPage(res, title, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(
    '<!doctype html><meta charset="utf-8"><title>' +
      title +
      '</title><body style="margin:0;background:#000;color:#33ff66;font-family:VT323,Consolas,monospace">' +
      '<div style="max-width:640px;margin:48px auto;padding:24px;border:1px solid #0a3018;line-height:1.5">' +
      body +
      '</div></body>'
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }

  const q = req.query || {};

  if (!xConfigured()) {
    htmlPage(
      res,
      'X LOGIN NOT CONFIGURED',
      '<h1 style="letter-spacing:3px">X LOGIN NOT SET</h1>' +
        '<p>Add an X developer app, then run <code>SET-X-LOGIN.bat</code> in the DOSWAPZ folder.</p>' +
        '<p>Callback to register on developer.x.com:</p>' +
        '<p><code>http://127.0.0.1:8890/api/auth/x</code><br>' +
        '<code>https://doswapz.com/api/auth/x</code></p>' +
        '<p>Scopes: <code>users.read</code> + <code>tweet.read</code> (identity only — we never read posts).</p>' +
        '<p><a style="color:#ffd700" href="/classic/pages/arcade/x-connect.html">Back</a></p>'
    );
    return;
  }

  if (q.error) {
    bounce(res, q.next, 'xauth=denied');
    return;
  }

  if (q.code) {
    if (rateLimitOrReject(req, res, { prefix: 'x-cb', perMinute: 20, perDay: 200 })) return;
    const pending = readOauth(req);
    clearOauthCookie(req, res);
    if (!pending || !pending.state || String(q.state || '') !== String(pending.state)) {
      bounce(res, pending && pending.next, 'xauth=bad_state');
      return;
    }
    try {
      const user = await identityFromCode({
        code: q.code,
        verifier: pending.verifier,
        redirectUri: pending.redirectUri || redirectUri(req)
      });
      setSessionCookie(req, res, user);
      bounce(res, pending.next, 'xauth=ok');
    } catch (err) {
      bounce(res, pending.next, 'xauth=fail');
    }
    return;
  }

  if (rateLimitOrReject(req, res, { prefix: 'x-start', perMinute: 12, perDay: 80 })) return;

  const pkce = pkcePair();
  const state = randomToken(16);
  const next = sanitizeNext(q.next);
  const redir = redirectUri(req);
  setOauthCookie(req, res, {
    state: state,
    verifier: pkce.verifier,
    redirectUri: redir,
    next: next,
    exp: Date.now() + 10 * 60 * 1000
  });

  const url = authorizeUrl({
    redirectUri: redir,
    state: state,
    challenge: pkce.challenge
  });

  if (typeof res.redirect === 'function') {
    res.status(302).redirect(url);
    return;
  }
  res.setHeader('Location', url);
  res.status(302).end('');
};
