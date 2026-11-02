'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const { ownership, verify, plan } = require('../../api/lib/clean-pop-transfer')
const id = '0x' + 'a'.repeat(64), hash = '0x' + 'b'.repeat(64), from = '0x' + '1'.repeat(40), to = '0x' + '2'.repeat(40)
function fixture() {
 let indexed = false
 const chain = { isHash: x => /^0x[a-f0-9]{64}$/i.test(x), isAddr: x => /^0x[a-f0-9]{40}$/i.test(x), same: (a, b) => String(a).toLowerCase() === String(b).toLowerCase(),
  readCreation: async () => ({ tokenNo: 6, preview: '/assets/ethscriptions/clean-pop-v1/6.png' }), indexedOwnership: async () => ({ owned: true, currentOwner: from }),
  readTransfer: async () => ({ id, hash, from, to, value: '0' }), requireIndexedTransfer: async () => { indexed = true; return { current_owner: to } } }
 return { chain, indexed: () => indexed }
}
test('transfer ownership lookup returns only a verified Clean Pop creation', async () => {
 const f = fixture(), result = await ownership(f.chain, id, from)
 assert.equal(result.owned, true); assert.equal(result.tokenNo, 6); assert.equal(result.preview, '/assets/ethscriptions/clean-pop-v1/6.png')
 f.chain.readCreation = async () => ({ tokenNo: 6, preview: 'https://other.invalid/6.png' })
 await assert.rejects(ownership(f.chain, id, from), /not a verified Clean Pop/)
})
test('transfer verifies calldata, sender, recipient, zero value and indexer', async () => {
 const f = fixture(), result = await verify(f.chain, id, hash, from, to)
 assert.equal(result.complete, true); assert.equal(result.currentOwner, to); assert.equal(f.indexed(), true)
 const bad = fixture(); bad.chain.readTransfer = async () => ({ id, hash, from, to, value: '1' })
 await assert.rejects(verify(bad.chain, id, hash, from, to), /does not match/); assert.equal(bad.indexed(), false)
})
test('transfer plan checks ownership and estimates only the exact zero-value transfer', async () => {
 const f = fixture(), calls = []
 const rpc = async (method, params) => { calls.push({ method, params }); if (method === 'eth_chainId') return '0x1'; if (method === 'eth_estimateGas') return '0x7000'; if (method === 'eth_gasPrice') return '0x10'; throw Error(method) }
 const result = await plan(f.chain, rpc, id, from, to)
 assert.equal(result.readOnly, true); assert.equal(result.estimatedGas, '28672')
 const tx = calls.find(x => x.method === 'eth_estimateGas').params[0]
 assert.equal(tx.from, from); assert.equal(tx.to, to); assert.equal(tx.value, '0x0'); assert.equal(tx.data, id)
 assert.equal(calls.some(x => x.method === 'eth_sendTransaction'), false)
 f.chain.indexedOwnership = async () => ({ owned: false, currentOwner: to })
 await assert.rejects(plan(f.chain, rpc, id, from, to), /does not show/)
})
