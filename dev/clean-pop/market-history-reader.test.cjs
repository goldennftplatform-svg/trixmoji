'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), { ethers } = require('ethers')
const { createHistoryReader } = require('../../api/lib/trixmoji-market/history-reader.cjs')
const hash = ethers.utils.id('historical transaction'), blockHash = ethers.utils.id('canonical block')
function fixture() {
 const tx = { hash, blockHash, blockNumber: 42 }, receipt = { transactionHash: hash, blockHash, blockNumber: 42 }
 const primary = { getTransaction: async () => null, getTransactionReceipt: async () => null, getBlock: async () => ({ hash: blockHash }) }
 const fallback = { getNetwork: async () => ({ chainId: 1 }), getTransaction: async () => tx, getTransactionReceipt: async () => receipt }
 return { primary, fallback, tx, receipt }
}
test('uses the configured RPC first and validates fallback history against its canonical block', async () => {
 const f = fixture(), reader = createHistoryReader(f.primary, f.fallback, 1)
 assert.equal((await reader.getTransaction(hash)).hash, hash); assert.equal((await reader.getTransactionReceipt(hash)).transactionHash, hash)
 let touched = false; f.primary.getTransaction = async () => f.tx; f.fallback.getNetwork = async () => { touched = true; throw Error('must not call') }
 assert.equal((await createHistoryReader(f.primary, f.fallback, 1).getTransaction(hash)).hash, hash); assert.equal(touched, false)
})
test('rejects fallback data from another chain, mismatched receipt or noncanonical block', async () => {
 let f = fixture(); f.fallback.getNetwork = async () => ({ chainId: 5 }); await assert.rejects(createHistoryReader(f.primary, f.fallback, 1).getTransaction(hash), /wrong network/)
 f = fixture(); f.receipt.transactionHash = ethers.constants.HashZero; await assert.rejects(createHistoryReader(f.primary, f.fallback, 1).getTransactionReceipt(hash), /do not match/)
 f = fixture(); f.primary.getBlock = async () => ({ hash: ethers.constants.HashZero }); await assert.rejects(createHistoryReader(f.primary, f.fallback, 1).getTransaction(hash), /does not match/)
})
