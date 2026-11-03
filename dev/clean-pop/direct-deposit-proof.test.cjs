'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), { ethers } = require('ethers')
const { buildDirectDeposit, verifyDirectDeposit } = require('../../api/lib/trixmoji-market/direct-deposit-proof.cjs')
const seller = '0x47cf60bdd877203264921d05ce26f81f6d36aa3e', escrow = '0xd935e162b6070c4feaf600c67f7f729f318515a2', id = '0xdf234357362b4884a50aa356f0cc6c76a52e72634c29c8e7440ca8232e285e74', hash = ethers.utils.id('simulated direct deposit')
function fixture() {
 return { seller, escrow, id, hash, latestBlock: 110, indexedBlock: 110, recordedBlock: 100,
  transaction: { hash, from: seller, to: escrow, input: id, value: '0x0' }, receipt: { transactionHash: hash, status: 1, blockNumber: 100 },
  asset: { transaction_hash: id, current_owner: escrow, previous_owner: seller, ethscription_transfers: [{ transaction_hash: hash, from_address: seller, to_address: escrow, block_number: 100 }] } }
}
test('minimal request matches the Quantum direct transfer shape', () => {
 const tx = buildDirectDeposit({ seller, escrow, id })
 assert.deepEqual(Object.keys(tx).sort(), ['data', 'from', 'to', 'value']); assert.equal(tx.data, id); assert.equal(tx.value, '0x0')
})
test('a fully verified direct and indexed deposit is accepted', () => {
 assert.equal(verifyDirectDeposit(fixture()).verified, true)
})
test('a wrapped transaction, stale index, missing escrow record or wrong owner is never accepted', () => {
 for (const mutate of [f => { f.transaction.to = '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3'; f.transaction.input = '0x1234' }, f => { f.indexedBlock = 100 }, f => { f.recordedBlock = 0 }, f => { f.asset.current_owner = seller }, f => { f.asset.ethscription_transfers = [] }]) {
  const f = fixture(); mutate(f); assert.throws(() => verifyDirectDeposit(f))
 }
})
