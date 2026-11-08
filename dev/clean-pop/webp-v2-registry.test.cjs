'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('fs'), path = require('path'), { ethers } = require('ethers')
const { createCleanPopRegistry } = require('../../api/lib/trixmoji-market/clean-pop-registry.cjs')
const { DELEGATION_MANAGER } = require('../../api/lib/trixmoji-market/mint-call.cjs')
const artifact = require('../../assets/data/clean-pop-webp-v2-candidate.json')
const manifest = require('../../assets/ethscriptions/clean-pop-webp-v2/manifest.json')
const iface = new ethers.utils.Interface(artifact.abi), id = ethers.utils.id('local-webp-creation'), buyer = '0x1111111111111111111111111111111111111111', token = 419
const uri = 'data:image/webp;base64,' + fs.readFileSync(path.resolve(__dirname, '../../assets/ethscriptions/clean-pop-webp-v2/' + token + '.webp')).toString('base64')
function fixture() {
 const data = iface.encodeFunctionData('mint', [uri, manifest.files[token].proof, token])
 const event = iface.encodeEventLog(iface.getEvent('ethscriptions_protocol_CreateEthscription'), [buyer, uri])
 const tx = { hash: id, from: buyer, to: artifact.address, value: ethers.BigNumber.from(artifact.priceWei), data }
 const receipt = { status: 1, transactionHash: id, logs: [{ address: artifact.address, ...event }] }
 const indexed = { transaction_hash: id, creator: artifact.address, initial_owner: buyer, content_sha: ethers.utils.sha256(ethers.utils.toUtf8Bytes(uri)), content_uri: uri }
 const provider = { getTransaction: async () => tx, getTransactionReceipt: async () => receipt }
 const config = { provider, indexer: async () => indexed, minter: artifact.address, abi: artifact.abi, root: manifest.root, mintPriceWei: artifact.priceWei, mimeType: 'image/webp' }
 return { config, tx, receipt, indexed }
}
test('fixed WebP registry verifies exact content, proof, creator and indexed creation', async () => {
 const f = fixture(), result = await createCleanPopRegistry(f.config)(id)
 assert.equal(result.tokenNo, token); assert.equal(result.contentSha, f.indexed.content_sha)
})
test('WebP registry fails closed for wrong creator, mismatched indexed content and unconfigured MIME', async () => {
 let f = fixture(); f.tx.to = buyer; await assert.rejects(createCleanPopRegistry(f.config)(id), /creation transaction/)
 f = fixture(); f.indexed.content_sha = ethers.constants.HashZero; await assert.rejects(createCleanPopRegistry(f.config)(id), /indexer does not confirm/)
 f = fixture(); delete f.config.mimeType; await assert.rejects(createCleanPopRegistry(f.config)(id), /artwork payload/)
 f = fixture(); f.config.mimeType = 'image/svg+xml'; assert.throws(() => createCleanPopRegistry(f.config), /Unsupported/)
})
test('WebP registry accepts a single verified MetaMask-wrapped mint, but not unsupported wrappers', async () => {
 const wrap = new ethers.utils.Interface(['function redeemDelegations(bytes[] permissionContexts,bytes32[] modes,bytes[] executionCallDatas)'])
 function withWrapped(configure = {}) {
  const f = fixture(), inner = ethers.utils.hexConcat([configure.target || artifact.address, ethers.utils.hexZeroPad(ethers.BigNumber.from(configure.value || artifact.priceWei).toHexString(), 32), f.tx.data])
  f.tx.to = configure.manager || DELEGATION_MANAGER; f.tx.value = ethers.constants.Zero
  f.tx.data = wrap.encodeFunctionData('redeemDelegations', [['0x'], [configure.mode || ethers.constants.HashZero], [inner]])
  f.config.allowWrappedMints = true
  return f
 }
 let f = withWrapped(); assert.equal((await createCleanPopRegistry(f.config)(id)).tokenNo, token)
 f = withWrapped(); f.config.allowWrappedMints = false; await assert.rejects(createCleanPopRegistry(f.config)(id), /creation transaction/)
 f = withWrapped({ target: buyer }); await assert.rejects(createCleanPopRegistry(f.config)(id), /creation transaction/)
 f = withWrapped({ manager: buyer }); await assert.rejects(createCleanPopRegistry(f.config)(id), /creation transaction/)
 f = withWrapped({ mode: ethers.utils.hexZeroPad('0x01', 32) }); await assert.rejects(createCleanPopRegistry(f.config)(id), /creation transaction/)
 f = withWrapped({ value: '1' }); await assert.rejects(createCleanPopRegistry(f.config)(id), /transaction value/)
 f = withWrapped(); f.tx.from = '0x2222222222222222222222222222222222222222'; await assert.rejects(createCleanPopRegistry(f.config)(id), /Creation event/)
})
