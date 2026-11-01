/**
 * DOSWAPZ — The Attic drop board API (LAUNCH PREP).
 *
 * GET  /api/attic-drops
 *   Public board JSON. Safe anytime. Does not poll retailers.
 *
 * GET  /api/attic-drops?meta=1
 *   Adds prep flags + event tail (no secrets).
 *
 * POST /api/attic-drops  (admin only — requires ATTIC_DROPS_ADMIN_SECRET)
 *   body: { action: 'reload-bundled' | 'set-watchlist' | 'publish-board', ... }
 *   Does NOT enable live retailer polling by itself.
 *
 * LIVE POLLING stays OFF until:
 *   ATTIC_DROPS_LIVE=1
 *   + /api/attic-drops-check with admin secret
 */

const {
  isLiveEnabled,
  adminSecretOk,
  loadBoard,
  saveBoard,
  loadWatchlist,
  saveWatchlist,
  readBundledBoard,
  readBundledWatchlist,
  boardFromWatchlist,
  publicBoardPayload,
  recentEvents
} = require('./lib/attic-drops-store');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return null;
    }
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-attic-admin, x-attic-drops-secret');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (req.method === 'GET') {
      const board = await loadBoard();
      const payload = publicBoardPayload(board);
      const url = req.url || '';
      const wantMeta = url.indexOf('meta=1') >= 0 || url.indexOf('meta=true') >= 0;
      if (wantMeta) {
        payload.flags = {
          ATTIC_DROPS_LIVE: isLiveEnabled(),
          hasAdminSecret: !!String(process.env.ATTIC_DROPS_ADMIN_SECRET || '').trim(),
          hasKv: !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
        };
        payload.recentEvents = await recentEvents(10);
        payload.launch = {
          status: isLiveEnabled() ? 'ARMED' : 'PREP_ONLY',
          next: isLiveEnabled()
            ? 'Call /api/attic-drops-check with admin secret on a schedule'
            : 'Keep static board; set env when ready to arm checkers'
        };
      }
      return send(res, 200, payload);
    }

    if (req.method === 'POST') {
      if (!adminSecretOk(req)) {
        return send(res, 401, {
          error: 'Unauthorized',
          hint: 'Set ATTIC_DROPS_ADMIN_SECRET and send header x-attic-admin'
        });
      }

      const body = parseBody(req) || {};
      const action = String(body.action || '');

      if (action === 'reload-bundled') {
        const board = readBundledBoard();
        board.source = 'bundled-json';
        board.liveTracking = false;
        const saved = await saveBoard(board);
        return send(res, 200, {
          ok: true,
          action,
          savedToKv: saved,
          productCount: (board.products || []).length,
          live: isLiveEnabled()
        });
      }

      if (action === 'reload-watchlist-bundled') {
        const watch = readBundledWatchlist();
        watch.live = false;
        const saved = await saveWatchlist(watch);
        const board = boardFromWatchlist(watch);
        board.liveTracking = false;
        await saveBoard(board);
        return send(res, 200, {
          ok: true,
          action,
          savedToKv: saved,
          productCount: (board.products || []).length
        });
      }

      if (action === 'publish-from-watchlist') {
        const watch = await loadWatchlist();
        const board = boardFromWatchlist(watch);
        board.liveTracking = isLiveEnabled() && !!watch.live;
        board.source = 'watchlist';
        const saved = await saveBoard(board);
        return send(res, 200, {
          ok: true,
          action,
          savedToKv: saved,
          board: publicBoardPayload(board)
        });
      }

      if (action === 'set-watchlist') {
        if (!body.watchlist || typeof body.watchlist !== 'object') {
          return send(res, 400, { error: 'watchlist object required' });
        }
        // Force prep safety: POST cannot flip live tracking alone
        const watch = Object.assign({}, body.watchlist, { live: false });
        const saved = await saveWatchlist(watch);
        return send(res, 200, {
          ok: true,
          action,
          savedToKv: saved,
          forcedLiveFalse: true,
          note: 'Watchlist stored with live=false. Arm ATTIC_DROPS_LIVE=1 separately at launch.'
        });
      }

      return send(res, 400, {
        error: 'Unknown action',
        allowed: [
          'reload-bundled',
          'reload-watchlist-bundled',
          'publish-from-watchlist',
          'set-watchlist'
        ]
      });
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    return send(res, 500, {
      error: 'attic-drops failed',
      message: e && e.message ? e.message : String(e)
    });
  }
};
