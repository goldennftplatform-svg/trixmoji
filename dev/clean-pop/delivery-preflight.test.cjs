'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { ethers } = require('ethers')
const { inspect } = require('../../netlify/functions/clean-pop-delivery-preflight')
const info = require('../../assets/data/clean-pop-minter.json'), ledger = require('../../assets/data/clean-pop-legacy-mints.json'), manifest = require('../../assets/ethscriptions/clean-pop-v1/manifest.json')
const png = fs.readFileSync(path.resolve(__dirname, '../../assets/ethscriptions/clean-pop-v1/0.png')), entry = ledger.mints.find(x => x.tokenNo === 0), recipient = '0x1111111111111111111111111111111111111111', iface = new ethers.utils.Interface(info.abi)
function mocks(options = {}) {
 let estimates = 0
 return { count: () => estimates, fetch: async url => url.includes('/manifest.json') ? { ok: true, json: async () => manifest } : url.includes('/exists/') ? { ok: true, json: async () => ({ result: { exists: !!options.exists } }) } : { ok: true, arrayBuffer: async () => png },
  rpc: async (_, method, params) => {
   if (method === 'eth_chainId') return '0x1'
   if (method === 'eth_getCode') return info.runtime
   if (method === 'eth_gasPrice') return '0x10'
   if (method === 'eth_estimateGas') { estimates++; assert.equal(params[0].from, info.creator); assert.equal(params[0].value, '0x0'); return '0x123456' }
   if (method === 'eth_call') {
    const selector = params[0].data.slice(0, 10), target = params[0].to.toLowerCase()
    if (selector === iface.getSighash('paused')) return iface.encodeFunctionResult('paused', [!!options.paused])
    if (selector === iface.getSighash('replaced')) return iface.encodeFunctionResult('replaced', [!!options.replaced])
    if (selector === iface.getSighash('minted')) return iface.encodeFunctionResult('minted', [target === info.address.toLowerCase() ? !!options.minted : !options.notLegacy])
   }
   throw Error('Unexpected request: ' + method)
  } }
}
test('creator delivery is estimated both while public sale is paused and while it is open', async () => {
 for (const paused of [true, false]) {
  const m = mocks({ paused }), result = await inspect({ token: '0', legacy: entry.legacyId, recipient }, m)
  assert.equal(result.readyToRequestWallet, true); assert.equal(result.paused, paused); assert.equal(result.contentSha256, manifest.files[0].contentSha256); assert.equal(m.count(), 1)
 }
})
test('already-minted, already-replaced, nonlegacy and duplicate artwork are never estimated', async () => {
 for (const flag of ['minted', 'replaced', 'notLegacy', 'exists']) {
  const m = mocks({ [flag]: true }), result = await inspect({ token: '0', legacy: entry.legacyId, recipient }, m)
  assert.equal(result.readyToRequestWallet, false, flag); assert.equal(m.count(), 0, flag)
 }
 await assert.rejects(inspect({ token: '0', legacy: '0x' + 'b'.repeat(64), recipient }, mocks()), /not in the original/)
})
