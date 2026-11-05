'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), { ethers } = require('ethers')
const { create } = require('../../assets/js/core/clean-pop-webp-v2-deployment')
const artifact = require('../../assets/data/clean-pop-webp-v2-candidate.json'), iface = new ethers.utils.Interface(artifact.abi)
const factoryCode = '0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3', hash = ethers.utils.id('mock-deploy')
function fixture() {
 let deployed = false, sends = 0, factory = factoryCode, sender = artifact.creator
 const store = new Map(), provider = { request: async ({method, params=[]}) => {
  if (method === 'eth_chainId') return '0x1'
  if (method === 'eth_accounts') return [sender]
  if (method === 'eth_getCode') return params[0].toLowerCase() === artifact.factory.toLowerCase() ? factory : deployed ? artifact.runtime : '0x'
  if (method === 'eth_getTransactionCount') return '0x1'
  if (method === 'eth_getBalance') return '0xde0b6b3a7640000'
  if (method === 'eth_gasPrice') return '0x3b9aca00'
  if (method === 'eth_estimateGas') return '0x9eaa0'
  if (method === 'eth_sendTransaction') { sends++; assert.equal(params[0].data, artifact.deployData); deployed = true; return hash }
  if (method === 'eth_getTransactionByHash') return { hash, from: artifact.creator, to: artifact.factory, input: artifact.deployData, value: '0x0' }
  if (method === 'eth_getTransactionReceipt') return { transactionHash: hash, status: '0x1' }
  if (method === 'eth_call') {
   if (params[0].to.toLowerCase() === artifact.factory.toLowerCase()) return artifact.address.toLowerCase()
   for (const [name, value] of [['OWNER', artifact.creator], ['SITE', artifact.site], ['PRICE', artifact.priceWei], ['ROOT', artifact.root], ['paused', true]]) if (params[0].data === iface.encodeFunctionData(name)) return iface.encodeFunctionResult(name, [value])
  }
  throw Error('Unexpected RPC ' + method)
 } }
 const storage = { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) }
 const api = create({ provider, storage, locks: { request: async (_, __, fn) => fn({}) }, artifact })
 return { api, provider, storage, sent: () => sends, setFactory: x => { factory = x }, setSender: x => { sender = x } }
}
test('deployment is simulated before explicit wallet approval and confirmed against exact runtime and terms', async () => {
 const f = fixture(), plan = await f.api.plan(); assert.equal(f.sent(), 0); assert.equal(plan.tx.to.toLowerCase(), artifact.factory.toLowerCase())
 const row = await f.api.run(q => { assert.equal(q.root, artifact.root); assert.equal(f.sent(), 0); return q.approve() })
 assert.equal(row.hash, hash); assert.equal(f.sent(), 1)
 const result = await f.api.check(hash); assert.equal(result.confirmed, true); assert.equal(result.paused, true); assert.equal(result.address, artifact.address)
 await assert.rejects(f.api.plan(), /already saved/)
})
test('deployment refuses a wrong creator, factory or altered artifact without sending', async () => {
 let f = fixture(); f.setSender('0x1111111111111111111111111111111111111111'); await assert.rejects(f.api.plan(), /creator wallet/); assert.equal(f.sent(), 0)
 f = fixture(); f.setFactory('0x1234'); await assert.rejects(f.api.plan(), /factory/); assert.equal(f.sent(), 0)
 assert.throws(() => create({ provider: f.provider, storage: f.storage, locks: { request() {} }, artifact: { ...artifact, root: ethers.constants.HashZero } }), /reviewed deployment/)
})
test('no-hash deployment recovery requires explicit confirmation and unchanged nonce and code', async () => {
 const f = fixture(), key = 'trixmoji.clean-pop-webp-v2.deployment'
 const row = { state: 'awaiting-wallet', hash: '', nonce: '1', creator: artifact.creator, address: artifact.address, payloadHash: ethers.utils.keccak256(artifact.deployData) }
 f.storage.setItem(key, JSON.stringify(row))
 await assert.rejects(f.api.recoverUnsent(false), /Confirm/)
 row.nonce = '2'; f.storage.setItem(key, JSON.stringify(row)); await assert.rejects(f.api.recoverUnsent(true), /Nonce changed/)
 row.nonce = '1'; f.storage.setItem(key, JSON.stringify(row)); assert.equal((await f.api.recoverUnsent(true)).recovered, true)
 assert.equal(f.api.saved(), null); assert.equal(f.sent(), 0)
})
