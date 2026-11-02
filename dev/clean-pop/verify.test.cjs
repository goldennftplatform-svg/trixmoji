'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const { ethers } = require('ethers')
const info = require('../../assets/data/clean-pop-minter.json')
const manifest = require('../../assets/ethscriptions/clean-pop-v1/manifest.json')
const verifier = require('../../api/lib/clean-pop-verify')
const root = path.resolve(__dirname, '../..'), owner = '0x1111111111111111111111111111111111111111', hash = '0x' + 'ab'.repeat(32)
const uri = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'assets/ethscriptions/clean-pop-v1/0.png')).toString('base64')
const proof = manifest.files[0].proof
test('verifier accepts exact approved artwork and rejects altered image, proof and number', () => {
 verifier.validatePayload(uri, proof, 0)
 assert.throws(() => verifier.validatePayload(uri + 'A', proof, 0), /proof|payload/)
 assert.throws(() => verifier.validatePayload(uri, proof, 1), /proof/)
 assert.throws(() => verifier.validatePayload(uri, proof.slice(1), 0), /payload/)
})
test('verifier checks buyer, contract, transaction calldata and indexer', async () => {
 const iface = new ethers.utils.Interface(info.abi)
 const sent = { to: info.address, contractAddress: info.address, from: owner, owner, value: info.priceWei, uri }
 let indexed = 0
 const chain = { isHash: () => true, isAddr: () => true, same: (a, b) => String(a).toLowerCase() === String(b).toLowerCase(),
  readPhunkMint: async () => sent, readInput: async () => ({ input: iface.encodeFunctionData('mint', [uri, proof, 0]) }), requireIndexedMint: async () => { indexed++ } }
 const result = await verifier.verify(chain, hash, owner, 0)
 assert.equal(result.complete, true); assert.equal(indexed, 1)
 await assert.rejects(verifier.verify(chain, hash, owner, 1), /number/)
 sent.owner = '0x2222222222222222222222222222222222222222'
 await assert.rejects(verifier.verify(chain, hash, owner, 0), /does not match/)
})
test('market artwork decoding supports creator replacements and rejects mismatched events', () => {
 const iface = new ethers.utils.Interface(info.abi)
 const data = iface.encodeFunctionData('deliverReplacement', [uri, proof, 0, '0x' + 'ab'.repeat(32), owner])
 assert.equal(verifier.decodeCreation(data, uri).preview, '/assets/ethscriptions/clean-pop-v1/0.png')
 assert.throws(() => verifier.decodeCreation(data, uri + 'A'), /does not match/)
})
