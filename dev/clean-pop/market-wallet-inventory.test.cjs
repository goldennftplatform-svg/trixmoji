'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const { walletInventory } = require('../../api/lib/trixmoji-market/wallet-inventory.cjs')
const wallet = '0x47cf60bdd877203264921d05ce26f81f6d36aa3e', minter = '0x11019B7af0F833f5695a44584c5B31Bb1D0baabC', id = '0x' + '12'.repeat(32), hash = '0x' + '34'.repeat(32)
test('inventory returns only collection-proven items held by the requested wallet', async () => {
 const row = { transaction_hash: id, current_owner: wallet, creator: minter, content_sha: hash }
 const result = await walletInventory({ wallet, minter, fetchPage: async () => ({ result: [row, { ...row, current_owner: minter }], pagination: { has_more: false } }), registry: async () => ({ id, contentSha: hash, tokenNo: 6 }) })
 assert.deepEqual(result.items.map(x => x.tokenNo), [6]); assert.equal(result.nextPageKey, null)
})
test('inventory rejects provenance mismatch and malformed pagination', async () => {
 const row = { transaction_hash: id, current_owner: wallet, creator: minter, content_sha: hash }
 await assert.rejects(walletInventory({ wallet, minter, fetchPage: async () => ({ result: [row], pagination: { has_more: false } }), registry: async () => ({ id, contentSha: id, tokenNo: 6 }) }), /provenance/)
 await assert.rejects(walletInventory({ wallet, minter, fetchPage: async () => ({ result: [], pagination: { has_more: true } }), registry: async () => null }), /page key/)
})
