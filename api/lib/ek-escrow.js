'use strict'

/**
 * E.K. crypto escrow rules.
 * The sale principal stays intact. DOSWAPZ takes no fee from it.
 * Any yield left in the escrow wallet after a full release or refund belongs to DOSWAPZ.
 * A dispute freezes the full principal until both sides accept the same outcome.
 */

const SHIP_MS = 3 * 24 * 60 * 60 * 1000
const QUIET_MS = 3 * 24 * 60 * 60 * 1000

const DISPUTES = {
  'not-received': 'NOT RECEIVED',
  'not-as-described': 'NOT AS DESCRIBED',
  damaged: 'DAMAGED'
}

const DEFAULTS = {
  solana: '3btL8c8HaFXqRqzA6TwsYK4Bq5aANP2KtpxiH4v9tgqt',
  ethereum: '0x15e85a85B7026875d3529EF0c6de2723C285DA11',
  bitcoin: 'bc1qnm46ngy8nf5vfwsengrrjsuwpvknd8xm8mn7pq'
}

const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

function bech32Polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
  let chk = 1
  for (let p = 0; p < values.length; p++) {
    const top = chk >>> 25
    chk = ((chk & 0x1ffffff) << 5) ^ values[p]
    for (let i = 0; i < 5; i++) {
      if ((top >>> i) & 1) chk ^= GEN[i]
    }
  }
  return chk
}

function bech32Expand(hrp) {
  const out = []
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5)
  out.push(0)
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31)
  return out
}

function canonicalBitcoin(address) {
  const raw = String(address || '').trim()
  if (!raw || (raw !== raw.toLowerCase() && raw !== raw.toUpperCase())) return ''
  const lower = raw.toLowerCase()
  const pos = lower.lastIndexOf('1')
  if (pos < 1 || pos + 7 > lower.length || lower.length > 90) return ''
  const hrp = lower.slice(0, pos)
  if (hrp !== 'bc') return ''
  const data = []
  for (let i = pos + 1; i < lower.length; i++) {
    const v = BECH32.indexOf(lower.charAt(i))
    if (v < 0) return ''
    data.push(v)
  }
  if (bech32Polymod(bech32Expand(hrp).concat(data)) !== 1) return ''
  if (data[0] !== 0) return ''
  return lower
}

function isCrypto(row) {
  return !!(row && row.rail && row.rail !== 'paypal')
}

function principal(row) {
  return String((row && (row.payUnits || row.units)) || '0')
}

function notice(row) {
  const phase = row && row.escrowPhase
  if (phase === 'locked') return 'Funds are in escrow. The seller has not been paid. DOSWAPZ fee is zero.'
  if (phase === 'shipped') return 'Shipping proof is posted. The full amount stays in escrow until the buyer receives the item, or for 3 days if the buyer does not open a dispute.'
  if (phase === 'disputed') return 'The full amount is frozen. It moves only when both sides accept a full refund or a full release. DOSWAPZ does not take a fee and does not pick a winner.'
  if (phase === 'release') return 'Release is authorized. The seller receives the full amount. DOSWAPZ fee is zero.'
  if (phase === 'refund') return 'Refund is authorized. The buyer receives the full amount back. DOSWAPZ fee is zero.'
  if (phase === 'settled' && row.releaseTo === 'buyer') return 'The buyer was paid the full amount back. DOSWAPZ fee was zero.'
  if (phase === 'settled') return 'The seller was paid the full amount. DOSWAPZ fee was zero.'
  return ''
}

function setNotice(row) {
  row.escrowNotice = notice(row)
  row.feeUnits = '0'
}

function authorizeRelease(row, now) {
  row.escrowPhase = 'release'
  row.releaseTo = 'seller'
  row.releaseAddress = row.payout
  row.releaseUnits = principal(row)
  row.releaseAt = new Date(now).toISOString()
  setNotice(row)
}

function authorizeRefund(row, now) {
  row.escrowPhase = 'refund'
  row.releaseTo = 'buyer'
  row.releaseAddress = row.buyer
  row.releaseUnits = principal(row)
  row.releaseAt = new Date(now).toISOString()
  setNotice(row)
}

function lock(row, iso, buyer, buyerUid) {
  row.status = 'escrow'
  row.escrowPhase = 'locked'
  row.escrowAt = iso
  row.proofAt = ''
  row.buyer = buyer
  row.buyerUid = buyerUid || ''
  row.releaseTo = ''
  row.releaseAddress = ''
  row.releaseUnits = principal(row)
  row.releaseAt = ''
  row.settleTx = ''
  row.disputeReason = ''
  row.disputeNote = ''
  row.disputeAt = ''
  setNotice(row)
}

function markProof(row, iso) {
  if (!isCrypto(row)) return false
  if (!row.escrowPhase || row.escrowPhase === 'settled') return false
  if (row.escrowPhase === 'release' || row.escrowPhase === 'refund') return false
  if (row.proofAt) return false
  row.proofAt = iso
  if (!row.shippedAt) row.shippedAt = iso
  if (row.escrowPhase === 'locked') row.escrowPhase = 'shipped'
  setNotice(row)
  return true
}

function received(row, now) {
  if (!isCrypto(row)) return 'paypal'
  if (row.escrowPhase === 'settled') return 'settled'
  if (row.escrowPhase === 'disputed') return 'disputed'
  if (row.escrowPhase === 'release' || row.escrowPhase === 'refund') return 'late'
  if (row.escrowPhase !== 'shipped' || !row.proofAt) return 'proof'
  authorizeRelease(row, now)
  return 'ok'
}

function problem(row, now, reason, note) {
  if (!isCrypto(row)) return 'paypal'
  if (!DISPUTES[reason]) return 'reason'
  if (row.escrowPhase === 'settled' || row.escrowPhase === 'release' || row.escrowPhase === 'refund') return 'late'
  if (row.escrowPhase !== 'locked' && row.escrowPhase !== 'shipped' && row.escrowPhase !== 'disputed') return 'closed'
  row.escrowPhase = 'disputed'
  row.disputeReason = reason
  row.disputeNote = note || ''
  row.disputeAt = new Date(now).toISOString()
  setNotice(row)
  return 'ok'
}

function acceptRefund(row, now) {
  if (!row || row.escrowPhase !== 'disputed') return 'closed'
  authorizeRefund(row, now)
  return 'ok'
}

function dropDispute(row, now) {
  if (!row || row.escrowPhase !== 'disputed') return 'closed'
  row.disputeReason = ''
  row.disputeNote = ''
  row.disputeAt = ''
  if (row.proofAt) {
    row.escrowPhase = 'shipped'
    row.proofAt = new Date(now).toISOString()
  } else {
    row.escrowPhase = 'locked'
  }
  setNotice(row)
  return 'ok'
}

function advance(row, now) {
  if (!isCrypto(row)) return false
  if (!row.escrowPhase || row.escrowPhase === 'settled') return false
  if (row.escrowPhase === 'disputed' || row.escrowPhase === 'release' || row.escrowPhase === 'refund') return false
  const lockedAt = Date.parse(row.escrowAt || '')
  if (!lockedAt) return false
  if (row.escrowPhase === 'locked') {
    if (now >= lockedAt + SHIP_MS) {
      authorizeRefund(row, now)
      return true
    }
    return false
  }
  if (row.escrowPhase === 'shipped') {
    const proofAt = Date.parse(row.proofAt || '')
    if (proofAt && now >= proofAt + QUIET_MS) {
      authorizeRelease(row, now)
      return true
    }
  }
  return false
}

function advanceAll(listings, now) {
  let changed = false
  ;(listings || []).forEach(function (row) {
    if (advance(row, now)) changed = true
  })
  return changed
}

function owed(row) {
  if (!isCrypto(row)) return false
  const phase = row.escrowPhase
  return phase === 'locked' || phase === 'shipped' || phase === 'disputed' || phase === 'release' || phase === 'refund'
}

function books(listings) {
  const locked = { sol: '0', 'usdc-sol': '0', eth: '0', 'usdc-eth': '0' }
  const counts = { locked: 0, shipped: 0, disputed: 0, release: 0, refund: 0 }
  ;(listings || []).forEach(function (row) {
    if (!owed(row)) return
    if (Object.prototype.hasOwnProperty.call(locked, row.rail)) {
      locked[row.rail] = (BigInt(locked[row.rail]) + BigInt(principal(row))).toString()
    }
    if (Object.prototype.hasOwnProperty.call(counts, row.escrowPhase)) counts[row.escrowPhase] += 1
  })
  return { locked: locked, counts: counts, fee: '0' }
}

function shipBy(row) {
  const at = Date.parse((row && row.escrowAt) || '')
  if (!at || !row || row.escrowPhase === 'settled') return ''
  if (row.escrowPhase !== 'locked') return ''
  return new Date(at + SHIP_MS).toISOString()
}

function quietUntil(row) {
  if (!row || row.escrowPhase !== 'shipped') return ''
  const at = Date.parse(row.proofAt || '')
  if (!at) return ''
  return new Date(at + QUIET_MS).toISOString()
}

module.exports = {
  SHIP_MS,
  QUIET_MS,
  DISPUTES,
  DEFAULTS,
  canonicalBitcoin,
  isCrypto,
  principal,
  notice,
  lock,
  markProof,
  received,
  problem,
  acceptRefund,
  dropDispute,
  advance,
  advanceAll,
  owed,
  books,
  shipBy,
  quietUntil
}
