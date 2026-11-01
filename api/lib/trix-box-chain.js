/**
 * Rank TRiX wallets by sealed-box captures using Solscan, with RPC fallback.
 * Boxes are not on the public TRiX collector board (TCG off / login-only).
 * Holder counts are BuyPack receipt accounts: one receipt is one sealed box,
 * and the wallet at byte offset 8 is the holder. Payment-size matching is only
 * a fallback when the receipt scan cannot run.
 */

const bs58 = require('bs58')
const solscan = require('./solscan')
const { heliusKey, solRpcUrls } = require('./helius-rpc')

const BOX_TREASURY = 'D8LYYHufXvEVAfMKfmv9amKLJjdJejpXAwsM5Wqp3iQe'
const PACK_PROGRAM = 'HTrrq6C6j9NYySUrpSLn9nDjFbKNBD6pS3xBuLppfW4F'
const PACK_CONFIG = 'AZxmdJhmHLYg3tufFjUq6Ujm41VBFZ2DAjQGb14Qoou'
const TREASURY_BASE = 306039173
const STICKER_BASE = 340043526
const TREASURIES = [
  BOX_TREASURY,
  'H1HU4Bfg6hsMz8SP2JB27urLM1TeB7UhKREsukRtvoid',
  'QR7US76WP3D4Hk65DuvF8ZPWb9E65MBgBk25j7f9TtY',
  '7msbG83ZLVxYGnJvN5ZGz8Xu3eGeSsXuM65DnLCTHHG6',
  'HpSrj9SzYLteSwDwKAtpf2PP2yMTEnbqZqiJXMszihvU'
]

const BOX_START = 1788110000
const MEME_FEE = 6000000
const MEME_TOTAL = 12000000

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function solToLamports(sol) {
  const n = num(sol)
  if (n <= 0) return 0
  return Math.round(n * 1e9)
}

function pricesFromState(state) {
  const levels = Array.isArray(state && state.levels) ? state.levels : []
  const out = {}
  levels.forEach((lv) => {
    const id = String((lv && lv.id) || '').toLowerCase()
    const lamports = solToLamports(lv && lv.priceSol)
    if (id && lamports > 0) out[id] = lamports
  })
  if (!out.base) out.base = TREASURY_BASE
  if (!out.hype) out.hype = 765097933
  if (!out.viral) out.viral = 1530195865
  out.sticker = out.sticker || STICKER_BASE
  return out
}

function classifyLamports(lamports, prices, opts) {
  const amt = Math.abs(Math.floor(num(lamports)))
  if (amt < 5e7) return null
  if (amt === MEME_FEE || amt === MEME_TOTAL) return null
  const loose = !!(opts && opts.loose)
  const ids = Object.keys(prices)
  let best = null
  for (let i = 0; i < ids.length; i++) {
    const unit = prices[ids[i]]
    if (!unit) continue
    const boxes = Math.max(1, Math.round(amt / unit))
    if (boxes > 400) continue
    const err = Math.abs(amt - boxes * unit) / (boxes * unit)
    const ok = loose ? err <= 0.2 : err <= 0.008 || Math.abs(amt - boxes * unit) <= 20000
    if (!ok) continue
    if (!best || err < best.err) best = { kind: ids[i], boxes, err }
  }
  return best
}

function row(walletMap, addr) {
  const meta = walletMap.get(addr) || {}
  return {
    username: meta.username || '',
    wallet: addr,
    boxes: 0,
    rips: 0,
    mythics: 0,
    earnedUsd: 0,
    verified: !!meta.verified,
    kinds: {},
    sigs: [],
    lastAt: 0
  }
}

function addBoxes(byWallet, walletMap, addr, hit, sig, at, seen) {
  if (!addr) return
  if (sig && seen) {
    const key = addr + ':' + sig
    if (seen.has(key)) return
    seen.add(key)
  }
  let rec = byWallet.get(addr)
  if (!rec) {
    rec = row(walletMap, addr)
    byWallet.set(addr, rec)
  }
  rec.boxes += hit.boxes
  rec.kinds[hit.kind] = (rec.kinds[hit.kind] || 0) + hit.boxes
  if (sig && rec.sigs.length < 6) rec.sigs.push(sig)
  if (at && at > rec.lastAt) rec.lastAt = at
}

function rank(byWallet) {
  return [...byWallet.values()]
    .filter((r) => r.boxes > 0)
    .sort((a, b) => b.boxes - a.boxes || String(a.username).localeCompare(String(b.username)))
    .slice(0, 200)
    .map((r, i) => ({
      rank: i + 1,
      username: r.username,
      wallet: r.wallet,
      boxes: r.boxes,
      rips: r.rips,
      mythics: r.mythics,
      earnedUsd: r.earnedUsd,
      verified: r.verified,
      kinds: r.kinds,
      lastAt: r.lastAt || null,
      solscan: 'https://solscan.io/account/' + r.wallet,
      sigs: r.sigs
    }))
}

function tokenLooksLikeBox(meta) {
  const blob = [
    meta && meta.tokenName,
    meta && meta.name,
    meta && meta.symbol,
    meta && meta.tokenSymbol,
    meta && meta.collection
  ].join(' ').toLowerCase()
  if (!blob.trim()) return false
  return /\b(box|pack|trix|sealed|preorder)\b/.test(blob)
}

async function scanSolscan(wallets, prices) {
  const walletMap = new Map()
  wallets.forEach((w) => {
    if (w && w.wallet) walletMap.set(w.wallet, w)
  })
  const byWallet = new Map()
  const seen = new Set()
  const treasuries = TREASURIES.slice(0, 4)
  const fromTime = BOX_START

  for (let t = 0; t < treasuries.length; t++) {
    const addr = treasuries[t]
    for (let page = 1; page <= 3; page++) {
      const body = await solscan.accountTransfers(addr, {
        flow: 'in',
        token: solscan.NATIVE_SOL + ',' + solscan.WSOL,
        from_time: fromTime,
        page,
        page_size: 100
      }).catch(() => null)
      const list = body && Array.isArray(body.data) ? body.data : []
      if (!list.length) break
      list.forEach((tr) => {
        const from = tr.from_address || tr.from
        const amt = num(tr.amount)
        const hit = classifyLamports(amt, prices)
        if (!hit) return
        addBoxes(byWallet, walletMap, from, hit, tr.trans_id, tr.block_time, seen)
      })
      if (list.length < 100) break
    }
  }

  const sample = wallets.slice(0, 24)
  for (let i = 0; i < sample.length; i++) {
    const w = sample[i]
    if (!w || !w.wallet) continue
    const body = await solscan.accountTransfers(w.wallet, {
      flow: 'out',
      token: solscan.NATIVE_SOL + ',' + solscan.WSOL,
      from_time: fromTime,
      page: 1,
      page_size: 40
    }).catch(() => null)
    const list = body && Array.isArray(body.data) ? body.data : []
    list.forEach((tr) => {
      const amt = num(tr.amount)
      const hit = classifyLamports(amt, prices)
      if (!hit) return
      addBoxes(byWallet, walletMap, w.wallet, hit, tr.trans_id, tr.block_time, seen)
    })
    const nfts = await solscan.accountTokenAccounts(w.wallet, { type: 'nft' }).catch(() => null)
    const items = nfts && Array.isArray(nfts.data) ? nfts.data : (nfts && nfts.data && nfts.data.token_accounts) || []
    const bag = Array.isArray(items) ? items : []
    bag.forEach((tok) => {
      if (!tokenLooksLikeBox(tok)) return
      const amt = Math.max(1, Math.floor(num(tok.amount || tok.balance || 1)))
      addBoxes(byWallet, walletMap, w.wallet, { kind: 'nft', boxes: amt }, 'nft:' + (tok.token_address || tok.address || tok.mint), 0, seen)
    })
  }

  return {
    source: 'solscan pro /v2.0/account/transfer + token-accounts',
    collectors: rank(byWallet)
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function heliusTxs(address, limit, before) {
  const key = heliusKey()
  if (!key) throw new Error('HELIUS_API_KEY missing')
  let url = 'https://api.helius.xyz/v0/addresses/' + encodeURIComponent(address) +
    '/transactions?api-key=' + encodeURIComponent(key) + '&limit=' + (limit || 100)
  if (before) url += '&before=' + encodeURIComponent(before)
  let lastErr = null
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.status === 429) {
      lastErr = new Error('Helius HTTP 429')
      await sleep(700 + attempt * 450)
      continue
    }
    if (!res.ok) throw new Error('Helius HTTP ' + res.status)
    const body = await res.json()
    return Array.isArray(body) ? body : []
  }
  throw lastErr || new Error('Helius HTTP 429')
}

async function heliusPages(address, maxPages) {
  const all = []
  let before = ''
  for (let page = 0; page < maxPages; page++) {
    const bag = await heliusTxs(address, 100, before)
    if (!bag.length) break
    all.push(...bag)
    const last = bag[bag.length - 1]
    if (num(last.timestamp) && num(last.timestamp) < BOX_START) break
    before = last.signature
    if (bag.length < 100) break
    if (page + 1 < maxPages) await sleep(220)
  }
  return all
}

async function mapPool(items, size, fn) {
  const out = []
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size)
    out.push(...(await Promise.all(chunk.map(fn))))
  }
  return out
}

function ingestNative(tx, wallet, prices, byWallet, walletMap, seen) {
  const t = num(tx && tx.timestamp)
  if (t && t < BOX_START) return
  const transfers = (tx && tx.nativeTransfers) || []
  transfers.forEach((tr) => {
    if (!tr) return
    if (tr.fromUserAccount !== wallet) return
    const hit = classifyLamports(tr.amount, prices)
    if (!hit) return
    addBoxes(byWallet, walletMap, wallet, hit, tx.signature, t, seen)
  })
}

async function scanHelius(wallets, prices, opts) {
  opts = opts || {}
  const walletMap = new Map()
  wallets.forEach((w) => {
    if (w && w.wallet) walletMap.set(w.wallet, w)
  })
  const byWallet = new Map()
  const seen = new Set()
  const txs = await heliusPages(BOX_TREASURY, opts.maxPages || 3)
  txs.forEach((tx) => {
    const t = num(tx && tx.timestamp)
    if (t && t < BOX_START) return
    ;((tx && tx.nativeTransfers) || []).forEach((tr) => {
      if (!tr || tr.toUserAccount !== BOX_TREASURY) return
      const from = tr.fromUserAccount
      if (!from) return
      const hit = classifyLamports(tr.amount, prices)
      if (!hit) return
      addBoxes(byWallet, walletMap, from, hit, tx.signature, t, seen)
    })
  })
  const collectors = rank(byWallet)
  const boxEvents = collectors.reduce((n, r) => n + (r.boxes || 0), 0)
  const packMinted = await readPackMinted().catch(() => null)
  return {
    source: 'TRiX BuyPack program + Helius treasury D8LYYH',
    treasury: BOX_TREASURY,
    program: PACK_PROGRAM,
    packConfig: PACK_CONFIG,
    collectors,
    boxEvents,
    packMinted: packMinted || null,
    pages: opts.maxPages || 3
  }
}

const PACK_RECEIPT_DISC = '750efaa6a283b4b4'

async function readPackMintedFromConfig() {
  const info = await rpcCall('getAccountInfo', [PACK_CONFIG, { encoding: 'base64' }])
  const acc = info && info.value ? info.value : info
  const blob = acc && acc.data && acc.data[0]
  if (!blob) return null
  const buf = Buffer.from(blob, 'base64')
  if (buf.length < 21) return null
  const n = buf.readUInt32LE(17)
  return n > 0 && n < 10000000 ? n : null
}

async function readPackMinted() {
  const fromConfig = await readPackMintedFromConfig().catch(() => null)
  if (fromConfig != null) return fromConfig
  const counted = await countPackReceipts().catch(() => null)
  return counted > 0 ? counted : null
}

// Buyer wallet sits at byte 8. One receipt account is one sealed box.
// Receipt count matches the BuyPack minted counter on the config account.
async function readPackHolders() {
  const disc = bs58.encode(Buffer.from(PACK_RECEIPT_DISC, 'hex'))
  const list = await rpcCall('getProgramAccounts', [
    PACK_PROGRAM,
    {
      encoding: 'base64',
      dataSlice: { offset: 8, length: 32 },
      filters: [{ memcmp: { offset: 0, bytes: disc } }]
    }
  ])
  if (!Array.isArray(list) || !list.length) return null
  const counts = new Map()
  for (let i = 0; i < list.length; i++) {
    const data = list[i] && list[i].account && list[i].account.data
    const blob = Array.isArray(data) ? data[0] : null
    if (!blob) continue
    const buf = Buffer.from(blob, 'base64')
    const walletBytes = buf.length >= 40 ? buf.subarray(8, 40) : buf
    if (walletBytes.length !== 32) continue
    const wallet = bs58.encode(walletBytes)
    counts.set(wallet, (counts.get(wallet) || 0) + 1)
  }
  if (!counts.size) return null
  const collectors = [...counts.entries()]
    .map(([wallet, boxes]) => ({
      wallet,
      boxes,
      username: '',
      verified: false,
      rips: 0,
      mythics: 0,
      earnedUsd: 0,
      kinds: {},
      lastAt: null,
      solscan: 'https://solscan.io/account/' + wallet
    }))
    .sort((a, b) => b.boxes - a.boxes || a.wallet.localeCompare(b.wallet))
    .map((row, i) => Object.assign(row, { rank: i + 1 }))
  const receipts = collectors.reduce((n, row) => n + row.boxes, 0)
  return {
    updatedAt: new Date().toISOString(),
    receipts,
    holders: collectors.length,
    collectors
  }
}

async function countPackReceipts() {
  const list = await rpcCall('getProgramAccounts', [
    PACK_PROGRAM,
    { encoding: 'base64', dataSlice: { offset: 0, length: 8 } }
  ])
  if (!Array.isArray(list)) return null
  let n = 0
  for (let i = 0; i < list.length; i++) {
    const data = list[i] && list[i].account && list[i].account.data
    const blob = Array.isArray(data) ? data[0] : null
    if (!blob) continue
    if (Buffer.from(blob, 'base64').toString('hex') === PACK_RECEIPT_DISC) n += 1
  }
  return n || null
}

async function rpcCall(method, params) {
  const urls = solRpcUrls()
  let last = null
  for (let i = 0; i < urls.length; i++) {
    try {
      const res = await fetch(urls[i], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
      })
      if (!res.ok) {
        last = new Error('RPC HTTP ' + res.status)
        continue
      }
      const body = await res.json()
      if (body && body.error) {
        last = new Error(body.error.message || 'rpc error')
        continue
      }
      return body.result
    } catch (err) {
      last = err
    }
  }
  throw last || new Error('RPC failed')
}

async function scanRpc(wallets, prices) {
  const walletMap = new Map()
  wallets.forEach((w) => {
    if (w && w.wallet) walletMap.set(w.wallet, w)
  })
  const byWallet = new Map()
  const seen = new Set()
  const sample = wallets.slice(0, 12)
  for (let i = 0; i < sample.length; i++) {
    const w = sample[i]
    if (!w || !w.wallet) continue
    const sigs = await rpcCall('getSignaturesForAddress', [w.wallet, { limit: 15 }]).catch(() => [])
    const list = Array.isArray(sigs) ? sigs : []
    for (let s = 0; s < Math.min(list.length, 8); s++) {
      const sig = list[s] && list[s].signature
      if (!sig) continue
      if (list[s].blockTime && list[s].blockTime < BOX_START) continue
      const tx = await rpcCall('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]).catch(() => null)
      if (!tx || !tx.meta) continue
      const keys = (tx.transaction && tx.transaction.message && tx.transaction.message.accountKeys) || []
      const pre = tx.meta.preBalances || []
      const post = tx.meta.postBalances || []
      for (let k = 0; k < keys.length; k++) {
        const pk = typeof keys[k] === 'string' ? keys[k] : keys[k] && keys[k].pubkey
        if (pk !== w.wallet) continue
        const delta = num(post[k]) - num(pre[k])
        if (delta >= 0) continue
        const hit = classifyLamports(-delta, prices)
        if (hit) addBoxes(byWallet, walletMap, w.wallet, hit, sig, list[s].blockTime, seen)
      }
    }
  }
  return {
    source: 'solana rpc fallback (top TRiX wallets, recent txs)',
    collectors: rank(byWallet)
  }
}

async function captureBoxes(opts) {
  opts = opts || {}
  const wallets = Array.isArray(opts.wallets) ? opts.wallets : []
  const prices = pricesFromState(opts.state)
  const started = Date.now()
  const packMinted = await readPackMinted().catch(() => null)
  if (heliusKey()) {
    try {
      const out = await scanHelius(wallets, prices, { maxPages: opts.heliusPages || 12 })
      out.engine = 'helius'
      out.elapsedMs = Date.now() - started
      out.walletsScanned = Math.min(wallets.length, 40)
      out.prices = prices
      if (packMinted != null) out.packMinted = packMinted
      if ((out.collectors && out.collectors.length) || packMinted) return out
    } catch (err) {
      // fall through to Solscan / RPC
      opts.heliusError = String(err && err.message ? err.message : err)
    }
  }
  const plan = await solscan.probePlan()
  if (plan.ok) {
    try {
      const out = await scanSolscan(wallets, prices)
      out.engine = 'solscan'
      out.plan = plan.plan
      out.elapsedMs = Date.now() - started
      out.walletsScanned = wallets.length
      out.prices = prices
      if (packMinted != null) out.packMinted = packMinted
      return out
    } catch (err) {
      const fallback = await scanRpc(wallets, prices).catch(() => ({ collectors: [], source: 'rpc failed' }))
      fallback.engine = 'rpc'
      fallback.plan = plan.plan
      fallback.solscanError = String(err && err.message ? err.message : err)
      fallback.elapsedMs = Date.now() - started
      fallback.walletsScanned = wallets.length
      fallback.prices = prices
      if (packMinted != null) fallback.packMinted = packMinted
      return fallback
    }
  }
  const fallback = await scanRpc(wallets, prices).catch(() => ({ collectors: [], source: 'rpc failed' }))
  fallback.engine = 'rpc'
  fallback.plan = plan.plan
  fallback.needSolscanKey = plan.reason === 'no_key'
  fallback.needSolscanUpgrade = plan.reason === 'upgrade_required'
  fallback.solscanError = plan.reason === 'upgrade_required'
    ? 'Solscan free plan cannot read wallet transfers. Lite ($49) unlocks /account/transfer.'
    : (plan.reason || null)
  fallback.elapsedMs = Date.now() - started
  fallback.walletsScanned = wallets.length
  fallback.prices = prices
  if (opts.heliusError) fallback.heliusError = opts.heliusError
  if (packMinted != null) fallback.packMinted = packMinted
  return fallback
}

module.exports = {
  TREASURIES,
  PACK_PROGRAM,
  PACK_CONFIG,
  pricesFromState,
  classifyLamports,
  captureBoxes,
  readPackMinted,
  readPackMintedFromConfig,
  readPackHolders
}
