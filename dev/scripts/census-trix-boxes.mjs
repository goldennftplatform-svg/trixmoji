/**
 * Holder box counts from TRiX BuyPack receipt accounts.
 * One receipt is one sealed box. The wallet at byte offset 8 is the holder.
 * Writes assets/data/trix-wallets.json and the collectors block in trix-boxes.json.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..')
const require = createRequire(import.meta.url)
const WALLETS = path.join(ROOT, 'assets', 'data', 'trix-wallets.json')
const BOXES = path.join(ROOT, 'assets', 'data', 'trix-boxes.json')

function loadEnv() {
  const envPath = path.join(ROOT, '.env')
  if (!fs.existsSync(envPath)) return
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  })
}

loadEnv()
const { readPackHolders, readPackMinted, PACK_PROGRAM, PACK_CONFIG } = require(path.join(ROOT, 'api', 'lib', 'trix-box-chain.js'))

const [holders, minted] = await Promise.all([
  readPackHolders(),
  readPackMinted()
])
if (!holders || !holders.receipts || !holders.collectors.length) {
  throw new Error('BuyPack receipt scan returned no holders')
}
const sum = holders.collectors.reduce((n, row) => n + row.boxes, 0)
if (sum !== holders.receipts) throw new Error('holder boxes ' + sum + ' != receipts ' + holders.receipts)
if (minted != null && Math.abs(minted - holders.receipts) > 30) {
  throw new Error('minted counter ' + minted + ' disagrees with receipts ' + holders.receipts)
}

const names = new Map()
try {
  const prev = JSON.parse(fs.readFileSync(WALLETS, 'utf8'))
  ;(prev.wallets || []).forEach((row) => {
    if (row && row.wallet && row.username) {
      names.set(row.wallet, { username: row.username, verified: !!row.verified })
    }
  })
} catch (e) {}

let board = null
try {
  const res = await fetch('https://www.trix.market/api/leaderboard')
  if (res.ok) board = await res.json()
} catch (e) {}
;((board && board.leaderboard) || []).forEach((row) => {
  if (!row || !row.walletAddress || !row.username) return
  names.set(row.walletAddress, { username: row.username, verified: !!row.isVerified })
})

const wallets = holders.collectors.map((row, i) => {
  const meta = names.get(row.wallet) || {}
  return {
    rank: i + 1,
    username: meta.username || '',
    wallet: row.wallet,
    verified: !!meta.verified,
    boxes: row.boxes,
    rips: 0,
    mythics: 0,
    earnedUsd: 0,
    kinds: {},
    lastAt: null,
    solscan: row.solscan
  }
})

const payload = {
  updatedAt: holders.updatedAt,
  source: 'TRiX BuyPack receipt accounts. One receipt is one sealed box.',
  program: PACK_PROGRAM,
  packConfig: PACK_CONFIG,
  receipts: holders.receipts,
  minted,
  boxEvents: sum,
  walletCount: wallets.length,
  withBoxes: wallets.length,
  wallets
}
fs.writeFileSync(WALLETS, JSON.stringify(payload))

const boxes = JSON.parse(fs.readFileSync(BOXES, 'utf8'))
boxes.updatedAt = holders.updatedAt
boxes.collectors = wallets
boxes.chain = {
  engine: 'receipts',
  source: payload.source,
  program: PACK_PROGRAM,
  packConfig: PACK_CONFIG,
  walletsScanned: wallets.length,
  censusBoxes: sum,
  boxEvents: sum,
  receipts: holders.receipts,
  packMinted: minted,
  updatedAt: holders.updatedAt
}
if (minted != null) boxes.mintedTotal = minted
if (boxes.public && minted != null) boxes.public.boxesMinted = minted
fs.writeFileSync(BOXES, JSON.stringify(boxes, null, 2))

console.log('receipts', holders.receipts, 'minted', minted, 'holders', wallets.length, 'sum', sum)
wallets.slice(0, 15).forEach((row) => {
  console.log('#' + row.rank, row.username || row.wallet.slice(0, 8), row.boxes)
})
console.log('DONE')
