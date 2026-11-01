/**
 * GeoffWatch — non-intrusive public-page observer for geoff.ai
 * GET  /api/geoff-watch        stats (scans if stale)
 * POST /api/geoff-watch        force a scan
 */

const { rateLimitOrReject } = require('./lib/rate-limit')
const { DEFAULT_TARGETS, USER_AGENT, probeAll } = require('./lib/geoff-watch-probe')
const { computeStats } = require('./lib/geoff-watch-stats')
const { loadState, saveState } = require('./lib/geoff-watch-store')

const INTERVAL_MS = 120000
const TIMEOUT_MS = 8000

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Cache-Control', 'no-store')
}

function publicSurface(state) {
  const rows = ((state && state.lastCycle && state.lastCycle.rows) || []).slice()
  const byId = {}
  rows.forEach((r) => {
    if (r && r.id) byId[r.id] = r
  })
  const robotsRow = byId.robots || null
  const sitemapRow = byId.sitemap || null
  const pages = rows
    .filter((r) => r && r.id && r.id !== 'robots' && r.id !== 'sitemap')
    .map((r) => ({
      id: r.id,
      url: r.url,
      ok: r.ok,
      status: r.status,
      ms: r.ms,
      bytes: r.bytes,
      title: r.title,
      description: r.description || null,
      ogTitle: r.ogTitle || null,
      hash: r.hash,
      ts: r.ts
    }))
  return {
    fetchedAt: (state && state.lastCycle && state.lastCycle.at) || null,
    robots: (robotsRow && robotsRow.robotsRules) || {
      allow: ['/'],
      disallow: ['/api/', '/connect', '/settings']
    },
    sitemap: (sitemapRow && sitemapRow.sitemapUrls) || [],
    pages
  }
}

function meta(state, cycling) {
  const lastCycle = state && state.lastCycle
  return {
    site: 'geoff.ai',
    mode: 'external-observer',
    intrusive: false,
    cookies: false,
    visitorTracking: false,
    scriptInjection: false,
    userAgent: USER_AGENT,
    robots: {
      source: 'https://www.geoff.ai/robots.txt',
      allow: '/',
      disallow: ['/api/', '/connect', '/settings']
    },
    intervalMs: INTERVAL_MS,
    timeoutMs: TIMEOUT_MS,
    targets: DEFAULT_TARGETS,
    lastCycle: lastCycle || null,
    cycling: !!cycling,
    nextScanAt: lastCycle && lastCycle.at
      ? new Date(Date.parse(lastCycle.at) + INTERVAL_MS).toISOString()
      : null
  }
}

async function runScan(reason) {
  const state = await loadState()
  const last = state.lastCycle
  if (last && last.cycling) {
    const started = Date.parse(last.at)
    if (Number.isFinite(started) && Date.now() - started < 25000) {
      return state
    }
  }
  try {
    await saveState({
      rows: state.rows || [],
      lastCycle: {
        reason: reason || 'scan',
        at: new Date().toISOString(),
        cycling: true,
        rows: (last && last.rows) || []
      }
    })
  } catch (e) {}
  const rows = await probeAll(DEFAULT_TARGETS, TIMEOUT_MS)
  const next = {
    rows: (state.rows || []).concat(rows),
    lastCycle: { reason: reason || 'scan', at: new Date().toISOString(), rows }
  }
  await saveState(next)
  return next
}

async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
    return res.status(405).json({ error: 'GET or POST' })
  }
  if (rateLimitOrReject(req, res, { prefix: 'geoff-watch', perMinute: 20, perDay: 400 })) {
    return
  }

  const hours = Math.min(168, Math.max(1, Number((req.query && req.query.hours) || 24)))
  let state = await loadState()
  let scanned = false

  const wantScan = req.method === 'POST' || (req.query && String(req.query.scan) === '1')
  const empty = !(state.rows && state.rows.length)
  if (wantScan || empty) {
    try {
      const reason = req.method === 'POST' ? 'manual' : wantScan ? 'query' : 'empty'
      state = await runScan(reason)
      scanned = true
    } catch (e) {
      return res.status(200).json({
        ok: false,
        error: String(e && e.message ? e.message : e),
        ...computeStats(state.rows || [], hours),
        public: publicSurface(state),
        meta: meta(state, false)
      })
    }
  }

  return res.status(200).json({
    ok: true,
    scanned,
    ...computeStats(state.rows || [], hours),
    public: publicSurface(state),
    meta: meta(state, false)
  })
}

handler.runScan = runScan
module.exports = handler

module.exports.runScan = runScan
module.exports.computeStats = computeStats
module.exports.meta = meta
