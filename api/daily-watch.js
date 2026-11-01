/**
 * DOSWAPZ hourly digest — geoff / pond / trix / tbb public surfaces + Hwonder GitHub.
 * GET  /api/daily-watch?desk=geoff|pond|trix|tbb   (scans if the hour is stale)
 * POST /api/daily-watch?desk=...               manual check (does not reset 24h clock)
 */

const { rateLimitOrReject } = require('./lib/rate-limit')
const { DESKS, INTERVAL_MS, probeDesk, diffRows, isNotice } = require('./lib/daily-watch-probe')
const { loadState, saveState } = require('./lib/daily-watch-store')

const TIMEOUT_MS = 8000
const DESK_IDS = Object.keys(DESKS)

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Cache-Control', 'no-store')
}

function emptyDesk(id) {
  const meta = DESKS[id]
  return {
    id,
    label: meta ? meta.label : id,
    subtitle: meta ? meta.subtitle : '',
    lastDailyAt: null,
    lastManualAt: null,
    current: null,
    previous: null,
    changes: []
  }
}

function noticesFrom(desk) {
  const changes = Array.isArray(desk.changes) ? desk.changes : []
  return changes.filter(isNotice).slice(0, 20)
}

function hwonderFrom(desk) {
  const rows = (desk.current && desk.current.rows) || []
  const index = rows.find((r) => r && r.id === 'hwonder-index')
  const events = rows.find((r) => r && r.id === 'gh-hwonder-events')
  const user = rows.find((r) => r && r.id === 'gh-hwonder')
  return {
    posts: index && index.hwonder && Array.isArray(index.hwonder.posts) ? index.hwonder.posts : [],
    postCount: index && index.hwonder ? index.hwonder.count : null,
    newestEvent: events && events.github && events.github.newest ? events.github.newest : null,
    newestRepo: user && user.github && user.github.newest ? user.github.newest : null
  }
}

function publicDesk(desk) {
  const lastDailyAt = desk.lastDailyAt || null
  const nextDailyAt = lastDailyAt
    ? new Date(Date.parse(lastDailyAt) + INTERVAL_MS).toISOString()
    : new Date().toISOString()
  const remain = Math.max(0, Date.parse(nextDailyAt) - Date.now())
  return {
    id: desk.id,
    label: desk.label,
    subtitle: desk.subtitle,
    lastDailyAt,
    lastManualAt: desk.lastManualAt || null,
    nextDailyAt,
    remainMs: remain,
    intervalMs: INTERVAL_MS,
    current: desk.current || null,
    changes: desk.changes || [],
    notices: noticesFrom(desk),
    hwonder: hwonderFrom(desk),
    xDrafts: desk.xDrafts || []
  }
}

function noticeDraft(deskId, changes) {
  const hits = (changes || []).filter(isNotice).slice(0, 4)
  if (!hits.length) return null
  const lines = hits.map((c) => {
    return String(c.id || 'move').toUpperCase() + ' * ' + (c.bits || []).join(' * ')
  })
  const track =
    deskId === 'pond'
      ? 'HTTPS://DOSWAPZ.COM/CLASSIC/PAGES/POND-SCUM.HTML'
      : 'HTTPS://DOSWAPZ.COM/CLASSIC/PAGES/GEOFFWATCH.HTML'
  return (
    'HWONDER MOVE * ' +
    String(deskId || 'desk').toUpperCase() +
    '\n' +
    lines.join('\n') +
    '\n\nTRACKED LIVE:\n' +
    track
  ).slice(0, 270)
}

async function queueNotices(deskId, changes) {
  const text = noticeDraft(deskId, changes)
  if (!text) return []
  try {
    const xgate = require('./lib/x-gate-store')
    const post = await xgate.queueDraft(text, 'hwonder-' + deskId)
    return post && post.id ? [{ id: post.id, at: post.createdAt, text: post.text }] : []
  } catch (e) {
    return []
  }
}

async function runDesk(deskId, reason) {
  const state = await loadState()
  const desks = state.desks || {}
  const prev = desks[deskId] || emptyDesk(deskId)
  const probed = await probeDesk(deskId, TIMEOUT_MS)
  const changes = diffRows(prev.current && prev.current.rows, probed.rows)
  const now = new Date().toISOString()
  const scheduled = reason === 'schedule' || reason === 'stale' || reason === 'empty'
  const freshNotices = changes.filter(isNotice)
  let xDrafts = Array.isArray(prev.xDrafts) ? prev.xDrafts.slice() : []
  if (freshNotices.length && (scheduled || reason === 'manual')) {
    const queued = await queueNotices(deskId, freshNotices)
    if (queued.length) xDrafts = queued.concat(xDrafts).slice(0, 20)
  }
  const next = {
    id: deskId,
    label: probed.label,
    subtitle: probed.subtitle,
    lastDailyAt: scheduled ? now : prev.lastDailyAt || now,
    lastManualAt: scheduled ? prev.lastManualAt || null : now,
    previous: prev.current || null,
    current: { at: now, reason: reason || 'scan', rows: probed.rows },
    changes: changes.concat(prev.changes || []).slice(0, 80),
    xDrafts
  }
  desks[deskId] = next
  try {
    await saveState({ desks })
  } catch (e) {
    next.storeError = String(e && e.message ? e.message : e)
  }
  return next
}

async function runAll(reason) {
  const out = {}
  for (const id of DESK_IDS) {
    try {
      out[id] = await runDesk(id, reason)
    } catch (e) {
      out[id] = Object.assign(emptyDesk(id), { error: String(e && e.message ? e.message : e) })
    }
  }
  return out
}

async function maybeScan(desk, deskId, force) {
  if (force) return runDesk(deskId, 'manual')
  if (!desk.current || !(desk.current.rows && desk.current.rows.length)) {
    return runDesk(deskId, 'empty')
  }
  const last = Date.parse(desk.lastDailyAt || 0)
  if (!Number.isFinite(last) || Date.now() - last >= INTERVAL_MS) {
    return runDesk(deskId, 'stale')
  }
  return desk
}

async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
    return res.status(405).json({ error: 'GET or POST' })
  }
  if (rateLimitOrReject(req, res, { prefix: 'daily-watch', perMinute: 12, perDay: 200 })) {
    return
  }

  const raw = String((req.query && req.query.desk) || '').toLowerCase()
  const deskId = DESK_IDS.indexOf(raw) >= 0 ? raw : null
  const wantAll = raw === 'all' || (!raw && req.method === 'GET' && req.query && String(req.query.all) === '1')
  const force = req.method === 'POST'

  try {
    if (wantAll) {
      const state = await loadState()
      const desks = {}
      for (const id of DESK_IDS) {
        const cur = state.desks && state.desks[id] ? state.desks[id] : emptyDesk(id)
        const next = await maybeScan(cur, id, force)
        desks[id] = publicDesk(next)
      }
      return res.status(200).json({ ok: true, intervalMs: INTERVAL_MS, desks })
    }

    const id = deskId || 'geoff'
    const state = await loadState()
    const cur = state.desks && state.desks[id] ? state.desks[id] : emptyDesk(id)
    const next = await maybeScan(cur, id, force)
    return res.status(200).json({
      ok: true,
      scanned: force || next !== cur,
      intervalMs: INTERVAL_MS,
      desk: publicDesk(next)
    })
  } catch (e) {
    return res.status(200).json({
      ok: false,
      error: String(e && e.message ? e.message : e)
    })
  }
}

handler.runDesk = runDesk
handler.runAll = runAll
handler.DESK_IDS = DESK_IDS
module.exports = handler
