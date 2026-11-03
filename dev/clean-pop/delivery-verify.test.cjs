'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), { ethers } = require('ethers')
const info = require('../../assets/data/clean-pop-minter.json'), ledger = require('../../assets/data/clean-pop-legacy-mints.json'), manifest = require('../../assets/ethscriptions/clean-pop-v1/manifest.json')
const { verify, legacyRecord } = require('../../api/lib/clean-pop-delivery-verify')
const row = ledger.mints.find(x => x.tokenNo === 0), recipient = '0x1111111111111111111111111111111111111111', hash = '0x' + 'a'.repeat(64)
const uri = 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../../assets/ethscriptions/clean-pop-v1/0.png')).toString('base64')
function fixture(patch = {}) {
 const sent = { to: info.address, contractAddress: info.address, from: info.creator, owner: recipient, value: '0', uri, ...patch }
 let indexed = false
 const data = new ethers.utils.Interface(info.abi).encodeFunctionData('deliverReplacement', [uri, manifest.files[0].proof, 0, row.legacyId, recipient])
 const chain = { isHash: x => /^0x[a-f0-9]{64}$/i.test(x), isAddr: x => ethers.utils.isAddress(x), same: (a, b) => String(a).toLowerCase() === String(b).toLowerCase(),
  readPhunkMint: async () => sent, readInput: async () => ({ input: data }), requireIndexedMint: async () => { indexed = true } }
 return { chain, indexed: () => indexed }
}
test('delivery verifier requires creator, exact recipient, token, approved artwork and indexer', async () => {
 const f = fixture(), result = await verify(f.chain, hash, 0, row.legacyId, recipient)
 assert.equal(result.complete, true); assert.equal(result.tokenNo, 0); assert.equal(f.indexed(), true)
})
test('delivery verifier rejects wrong owner, sender, value and non-ledger IDs', async () => {
 for (const patch of [{ owner: info.creator }, { from: recipient }, { value: info.priceWei }]) {
  const f = fixture(patch); await assert.rejects(verify(f.chain, hash, 0, row.legacyId, recipient), /does not match/); assert.equal(f.indexed(), false)
 }
 assert.throws(() => legacyRecord(0, '0x' + 'b'.repeat(64)), /not in the original/)
})
