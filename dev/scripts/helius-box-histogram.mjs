/**
 * Histogram TRiX box-treasury inflows so box counts use real paid amounts,
 * not the retired 0.340 SOL meter and not "every transfer = 1 box".
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..')
const ENV = path.join(ROOT, '.env')
const BOX_TREASURY = 'D8LYYHufXvEVAfMKfmv9amKLJjdJejpXAwsM5Wqp3iQe'
const BOX_START = 1788110000

function loadEnv() {
  const out = {}
  fs.readFileSync(ENV, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2]
  })
  return out
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function heliusPage(key, address, before) {
  let url = 'https://api.helius.xyz/v0/addresses/' + encodeURIComponent(address) +
    '/transactions?api-key=' + encodeURIComponent(key) + '&limit=100'
  if (before) url += '&before=' + encodeURIComponent(before)
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(url)
    const text = await res.text()
    if (res.status === 429) {
      await sleep(800 + attempt * 400)
      continue
    }
    if (!res.ok) throw new Error('Helius HTTP ' + res.status + ' ' + text.slice(0, 120))
    return JSON.parse(text)
  }
  throw new Error('Helius rate limited')
}

function classify(amt, units) {
  let best = null
  for (let i = 0; i < units.length; i++) {
    const unit = units[i].lamports
    const boxes = Math.max(1, Math.round(amt / unit))
    if (boxes > 400) continue
    const err = Math.abs(amt - boxes * unit) / (boxes * unit)
    const ok = err <= 0.008 || Math.abs(amt - boxes * unit) <= 20000
    if (!ok) continue
    if (!best || err < best.err) best = { kind: units[i].kind, boxes, err, unit }
  }
  return best
}

async function main() {
  const env = loadEnv()
  const key = env.HELIUS_API_KEY
  if (!key) throw new Error('HELIUS_API_KEY missing')

  const counts = new Map()
  let pages = 0
  let txs = 0
  let inflows = 0
  let newest = 0
  let oldest = 0
  let before = ''

  for (;;) {
    const bag = await heliusPage(key, BOX_TREASURY, before)
    if (!Array.isArray(bag) || !bag.length) break
    pages += 1
    txs += bag.length
    let old = false
    bag.forEach((tx) => {
      const t = num(tx.timestamp)
      if (t && t < BOX_START) old = true
      if (t && (!newest || t > newest)) newest = t
      if (t && (!oldest || t < oldest)) oldest = t
      ;(tx.nativeTransfers || []).forEach((tr) => {
        if (!tr || tr.toUserAccount !== BOX_TREASURY) return
        const amt = Math.abs(Math.floor(num(tr.amount)))
        if (amt < 1) return
        inflows += 1
        counts.set(amt, (counts.get(amt) || 0) + 1)
      })
    })
    before = bag[bag.length - 1].signature
    if (pages % 10 === 0) console.log('pages', pages, 'txs', txs, 'inflows', inflows, 'uniqueAmts', counts.size)
    if (bag.length < 100 || old) break
    await sleep(220)
  }

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
    .map(([amt, n]) => ({ sol: +(amt / 1e9).toFixed(9), lamports: amt, n }))

  const bases = [
    { kind: 'base', lamports: 306039173 },
    { kind: 'base', lamports: 340043526 },
    { kind: 'hype', lamports: 765097933 },
    { kind: 'hype', lamports: 850108815 },
    { kind: 'viral', lamports: 1530195865 },
    { kind: 'viral', lamports: 1700217630 }
  ]

  let matchedInflows = 0
  let boxes = 0
  const kinds = {}
  const unmatched = []
  for (const [amt, n] of counts.entries()) {
    const hit = classify(amt, bases)
    if (hit) {
      matchedInflows += n
      boxes += hit.boxes * n
      kinds[hit.kind] = (kinds[hit.kind] || 0) + hit.boxes * n
    } else if (amt >= 5e7) {
      unmatched.push({ sol: +(amt / 1e9).toFixed(9), lamports: amt, n })
    }
  }
  unmatched.sort((a, b) => b.n - a.n)

  const out = {
    updatedAt: new Date().toISOString(),
    pages,
    txs,
    inflows,
    uniqueAmts: counts.size,
    newest: newest ? new Date(newest * 1000).toISOString() : null,
    oldest: oldest ? new Date(oldest * 1000).toISOString() : null,
    topAmounts: top,
    matchedInflows,
    unmatchedInflows: inflows - matchedInflows,
    boxesIfPriceMatched: boxes,
    kinds,
    unmatchedTop: unmatched.slice(0, 15)
  }
  fs.writeFileSync(path.join(ROOT, 'assets', 'data', 'trix-helius-histogram.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({
    pages,
    txs,
    inflows,
    uniqueAmts: counts.size,
    newest: out.newest,
    matchedInflows,
    boxesIfPriceMatched: boxes,
    kinds,
    top5: top.slice(0, 5),
    unmatchedTop: unmatched.slice(0, 8)
  }, null, 2))
  console.log('DONE')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
