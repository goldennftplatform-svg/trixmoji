'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), { createRequire } = require('node:module')
const file = path.resolve(__dirname, '../../api/ethscriptions.js'), realRequire = createRequire(file)
const seller = '0x1111111111111111111111111111111111111111', escrow = '0x2222222222222222222222222222222222222222', creator = '0x915a3d363d0a4e4470b531f008f5142c540e5417', id = '0x' + 'a'.repeat(64), lock = '0x' + 'b'.repeat(64)
function setup(custody, options = {}) {
 let board = { listings: options.listings || [], collections: [], usedTx: {} }
 const actualChain = realRequire('./lib/ethscriptions-chain')
 const chain = { ...actualChain, escrowEth: () => escrow,
  readCreation: async () => ({ id, creator, mime: 'image/png' }),
  readTransfer: async () => ({ hash: lock, id, to: escrow, from: seller, value: '0' }),
  requireIndexedTransfer: custody, ...(options.chain || {}) }
 const mocks = { './lib/rate-limit': { rateLimitOrReject: () => false }, './lib/account-session': { readSession: () => ({ uid: 'u' }) },
  './lib/account-store': { loadState: async () => ({ users: { u: { uid: 'u', wallets: [{ chain: 'ethereum', address: seller }] } } }) },
  './lib/ethscriptions-chain': chain, './lib/ethscriptions-store': { withBoard: async fn => { const next = await fn(structuredClone(board)); if (next) board = next; return board } } }
 const module = { exports: {} }, context = { module, exports: module.exports, require: name => name in mocks ? mocks[name] : realRequire(name), __dirname: path.dirname(file), Buffer, console, process, setTimeout, clearTimeout }
 vm.runInNewContext(fs.readFileSync(file, 'utf8'), context)
 return { board: () => board, call: async (body = { action: 'list', ethscriptionId: id, lockTx: lock, priceEth: '1' }) => { let result, status; await module.exports({ method: 'POST', body }, { status(n) { status = n; return this }, json(x) { result = x } }); return { status, ...result } } }
}
test('listing refuses to publish when indexer has not confirmed escrow custody', async () => {
 const app = setup(async () => { throw Error('Indexing pending') })
 const result = await app.call(); assert.equal(result.ok, false); assert.match(result.error, /Indexing pending/); assert.equal(app.board().listings.length, 0)
})
test('settlement waits for the exact escrow-to-buyer transfer to be indexed', async () => {
 const buyer = '0x4444444444444444444444444444444444444444', payout = '0x' + 'c'.repeat(64), listingId = '0123456789abcdef'
 const options = { listings: [{ id: listingId, state: 'paid', ethscriptionId: id, seller, buyer, creator: seller, priceWei: '1000000000000000000', sellerWei: '1000000000000000000', royaltyWei: '0' }],
  chain: { readTransfer: async () => ({ id, hash: lock, from: escrow, to: buyer, value: '0' }), readPayment: async () => ({ hash: payout, from: escrow, to: seller, value: '1000000000000000000' }) } }
 const blocked = setup(async () => { throw Error('Transfer indexing pending') }, options)
 const body = { action: 'release', id: listingId, deliverTx: lock, payoutTx: payout }
 assert.equal((await blocked.call(body)).ok, false); assert.equal(blocked.board().listings[0].state, 'paid')
 const accepted = setup(async (asset, transaction, from, to, current) => { assert.equal(asset, id); assert.equal(transaction, lock); assert.equal(from, escrow); assert.equal(to, buyer); assert.equal(current, false) }, options)
 assert.equal((await accepted.call(body)).ok, true); assert.equal(accepted.board().listings[0].state, 'settled')
})
test('buyer cannot hold a listing whose indexed escrow custody is no longer confirmed', async () => {
 const originalSeller = '0x5555555555555555555555555555555555555555', listingId = '0123456789abcdef'
 const options = { listings: [{ id: listingId, state: 'open', ethscriptionId: id, seller: originalSeller, lockTx: lock, priceWei: '1000000000000000000' }] }
 const app = setup(async () => { throw Error('Escrow custody no longer confirmed') }, options)
 const result = await app.call({ action: 'hold', id: listingId })
 assert.equal(result.ok, false); assert.match(result.error, /custody/); assert.equal(app.board().listings[0].state, 'open')
})
test('market transfer verification requires the exact indexed zero-value transfer', async () => {
 let checked = false
 const app = setup(async (asset, tx, from, to, current) => { checked = true; assert.equal(asset, id); assert.equal(tx, lock); assert.equal(from, seller); assert.equal(to, escrow); assert.equal(current, false) })
 const result = await app.call({ action: 'marketVerifyTransfer', id, hash: lock, from: seller, to: escrow })
 assert.equal(result.ok, true); assert.equal(checked, true)
 const mismatch = await app.call({ action: 'marketVerifyTransfer', id, hash: lock, from: seller, to: creator })
 assert.equal(mismatch.ok, false)
})
test('a late-confirming payment reconciles idempotently if no new buyer reserved the piece', async () => {
 const listingId = '0123456789abcdef', payHash = '0x' + 'c'.repeat(64)
 const options = { listings: [{ id: listingId, state: 'held', ethscriptionId: id, seller: creator, buyer: seller, buyerUid: 'u', holdUid: 'u', holdUntil: 1, priceWei: '1000000000000000000' }],
  chain: { readPayment: async () => ({ hash: payHash, from: seller, to: escrow, value: '1000000000000000000' }) } }
 const app = setup(async () => {}, options), request = { action: 'pay', id: listingId, payTx: payHash }
 assert.equal((await app.call(request)).ok, true); assert.equal(app.board().listings[0].state, 'paid')
 assert.equal((await app.call(request)).ok, true); assert.equal(app.board().listings[0].payTx, payHash)
})
test('a late payment cannot replace another buyer’s active hold', async () => {
 const listingId = '0123456789abcdef', payHash = '0x' + 'c'.repeat(64)
 const options = { listings: [{ id: listingId, state: 'held', ethscriptionId: id, seller: creator, buyer: '0x5555555555555555555555555555555555555555', buyerUid: 'other', holdUid: 'other', holdUntil: Date.now() + 100000, priceWei: '1000000000000000000' }],
  chain: { readPayment: async () => ({ hash: payHash, from: seller, to: escrow, value: '1000000000000000000' }) } }
 const app = setup(async () => {}, options), result = await app.call({ action: 'pay', id: listingId, payTx: payHash })
 assert.equal(result.ok, false); assert.match(result.error, /another buyer/); assert.equal(app.board().listings[0].buyerUid, 'other')
})
test('verified Clean Pop resale credits the creator wallet rather than the mint contract', async () => {
 const app = setup(async (asset, transaction, from, target, current) => { assert.equal(asset, id); assert.equal(transaction, lock); assert.equal(from, seller); assert.equal(target, escrow); assert.equal(current, true) })
 const result = await app.call(); assert.equal(result.ok, true)
 const row = app.board().listings[0]; assert.equal(row.creator, creator); assert.equal(row.royaltyWei, '25000000000000000'); assert.equal(row.sellerWei, '975000000000000000')
})
