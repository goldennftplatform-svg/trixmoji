'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), { ethers } = require('ethers')
const { create } = require('../../assets/js/core/market-wallet-adapter')
const artifact = require('../../assets/data/trixmoji-escrow-artifact.json')

test('escrow deposit uses canonical Ethereum RPC quantities', async () => {
 const account = '0x1111111111111111111111111111111111111111', market = '0x2222222222222222222222222222222222222222', verifier = '0x3333333333333333333333333333333333333333', id = ethers.utils.id('deposit'), iface = new ethers.utils.Interface(artifact.abi), store = new Map(), calls = []
 const provider = { request: async q => {
  calls.push(q)
  if (q.method === 'eth_chainId') return '0x1'
  if (q.method === 'eth_accounts') return [account]
  if (q.method === 'eth_getCode') return '0x6000'
  if (q.method === 'eth_getTransactionCount') return '0x0'
  if (q.method === 'eth_call') {
   const tx = q.params[0]
   if (tx.data === iface.encodeFunctionData('creator')) return iface.encodeFunctionResult('creator', [account])
   if (tx.data === iface.encodeFunctionData('verifier')) return iface.encodeFunctionResult('verifier', [verifier])
   assert.equal(tx.value, '0x0'); return '0x'
  }
  if (q.method === 'eth_estimateGas') { assert.equal(q.params[0].value, '0x0'); return '0x100' }
  if (q.method === 'eth_sendTransaction') { assert.equal(q.params[0].value, '0x0'); assert.equal(q.params[0].gas, '0x133'); return ethers.utils.id('tx') }
  throw Error('Unexpected RPC method ' + q.method)
 } }
 const adapter = create({ provider, storage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v) }, locks: { request: async (_, __, fn) => fn({}) }, abi: artifact.abi, runtimeHash: ethers.utils.keccak256('0x6000'), market, creator: account, verifier, chainId: 1, readAsset: async () => ({ transaction_hash: id, current_owner: account }) })
 const result = await adapter.run('deposit', { id }, quote => quote.approve())
 assert.equal(result.state, 'submitted'); assert.equal(calls.filter(q => q.method === 'eth_sendTransaction').length, 1)
})
