/**
 * DOSWAPZ deploy tracker — pond0x.com / geoff.ai / trix.market / tbb.plank.love
 * GET  /api/deploy-watch?site=pond|geoff|trix|tbb
 * POST /api/deploy-watch?site=...   force scan
 */

const { rateLimitOrReject } = require('./lib/rate-limit')
const { SITES, INTERVAL_MS, probeSite, isDeploy } = require('./lib/deploy-watch-probe')
const { loadState, saveState } = require('./lib/deploy-watch-store')

const TIMEOUT_MS = 8000
const SITE_IDS = Object.keys(SITES)

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Cache-Control', 'no-store')
}

function emptySite(id) {
  const meta = SITES[id]
  return {
    id: id,
    label: meta ? meta.label : id,
    host: meta ? meta.host : id,
    trackPath: meta ? meta.trackPath : '/',
    lastScanAt: null,
    lastManualAt: null,
    current: null,
    previous: null,
    deploys: [],
    posts: []
  }
}

function publicSite(site) {
  const lastScanAt = site.lastScanAt || null
  const nextScanAt = lastScanAt
    ? new Date(Date.parse(lastScanAt) + INTERVAL_MS).toISOString()
    : new Date().toISOString()
  return {
    id: site.id,
    label: site.label,
    host: site.host,
    trackPath: site.trackPath,
    lastScanAt: lastScanAt,
    lastManualAt: site.lastManualAt || null,
    nextScanAt: nextScanAt,
    remainMs: Math.max(0, Date.parse(nextScanAt) - Date.now()),
    intervalMs: INTERVAL_MS,
    current: site.current || null,
    lastDeploy: (site.deploys && site.deploys[0]) || null,
    deploys: site.deploys || [],
    posts: site.posts || []
  }
}

function draftText(site, sample) {
  const fp = sample && sample.fingerprint ? sample.fingerprint : 'unknown'
  const host = (site.host || site.id).toUpperCase()
  const path = site.trackPath || '/'
  return (
    host +
    ' DEPLOY\nDOSWAPZ TRACKER HIT A NEW BUILD.\n\nFINGERPRINT: ' +
    fp +
    '\n\nTRACKED LIVE:\nHTTPS://DOSWAPZ.COM' +
    path.toUpperCase()
  )
}

async function queueX(site, sample) {
  try {
    const xgate = require('./lib/x-gate-store')
    const text = draftText(site, sample)
    const post = await xgate.queueDraft(text, 'deploy-' + site.id)
    return post && post.id ? post.id : null
  } catch (e) {
    return null
  }
}

async function runSite(siteId, reason) {
  const state = await loadState()
  const sites = state.sites || {}
  const prev = sites[siteId] || emptySite(siteId)
  const probed = await probeSite(siteId, TIMEOUT_MS)
  const now = new Date().toISOString()
  const scheduled = reason === 'schedule' || reason === 'stale' || reason === 'empty'
  const deployHit = isDeploy(prev.current, probed)
  const deploys = Array.isArray(prev.deploys) ? prev.deploys.slice() : []
  const posts = Array.isArray(prev.posts) ? prev.posts.slice() : []
  let xDraftId = null
  if (deployHit) {
    const entry = {
      at: now,
      fingerprint: probed.fingerprint,
      fromFingerprint: prev.current && prev.current.fingerprint,
      title: probed.rows && probed.rows[0] && probed.rows[0].title,
      buildId: probed.rows && probed.rows[0] && probed.rows[0].buildId,
      reason: 'BUILD FINGERPRINT CHANGED'
    }
    deploys.unshift(entry)
    const post = {
      at: now,
      headline: (probed.label || siteId) + ' DEPLOY',
      body: draftText(Object.assign({}, prev, probed), probed),
      fingerprint: probed.fingerprint
    }
    posts.unshift(post)
    xDraftId = await queueX(Object.assign({}, prev, { host: probed.host, trackPath: probed.trackPath, id: siteId }), probed)
    if (xDraftId) post.xDraftId = xDraftId
  }
  const next = {
    id: siteId,
    label: probed.label,
    host: probed.host,
    trackPath: probed.trackPath,
    lastScanAt: scheduled ? now : prev.lastScanAt || now,
    lastManualAt: scheduled ? prev.lastManualAt || null : now,
    previous: prev.current || null,
    current: probed,
    deploys: deploys.slice(0, 40),
    posts: posts.slice(0, 40)
  }
  sites[siteId] = next
  try {
    await saveState({ sites: sites })
  } catch (e) {
    next.storeError = String(e && e.message ? e.message : e)
  }
  next.deployHit = deployHit
  next.xDraftId = xDraftId
  return next
}

async function runAll(reason) {
  const out = {}
  for (let i = 0; i < SITE_IDS.length; i++) {
    try {
      out[SITE_IDS[i]] = await runSite(SITE_IDS[i], reason)
    } catch (e) {
      out[SITE_IDS[i]] = { error: String(e && e.message ? e.message : e) }
    }
  }
  return out
}

async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (rateLimitOrReject(req, res, { prefix: 'deploy-watch', perMinute: 20, perDay: 400 })) return

  const q = req.query || {}
  const siteId = String(q.site || (req.body && req.body.site) || '').toLowerCase()
  if (siteId && SITE_IDS.indexOf(siteId) < 0) {
    return res.status(400).json({ ok: false, error: 'site must be ' + SITE_IDS.join(', ') })
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (!siteId) {
      const state = await loadState()
      const all = {}
      SITE_IDS.forEach(function (id) {
        all[id] = publicSite(state.sites && state.sites[id] ? state.sites[id] : emptySite(id))
      })
      return res.status(200).json({ ok: true, intervalMs: INTERVAL_MS, sites: all })
    }
    const state = await loadState()
    let rec = state.sites && state.sites[siteId]
    const stale =
      !rec ||
      !rec.lastScanAt ||
      Date.now() - Date.parse(rec.lastScanAt) >= INTERVAL_MS
    if (stale) {
      rec = await runSite(siteId, rec && rec.lastScanAt ? 'stale' : 'empty')
    }
    return res.status(200).json({ ok: true, site: publicSite(rec) })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' })
  const body = req.body || {}
  if (body.scheduled) {
    const all = await runAll('schedule')
    return res.status(200).json({ ok: true, scheduled: true, sites: all })
  }
  if (!siteId) return res.status(400).json({ error: 'Need site=' + SITE_IDS.join('|') })
  const rec = await runSite(siteId, 'manual')
  return res.status(200).json({ ok: true, site: publicSite(rec), deployHit: !!rec.deployHit })
}

handler.runAll = runAll
handler.runSite = runSite
module.exports = handler
