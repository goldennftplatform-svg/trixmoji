/**
 * DOSWAPZ — public TRiX BOX board.
 * Proxies trix.market/api/mkt/state + /api/cards (no login, no wallet).
 * Display names are BOXES. Official TRiX posts call them boxes.
 */

const fs = require('fs')
const path = require('path')
const { rateLimitOrReject } = require('./lib/rate-limit')
const { readPackMinted, readPackHolders, PACK_PROGRAM, PACK_CONFIG } = require('./lib/trix-box-chain')

const TRIX_STATE = 'https://trix.market/api/mkt/state'
const TRIX_CARDS = 'https://trix.market/api/cards'
function dataFile(name) {
  const names = [
    path.join(__dirname, '..', 'assets', 'data', name),
    path.join(process.cwd(), 'assets', 'data', name),
    path.join(__dirname, '../../assets/data', name)
  ]
  for (let i = 0; i < names.length; i++) {
    try {
      if (fs.existsSync(names[i])) return names[i]
    } catch (e) {}
  }
  return names[0]
}
const FALLBACK = dataFile('trix-boxes.json')
const WALLET_CENSUS = dataFile('trix-wallets.json')

const PACK_LOOK = {
  base: { color: 'WHITE', hex: '#f4f4f4', artLocal: '/assets/images/geoffwatch/pack-base.png' },
  viral: { color: 'HOLO', hex: '#7ecbff', artLocal: '/assets/images/geoffwatch/pack-viral.png' },
  hype: { color: 'MAGENTA', hex: '#c2187a', artLocal: '/assets/images/geoffwatch/pack-hype.png' },
  silver: { color: 'SILVER', hex: '#c0c6ce', artLocal: null },
  gold: { color: 'GOLD', hex: '#d4af37', artLocal: null }
}

const CARD_LOOK = {
  GOLD: { color: 'GOLD', hex: '#d4af37' },
  PLATINUM: { color: 'SILVER', hex: '#c0c6ce' },
  ONYX: { color: 'BLACK', hex: '#2a2a2a' },
  VOID: { color: 'VOID', hex: '#111111' },
  LIGHT: { color: 'PINK', hex: '#ff8ad4' },
  INVERSE: { color: 'AURORA', hex: '#7ecbff' },
  ENTER: { color: 'IRIS', hex: '#c9b8ff' }
}

const RARITY_LOOK = [
  { id: 'mythic', type: 'MYTHIC', color: 'AMBER', hex: '#fbbf24', weight: 4 },
  { id: 'epic', type: 'EPIC', color: 'PURPLE', hex: '#c084fc', weight: 35 },
  { id: 'rare', type: 'RARE', color: 'BLUE', hex: '#60a5fa', weight: 200 },
  { id: 'uncommon', type: 'UNCOMMON', color: 'GREEN', hex: '#4ade80', weight: 900 },
  { id: 'common', type: 'COMMON', color: 'GRAY', hex: '#a1a1aa', weight: 4561 },
  { id: 'trix', type: 'VOID', color: 'HOT PINK', hex: '#ff00cc', weight: 4300 }
]

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function lookBox(id) {
  return PACK_LOOK[String(id || '').toLowerCase()] || {
    color: 'BLACK',
    hex: '#111111',
    artLocal: '/assets/images/geoffwatch/black-box-512.png'
  }
}

function asBoxName(raw, id) {
  const base = String(raw || id || 'box')
    .replace(/\bpacks?\b/gi, 'Box')
    .replace(/\s+/g, ' ')
    .trim()
  return (base || 'Box').toUpperCase()
}

function mapLevel(level) {
  const id = String((level && level.id) || '').toLowerCase() || 'unknown'
  const pack = lookBox(id)
  const artRemote = level && level.artUrl
    ? (String(level.artUrl).indexOf('http') === 0
      ? String(level.artUrl)
      : 'https://trix.market' + String(level.artUrl))
    : null
  const typeName = asBoxName(level && (level.name || level.id), id)
  const minted = Math.max(0, Math.floor(num(level && level.minted)))
  const available = Math.max(0, Math.floor(num(level && level.available)))
  return {
    id,
    type: typeName,
    name: typeName,
    color: pack.color,
    hex: pack.hex,
    minted,
    available,
    left: available,
    soldOut: !!(level && level.soldOut),
    inRound: true,
    isNew: !!(level && level.isNew),
    maxSupply: Math.max(0, Math.floor(num(level && level.maxSupply))),
    maxMultiple: num(level && level.maxMultiple),
    priceUsd: num(level && level.priceUsd),
    priceSol: num(level && level.priceSol),
    artUrl: pack.artLocal || artRemote,
    remoteArtUrl: artRemote
  }
}

function mapCard(card) {
  const name = String((card && card.name) || '').toUpperCase()
  const look = CARD_LOOK[name] || { color: name || 'BLACK', hex: '#111111' }
  const imageUrl = card && card.imageUrl
    ? (String(card.imageUrl).indexOf('http') === 0
      ? String(card.imageUrl)
      : 'https://trix.market' + String(card.imageUrl))
    : null
  return {
    id: String((card && card.id) || name).toLowerCase(),
    type: name,
    name,
    color: look.color,
    hex: look.hex,
    slot: card && card.slot != null ? num(card.slot) : null,
    active: !!(card && card.active),
    multiplier: num(card && card.multiplier),
    priceSol: num(card && card.priceSol),
    discountActive: !!(card && card.discountActive),
    discountPercent: num(card && card.discountPercent),
    artUrl: imageUrl
  }
}

function mapRarity(level) {
  const bands = (level && level.bands) || {}
  return RARITY_LOOK.map((r) => {
    const band = bands[r.id]
    return {
      id: r.id,
      type: r.type,
      color: r.color,
      hex: r.hex,
      weight: r.weight,
      oddsPct: Number((r.weight / 100).toFixed(2)),
      band: Array.isArray(band) ? band : null
    }
  })
}

function shortAddr(addr) {
  const s = String(addr || '')
  if (s.length < 12) return s || null
  return s.slice(0, 4) + '...' + s.slice(-4)
}

function mapLeaderboard(raw) {
  const list = Array.isArray(raw && raw.leaderboard) ? raw.leaderboard : []
  return list.slice(0, 80).map((row) => ({
    rank: Math.max(0, Math.floor(num(row && row.rank))),
    username: String((row && row.username) || '').slice(0, 32),
    points: Math.max(0, Math.floor(num(row && row.points))),
    verified: !!(row && row.isVerified),
    wallet: (row && row.walletAddress) || null
  }))
}

function collectorBoxes(row) {
  return Math.max(
    0,
    Math.floor(num(
      row && (row.boxes != null ? row.boxes
        : row.owned != null ? row.owned
          : row.packs != null ? row.packs
            : row.packCount)
    ))
  )
}

function mapCollectors(raw) {
  const list = Array.isArray(raw && raw.topCollectors) ? raw.topCollectors : []
  return list.slice(0, 25).map((row, i) => ({
    rank: i + 1,
    username: String((row && (row.username || row.ripper)) || '').slice(0, 32),
    boxes: collectorBoxes(row),
    rips: Math.max(0, Math.floor(num(row && row.rips))),
    mythics: Math.max(0, Math.floor(num(row && row.mythics))),
    earnedUsd: num(row && row.earnedUsd),
    verified: !!(row && (row.isVerified || row.verified))
  })).sort((a, b) => (b.boxes - a.boxes) || (b.rips - a.rips) || a.username.localeCompare(b.username))
    .map((row, i) => Object.assign(row, { rank: i + 1 }))
}

function mapTopCoins(raw) {
  const list = Array.isArray(raw && raw.topCoins) ? raw.topCoins : []
  return list.slice(0, 12).map((row, i) => ({
    rank: i + 1,
    symbol: String((row && (row.symbol || row.name)) || '').slice(0, 24),
    rips: Math.max(0, Math.floor(num(row && row.rips)))
  }))
}

function shape(raw, cardsRaw, extra, source) {
  extra = extra || {}
  const levels = Array.isArray(raw && raw.levels) ? raw.levels : []
  const boxes = levels.map(mapLevel)
  const seen = new Set(boxes.map((b) => b.id))
  ;['silver', 'gold'].forEach((id) => {
    if (seen.has(id)) return
    const pack = lookBox(id)
    boxes.push({
      id,
      type: id.toUpperCase() + ' BOX',
      name: id.toUpperCase() + ' BOX',
      color: pack.color,
      hex: pack.hex,
      minted: 0,
      available: 0,
      left: 0,
      soldOut: false,
      inRound: false,
      isNew: false,
      maxSupply: 0,
      maxMultiple: 0,
      priceUsd: 0,
      priceSol: 0,
      artUrl: pack.artLocal,
      remoteArtUrl: null
    })
  })
  const cards = (Array.isArray(cardsRaw) ? cardsRaw : [])
    .map(mapCard)
    .filter((c) => c.type)
    .sort((a, b) => (a.slot || 99) - (b.slot || 99))
  const live = boxes.filter((b) => b.inRound)
  const mintedTotal = live.reduce((n, b) => n + b.minted, 0) || Math.max(0, Math.floor(num(raw && raw.roundPacks)))
  const boxesLeft = live.length ? Math.max.apply(null, live.map((b) => b.left)) : 0
  const aged = (raw && raw.agedPool) || {}
  const snap = (raw && raw.snapshot) || {}
  return {
    updatedAt: new Date().toISOString(),
    source: source || 'trix.market/api/mkt/state + /api/cards',
    round: raw && raw.round != null ? num(raw.round) : null,
    roundStatus: (raw && raw.roundStatus) || null,
    roundEndsAt: (raw && raw.roundEndsAt) || null,
    mintedTotal,
    boxesLeft,
    availableCap: boxesLeft,
    boxes,
    cards,
    rarities: mapRarity(levels[0]),
    leaderboard: extra.leaderboard || [],
    collectors: extra.collectors || [],
    chain: extra.chain || null,
    topCoins: extra.topCoins || [],
    sitemap: extra.sitemap || [],
    public: {
      enabled: !!(raw && raw.enabled),
      network: (raw && raw.network) || null,
      memeNetwork: (raw && raw.memeNetwork) || null,
      tcg: !!(raw && raw.tcg),
      roundFloor: num(raw && raw.roundFloor),
      boxesMinted: mintedTotal,
      boxesLeft,
      memesLeft: Math.max(0, Math.floor(num(raw && raw.memesRemaining))),
      rewardValueUsd: num(raw && raw.rewardValueUsd),
      coverableUsd: num(raw && raw.coverableUsd),
      outstandingLiabilityUsd: num(raw && raw.outstandingLiabilityUsd),
      memePoolFloor: num(raw && raw.memePoolFloor),
      vaultBacked: !!(raw && raw.vaultBacked),
      vaultShortfallLamports: num(raw && raw.vaultShortfallLamports),
      sharedLockCoverageBps: num(raw && raw.sharedLockCoverageBps),
      stakedBoxes: Math.max(0, Math.floor(num(aged.stakedPacks))),
      fundedUsd: num(aged.fundedUsd),
      paidUsd: num(aged.paidUsd),
      owedUsd: num(aged.owedUsd),
      fundedLamports: num(aged.fundedLamports),
      paidLamports: num(aged.paidLamports),
      owedLamports: num(aged.owedLamports),
      memeVault: shortAddr(raw && raw.memeVault),
      vestingVault: shortAddr(raw && raw.vestingVault),
      snapshotAt: snap.generatedAt || null,
      snapshotAgeMs: num(snap.ageMs),
      stale: !!snap.stale
    }
  }
}

function readFallback() {
  return JSON.parse(fs.readFileSync(FALLBACK, 'utf8'))
}

function readWalletCensus() {
  try {
    return JSON.parse(fs.readFileSync(WALLET_CENSUS, 'utf8'))
  } catch (e) {}
  try {
    return require('../assets/data/trix-wallets.json')
  } catch (e2) {
    return null
  }
}

let holderCache = { at: 0, body: null }
const HOLDER_TTL_MS = 60000

function holdersLookComplete(holders, minted) {
  if (!holders || !holders.receipts || !Array.isArray(holders.collectors) || !holders.collectors.length) return false
  const mintedN = Number(minted)
  if (!Number.isFinite(mintedN) || mintedN <= 0) return holders.receipts >= 1000
  return Math.abs(holders.receipts - mintedN) <= 30
}

async function readPackHoldersCached(force) {
  if (!force && holderCache.body && Date.now() - holderCache.at < HOLDER_TTL_MS) return holderCache.body
  const body = await readPackHolders()
  if (body && body.receipts > 0) holderCache = { at: Date.now(), body }
  return body
}

function attachHolderNames(collectors, leaderboard, census) {
  const meta = new Map()
  function add(wallet, username, verified) {
    if (!wallet) return
    const prev = meta.get(wallet) || { username: '', verified: false }
    if (username) prev.username = String(username).slice(0, 32)
    if (verified) prev.verified = true
    meta.set(wallet, prev)
  }
  const known = census && Array.isArray(census.wallets) ? census.wallets : []
  known.forEach((row) => add(row && row.wallet, row && row.username, row && row.verified))
  ;(leaderboard || []).forEach((row) => add(row && row.wallet, row && row.username, row && row.verified))
  return (collectors || []).map((row, i) => {
    const named = meta.get(row.wallet) || {}
    return Object.assign({}, row, {
      rank: i + 1,
      username: named.username || row.username || '',
      verified: !!(named.verified || row.verified)
    })
  })
}

async function applyReceiptHolders(out, meters, force) {
  let holders = null
  try {
    holders = await readPackHoldersCached(!!force)
  } catch (e) {
    holders = null
  }
  if (!holdersLookComplete(holders, meters && meters.boxesMinted)) return out
  const named = attachHolderNames(holders.collectors, meters && meters.leaderboard, readWalletCensus())
  const sum = named.reduce((n, row) => n + (row.boxes || 0), 0)
  out.collectors = named
  out.chain = {
    engine: 'receipts',
    source: 'TRiX BuyPack receipt accounts. One receipt is one sealed box.',
    program: PACK_PROGRAM,
    packConfig: PACK_CONFIG,
    walletsScanned: named.length,
    censusBoxes: sum,
    packMinted: meters && meters.boxesMinted,
    receipts: holders.receipts,
    updatedAt: holders.updatedAt
  }
  return out
}

let liveCache = { at: 0, body: null }
const LIVE_TTL_MS = 25000
const METER_TTL_MS = 20000
const { loadLive, saveLive, HOUR_MS } = require('./lib/trix-live-store')
let meterCache = { at: 0, meters: null }

async function fetchJson(url) {
  const apiRes = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!apiRes.ok) throw new Error('Trix HTTP ' + apiRes.status + ' ' + url)
  return apiRes.json()
}

async function softJson(url) {
  try {
    return await fetchJson(url)
  } catch (e) {
    return null
  }
}

function readFallbackSafe() {
  try {
    return readFallback()
  } catch (e) {
    return null
  }
}

function memesPosted(posts) {
  const row = posts && Array.isArray(posts.posts) ? posts.posts[0] : null
  const n = num(row && row.arrivalSequence)
  return n > 0 ? n : null
}

async function refreshMeters() {
  if (meterCache.meters && Date.now() - meterCache.at < METER_TTL_MS) {
    return meterCache.meters
  }
  const pulledAt = new Date().toISOString()
  const [genesis, posts, launches, packMinted, cards, leaderboard] = await Promise.all([
    softJson('https://www.trix.market/api/mkt/g'),
    softJson('https://www.trix.market/api/posts?limit=1'),
    softJson('https://www.trix.market/api/launches?limit=1'),
    readPackMinted().catch(() => null),
    softJson('https://www.trix.market/api/cards'),
    softJson('https://www.trix.market/api/leaderboard')
  ])
  const unavailable = []
  if (!posts) unavailable.push('memesPosted')
  if (!launches || launches.total == null) unavailable.push('launches')
  if (packMinted == null) unavailable.push('boxesMinted')
  const meters = {
    pulledAt,
    genesis: genesis || null,
    memesPosted: memesPosted(posts),
    memesLatestAt: posts && posts.posts && posts.posts[0] ? posts.posts[0].createdAt : null,
    launches: launches && launches.total != null ? num(launches.total) : null,
    boxesMinted: packMinted != null && packMinted > 0 ? packMinted : null,
    boxesLeft: null,
    memesLeft: null,
    cards: Array.isArray(cards) ? cards : null,
    leaderboard: mapLeaderboard(leaderboard),
    unavailable,
    sources: {
      posts: 'https://www.trix.market/api/posts?limit=1',
      launches: 'https://www.trix.market/api/launches?limit=1',
      genesis: 'https://www.trix.market/api/mkt/g',
      cards: 'https://www.trix.market/api/cards',
      leaderboard: 'https://www.trix.market/api/leaderboard',
      boxes: packMinted != null ? 'solana getAccountInfo ' + PACK_PROGRAM + ' config' : null
    },
    live: {
      memesPosted: memesPosted(posts) != null,
      launches: launches && launches.total != null,
      boxesMinted: packMinted != null && packMinted > 0,
      boxesLeft: false,
      memesLeft: false
    }
  }
  meterCache = { at: Date.now(), meters }
  return meters
}

function applyMeters(base, meters, extra) {
  extra = extra || {}
  const out = Object.assign({}, base || {})
  const publicBase = Object.assign({}, (base && base.public) || {})
  const censusMemes = extra.memesCounted != null ? extra.memesCounted : publicBase.memesCounted
  out.updatedAt = (meters && meters.pulledAt) || new Date().toISOString()
  out.source = extra.source || out.source || 'live TRiX public feeds + BuyPack minted counter'
  if (meters && meters.genesis && meters.genesis.isGenesis) out.roundStatus = 'genesis'
  out.mintedTotal = meters && meters.boxesMinted != null ? meters.boxesMinted : null
  out.boxesLeft = null
  out.availableCap = null
  if (meters && Array.isArray(meters.cards) && meters.cards.length) {
    out.cards = slimCards(meters.cards)
  }
  if (meters && meters.leaderboard && meters.leaderboard.length) {
    out.leaderboard = meters.leaderboard
  }
  out.public = Object.assign({}, publicBase, {
    boxesMinted: meters && meters.boxesMinted != null ? meters.boxesMinted : null,
    boxesLeft: null,
    memesLeft: null,
    memesPosted: meters && meters.memesPosted != null ? meters.memesPosted : null,
    memesLatestAt: meters && meters.memesLatestAt ? meters.memesLatestAt : null,
    memesCounted: censusMemes != null ? censusMemes : null,
    launches: meters && meters.launches != null ? meters.launches : null,
    genesis: meters ? meters.genesis : publicBase.genesis,
    mktStateRetired: true,
    snapshotAt: (meters && meters.pulledAt) || new Date().toISOString(),
    stale: false,
    unavailable: (meters && meters.unavailable) || [],
    live: meters ? meters.live : null,
    countNote:
      'MEMES POSTED = official TRiX /api/posts arrivalSequence (live feed). ' +
      'BOXES ON-CHAIN = TRiX BuyPack minted counter. ' +
      'BOXES LEFT / remaining memes are not published ( /api/mkt/state is 404 ). ' +
      'MEMES COUNTED is the public user-feed census, slower than the feed sequence.'
  })
  out.countVersion = 4
  out.metersPulledAt = meters && meters.pulledAt
  return out
}

async function censusMemesCounted() {
  let memesCounted = null
  try {
    const stored = await loadLive()
    const board = stored && stored.memes
    if (board && board.stats && board.stats.memes != null) memesCounted = num(board.stats.memes)
    else if (board && board.views && Array.isArray(board.views.users)) {
      memesCounted = board.views.users.reduce((n, u) => n + num(u.memes), 0)
    }
  } catch (e) {}
  try {
    const memeFile = dataFile('trix-memes.json')
    const bag = JSON.parse(fs.readFileSync(memeFile, 'utf8'))
    const floor = num(bag.stats && bag.stats.memes)
    if (memesCounted == null || floor > memesCounted) memesCounted = floor || memesCounted
  } catch (e2) {}
  return memesCounted
}

async function refreshLive(reason) {
  const bundled = readFallbackSafe() || {}
  const meters = await refreshMeters()
  const census = readWalletCensus()
  const pointsBoard = (meters && meters.leaderboard) || []
  const bundledCollectors = census && Array.isArray(census.wallets)
    ? census.wallets.filter((w) => (w.boxes || 0) > 0)
    : (Array.isArray(bundled.collectors) ? bundled.collectors : [])

  const collectors = bundledCollectors
  const memesCounted = await censusMemesCounted()
  const types = (Array.isArray(bundled.boxes) ? bundled.boxes : []).map((b) =>
    Object.assign({}, b, { minted: null, available: null, left: null, stale: true })
  )
  const extras = {
    source: 'live TRiX public feeds + BuyPack minted counter (mkt/state 404)',
    memesCounted
  }
  let out = {
    updatedAt: meters.pulledAt,
    source: extras.source,
    round: bundled.round != null ? bundled.round : 1,
    roundStatus: (meters.genesis && meters.genesis.isGenesis ? 'genesis' : bundled.roundStatus) || 'live',
    roundEndsAt: bundled.roundEndsAt || null,
    mintedTotal: meters.boxesMinted,
    boxesLeft: null,
    availableCap: null,
    boxes: types,
    cards: meters.cards && meters.cards.length ? slimCards(meters.cards) : bundled.cards || [],
    rarities: bundled.rarities || [],
    leaderboard: pointsBoard.length ? pointsBoard : bundled.leaderboard || [],
    collectors,
    chain: {
      engine: census ? 'census' : null,
      source: (census && census.source) || null,
      walletsScanned: collectors.length,
      censusBoxes: collectors.reduce((n, r) => n + (r.boxes || 0), 0),
      packMinted: meters.boxesMinted
    },
    topCoins: bundled.topCoins || []
  }
  out = applyMeters(out, meters, extras)
  out = await applyReceiptHolders(out, meters, reason === 'schedule' || reason === 'manual')
  liveCache = { at: Date.now(), body: out }
  try {
    await saveLive({ boxes: out })
  } catch (e) {}
  return out
}

function rankMergedCollectors(list) {
  return (list || [])
    .filter((r) => (r.boxes || 0) > 0)
    .sort((a, b) => (b.boxes - a.boxes) || String(a.username || '').localeCompare(String(b.username || '')))
    .map((row, i) => Object.assign({}, row, { rank: i + 1 }))
}

function slimCards(cards) {
  const list = Array.isArray(cards) ? cards : []
  return list.map((card) => {
    if (!card || typeof card !== 'object') return card
    const copy = Object.assign({}, card)
    delete copy.imageData
    return copy
  })
}

function metersPayload(meters, extra) {
  extra = extra || {}
  const memesCounted = extra.memesCounted
  return {
    ok: true,
    updatedAt: (meters && meters.pulledAt) || new Date().toISOString(),
    metersPulledAt: meters && meters.pulledAt,
    countVersion: 4,
    source: 'live TRiX public feeds + BuyPack minted counter (mkt/state 404)',
    mintedTotal: meters && meters.boxesMinted != null ? meters.boxesMinted : null,
    boxesLeft: null,
    public: {
      boxesMinted: meters && meters.boxesMinted != null ? meters.boxesMinted : null,
      boxesLeft: null,
      memesLeft: null,
      memesPosted: meters && meters.memesPosted != null ? meters.memesPosted : null,
      memesLatestAt: meters && meters.memesLatestAt ? meters.memesLatestAt : null,
      memesCounted: memesCounted != null ? memesCounted : null,
      launches: meters && meters.launches != null ? meters.launches : null,
      genesis: meters ? meters.genesis : null,
      mktStateRetired: true,
      snapshotAt: (meters && meters.pulledAt) || new Date().toISOString(),
      stale: false,
      unavailable: (meters && meters.unavailable) || [],
      live: meters ? meters.live : null,
      countNote:
        'MEMES POSTED = official TRiX /api/posts arrivalSequence. ' +
        'BOXES ON-CHAIN = BuyPack minted counter. BOXES LEFT is not published.'
    }
  }
}

async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'GET only' })
  }
  if (rateLimitOrReject(req, res, { prefix: 'trix-boxes', perMinute: 30, perDay: 800 })) {
    return
  }

  const metersOnly = req.query && (String(req.query.meters) === '1' || String(req.query.fast) === '1')
  res.setHeader('Cache-Control', metersOnly ? 'public, max-age=10' : 'public, max-age=20')

  if (metersOnly) {
    try {
      const meters = await refreshMeters()
      return res.status(200).json(metersPayload(meters))
    } catch (err) {
      return res.status(200).json({
        ok: false,
        stale: true,
        error: String(err && err.message ? err.message : err),
        updatedAt: null,
        mintedTotal: null,
        boxesLeft: null,
        public: {
          boxesMinted: null,
          boxesLeft: null,
          memesPosted: null,
          launches: null,
          unavailable: ['memesPosted', 'launches', 'boxesMinted'],
          stale: true
        }
      })
    }
  }

  if (liveCache.body && Date.now() - liveCache.at < LIVE_TTL_MS) {
    return res.status(200).json(liveCache.body)
  }

  try {
    const force = req.query && String(req.query.refresh) === '1'
    const stored = await loadLive()
    const meters = await refreshMeters()
    const memesCounted = await censusMemesCounted()
    const base = (stored && stored.boxes) || readFallbackSafe() || {}
    if (force) {
      const out = await refreshLive('manual')
      return res.status(200).json(out)
    }
    let out = applyMeters(base, meters, {
      source: 'live TRiX public feeds + BuyPack minted counter (mkt/state 404)',
      memesCounted
    })
    out = await applyReceiptHolders(out, meters, false)
    if (!out.collectors && stored && stored.boxes && stored.boxes.collectors) {
      out.collectors = stored.boxes.collectors
    }
    if (!out.chain && stored && stored.boxes && stored.boxes.chain) {
      out.chain = stored.boxes.chain
    }
    liveCache = { at: Date.now(), body: out }
    return res.status(200).json(out)
  } catch (err) {
    try {
      const stored = await loadLive()
      if (stored && stored.boxes) {
        stored.boxes.fallbackReason = String(err && err.message ? err.message : err)
        return res.status(200).json(stored.boxes)
      }
      const bundled = readFallback()
      return res.status(200).json({
        updatedAt: bundled.updatedAt || null,
        source: (bundled.source || '/assets/data/trix-boxes.json') + ' (fallback)',
        round: bundled.round != null ? bundled.round : null,
        roundStatus: bundled.roundStatus || null,
        mintedTotal: bundled.mintedTotal || 0,
        boxesLeft: bundled.boxesLeft || bundled.availableCap || 0,
        availableCap: bundled.availableCap || 0,
        leaderboard: Array.isArray(bundled.leaderboard) ? bundled.leaderboard : [],
        collectors: Array.isArray(bundled.collectors) ? bundled.collectors : [],
        chain: bundled.chain || null,
        topCoins: Array.isArray(bundled.topCoins) ? bundled.topCoins : [],
        boxes: Array.isArray(bundled.boxes) ? bundled.boxes : [],
        cards: Array.isArray(bundled.cards) ? bundled.cards : [],
        rarities: Array.isArray(bundled.rarities) ? bundled.rarities : [],
        public: bundled.public || null,
        fallbackReason: err.message || String(err)
      })
    } catch (e) {
      return res.status(503).json({ error: 'Trix boxes unavailable', boxes: [] })
    }
  }
}

handler.refreshLive = refreshLive
handler.refreshMeters = refreshMeters
module.exports = handler
