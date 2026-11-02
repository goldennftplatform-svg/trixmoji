'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { getStatus } = require('../../netlify/functions/clean-pop-status')
const create = '0x665fba0baf3dc33e9943340197893ac16f56482c2defb8de60f944987fee451c'
const replacement = '0x2cf619006e771cc43a8b91ae80cc7bb2559a4daf2dbeb2093269c8b618c3a920'
test('counts creation and replacement events across indexer pages', async () => {
 let calls = 0
 const result = await getStatus(async () => ({ ok: true, json: async () => ++calls === 1
  ? { items: [{ topics: [create] }], next_page_params: { block_number: 1 } }
  : { items: [{ topics: [replacement] }, { topics: [create] }], next_page_params: null } }))
 assert.equal(result.minted, 2)
 assert.equal(result.replacements, 1)
 assert.equal(calls, 2)
})
test('does not treat an unavailable indexer as zero mints', async () => {
 await assert.rejects(getStatus(async () => ({ ok: false })), /Indexer unavailable/)
})
