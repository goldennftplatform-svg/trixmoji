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
 const options = { provider, from: '0x1111111111111111111111111111111111111111', tokenNo: 3, tx: { to: '0x2222222222222222222222222222222222222222', value: '0x1' }, preflight: async () => {}, review: async () => {} }
 return { api: module.exports, options, sent: () => sent }
}
test('persists a submitted hash and blocks a duplicate while pending', async () => {
 const x = setup(), row = await x.api.send(x.options)
 assert.equal(row.state, 'submitted'); assert.equal(x.api.records()[0].hash, row.hash)
 await assert.rejects(x.api.send(x.options), /previous Clean Pop mint/); assert.equal(x.sent(), 1)
 await assert.rejects(x.api.reconcile(row, async () => ({ complete: false })), /pending/)
 await x.api.reconcile(row, async () => ({ complete: true })); assert.equal(x.api.records()[0].state, 'complete')
})
test('preflight or storage failure never submits', async () => {
 const x = setup(); x.options.preflight = async () => { throw Error('paused') }
 await assert.rejects(x.api.send(x.options), /paused/); assert.equal(x.sent(), 0)
})
