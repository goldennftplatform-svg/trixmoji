'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), { ethers } = require('ethers')
const { create } = require('../../assets/js/core/market-wallet-adapter')
const artifact = require('../../assets/data/trixmoji-escrow-artifact.json')

function fixture({ accountCode = '0x', depositBlock = 0, wrapped = false, combinedDepositEnabled = false } = {}) {
 const account = '0x1111111111111111111111111111111111111111', market = '0x2222222222222222222222222222222222222222', verifier = '0x3333333333333333333333333333333333333333', id = ethers.utils.id('deposit'), iface = new ethers.utils.Interface(artifact.abi), store = new Map(), calls = []
 const provider = { request: async q => {
  calls.push(q)
  if (q.method === 'eth_chainId') return '0x1'
  if (q.method === 'eth_accounts') return [account]
  if (q.method === 'eth_getCode') return q.params[0].toLowerCase() === account.toLowerCase() ? accountCode : '0x6000'
  if (q.method === 'eth_getTransactionCount') return '0x0'
  if (q.method === 'eth_getTransactionByHash' && wrapped) return { from: account, to: verifier, input: '0x1234', value: '0x0' }
  if (q.method === 'eth_getTransactionReceipt' && wrapped) { const event = iface.encodeEventLog(iface.getEvent('Deposited'), [account, id, 10]); return { status: '0x1', logs: [{ address: market, ...event }] } }
  if (q.method === 'eth_call') {
   const tx = q.params[0]
   if (tx.data === iface.encodeFunctionData('creator')) return iface.encodeFunctionResult('creator', [account])
   if (tx.data === iface.encodeFunctionData('verifier')) return iface.encodeFunctionResult('verifier', [verifier])
   if (tx.data === iface.encodeFunctionData('depositBlock', [account, id])) return iface.encodeFunctionResult('depositBlock', [depositBlock])
   assert.equal(tx.value, '0x0'); return '0x'
  }
  if (q.method === 'eth_estimateGas') { assert.equal(q.params[0].value, '0x0'); return '0x100' }
  if (q.method === 'eth_sendTransaction') { assert.equal(q.params[0].value, '0x0'); assert.equal(q.params[0].gas, '0x133'); return ethers.utils.id('tx') }
  throw Error('Unexpected RPC method ' + q.method)
 } }
 const adapter = create({ provider, storage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v) }, locks: { request: async (_, __, fn) => fn({}) }, abi: artifact.abi, runtimeHash: ethers.utils.keccak256('0x6000'), market, creator: account, verifier, chainId: 1, combinedDepositEnabled, readAsset: async () => ({ transaction_hash: id, current_owner: account }) })
 return { adapter, id, calls, account, market }
}
test('escrow deposit uses canonical Ethereum RPC quantities', async () => {
 const { adapter, id, calls } = fixture()
 const result = await adapter.run('deposit', { id }, quote => quote.approve())
 assert.equal(result.state, 'submitted'); assert.equal(calls.filter(q => q.method === 'eth_sendTransaction').length, 1)
})
test('combined deposit is opt-in and sends Chopper-format calldata only after review', async () => {
 const blocked = fixture()
 await assert.rejects(blocked.adapter.run('depositAndList', { id: blocked.id, amountWei: '123' }, q => q.approve()), /not enabled/)
 assert.equal(blocked.calls.some(q => q.method === 'eth_sendTransaction'), false)
 const enabled = fixture({ combinedDepositEnabled: true })
 await enabled.adapter.run('depositAndList', { id: enabled.id, amountWei: '123' }, q => q.approve())
 const tx = enabled.calls.find(q => q.method === 'eth_sendTransaction').params[0]
 assert.equal(tx.data, ethers.utils.hexConcat([enabled.id, ethers.utils.id('DEPOSIT_AND_LIST_SIGNATURE'), ethers.utils.hexZeroPad('0x7b', 32), ethers.constants.HashZero]))
 assert.equal(tx.to, enabled.market); assert.equal(tx.value, '0x0')
})
test('delegated EOAs may use the direct transfer route, but stale escrow records are blocked', async () => {
 const direct = fixture({ accountCode: '0xef0100' + '11'.repeat(20) })
 const result = await direct.adapter.run('deposit', { id: direct.id }, quote => quote.approve())
 assert.equal(result.state, 'submitted'); assert.equal(direct.calls.filter(q => q.method === 'eth_sendTransaction').length, 1)
 const recorded = fixture({ depositBlock: 123 })
 await assert.rejects(recorded.adapter.run('deposit', { id: recorded.id }, quote => quote.approve()), /already has an escrow deposit record/)
 assert.equal(recorded.calls.some(q => q.method === 'eth_sendTransaction'), false)
})
test('a wrapped deposit that did not transfer is reported without clearing the saved state', async () => {
 const { adapter, id, account, market } = fixture({ wrapped: true }), row = { action: 'deposit', assetId: id, from: account, to: market, data: id, value: '0x0', hash: ethers.utils.id('wrapped'), state: 'submitted' }
 await assert.rejects(adapter.reconcile(row, async () => true), /wrapped deposit.*false deposit record.*Do not retry/)
 assert.equal(row.state, 'submitted')
})
