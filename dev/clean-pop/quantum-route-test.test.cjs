'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), { ethers } = require('ethers')
const { create } = require('../../assets/js/core/quantum-route-test')
const owner = '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E', recipient = '0x5f5d219c6B3f732eBDCe4BFD9c4655957Ff472C4', id = ethers.utils.id('test data'), hash = ethers.utils.id('test transaction'), code = '0xef010063c0c19a282a1b52b07dd5a65b58948a07dae32b', oldKey = 'trixmoji.ethscription.route-probe.v1'
function fixture({ wrapped = false, old = null, pending = false, sendError = false } = {}) {
 const values = new Map(), calls = []; if (old) values.set(oldKey, JSON.stringify(old))
 const provider = { request: async q => {
  calls.push(q)
  if (q.method === 'eth_chainId') return '0x1'
  if (q.method === 'eth_accounts') return [owner]
  if (q.method === 'eth_getCode') return q.params[0].toLowerCase() === owner.toLowerCase() ? code : '0x'
  if (q.method === 'eth_getTransactionCount') return pending && q.params[1] === 'pending' ? '0xb' : '0xa'
  if (q.method === 'eth_sendTransaction') { assert.deepEqual(Object.keys(q.params[0]).sort(), ['data', 'from', 'to', 'value']); assert.equal(q.params[0].to, recipient); assert.equal(q.params[0].value, '0x0'); assert.equal(q.params[0].data, id); if (sendError) throw Error('wallet disconnected'); return hash }
  if (q.method === 'eth_getTransactionByHash') return { hash, from: owner, to: wrapped ? '0x1111111111111111111111111111111111111111' : recipient, input: wrapped ? '0x1234' + recipient.slice(2).toLowerCase() + id.slice(2) : id, value: '0x0', nonce: '0xa' }
  if (q.method === 'eth_getTransactionReceipt') return { transactionHash: hash, status: '0x1', blockNumber: '0x100' }
  throw Error('Unexpected RPC: ' + q.method)
 } }
 const storage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }
 let locked = false
 const locks = { request: async (_, __, fn) => { if (locked) return fn(null); locked = true; try { return await fn({}) } finally { locked = false } } }
 return { calls, values, provider, api: create({ provider, storage, locks, generateData: () => id, isUnused: async () => true }) }
}
test('uses only the Quantum request fields and recognizes a direct transaction', async () => {
 const f = fixture(), row = await f.api.run(false, q => { assert.equal(f.calls.some(x => x.method === 'eth_sendTransaction'), false); return q.approve() })
 assert.equal(row.state, 'submitted'); assert.equal((await f.api.check(hash)).direct, true); assert.equal(f.api.saved().state, 'direct')
})
test('recognizes a wrapped transaction instead of claiming a direct route', async () => {
 const f = fixture({ wrapped: true }); await f.api.run(false, q => q.approve()); assert.equal((await f.api.check(hash)).direct, false)
})
test('previous no-hash requests require confirmation and an unchanged nonce', async () => {
 const old = { state: 'awaiting-wallet', hash: '', nonce: '10' }, f = fixture({ old })
 await assert.rejects(f.api.run(false, q => q.approve()), /Confirm the earlier failed test/)
 assert.ok(f.values.has(oldKey)); assert.equal(f.calls.some(x => x.method === 'eth_sendTransaction'), false)
 const g = fixture({ old, pending: true }); await assert.rejects(g.api.run(true, q => q.approve()), /pending transaction/); assert.ok(g.values.has(oldKey))
 const h = fixture({ old }); await h.api.run(true, q => q.approve()); assert.equal(h.values.has(oldKey), false); assert.ok([...h.values.keys()].some(k => k.startsWith(oldKey + '.archive.')))
})
test('review cancellation does not request a wallet transaction', async () => {
 const f = fixture(); await assert.rejects(f.api.run(false, async () => { throw Error('cancelled') }), /cancelled/); assert.equal(f.calls.some(x => x.method === 'eth_sendTransaction'), false)
})
test('no-hash recovery requires confirmation and rejects changed or pending nonces', async () => {
 const f = fixture({ sendError: true }); await assert.rejects(f.api.run(false, q => q.approve()), /disconnected/)
 assert.equal(f.api.saved().state, 'awaiting-wallet'); await assert.rejects(f.api.recoverUnsent(false), /Confirm in MetaMask/)
 const original = f.provider.request; f.provider.request = q => q.method === 'eth_getTransactionCount' && q.params[1] === 'pending' ? Promise.resolve('0xb') : original(q)
 await assert.rejects(f.api.recoverUnsent(true), /nonce changed or a transaction is pending/); assert.equal(f.api.saved().state, 'awaiting-wallet')
 f.provider.request = original; assert.equal((await f.api.recoverUnsent(true)).recovered, true); assert.equal(f.api.saved(), null)
 assert.ok([...f.values.keys()].some(k => k.startsWith('trixmoji.quantum-route-test.v1.archive.')))
})
test('an in-flight wallet request cannot be cleared while its lock is held', async () => {
 const f = fixture(), original = f.provider.request; let rejectWallet
 f.provider.request = q => q.method === 'eth_sendTransaction' ? new Promise((_, reject) => { rejectWallet = reject }) : original(q)
 const run = f.api.run(false, q => q.approve()); while (!rejectWallet) await new Promise(resolve => setImmediate(resolve))
 await assert.rejects(f.api.recoverUnsent(true), /wallet request is still open/)
 rejectWallet(Object.assign(Error('rejected'), { code: 4001 })); await assert.rejects(run, /rejected/); assert.equal(f.api.saved(), null)
})
