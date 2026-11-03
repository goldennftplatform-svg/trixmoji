'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), { ethers } = require('ethers')
const { inspect } = require('../../netlify/functions/market-escrow-plan')
function rpcFixture(options = {}) {
 const calls = []
 async function rpc(method, params) {
  calls.push({ method, params })
  if (method === 'eth_chainId') return options.chain || '0x1'
  if (method === 'eth_getTransactionCount') return options.pending && params[1] === 'pending' ? '0x13' : '0x12'
  if (method === 'eth_getCode') return '0x'
  if (method === 'eth_estimateGas') return '0x100000'
  if (method === 'eth_gasPrice') return '0x10'
  if (method === 'eth_getBalance') return options.balance || '0xffffffffffffffff'
  throw Error('Unexpected request: ' + method)
 }
 return { rpc, calls }
}
test('public escrow plan is read-only and pins the provided creator and verifier', async () => {
 const f = rpcFixture(), result = await inspect(f.rpc)
 assert.equal(result.readOnly, true); assert.equal(result.transactionSubmitted, false)
 assert.equal(result.creator, '0x915A3D363D0a4e4470B531f008F5142c540E5417')
 assert.equal(result.verifier, '0x5f5d219c6B3f732eBDCe4BFD9c4655957Ff472C4')
 assert.equal(result.predictedAddress, ethers.utils.getContractAddress({ from: result.creator, nonce: 18 }))
 assert.equal(f.calls.some(x => x.method === 'eth_sendTransaction'), false)
})
test('escrow plan refuses wrong network, pending creator transactions and insufficient balance', async () => {
 for (const options of [{ chain: '0xaa36a7' }, { pending: true }, { balance: '0x0' }]) {
  const f = rpcFixture(options); await assert.rejects(inspect(f.rpc)); assert.equal(f.calls.some(x => x.method === 'eth_sendTransaction'), false)
 }
})
test('verifier can deploy while creator remains the royalty recipient', async () => {
 const f = rpcFixture(), verifier = '0x5f5d219c6B3f732eBDCe4BFD9c4655957Ff472C4'
 const result = await inspect(f.rpc, verifier)
 assert.equal(result.deployer, verifier)
 assert.equal(result.creator, '0x915A3D363D0a4e4470B531f008F5142c540E5417')
 assert.equal(result.predictedAddress, ethers.utils.getContractAddress({ from: verifier, nonce: 18 }))
 assert.equal(f.calls.find(x => x.method === 'eth_estimateGas').params[0].from, verifier)
 await assert.rejects(inspect(f.rpc, '0x0000000000000000000000000000000000000001'), /Invalid deploying wallet/)
})
