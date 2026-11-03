'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const from = '0x' + '1'.repeat(40), to = '0x' + '2'.repeat(40), id = '0x' + 'a'.repeat(64), hash = '0x' + 'b'.repeat(64)
function fixture(overrides = {}) {
 const values = new Map(), root = { localStorage: { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v) }, navigator: { locks: { request: async (_, __, fn) => fn({}) } } }, module = { exports: {} }, calls = []
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../assets/js/core/clean-pop-transfer-checkout.js'), 'utf8'), { module, window: root, BigInt, Date, Error, setTimeout, clearTimeout })
 const provider = { request: async q => { calls.push(q); if (overrides[q.method]) return overrides[q.method](q); return { eth_chainId: '0x1', eth_accounts: [from], eth_getCode: '0x', eth_getTransactionCount: '0x10', eth_sendTransaction: hash }[q.method] } }
 const options = { provider, id, from, to, tokenNo: 6, gas: '30000', gasWei: '1000', preflight: async () => {}, review: async q => q.approve() }
 return { api: module.exports, root, provider, calls, options }
}
test('real-transfer request uses zero ETH and the exact Ethscription ID only after review', async () => {
 const f = fixture(); let sawReview = false
 f.options.review = q => { sawReview = true; assert.equal(f.calls.some(x => x.method === 'eth_sendTransaction'), false); return q.approve() }
 const row = await f.api.send(f.options), tx = f.calls.find(x => x.method === 'eth_sendTransaction').params[0]
 assert.equal(sawReview, true); assert.equal(row.state, 'submitted'); assert.equal(tx.from, from); assert.equal(tx.to, to); assert.equal(tx.value, '0x0'); assert.equal(tx.data, id)
 await assert.rejects(f.api.send(f.options), /previous saved transfer/)
 await f.api.reconcile(row, async () => ({ complete: true, id, hash, from, to, currentOwner: to }))
 assert.equal(f.api.records()[0].state, 'complete')
})
test('unknown wallet outcome remains saved and recovery checks nonce and indexed owner', async () => {
 const f = fixture({ eth_sendTransaction: () => { throw Error('wallet disconnected') } })
 await assert.rejects(f.api.send(f.options), /disconnected/); assert.equal(f.api.records()[0].state, 'awaiting-wallet')
 await assert.rejects(f.api.recoverUnsent({ provider: f.provider, id, from, confirmed: true, verifyOwner: async () => ({ owned: false }) }), /no longer shows/)
 assert.equal((await f.api.recoverUnsent({ provider: f.provider, id, from, confirmed: true, verifyOwner: async () => ({ owned: true, currentOwner: from }) })).recovered, true)
 assert.equal(f.api.records().length, 0)
})
test('wrong account or pending nonce blocks a transfer before wallet approval', async () => {
 for (const override of [{ eth_accounts: () => [to] }, { eth_getTransactionCount: q => q.params[1] === 'pending' ? '0x11' : '0x10' }]) {
  const f = fixture(override); await assert.rejects(f.api.send(f.options)); assert.equal(f.calls.some(x => x.method === 'eth_sendTransaction'), false)
 }
})
test('a delegated smart account is blocked before a wallet transfer request', async () => {
 const f = fixture({ eth_getCode: () => '0xef0100' + '11'.repeat(20) })
 await assert.rejects(f.api.send(f.options), /smart-account wallets are not yet supported/)
 assert.equal(f.calls.some(x => x.method === 'eth_sendTransaction'), false)
})
test('no-hash recovery refuses a changed nonce or unconfirmed user acknowledgement', async () => {
 const f = fixture({ eth_sendTransaction: () => { throw Error('wallet disconnected') } })
 await assert.rejects(f.api.send(f.options), /disconnected/)
 await assert.rejects(f.api.recoverUnsent({ provider: f.provider, id, from, confirmed: false, verifyOwner: async () => ({ owned: true, currentOwner: from }) }), /Confirm/)
 const original = f.provider.request
 f.provider.request = q => q.method === 'eth_getTransactionCount' ? Promise.resolve('0x11') : original(q)
 await assert.rejects(f.api.recoverUnsent({ provider: f.provider, id, from, confirmed: true, verifyOwner: async () => ({ owned: true, currentOwner: from }) }), /nonce changed/)
 assert.equal(f.api.records()[0].state, 'awaiting-wallet')
})
