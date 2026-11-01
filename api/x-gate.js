/**
 * GET  /api/x-gate  — pending Grok drafts
 * POST /api/x-gate  { action: 'approve'|'reject', id }
 * Nothing is posted to X from this API. YES only records consent
 * and the browser opens X's own composer for the logged-in user.
 */
const { rateLimitOrReject } = require('./lib/rate-limit');
const { readSession, publicUser } = require('./lib/x-session');
const store = require('./lib/x-gate-store');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

function publicPost(p) {
  return {
    id: p.id,
    text: p.text,
    status: p.status || 'pending',
    createdAt: p.createdAt || null,
    decidedAt: p.decidedAt || null
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.__netlifyEvent) store.connectNetlifyBlobs(req.__netlifyEvent);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    if (rateLimitOrReject(req, res, { prefix: 'x-gate-get', perMinute: 40, perDay: 800 })) return;
    const user = readSession(req);
    const state = await store.loadState();
    const posts = (state.posts || []).map(function (p) {
      return { id: p.id, text: p.text, createdAt: p.createdAt || null };
    });
    return res.status(200).json({
      ok: true,
      perUser: true,
      allowed: true,
      xLoginOptional: true,
      user: publicUser(user),
      posts: posts,
      pending: posts
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
  if (rateLimitOrReject(req, res, { prefix: 'x-gate-post', perMinute: 20, perDay: 200 })) return;

  const user = readSession(req);

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const action = String(body.action || '').toLowerCase();
  const id = String(body.id || '').trim();

  if (action === 'auto') {
    return res.status(200).json({ ok: true, perUser: true, cadence: store.normalizeCadence(body.cadence) });
  }

  if ((action !== 'approve' && action !== 'reject') || !id) {
    return res.status(400).json({ ok: false, error: 'Need action approve|reject|auto' });
  }

  const state = await store.loadState();
  const post = (state.posts || []).find((p) => p.id === id);
  if (!post) return res.status(404).json({ ok: false, error: 'Draft not found' });

  const encoded = encodeURIComponent(post.text);
  return res.status(200).json({
    ok: true,
    perUser: true,
    post: { id: post.id, text: post.text },
    text: post.text,
    intent:
      action === 'approve' ? 'https://x.com/intent/post?text=' + encoded : null,
    intentAlt:
      action === 'approve' ? 'https://twitter.com/intent/tweet?text=' + encoded : null
  });
};
