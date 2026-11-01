'use strict'

/** Incoming DOSWAPZ treasuries. Mail Gate pay-to-pass uses all three. */
const SOL_TREASURY = '5tJbQX5vRxDyHNEXdAmLEWtKR8EyrDTRdYtBFqujmpAc'
const ETH_TREASURY = '0x5be58476DF379BAdc88b552F603db227C0D95bac'
const BTC_TREASURY = 'bc1qtwqxrsj8ur8zyp9ku47dx6ljhc9dxmjc8j4t2g'

const MAIL_FEE_SOL_LAMPORTS = 10000000 // 0.01 SOL
const MAIL_FEE_ETH_WEI = '200000000000000' // 0.0002 ETH
const MAIL_FEE_BTC_SATS = 10000 // 0.0001 BTC

function eqAddr(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
}

async function verifyBtc(txid, minSats) {
  const id = String(txid || '').trim()
  if (!/^[0-9a-fA-F]{64}$/.test(id)) throw new Error('Invalid BTC txid')
  const res = await fetch('https://blockstream.info/api/tx/' + encodeURIComponent(id), {
    headers: { Accept: 'application/json' }
  })
  if (!res.ok) throw new Error('BTC tx not found yet')
  const tx = await res.json()
  let paid = 0
  const vouts = Array.isArray(tx.vout) ? tx.vout : []
  for (let i = 0; i < vouts.length; i++) {
    const addr = vouts[i].scriptpubkey_address || vouts[i].scriptpubkey_address_asm
    if (eqAddr(addr, BTC_TREASURY)) paid += Number(vouts[i].value || 0)
  }
  if (paid < Number(minSats || MAIL_FEE_BTC_SATS)) {
    throw new Error('BTC tx did not pay the Mail Gate address')
  }
  return { chain: 'btc', txid: id, amount: String(paid), to: BTC_TREASURY }
}

module.exports = {
  SOL_TREASURY,
  ETH_TREASURY,
  BTC_TREASURY,
  MAIL_FEE_SOL_LAMPORTS,
  MAIL_FEE_ETH_WEI,
  MAIL_FEE_BTC_SATS,
  eqAddr,
  verifyBtc
}
