'use strict'
const crypto = require('crypto')

// A single strongly-consistent record per authenticated wallet. Never fall
// back to process memory if the backing store cannot do conditional writes.
function createQuota({ store, perMinute = 8, now = () => Date.now() }) {
 if (!store || typeof store.getWithMetadata !== 'function' || typeof store.setJSON !== 'function' || !Number.isInteger(perMinute) || perMinute < 1 || perMinute > 60) throw Error('Atomic market approval quota is not configured.')
 return async function consume(wallet) {
  if (!/^0x[a-f0-9]{40}$/i.test(String(wallet || ''))) throw Error('Invalid authenticated wallet.')
  const key = 'wallet-' + crypto.createHash('sha256').update(wallet.toLowerCase()).digest('hex')
  for (let attempt = 0; attempt < 12; attempt++) {
   const minute = Math.floor(now() / 60000), existing = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' })
   let count = 0
   if (existing) {
    const value = existing.data
    if (!existing.etag || !value || !Number.isSafeInteger(value.minute) || !Number.isSafeInteger(value.count) || value.count < 0 || value.minute > minute) throw Error('Market approval quota state is invalid.')
    if (value.minute === minute) count = value.count
   }
   if (count >= perMinute) return false
   const result = await store.setJSON(key, { minute, count: count + 1 }, existing ? { onlyIfMatch: existing.etag } : { onlyIfNew: true })
   if (result && result.modified === true) return true
  }
  throw Error('Market approval quota is busy. Please retry.')
 }
}
module.exports = { createQuota }
