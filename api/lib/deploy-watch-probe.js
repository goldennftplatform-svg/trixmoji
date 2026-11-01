'use strict'

const crypto = require('crypto')
const { URL } = require('url')

const USER_AGENT =
  'DoswapzDeployWatch/1.0 (+https://doswapz.com; cookieless deploy fingerprint; no visitor tracking)'

const SITES = {
  pond: {
    id: 'pond',
    label: 'POND0X.COM',
    host: 'pond0x.com',
    trackPath: '/pond-scum/past',
    urls: ['https://www.pond0x.com/', 'https://www.pond0x.com/mining']
  },
  geoff: {
    id: 'geoff',
    label: 'GEOFF.AI',
    host: 'geoff.ai',
    trackPath: '/geoffwatch/past',
    urls: ['https://www.geoff.ai/', 'https://www.geoff.ai/explore', 'https://docs.geoff.ai/']
  },
  trix: {
    id: 'trix',
    label: 'TRIX.MARKET',
    host: 'trix.market',
    trackPath: '/geoffwatch-box/past',
    urls: ['https://www.trix.market/', 'https://www.trix.market/preorder']
  },
  tbb: {
    id: 'tbb',
    label: 'TBB.PLANK.LOVE',
    host: 'tbb.plank.love',
    trackPath: '/tbb/apple-picker/past',
    urls: ['https://tbb.plank.love/learn', 'https://tbb.plank.love/draw', 'https://tbb.plank.love/scoreboard']
  }
}

const ALLOWED = new Set(['pond0x.com', 'geoff.ai', 'docs.geoff.ai', 'trix.market', 'tbb.plank.love'])

function assertUrl(urlString) {
  const u = new URL(urlString)
  const host = u.hostname.replace(/^www\./, '')
  if (!ALLOWED.has(host) && !ALLOWED.has(u.hostname)) {
    throw new Error('host not allowed: ' + u.hostname)
  }
  if (host === 'geoff.ai') {
    const path = u.pathname || '/'
    if (path.indexOf('/api/') === 0 || path === '/connect' || path.indexOf('/connect/') === 0 || path.indexOf('/settings') === 0) {
      throw new Error('robots.txt disallows ' + path)
    }
  }
}

function sha16(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex').slice(0, 16)
}

function header(res, name) {
  try {
    if (res.headers && typeof res.headers.get === 'function') return res.headers.get(name)
  } catch (e) {}
  const h = res.headers || {}
  return h[name] || h[name.toLowerCase()] || null
}

function extractBuild(html) {
  const marks = []
  const buildId = html.match(/"buildId"\s*:\s*"([^"]+)"/)
  if (buildId) marks.push('next:' + buildId[1])
  const nextDir = html.match(/\/_next\/static\/([A-Za-z0-9_-]{8,})\//)
  if (nextDir) marks.push('nextdir:' + nextDir[1])
  const assets = []
  const re = /(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi
  let m
  while ((m = re.exec(html))) {
    const raw = String(m[1] || '').split('?')[0]
    if (!raw) continue
    if (/\/_next\/static\//.test(raw) || /\/assets\//.test(raw) || /[a-fA-F0-9]{8,}/.test(raw)) {
      assets.push(raw)
    }
  }
  const unique = Array.from(new Set(assets)).sort().slice(0, 48)
  return {
    buildId: (buildId && buildId[1]) || (nextDir && nextDir[1]) || null,
    assets: unique,
    marks: marks
  }
}

async function probeUrl(url, timeoutMs) {
  assertUrl(url)
  const ac = new AbortController()
  const timer = setTimeout(function () { ac.abort() }, timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ac.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent': USER_AGENT,
        'Cache-Control': 'no-cache'
      }
    })
    const buf = Buffer.from(await res.arrayBuffer())
    const html = buf.toString('utf8')
    const titleM = html.match(/<title[^>]*>([^<]{1,180})<\/title>/i)
    const build = extractBuild(html)
    const lastModified = header(res, 'last-modified')
    const fingerprint = sha16(
      JSON.stringify({
        buildId: build.buildId,
        marks: build.marks,
        assets: build.assets,
        lastModified: lastModified || null,
        title: titleM ? titleM[1].trim() : null
      })
    )
    return {
      url: url,
      ok: res.ok,
      status: res.status,
      bytes: buf.length,
      title: titleM ? titleM[1].replace(/\s+/g, ' ').trim() : null,
      lastModified: lastModified,
      buildId: build.buildId,
      assetCount: build.assets.length,
      fingerprint: fingerprint
    }
  } finally {
    clearTimeout(timer)
  }
}

async function probeSite(siteId, timeoutMs) {
  const site = SITES[siteId]
  if (!site) throw new Error('unknown site: ' + siteId)
  const rows = []
  for (let i = 0; i < site.urls.length; i++) {
    const started = Date.now()
    try {
      const row = await probeUrl(site.urls[i], timeoutMs)
      row.ms = Date.now() - started
      row.error = null
      rows.push(row)
    } catch (e) {
      rows.push({
        url: site.urls[i],
        ok: false,
        status: null,
        ms: Date.now() - started,
        bytes: null,
        title: null,
        lastModified: null,
        buildId: null,
        assetCount: 0,
        fingerprint: null,
        error: e.name === 'AbortError' ? 'timeout' : String(e.message || e)
      })
    }
  }
  const fp = sha16(rows.map((r) => r.fingerprint || r.error || '').join('|'))
  return {
    id: site.id,
    label: site.label,
    host: site.host,
    trackPath: site.trackPath,
    at: new Date().toISOString(),
    fingerprint: fp,
    rows: rows
  }
}

function isDeploy(prev, next) {
  if (!prev || !prev.fingerprint || !next || !next.fingerprint) return false
  return prev.fingerprint !== next.fingerprint
}

module.exports = {
  SITES,
  USER_AGENT,
  INTERVAL_MS: 15 * 60 * 1000,
  probeSite,
  isDeploy
}
