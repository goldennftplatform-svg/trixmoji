'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { ethers } = require('ethers')
const verifier = require('../../api/lib/clean-pop-webp-v2-verify.cjs'), candidate = require('../../assets/data/clean-pop-webp-v2-candidate.json'), manifest = require('../../assets/ethscriptions/clean-pop-webp-v2/manifest.json')
const { DELEGATION_MANAGER } = require('../../api/lib/trixmoji-market/mint-call.cjs')
const token = 419, buyer = '0x1111111111111111111111111111111111111111', hash = ethers.utils.id('webp-mint-test')
const uri = 'data:image/webp;base64,' + fs.readFileSync(path.resolve(__dirname, '../../assets/ethscriptions/clean-pop-webp-v2/' + token + '.webp')).toString('base64')
const iface = new ethers.utils.Interface(candidate.abi), data = iface.encodeFunctionData('mint', [uri, manifest.files[token].proof, token])
function fixture() {
 let indexed = false
 const sent = { hash, from: buyer, to: candidate.address, contractAddress: candidate.address, owner: buyer, value: candidate.priceWei, uri }
 const chain = { isHash: h => /^0x[a-f0-9]{64}$/i.test(h), isAddr: a => ethers.utils.isAddress(a), same: (a, b) => String(a).toLowerCase() === String(b).toLowerCase(), readPhunkMint: async () => sent, readInput: async () => ({ input: data }), requireIndexedMint: async () => { indexed = true } }
 return { chain, sent, indexed: () => indexed }
}
test('verifies exact WebP content, proof, mint and independent indexer confirmation', async () => {
 const f = fixture(), result = await verifier.verify(f.chain, hash, buyer, token)
 assert.equal(result.complete, true); assert.equal(result.preview, '/assets/ethscriptions/clean-pop-webp-v2/419.webp'); assert.equal(f.indexed(), true)
})
test('rejects altered art, wrong proof, buyer, minter and missing indexing', async () => {
 const altered = uri.slice(0, 23) + (uri[23] === 'A' ? 'B' : 'A') + uri.slice(24)
 assert.throws(() => verifier.validatePayload(altered, manifest.files[token].proof, token), /proof/)
 assert.throws(() => verifier.validatePayload(uri, manifest.files[0].proof, token), /proof/)
 let f = fixture(); f.sent.from = '0x2222222222222222222222222222222222222222'; await assert.rejects(verifier.verify(f.chain, hash, buyer, token), /does not match/)
 f = fixture(); f.sent.contractAddress = buyer; await assert.rejects(verifier.verify(f.chain, hash, buyer, token), /does not match/)
 f = fixture(); f.chain.requireIndexedMint = async () => { throw Error('indexing pending') }; await assert.rejects(verifier.verify(f.chain, hash, buyer, token), /indexing pending/)
})
test('verifies a single wrapped mint only after matching event, proof, value and indexer', async () => {
 const f = fixture(), wrap = new ethers.utils.Interface(['function redeemDelegations(bytes[] permissionContexts,bytes32[] modes,bytes[] executionCallDatas)'])
 const packed = ethers.utils.hexConcat([candidate.address, ethers.utils.hexZeroPad(ethers.BigNumber.from(candidate.priceWei).toHexString(), 32), data])
 const wrapped = wrap.encodeFunctionData('redeemDelegations', [['0x'], [ethers.constants.HashZero], [packed]])
 f.sent.to = DELEGATION_MANAGER; f.sent.value = '0'; f.chain.readInput = async () => ({ input: wrapped })
 assert.equal((await verifier.verify(f.chain, hash, buyer, token)).complete, true); assert.equal(f.indexed(), true)
 f.sent.owner = '0x2222222222222222222222222222222222222222'; await assert.rejects(verifier.verify(f.chain, hash, buyer, token), /does not match/)
})
