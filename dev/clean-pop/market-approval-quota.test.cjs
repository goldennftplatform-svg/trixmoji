'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const { createQuota } = require('../../api/lib/market-approval-quota')
const wallet = '0x1111111111111111111111111111111111111111'
function store() {
 let row = null, version = 0
 return { getWithMetadata: async () => row && { data: { ...row }, etag: String(version) },
  setJSON: async (_, value, options) => {
   if (options.onlyIfNew && row) return { modified: false }
   if (options.onlyIfMatch && options.onlyIfMatch !== String(version)) return { modified: false }
   row = { ...value }; version++; return { modified: true }
  } }
}
test('atomic wallet quota rejects excess simultaneous authorizations', async () => {
 const consume = createQuota({ store: store(), perMinute: 3, now: () => 120000 })
 const results = await Promise.all(Array.from({ length: 8 }, () => consume(wallet)))
 assert.equal(results.filter(Boolean).length, 3)
})
test('quota fails closed for invalid storage, wallet, or future clock state', async () => {
 assert.throws(() => createQuota({ store: {} }), /not configured/)
 const backing = store(), consume = createQuota({ store: backing, perMinute: 1, now: () => 120000 })
 await assert.rejects(consume('not-a-wallet'), /Invalid/)
 assert.equal(await consume(wallet), true); assert.equal(await consume(wallet), false)
 const backwards = createQuota({ store: backing, perMinute: 1, now: () => 60000 })
 await assert.rejects(backwards(wallet), /state is invalid/)
})
test('wallet proof nonce is accepted only once, including simultaneous submissions', async () => {
 const consume=createQuota({store:store(),perMinute:8,now:()=>120000}),proof={nonce:'0x'+'ab'.repeat(16),expires:240}
 const results=await Promise.all(Array.from({length:5},()=>consume(wallet,proof)))
 assert.equal(results.filter(Boolean).length,1)
 assert.equal(await consume(wallet,{nonce:'0x'+'cd'.repeat(16),expires:240}),true)
})
