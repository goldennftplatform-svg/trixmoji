/**
 * DOSWAPZ — Attic drop checker cron endpoint (LAUNCH PREP / DORMANT).
 *
 * POST /api/attic-drops-check
 * Headers: x-attic-admin: <ATTIC_DROPS_ADMIN_SECRET>
 *
 * Behavior:
 *  - If ATTIC_DROPS_LIVE !== '1' → dry-run only, no retailer HTTP, 200 { armed: false }
 *  - If armed → runs adapter stubs / future real adapters per watchlist
 *
 * DO NOT wire a public cron until secret + live flag are set.
 */

const {
  isLiveEnabled,
  adminSecretOk,
  loadWatchlist,
  saveWatchlist,
  boardFromWatchlist,
  saveBoard,
  pushEvent,
  STATUSES
} = require('./lib/attic-drops-store');

const adapters = require('./lib/attic-retailers');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-attic-admin, x-attic-drops-secret');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    return send(res, 405, { error: 'POST only' });
  }

  if (!adminSecretOk(req)) {
    return send(res, 401, { error: 'Unauthorized' });
  }

  const armed = isLiveEnabled();
  const watch = await loadWatchlist();
  const products = Array.isArray(watch.products) ? watch.products : [];

  // Always allowed: inventory of what WOULD be checked
  const plan = [];
  products.forEach((p) => {
    (p.retailers || []).forEach((r) => {
      plan.push({
        productId: p.id,
        title: p.title,
        store: r.store,
        sku: r.sku,
        url: r.url,
        status: r.status,
        adapter: r.store,
        wouldCheck: armed && r.sku && r.sku !== 'REPLACE_ME' && r.url
      });
    });
  });

  if (!armed) {
    return send(res, 200, {
      ok: true,
      armed: false,
      mode: 'PREP_DRY_RUN',
      message:
        'Checker is prepared but NOT live. Set ATTIC_DROPS_LIVE=1 only when ready to launch.',
      wouldCheckCount: plan.filter((x) => x.sku && x.sku !== 'REPLACE_ME').length,
      plan: plan.slice(0, 50),
      adapters: adapters.list()
    });
  }

  // ── ARMED path (still safe: adapters default to stub unless implemented) ──
  const now = new Date().toISOString();
  const changes = [];
  let checked = 0;
  let skipped = 0;

  for (const p of products) {
    if (!p.retailers || !p.retailers.length) continue;
    for (const r of p.retailers) {
      if (!r.store || !r.url || !r.sku || r.sku === 'REPLACE_ME') {
        skipped += 1;
        continue;
      }
      const adapter = adapters.get(r.store);
      if (!adapter || typeof adapter.check !== 'function') {
        skipped += 1;
        continue;
      }

      // Real network only if adapter reports implemented AND live
      const result = await adapter.check({
        url: r.url,
        sku: r.sku,
        live: true
      });
      checked += 1;

      const nextStatus = STATUSES.has(result.status) ? result.status : 'unknown';
      const prev = r.status;
      r.lastChecked = now;
      if (nextStatus !== 'unknown' && nextStatus !== prev) {
        r.status = nextStatus;
        r.lastChange = now;
        changes.push({
          productId: p.id,
          title: p.title,
          store: r.store,
          from: prev,
          to: nextStatus
        });
        await pushEvent({
          type: 'status_change',
          productId: p.id,
          title: p.title,
          store: r.store,
          from: prev,
          to: nextStatus
        });
      }
    }
  }

  watch.updated = now;
  // watch.live stays under operator control in JSON/KV; env arms the checker
  await saveWatchlist(watch);
  const board = boardFromWatchlist(watch);
  board.liveTracking = true;
  board.source = 'watchlist+check';
  await saveBoard(board);

  // Optional webhook on change (prep: only if URL set)
  const hook = String(process.env.ATTIC_DROPS_WEBHOOK_URL || '').trim();
  if (hook && changes.length) {
    try {
      await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'doswapz-attic',
          changes: changes
        })
      });
    } catch (e) {
      /* non-fatal */
    }
  }

  return send(res, 200, {
    ok: true,
    armed: true,
    checked: checked,
    skipped: skipped,
    changes: changes
  });
};
