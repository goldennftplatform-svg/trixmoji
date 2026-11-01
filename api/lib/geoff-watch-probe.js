'use strict'

const crypto = require('crypto')
const { URL } = require('url')

const USER_AGENT =
  'GeoffWatch/0.1 (+https://doswapz.com/classic/pages/geoffwatch.html; cookieless availability monitor; does-not-track-visitors)'

const DISALLOWED_PATH_PREFIXES = ['/api/', '/connect', '/settings']
const ALLOWED_HOSTS = new Set(['www.geoff.ai', 'geoff.ai'])

const DEFAULT_TARGETS = [
  { id: 'home', url: 'https://www.geoff.ai/' },
  { id: 'explore', url: 'https://www.geoff.ai/explore' },
  { id: 'music', url: 'https://www.geoff.ai/music' },
  { id: 'image', url: 'https://www.geoff.ai/image' },
  { id: 'video', url: 'https://www.geoff.ai/video' },
  { id: 'pages', url: 'https://www.geoff.ai/pages' },
  { id: 'showcase', url: 'https://www.geoff.ai/code/showcase' },
  { id: 'install', url: 'https://www.geoff.ai/install' },
  { id: 'terms', url: 'https://www.geoff.ai/terms' },
  { id: 'privacy', url: 'https://www.geoff.ai/privacy' },
  { id: 'robots', url: 'https://www.geoff.ai/robots.txt' },
  { id: 'sitemap', url: 'https://www.geoff.ai/sitemap.xml' }
]

function assertAllowed(urlString) {
  const u = new URL(urlString)
  if (!ALLOWED_HOSTS.has(u.hostname)) {
    throw new Error('host not allowed: ' + u.hostname)
  }
  const path = u.pathname || '/'
  for (const prefix of DISALLOWED_PATH_PREFIXES) {
    if (
      path === prefix ||
      path.startsWith(prefix.endsWith('/') ? prefix : prefix + '/') ||
      path === prefix.replace(/\/$/, '')
    ) {
      throw new Error('robots.txt disallows ' + path)
    }
  }
  if (path.startsWith('/api')) throw new Error('robots.txt disallows /api')
}

function extractTitle(html) {
  const m = String(html).match(/<title[^>]*>([^<]{1,200})<\/title>/i)
  return m ? m[1].replace(/\s+/g, ' ').trim() : null
}

function attr(html, re) {
  const m = String(html).match(re)
  return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 240) : null
}

function extractHtmlPublic(html) {
  return {
    description:
      attr(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
      attr(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i),
    ogTitle:
      attr(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i) ||
      attr(html, /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i)
  }
}

function parseRobots(text) {
  const allow = []
  const disallow = []
  String(text)
    .split(/\r?\n/)
    .forEach((line) => {
      const t = line.trim()
      if (/^allow:/i.test(t)) allow.push(t.slice(6).trim())
      if (/^disallow:/i.test(t)) disallow.push(t.slice(9).trim())
    })
  return { allow, disallow }
}

function parseSitemap(xml) {
  const urls = []
  const re =
    /<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]*)<\/lastmod>)?(?:\s*<changefreq>([^<]*)<\/changefreq>)?(?:\s*<priority>([^<]*)<\/priority>)?/gi
  let m
  while ((m = re.exec(String(xml)))) {
    urls.push({
      loc: m[1].trim(),
      lastmod: m[2] || null,
      changefreq: m[3] || null,
      priority: m[4] || null
    })
  }
  return urls
}

async function probeOne(target, timeoutMs) {
  const started = Date.now()
  const row = {
    ts: new Date().toISOString(),
    id: target.id,
    url: target.url,
    ok: false,
    status: null,
    ms: null,
    bytes: null,
    hash: null,
    title: null,
    description: null,
    ogTitle: null,
    sitemapUrls: null,
    robotsRules: null,
    type: null,
    error: null
  }

  try {
    assertAllowed(target.url)
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), timeoutMs)
    const res = await fetch(target.url, {
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
    clearTimeout(timer)

    if (res.url) {
      try {
        assertAllowed(res.url)
      } catch (e) {
        row.error = 'redirected to disallowed url'
        row.status = res.status
        row.ms = Date.now() - started
        return row
      }
    }

    const type = ((res.headers.get('content-type') || '').split(';')[0] || '').trim()
    row.status = res.status
    row.ms = Date.now() - started
    row.bytes = buf.length
    row.hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16)
    row.type = type || null
    row.ok = res.ok
    const body = buf.toString('utf8')
    if (type.includes('html')) {
      row.title = extractTitle(body)
      const pub = extractHtmlPublic(body)
      row.description = pub.description
      row.ogTitle = pub.ogTitle
    } else if (target.id === 'robots') {
      row.robotsRules = parseRobots(body)
    } else if (target.id === 'sitemap') {
      row.sitemapUrls = parseSitemap(body)
    }
  } catch (e) {
    row.ms = Date.now() - started
    row.error = e.name === 'AbortError' ? 'timeout' : String(e.message || e)
  }
  return row
}

async function probeAll(targets, timeoutMs) {
  return Promise.all((targets || DEFAULT_TARGETS).map((t) => probeOne(t, timeoutMs)))
}

module.exports = {
  DEFAULT_TARGETS,
  USER_AGENT,
  probeOne,
  probeAll,
  assertAllowed
}
