'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), { ethers } = require('ethers')
const artifact = require('../../assets/data/clean-pop-minter.json')
const creator = '0x1111111111111111111111111111111111111111', recipient = '0x2222222222222222222222222222222222222222', contract = '0x3333333333333333333333333333333333333333', legacyId = '0x' + 'a'.repeat(64), hash = '0x' + 'b'.repeat(64)
function fixture(overrides = {}) {
 const data = new Map(), root = { ethers, localStorage: { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v) }, navigator: { locks: { request: async (_, __, fn) => fn({}) } } }, module = { exports: {} }, calls = []
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../assets/js/core/clean-pop-delivery-checkout.js'), 'utf8'), { module, window: root, BigInt, Date, Error, setTimeout, clearTimeout })
 const provider = { request: async q => { calls.push(q); if (overrides[q.method]) return overrides[q.method](q); return { eth_chainId: '0x1', eth_accounts: [creator], eth_getCode: '0x6000', eth_call: '0x' + '0'.repeat(64), eth_getTransactionCount: '0x10', eth_sendTransaction: hash }[q.method] } }
 const info = { creator, address: contract, runtime: '0x6000', abi: artifact.abi }
 const calldata = new ethers.utils.Interface(artifact.abi).encodeFunctionData('deliverReplacement', ['data:image/png;base64,YQ==', Array(14).fill('0x' + '0'.repeat(64)), 0, legacyId, recipient])
 const options = { provider, info, tokenNo: 0, legacyId, recipient, tx: { from: creator, to: contract, value: '0x0', data: calldata, gas: '0x1000' }, preflight: async () => {}, review: async q => q.approve() }
 return { api: module.exports, root, provider, calls, info, options }
}
test('creator delivery saves its intent, requests the wallet once, then waits for indexed confirmation', async () => {
 const f = fixture(), row = await f.api.send(f.options)
 assert.equal(row.hash, hash); assert.equal(row.state, 'submitted')
 assert.equal(f.calls.filter(q => q.method === 'eth_sendTransaction').length, 1)
 await assert.rejects(f.api.send(f.options), /previous creator delivery/)
 await assert.rejects(f.api.reconcile(row, async () => ({ complete: false })), /pending/)
 await f.api.reconcile(row, async () => ({ complete: true }))
 assert.equal(f.api.records()[0].state, 'complete')
})
test('cancelled review and altered destination cannot submit a delivery', async () => {
 const f = fixture(); f.options.review = async () => { throw Error('cancelled') }
 await assert.rejects(f.api.send(f.options), /cancelled/)
 await assert.rejects(f.api.send({ ...f.options, tx: { ...f.options.tx, to: recipient } }), /does not match/)
 await assert.rejects(f.api.send({ ...f.options, recipient: creator }), /calldata does not match/)
 assert.equal(f.calls.some(q => q.method === 'eth_sendTransaction'), false)
})
test('no-hash recovery refuses pending nonces and already-used tokens, and sends no transaction', async () => {
 for (const override of [ { eth_getTransactionCount: q => q.params[1] === 'pending' ? '0x11' : '0x10' }, { eth_call: () => '0x' + '0'.repeat(63) + '1' } ]) {
  const f = fixture(override); f.root.localStorage.setItem('trixmoji.clean-pop.delivery.v1', JSON.stringify([{ id: legacyId, tokenNo: 0, legacyId, recipient, creator, contract, state: 'awaiting-wallet', hash: '' }]))
  await assert.rejects(f.api.recoverUnsent({ provider: f.provider, info: f.info, legacyId, confirmed: true }))
  assert.equal(f.api.records().length, 1); assert.equal(f.calls.some(q => q.method === 'eth_sendTransaction'), false)
 }
 const f = fixture(); f.root.localStorage.setItem('trixmoji.clean-pop.delivery.v1', JSON.stringify([{ id: legacyId, tokenNo: 0, legacyId, recipient, creator, contract, state: 'awaiting-wallet', hash: '' }]))
 assert.equal((await f.api.recoverUnsent({ provider: f.provider, info: f.info, legacyId, confirmed: true })).recovered, true)
 assert.equal(f.api.records().length, 0); assert.equal(f.calls.some(q => q.method === 'eth_sendTransaction'), false)
})
