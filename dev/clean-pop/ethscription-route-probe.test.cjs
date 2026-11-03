'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), { ethers } = require('ethers')
const { create } = require('../../assets/js/core/ethscription-route-probe')
const owner = '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E', target = '0x000000000000000000000000000000000000dEaD', data = ethers.utils.id('unique test data'), hash = ethers.utils.id('simulated transaction'), code = '0xef010063c0c19a282a1b52b07dd5a65b58948a07dae32b'
function fixture({ wrapped = false, used = false, accountCode = code, pending = false } = {}) {
 const store = new Map(), calls = [], provider = { request: async q => {
  calls.push(q)
  if (q.method === 'eth_chainId') return '0x1'
  if (q.method === 'eth_accounts') return [owner]
  if (q.method === 'eth_getCode') return q.params[0].toLowerCase() === owner.toLowerCase() ? accountCode : '0x'
  if (q.method === 'eth_getTransactionCount') return pending && q.params[1] === 'pending' ? '0x2' : '0x1'
  if (q.method === 'eth_getBlockByNumber') return { baseFeePerGas: '0x10' }
  if (q.method === 'eth_gasPrice') return '0x1e'
  if (q.method === 'eth_getBalance') return '0xffffffffffffffff'
  if (q.method === 'eth_estimateGas') return '0x5208'
  if (q.method === 'eth_sendTransaction') { assert.equal(q.params[0].to, target); assert.equal(q.params[0].data, data); assert.equal(q.params[0].value, '0x0'); assert.equal(q.params[0].type, '0x2'); return hash }
  if (q.method === 'eth_getTransactionByHash') return { hash, from: owner, to: wrapped ? '0x1111111111111111111111111111111111111111' : target, nonce: '0x1', value: '0x0', input: wrapped ? '0x12345678' + target.slice(2).toLowerCase() + data.slice(2) : data }
  if (q.method === 'eth_getTransactionReceipt') return { status: '0x1', blockNumber: '0x100' }
  throw Error('Unexpected method: ' + q.method)
 } }
 return { calls, api: create({ provider, locks: { request: async (_, __, fn) => fn({}) }, storage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) }, generateData: () => data, isUnused: async () => !used }) }
}
test('route test only requests a transaction after review and identifies a direct outer transaction', async () => {
 const f = fixture(), row = await f.api.run(async quote => { assert.equal(f.calls.some(x => x.method === 'eth_sendTransaction'), false); return quote.approve() })
 assert.equal(row.state, 'submitted'); assert.equal((await f.api.check(hash)).direct, true); assert.equal(f.api.saved().state, 'direct')
})
test('route test detects a wrapped call instead of claiming a compatible transfer', async () => {
 const f = fixture({ wrapped: true }); await f.api.run(q => q.approve()); assert.equal((await f.api.check(hash)).direct, false); assert.equal(f.api.saved().state, 'wrapped')
})
test('route test refuses used data, unrecognized wallet delegation and pending transactions', async () => {
 for (const options of [{ used: true }, { accountCode: '0x' }, { pending: true }]) {
  const f = fixture(options); await assert.rejects(f.api.run(q => q.approve())); assert.equal(f.calls.some(x => x.method === 'eth_sendTransaction'), false)
 }
})
