'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), { ethers } = require('ethers')
const config = require('../../assets/data/trixmoji-escrow-deployment.json'), artifact = require('../../assets/data/trixmoji-escrow-artifact.json')
const owner = '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E', id = '0xdf234357362b4884a50aa356f0cc6c76a52e72634c29c8e7440ca8232e285e74', hash = ethers.utils.id('escrow test'), iface = new ethers.utils.Interface(artifact.abi), block = 100
function fixture({ pendingRoute = false, wrapped = false, stale = false, pendingNonce = false, heldLock = '', submitted = false } = {}) {
 const values = new Map(), calls = []; let sent = submitted
 if (submitted) values.set('trixmoji.clean-pop.6.direct-escrow-test.v1', JSON.stringify({ state: 'submitted', from: owner, to: config.address, data: id, hash, startingNonce: '10' }))
 if (pendingRoute) values.set('trixmoji.quantum-route-test.v1', JSON.stringify({ state: 'awaiting-wallet', hash: '' }))
 const storage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }
 const provider = { request: async q => {
  calls.push(q)
  if (q.method === 'eth_chainId') return '0x1'
  if (q.method === 'eth_accounts') return [owner]
  if (q.method === 'eth_getCode') return '0x6000'
  if (q.method === 'eth_blockNumber') return '0x69'
  if (q.method === 'eth_getTransactionCount') return pendingNonce && q.params[1] === 'pending' ? '0xb' : '0xa'
  if (q.method === 'eth_estimateGas') return '0xb6e5'
  if (q.method === 'eth_call') {
   const d = q.params[0].data
   if (d === iface.encodeFunctionData('creator')) return iface.encodeFunctionResult('creator', [config.creator])
   if (d === iface.encodeFunctionData('verifier')) return iface.encodeFunctionResult('verifier', [config.verifier])
   if (d === iface.encodeFunctionData('depositBlock', [owner, id])) return iface.encodeFunctionResult('depositBlock', [sent ? block : 0])
   assert.equal(d, id); return '0x'
  }
  if (q.method === 'eth_sendTransaction') { assert.deepEqual(Object.keys(q.params[0]).sort(), ['data', 'from', 'to', 'value']); assert.equal(q.params[0].to, config.address); assert.equal(q.params[0].data, id); sent = true; return hash }
  if (q.method === 'eth_getTransactionByHash') return { hash, from: owner, to: wrapped ? config.verifier : config.address, input: wrapped ? '0x1234' : id, nonce: '0xa', value: '0x0' }
  if (q.method === 'eth_getTransactionReceipt') { const log = iface.encodeEventLog(iface.getEvent('Deposited'), [owner, id, block]); return { transactionHash: hash, status: '0x1', blockNumber: '0x64', logs: [{ address: config.address, ...log }] } }
  throw Error('Unexpected method ' + q.method)
 } }
 // Substitute a synthetic code pin in this isolated VM fixture only. Production
 // keeps the literal hash of the verified deployed contract.
 const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path')
 const source = fs.readFileSync(path.resolve(__dirname, '../../assets/js/core/clean-pop-6-escrow-test.js'), 'utf8')
 const module = { exports: {} }; vm.runInNewContext(source.replace(config.runtimeHash, ethers.utils.keccak256('0x6000')), { module, require, Promise, Date, Error, BigInt, Number, String, JSON })
 const api = module.exports.create({ provider, storage, locks: { request: async (key, _, fn) => fn(key === heldLock ? null : {}) }, readStatus: async () => ({ last_imported_block: stale ? 99 : 105 }), readAsset: async () => ({ transaction_hash: id, creator: '0x11019B7af0F833f5695a44584c5B31Bb1D0baabC', current_owner: sent && !wrapped ? config.address : owner, previous_owner: owner, ethscription_transfers: sent ? [{ transaction_hash: hash, from_address: owner, to_address: config.address, block_number: block }] : [] }) })
 return { api, calls, values }
}
test('the closed deposit experiment cannot submit another wallet transaction', async () => {
 const f = fixture(); await assert.rejects(f.api.run(q => q.approve()), /experiment is closed/)
 assert.equal(f.calls.some(x => x.method === 'eth_sendTransaction'), false)
})
test('a previously saved direct deposit still requires indexed custody for verification', async () => {
 const f = fixture({ submitted: true }); assert.equal((await f.api.check(hash)).state, 'verified')
})
test('an unresolved route request blocks a deposit without sending', async () => {
 const f = fixture({ pendingRoute: true }); await assert.rejects(f.api.plan(), /earlier wallet-route test/); assert.equal(f.calls.some(x => x.method === 'eth_sendTransaction'), false)
})
test('wrapped deposits are explicitly unverified and cannot be repeated', async () => {
 const f = fixture({ wrapped: true, submitted: true }); assert.equal((await f.api.check(hash)).state, 'wrapped-unverified'); await assert.rejects(f.api.run(q => q.approve()), /experiment is closed/)
})
test('stale indexing blocks preparation without a transaction', async () => {
 const f = fixture({ stale: true }); await assert.rejects(f.api.plan(), /indexer is catching up/); assert.equal(f.calls.some(x => x.method === 'eth_sendTransaction'), false)
})
function seedRoute(f, key = 'trixmoji.quantum-route-test.v1', changes = {}) {
 f.values.set(key, JSON.stringify({ state: 'awaiting-wallet', from: owner, to: config.verifier, data: hash, startingNonce: '10', hash: '', ...changes }))
}
test('no-gas route recovery archives matching records and unblocks preparation', async () => {
 const f = fixture(); seedRoute(f)
 seedRoute(f, 'trixmoji.ethscription.route-probe.v1', { startingNonce: undefined, nonce: '10', to: '0x000000000000000000000000000000000000dEaD' })
 await assert.rejects(f.api.clearEarlierRoutes(false), /First confirm/)
 assert.equal((await f.api.clearEarlierRoutes(true)).cleared, 2); assert.equal(f.api.earlierRoutes().length, 0)
 assert.equal([...f.values.keys()].filter(k => k.includes('.archive.')).length, 2)
 assert.equal((await f.api.plan()).tx.data, id); assert.equal(f.calls.some(q => q.method === 'eth_sendTransaction'), false)
})
test('route recovery refuses hashes, changed nonces, pending transactions and live request locks', async () => {
 for (const [options, changes, message] of [
  [{}, { hash }, /transaction hash/], [{}, { startingNonce: '9' }, /nonce changed/], [{ pendingNonce: true }, {}, /nonce changed/], [{ heldLock: 'trixmoji.quantum-route-test' }, {}, /still running/], [{ heldLock: 'trixmoji.ethscription.route-probe' }, {}, /still running/]
 ]) {
  const f = fixture(options); seedRoute(f, undefined, changes)
  await assert.rejects(f.api.clearEarlierRoutes(true), message); assert.equal(f.api.earlierRoutes().length, 1); assert.equal(f.calls.some(q => q.method === 'eth_sendTransaction'), false)
 }
})
