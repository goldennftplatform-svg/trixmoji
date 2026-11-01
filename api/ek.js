'use strict'

/**
 * E.K. marketplace API.
 * GET  /api/ek
 * POST /api/ek { action }
 *   list | hold | pull | confirm | handoff | paypal-order | paypal-capture
 *   bid | offer | answer | feedback | report
 *   escrow-received | escrow-problem | escrow-refund | escrow-drop | escrow-settle
 *
 * Selling requires a DOSWAPZ login (dz_acct).
 * Crypto is paid into the published escrow wallet. PayPal is paid to the seller.
 * DOSWAPZ takes no fee from the principal. The escrow key stays in the operator wallet.
 */

const crypto = require('crypto')
const { rateLimitOrReject } = require('./lib/rate-limit')
const { loadState: loadAccounts } = require('./lib/account-store')
const { readSession } = require('./lib/account-session')
const { withBoard } = require('./lib/ek-store')
const { solRpcUrls } = require('./lib/helius-rpc')
const escrowRules = require('./lib/ek-escrow')

const USDC_SOL = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const USDC_ETH = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const ASSOC_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'

const RAILS = [
  { id: 'sol', label: 'SOL', chain: 'solana', decimals: 9, min: '0.001', max: '1000', symbol: 'SOL' },
  { id: 'usdc-sol', label: 'USDC ON SOLANA', chain: 'solana', decimals: 6, min: '1', max: '100000', symbol: 'USDC' },
  { id: 'eth', label: 'ETH', chain: 'ethereum', decimals: 18, min: '0.0002', max: '100', symbol: 'ETH' },
  { id: 'usdc-eth', label: 'USDC ON ETHEREUM', chain: 'ethereum', decimals: 6, min: '1', max: '100000', symbol: 'USDC' },
  { id: 'paypal', label: 'PAYPAL USD', chain: '', decimals: 2, min: '1', max: '10000', symbol: 'USD' }
]

const BANNED = [
  /\bstolen\b/i,
  /\bcounterfeit\b/i,
  /\bfirearms?\b/i,
  /\bammunition\b/i,
  /\bfentanyl\b/i,
  /\bcocaine\b/i,
  /\bheroin\b/i,
  /\bmeth\b/i,
  /seed phrase/i,
  /private key/i,
  /\bcsam\b/i,
  /child porn/i
]

const SHIPS = { ship: 1, pickup: 1, digital: 1 }
const CARRIERS = { usps: 'USPS', ups: 'UPS', fedex: 'FEDEX', dhl: 'DHL', other: 'OTHER' }
const TREE = [
  { id: 'electronics', label: 'ELECTRONICS', subs: [['elec-phones', 'PHONES'], ['elec-computers', 'COMPUTERS'], ['elec-cameras', 'CAMERAS'], ['elec-audio', 'AUDIO'], ['elec-tv', 'TV AND VIDEO'], ['elec-parts', 'PARTS']] },
  { id: 'clothes', label: 'CLOTHING', subs: [['clothes-men', 'MEN'], ['clothes-women', 'WOMEN'], ['clothes-shoes', 'SHOES'], ['clothes-bags', 'BAGS'], ['clothes-kids', 'KIDS']] },
  { id: 'jewelry', label: 'JEWELRY AND WATCHES', subs: [['jew-fine', 'JEWELRY'], ['jew-watches', 'WATCHES'], ['jew-costume', 'COSTUME']] },
  { id: 'home', label: 'HOME AND GARDEN', subs: [['home-furniture', 'FURNITURE'], ['home-kitchen', 'KITCHEN'], ['home-decor', 'DECOR'], ['home-garden', 'GARDEN'], ['home-appliances', 'APPLIANCES'], ['home-pets', 'PET SUPPLIES']] },
  { id: 'collectibles', label: 'COLLECTIBLES', subs: [['coll-coins', 'COINS'], ['coll-cards', 'CARDS'], ['coll-comics', 'COMICS'], ['coll-vintage', 'VINTAGE'], ['coll-memo', 'MEMORABILIA']] },
  { id: 'art', label: 'ART', subs: [['art-paintings', 'PAINTINGS'], ['art-prints', 'PRINTS'], ['art-sculpture', 'SCULPTURE'], ['art-photo', 'PHOTOGRAPHY']] },
  { id: 'games', label: 'TOYS AND GAMES', subs: [['games-video', 'VIDEO GAMES'], ['games-consoles', 'CONSOLES'], ['games-board', 'BOARD GAMES'], ['games-toys', 'TOYS']] },
  { id: 'sport', label: 'SPORTING', subs: [['sport-bikes', 'BIKES'], ['sport-fitness', 'FITNESS'], ['sport-outdoor', 'OUTDOOR'], ['sport-team', 'TEAM SPORTS']] },
  { id: 'tools', label: 'TOOLS', subs: [['tools-hand', 'HAND TOOLS'], ['tools-power', 'POWER TOOLS'], ['tools-shop', 'WORKSHOP']] },
  { id: 'vehicles', label: 'VEHICLES', subs: [['veh-cars', 'CARS'], ['veh-moto', 'MOTORCYCLES'], ['veh-parts', 'PARTS'], ['veh-boats', 'BOATS']] },
  { id: 'music', label: 'MUSIC', subs: [['music-instruments', 'INSTRUMENTS'], ['music-records', 'RECORDS'], ['music-pro', 'PRO AUDIO']] },
  { id: 'books', label: 'BOOKS', subs: [['books-fiction', 'FICTION'], ['books-nonfiction', 'NONFICTION'], ['books-mags', 'MAGAZINES']] },
  { id: 'baby', label: 'BABY', subs: [['baby-gear', 'GEAR'], ['baby-clothes', 'CLOTHES']] },
  { id: 'business', label: 'BUSINESS', subs: [['biz-office', 'OFFICE'], ['biz-industrial', 'INDUSTRIAL']] },
  { id: 'other', label: 'OTHER', subs: [['other-misc', 'EVERYTHING ELSE']] }
]
const DEPTS = {}
const LEAVES = {}
TREE.forEach(function (dept) {
  DEPTS[dept.id] = dept.label
  dept.subs.forEach(function (sub) {
    LEAVES[sub[0]] = { dept: dept.id, deptLabel: dept.label, label: sub[1] }
  })
})
const CONDITIONS = {
  new: 'NEW',
  'like-new': 'LIKE NEW',
  used: 'USED',
  parts: 'FOR PARTS'
}
const AUCTION_DAYS = [1, 3, 7, 10]

function placeOf(id) {
  const key = String(id || '')
  if (LEAVES[key]) {
    const leaf = LEAVES[key]
    return {
      dept: leaf.dept,
      deptLabel: leaf.deptLabel,
      category: key,
      categoryLabel: leaf.deptLabel + ' · ' + leaf.label
    }
  }
  if (DEPTS[key]) {
    return { dept: key, deptLabel: DEPTS[key], category: key, categoryLabel: DEPTS[key] }
  }
  return { dept: 'other', deptLabel: 'OTHER', category: 'other', categoryLabel: 'OTHER' }
}

function auctionEnded(row, now) {
  if (!row || row.mode !== 'auction') return false
  const end = Date.parse(row.endsAt || '')
  return !!end && now >= end
}
const REASONS = {
  prohibited: 'PROHIBITED ITEM',
  stolen: 'STOLEN',
  counterfeit: 'COUNTERFEIT',
  scam: 'SCAM',
  'not-as-described': 'NOT AS DESCRIBED',
  harassment: 'HARASSMENT'
}
const HOLD_CRYPTO_MS = 15 * 60 * 1000
const HOLD_PAYPAL_MS = 20 * 60 * 1000

function noStore(res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
}

function fail(res, code, error, extra) {
  res.status(code).json(Object.assign({ ok: false, error: error }, extra || {}))
}

function railById(id) {
  for (let i = 0; i < RAILS.length; i++) if (RAILS[i].id === id) return RAILS[i]
  return null
}

function toUnits(amount, decimals, allowZero) {
  const s = String(amount == null ? '' : amount).trim()
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const parts = s.split('.')
  const whole = parts[0]
  const frac = parts[1] || ''
  if (whole.length > 1 && whole.charAt(0) === '0') return null
  if (whole.length > 12) return null
  if (frac.length > decimals) return null
  const digits = whole + (frac + '0'.repeat(decimals)).slice(0, decimals)
  let units
  try {
    units = BigInt(digits)
  } catch (e) {
    return null
  }
  if (units < 0n) return null
  if (units === 0n) return allowZero ? '0' : null
  return units.toString()
}

function displayAmount(units, decimals, railId) {
  const n = BigInt(units)
  if (railId === 'paypal') {
    return (n / 100n).toString() + '.' + (n % 100n).toString().padStart(2, '0')
  }
  const raw = n.toString().padStart(decimals + 1, '0')
  const cut = raw.length - decimals
  const whole = raw.slice(0, cut)
  const frac = raw.slice(cut).replace(/0+$/, '')
  return frac ? whole + '.' + frac : whole
}

function cleanLine(raw, max) {
  return String(raw || '')
    .replace(/[\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim()
}

function cleanBlock(raw, max) {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max)
    .trim()
}

function isBanned(text) {
  return BANNED.some(function (re) {
    return re.test(text)
  })
}

function bs58lib() {
  const mod = require('bs58')
  if (mod && typeof mod.decode === 'function') return mod
  if (mod && mod.default && typeof mod.default.decode === 'function') return mod.default
  return mod
}

function canonicalSolana(address) {
  try {
    const bs58 = bs58lib()
    const pub = Buffer.from(bs58.decode(String(address || '').trim()))
    if (pub.length !== 32) return ''
    return bs58.encode(pub)
  } catch (e) {
    return ''
  }
}

function canonicalEthereum(address) {
  try {
    const { ethers } = require('ethers')
    return ethers.utils.getAddress(String(address || '').trim())
  } catch (e) {
    return ''
  }
}

function canonicalPayout(rail, raw) {
  if (!rail) return ''
  if (rail.id === 'paypal') return paypalEmail(raw)
  if (rail.chain === 'solana') return canonicalSolana(raw)
  if (rail.chain === 'ethereum') return canonicalEthereum(raw)
  return ''
}

function paypalEmail(raw) {
  const email = String(raw || '').trim().toLowerCase()
  if (email.length < 6 || email.length > 254) return ''
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return ''
  return email
}

function maskEmail(email) {
  const at = String(email || '').indexOf('@')
  if (at < 1) return ''
  return email.slice(0, 1) + '***@' + email.slice(at + 1)
}

function shortAddr(addr) {
  const s = String(addr || '')
  if (s.length < 12) return s
  return s.slice(0, 4) + '…' + s.slice(-4)
}

function escrowAddress(chain) {
  if (chain === 'solana') return canonicalSolana(process.env.EK_ESCROW_SOL || escrowRules.DEFAULTS.solana)
  if (chain === 'ethereum') return canonicalEthereum(process.env.EK_ESCROW_ETH || escrowRules.DEFAULTS.ethereum)
  if (chain === 'bitcoin') return escrowRules.canonicalBitcoin(process.env.EK_ESCROW_BTC || escrowRules.DEFAULTS.bitcoin)
  return ''
}

function escrowPublic() {
  const sol = escrowAddress('solana')
  const eth = escrowAddress('ethereum')
  const btc = escrowAddress('bitcoin')
  return {
    sol: sol,
    eth: eth,
    btc: btc,
    solArmed: !!sol,
    ethArmed: !!eth,
    btcArmed: !!btc,
    btcRail: false,
    fee: '0',
    shipDays: 3,
    quietDays: 3,
    yield: 'DOSWAPZ keeps any yield on funds while they sit in escrow. The sale amount is paid in full. There is no DOSWAPZ fee.'
  }
}

function paypalBase() {
  const set = String(process.env.PAYPAL_API_BASE || '').trim().replace(/\/+$/, '')
  if (set) return set
  if (String(process.env.PAYPAL_MODE || '').toLowerCase() === 'live') return 'https://api-m.paypal.com'
  return 'https://api-m.sandbox.paypal.com'
}

function paypalArmed() {
  return !!(String(process.env.PAYPAL_CLIENT_ID || '').trim() && String(process.env.PAYPAL_CLIENT_SECRET || '').trim())
}

function paypalMode() {
  return paypalBase().indexOf('sandbox') >= 0 ? 'sandbox' : 'live'
}

function hashKey(key) {
  return crypto.createHash('sha256').update(String(key || '')).digest('hex')
}

function holdKeyOk(raw) {
  return typeof raw === 'string' && /^[A-Za-z0-9]{16,64}$/.test(raw)
}

function photoOk(raw) {
  const s = String(raw || '')
  if (!s) return ''
  if (s.length > 50000) return null
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(s)) return null
  return s
}

function rowPhotos(row) {
  const src = row && Array.isArray(row.photos) && row.photos.length ? row.photos : (row && row.photo ? [row.photo] : [])
  const out = []
  src.forEach(function (item) {
    const one = photoOk(item)
    if (one) out.push(one)
  })
  return out
}

function photosOk(raw) {
  if (raw == null || raw === '') return []
  if (!Array.isArray(raw)) return null
  if (raw.length > 12) return null
  const out = []
  for (let i = 0; i < raw.length; i++) {
    const one = photoOk(raw[i])
    if (one == null) return null
    if (one) out.push(one)
  }
  return out
}

function requestHost(req) {
  const h = req.headers || {}
  let host = String(h['x-forwarded-host'] || h['X-Forwarded-Host'] || h.host || h.Host || '')
  host = host.split(',')[0].trim().toLowerCase()
  if (!/^[a-z0-9.-]+(?::\d+)?$/.test(host)) return ''
  return host
}

function siteBase(req) {
  const host = requestHost(req)
  if (host.indexOf('127.0.0.1') === 0 || host.indexOf('localhost') === 0) return 'http://' + host
  return 'https://doswapz.com'
}

function walletOn(user, chain) {
  const rows = (user && user.wallets) || []
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] && rows[i].chain === chain && rows[i].address) return rows[i].address
  }
  return ''
}

function publicMe(user) {
  if (!user) return null
  const wallets = Array.isArray(user.wallets)
    ? user.wallets.map(function (w) {
        return { chain: w.chain, address: w.address }
      })
    : []
  return {
    method: user.method || '',
    email: user.email ? maskEmail(user.email) : '',
    wallets: wallets
  }
}

async function currentUser(req) {
  const session = readSession(req)
  if (!session) return null
  const state = await loadAccounts()
  if (!state || !state.users) return null
  const user = state.users[session.uid]
  if (!user) return null
  return user
}

function holdActive(row, now) {
  return !!(row && row.holdUntil && Number(row.holdUntil) > now && row.holdKeyHash)
}

function readShipTo(raw) {
  if (!raw || typeof raw !== 'object') return null
  const name = cleanLine(raw.name, 80)
  const line1 = cleanLine(raw.line1, 120)
  const line2 = cleanLine(raw.line2, 120)
  const city = cleanLine(raw.city, 80)
  const region = cleanLine(raw.region, 80)
  const postal = cleanLine(raw.postal, 20)
  const country = cleanLine(raw.country, 56)
  if (name.length < 2 || line1.length < 4 || city.length < 2) return null
  if (region.length < 2 || postal.length < 2 || country.length < 2) return null
  return { name: name, line1: line1, line2: line2, city: city, region: region, postal: postal, country: country }
}

function openCount(list) {
  return (list || []).filter(function (entry) { return entry && entry.state === 'open' }).length
}

function highBidPublic(row) {
  const rows = (row.bids || []).filter(function (entry) {
    return entry && (entry.state === 'open' || entry.state === 'accepted')
  })
  if (!rows.length) return null
  rows.sort(function (a, b) {
    const av = BigInt(a.units)
    const bv = BigInt(b.units)
    if (av === bv) return 0
    return av > bv ? -1 : 1
  })
  return { amount: rows[0].amount, state: rows[0].state }
}

function publicEntries(list, uid, showAll) {
  return (list || []).filter(function (entry) {
    if (!entry || entry.state === 'declined') return false
    if (showAll || entry.state === 'accepted') return true
    return !!(uid && entry.uid === uid)
  }).slice(-12).map(function (entry) {
    return {
      id: entry.id,
      amount: entry.amount,
      note: entry.note || '',
      at: entry.at,
      state: entry.state,
      mine: !!(uid && entry.uid === uid)
    }
  })
}

function publicFeedback(row, uid) {
  return (row.feedback || []).slice(-12).map(function (entry) {
    return {
      role: entry.role === 'seller' ? 'seller' : 'buyer',
      score: entry.score,
      note: entry.note || '',
      at: entry.at,
      mine: !!(uid && entry.uid === uid)
    }
  })
}

function canFeedback(row, uid) {
  if (!uid || !row) return false
  if (row.status !== 'sold' && row.status !== 'refunded') return false
  if (row.rail !== 'paypal' && row.escrowPhase && row.escrowPhase !== 'settled') return false
  if (uid !== row.sellerUid && uid !== row.buyerUid) return false
  return !(row.feedback || []).some(function (entry) { return entry && entry.uid === uid })
}

function feedbackTotals(state) {
  const map = {}
  ;(state.listings || []).forEach(function (row) {
    if (!row || !row.sellerUid) return
    if (!map[row.sellerUid]) map[row.sellerUid] = { up: 0, mid: 0, down: 0 }
    ;(row.feedback || []).forEach(function (entry) {
      if (!entry || entry.role !== 'buyer') return
      if (entry.score === 'up') map[row.sellerUid].up += 1
      else if (entry.score === 'down') map[row.sellerUid].down += 1
      else if (entry.score === 'mid') map[row.sellerUid].mid += 1
    })
  })
  return map
}

function moneyUnits(row, amount) {
  const rail = railById(row.rail)
  if (!rail) return null
  const units = toUnits(amount, rail.decimals)
  if (!units) return null
  const got = BigInt(units)
  const lo = BigInt(toUnits(rail.min, rail.decimals))
  const hi = BigInt(toUnits(rail.max, rail.decimals))
  if (got < lo || got > hi) return null
  return units
}

function applyPrice(row, units) {
  const rail = railById(row.rail)
  const ship = BigInt(row.shipUnits || '0')
  const pay = BigInt(units) + ship
  const hi = BigInt(toUnits(rail.max, rail.decimals))
  if (pay > hi) return 'high'
  row.units = String(units)
  row.amount = displayAmount(String(units), rail.decimals, rail.id)
  row.payUnits = pay.toString()
  row.payAmount = displayAmount(pay.toString(), rail.decimals, rail.id)
  row.updatedAt = new Date().toISOString()
  return ''
}

function publicListing(row, uid, withPhotos, stats) {
  const rail = railById(row.rail)
  const now = Date.now()
  const place = placeOf(row.category)
  const payout = String(row.payout || '')
  const photos = rowPhotos(row)
  const pub = {
    id: row.id,
    status: row.status,
    title: row.title,
    description: row.description || '',
    rail: row.rail,
    symbol: rail ? rail.symbol : '',
    label: rail ? rail.label : '',
    chain: row.chain || '',
    amount: row.amount,
    units: row.units,
    shipAmount: row.shipAmount || '0',
    shipUnits: row.shipUnits || '0',
    payAmount: row.payAmount || row.amount,
    payUnits: row.payUnits || row.units,
    payout: payout,
    payoutShort: row.rail === 'paypal' ? maskEmail(payout) : shortAddr(payout),
    ship: row.ship,
    shipFrom: row.shipFrom || '',
    shipNote: row.shipNote || '',
    carrier: row.carrier || '',
    tracking: row.tracking || '',
    shippedAt: row.shippedAt || '',
    shipTo: uid && row.sellerUid === uid && (row.status === 'sold' || row.status === 'escrow') && row.shipTo ? row.shipTo : null,
    photo: photos[0] || '',
    photoCount: photos.length,
    createdAt: row.createdAt,
    soldAt: row.soldAt || '',
    tx: row.tx || '',
    handoffNote: row.handoffNote || '',
    busy: holdActive(row, now),
    holdUntil: holdActive(row, now) ? row.holdUntil : 0,
    mine: !!(uid && row.sellerUid === uid),
    dept: place.dept,
    deptLabel: place.deptLabel,
    category: place.category,
    categoryLabel: place.categoryLabel,
    condition: CONDITIONS[row.condition] ? row.condition : '',
    conditionLabel: CONDITIONS[row.condition] || '',
    endsAt: row.endsAt || '',
    ended: auctionEnded(row, now),
    mode: row.mode === 'auction' ? 'auction' : 'fixed',
    deal: row.deal === 'accepted' ? 'accepted' : '',
    highBid: highBidPublic(row),
    bidCount: openCount(row.bids),
    offerCount: openCount(row.offers),
    bids: publicEntries(row.bids, uid, true),
    offers: publicEntries(row.offers, uid, !!(uid && row.sellerUid === uid)),
    feedback: publicFeedback(row, uid),
    sellerScore: stats || { up: 0, mid: 0, down: 0 },
    canFeedback: canFeedback(row, uid),
    reported: !!(uid && (row.reports || []).some(function (entry) { return entry && entry.uid === uid })),
    escrow: row.escrow || '',
    settleTx: row.settleTx || '',
    escrowPhase: row.escrowPhase || '',
    escrowNotice: row.escrowNotice || '',
    escrowAt: row.escrowAt || '',
    proofAt: row.proofAt || '',
    shipBy: escrowRules.shipBy(row),
    quietUntil: escrowRules.quietUntil(row),
    releaseTo: row.releaseTo || '',
    releaseUnits: row.releaseUnits || '',
    releaseAddress: releasePublic(row),
    dispute: row.escrowPhase === 'disputed' ? (escrowRules.DISPUTES[row.disputeReason] || '') : '',
    buyerSide: !!(uid && row.buyerUid && row.buyerUid === uid),
    fee: '0'
  }
  if (withPhotos) pub.photos = photos
  return pub
}

function releasePublic(row) {
  const phase = row && row.escrowPhase
  if (phase !== 'release' && phase !== 'refund' && phase !== 'settled') return ''
  return String(row.releaseAddress || '')
}

function visible(state, uid) {
  const open = []
  const sold = []
  state.listings.forEach(function (row) {
    if (!row || row.status === 'pulled') return
    if (row.status === 'sold' || row.status === 'escrow' || row.status === 'refunded') sold.push(row)
    else if (row.status === 'open') open.push(row)
  })
  open.sort(function (a, b) {
    return String(b.createdAt).localeCompare(String(a.createdAt))
  })
  sold.sort(function (a, b) {
    return String(b.soldAt || '').localeCompare(String(a.soldAt || ''))
  })
  const stats = feedbackTotals(state)
  return open.concat(sold.slice(0, 24)).map(function (row) {
    return publicListing(row, uid, false, stats[row.sellerUid])
  })
}

function findRow(state, id) {
  const want = String(id || '')
  for (let i = 0; i < state.listings.length; i++) {
    if (state.listings[i] && state.listings[i].id === want) return state.listings[i]
  }
  return null
}

function prune(state) {
  const sold = state.listings.filter(function (row) {
    return row && (row.status === 'sold' || row.status === 'refunded')
  })
  sold.sort(function (a, b) {
    return String(b.soldAt || '').localeCompare(String(a.soldAt || ''))
  })
  const keepSold = {}
  sold.slice(0, 80).forEach(function (row) {
    keepSold[row.id] = 1
  })
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
  state.listings = state.listings.filter(function (row) {
    if (!row) return false
    if (row.status === 'escrow') return true
    if (row.escrowPhase && row.escrowPhase !== 'settled') return true
    if (row.status === 'sold' || row.status === 'refunded') return !!keepSold[row.id]
    if (row.status === 'pulled') return Date.parse(row.updatedAt || row.createdAt || 0) > cutoff
    return true
  })
  const liveTx = {}
  state.listings.forEach(function (row) {
    if (!row) return
    if (row.tx) liveTx[row.tx] = 1
    if (row.settleTx) liveTx[row.settleTx] = 1
  })
  Object.keys(state.usedTx).forEach(function (key) {
    if (!liveTx[key] && state.usedTx[key]) delete state.usedTx[key]
  })
  return state
}

function configBody() {
  return {
    ok: true,
    name: 'E.K.',
    sample: false,
    paypal: { armed: paypalArmed(), mode: paypalMode() },
    escrow: escrowPublic(),
    rails: RAILS,
    categories: TREE.map(function (dept) {
      return {
        id: dept.id,
        label: dept.label,
        subs: dept.subs.map(function (sub) { return { id: sub[0], label: sub[1] } })
      }
    }),
    conditions: Object.keys(CONDITIONS).map(function (id) { return { id: id, label: CONDITIONS[id] } }),
    auctionDays: AUCTION_DAYS,
    reasons: Object.keys(REASONS).map(function (id) { return { id: id, label: REASONS[id] } }),
    usdcSol: USDC_SOL,
    usdcEth: USDC_ETH,
    tokenProgram: TOKEN_PROGRAM,
    assocProgram: ASSOC_PROGRAM
  }
}

function takeHold(row, holdKey, ms) {
  const now = Date.now()
  if (!row || row.status === 'sold' || row.status === 'escrow' || row.status === 'refunded') return 'sold'
  if (row.status === 'pulled') return 'pulled'
  if (row.status !== 'open') return 'closed'
  const hash = hashKey(holdKey)
  if (holdActive(row, now) && row.holdKeyHash !== hash) return 'busy'
  row.holdKeyHash = hash
  row.holdUntil = now + ms
  row.updatedAt = new Date().toISOString()
  return 'ok'
}

function holdMatches(row, holdKey) {
  const now = Date.now()
  if (!holdActive(row, now)) return true
  return row.holdKeyHash === hashKey(holdKey)
}

let paypalTok = { token: '', exp: 0, base: '' }

async function paypalToken() {
  const base = paypalBase()
  const now = Date.now()
  if (paypalTok.token && paypalTok.base === base && paypalTok.exp > now + 15000) return paypalTok.token
  const id = String(process.env.PAYPAL_CLIENT_ID || '').trim()
  const secret = String(process.env.PAYPAL_CLIENT_SECRET || '').trim()
  const res = await fetch(base + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(12000)
  })
  const data = await res.json().catch(function () {
    return {}
  })
  if (!res.ok || !data.access_token) {
    const err = new Error('PayPal did not arm.')
    err.detail = data
    throw err
  }
  paypalTok = {
    token: data.access_token,
    exp: now + Math.max(30, Number(data.expires_in || 300) - 30) * 1000,
    base: base
  }
  return paypalTok.token
}

async function paypalCall(path, method, body) {
  const token = await paypalToken()
  const res = await fetch(paypalBase() + path, {
    method: method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000)
  })
  const data = await res.json().catch(function () {
    return {}
  })
  if (!res.ok) {
    const detail = data && data.details && data.details[0]
    const msg = (detail && (detail.description || detail.issue)) || data.message || data.error_description || 'PayPal refused this order.'
    const err = new Error(msg)
    err.detail = data
    throw err
  }
  return data
}

function accountKeys(tx) {
  const msg = tx && tx.transaction && tx.transaction.message
  const keys = (msg && msg.accountKeys) || []
  return keys.map(function (key) {
    if (typeof key === 'string') return { pubkey: key, signer: false }
    return { pubkey: String(key.pubkey || ''), signer: !!key.signer }
  })
}

function balanceDelta(tx, address) {
  const keys = accountKeys(tx)
  const pre = (tx.meta && tx.meta.preBalances) || []
  const post = (tx.meta && tx.meta.postBalances) || []
  let delta = 0n
  let signer = false
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].pubkey !== address) continue
    if (keys[i].signer) signer = true
    delta += BigInt(post[i] || 0) - BigInt(pre[i] || 0)
  }
  return { delta: delta, signer: signer }
}

function tokenDelta(tx, owner, mint) {
  function sum(rows) {
    let total = 0n
    ;(rows || []).forEach(function (row) {
      if (!row || row.owner !== owner || row.mint !== mint) return
      const amt = row.uiTokenAmount && row.uiTokenAmount.amount
      if (amt == null) return
      total += BigInt(String(amt))
    })
    return total
  }
  const meta = tx.meta || {}
  return sum(meta.postTokenBalances) - sum(meta.preTokenBalances)
}

async function solanaTx(sig) {
  const { Connection } = require('@solana/web3.js')
  const urls = solRpcUrls()
  let last = null
  for (let i = 0; i < urls.length; i++) {
    try {
      const conn = new Connection(urls[i], 'confirmed')
      const tx = await conn.getParsedTransaction(sig, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      })
      if (tx) return tx
    } catch (e) {
      last = e
    }
  }
  if (last) throw last
  return null
}

async function ethProvider() {
  const { ethers } = require('ethers')
  const urls = [
    process.env.ETH_RPC_URL,
    'https://ethereum-rpc.publicnode.com',
    'https://rpc.ankr.com/eth',
    'https://cloudflare-eth.com'
  ].filter(Boolean)
  let last = null
  for (let i = 0; i < urls.length; i++) {
    try {
      const provider = new ethers.providers.StaticJsonRpcProvider(urls[i], { chainId: 1, name: 'homestead' })
      await provider.getBlockNumber()
      return provider
    } catch (e) {
      last = e
    }
  }
  throw last || new Error('Ethereum did not answer.')
}

async function verifyPayment(row, txid, buyer) {
  const units = BigInt(row.payUnits || row.units)
  const created = Date.parse(row.createdAt || 0)
  if (row.rail === 'sol' || row.rail === 'usdc-sol') {
    const sig = canonicalSolana(txid) ? txid : String(txid || '').trim()
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(sig)) return { ok: false, error: 'That is not a Solana signature.' }
    const from = canonicalSolana(buyer)
    if (!from) return { ok: false, error: 'Connect the Solana wallet that paid.' }
    const tx = await solanaTx(sig)
    if (!tx) return { ok: false, error: 'That Solana payment is not confirmed yet.' }
    if (tx.meta && tx.meta.err) return { ok: false, error: 'That Solana payment failed.' }
    const when = Number(tx.blockTime || 0) * 1000
    if (!when || when + 120000 < created) return { ok: false, error: 'That payment is older than the listing.' }
    const payer = balanceDelta(tx, from)
    if (!payer.signer) return { ok: false, error: 'The paying wallet did not sign this transaction.' }
    const pot = row.escrow || ''
    if (!pot) return { ok: false, error: 'Crypto escrow is not armed on this server.' }
    if (row.rail === 'sol') {
      const seller = balanceDelta(tx, pot)
      if (seller.delta !== units) return { ok: false, error: 'The escrow wallet did not receive this exact SOL amount.' }
      if (payer.delta > -units) return { ok: false, error: 'The paying wallet did not spend this SOL amount.' }
    } else {
      const got = tokenDelta(tx, pot, USDC_SOL)
      const spent = tokenDelta(tx, from, USDC_SOL)
      if (got !== units) return { ok: false, error: 'The escrow wallet did not receive this exact USDC amount.' }
      if (spent !== -units) return { ok: false, error: 'The paying wallet did not spend this USDC amount.' }
    }
    return { ok: true, tx: sig, buyer: from }
  }

  const { ethers } = require('ethers')
  const hash = String(txid || '').trim()
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) return { ok: false, error: 'That is not an Ethereum transaction.' }
  let from = ''
  try {
    from = ethers.utils.getAddress(buyer)
  } catch (e) {
    return { ok: false, error: 'Connect the Ethereum wallet that paid.' }
  }
  const provider = await ethProvider()
  const tx = await provider.getTransaction(hash)
  const receipt = tx ? await provider.getTransactionReceipt(hash) : null
  if (!tx || !receipt) return { ok: false, error: 'That Ethereum payment is not confirmed yet.' }
  if (Number(receipt.status) !== 1) return { ok: false, error: 'That Ethereum payment failed.' }
  if (ethers.utils.getAddress(tx.from) !== from) return { ok: false, error: 'The paying wallet did not send this transaction.' }
  if (!tx.to) return { ok: false, error: 'This payment did not go to escrow.' }
  const block = await provider.getBlock(receipt.blockNumber)
  const when = Number(block && block.timestamp ? block.timestamp : 0) * 1000
  if (!when || when + 120000 < created) return { ok: false, error: 'That payment is older than the listing.' }
  const pot = row.escrow || ''
  if (!pot) return { ok: false, error: 'Crypto escrow is not armed on this server.' }
  if (row.rail === 'eth') {
    if (ethers.utils.getAddress(tx.to) !== pot) return { ok: false, error: 'This payment did not go to the escrow wallet.' }
    if (tx.value.toString() !== units.toString()) return { ok: false, error: 'This payment is not the listing amount.' }
  } else {
    if (ethers.utils.getAddress(tx.to) !== ethers.utils.getAddress(USDC_ETH)) {
      return { ok: false, error: 'This payment is not a USDC transfer.' }
    }
    const iface = new ethers.utils.Interface(['function transfer(address to, uint256 amount)'])
    let decoded
    try {
      decoded = iface.decodeFunctionData('transfer', tx.data)
    } catch (e2) {
      return { ok: false, error: 'This payment is not a USDC transfer.' }
    }
    if (ethers.utils.getAddress(decoded.to) !== pot) return { ok: false, error: 'This USDC did not go to the escrow wallet.' }
    if (decoded.amount.toString() !== units.toString()) return { ok: false, error: 'This USDC amount does not match the listing.' }
  }
  return { ok: true, tx: hash, buyer: from }
}

function solSigner(tx, address) {
  const keys = accountKeys(tx)
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].pubkey === address && keys[i].signer) return true
  }
  return false
}

async function verifyPayout(row, txid) {
  const units = BigInt(row.releaseUnits || '0')
  const owed = BigInt(row.payUnits || row.units || '0')
  if (units !== owed || units <= 0n) return { ok: false, error: 'The release is not the full sale amount.' }
  const dest = String(row.releaseAddress || '')
  const pot = row.escrow || escrowAddress(row.chain)
  if (!pot || !dest) return { ok: false, error: 'This escrow payout has no wallet.' }
  if (dest === pot) return { ok: false, error: 'The payout cannot go back to the escrow wallet.' }
  const opened = Date.parse(row.escrowAt || 0)

  if (row.rail === 'sol' || row.rail === 'usdc-sol') {
    const sig = String(txid || '').trim()
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(sig)) return { ok: false, error: 'That is not a Solana signature.' }
    const to = canonicalSolana(dest)
    if (!to) return { ok: false, error: 'The payout address is not a Solana address.' }
    const tx = await solanaTx(sig)
    if (!tx) return { ok: false, error: 'That payout is not confirmed yet.' }
    if (tx.meta && tx.meta.err) return { ok: false, error: 'That payout failed.' }
    const when = Number(tx.blockTime || 0) * 1000
    if (!when || when + 120000 < opened) return { ok: false, error: 'That payout is older than the escrow.' }
    if (!solSigner(tx, pot)) return { ok: false, error: 'The escrow wallet did not sign this payout.' }
    if (row.rail === 'sol') {
      if (balanceDelta(tx, to).delta !== units) return { ok: false, error: 'The payout is not the full SOL amount.' }
    } else {
      if (tokenDelta(tx, to, USDC_SOL) !== units) return { ok: false, error: 'The payout is not the full USDC amount.' }
      if (tokenDelta(tx, pot, USDC_SOL) !== -units) return { ok: false, error: 'The escrow wallet did not spend this USDC amount.' }
    }
    return { ok: true, tx: sig }
  }

  const { ethers } = require('ethers')
  const hash = String(txid || '').trim()
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) return { ok: false, error: 'That is not an Ethereum transaction.' }
  let to = ''
  try {
    to = ethers.utils.getAddress(dest)
  } catch (e) {
    return { ok: false, error: 'The payout address is not an Ethereum address.' }
  }
  const provider = await ethProvider()
  const tx = await provider.getTransaction(hash)
  const receipt = tx ? await provider.getTransactionReceipt(hash) : null
  if (!tx || !receipt) return { ok: false, error: 'That payout is not confirmed yet.' }
  if (Number(receipt.status) !== 1) return { ok: false, error: 'That payout failed.' }
  if (ethers.utils.getAddress(tx.from) !== pot) return { ok: false, error: 'The escrow wallet did not send this payout.' }
  const block = await provider.getBlock(receipt.blockNumber)
  const when = Number(block && block.timestamp ? block.timestamp : 0) * 1000
  if (!when || when + 120000 < opened) return { ok: false, error: 'That payout is older than the escrow.' }
  if (row.rail === 'eth') {
    if (!tx.to || ethers.utils.getAddress(tx.to) !== to) return { ok: false, error: 'This payout did not go to the right wallet.' }
    if (tx.value.toString() !== units.toString()) return { ok: false, error: 'This payout is not the full ETH amount.' }
  } else {
    if (!tx.to || ethers.utils.getAddress(tx.to) !== ethers.utils.getAddress(USDC_ETH)) {
      return { ok: false, error: 'This payout is not a USDC transfer.' }
    }
    const iface = new ethers.utils.Interface(['function transfer(address to, uint256 amount)'])
    let decoded
    try {
      decoded = iface.decodeFunctionData('transfer', tx.data)
    } catch (e2) {
      return { ok: false, error: 'This payout is not a USDC transfer.' }
    }
    if (ethers.utils.getAddress(decoded.to) !== to) return { ok: false, error: 'This USDC did not go to the right wallet.' }
    if (decoded.amount.toString() !== units.toString()) return { ok: false, error: 'This payout is not the full USDC amount.' }
  }
  return { ok: true, tx: hash }
}

async function handler(req, res) {
  noStore(res)
  if (req.method === 'GET') {
    if (rateLimitOrReject(req, res, { prefix: 'ek-read', perMinute: 60, perDay: 4000 })) return
    try {
      const user = await currentUser(req)
      const state = await withBoard(async function (board) {
        return escrowRules.advanceAll(board.listings, Date.now()) ? board : null
      })
      const want = String((req.query && req.query.id) || '')
      if (want) {
        if (!/^[a-f0-9]{16}$/.test(want)) return fail(res, 400, 'That listing is not on the board.')
        const row = findRow(state, want)
        if (!row || row.status === 'pulled') return fail(res, 404, 'That listing is not on the board.')
        const stats = feedbackTotals(state)
        return res.status(200).json({ ok: true, listing: publicListing(row, user && user.uid, true, stats[row.sellerUid]) })
      }
      const body = configBody()
      body.me = publicMe(user)
      body.escrowBooks = escrowRules.books(state.listings)
      body.listings = visible(state, user && user.uid)
      return res.status(200).json(body)
    } catch (e) {
      return fail(res, 503, 'E.K. is not available on this server.')
    }
  }

  if (req.method !== 'POST') return fail(res, 405, 'GET or POST')
  if (rateLimitOrReject(req, res, { prefix: 'ek-post', perMinute: 20, perDay: 400 })) return

  const body = req.body && typeof req.body === 'object' && !bodyRaw(req.body) ? req.body : {}
  const action = String(body.action || '')

  try {
    if (action === 'list') return await postList(req, res, body)
    if (action === 'hold') return await postHold(req, res, body)
    if (action === 'pull') return await postPull(req, res, body)
    if (action === 'confirm') return await postConfirm(req, res, body)
    if (action === 'handoff') return await postHandoff(req, res, body)
    if (action === 'paypal-order') return await postPaypalOrder(req, res, body)
    if (action === 'paypal-capture') return await postPaypalCapture(req, res, body)
    if (action === 'bid') return await postBid(req, res, body)
    if (action === 'offer') return await postOffer(req, res, body)
    if (action === 'answer') return await postAnswer(req, res, body)
    if (action === 'feedback') return await postFeedback(req, res, body)
    if (action === 'report') return await postReport(req, res, body)
    if (action === 'escrow-received') return await postEscrowReceived(req, res, body)
    if (action === 'escrow-problem') return await postEscrowProblem(req, res, body)
    if (action === 'escrow-refund') return await postEscrowRefund(req, res, body)
    if (action === 'escrow-drop') return await postEscrowDrop(req, res, body)
    if (action === 'escrow-settle') return await postEscrowSettle(req, res, body)
    return fail(res, 400, 'Unknown action.')
  } catch (e) {
    if (e && e.code === 'NO_STORE') return fail(res, 503, 'E.K. is not available on this server.')
    return fail(res, 500, 'E.K. could not finish that.')
  }
}

function bodyRaw(body) {
  return !!(body && body.__raw)
}

function pushEntry(list, entry) {
  list.push(entry)
  if (list.length > 30) list.splice(0, list.length - 30)
}

async function postBid(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in to bid.', { needLogin: true })
  const id = String(body.id || '')
  const note = cleanLine(body.note, 160)
  if (isBanned(note)) return fail(res, 400, 'That bid note is not allowed.')
  let result = ''
  let saved = null
  await withBoard(async function (state) {
    const row = findRow(state, id)
    if (!row || row.status !== 'open') {
      result = 'closed'
      return null
    }
    if (row.sellerUid === user.uid) {
      result = 'self'
      return null
    }
    if (row.mode !== 'auction') {
      result = 'mode'
      return null
    }
    if (row.deal === 'accepted' || holdActive(row, Date.now())) {
      result = 'busy'
      return null
    }
    if (auctionEnded(row, Date.now())) {
      result = 'ended'
      return null
    }
    const units = moneyUnits(row, body.amount)
    if (!units) {
      result = 'amount'
      return null
    }
    const floor = (row.bids || []).reduce(function (top, entry) {
      if (!entry || entry.state === 'declined') return top
      const got = BigInt(entry.units)
      return got > top ? got : top
    }, 0n)
    const start = BigInt(row.units)
    const got = BigInt(units)
    if (floor > 0n ? got <= floor : got < start) {
      result = 'low'
      return null
    }
    if (!Array.isArray(row.bids)) row.bids = []
    pushEntry(row.bids, {
      id: crypto.randomBytes(8).toString('hex'),
      uid: user.uid,
      amount: displayAmount(units, railById(row.rail).decimals, row.rail),
      units: units,
      note: note,
      at: new Date().toISOString(),
      state: 'open'
    })
    row.updatedAt = new Date().toISOString()
    saved = row
    result = 'ok'
    return state
  })
  if (result === 'self') return fail(res, 400, 'You cannot bid on your own listing.')
  if (result === 'mode') return fail(res, 400, 'This listing takes offers, not bids.')
  if (result === 'busy') return fail(res, 409, 'The seller already took a price, or someone is checking out.')
  if (result === 'ended') return fail(res, 409, 'Bidding is closed on this listing.')
  if (result === 'amount') return fail(res, 400, 'That bid is outside the price range.')
  if (result === 'low') return fail(res, 400, 'Bid higher than the current bid.')
  if (result !== 'ok') return fail(res, 409, 'That listing is not open for bids.')
  const stats = feedbackTotals({ listings: [saved] })
  return res.status(200).json({ ok: true, listing: publicListing(saved, user.uid, false, stats[saved.sellerUid]) })
}

async function postOffer(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in to make an offer.', { needLogin: true })
  const id = String(body.id || '')
  const note = cleanLine(body.note, 160)
  if (isBanned(note)) return fail(res, 400, 'That offer note is not allowed.')
  let result = ''
  let saved = null
  await withBoard(async function (state) {
    const row = findRow(state, id)
    if (!row || row.status !== 'open') {
      result = 'closed'
      return null
    }
    if (row.sellerUid === user.uid) {
      result = 'self'
      return null
    }
    if (row.mode === 'auction') {
      result = 'mode'
      return null
    }
    if (row.deal === 'accepted' || holdActive(row, Date.now())) {
      result = 'busy'
      return null
    }
    const units = moneyUnits(row, body.amount)
    if (!units) {
      result = 'amount'
      return null
    }
    if (units === row.units) {
      result = 'same'
      return null
    }
    if (!Array.isArray(row.offers)) row.offers = []
    row.offers.forEach(function (entry) {
      if (entry && entry.uid === user.uid && entry.state === 'open') entry.state = 'declined'
    })
    pushEntry(row.offers, {
      id: crypto.randomBytes(8).toString('hex'),
      uid: user.uid,
      amount: displayAmount(units, railById(row.rail).decimals, row.rail),
      units: units,
      note: note,
      at: new Date().toISOString(),
      state: 'open'
    })
    row.updatedAt = new Date().toISOString()
    saved = row
    result = 'ok'
    return state
  })
  if (result === 'self') return fail(res, 400, 'You cannot offer on your own listing.')
  if (result === 'mode') return fail(res, 400, 'This listing takes bids, not offers.')
  if (result === 'busy') return fail(res, 409, 'The seller already took a price, or someone is checking out.')
  if (result === 'amount') return fail(res, 400, 'That offer is outside the price range.')
  if (result === 'same') return fail(res, 400, 'That is the listed price. Pay the seller.')
  if (result !== 'ok') return fail(res, 409, 'That listing is not open for offers.')
  return res.status(200).json({ ok: true, listing: publicListing(saved, user.uid) })
}

async function postAnswer(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in to answer.', { needLogin: true })
  const id = String(body.id || '')
  const entryId = String(body.entry || '')
  const kind = body.kind === 'bid' ? 'bid' : (body.kind === 'offer' ? 'offer' : '')
  const decision = body.decision === 'accept' ? 'accept' : (body.decision === 'decline' ? 'decline' : '')
  if (!kind || !decision || !/^[a-f0-9]{16}$/.test(entryId)) return fail(res, 400, 'Choose a bid or an offer.')
  let result = ''
  let saved = null
  await withBoard(async function (state) {
    const row = findRow(state, id)
    if (!row || row.sellerUid !== user.uid) {
      result = 'missing'
      return null
    }
    if (row.status !== 'open') {
      result = 'closed'
      return null
    }
    if (holdActive(row, Date.now())) {
      result = 'busy'
      return null
    }
    const list = kind === 'bid' ? (row.bids || []) : (row.offers || [])
    const entry = list.filter(function (item) { return item && item.id === entryId })[0]
    if (!entry || entry.state !== 'open') {
      result = 'gone'
      return null
    }
    if (decision === 'decline') {
      entry.state = 'declined'
      row.updatedAt = new Date().toISOString()
      saved = row
      result = 'ok'
      return state
    }
    const price = applyPrice(row, entry.units)
    if (price === 'high') {
      result = 'high'
      return null
    }
    entry.state = 'accepted'
    ;(row.bids || []).forEach(function (item) {
      if (item && item.state === 'open') item.state = 'declined'
    })
    ;(row.offers || []).forEach(function (item) {
      if (item && item.state === 'open') item.state = 'declined'
    })
    entry.state = 'accepted'
    row.deal = 'accepted'
    saved = row
    result = 'ok'
    return state
  })
  if (result === 'missing') return fail(res, 404, 'That listing is not yours.')
  if (result === 'busy') return fail(res, 409, 'Someone is checking out. Answer after the hold ends.')
  if (result === 'high') return fail(res, 400, 'Item plus shipping is over the rail maximum.')
  if (result === 'gone') return fail(res, 409, 'That bid or offer is no longer open.')
  if (result !== 'ok') return fail(res, 409, 'That listing is not open.')
  return res.status(200).json({ ok: true, listing: publicListing(saved, user.uid) })
}

async function postFeedback(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in to leave feedback.', { needLogin: true })
  const id = String(body.id || '')
  const score = body.score === 'up' || body.score === 'mid' || body.score === 'down' ? body.score : ''
  const note = cleanLine(body.note, 200)
  if (!score) return fail(res, 400, 'Choose up, middle, or down.')
  if (isBanned(note)) return fail(res, 400, 'That feedback is not allowed.')
  let result = ''
  let saved = null
  await withBoard(async function (state) {
    const row = findRow(state, id)
    if (!row || row.status !== 'sold') {
      result = 'closed'
      return null
    }
    const seller = row.sellerUid === user.uid
    const buyer = row.buyerUid === user.uid
    if (!seller && !buyer) {
      result = 'who'
      return null
    }
    if (!Array.isArray(row.feedback)) row.feedback = []
    if (row.feedback.some(function (entry) { return entry && entry.uid === user.uid })) {
      result = 'once'
      return null
    }
    row.feedback.push({
      id: crypto.randomBytes(8).toString('hex'),
      uid: user.uid,
      role: seller ? 'seller' : 'buyer',
      score: score,
      note: note,
      at: new Date().toISOString()
    })
    row.updatedAt = new Date().toISOString()
    saved = row
    result = 'ok'
    return state
  })
  if (result === 'who') return fail(res, 403, 'Feedback is for the buyer and the seller on this sale.')
  if (result === 'once') return fail(res, 409, 'You already left feedback on this sale.')
  if (result !== 'ok') return fail(res, 409, 'Leave feedback after the sale.')
  return res.status(200).json({ ok: true, listing: publicListing(saved, user.uid) })
}

async function postReport(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in to report a listing.', { needLogin: true })
  const id = String(body.id || '')
  const reason = REASONS[String(body.reason || '')] ? String(body.reason) : ''
  const note = cleanLine(body.note, 280)
  if (!reason) return fail(res, 400, 'Choose what rule it breaks.')
  if (isBanned(note)) return fail(res, 400, 'That report note is not allowed.')
  let result = ''
  await withBoard(async function (state) {
    const row = findRow(state, id)
    if (!row || row.status === 'pulled') {
      result = 'missing'
      return null
    }
    if (row.sellerUid === user.uid) {
      result = 'self'
      return null
    }
    if (!Array.isArray(row.reports)) row.reports = []
    if (row.reports.some(function (entry) { return entry && entry.uid === user.uid })) {
      result = 'already'
      return null
    }
    row.reports.push({
      uid: user.uid,
      reason: reason,
      note: note,
      at: new Date().toISOString()
    })
    row.updatedAt = new Date().toISOString()
    result = 'ok'
    return state
  })
  if (result === 'missing') return fail(res, 404, 'That listing is not on the board.')
  if (result === 'self') return fail(res, 400, 'You cannot report your own listing.')
  if (result === 'already') return res.status(200).json({ ok: true, already: true })
  if (result !== 'ok') return fail(res, 409, 'That report was not saved.')
  return res.status(200).json({ ok: true })
}

async function postList(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in to sell.', { needLogin: true })
  if (body.mine !== true || body.direct !== true) {
    return fail(res, 400, 'Confirm the item is yours and that crypto is paid into escrow.')
  }
  const rail = railById(String(body.rail || ''))
  if (!rail) return fail(res, 400, 'Choose how the buyer pays.')
  const title = cleanLine(body.title, 80)
  const description = cleanBlock(body.description, 800)
  if (title.length < 3) return fail(res, 400, 'Give the item a title.')
  if (isBanned(title + '\n' + description)) return fail(res, 400, 'This listing is not allowed on E.K.')
  const units = toUnits(body.amount, rail.decimals)
  if (!units) return fail(res, 400, 'Enter a price like ' + rail.min + '.')
  const lo = BigInt(toUnits(rail.min, rail.decimals))
  const hi = BigInt(toUnits(rail.max, rail.decimals))
  const got = BigInt(units)
  if (got < lo || got > hi) return fail(res, 400, 'Price must be from ' + rail.min + ' to ' + rail.max + ' ' + rail.symbol + '.')
  if (!SHIPS[body.ship]) return fail(res, 400, 'Choose ship, pickup, or digital.')
  if (!LEAVES[String(body.category || '')]) return fail(res, 400, 'Choose a department and a type.')
  const condition = String(body.condition || '')
  if (!CONDITIONS[condition]) return fail(res, 400, 'Choose a condition.')
  const mode = body.mode === 'auction' ? 'auction' : 'fixed'
  let endsAt = ''
  if (mode === 'auction') {
    const days = Number(body.days)
    if (AUCTION_DAYS.indexOf(days) === -1) return fail(res, 400, 'Choose 1, 3, 7, or 10 days for the bids.')
    endsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  }
  let shipUnits = '0'
  let shipFrom = ''
  if (body.ship === 'ship') {
    if (String(body.shipAmount == null ? '' : body.shipAmount).trim() === '') {
      return fail(res, 400, 'Enter a shipping price. Use 0 if you ship free.')
    }
    shipUnits = toUnits(body.shipAmount, rail.decimals, true)
    if (shipUnits == null) return fail(res, 400, 'Enter a shipping price. Use 0 if you ship free.')
    shipFrom = cleanLine(body.shipFrom, 80)
    if (shipFrom.length < 2) return fail(res, 400, 'Say where it ships from.')
  }
  const payUnits = (BigInt(units) + BigInt(shipUnits)).toString()
  if (BigInt(payUnits) > hi) {
    return fail(res, 400, 'Item plus shipping is over ' + rail.max + ' ' + rail.symbol + '.')
  }
  let photos = photosOk(body.photos)
  if (photos == null) return fail(res, 400, 'Use up to 12 photos. Each one has to be a normal picture.')
  if (!photos.length && body.photo) {
    photos = photosOk([body.photo])
    if (photos == null) return fail(res, 400, 'Use up to 12 photos. Each one has to be a normal picture.')
  }

  let payout = canonicalPayout(rail, body.payout)
  if (rail.chain) {
    const known = walletOn(user, rail.chain)
    if (known) {
      const locked = canonicalPayout(rail, known)
      if (!locked) return fail(res, 400, 'The wallet on this account is not a valid payout address.')
      payout = locked
    } else if (!payout || payout !== canonicalPayout(rail, body.payoutAgain)) {
      return fail(res, 400, 'Type the payout address twice so it matches.')
    }
  } else if (!payout || payout !== paypalEmail(body.payoutAgain)) {
    return fail(res, 400, 'Type the PayPal email twice so it matches.')
  }
  if (rail.chain && payout === escrowAddress(rail.chain)) {
    return fail(res, 400, 'Use your own payout address. That one is the escrow wallet.')
  }

  const now = new Date().toISOString()
  const row = {
    id: crypto.randomBytes(8).toString('hex'),
    status: 'open',
    sellerUid: user.uid,
    title: title,
    description: description,
    category: String(body.category),
    condition: condition,
    endsAt: endsAt,
    mode: mode,
    deal: '',
    bids: [],
    offers: [],
    feedback: [],
    reports: [],
    buyerUid: '',
    rail: rail.id,
    chain: rail.chain,
    amount: displayAmount(units, rail.decimals, rail.id),
    units: units,
    shipAmount: displayAmount(shipUnits, rail.decimals, rail.id),
    shipUnits: shipUnits,
    payAmount: displayAmount(payUnits, rail.decimals, rail.id),
    payUnits: payUnits,
    payout: payout,
    ship: String(body.ship),
    shipFrom: shipFrom,
    shipNote: cleanLine(body.shipNote, 200),
    shipTo: null,
    pendingShip: null,
    carrier: '',
    tracking: '',
    shippedAt: '',
    photo: photos[0] || '',
    photos: photos,
    createdAt: now,
    updatedAt: now,
    soldAt: '',
    tx: '',
    buyer: '',
    handoffNote: '',
    holdKeyHash: '',
    holdUntil: 0,
    paypalOrderId: '',
    escrow: '',
    escrowPhase: '',
    escrowAt: '',
    proofAt: '',
    escrowNotice: '',
    releaseTo: '',
    releaseAddress: '',
    releaseUnits: '',
    releaseAt: '',
    settleTx: '',
    disputeReason: '',
    disputeNote: '',
    disputeAt: '',
    feeUnits: '0'
  }

  let saved = null
  let tooMany = ''
  await withBoard(async function (state) {
    const mineOpen = state.listings.filter(function (item) {
      return item && item.sellerUid === user.uid && item.status === 'open'
    }).length
    const allOpen = state.listings.filter(function (item) {
      return item && item.status === 'open'
    }).length
    if (mineOpen >= 8) {
      tooMany = 'You already have 8 open listings.'
      return null
    }
    if (allOpen >= 60) {
      tooMany = 'The board is full. Try again after something sells.'
      return null
    }
    state.listings.push(row)
    saved = row
    return state
  })
  if (tooMany) return fail(res, 400, tooMany)
  if (!saved) return fail(res, 500, 'E.K. could not save that listing.')
  return res.status(201).json({ ok: true, listing: publicListing(saved, user.uid) })
}

async function postHold(req, res, body) {
  if (!holdKeyOk(body.holdKey)) return fail(res, 400, 'Refresh the page and try the payment again.')
  const payer = await currentUser(req)
  const id = String(body.id || '')
  let result = ''
  let until = 0
  await withBoard(async function (state) {
    const row = findRow(state, id)
    if (!row) {
      result = 'missing'
      return null
    }
    if (row.rail !== 'paypal') {
      if (!payer) {
        result = 'login'
        return null
      }
      if (!escrowAddress(row.chain)) {
        result = 'armed'
        return null
      }
    }
    let shipTo = null
    if (row.mode === 'auction' && auctionEnded(row, Date.now()) && row.deal !== 'accepted') {
      result = 'ended'
      return null
    }
    if (row.ship === 'ship') {
      shipTo = readShipTo(body.shipTo)
      if (!shipTo) {
        result = 'address'
        return null
      }
    }
    const ms = row.rail === 'paypal' ? HOLD_PAYPAL_MS : HOLD_CRYPTO_MS
    result = takeHold(row, body.holdKey, ms)
    if (result !== 'ok') return null
    row.pendingShip = shipTo
    until = row.holdUntil
    return state
  })
  if (result === 'login') return fail(res, 401, 'Log in before you pay into escrow.', { needLogin: true })
  if (result === 'armed') return fail(res, 503, 'Crypto escrow is not armed on this server.')
  if (result === 'address') return fail(res, 400, 'Enter the full ship-to address.')
  if (result === 'ended') return fail(res, 409, 'Bidding is closed. The seller can still accept a bid. Nothing was charged.')
  if (result === 'missing') return fail(res, 404, 'That listing is gone.')
  if (result === 'sold') return fail(res, 409, 'That listing already sold.')
  if (result === 'busy') return fail(res, 409, 'Someone is already checking out. Wait a few minutes.')
  if (result !== 'ok') return fail(res, 409, 'That listing is not for sale.')
  return res.status(200).json({ ok: true, holdUntil: until })
}

async function postPull(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in to pull a listing.', { needLogin: true })
  const id = String(body.id || '')
  let result = ''
  await withBoard(async function (state) {
    const row = findRow(state, id)
    if (!row || row.sellerUid !== user.uid) {
      result = 'missing'
      return null
    }
    if (row.status !== 'open') {
      result = 'closed'
      return null
    }
    if (holdActive(row, Date.now())) {
      result = 'busy'
      return null
    }
    row.status = 'pulled'
    row.pendingShip = null
    row.updatedAt = new Date().toISOString()
    result = 'ok'
    return prune(state)
  })
  if (result === 'missing') return fail(res, 404, 'That listing is not yours.')
  if (result === 'busy') return fail(res, 409, 'Someone is checking out. Pull it after the hold ends.')
  if (result !== 'ok') return fail(res, 409, 'That listing is no longer open.')
  return res.status(200).json({ ok: true })
}

async function postHandoff(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in first.', { needLogin: true })
  const note = cleanLine(body.note, 280)
  const id = String(body.id || '')
  let result = ''
  let saved = null
  await withBoard(async function (state) {
    const row = findRow(state, id)
    if (!row || row.sellerUid !== user.uid) {
      result = 'missing'
      return null
    }
    if (row.status !== 'sold' && row.status !== 'escrow') {
      result = 'open'
      return null
    }
    escrowRules.advance(row, Date.now())
    if (escrowRules.isCrypto(row) && row.proofAt) {
      result = 'proof'
      return null
    }
    if (escrowRules.isCrypto(row) && (row.escrowPhase === 'release' || row.escrowPhase === 'refund' || row.escrowPhase === 'settled')) {
      result = 'late'
      return null
    }
    if (row.ship === 'ship') {
      const carrier = CARRIERS[String(body.carrier || '').toLowerCase()] || ''
      const tracking = cleanLine(body.tracking, 40).replace(/\s+/g, '')
      if (!carrier) {
        result = 'carrier'
        return null
      }
      if (!/^[A-Za-z0-9-]{5,40}$/.test(tracking)) {
        result = 'tracking'
        return null
      }
      row.carrier = carrier
      row.tracking = tracking
      row.shippedAt = new Date().toISOString()
    } else if (note.length < 2) {
      result = 'note'
      return null
    }
    row.handoffNote = note
    row.updatedAt = new Date().toISOString()
    if (escrowRules.isCrypto(row)) {
      if (!escrowRules.markProof(row, row.updatedAt)) {
        result = 'proof'
        return null
      }
    }
    saved = row
    result = 'ok'
    return state
  })
  if (result === 'missing') return fail(res, 404, 'That listing is not yours.')
  if (result === 'carrier') return fail(res, 400, 'Choose the carrier.')
  if (result === 'tracking') return fail(res, 400, 'Enter the tracking number.')
  if (result === 'note') return fail(res, 400, 'Write a short handoff note.')
  if (result === 'proof') return fail(res, 409, 'Shipping proof is already posted. It cannot be replaced.')
  if (result === 'late') return fail(res, 409, 'The escrow clock has already moved this sale.')
  if (result !== 'ok') return fail(res, 409, 'Post shipping proof after the crypto is in escrow.')
  return res.status(200).json({ ok: true, listing: publicListing(saved, user.uid) })
}

async function postConfirm(req, res, body) {
  if (!holdKeyOk(body.holdKey)) return fail(res, 400, 'Refresh the page and try the payment again.')
  const payer = await currentUser(req)
  const id = String(body.id || '')
  const txid = String(body.tx || '').trim()
  const buyer = String(body.buyer || '').trim()
  let row = null
  let gate = ''
  await withBoard(async function (state) {
    row = findRow(state, id)
    if (!row) {
      gate = 'missing'
      return null
    }
    if ((row.status === 'sold' || row.status === 'escrow' || row.status === 'refunded') && row.tx === txid) {
      gate = 'done'
      return null
    }
    if (row.status !== 'open') {
      gate = 'closed'
      return null
    }
    if (!holdMatches(row, body.holdKey)) {
      gate = 'busy'
      return null
    }
    if (row.rail === 'paypal') {
      gate = 'paypal'
      return null
    }
    return null
  })
  if (gate === 'missing') return fail(res, 404, 'That listing is gone.')
  if (gate === 'done') return res.status(200).json({ ok: true, listing: publicListing(row, '') })
  if (gate === 'busy') return fail(res, 409, 'Someone else is paying. Wait for the hold to end.')
  if (gate === 'paypal') return fail(res, 400, 'This listing is paid through PayPal.')
  if (gate === 'closed') return fail(res, 409, 'That listing is not for sale.')
  if (!row) return fail(res, 404, 'That listing is gone.')
  if (!payer) return fail(res, 401, 'Log in before you pay into escrow.', { needLogin: true })
  const pot = escrowAddress(row.chain)
  if (!pot) return fail(res, 503, 'Crypto escrow is not armed on this server.')
  const snap = {
    id: row.id,
    rail: row.rail,
    units: row.units,
    payUnits: row.payUnits || row.units,
    payout: row.payout,
    createdAt: row.createdAt,
    escrow: pot,
    chain: row.chain
  }

  let proof
  try {
    proof = await verifyPayment(snap, txid, buyer)
  } catch (e) {
    return fail(res, 502, 'The chain did not answer. Try confirm again in a moment.')
  }
  if (!proof.ok) return fail(res, 400, proof.error)

  let saved = null
  let result = ''
  await withBoard(async function (state) {
    const live = findRow(state, id)
    if (!live || live.status !== 'open') {
      result = live && live.tx === proof.tx ? 'done' : 'closed'
      row = live
      return null
    }
    if (!holdMatches(live, body.holdKey)) {
      result = 'busy'
      return null
    }
    if (state.usedTx[proof.tx]) {
      result = 'used'
      return null
    }
    if (live.units !== snap.units || live.payout !== snap.payout || live.rail !== snap.rail) {
      result = 'closed'
      return null
    }
    if ((live.payUnits || live.units) !== snap.payUnits) {
      result = 'closed'
      return null
    }
    if (live.ship === 'ship' && !live.pendingShip) {
      result = 'address'
      return null
    }
    if (proof.buyer === live.payout || proof.buyer === pot) {
      result = 'self'
      return null
    }
    const when = new Date().toISOString()
    live.tx = proof.tx
    live.shipTo = live.ship === 'ship' ? live.pendingShip : null
    live.pendingShip = null
    live.soldAt = when
    live.holdUntil = 0
    escrowRules.lock(live, when, proof.buyer, payer.uid)
    live.escrow = pot
    state.usedTx[proof.tx] = live.id
    saved = live
    result = 'ok'
    return state
  })
  if (result === 'done') return res.status(200).json({ ok: true, listing: publicListing(row, '') })
  if (result === 'busy') return fail(res, 409, 'Someone else is paying. Wait for the hold to end.')
  if (result === 'used') return fail(res, 409, 'That payment was already used on a listing.')
  if (result === 'self') return fail(res, 400, 'Pay from a wallet that is not the seller wallet.')
  if (result === 'address') return fail(res, 400, 'Enter the full ship-to address.')
  if (result !== 'ok') return fail(res, 409, 'That listing is not for sale.')
  return res.status(200).json({ ok: true, listing: publicListing(saved, '') })
}

async function postPaypalOrder(req, res, body) {
  if (!paypalArmed()) {
    return fail(res, 503, 'PayPal is not armed on this server. The seller PayPal email is on the listing.', { armed: false })
  }
  if (!holdKeyOk(body.holdKey)) return fail(res, 400, 'Refresh the page and try the payment again.')
  const id = String(body.id || '')
  let row = null
  let gate = ''
  await withBoard(async function (state) {
    row = findRow(state, id)
    if (!row) {
      gate = 'missing'
      return null
    }
    if (row.rail !== 'paypal' || row.status !== 'open') {
      gate = 'closed'
      return null
    }
    if (row.mode === 'auction' && auctionEnded(row, Date.now()) && row.deal !== 'accepted') {
      gate = 'ended'
      return null
    }
    gate = takeHold(row, body.holdKey, HOLD_PAYPAL_MS)
    return gate === 'ok' ? state : null
  })
  if (gate === 'missing') return fail(res, 404, 'That listing is gone.')
  if (gate === 'busy') return fail(res, 409, 'Someone is already checking out. Wait a few minutes.')
  if (gate === 'ended') return fail(res, 409, 'Bidding is closed. The seller can still accept a bid. Nothing was charged.')
  if (gate !== 'ok') return fail(res, 409, 'That listing is not for sale.')

  let order
  try {
    order = await paypalCall('/v2/checkout/orders', 'POST', {
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: row.id,
          description: String(row.title || 'E.K.').slice(0, 120),
          amount: { currency_code: 'USD', value: row.payAmount || row.amount },
          payee: { email_address: row.payout }
        }
      ],
      application_context: {
        brand_name: 'E.K.',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: siteBase(req) + '/ek/past?ekpaypal=1&listing=' + row.id,
        cancel_url: siteBase(req) + '/ek/past?ekpaypal=cancel&listing=' + row.id
      }
    })
  } catch (e) {
    await withBoard(async function (state) {
      const live = findRow(state, id)
      if (!live || live.holdKeyHash !== hashKey(body.holdKey)) return null
      live.holdUntil = 0
      live.holdKeyHash = ''
      return state
    }).catch(function () {})
    return fail(res, 502, e.message || 'PayPal did not open the checkout.')
  }

  const links = order.links || []
  let approve = ''
  for (let i = 0; i < links.length; i++) {
    if (links[i] && links[i].rel === 'approve') approve = links[i].href
  }
  if (!order.id || !approve) return fail(res, 502, 'PayPal did not return a checkout link.')

  await withBoard(async function (state) {
    const live = findRow(state, id)
    if (!live) return null
    live.paypalOrderId = order.id
    return state
  })
  return res.status(200).json({ ok: true, orderId: order.id, approve: approve })
}

async function postPaypalCapture(req, res, body) {
  if (!paypalArmed()) return fail(res, 503, 'PayPal is not armed on this server.', { armed: false })
  const payer = await currentUser(req)
  const id = String(body.id || body.listing || '')
  const orderId = String(body.orderId || body.token || '').trim()
  if (!/^[A-Za-z0-9]{10,30}$/.test(orderId)) return fail(res, 400, 'That PayPal order is not valid.')

  let row = null
  await withBoard(async function (state) {
    row = findRow(state, id)
    return null
  })
  if (!row) return fail(res, 404, 'That listing is gone.')
  if (row.status === 'sold' && row.tx === orderId) {
    return res.status(200).json({ ok: true, listing: publicListing(row, '') })
  }
  if (row.paypalOrderId !== orderId) return fail(res, 400, 'This PayPal order does not match the listing.')

  let captured
  try {
    captured = await paypalCall('/v2/checkout/orders/' + orderId + '/capture', 'POST', {})
  } catch (e) {
    return fail(res, 502, e.message || 'PayPal did not capture the payment.')
  }
  if (!captured || captured.status !== 'COMPLETED') return fail(res, 400, 'PayPal has not completed this payment.')
  const unit = (captured.purchase_units && captured.purchase_units[0]) || {}
  if (unit.custom_id && String(unit.custom_id) !== row.id) return fail(res, 400, 'PayPal paid a different listing.')
  const capture = unit.payments && unit.payments.captures && unit.payments.captures[0]
  const paid = capture && capture.amount && capture.amount.value
  if (paid !== (row.payAmount || row.amount) || (capture.amount && capture.amount.currency_code !== 'USD')) {
    return fail(res, 400, 'The PayPal amount does not match the listing.')
  }

  let saved = null
  let result = ''
  await withBoard(async function (state) {
    const live = findRow(state, id)
    if (!live) {
      result = 'missing'
      return null
    }
    if (live.status === 'sold' && live.tx === orderId) {
      result = 'done'
      row = live
      return null
    }
    if (live.status !== 'open' || live.paypalOrderId !== orderId) {
      result = 'closed'
      return null
    }
    if (state.usedTx[orderId]) {
      result = 'used'
      return null
    }
    if (live.ship === 'ship' && !live.pendingShip) {
      result = 'address'
      return null
    }
    live.status = 'sold'
    live.tx = orderId
    live.buyer = maskEmail((captured.payer && captured.payer.email_address) || '')
    if (payer && payer.uid) live.buyerUid = payer.uid
    live.shipTo = live.ship === 'ship' ? live.pendingShip : null
    live.pendingShip = null
    live.soldAt = new Date().toISOString()
    live.updatedAt = live.soldAt
    live.holdUntil = 0
    state.usedTx[orderId] = live.id
    saved = live
    result = 'ok'
    return state
  })
  if (result === 'done') return res.status(200).json({ ok: true, listing: publicListing(row, '') })
  if (result === 'address') return fail(res, 400, 'Enter the full ship-to address.')
  if (result !== 'ok') return fail(res, 409, 'That listing is not for sale.')
  return res.status(200).json({ ok: true, listing: publicListing(saved, '') })
}

function escrowResult(res, result, row) {
  if (result === 'ok') return null
  if (result === 'missing') return fail(res, 404, 'That listing is not on the board.')
  if (result === 'buyer') return fail(res, 403, 'Only the buyer account can do that.')
  if (result === 'seller') return fail(res, 403, 'Only the seller account can do that.')
  if (result === 'proof') return fail(res, 409, 'The seller posts shipping proof before the buyer can receive it.')
  if (result === 'disputed') return fail(res, 409, 'The full amount is frozen until both sides accept the same outcome.')
  if (result === 'late') return fail(res, 409, 'That escrow outcome is already set.')
  if (result === 'settled') return res.status(200).json({ ok: true, listing: publicListing(row, '') })
  if (result === 'reason') return fail(res, 400, 'Pick not received, not as described, or damaged.')
  if (result === 'paypal') return fail(res, 400, 'PayPal is paid to the seller. It does not use this escrow.')
  return fail(res, 409, 'That listing is not in escrow.')
}

async function postEscrowReceived(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in first.', { needLogin: true })
  const id = String(body.id || '')
  let result = ''
  let saved = null
  await withBoard(async function (state) {
    const clocks = escrowRules.advanceAll(state.listings, Date.now())
    const row = findRow(state, id)
    if (!row) {
      result = 'missing'
      return clocks ? state : null
    }
    if (row.buyerUid !== user.uid) {
      result = 'buyer'
      saved = row
      return clocks ? state : null
    }
    result = escrowRules.received(row, Date.now())
    if (result !== 'ok') {
      saved = row
      return clocks ? state : null
    }
    row.updatedAt = new Date().toISOString()
    saved = row
    return state
  })
  const denied = escrowResult(res, result, saved)
  if (denied !== null && result !== 'ok') return
  if (result !== 'ok') return
  return res.status(200).json({ ok: true, listing: publicListing(saved, user.uid) })
}

async function postEscrowProblem(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in first.', { needLogin: true })
  const id = String(body.id || '')
  const reason = String(body.reason || '')
  const note = cleanLine(body.note, 280)
  let result = ''
  let saved = null
  await withBoard(async function (state) {
    const clocks = escrowRules.advanceAll(state.listings, Date.now())
    const row = findRow(state, id)
    if (!row) {
      result = 'missing'
      return clocks ? state : null
    }
    if (row.buyerUid !== user.uid) {
      result = 'buyer'
      saved = row
      return clocks ? state : null
    }
    result = escrowRules.problem(row, Date.now(), reason, note)
    if (result !== 'ok') {
      saved = row
      return clocks ? state : null
    }
    row.updatedAt = new Date().toISOString()
    saved = row
    return state
  })
  if (result !== 'ok') return escrowResult(res, result, saved)
  return res.status(200).json({ ok: true, listing: publicListing(saved, user.uid) })
}

async function postEscrowRefund(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in first.', { needLogin: true })
  const id = String(body.id || '')
  let result = ''
  let saved = null
  await withBoard(async function (state) {
    const clocks = escrowRules.advanceAll(state.listings, Date.now())
    const row = findRow(state, id)
    if (!row) {
      result = 'missing'
      return clocks ? state : null
    }
    if (row.sellerUid !== user.uid) {
      result = 'seller'
      saved = row
      return clocks ? state : null
    }
    result = escrowRules.acceptRefund(row, Date.now())
    if (result !== 'ok') {
      saved = row
      return clocks ? state : null
    }
    row.updatedAt = new Date().toISOString()
    saved = row
    return state
  })
  if (result !== 'ok') return escrowResult(res, result, saved)
  return res.status(200).json({ ok: true, listing: publicListing(saved, user.uid) })
}

async function postEscrowDrop(req, res, body) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'Log in first.', { needLogin: true })
  const id = String(body.id || '')
  let result = ''
  let saved = null
  await withBoard(async function (state) {
    const clocks = escrowRules.advanceAll(state.listings, Date.now())
    const row = findRow(state, id)
    if (!row) {
      result = 'missing'
      return clocks ? state : null
    }
    if (row.buyerUid !== user.uid) {
      result = 'buyer'
      saved = row
      return clocks ? state : null
    }
    result = escrowRules.dropDispute(row, Date.now())
    if (result !== 'ok') {
      saved = row
      return clocks ? state : null
    }
    row.updatedAt = new Date().toISOString()
    saved = row
    return state
  })
  if (result !== 'ok') return escrowResult(res, result, saved)
  return res.status(200).json({ ok: true, listing: publicListing(saved, user.uid) })
}

async function postEscrowSettle(req, res, body) {
  const id = String(body.id || '')
  const txid = String(body.tx || '').trim()
  let row = null
  await withBoard(async function (state) {
    const changed = escrowRules.advanceAll(state.listings, Date.now())
    row = findRow(state, id)
    return changed ? state : null
  })
  if (!row) return fail(res, 404, 'That listing is not on the board.')
  if (row.escrowPhase === 'settled' && row.settleTx === txid) {
    return res.status(200).json({ ok: true, listing: publicListing(row, '') })
  }
  if (row.escrowPhase !== 'release' && row.escrowPhase !== 'refund') {
    return fail(res, 409, row.escrowNotice || 'This sale is not ready to pay out.')
  }
  let proof
  try {
    proof = await verifyPayout(row, txid)
  } catch (e) {
    return fail(res, 502, 'The chain did not answer. Try the payout again in a moment.')
  }
  if (!proof.ok) return fail(res, 400, proof.error)
  let saved = null
  let result = ''
  await withBoard(async function (state) {
    const live = findRow(state, id)
    if (!live) {
      result = 'missing'
      return null
    }
    if (live.escrowPhase === 'settled' && live.settleTx === proof.tx) {
      result = 'done'
      row = live
      return null
    }
    if (live.escrowPhase !== 'release' && live.escrowPhase !== 'refund') {
      result = 'closed'
      return null
    }
    if (live.releaseAddress !== row.releaseAddress || live.releaseUnits !== row.releaseUnits || live.releaseTo !== row.releaseTo) {
      result = 'closed'
      return null
    }
    if (state.usedTx[proof.tx]) {
      result = 'used'
      return null
    }
    const when = new Date().toISOString()
    live.escrowPhase = 'settled'
    live.settleTx = proof.tx
    live.feeUnits = '0'
    live.releasedAt = when
    live.updatedAt = when
    live.status = live.releaseTo === 'buyer' ? 'refunded' : 'sold'
    live.escrowNotice = escrowRules.notice(live)
    state.usedTx[proof.tx] = live.id
    saved = live
    result = 'ok'
    return state
  })
  if (result === 'done') return res.status(200).json({ ok: true, listing: publicListing(row, '') })
  if (result === 'used') return fail(res, 409, 'That payout was already used.')
  if (result !== 'ok') return fail(res, 409, 'This sale is not ready to pay out.')
  return res.status(200).json({ ok: true, listing: publicListing(saved, '') })
}

handler.toUnits = toUnits
handler.displayAmount = displayAmount
handler.canonicalSolana = canonicalSolana
handler.canonicalEthereum = canonicalEthereum
handler.isBanned = isBanned
module.exports = handler
