'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), { ethers } = require('ethers')
const { discoverListings } = require('../../api/lib/trixmoji-market/listing-discovery.cjs')
const abi = require('../../assets/data/trixmoji-escrow-artifact.json').abi
const iface = new ethers.utils.Interface(abi), seller = '0x1111111111111111111111111111111111111111', marketAddress = '0x2222222222222222222222222222222222222222', minter = '0x3333333333333333333333333333333333333333', id = ethers.utils.id('clean-pop'), sha = ethers.utils.id('art'), txHash = ethers.utils.id('deposit')
function fixture() {
 const event = iface.encodeEventLog(iface.getEvent('Deposited'), [seller, id, 10]), logs = [{ ...event, blockNumber: 10 }]
 const provider = { getBlockNumber: async () => 20, getBlock: async () => ({ hash: ethers.utils.id('head') }), getLogs: async filter => filter.topics[0] === iface.getEventTopic('Deposited') ? logs : [], getTransaction: async () => ({ from: seller, to: marketAddress, data: id, value: ethers.constants.Zero }), getTransactionReceipt: async () => ({ status: 1, blockNumber: 10 }) }
 const market = { provider, address: marketAddress, interface: iface, filters: Object.fromEntries(['Listed', 'AuctionStarted', 'Deposited'].map(name => [name, () => ({ topics: [iface.getEventTopic(name)] })])), listings: async () => ({ price: ethers.BigNumber.from(0), nonce: ethers.BigNumber.from(1) }), auctions: async () => ({ reserve: ethers.BigNumber.from(10), amount: ethers.BigNumber.from(0), end: ethers.BigNumber.from(500), bidder: ethers.constants.AddressZero, nonce: ethers.BigNumber.from(1), settled: false }), depositBlock: async () => ethers.BigNumber.from(10) }
 const asset = { transaction_hash: id, creator: minter, content_sha: sha, current_owner: marketAddress, previous_owner: seller, ethscription_transfers: [{ from_address: seller, to_address: marketAddress, block_number: 10, transaction_hash: txHash }] }
 return { market, minter, startBlock: 10, confirmations: 1, indexer: async path => path === '/status' ? { last_imported_block: 20 } : asset, registry: async () => ({ contentSha: sha, tokenNo: 6 }) }
}
test('market discovery exposes verified escrow and auction details', async () => {
 const result = await discoverListings(fixture())
 assert.equal(result.deposits.length, 1, JSON.stringify(result)); assert.equal(result.deposits[0].tokenNo, 6); assert.equal(result.auctions.length, 1); assert.equal(result.auctions[0].reserveWei, '10')
})
test('market discovery excludes stale indexed custody', async () => {
 const config = fixture(), indexer = config.indexer
 config.indexer = async path => path === '/status' ? indexer(path) : { ...(await indexer(path)), current_owner: seller }
 const result = await discoverListings(config); assert.equal(result.deposits.length, 0); assert.equal(result.auctions.length, 0)
})
