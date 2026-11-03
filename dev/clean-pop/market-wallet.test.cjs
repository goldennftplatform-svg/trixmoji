'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const source = fs.readFileSync(path.resolve(__dirname, '../../assets/js/core/market-wallet-connect.js'), 'utf8')
test('a single injected wallet receives the connection request during the click', async () => {
 const provider = { request() {} }, root = { ethereum: provider }, module = { exports: {} }, calls = []
 let inClick = false
 const checkout = { requestAccounts: async p => { assert.equal(inClick, true); assert.equal(p, provider); calls.push('requestAccounts'); return ['0x' + '1'.repeat(40)] }, identity: async () => { calls.push('identity') } }
 vm.runInNewContext(source, { module, window: root, EthscriptionCheckout: checkout })
 inClick = true; const result = module.exports.connect(null); inClick = false
 assert.equal((await result).provider, provider); assert.deepEqual(calls, ['requestAccounts', 'identity'])
})
