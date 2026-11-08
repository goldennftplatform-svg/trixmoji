'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), { ethers } = require('ethers')
const candidate = require('../../assets/data/clean-pop-webp-v2-candidate.json'), manifest = require('../../assets/ethscriptions/clean-pop-webp-v2/manifest.json')
test('WebP mint preview allows all numbers but refuses to mint before reviewed runtime is deployed', async () => {
 const ids = ['connect','walletChoices','selected','mint','status','review','recovery','grid','page','previous','next','go','jump'], calls = []
 function element() { let text = ''; return { children: [], hidden: false, disabled: false, value: '', set textContent(value) { text = value; this.children = [] }, get textContent() { return text }, append(...xs) { this.children.push(...xs) }, appendChild(x) { this.children.push(x) }, setAttribute() {}, focus() {} } }
 const els = Object.fromEntries(ids.map(id => [id, element()])), provider = { request: async q => { calls.push(q.method); if (q.method === 'eth_accounts') return ['0x1111111111111111111111111111111111111111']; if (q.method === 'eth_getCode') return '0x'; throw Error('unexpected ' + q.method) } }
 const client = { records: () => [] }, fetch = async url => ({ ok: true, json: async () => String(url).includes('candidate.json') ? candidate : manifest })
 const context = { document: { getElementById: id => els[id], createElement: () => element() }, CleanPopCheckout: { createWebpV2: () => client }, EthscriptionCheckout: { configure() {}, choose: async () => provider, ensureChain: async () => {}, walletRequest: (p, q) => p.request(q) }, ethers, fetch, AbortSignal, setTimeout, console }
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../assets/js/core/clean-pop-webp-v2-mint.js'), 'utf8'), context)
 await new Promise(resolve => setImmediate(resolve))
 els.jump.value = '419'; els.go.onclick(); assert.equal(els.grid.children.length, 40)
 const card = els.grid.children[19]; assert.match(card.children[1].textContent, /#419/); assert.equal(card.disabled, false)
 await els.connect.onclick(); assert.match(els.status.textContent, /did not return the WebP contract code/); assert.equal(els.mint.disabled, true); assert.equal(calls.includes('eth_sendTransaction'), false)
})
test('selecting a wallet connects to the deployed open candidate without sending a transaction', async () => {
 const ids = ['connect','walletChoices','selected','mint','status','review','recovery','grid','page','previous','next','go','jump'], calls = []
 function element() { let text = ''; return { children: [], hidden: false, disabled: false, value: '', set textContent(value) { text = value; this.children = [] }, get textContent() { return text }, append(...xs) { this.children.push(...xs) }, appendChild(x) { this.children.push(x) }, setAttribute() {}, focus() {} } }
 const els = Object.fromEntries(ids.map(id => [id, element()])), address = '0x1111111111111111111111111111111111111111'
 const provider = { request: async q => { calls.push(q.method); if (q.method === 'eth_accounts') return [address]; if (q.method === 'eth_getCode') return candidate.runtime; if (q.method === 'eth_call') return '0x' + '0'.repeat(64); throw Error('unexpected ' + q.method) } }
 const client = { records: () => [] }, fetch = async url => ({ ok: true, json: async () => String(url).includes('candidate.json') ? candidate : String(url).includes('/api/') ? {} : manifest })
 const context = { document: { getElementById: id => els[id], createElement: () => element() }, CleanPopCheckout: { createWebpV2: () => client }, EthscriptionCheckout: { configure() {}, choose: async () => provider, ensureChain: async () => {}, walletRequest: (p, q) => p.request(q) }, ethers, fetch, AbortSignal, setTimeout, console }
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../assets/js/core/clean-pop-webp-v2-mint.js'), 'utf8'), context)
 await new Promise(resolve => setImmediate(resolve)); els.grid.children[3].onclick(); await els.connect.onclick()
 assert.match(els.status.textContent, /Wallet connected/); assert.equal(els.mint.disabled, false); assert.equal(calls.includes('eth_sendTransaction'), false)
})
