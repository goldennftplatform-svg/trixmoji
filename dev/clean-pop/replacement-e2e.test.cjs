'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { ethers } = require('ethers')
const { sandbox } = require('../../../ethereumphunks-market/trixmoji/lib/sandbox-chain.cjs')
const { discoverListings } = require('../../api/lib/trixmoji-market/listing-discovery.cjs')
const { verifiedApproval } = require('../../api/lib/trixmoji-market/verified-approval.cjs')
test('combined direct deposit is discovered and verifier-approved against indexed custody on local EVM', async () => {
 const s = await sandbox()
 try {
  const id = ethers.utils.id('replacement-e2e'), sha = ethers.utils.id('content'), price = ethers.utils.parseEther('0.01')
  const payload = ethers.utils.hexConcat([id, ethers.utils.id('DEPOSIT_AND_LIST_SIGNATURE'), ethers.utils.hexZeroPad(price.toHexString(), 32), ethers.constants.HashZero])
  const receipt = await (await s.seller.sendTransaction({ to: s.market.address, data: payload })).wait()
  await s.mine(5)
  const asset = { transaction_hash: id, creator: s.creator.address, content_sha: sha, current_owner: s.market.address, previous_owner: s.seller.address, ethscription_transfers: [{ from_address: s.seller.address, to_address: s.market.address, block_number: receipt.blockNumber, transaction_hash: receipt.transactionHash }] }
  const indexer = async path => path === '/status' ? { last_imported_block: await s.provider.getBlockNumber() } : asset
  const registry = async () => ({ contentSha: sha, tokenNo: 6 })
  const result = await discoverListings({ market: s.market, indexer, registry, minter: s.creator.address, startBlock: receipt.blockNumber, confirmations: 1 })
  assert.equal(result.listings.length, 1); assert.equal(result.listings[0].priceWei, price.toString())
  const signed = await verifiedApproval({ market: s.market, signer: s.verifier, indexer, expectedChainId: 31337, expectedMarket: s.market.address, minter: s.creator.address, manifest: registry }, { id, seller: s.seller.address, buyer: s.buyer.address, kind: 0, amount: price, duration: 0 })
  const bought = await (await s.market.connect(s.buyer).buy(signed.approval, signed.signature, { value: price })).wait()
  assert.ok(bought.events.some(e => e.event === 'ethscriptions_protocol_TransferEthscriptionForPreviousOwner' && e.args.id === id))
 } finally { await s.close() }
})
test('separate raw deposit, cooldown and listing are discovered and purchase is verifier-authorized', async () => {
 const s = await sandbox()
 try {
  const id = ethers.utils.id('replacement-two-step'), sha = ethers.utils.id('content-two-step'), price = ethers.utils.parseEther('0.01')
  const receipt = await (await s.seller.sendTransaction({ to: s.market.address, data: id })).wait()
  const asset = { transaction_hash: id, creator: s.creator.address, content_sha: sha, current_owner: s.market.address, previous_owner: s.seller.address, ethscription_transfers: [{ from_address: s.seller.address, to_address: s.market.address, block_number: receipt.blockNumber, transaction_hash: receipt.transactionHash }] }
  const indexer = async path => path === '/status' ? { last_imported_block: await s.provider.getBlockNumber() } : asset
  const registry = async () => ({ contentSha: sha, tokenNo: 6 }), config = { market: s.market, indexer, registry, minter: s.creator.address, startBlock: receipt.blockNumber, confirmations: 1 }
  const before = await discoverListings(config); assert.equal(before.deposits.length, 1); assert.equal(before.listings.length, 0); assert.ok(before.deposits[0].cooldown > 0)
  await assert.rejects(s.market.connect(s.seller).list(id, price))
  await s.mine(5); await (await s.market.connect(s.seller).list(id, price)).wait()
  const after = await discoverListings(config); assert.equal(after.listings.length, 1); assert.equal(after.listings[0].priceWei, price.toString())
  const signed = await verifiedApproval({ market: s.market, signer: s.verifier, indexer, expectedChainId: 31337, expectedMarket: s.market.address, minter: s.creator.address, manifest: registry }, { id, seller: s.seller.address, buyer: s.buyer.address, kind: 0, amount: price, duration: 0 })
  const bought = await (await s.market.connect(s.buyer).buy(signed.approval, signed.signature, { value: price })).wait()
  assert.ok(bought.events.some(e => e.event === 'ethscriptions_protocol_TransferEthscriptionForPreviousOwner' && e.args.id === id))
 } finally { await s.close() }
})
