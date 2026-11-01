'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { createRequire } = require('module')
const { ethers } = require('ethers')
const root = path.resolve(__dirname, '../..')
const buyer = '0x1111111111111111111111111111111111111111'
const hash = '0x' + 'ab'.repeat(32)
const merkle = require('../../api/lib/phunk-merkle')
function load(file, mocks = {}, extra = {}) {
 const filename = path.join(root, file)
 const realRequire = createRequire(filename)
 const module = { exports: {} }
 const context = { module, exports: module.exports, require: name => name in mocks ? mocks[name] : realRequire(name),
  __dirname: path.dirname(filename), Buffer, console, process, setTimeout, clearTimeout, TextEncoder, ...extra }
 vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename })
 return module.exports
}
function browser() {
 let stored = new Map()
 const env = { localStorage: { getItem: k => stored.get(k) || null, setItem: (k, v) => stored.set(k, v) },
  navigator: { locks: { request: async (name, options, run) => run({ name }) } } }
 const app = load('assets/js/core/ethscription-checkout.js', {}, env)
 let sends = 0, chain = '0x1', account = buyer
 const p = { request: async q => {
  if (q.method === 'eth_chainId') return chain
  if (q.method === 'eth_accounts') return [account]
  if (q.method === 'eth_getCode') return '0x6000'
  if (q.method === 'eth_estimateGas') return '0x186a0'
  if (q.method === 'eth_gasPrice') return '0x3b9aca00'
  if (q.method === 'eth_sendTransaction') { sends++; return hash }
  if (q.method === 'wallet_switchEthereumChain') throw Object.assign(new Error('Rejected switch'), { code: 4001 })
  throw new Error(q.method)
 } }
 return { app, env, p, sends: () => sends, chain: x => { chain = x }, account: x => { account = x } }
}
function options(b, more = {}) {
 return { provider: b.p, from: buyer, info: { address: merkle.info().address, priceWei: '200000000000000' },
  picture: { id: '0123456789abcdef', tokenNo: 0, wei: '200000000000000' }, data: '0x1234',
  review: async q => { assert.equal(q.total, '0.0003') }, onHash: () => {}, ...more }
}
test('wrong-chain rejection cannot reach transaction submission', async () => {
 const b = browser(); b.chain('0x89')
 await assert.rejects(b.app.send(options(b)), /Rejected switch/)
 assert.equal(b.sends(), 0)
})
test('account change after gas review aborts before signing', async () => {
 const b = browser()
 await assert.rejects(b.app.send(options(b, { review: async () => b.account(merkle.info().creator) })), /Wallet changed/)
 assert.equal(b.sends(), 0)
})
test('hash is persisted and unfinished checkout blocks repeat spending', async () => {
 const b = browser(), record = await b.app.send(options(b))
 assert.equal(b.app.records()[0].hash, hash)
 await assert.rejects(b.app.send(options(b)), /previous mint/)
 await assert.rejects(b.app.reconcile(record, async () => ({ ok: false, error: 'not confirmed' })), /not confirmed/)
 assert.equal(b.app.records()[0].state, 'submitted')
 assert.equal(b.sends(), 1)
 await b.app.reconcile(record, async () => ({ ok: true, listing: { preview: '/paid.png' } }))
 assert.equal(b.app.records()[0].state, 'complete')
 assert.equal(b.sends(), 1)
})
test('storage failure aborts before a payment; ambiguous wallet errors remain recoverable', async () => {
 const b = browser(); b.env.localStorage.setItem = () => { throw new Error('storage full') }
 await assert.rejects(b.app.send(options(b)), /storage full/)
 assert.equal(b.sends(), 0)
 const c = browser(), request = c.p.request
 c.p.request = q => q.method === 'eth_sendTransaction' ? Promise.reject(new Error('transport disconnected')) : request(q)
 await assert.rejects(c.app.send(options(c)), /transport disconnected/)
 assert.equal(c.app.records()[0].state, 'awaiting-wallet')
 await assert.rejects(c.app.send(options(c)), /previous mint/)
})
test('explicit wallet rejection removes the unsent intent', async () => {
 const b = browser(), request = b.p.request
 b.p.request = q => q.method === 'eth_sendTransaction' ? Promise.reject(Object.assign(new Error('user rejected'), { code: 4001 })) : request(q)
 await assert.rejects(b.app.send(options(b)), /user rejected/)
 assert.equal(b.app.records().length, 0)
})
test('missing deployment and rejected gas estimates never use a fallback send', async () => {
 for (const fail of ['eth_getCode', 'eth_estimateGas']) {
  const b = browser(), request = b.p.request
  b.p.request = q => q.method === fail ? (fail === 'eth_getCode' ? Promise.resolve('0x') : Promise.reject(new Error('used'))) : request(q)
  await assert.rejects(b.app.send(options(b)))
  assert.equal(b.sends(), 0)
 }
})
function backend(live = true) {
 let state = { listings: [], collections: [], usedTx: {} }
 const chain = { ...require('../../api/lib/ethscriptions-chain'), requireMinter: async () => {}, requireUniqueContent: async () => {}, requireIndexedMint: async () => {} }
 const env = { ...process, env: { ...process.env, PHUNK_MINT_ENABLED: String(live) } }
 const handler = load('api/ethscriptions.js', {
  './lib/rate-limit': { rateLimitOrReject: () => false },
  './lib/account-session': { readSession: () => null },
  './lib/ethscriptions-chain': chain,
  './lib/ethscriptions-store': { withBoard: async fn => {
   const next = await fn(structuredClone(state)); if (next) state = next; return state
  } }
 }, { process: env })
 return { chain, state: () => state, call: async (body, method = 'POST') => {
  let result, status
  await handler({ method, body }, { status: function (s) { status = s; return this }, json: x => { result = x } })
  return { status, ...result }
 } }
}
test('hold loads PNG bytes and binds payload to the contract manifest', async () => {
 const b = backend()
 const held = await b.call({ action: 'phunkHold', collectionId: '45b48eca99f938b7', buyer, tokenNos: [0] })
 assert.equal(held.ok, true, held.error)
 assert.ok(held.mints[0].uri.startsWith('data:image/png;base64,'))
 assert.equal(held.mints[0].proof.length, 14)
 const second = await b.call({ action: 'phunkHold', collectionId: '45b48eca99f938b7', buyer: merkle.info().creator, tokenNos: [0] })
 assert.equal(second.ok, false)
})
test('expired order reconciles from proven mint and retries are idempotent', async () => {
 const b = backend()
 const held = await b.call({ action: 'phunkHold', collectionId: '45b48eca99f938b7', buyer, tokenNos: [0] })
 const row = b.state().listings[0]
 row.holdUntil = 1
 await b.call(null, 'GET')
 assert.equal(b.state().listings[0].state, 'open')
 assert.equal(b.state().listings[0].buyer, buyer)
 b.chain.readPhunkMint = async () => ({ from: buyer, owner: buyer, hash, uri: held.mints[0].uri,
  to: merkle.info().address, contractAddress: merkle.info().address, value: merkle.info().priceWei })
 const request = { action: 'phunkReveal', id: row.id, buyer, mintTx: hash }
 assert.equal((await b.call(request)).ok, true)
 assert.equal((await b.call(request)).ok, true)
 assert.equal(b.state().listings.filter(x => x.state === 'settled').length, 1)
 assert.equal(b.state().usedTx[hash], row.id)
})
test('reveal rejects wrong content, value, and event emitter', async () => {
 for (const patch of [{ uri: 'data:,wrong' }, { value: '0' }, { contractAddress: buyer }]) {
  const b = backend()
  const held = await b.call({ action: 'phunkHold', collectionId: '45b48eca99f938b7', buyer, tokenNos: [0] })
  b.chain.readPhunkMint = async () => ({ from: buyer, owner: buyer, hash, uri: held.mints[0].uri,
   to: merkle.info().address, contractAddress: merkle.info().address, value: merkle.info().priceWei, ...patch })
  const result = await b.call({ action: 'phunkReveal', id: held.mints[0].id, buyer, mintTx: hash })
  assert.equal(result.ok, false)
  assert.equal(b.state().listings[0].state, 'held')
 }
})
test('paused collection is visible but cannot sell; legacy payment endpoint disabled', async () => {
 const b = backend(false)
 const get = await b.call(null, 'GET')
 assert.equal(get.collections[0].state, 'closed')
 assert.equal(get.collections[0].preview, '/assets/images/ethscription-cover.png')
 assert.equal((await b.call({ action: 'phunkHold', buyer })).ok, false)
 assert.equal((await b.call({ action: 'phunkPay' })).status, 410)
})
test('GET never resets existing paid or settled history', async () => {
 const b = backend()
 b.state().listings.push({ id: '0123456789abcdef', collectionId: '45b48eca99f938b7', state: 'paid' })
 b.state().usedTx[hash] = '0123456789abcdef'
 await b.call(null, 'GET')
 assert.equal(b.state().listings.length, 1)
 assert.equal(b.state().usedTx[hash], '0123456789abcdef')
})
test('indexer delay keeps a confirmed payment recoverable rather than marking delivered', async () => {
 const b = backend()
 const held = await b.call({ action: 'phunkHold', collectionId: '45b48eca99f938b7', buyer, tokenNos: [0] })
 b.chain.readPhunkMint = async () => ({ from: buyer, owner: buyer, hash, uri: held.mints[0].uri,
  to: merkle.info().address, contractAddress: merkle.info().address, value: merkle.info().priceWei })
 b.chain.requireIndexedMint = async () => { throw new Error('Ethscriptions indexing is pending') }
 const result = await b.call({ action: 'phunkReveal', id: held.mints[0].id, buyer, mintTx: hash })
 assert.equal(result.ok, false)
 assert.equal(b.state().listings[0].state, 'held')
 assert.equal(b.state().usedTx[hash], undefined)
})
test('indexer checks hash, initial owner, creator and content; duplicate content blocks hold', async () => {
 const sent = { hash, owner: buyer, contractAddress: merkle.info().address, uri: 'data:,test' }
 let indexed = { transaction_hash: hash, initial_owner: buyer, creator: sent.contractAddress, content_uri: sent.uri }
 const chain = load('api/lib/ethscriptions-chain.js', {}, { AbortSignal, fetch: async () => ({ ok: true, json: async () => ({ result: indexed }) }) })
 await chain.requireIndexedMint(sent)
 indexed = { ...indexed, initial_owner: merkle.info().creator }
 await assert.rejects(chain.requireIndexedMint(sent), /does not match/)
 const b = backend()
 b.chain.requireUniqueContent = async () => { throw new Error('already inscribed') }
 assert.equal((await b.call({ action: 'phunkHold', collectionId: '45b48eca99f938b7', buyer, tokenNos: [0] })).ok, false)
 assert.equal(b.state().listings.length, 0)
})
test('hosted store retries conditional-write conflict using the latest board', async () => {
 let writes = 0
 const store = { getWithMetadata: async () => ({ etag: String(writes), data: { listings: [], collections: [], usedTx: {}, phunkReset: writes ? 'other-writer' : '' } }),
  setJSON: async (key, data, options) => { assert.equal(options.onlyIfMatch, String(writes)); writes++; return { modified: writes > 1 } } }
 const s = load('api/lib/ethscriptions-store.js', { '@netlify/blobs': { getStore: () => store } }, { process: { env: { NETLIFY: 'true' } } })
 const result = await s.withBoard(async board => { board.collections.push({ id: '0123456789abcdef' }); return board })
 assert.equal(writes, 2)
 assert.equal(result.phunkReset, 'other-writer')
 assert.equal(result.collections.length, 1)
})
test('receipt decoder takes the first creation event, not a later event', async () => {
 const log = owner => ({ topics: ['0x665fba0baf3dc33e9943340197893ac16f56482c2defb8de60f944987fee451c', ethers.utils.hexZeroPad(owner, 32)],
  address: merkle.info().address, data: ethers.utils.defaultAbiCoder.encode(['string'], ['data:image/png;base64,AAAA']) })
 const chain = load('api/lib/ethscriptions-chain.js', { './awardz-chain': { ethRpcs: () => [], firstRpc: async (urls, method) => ({
  eth_chainId: '0x1', eth_blockNumber: '0x11', eth_getTransactionByHash: { from: buyer, to: merkle.info().address, value: '0x0' },
  eth_getTransactionReceipt: { status: '0x1', blockNumber: '0x10', logs: [log(buyer), log(merkle.info().creator)] }
 })[method] } })
 assert.equal((await chain.readPhunkMint(hash)).owner, buyer)
})
test('page scripts compile and recovery module is loaded before checkout', () => {
 const html = fs.readFileSync(path.join(root, 'classic/pages/ethscriptions.html'), 'utf8')
 for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1])
 assert.ok(html.indexOf('ethscription-checkout.js') < html.indexOf('function chooseWallet'))
 assert.ok(!html.includes('MINTER = data.phunkMinter || MINTER'))
 const setup = fs.readFileSync(path.join(root, 'classic/pages/phunk-setup.html'), 'utf8')
 for (const match of setup.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1])
})

test('production diagnostics classify failures without exposing credentials or error text', () => {
 const logs = []
 const diagnostics = load('api/lib/ethscriptions-diagnostics.js', {}, { console: { error: (...args) => logs.push(args.join(' ')) } })
 const secret = 'private-test-credential-never-log'
 const result = diagnostics.report('board-storage', new Error('Missing siteID and token: ' + secret))
 assert.equal(result.reason, 'storage_configuration')
 assert.equal(logs.length, 1)
 assert.ok(!logs[0].includes(secret))
 assert.equal(diagnostics.report('minter-manifest', new Error('The phunk minter file is missing.')).reason, 'minter_file_missing')
})
