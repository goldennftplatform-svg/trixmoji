/**
 * GET /api/auth/me
 * Current X session (id + username only) or { user: null }.
 */
const { xConfigured, readSession, publicUser } = require('./lib/x-session');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  const user = readSession(req);
  res.status(200).json({
    ok: true,
    configured: xConfigured(),
    user: publicUser(user),
    extract: {
      tweets: false,
      follows: false,
      dms: false,
      likes: false,
      tokenKept: false
    }
  });
};
