'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const source = fs.readFileSync(path.resolve(__dirname, '../../assets/js/core/market-wallet-connect.js'), 'utf8')
test('market uses the chosen provider even when window.ethereum is different', async () => {
 const address = '0x' + '1'.repeat(40), selected = { request: async ({method}) => { assert.equal(method, 'eth_accounts'); return [address] } }
 const root = { ethereum: { request() {} } }, module = { exports: {} }, calls = []
 const checkout = { configure() {}, choose: async () => { calls.push('choose'); return selected }, ensureChain: async p => { assert.equal(p, selected) }, identity: async p => { assert.equal(p, selected) } }
 vm.runInNewContext(source, { module, window: root, EthscriptionCheckout: checkout, fetch: async () => ({ ok: true, json: async () => ({}) }), AbortSignal })
 const result = await module.exports.connect({})
 assert.equal(result.provider, selected); assert.equal(module.exports.current().provider, selected); assert.deepEqual(calls, ['choose'])
})
