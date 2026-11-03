'use strict'
// Read-only mainnet evidence: a delegated MetaMask account made an indexed
// direct deposit-and-list transaction to EtherPhunks. No wallet is used.
const { ethers } = require('ethers')
const hash = '0x2e03e45ad50f008dfdde4728b35ca4c4396efbfa4ee0720130b046f8abed1a19'
const owner = '0x2adc9aa73493a2dd76953145621b531487b184da', market = '0xd3418772623be1a3cc6b6d45cb46420cedd9154a'
const implementation = '0xef010063c0c19a282a1b52b07dd5a65b58948a07dae32b'
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()
async function get(url) { const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw Error('Reference data unavailable: HTTP ' + r.status); return r.json() }
async function main() {
 const tx = await get('https://eth.blockscout.com/api/v2/transactions/' + hash)
 if (tx.status !== 'ok' || !same(tx.hash, hash) || !same(tx.from && tx.from.hash, owner) || !same(tx.to && tx.to.hash, market) || tx.type !== 2 || !/^0x(?:[a-f0-9]{64})+$/i.test(String(tx.raw_input || '')) || !Number.isSafeInteger(tx.block_number)) throw Error('Reference transaction did not match the expected direct deposit.')
 const id = tx.raw_input.slice(0, 66), asset = (await get('https://api.ethscriptions.com/v2/ethscriptions/' + id)).result
 if (!asset || !same(asset.transaction_hash, id) || !Array.isArray(asset.ethscription_transfers)) throw Error('Reference Ethscription unavailable.')
 const matches = asset.ethscription_transfers.filter(t => same(t.transaction_hash, hash) && same(t.from_address, owner) && same(t.to_address, market) && Number(t.block_number) === tx.block_number)
 if (matches.length !== 1) throw Error('Indexer did not confirm the reference deposit.')
 const response = await fetch('https://eth.drpc.org', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [owner, ethers.utils.hexValue(tx.block_number - 1)] }) })
 if (!response.ok) throw Error('Archive RPC unavailable.')
 const archive = await response.json(); if (archive.error || !same(archive.result, implementation)) throw Error('The historical account delegation could not be verified.')
 console.log(JSON.stringify({ verified: true, transaction: hash, blockNumber: tx.block_number, sender: owner, market, ethscriptionId: id, indexedTransfer: true, delegatedAtPreviousBlock: true, note: 'Reference proves this other delegated account sent a direct indexed transaction; it does not prove the aa3E wallet will choose the same route.' }, null, 2))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
