'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { ethers } = require('ethers')
const { sandbox } = require('../../../ethereumphunks-market/trixmoji/lib/sandbox-chain.cjs')
const { compile } = require('../../../ethereumphunks-market/trixmoji/build.cjs')
const { create } = require('../../assets/js/core/escrow-deployment.js')
test('replacement uses isolated saved state and deploys reviewed constructor on local EVM', async () => {
 const s = await sandbox()
 try {
  const artifact = compile(), store = new Map([['trixmoji.market.deployment.v1', JSON.stringify({ state: 'confirmed', address: 'existing' })]])
  const provider = { request: q => q.method === 'eth_accounts' ? Promise.resolve([s.creator.address]) : s.engine.request(q) }
  const config = { provider, artifact, creator: s.creator.address, verifier: s.verifier.address, deployer: s.creator.address, chainId: 31337, expectedBytecodeHash: ethers.utils.keccak256(artifact.bytecode), storageKey: 'trixmoji.market.deployment.replacement-v1', storage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) }, locks: { request: async (_, __, fn) => fn({}) } }
  const client = create(config)
  assert.equal(client.saved(), null)
  const row = await client.run(q => q.approve()), result = await client.check(row.hash)
  assert.equal(result.confirmed, true); assert.equal(result.creator, s.creator.address); assert.equal(result.verifier, s.verifier.address)
  assert.equal(JSON.parse(store.get('trixmoji.market.deployment.v1')).address, 'existing')
  await assert.rejects(client.plan(), /already exists/)
 } finally { await s.close() }
})
