/**
 * Refresh bundled Trix / Geoff snapshots from the public sources the site already reads.
 * Pond global stats stay live through /api/pond-stats (no bundled counter).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..')
const require = createRequire(import.meta.url)

function loadEnv() {
  const envPath = path.join(ROOT, '.env')
  if (!fs.existsSync(envPath)) return
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  })
}

async function getText(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json, text/xml, */*' } })
  const text = await res.text()
  if (!res.ok) throw new Error(url + ' HTTP ' + res.status)
  return text
}

async function getJson(url) {
  return JSON.parse(await getText(url))
}

function parseSitemap(xml) {
  const urls = []
  const re = /<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]*)<\/lastmod>)?/gi
  let m
  while ((m = re.exec(String(xml)))) {
    urls.push({ loc: m[1].trim(), lastmod: m[2] || null })
  }
  return urls
}

function stamp(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso || '')
  return d.toISOString().replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC')
}

async function refreshTicker() {
  const data = await getJson('https://trix.market/api/trending')
  const out = []
  const seen = new Set()
  ;['trending', 'recentlyGraduated', 'topGainers'].forEach((key) => {
    const arr = data && data[key]
    if (!Array.isArray(arr)) return
    arr.forEach((t) => {
      if (!t || !t.mint || seen.has(t.mint)) return
      seen.add(t.mint)
      out.push(t)
    })
  })
  out.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
  const tokens = out.slice(0, 80).map((t) => ({
    mint: t.mint,
    symbol: String(t.symbol || 'TOKEN').replace(/^\$/, '').toUpperCase(),
    name: t.name || t.symbol || 'TOKEN',
    price: typeof t.price === 'number' ? t.price : null,
    change24h: typeof t.change24h === 'number' ? t.change24h : null,
    marketCap: typeof t.marketCap === 'number' ? t.marketCap : null
  }))
  const payload = {
    updatedAt: new Date().toISOString(),
    source: 'trix.market/api/trending',
    tokens
  }
  fs.writeFileSync(path.join(ROOT, 'assets', 'data', 'trix-ticker.json'), JSON.stringify(payload, null, 2) + '\n')
  console.log('ticker', tokens.length, tokens.slice(0, 3).map((t) => t.symbol).join(', '))
}

async function refreshBoxes() {
  const { readPackMinted } = require(path.join(ROOT, 'api', 'lib', 'trix-box-chain.js'))
  const [posts, launches, board, minted] = await Promise.all([
    getJson('https://www.trix.market/api/posts?limit=1'),
    getJson('https://www.trix.market/api/launches?limit=1'),
    getJson('https://www.trix.market/api/leaderboard').catch(() => null),
    readPackMinted().catch(() => null)
  ])
  const row = posts && Array.isArray(posts.posts) ? posts.posts[0] : null
  const memesPosted = row && Number(row.arrivalSequence) > 0 ? Number(row.arrivalSequence) : null
  const launchTotal = launches && launches.total != null
    ? Number(launches.total)
    : (Array.isArray(launches && launches.items) ? null : null)
  const pulledAt = new Date().toISOString()
  const file = path.join(ROOT, 'assets', 'data', 'trix-boxes.json')
  const boxes = JSON.parse(fs.readFileSync(file, 'utf8'))
  boxes.updatedAt = pulledAt
  boxes.source = 'live TRiX public feeds + BuyPack minted counter (mkt/state 404)'
  if (minted != null) boxes.mintedTotal = minted
  boxes.boxesLeft = null
  const list = board && Array.isArray(board.leaderboard) ? board.leaderboard : []
  if (list.length) {
    boxes.leaderboard = list.slice(0, 80).map((row) => ({
      rank: Math.max(0, Math.floor(Number(row.rank) || 0)),
      username: String(row.username || '').slice(0, 32),
      points: Math.max(0, Math.floor(Number(row.points) || 0)),
      verified: !!row.isVerified,
      wallet: row.walletAddress || null
    }))
  }
  boxes.public = Object.assign({}, boxes.public || {}, {
    boxesMinted: minted,
    boxesLeft: null,
    memesLeft: null,
    memesPosted,
    memesLatestAt: row && row.createdAt ? row.createdAt : null,
    launches: Number.isFinite(launchTotal) ? launchTotal : (boxes.public && boxes.public.launches) || null,
    rewardValueUsd: null,
    coverableUsd: null,
    outstandingLiabilityUsd: null,
    fundedUsd: null,
    paidUsd: null,
    owedUsd: null,
    snapshotAt: pulledAt,
    stale: false,
    mktStateRetired: true,
    countNote: 'MEMES POSTED is the live TRiX feed sequence. BOXES ON-CHAIN is the BuyPack minted counter. Pool USD figures from /api/mkt/state are not published.'
  })
  if (boxes.chain) boxes.chain.packMinted = minted
  fs.writeFileSync(file, JSON.stringify(boxes, null, 2))
  console.log('boxes minted', minted, 'memesPosted', memesPosted, 'launchesKeys', Object.keys(launches || {}).join(','))
}

async function refreshGeoff() {
  const xml = await getText('https://www.geoff.ai/sitemap.xml')
  const urls = parseSitemap(xml)
  if (!urls.length) throw new Error('geoff sitemap empty')
  const newest = urls.map((u) => u.lastmod).filter(Boolean).sort().slice(-1)[0]
  const oldest = urls.map((u) => u.lastmod).filter(Boolean).sort()[0]
  const same = urls.every((u) => u.lastmod === urls[0].lastmod)
  const file = path.join(ROOT, 'assets', 'data', 'geoffwatch-sitrep.json')
  const sit = JSON.parse(fs.readFileSync(file, 'utf8'))
  const nowIso = new Date().toISOString()
  const when = stamp(newest)
  sit.updatedAt = nowIso
  sit.status = 'SITEMAP REREAD ' + when + ' * PUBLIC GEOFF ONLY'
  sit.now = 'GEOFF.AI SITEMAP HAS ' + urls.length + ' PUBLIC URLS. ' +
    (same ? 'EVERY LASTMOD IS ' + when + '.' : 'NEWEST LASTMOD IS ' + when + '. OLDEST IS ' + stamp(oldest) + '.')
  sit.headline = 'GEOFF.AI PUBLIC PAGES LASTMODDED ' + when + '.'
  const kept = 'TRiX /api/mkt/state is 404. Live TRiX meters on this page come from /api/posts, /api/launches, and the on-chain BuyPack minted counter. Not a trade signal.'
  sit.summary = 'Public reread ' + stamp(nowIso) + ': www.geoff.ai/sitemap.xml ' +
    (same ? 'lastmod ' + newest + ' on all ' + urls.length + ' URLs.' : 'newest lastmod ' + newest + '.') +
    ' ' + kept
  sit.posts = Array.isArray(sit.posts) ? sit.posts : []
  sit.posts.unshift({
    ts: nowIso,
    tag: 'GEOFF',
    title: 'SITEMAP REREAD ' + when,
    body: urls.map((u) => u.loc.replace('https://www.geoff.ai', '') + ' lastmod ' + (u.lastmod || 'none')).join('. ') +
      '. Official culture loop is still make memes on geoff.ai and land them on TRiX. Not a trade signal.'
  })
  fs.writeFileSync(file, JSON.stringify(sit, null, 2) + '\n')
  console.log('geoff urls', urls.length, 'newest', newest, 'same', same)
}

async function checkPond() {
  const data = await getJson('https://www.pond0x.com/api/solana')
  const when = data.lastUpdated ? new Date(Number(data.lastUpdated)).toISOString() : null
  console.log('pond swaps', data.swaps, 'jackpot', data.jackpot, 'bonus', data.bonus, 'lastUpdated', when)
}

loadEnv()
await refreshTicker()
await refreshBoxes()
await refreshGeoff()
await checkPond()
console.log('DONE snapshots')
