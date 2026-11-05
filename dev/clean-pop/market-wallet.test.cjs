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

test('connected wallet menu navigates and disconnects without a transaction', async () => {
 const address = '0x' + '1'.repeat(40), calls = [], provider = { request: async ({ method }) => { calls.push(method); return [address] } }
 function element() { return { children: [], hidden: false, textContent: '', attrs: {}, append(...nodes) { this.children.push(...nodes) }, appendChild(node) { this.children.push(node) }, setAttribute(k, v) { this.attrs[k] = v }, focus() {}, contains() { return false } } }
 const host = element(), walletTab = { click: () => calls.push('wallet-tab') }, escrowTab = { click: () => calls.push('escrow-tab') }, listeners = {}
 const document = { getElementById: id => ({ marketWalletConnect: host, myWallet: walletTab, myEscrow: escrowTab })[id], createElement: element, addEventListener() {} }
 const root = { addEventListener: (name, fn) => { listeners[name] = fn }, dispatchEvent: event => { if (listeners[event.type]) listeners[event.type](event) } }
 const checkout = { configure() {}, choose: async () => provider, ensureChain: async () => {}, identity: async () => {} }, module = { exports: {} }
 vm.runInNewContext(source, { module, window: root, document, EthscriptionCheckout: checkout, Event: class { constructor(type) { this.type = type } }, fetch: async () => ({ ok: true, json: async () => ({}) }), AbortSignal })
 const [button, menu] = host.children
 await button.onclick(); assert.match(button.textContent, /0x1111…1111/); button.onclick(); assert.equal(menu.hidden, false)
 menu.children.find(x => x.textContent.includes('MY ESCROW')).onclick(); assert.ok(calls.includes('escrow-tab')); assert.equal(menu.hidden, true)
 button.onclick(); menu.children.find(x => x.textContent.includes('DISCONNECT')).onclick(); assert.equal(module.exports.current(), null); assert.match(button.textContent, /CONNECT WALLET/)
 assert.equal(calls.includes('eth_sendTransaction'), false)
})
