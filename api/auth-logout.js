/**
 * GET/POST /api/auth/logout
 */
const { sanitizeNext, clearSessionCookie, clearOauthCookie } = require('./lib/x-session');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'GET or POST' });
    return;
  }
  clearSessionCookie(req, res);
  clearOauthCookie(req, res);

  const q = req.query || {};
  if (req.method === 'GET' && (q.next || q.redirect)) {
    const dest = sanitizeNext(q.next || q.redirect);
    if (typeof res.redirect === 'function') {
      res.status(302).redirect(dest);
      return;
    }
    res.setHeader('Location', dest);
    res.status(302).end('');
    return;
  }

  res.status(200).json({ ok: true, user: null });
};
