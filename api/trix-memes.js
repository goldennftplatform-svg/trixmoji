/**
 * Public TRiX meme ranking from complete per-user feeds.
 * Source of truth for "who made how many" is
 * GET /api/meme-image/user/:username (full public list).
 * Token views merge those feeds plus public token feeds for the busiest coins.
 * No login. Not an official TRiX board.
 */

const fs = require('fs')
const path = require('path')
const { rateLimitOrReject } = require('./lib/rate-limit')

const LEADERBOARD = 'https://trix.market/api/leaderboard'
const FRONTPAGE = 'https://trix.market/api/frontpage'
const LAUNCHES = 'https://trix.market/api/launches?limit=500'
const USER_MEMES = 'https://trix.market/api/meme-image/user/'
const TOKEN_MEMES = 'https://trix.market/api/meme-image/token/'
const FALLBACK = path.join(__dirname, '..', 'assets', 'data', 'trix-memes.json')

const BATCH = 10
const TOP = 2000
const LIVE_TTL_MS = 90000
const LIVE_BUDGET_MS = 22000

let liveCache = { at: 0, body: null }

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 'public, max-age=60')
}

function fetchJson(url) {
  return fetch(url, { headers: { Accept: 'application/json' } }).then(async (res) => {
    if (!res.ok) throw new Error('Trix HTTP ' + res.status + ' ' + url)
    return res.json()
  })
}

async function mapPool(items, size, fn) {
  const out = []
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size)
    out.push(...(await Promise.all(chunk.map(fn))))
  }
  return out
}

function addMint(map, token) {
  const mint = token && (token.mintAddress || token.mint)
  if (!mint || map.has(mint)) return
  const creator = token.creator || {}
  map.set(mint, {
    mint,
    name: token.name || token.tokenName || null,
    symbol: token.symbol || token.ticker || null,
    creator: creator.username || token.creatorUsername || null,
    creatorVerified: !!(creator.isVerified || token.creatorVerified)
  })
}

function collectTokens(frontpage, launchesA, launchesB) {
  const map = new Map()
  ;['featured', 'boosted', 'recent'].forEach((key) => {
    const list = frontpage && frontpage[key]
    if (Array.isArray(list)) list.forEach((t) => addMint(map, t))
  })
  ;[launchesA, launchesB].forEach((bag) => {
    const items = bag && Array.isArray(bag.items) ? bag.items : []
    items.forEach((t) => addMint(map, t))
  })
  return map
}

function addUsername(out, seen, meta, name, extra) {
  const raw = String(name || '').trim()
  if (!raw || raw === 'anon') return
  const key = raw.toLowerCase()
  if (seen.has(key)) {
    if (extra && meta.has(raw)) {
      const cur = meta.get(raw)
      if (extra.verified) cur.verified = true
      if (extra.points && extra.points > cur.points) cur.points = extra.points
    }
    return
  }
  seen.add(key)
  out.push(raw)
  meta.set(raw, {
    username: raw,
    verified: !!(extra && extra.verified),
    points: Math.max(0, Math.floor(Number(extra && extra.points) || 0))
  })
}

function collectUsernames(leaderboard, extraNames, fallback) {
  const out = []
  const seen = new Set()
  const meta = new Map()
  const list = Array.isArray(leaderboard && leaderboard.leaderboard)
    ? leaderboard.leaderboard
    : []
  list.forEach((row) => {
    addUsername(out, seen, meta, row && row.username, {
      verified: !!(row && row.isVerified),
      points: row && row.points
    })
  })
  ;(extraNames || []).forEach((name) => addUsername(out, seen, meta, name, null))
  const prevUsers = fallback && fallback.views && Array.isArray(fallback.views.users)
    ? fallback.views.users
    : []
  prevUsers.forEach((row) => {
    addUsername(out, seen, meta, row && row.username, {
      verified: !!(row && row.verified),
      points: row && row.points
    })
  })
  const discovered = Array.isArray(fallback && fallback.discoveredUsers)
    ? fallback.discoveredUsers
    : []
  discovered.forEach((name) => addUsername(out, seen, meta, name, null))
  return { names: out, meta }
}

function slimUserMeme(row, username, tokenMap) {
  const mint = (row && row.tokenMint) || null
  const token = (mint && tokenMap.get(mint)) || {}
  return {
    id: row && row.id,
    author: username,
    verified: false,
    tokenMint: mint,
    tokenName: (row && (row.coinName || row.coinSymbol)) || token.name || token.symbol,
    tokenSymbol: (row && row.coinSymbol) || token.symbol || (row && row.coinName),
    tokenCreator: token.creator || null,
    hearts: Math.max(0, Number((row && row.heartCount) || 0) || 0),
    skulls: Math.max(0, Number((row && row.skullCount) || 0) || 0),
    replies: Math.max(0, Number((row && row.replyCount) || 0) || 0),
    createdAt: (row && row.createdAt) || null,
    imageUrl: (row && row.imageUrl) || null
  }
}

function slimTokenMeme(row, token) {
  return {
    id: row && row.id,
    author: (row && (row.authorUsername || row.userId || row.username)) || 'anon',
    verified: !!(row && (row.authorVerified || row.isVerified)),
    tokenMint: (row && (row.tokenMint || row.memeTokenMint)) || token.mint,
    tokenName: (row && (row.coinName || row.coinSymbol || row.memeCoinName)) || token.name || token.symbol,
    tokenSymbol: (row && (row.coinSymbol || row.memeCoinSymbol)) || token.symbol || token.name,
    tokenCreator: token.creator || null,
    hearts: Math.max(0, Number((row && row.heartCount) || 0) || 0),
    skulls: Math.max(0, Number((row && row.skullCount) || 0) || 0),
    replies: Math.max(0, Number((row && row.replyCount) || 0) || 0),
    createdAt: (row && row.createdAt) || null,
    imageUrl: (row && row.imageUrl) || null
  }
}

function mergeMemes(userMemes, tokenMemes) {
  const byId = new Map()
  userMemes.forEach((m) => {
    const key = m.id || (m.author + '|' + m.tokenMint + '|' + m.createdAt)
    byId.set(key, m)
  })
  tokenMemes.forEach((m) => {
    const key = m.id || (m.author + '|' + m.tokenMint + '|' + m.createdAt)
    const prev = byId.get(key)
    if (!prev) {
      byId.set(key, m)
      return
    }
    if ((m.hearts || 0) > (prev.hearts || 0)) prev.hearts = m.hearts
    if ((m.skulls || 0) > (prev.skulls || 0)) prev.skulls = m.skulls
    if ((m.replies || 0) > (prev.replies || 0)) prev.replies = m.replies
    if (m.imageUrl && !prev.imageUrl) prev.imageUrl = m.imageUrl
    if (m.verified) prev.verified = true
    if (!prev.tokenCreator && m.tokenCreator) prev.tokenCreator = m.tokenCreator
  })
  return [...byId.values()]
}

function topPairs(map, n) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, n)
    .map(([name, memes]) => ({ name, memes }))
}

function rankUsers(memes, userMeta) {
  const by = new Map()
  memes.forEach((m) => {
    const key = String(m.author || 'anon')
    let row = by.get(key)
    if (!row) {
      const meta = userMeta.get(key) || {}
      row = {
        username: key,
        verified: !!(meta.verified || m.verified),
        points: meta.points || 0,
        memes: 0,
        hearts: 0,
        skulls: 0,
        replies: 0,
        likedMemes: 0,
        tokens: new Map()
      }
      by.set(key, row)
    }
    row.memes += 1
    row.hearts += m.hearts || 0
    row.skulls += m.skulls || 0
    row.replies += m.replies || 0
    if ((m.hearts || 0) > 0) row.likedMemes += 1
    if (m.verified) row.verified = true
    const tkey = m.tokenSymbol || m.tokenName || m.tokenMint
    if (tkey) row.tokens.set(tkey, (row.tokens.get(tkey) || 0) + 1)
  })
  return [...by.values()]
    .map((r) => ({
      username: r.username,
      verified: r.verified,
      points: r.points,
      memes: r.memes,
      hearts: r.hearts,
      skulls: r.skulls,
      replies: r.replies,
      likedMemes: r.likedMemes,
      avgHearts: r.memes ? Number((r.hearts / r.memes).toFixed(2)) : 0,
      tokenCount: r.tokens.size,
      tokens: topPairs(r.tokens, 24)
    }))
    .sort((a, b) => b.memes - a.memes || a.username.localeCompare(b.username))
    .slice(0, TOP)
}

function keepGoing(deadline) {
  return Date.now() < deadline
}

function rankTokens(memes) {
  const by = new Map()
  memes.forEach((m) => {
    const key = String(m.tokenMint || m.tokenSymbol || '')
    if (!key) return
    let row = by.get(key)
    if (!row) {
      row = {
        mint: m.tokenMint || key,
        symbol: m.tokenSymbol || m.tokenName || key,
        name: m.tokenName || m.tokenSymbol || key,
        creator: m.tokenCreator || null,
        memes: 0,
        hearts: 0,
        skulls: 0,
        authors: new Map()
      }
      by.set(key, row)
    }
    row.memes += 1
    row.hearts += m.hearts || 0
    row.skulls += m.skulls || 0
    if (m.tokenCreator && !row.creator) row.creator = m.tokenCreator
    const a = String(m.author || 'anon')
    let ar = row.authors.get(a)
    if (!ar) {
      ar = { username: a, verified: !!m.verified, memes: 0, hearts: 0 }
      row.authors.set(a, ar)
    }
    ar.memes += 1
    ar.hearts += m.hearts || 0
    if (m.verified) ar.verified = true
  })
  return [...by.values()]
    .map((r) => {
      const authors = [...r.authors.values()].sort((a, b) => (b.hearts || 0) - (a.hearts || 0) || b.memes - a.memes || a.username.localeCompare(b.username))
      const authorCount = authors.length
      return {
        mint: r.mint,
        symbol: r.symbol,
        name: r.name,
        creator: r.creator,
        memes: r.memes,
        hearts: r.hearts,
        skulls: r.skulls,
        avgHearts: r.memes ? Number((r.hearts / r.memes).toFixed(2)) : 0,
        authorCount,
        memesPerAuthor: authorCount ? Number((r.memes / authorCount).toFixed(2)) : 0,
        authors: authors.slice(0, 120)
      }
    })
    .sort((a, b) => b.memes - a.memes || String(a.symbol).localeCompare(String(b.symbol)))
    .slice(0, TOP)
}

function rankCreators(tokenMap, memes) {
  const by = new Map()
  function row(key) {
    let r = by.get(key)
    if (!r) {
      r = { username: key, verified: false, tokens: 0, memes: 0, symbols: [], authors: new Set() }
      by.set(key, r)
    }
    return r
  }
  tokenMap.forEach((t) => {
    const key = String(t.creator || 'anon')
    const r = row(key)
    r.tokens += 1
    if (t.creatorVerified) r.verified = true
    if (t.symbol) r.symbols.push(t.symbol)
  })
  memes.forEach((m) => {
    const key = String(m.tokenCreator || 'anon')
    const r = row(key)
    r.memes += 1
    if (m.author) r.authors.add(m.author)
  })
  return [...by.values()]
    .map((r) => ({
      username: r.username,
      verified: r.verified,
      tokens: r.tokens,
      memes: r.memes,
      authorCount: r.authors.size,
      symbols: r.symbols.slice(0, 8)
    }))
    .sort((a, b) => b.memes - a.memes || b.tokens - a.tokens || a.username.localeCompare(b.username))
    .slice(0, TOP)
}

function rankMemes(memes) {
  return memes
    .slice()
    .sort((a, b) => (b.hearts || 0) - (a.hearts || 0) || (b.replies || 0) - (a.replies || 0) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, 500)
    .map((m) => ({
      id: m.id,
      author: m.author,
      verified: !!m.verified,
      tokenMint: m.tokenMint || null,
      tokenSymbol: m.tokenSymbol || m.tokenName || null,
      hearts: m.hearts || 0,
      skulls: m.skulls || 0,
      replies: m.replies || 0,
      createdAt: m.createdAt || null,
      imageUrl: m.imageUrl || null
    }))
}

function likeAnalytics(memes, users) {
  const hearts = memes.reduce((n, m) => n + (m.hearts || 0), 0)
  const skulls = memes.reduce((n, m) => n + (m.skulls || 0), 0)
  const replies = memes.reduce((n, m) => n + (m.replies || 0), 0)
  const withLikes = memes.filter((m) => (m.hearts || 0) > 0).length
  const rankedMemes = rankMemes(memes)
  const byHearts = users.slice().sort((a, b) => (b.hearts || 0) - (a.hearts || 0) || (b.memes || 0) - (a.memes || 0))
  const topMeme = rankedMemes[0] || null
  const topUser = byHearts[0] || null
  return {
    hearts,
    skulls,
    replies,
    withLikes,
    zeroLikeMemes: Math.max(0, memes.length - withLikes),
    avgHearts: memes.length ? Number((hearts / memes.length).toFixed(2)) : 0,
    avgHeartsLiked: withLikes ? Number((hearts / withLikes).toFixed(2)) : 0,
    topMeme: topMeme
      ? {
          id: topMeme.id,
          author: topMeme.author,
          tokenSymbol: topMeme.tokenSymbol,
          hearts: topMeme.hearts,
          createdAt: topMeme.createdAt
        }
      : null,
    topUser: topUser
      ? { username: topUser.username, hearts: topUser.hearts, memes: topUser.memes, avgHearts: topUser.avgHearts }
      : null,
    topUsers: byHearts.slice(0, 25).map((u) => ({
      username: u.username,
      hearts: u.hearts,
      memes: u.memes,
      avgHearts: u.avgHearts,
      likedMemes: u.likedMemes
    }))
  }
}

function rankAuthorsCompat(users) {
  return users.slice(0, 25).map((r) => ({
    username: r.username,
    verified: r.verified,
    memes: r.memes,
    tokens: (r.tokens || []).map((t) => (t && t.name) || t)
  }))
}

function readFallbackSafe() {
  try {
    return JSON.parse(fs.readFileSync(FALLBACK, 'utf8'))
  } catch (e) {
    return null
  }
}

function mergeUserRows(fresh, fallbackUsers) {
  const by = new Map()
  ;(fallbackUsers || []).forEach((row) => {
    if (!row || !row.username) return
    by.set(String(row.username).toLowerCase(), row)
  })
  fresh.forEach((row) => {
    by.set(String(row.username).toLowerCase(), row)
  })
  return [...by.values()].sort((a, b) => b.memes - a.memes || a.username.localeCompare(b.username))
}

async function buildBoard(opts) {
  opts = opts || {}
  const budgetMs = Number(opts.budgetMs || process.env.TRIX_MEMES_BUDGET_MS || LIVE_BUDGET_MS)
  const full = opts.full === true || String(process.env.TRIX_MEMES_FULL || '') === '1'
  const started = Date.now()
  const deadline = started + Math.max(8000, budgetMs)
  const fallback = readFallbackSafe()

  const [frontpage, launchesA, launchesB, leaderboard] = await Promise.all([
    fetchJson(FRONTPAGE).catch(() => null),
    fetchJson(LAUNCHES + '&offset=0').catch(() => null),
    fetchJson(LAUNCHES + '&offset=500').catch(() => null),
    fetchJson(LEADERBOARD).catch(() => null)
  ])
  const tokenMap = collectTokens(frontpage, launchesA, launchesB)
  const allMints = [...tokenMap.keys()]
  const scanMints = full
    ? allMints
    : allMints.slice(0, 180)

  const tokenDeadline = full ? deadline - 4000 : Math.min(deadline - 10000, started + Math.floor(budgetMs * 0.45))
  const discovered = []
  const tokenBags = await mapPool(scanMints, BATCH, async (mint) => {
    if (!keepGoing(tokenDeadline)) return []
    const token = tokenMap.get(mint) || { mint }
    try {
      const list = await fetchJson(TOKEN_MEMES + encodeURIComponent(mint))
      const rows = Array.isArray(list) ? list : []
      rows.forEach((row) => {
        const name = row && (row.authorUsername || row.username)
        if (name) discovered.push(name)
      })
      return rows.map((row) => slimTokenMeme(row, token))
    } catch (e) {
      return []
    }
  })
  const tokenMemes = tokenBags.flat()

  const { names, meta } = collectUsernames(leaderboard, discovered, fallback)
  const fetched = new Set()
  const userBags = await mapPool(names, BATCH, async (username) => {
    if (!keepGoing(deadline - 400)) return []
    try {
      const list = await fetchJson(USER_MEMES + encodeURIComponent(username))
      fetched.add(username)
      const rows = Array.isArray(list) ? list : []
      return rows.map((row) => slimUserMeme(row, username, tokenMap))
    } catch (e) {
      return []
    }
  })
  const memes = userBags.flat()
  memes.forEach((m) => {
    const metaRow = meta.get(m.author)
    if (metaRow && metaRow.verified) m.verified = true
  })

  const allMemes = mergeMemes(memes, tokenMemes)
  const freshUsers = rankUsers(memes, meta)
  const users = mergeUserRows(freshUsers, fallback && fallback.views && fallback.views.users)
  const tokenRows = rankTokens(allMemes)
  const creators = rankCreators(tokenMap, allMemes)
  const umpa = users.find((u) => String(u.username).toLowerCase() === 'umpalumpa')
  const likes = likeAnalytics(allMemes, users)
  const likedMemes = rankMemes(allMemes)

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    source: full
      ? 'full public census: every launch token feed for authors, then each author\'s full /api/meme-image/user/:username list'
      : 'live refresh of known authors plus token feeds from launches/frontpage; merged with last full census so nobody is dropped',
    note: 'User meme counts are full public user feeds. Authors are discovered from every public coin meme feed, not only the points board. TRiX has no official meme-count board.',
    full,
    elapsedMs: Date.now() - started,
    sampledUsers: fetched.size,
    knownUsers: names.length,
    sampledTokens: tokenMap.size,
    tokenFeeds: scanMints.length,
    sampledMemes: memes.length,
    uniqueUsers: users.filter((u) => (u.memes || 0) > 0).length,
    uniqueCreators: creators.length,
    discoveredUsers: names,
    stats: {
      memes: memes.length,
      tokens: new Set(memes.map((m) => m.tokenMint).filter(Boolean)).size,
      users: users.filter((u) => (u.memes || 0) > 0).length,
      creators: creators.length,
      umpalumpa: umpa ? umpa.memes : 0,
      hearts: likes.hearts,
      skulls: likes.skulls,
      replies: likes.replies,
      withLikes: likes.withLikes,
      avgHearts: likes.avgHearts,
      usersFetched: fetched.size,
      usersKnown: names.length,
      tokensScanned: scanMints.length,
      tokensTotal: allMints.length
    },
    ranking: rankAuthorsCompat(users),
    likes,
    views: {
      users: users.filter((u) => (u.memes || 0) > 0),
      tokens: tokenRows,
      perToken: tokenRows.slice().sort((a, b) => b.memesPerAuthor - a.memesPerAuthor || b.memes - a.memes),
      creators,
      memes: likedMemes
    }
  }
}

function readFallback() {
  return JSON.parse(fs.readFileSync(FALLBACK, 'utf8'))
}

module.exports = async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'GET only' })
  }
  if (rateLimitOrReject(req, res, { prefix: 'trix-memes', perMinute: 20, perDay: 400 })) {
    return
  }

  if (liveCache.body && Date.now() - liveCache.at < LIVE_TTL_MS) {
    return res.status(200).json(liveCache.body)
  }

  try {
    const out = await buildBoard({ full: false, budgetMs: LIVE_BUDGET_MS })
    const floor = readFallbackSafe()
    const floorN = floor && floor.stats ? Number(floor.stats.memes) || 0 : 0
    const liveN = out && out.stats ? Number(out.stats.memes) || 0 : 0
    if (floorN > liveN) {
      out.stats = Object.assign({}, out.stats || {}, { memes: floorN, floorApplied: true })
      out.note = (out.note || '') + ' Live sample was smaller than the last full census, so the census floor is kept.'
    }
    liveCache = { at: Date.now(), body: out }
    try {
      const { saveLive } = require('./lib/trix-live-store')
      await saveLive({ memes: out })
    } catch (e) {}
    return res.status(200).json(out)
  } catch (err) {
    try {
      const bundled = readFallback()
      bundled.ok = bundled.ok !== false
      bundled.source = (bundled.source || 'bundled') + ' (fallback)'
      bundled.fallbackReason = String(err && err.message ? err.message : err)
      return res.status(200).json(bundled)
    } catch (e) {
      return res.status(200).json({
        ok: false,
        error: String(err && err.message ? err.message : err),
        ranking: [],
        views: { users: [], tokens: [], perToken: [], creators: [] }
      })
    }
  }
}

module.exports.buildBoard = buildBoard
