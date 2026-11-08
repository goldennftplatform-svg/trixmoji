'use strict'
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()

// The configured RPC remains authoritative for current state. When it cannot
// return an old transaction/receipt, a fixed fallback may supply it only if
// the receipt's block hash matches the configured RPC's canonical block.
function createHistoryReader(primary, fallback, chainId) {
 if (!primary || !fallback || !Number.isSafeInteger(chainId) || chainId < 1) throw Error('Historical RPC fallback is not configured.')
 const cache = new Map()
 async function pair(hash) {
  if (!/^0x[a-f0-9]{64}$/i.test(String(hash || ''))) throw Error('Invalid historical transaction hash.')
  if (!cache.has(hash)) cache.set(hash, (async () => {
   if ((await fallback.getNetwork()).chainId !== chainId) throw Error('Historical RPC is on the wrong network.')
   const [tx, receipt] = await Promise.all([fallback.getTransaction(hash), fallback.getTransactionReceipt(hash)])
   if (!tx || !receipt) return { tx: null, receipt: null }
   if (!same(tx.hash, hash) || !same(receipt.transactionHash, hash) || !Number.isSafeInteger(receipt.blockNumber) || receipt.blockNumber < 0 || !same(tx.blockHash, receipt.blockHash) || tx.blockNumber !== receipt.blockNumber) throw Error('Historical transaction and receipt do not match.')
   const canonical = await primary.getBlock(receipt.blockNumber)
   if (!canonical || !same(canonical.hash, receipt.blockHash)) throw Error('Historical receipt does not match the configured RPC chain.')
   return { tx, receipt }
  })())
  return cache.get(hash)
 }
 async function first(method, hash, field) {
  try { const value = await primary[method](hash); if (value) return value } catch (_) { /* Try the pinned fallback. */ }
  return (await pair(hash))[field]
 }
 return { getTransaction: hash => first('getTransaction', hash, 'tx'), getTransactionReceipt: hash => first('getTransactionReceipt', hash, 'receipt') }
}
module.exports = { createHistoryReader }
