'use strict'

const crypto = require('crypto')
const { URL } = require('url')

const USER_AGENT =
  'DoswapzDailyWatch/1.0 (+https://doswapz.com; cookieless public digest; does-not-track-visitors)'

const GEOFF_DISALLOW = ['/api/', '/connect', '/settings']

const DESKS = {
  geoff: {
    id: 'geoff',
    label: 'GEOFFWATCH',
    subtitle: 'geoff.ai * docs.geoff.ai * hwonder.com * hWonder GH',
    targets: [
      { id: 'geoff-home', kind: 'html', url: 'https://www.geoff.ai/' },
      { id: 'geoff-explore', kind: 'html', url: 'https://www.geoff.ai/explore' },
      { id: 'geoff-install', kind: 'html', url: 'https://www.geoff.ai/install' },
      { id: 'geoff-docs', kind: 'html', url: 'https://docs.geoff.ai/' },
      { id: 'geoff-sitemap', kind: 'xml', url: 'https://www.geoff.ai/sitemap.xml' },
      { id: 'gh-geoffai', kind: 'github-org', org: 'GeoffAi' },
      { id: 'gh-hwonder', kind: 'github-user', user: 'hWonderOfTheWorld' },
      { id: 'gh-hwonder-events', kind: 'github-events', user: 'hWonderOfTheWorld' },
      { id: 'gh-ultralitenode', kind: 'github-repo', repo: 'hWonderOfTheWorld/ultralitenode' },
      { id: 'gh-magma-boiler', kind: 'github-repo', repo: 'hWonderOfTheWorld/magma-boilerplate-monorepo' },
      { id: 'hwonder-index', kind: 'hwonder-index', url: 'https://www.hwonder.com/' },
      { id: 'hwonder-metamodels', kind: 'html', url: 'https://www.hwonder.com/posts/metamodels' }
    ]
  },
  pond: {
    id: 'pond',
    label: 'POND SCUM',
    subtitle: 'hwonder.com * hWonder GitHub * pond0x.com public',
    targets: [
      { id: 'gh-hwonder', kind: 'github-user', user: 'hWonderOfTheWorld' },
      { id: 'gh-hwonder-events', kind: 'github-events', user: 'hWonderOfTheWorld' },
      { id: 'gh-ultralitenode', kind: 'github-repo', repo: 'hWonderOfTheWorld/ultralitenode' },
      { id: 'gh-magma-boiler', kind: 'github-repo', repo: 'hWonderOfTheWorld/magma-boilerplate-monorepo' },
      { id: 'gh-octopii', kind: 'github-repo', repo: 'hWonderOfTheWorld/octopii' },
      { id: 'hwonder-index', kind: 'hwonder-index', url: 'https://www.hwonder.com/' },
      { id: 'hwonder-metamodels', kind: 'html', url: 'https://www.hwonder.com/posts/metamodels' },
      { id: 'hwonder-metavault', kind: 'html', url: 'https://www.hwonder.com/posts/metavault' },
      { id: 'hwonder-promptme', kind: 'html', url: 'https://www.hwonder.com/posts/promptme' },
      { id: 'pond0x', kind: 'html', url: 'https://www.pond0x.com/' }
    ]
  },
  trix: {
    id: 'trix',
    label: 'TRIX EGG',
    subtitle: 'trix.market public pages * genesis box * posts * launches',
    targets: [
      { id: 'trix-home', kind: 'html', url: 'https://www.trix.market/' },
      { id: 'trix-preorder', kind: 'html', url: 'https://www.trix.market/preorder' },
      { id: 'trix-genesis', kind: 'json', url: 'https://www.trix.market/api/mkt/g' },
      { id: 'trix-posts', kind: 'json', url: 'https://www.trix.market/api/posts?limit=1' },
      { id: 'trix-launches', kind: 'json', url: 'https://www.trix.market/api/launches?limit=1' },
      { id: 'trix-leaderboard', kind: 'json', url: 'https://www.trix.market/api/leaderboard' }
    ]
  },
  tbb: {
    id: 'tbb',
    label: 'APPLE PICKER',
    subtitle: 'tbb.plank.love public doors * learn * draw * scoreboard',
    targets: [
      { id: 'tbb-learn', kind: 'html', url: 'https://tbb.plank.love/learn' },
      { id: 'tbb-draw', kind: 'html', url: 'https://tbb.plank.love/draw' },
      { id: 'tbb-scoreboard', kind: 'html', url: 'https://tbb.plank.love/scoreboard' },
      { id: 'tbb-home', kind: 'html', url: 'https://tbb.plank.love/' }
    ]
  }
}

function assertUrl(urlString) {
  const u = new URL(urlString)
  const host = u.hostname.replace(/^www\./, '')
  const allowed = new Set([
    'geoff.ai',
    'docs.geoff.ai',
    'github.com',
    'api.github.com',
    'hwonder.com',
    'pond0x.com',
    'trix.market',
    'tbb.plank.love'
  ])
  if (!allowed.has(host) && !allowed.has(u.hostname)) {
    throw new Error('host not allowed: ' + u.hostname)
  }
  if (host === 'geoff.ai') {
    const path = u.pathname || '/'
    for (const prefix of GEOFF_DISALLOW) {
      if (path === prefix || path.startsWith(prefix) || path === prefix.replace(/\/$/, '')) {
        throw new Error('robots.txt disallows ' + path)
      }
    }
  }
}

function extractTitle(html) {
  const m = String(html).match(/<title[^>]*>([^<]{1,200})<\/title>/i)
  return m ? m[1].replace(/\s+/g, ' ').trim() : null
}

function fingerprintBody(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16)
}

async function fetchBuf(url, timeoutMs, accept) {
  assertUrl(url)
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ac.signal,
      headers: {
        Accept: accept || 'text/html,application/json;q=0.9,*/*;q=0.8',
        'User-Agent': USER_AGENT,
        'Cache-Control': 'no-cache'
      }
    })
    const buf = Buffer.from(await res.arrayBuffer())
    return { res, buf }
  } finally {
    clearTimeout(timer)
  }
}

async function fetchGithub(path, timeoutMs) {
  const url = 'https://api.github.com' + path
  assertUrl(url)
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: ac.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': USER_AGENT
      }
    })
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch (e) {}
    return { res, json, text }
  } finally {
    clearTimeout(timer)
  }
}

function repoCard(r) {
  if (!r || typeof r !== 'object') return null
  return {
    name: r.name || null,
    htmlUrl: r.html_url || null,
    description: r.description || null,
    fork: !!r.fork,
    language: r.language || null,
    stars: r.stargazers_count || 0,
    pushedAt: r.pushed_at || null,
    updatedAt: r.updated_at || null
  }
}

async function probeGithubUser(user, timeoutMs) {
  const profile = await fetchGithub('/users/' + encodeURIComponent(user), timeoutMs)
  const repos = await fetchGithub(
    '/users/' + encodeURIComponent(user) + '/repos?per_page=100&sort=updated',
    timeoutMs
  )
  const list = Array.isArray(repos.json) ? repos.json.map(repoCard).filter(Boolean) : []
  const originals = list.filter((r) => !r.fork)
  const newest = list[0] || null
  const sig = JSON.stringify({
    login: profile.json && profile.json.login,
    publicRepos: profile.json && profile.json.public_repos,
    updated: profile.json && profile.json.updated_at,
    names: list.map((r) => r.name + ':' + (r.pushedAt || r.updatedAt || ''))
  })
  return {
    ok: profile.res.ok,
    status: profile.res.status,
    hash: fingerprintBody(Buffer.from(sig)),
    title: user + ' * ' + list.length + ' repos',
    github: {
      login: (profile.json && profile.json.login) || user,
      name: (profile.json && profile.json.name) || null,
      bio: (profile.json && profile.json.bio) || null,
      publicRepos: (profile.json && profile.json.public_repos) || list.length,
      updatedAt: (profile.json && profile.json.updated_at) || null,
      originals: originals.slice(0, 12),
      recent: list.slice(0, 12),
      newest
    }
  }
}

async function probeGithubOrg(org, timeoutMs) {
  const repos = await fetchGithub('/orgs/' + encodeURIComponent(org) + '/repos?per_page=100', timeoutMs)
  const list = Array.isArray(repos.json) ? repos.json.map(repoCard).filter(Boolean) : []
  const sig = JSON.stringify(list.map((r) => [r.name, r.pushedAt, r.updatedAt, r.description]))
  return {
    ok: repos.res.ok,
    status: repos.res.status,
    hash: fingerprintBody(Buffer.from(sig)),
    title: org + ' * ' + list.length + ' repos',
    github: {
      login: org,
      publicRepos: list.length,
      originals: list,
      recent: list,
      newest: list[0] || null
    }
  }
}

function extractHwonderPosts(html) {
  const posts = []
  const seen = new Set()
  const re = /href="(\/posts\/[A-Za-z0-9][A-Za-z0-9\-_]*)"/g
  let m
  while ((m = re.exec(String(html || '')))) {
    const path = m[1]
    if (seen.has(path)) continue
    seen.add(path)
    posts.push({
      path,
      slug: path.replace('/posts/', ''),
      url: 'https://www.hwonder.com' + path
    })
  }
  return posts
}

async function probeHwonderIndex(url, timeoutMs) {
  const { res, buf } = await fetchBuf(url, timeoutMs, 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8')
  const html = buf.toString('utf8')
  const posts = extractHwonderPosts(html)
  const title = extractTitle(html)
  const sig = JSON.stringify({
    title,
    bytes: buf.length,
    posts: posts.map((p) => p.path)
  })
  return {
    ok: res.ok,
    status: res.status,
    bytes: buf.length,
    hash: fingerprintBody(Buffer.from(sig)),
    title: (title || 'h wonder') + ' * ' + posts.length + ' POSTS',
    note: posts.map((p) => p.slug).join(', '),
    hwonder: { posts, count: posts.length }
  }
}

async function probeGithubEvents(user, timeoutMs) {
  const ev = await fetchGithub(
    '/users/' + encodeURIComponent(user) + '/events/public?per_page=20',
    timeoutMs
  )
  const list = Array.isArray(ev.json) ? ev.json : []
  const recent = list.slice(0, 12).map((e) => ({
    type: e && e.type ? String(e.type).replace(/Event$/, '') : 'event',
    repo: e && e.repo && e.repo.name ? e.repo.name : null,
    createdAt: e && e.created_at ? e.created_at : null
  }))
  const newest = recent[0] || null
  const sig = JSON.stringify(recent.map((e) => [e.type, e.repo, e.createdAt]))
  return {
    ok: ev.res.ok,
    status: ev.res.status,
    hash: fingerprintBody(Buffer.from(sig)),
    title: newest
      ? user + ' * ' + newest.type + ' ' + (newest.repo || '') + ' ' + (newest.createdAt || '')
      : user + ' * no public events',
    github: {
      login: user,
      newest: newest
        ? {
            name: (newest.repo || '').split('/')[1] || newest.repo,
            pushedAt: newest.createdAt,
            description: newest.type
          }
        : null,
      recent: recent.map((e) => ({
        name: (e.repo || '').split('/')[1] || e.repo,
        pushedAt: e.createdAt,
        description: e.type,
        fork: false
      })),
      events: recent
    }
  }
}

async function probeGithubRepo(repo, timeoutMs) {
  const r = await fetchGithub('/repos/' + repo, timeoutMs)
  const card = repoCard(r.json)
  const sig = JSON.stringify({
    name: card && card.name,
    pushed: card && card.pushedAt,
    updated: card && card.updatedAt,
    desc: card && card.description,
    stars: card && card.stars
  })
  return {
    ok: r.res.ok,
    status: r.res.status,
    hash: fingerprintBody(Buffer.from(sig)),
    title: repo + (card && card.pushedAt ? ' * ' + card.pushedAt : ''),
    github: card ? { recent: [card], originals: card.fork ? [] : [card], newest: card } : null
  }
}

async function probeHttp(target, timeoutMs) {
  const accept =
    target.kind === 'json'
      ? 'application/json'
      : target.kind === 'xml'
        ? 'application/xml,text/xml'
        : 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'
  const { res, buf } = await fetchBuf(target.url, timeoutMs, accept)
  const body = buf.toString('utf8')
  let title = null
  let note = null
  if (target.kind === 'html') title = extractTitle(body)
  if (target.kind === 'json') {
    try {
      const j = JSON.parse(body)
      note = Object.keys(j).slice(0, 8).join(',')
      title = 'JSON ' + buf.length + 'B'
    } catch (e) {
      title = 'JSON PARSE FAIL'
    }
  }
  if (target.kind === 'xml') {
    const last = body.match(/<lastmod>([^<]+)<\/lastmod>/i)
    title = last ? 'SITEMAP * ' + last[1] : 'SITEMAP'
  }
  return {
    ok: res.ok,
    status: res.status,
    bytes: buf.length,
    hash: fingerprintBody(buf),
    title,
    note
  }
}

async function probeOne(target, timeoutMs) {
  const started = Date.now()
  const row = {
    ts: new Date().toISOString(),
    id: target.id,
    kind: target.kind,
    url: target.url || null,
    ok: false,
    status: null,
    ms: null,
    bytes: null,
    hash: null,
    title: null,
    note: null,
    github: null,
    hwonder: null,
    error: null
  }
  try {
    let extra
    if (target.kind === 'github-user') extra = await probeGithubUser(target.user, timeoutMs)
    else if (target.kind === 'github-org') extra = await probeGithubOrg(target.org, timeoutMs)
    else if (target.kind === 'github-repo') extra = await probeGithubRepo(target.repo, timeoutMs)
    else if (target.kind === 'github-events') extra = await probeGithubEvents(target.user, timeoutMs)
    else if (target.kind === 'hwonder-index') extra = await probeHwonderIndex(target.url, timeoutMs)
    else extra = await probeHttp(target, timeoutMs)
    Object.assign(row, extra)
    row.ms = Date.now() - started
  } catch (e) {
    row.ms = Date.now() - started
    row.error = e.name === 'AbortError' ? 'timeout' : String(e.message || e)
  }
  return row
}

async function probeDesk(deskId, timeoutMs) {
  const desk = DESKS[deskId]
  if (!desk) throw new Error('unknown desk: ' + deskId)
  const rows = await Promise.all(desk.targets.map((t) => probeOne(t, timeoutMs)))
  return { desk: desk.id, label: desk.label, subtitle: desk.subtitle, rows }
}

function diffRows(prevRows, nextRows) {
  const prev = {}
  ;(prevRows || []).forEach((r) => {
    if (r && r.id) prev[r.id] = r
  })
  const changes = []
  ;(nextRows || []).forEach((r) => {
    if (!r || !r.id) return
    const p = prev[r.id]
    if (!p) {
      changes.push({
        ts: r.ts,
        id: r.id,
        bits: ['FIRST SAMPLE'],
        fromHash: null,
        toHash: r.hash || null,
        title: r.title || null
      })
      return
    }
    const bits = []
    if (!!p.ok !== !!r.ok) bits.push(r.ok ? 'BACK UP' : 'DOWN')
    if (p.status !== r.status) bits.push('HTTP ' + (p.status ?? '--') + ' -> ' + (r.status ?? '--'))
    if (p.hash && r.hash && p.hash !== r.hash) {
      const sameSize = p.bytes != null && r.bytes != null && p.bytes === r.bytes
      bits.push(sameSize ? 'HASH CHURN (SAME SIZE)' : 'CONTENT HASH CHANGED')
    }
    if (p.title && r.title && p.title !== r.title) bits.push('TITLE CHANGED')
    if (p.bytes != null && r.bytes != null && p.bytes !== r.bytes) bits.push('SIZE ' + p.bytes + ' -> ' + r.bytes)
    const pPush = p.github && p.github.newest && p.github.newest.pushedAt
    const nPush = r.github && r.github.newest && r.github.newest.pushedAt
    if (pPush && nPush && pPush !== nPush) bits.push('GH PUSH ' + nPush)
    const pPosts = p.hwonder && Array.isArray(p.hwonder.posts) ? p.hwonder.posts.map((x) => x.path).join(',') : ''
    const nPosts = r.hwonder && Array.isArray(r.hwonder.posts) ? r.hwonder.posts.map((x) => x.path).join(',') : ''
    if (pPosts && nPosts && pPosts !== nPosts) bits.push('HWONDER POST LIST ' + (r.hwonder.count || 0))
    if (bits.length) {
      changes.push({
        ts: r.ts,
        id: r.id,
        bits,
        fromHash: p.hash || null,
        toHash: r.hash || null,
        title: r.title || null
      })
    }
  })
  return changes
}

function isNotice(change) {
  if (!change) return false
  const id = String(change.id || '')
  const bits = (change.bits || []).join(' ')
  if (id.indexOf('gh-') === 0 && /GH PUSH|CONTENT HASH CHANGED|TITLE CHANGED/.test(bits)) return true
  if (id.indexOf('hwonder') === 0 && /HWONDER POST LIST|CONTENT HASH CHANGED|TITLE CHANGED|SIZE /.test(bits)) {
    return true
  }
  return false
}

module.exports = {
  DESKS,
  USER_AGENT,
  INTERVAL_MS: 60 * 60 * 1000,
  probeDesk,
  diffRows,
  isNotice
}
