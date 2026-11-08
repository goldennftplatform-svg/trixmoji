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
test('multi-mint waits through pending indexing and requests a separate approval for each piece', async () => {
 const ids = ['connect','walletChoices','selected','mint','status','review','recovery','grid','page','previous','next','go','jump'], sends = [], attempts = {}
 function element() { let text = ''; return { children: [], hidden: false, disabled: false, value: '', set textContent(value) { text = value; this.children = [] }, get textContent() { return text }, append(...xs) { this.children.push(...xs) }, appendChild(x) { this.children.push(x) }, setAttribute() {}, focus() {} } }
 const els = Object.fromEntries(ids.map(id => [id, element()])), address = '0x1111111111111111111111111111111111111111'
 const provider = { request: async q => { if (q.method === 'eth_accounts') return [address]; if (q.method === 'eth_getCode') return candidate.runtime; if (q.method === 'eth_call') return '0x' + '0'.repeat(64); throw Error('unexpected ' + q.method) } }
 const client = { records: () => [], send: async options => { await options.preflight(); return options.review({ gas: 1n, price: BigInt(candidate.priceWei), approve: async () => { sends.push(options.tokenNo); return { tokenNo: options.tokenNo, hash: '0x' + String(options.tokenNo).repeat(64) } } }) }, reconcile: async row => { attempts[row.tokenNo] = (attempts[row.tokenNo] || 0) + 1; if (attempts[row.tokenNo] === 1) throw Error('That transaction is not confirmed.'); return { complete: true } } }
 const fetch = async url => {
  const value = String(url)
  if (value.includes('candidate.json')) return { ok: true, json: async () => candidate }
  if (value.endsWith('/manifest.json')) return { ok: true, json: async () => manifest }
  if (value.includes('/api/ethscriptions')) return { ok: true, json: async () => ({}) }
  if (value.includes('/.netlify/functions/clean-pop-webp-v2-preflight')) { const token = Number(new URL(value, 'https://example.test').searchParams.get('token')); return { ok: true, json: async () => ({ ok: true, readyToRequestWallet: true, paused: false, minted: false, walletMintCount: 0, contentAlreadyInscribed: false, artworkProofValid: true, chainId: 1, tokenNo: token, contentSha256: manifest.files[token].contentSha256, buyer: address, contract: candidate.address }) } }
  const match = value.match(/\/(\d+)\.webp$/); if (match) { const bytes = fs.readFileSync(path.resolve(__dirname, '../../assets/ethscriptions/clean-pop-webp-v2/' + match[1] + '.webp')); return { ok: true, arrayBuffer: async () => Uint8Array.from(bytes).buffer } }
  throw Error('Unexpected fetch: ' + value)
 }
 const context = { document: { getElementById: id => els[id], createElement: () => element() }, CleanPopCheckout: { createWebpV2: () => client }, EthscriptionCheckout: { configure() {}, choose: async () => provider, ensureChain: async () => {}, walletRequest: (p, q) => p.request(q), eth: n => String(n) }, ethers, fetch, AbortSignal, TextEncoder, crypto: require('node:crypto').webcrypto, btoa: s => Buffer.from(s, 'binary').toString('base64'), setTimeout: fn => setTimeout(fn, 0), console }
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../assets/js/core/clean-pop-webp-v2-mint.js'), 'utf8'), context)
 await new Promise(resolve => setImmediate(resolve)); await els.connect.onclick()
 els.grid.children[1].onclick(); els.grid.children[2].onclick()
 const run = els.mint.onclick()
 async function waitForReview() { for (let i = 0; i < 100; i++) { if (!els.review.hidden && els.review.children.some(x => x.textContent === 'APPROVE IN WALLET')) return; await new Promise(resolve => setTimeout(resolve, 2)) } throw Error('Review not shown') }
 await waitForReview(); els.review.children.find(x => x.textContent === 'APPROVE IN WALLET').onclick()
 await new Promise(resolve => setTimeout(resolve, 15)); await waitForReview(); assert.deepEqual(sends, [1])
 els.review.children.find(x => x.textContent === 'APPROVE IN WALLET').onclick(); await run
 assert.deepEqual(sends, [1, 2]); assert.equal(attempts[1], 2); assert.equal(attempts[2], 2); assert.match(els.status.textContent, /confirmed and indexed/)
})
