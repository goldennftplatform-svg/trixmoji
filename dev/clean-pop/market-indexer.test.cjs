'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), { ethers } = require('ethers')
const { createEthscriptionsIndexer } = require('../../api/lib/trixmoji-market/ethscriptions-indexer.cjs')
const owner = '0x1111111111111111111111111111111111111111', creator = '0x2222222222222222222222222222222222222222', id = ethers.utils.id('asset')
test('custody discovery queries only the fixed indexer with validated owner, creator and cursor', async () => {
 let requested
 const indexer = createEthscriptionsIndexer({ baseUrl: 'https://indexer.example/v2/', fetch: async url => { requested = new URL(url); return { ok: true, json: async () => ({ result: [{ transaction_hash: id }], pagination: { has_more: false } }) } } })
 const result = await indexer.listOwned({ owner, creator })
 assert.deepEqual(result, { ids: [id], nextPageKey: null }); assert.equal(requested.origin, 'https://indexer.example'); assert.equal(requested.searchParams.get('current_owner'), owner); assert.equal(requested.searchParams.get('creator'), creator)
 await assert.rejects(indexer.listOwned({ owner: 'https://attacker.invalid', creator }), /Invalid/)
 await assert.rejects(indexer.listOwned({ owner, creator, pageKey: 'bad' }), /Invalid/)
})
test('custody discovery rejects malformed responses and missing cursors', async () => {
 for (const body of [{ result: [{ transaction_hash: 'bad' }], pagination: { has_more: false } }, { result: [], pagination: { has_more: true, page_key: 'bad' } }, { result: [], pagination: {} }]) {
  const indexer = createEthscriptionsIndexer({ baseUrl: 'https://indexer.example/v2/', fetch: async () => ({ ok: true, json: async () => body }) })
  await assert.rejects(indexer.listOwned({ owner, creator }), /Invalid/)
 }
})
test('unknown asset is absent while indexer outages still fail closed', async () => {
 const missing = createEthscriptionsIndexer({ baseUrl: 'https://indexer.example/v2/', fetch: async () => ({ ok: false, status: 404 }) })
 assert.equal(await missing('/ethscriptions/' + id), null); await assert.rejects(missing('/status'), /unavailable/)
 const outage = createEthscriptionsIndexer({ baseUrl: 'https://indexer.example/v2/', fetch: async () => ({ ok: false, status: 503 }) })
 await assert.rejects(outage('/ethscriptions/' + id), /unavailable/)
})
