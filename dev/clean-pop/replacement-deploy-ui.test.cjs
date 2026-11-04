'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path')
const { ethers } = require('ethers')
const artifact = require('../../assets/data/trixmoji-escrow-replacement-artifact.json')
test('one injected wallet is requested on connect and prepare becomes available', async () => {
 const elements = Object.fromEntries(['connect', 'prepare', 'wallets', 'status', 'saved', 'savedDetails', 'hash', 'check', 'details', 'review'].map(id => [id, { textContent: '', hidden: false, disabled: false }]))
 const provider = { request: async q => q.method === 'eth_accounts' ? [artifact.creator] : '0x1' }, calls = []
 const context = { ethers, window: { ethereum: provider }, document: { getElementById: id => elements[id] }, navigator: { locks: {} }, localStorage: {}, fetch: async () => ({ ok: true, json: async () => artifact }), EthscriptionCheckout: { requestAccounts: async p => { calls.push(p); return [artifact.creator] }, ensureChain: async () => {} }, TrixmojiEscrowDeployment: { create: () => ({ saved: () => null }) }, Promise, Error, String, Array }
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../assets/js/core/replacement-escrow-deploy.js'), 'utf8'), context)
 await new Promise(resolve => setImmediate(resolve))
 assert.equal(elements.connect.disabled, false)
 await elements.connect.onclick()
 assert.equal(calls.length, 1); assert.equal(elements.prepare.disabled, false)
 assert.match(elements.status.textContent, /Connected/)
})
