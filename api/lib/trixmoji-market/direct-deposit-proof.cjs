'use strict'
const { ethers } = require('ethers')
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()

// Mirrors the minimal from/to/value/data shape used by Quantum's live
// sendTransactionWithFallback. This only constructs data; it never signs or sends.
function buildDirectDeposit({ seller, escrow, id }) {
 if (!ethers.utils.isAddress(seller || '') || !ethers.utils.isAddress(escrow || '') || same(seller, ethers.constants.AddressZero) || same(escrow, ethers.constants.AddressZero) || same(seller, escrow) || !/^0x[a-f0-9]{64}$/i.test(String(id || ''))) throw Error('Invalid direct deposit request.')
 return { from: ethers.utils.getAddress(seller), to: ethers.utils.getAddress(escrow), value: '0x0', data: id.toLowerCase() }
}

// A successful EVM call is not enough: require the outer transaction itself,
// contract record, confirmation depth, and independent indexer to agree.
function verifyDirectDeposit({ seller, escrow, id, hash, transaction, receipt, asset, indexedBlock, latestBlock, recordedBlock }) {
 const expected = buildDirectDeposit({ seller, escrow, id })
 if (!/^0x[a-f0-9]{64}$/i.test(String(hash || ''))) throw Error('Invalid transaction hash.')
 if (!transaction || !receipt || !same(transaction.hash, hash) || !same(receipt.transactionHash, hash) || !same(transaction.from, expected.from) || !same(transaction.to, expected.to) || !same(transaction.input || transaction.data, expected.data) || !ethers.BigNumber.from(transaction.value || 0).isZero()) throw Error('The outer transaction is not the exact direct deposit.')
 if (!(receipt.status === 1 || receipt.status === '0x1') || !Number.isSafeInteger(receipt.blockNumber) || receipt.blockNumber < 1) throw Error('Deposit receipt is not confirmed.')
 if (!Number.isSafeInteger(latestBlock) || !Number.isSafeInteger(indexedBlock) || !Number.isSafeInteger(recordedBlock) || latestBlock < receipt.blockNumber + 5 || indexedBlock < receipt.blockNumber || latestBlock - indexedBlock > 2 || recordedBlock !== receipt.blockNumber) throw Error('Deposit confirmation, escrow record, or indexer freshness is insufficient.')
 if (!asset || !same(asset.transaction_hash, id) || !same(asset.current_owner, escrow) || !same(asset.previous_owner, seller) || !Array.isArray(asset.ethscription_transfers)) throw Error('The indexer does not confirm escrow custody.')
 const matches = asset.ethscription_transfers.filter(t => same(t.transaction_hash, hash) && same(t.from_address, seller) && same(t.to_address, escrow) && Number(t.block_number) === receipt.blockNumber)
 if (matches.length !== 1) throw Error('The indexer does not show exactly one matching deposit transfer.')
 return { verified: true, hash: hash.toLowerCase(), id: id.toLowerCase(), seller: expected.from, escrow: expected.to, blockNumber: receipt.blockNumber }
}
module.exports = { buildDirectDeposit, verifyDirectDeposit }
