'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const source = fs.readFileSync(path.resolve(__dirname, '../../assets/js/core/market-payment.js'), 'utf8')
const buyer = '0x1111111111111111111111111111111111111111', escrow = '0x2222222222222222222222222222222222222222', hash = '0x' + 'a'.repeat(64), asset = '0x' + 'b'.repeat(64)
function setup() {
 const values = new Map(), root = { localStorage: { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v) }, navigator: { locks: { request: async (_, __, fn) => fn({}) } } }, module = { exports: {} }, calls = []
 vm.runInNewContext(source, { module, window: root, Date, BigInt, Error })
 const provider = { request: q => { calls.push(q); return Promise.resolve(hash) } }
 return { api: module.exports, provider, calls, root }
}
test('payment requires review, persists the hash, and cannot be repeated while unresolved', async () => {
 const x = setup(), row = await x.api.send({ id: '0123456789abcdef', from: buyer, escrow, amountWei: '1000', provider: x.provider, preflight: async () => {}, review: q => { assert.equal(x.calls.length, 0); return q.approve() } })
 assert.equal(row.state, 'submitted'); assert.equal(x.calls[0].params[0].value, '0x3e8'); assert.equal(x.calls[0].params[0].to, escrow)
 await assert.rejects(x.api.send({ id: '0123456789abcdef', from: buyer, escrow, amountWei: '1000', provider: x.provider, preflight: async () => {}, review: q => q.approve() }), /previous marketplace transaction/)
 await x.api.reconcile(row, async body => { assert.equal(body.action, 'pay'); assert.equal(body.payTx, hash); return { ok: true } })
 assert.equal(x.api.records()[0].state, 'paid')
})
test('zero-value transfer uses the Ethscription ID as calldata and is verified before completion', async () => {
 const x = setup(), row = await x.api.transfer({ id: asset, from: buyer, to: escrow, provider: x.provider, preflight: async () => {}, review: q => q.approve() })
 const tx = x.calls[0].params[0]; assert.equal(tx.data, asset); assert.equal(tx.value, '0x0'); assert.equal(tx.to, escrow)
 await x.api.reconcile(row, async body => { assert.equal(body.action, 'marketVerifyTransfer'); assert.equal(body.id, asset); return { ok: true } })
 assert.equal(x.api.records()[0].state, 'confirmed')
})
test('ambiguous wallet failures remain saved and prevent another action', async () => {
 const x = setup(); x.provider.request = () => Promise.reject(Error('wallet disconnected'))
 await assert.rejects(x.api.transfer({ id: asset, from: buyer, to: escrow, provider: x.provider, preflight: async () => {}, review: q => q.approve() }), /disconnected/)
 assert.equal(x.api.records()[0].state, 'awaiting-wallet')
 await assert.rejects(x.api.send({ id: '0123456789abcdef', from: buyer, escrow, amountWei: '1', provider: x.provider, preflight: async () => {}, review: q => q.approve() }), /previous marketplace transaction/)
})
test('changed account during review prevents payment or transfer', async () => {
 const x = setup(), listeners = {}; x.provider.on = (event, fn) => { listeners[event] = fn }; x.provider.removeListener = event => { delete listeners[event] }
 await assert.rejects(x.api.send({ id: '0123456789abcdef', from: buyer, escrow, amountWei: '1', provider: x.provider, preflight: async () => {}, review: q => { listeners.accountsChanged(); return q.approve() } }), /Wallet, network/)
 assert.equal(x.calls.length, 0)
})
