'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const { createRequire } = require('node:module')
const { ethers } = require('ethers')
const info = require('../../assets/data/clean-pop-minter.json')
const manifest = require('../../assets/ethscriptions/clean-pop-v1/manifest.json')

const contract = '0x11019B7af0F833f5695a44584c5B31Bb1D0baabC'
const owner = '0x1111111111111111111111111111111111111111'
const hash = '0x' + 'aa'.repeat(32)
const lock = '0x' + 'bb'.repeat(32)
const uri = 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../../assets/ethscriptions/clean-pop-v1/0.png')).toString('base64')
const topic = '0x665fba0baf3dc33e9943340197893ac16f56482c2defb8de60f944987fee451c'

function chain(indexedOwner = owner, emitter = contract, currentOwner = owner, previousOwner = owner) {
 const source = fs.readFileSync(path.resolve(__dirname, '../../api/lib/ethscriptions-chain.js'), 'utf8')
 const module = { exports: {} }
 const tx = { from: owner, to: contract, input: new ethers.utils.Interface(info.abi).encodeFunctionData('mint', [uri, manifest.files[0].proof, 0]), value: '0x0' }
 const receipt = { status: '0x1', blockNumber: '0x10', logs: [{ address: emitter,
  topics: [topic, ethers.utils.hexZeroPad(owner, 32)], data: ethers.utils.defaultAbiCoder.encode(['string'], [uri]) }] }
 const rpc = async (_, method) => ({ eth_chainId: '0x1', eth_blockNumber: '0x11', eth_getTransactionByHash: tx, eth_getTransactionReceipt: receipt })[method]
 const realRequire = createRequire(path.resolve(__dirname, '../../api/lib/ethscriptions-chain.js'))
 const context = { module, exports: module.exports, require: name => name === './awardz-chain' ? ({ ethRpcs: () => [], firstRpc: rpc }) : realRequire(name),
  process, Buffer, BigInt, AbortSignal, fetch: async () => ({ ok: true, json: async () => ({ result: {
   transaction_hash: hash, initial_owner: indexedOwner, current_owner: currentOwner, previous_owner: previousOwner, creator: contract, content_uri: uri,
   ethscription_transfers: [{ ethscription_transaction_hash: hash, transaction_hash: lock, from_address: owner, to_address: currentOwner }]
  } }) }) }
 vm.runInNewContext(source, context)
 return module.exports
}

test('market recognizes independently indexed Clean Pop creation events', async () => {
 const result = await chain().readCreation(hash)
 assert.equal(result.creator.toLowerCase(), '0x915a3d363d0a4e4470b531f008f5142c540e5417')
 assert.equal(result.creationContract.toLowerCase(), contract.toLowerCase())
 assert.equal(result.firstOwner.toLowerCase(), owner.toLowerCase())
 assert.equal(result.preview, '/assets/ethscriptions/clean-pop-v1/0.png')
 assert.equal(result.contentUri, '')
})
test('listing custody requires the indexer to show the escrow as current owner', async () => {
 const escrow = '0x3333333333333333333333333333333333333333'
 assert.equal((await chain(owner, contract, escrow).requireIndexedTransfer(hash, lock, owner, escrow, true)).current_owner, escrow)
 await assert.rejects(chain(owner, contract, owner).requireIndexedTransfer(hash, lock, owner, escrow, true), /exact transfer/)
 await assert.rejects(chain(owner, contract, escrow).requireIndexedTransfer(hash, '0x' + 'c'.repeat(64), owner, escrow, true), /exact transfer/)
 await assert.rejects(chain(owner, contract, escrow, escrow).requireIndexedTransfer(hash, lock, owner, escrow, true), /seller.s transfer/)
})

test('market rejects mismatched indexer ownership or event emitter', async () => {
 await assert.rejects(chain('0x2222222222222222222222222222222222222222').readCreation(hash), /indexed Ethscription does not match/)
 await assert.rejects(chain(owner, owner).readCreation(hash), /supported ethscription/)
})
