/**
 * GET  /api/scores?game=dad     public board (username + score only)
 * POST /api/scores              { game, score, extra? } — requires X session
 */
const { rateLimitOrReject } = require('./lib/rate-limit');
const { readSession } = require('./lib/x-session');
const {
  GAMES,
  MAX_SCORE,
  connectNetlifyBlobs,
  loadStore,
  saveStore,
  normalizeGame,
  sanitizeExtra,
  listGame,
  upsertScore
} = require('./lib/x-scores-store');

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.__netlifyEvent) connectNetlifyBlobs(req.__netlifyEvent);
  } catch (e) {}

  if (req.method === 'GET') {
    if (rateLimitOrReject(req, res, { prefix: 'x-scores-get', perMinute: 60, perDay: 2000 })) return;
    const store = await loadStore();
    const game = normalizeGame((req.query && req.query.game) || '');
    if (game) {
      res.status(200).json({
        ok: true,
        game: game,
        label: GAMES[game].label,
        scores: listGame(store, game)
      });
      return;
    }
    const boards = {};
    Object.keys(GAMES).forEach(function (g) {
      boards[g] = listGame(store, g);
    });
    res.status(200).json({
      ok: true,
      games: Object.keys(GAMES),
      boards: boards,
      updatedAt: store.updatedAt || null
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'GET or POST' });
    return;
  }

  if (rateLimitOrReject(req, res, { prefix: 'x-scores-post', perMinute: 20, perDay: 120 })) return;

  const user = readSession(req);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Connect with X first', needLogin: true });
    return;
  }

  const body = parseBody(req);
  const game = normalizeGame(body.game);
  if (!game) {
    res.status(400).json({ ok: false, error: 'Unknown game', games: Object.keys(GAMES) });
    return;
  }

  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
    res.status(400).json({ ok: false, error: 'Invalid score' });
    return;
  }

  const extra = sanitizeExtra(body.extra);
  const store = await loadStore();
  const result = upsertScore(store, user, game, Math.floor(score), extra);
  const saved = await saveStore(store);
  if (!saved) {
    res.status(503).json({ ok: false, error: 'Could not persist score' });
    return;
  }

  try {
    const awardz = require('./lib/awardz-store');
    const az = await awardz.loadStore();
    const now = Date.now();
    const kinds = ['day', 'week', 'month'];
    let touched = false;
    kinds.forEach(function (kind) {
      const p = awardz.ensurePeriod(az, kind, now);
      if (!p || p.status !== 'open') return;
      const inPool = (p.entries || []).some(function (e) {
        return String(e.xid) === String(user.id);
      });
      if (!inPool) return;
      const prev = (p.scores && p.scores[user.id]) || null;
      const nextScore = Math.floor(score);
      if (prev && Number(prev.score) >= nextScore) return;
      if (!p.scores) p.scores = {};
      p.scores[String(user.id)] = {
        username: String(user.username),
        score: nextScore,
        game: game,
        ts: now
      };
      touched = true;
    });
    if (touched) await awardz.saveStore(az);
  } catch (e) {}

  res.status(200).json({
    ok: true,
    game: game,
    username: user.username,
    keptOld: result.keptOld,
    best: result.best,
    row: result.row,
    scores: listGame(store, game)
  });
};
