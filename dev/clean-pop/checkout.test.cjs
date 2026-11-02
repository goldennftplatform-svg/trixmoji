'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path')
function setup() {
 const values = new Map(), root = { localStorage: { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v) }, navigator: { locks: { request: async (_, __, fn) => fn({}) } } }
 const module = { exports: {} }
 vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../assets/js/core/clean-pop-checkout.js'), 'utf8'), { module, window: root, BigInt, Date, Error })
 let sent = 0
 const provider = { request: async ({ method }) => { if (method === 'eth_estimateGas') return '0x100'; if (method === 'eth_gasPrice') return '0x10'; if (method === 'eth_sendTransaction') { sent++; return '0x' + 'a'.repeat(64) } } }
 const options = { provider, from: '0x1111111111111111111111111111111111111111', tokenNo: 3, tx: { to: '0x2222222222222222222222222222222222222222', value: '0x1' }, preflight: async () => {}, review: async quote => quote.approve() }
 return { api: module.exports, options, root, sent: () => sent }
}
test('persists a submitted hash and blocks a duplicate while pending', async () => {
 const x = setup(), row = await x.api.send(x.options)
 assert.equal(row.state, 'submitted'); assert.equal(x.api.records()[0].hash, row.hash)
 await assert.rejects(x.api.send(x.options), /previous Clean Pop mint/); assert.equal(x.sent(), 1)
 await assert.rejects(x.api.reconcile(row, async () => ({ complete: false })), /pending/)
 await x.api.reconcile(row, async () => ({ complete: true })); assert.equal(x.api.records()[0].state, 'complete')
})
test('preflight failure never submits', async () => {
 const x = setup(); x.options.preflight = async () => { throw Error('paused') }
 await assert.rejects(x.api.send(x.options), /paused/); assert.equal(x.sent(), 0)
})
test('storage failure and review cancellation never submit', async () => {
 const x = setup(); x.root.localStorage.setItem = () => { throw Error('storage full') }
 await assert.rejects(x.api.send(x.options), /storage full/); assert.equal(x.sent(), 0)
 const y = setup(); y.options.review = async () => { throw Error('cancelled') }
 await assert.rejects(y.api.send(y.options), /cancelled/); assert.equal(y.sent(), 0)
})
test('two selected pieces submit sequentially only after indexer confirmation', async () => {
 const x = setup(), first = await x.api.send(x.options)
 await assert.rejects(x.api.send({ ...x.options, tokenNo: 4 }), /previous Clean Pop mint/)
 await x.api.reconcile(first, async () => ({ complete: true }))
 const second = await x.api.send({ ...x.options, tokenNo: 4 })
 assert.equal(second.state, 'submitted'); assert.equal(x.sent(), 2)
})
test('account switch does not overwrite an unresolved transaction', async () => {
 const x = setup(); await x.api.send(x.options)
 await assert.rejects(x.api.send({ ...x.options, from: '0x3333333333333333333333333333333333333333' }), /previous Clean Pop mint/)
 assert.equal(x.sent(), 1); assert.equal(x.api.records()[0].buyer, x.options.from)
})
test('ambiguous wallet failure blocks a second submission', async () => {
 const x = setup(), request = x.options.provider.request
 x.options.provider.request = q => q.method === 'eth_sendTransaction' ? Promise.reject(Error('wallet disconnected')) : request(q)
 await assert.rejects(x.api.send(x.options), /wallet disconnected/)
 assert.equal(x.api.records()[0].state, 'awaiting-wallet')
 await assert.rejects(x.api.send(x.options), /previous Clean Pop mint/)
})
test('wallet transaction request occurs synchronously inside explicit approval callback', async () => {
 const x = setup(), request = x.options.provider.request
 let insideClick = false
 x.options.provider.request = q => {
  if (q.method === 'eth_sendTransaction') { assert.equal(insideClick, true); assert.equal(q.params[0].chainId, '0x1') }
  return request(q)
 }
 x.options.review = quote => { insideClick = true; const pending = quote.approve(); insideClick = false; return pending }
 await x.api.send(x.options)
 assert.equal(x.sent(), 1)
})
test('account or network change while review is open blocks wallet request', async () => {
 const x = setup(), listeners = {}
 x.options.provider.on = (event, handler) => { listeners[event] = handler }
 x.options.provider.removeListener = event => { delete listeners[event] }
 x.options.review = quote => { listeners.accountsChanged(); return quote.approve() }
 await assert.rejects(x.api.send(x.options), /Wallet, network, or quote changed/)
 assert.equal(x.sent(), 0)
})
