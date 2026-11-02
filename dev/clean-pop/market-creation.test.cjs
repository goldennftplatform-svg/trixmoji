'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const { ethers } = require('ethers')

const contract = '0x11019B7af0F833f5695a44584c5B31Bb1D0baabC'
const owner = '0x1111111111111111111111111111111111111111'
const hash = '0x' + 'aa'.repeat(32)
const uri = 'data:image/png;base64,aGVsbG8='
const topic = '0x665fba0baf3dc33e9943340197893ac16f56482c2defb8de60f944987fee451c'

function chain(indexedOwner = owner, emitter = contract) {
 const source = fs.readFileSync(path.resolve(__dirname, '../../api/lib/ethscriptions-chain.js'), 'utf8')
 const module = { exports: {} }
 const tx = { from: owner, to: contract, input: '0x12345678', value: '0x0' }
 const receipt = { status: '0x1', blockNumber: '0x10', logs: [{ address: emitter,
  topics: [topic, ethers.utils.hexZeroPad(owner, 32)], data: ethers.utils.defaultAbiCoder.encode(['string'], [uri]) }] }
 const rpc = async (_, method) => ({ eth_chainId: '0x1', eth_blockNumber: '0x11', eth_getTransactionByHash: tx, eth_getTransactionReceipt: receipt })[method]
 const context = { module, exports: module.exports, require: () => ({ ethRpcs: () => [], firstRpc: rpc }),
  process, Buffer, BigInt, AbortSignal, fetch: async () => ({ ok: true, json: async () => ({ result: {
   transaction_hash: hash, initial_owner: indexedOwner, creator: contract, content_uri: uri
  } }) }) }
 vm.runInNewContext(source, context)
 return module.exports
}

test('market recognizes independently indexed Clean Pop creation events', async () => {
 const result = await chain().readCreation(hash)
 assert.equal(result.creator.toLowerCase(), contract.toLowerCase())
 assert.equal(result.firstOwner.toLowerCase(), owner.toLowerCase())
 assert.equal(result.contentUri, uri)
})

test('market rejects mismatched indexer ownership or event emitter', async () => {
 await assert.rejects(chain('0x2222222222222222222222222222222222222222').readCreation(hash), /indexed Ethscription does not match/)
 await assert.rejects(chain(owner, owner).readCreation(hash), /supported ethscription/)
})
