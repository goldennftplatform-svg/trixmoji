'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), { ethers } = require('ethers')
const { create } = require('../../assets/js/core/market-wallet-adapter')
const artifact = require('../../assets/data/trixmoji-escrow-replacement-artifact.json'), iface = new ethers.utils.Interface(artifact.abi)
const owner = '0x1111111111111111111111111111111111111111', market = '0x2222222222222222222222222222222222222222', verifier = '0x3333333333333333333333333333333333333333', id = ethers.utils.id('asset'), depositHash = ethers.utils.id('deposit'), cancelHash = ethers.utils.id('cancel'), key = 'trixmoji.market.contract.transaction.v1'
function fixture({ recorded = 0, ownerNow = owner, indexed = 110, cancelEvent = true } = {}) {
 const calls = [], store = new Map(), row = { key: 'test-key', action: 'depositAndList', assetId: id, from: owner, to: market, hash: depositHash, state: 'submitted' }
 store.set(key, JSON.stringify([row]))
 const depLog = iface.encodeEventLog(iface.getEvent('Deposited'), [owner, id, 100]), cancelLog = iface.encodeEventLog(iface.getEvent('Cancelled'), [owner, id])
 const provider = { request: async q => { calls.push(q.method)
  if (q.method === 'eth_chainId') return '0x1'
  if (q.method === 'eth_accounts') return [owner]
  if (q.method === 'eth_getCode') return '0x6000'
  if (q.method === 'eth_blockNumber') return '0x6e'
  if (q.method === 'eth_call') {
   if (q.params[0].data === iface.encodeFunctionData('creator')) return iface.encodeFunctionResult('creator', [owner])
   if (q.params[0].data === iface.encodeFunctionData('verifier')) return iface.encodeFunctionResult('verifier', [verifier])
   if (q.params[0].data === iface.encodeFunctionData('depositBlock', [owner, id])) return iface.encodeFunctionResult('depositBlock', [recorded])
  }
  if (q.method === 'eth_getTransactionByHash') return q.params[0] === depositHash ? { hash: depositHash, from: owner, to: verifier } : { hash: cancelHash, from: owner, to: verifier }
  if (q.method === 'eth_getTransactionReceipt') return q.params[0] === depositHash ? { transactionHash: depositHash, status: '0x1', blockNumber: '0x64', logs: [{ address: market, ...depLog }] } : { transactionHash: cancelHash, status: '0x1', blockNumber: '0x69', logs: cancelEvent ? [{ address: market, ...cancelLog }] : [] }
  throw Error('unexpected ' + q.method)
 } }
 const client = create({ provider, storage: { getItem: k => store.get(k) || null, setItem: (k,v) => store.set(k,v) }, locks: { request: async (_, __, fn) => fn({}) }, abi: artifact.abi, runtimeHash: ethers.utils.keccak256('0x6000'), market, creator: owner, verifier, chainId: 1, readAsset: async () => ({ transaction_hash: id, current_owner: ownerNow }) })
 return { client, calls, store, readStatus: async () => ({ last_imported_block: indexed }) }
}
test('cleared wrapped deposit is reconciled without submitting a transaction', async () => {
 const f = fixture(), result = await f.client.reconcileClearedWrapped('test-key', cancelHash, f.readStatus)
 assert.equal(result.resolved, true); assert.equal(JSON.parse(f.store.get(key))[0].state, 'failed'); assert.equal(f.calls.includes('eth_sendTransaction'), false)
 assert.ok([...f.store.keys()].some(k => k.startsWith(key + '.recovery.')))
})
test('reconciliation refuses active record, changed owner, stale indexer and missing cancellation event', async () => {
 for (const options of [{ recorded: 100 }, { ownerNow: market }, { indexed: 104 }, { cancelEvent: false }]) {
  const f = fixture(options); await assert.rejects(f.client.reconcileClearedWrapped('test-key', cancelHash, f.readStatus)); assert.equal(JSON.parse(f.store.get(key))[0].state, 'submitted'); assert.equal(f.calls.includes('eth_sendTransaction'), false)
 }
})
