'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), { ethers } = require('ethers')
const { inspect } = require('../../netlify/functions/clean-pop-preflight')
const info = require('../../assets/data/clean-pop-minter.json'), manifest = require('../../assets/ethscriptions/clean-pop-v1/manifest.json')
const png = fs.readFileSync(path.resolve(__dirname, '../../assets/ethscriptions/clean-pop-v1/1.png'))
const iface = new ethers.utils.Interface(info.abi), buyer = '0x1111111111111111111111111111111111111111'
function mocks(overrides = {}) {
 let estimates = 0
 const fetch = async url => url.includes('/manifest.json') ? { ok: true, json: async () => manifest } : url.includes('/exists/') ? { ok: true, json: async () => ({ result: { exists: !!overrides.exists } }) } : { ok: true, arrayBuffer: async () => png }
 const rpc = async (_, method, params) => {
  if (method === 'eth_chainId') return '0x1'
  if (method === 'eth_getCode') return info.runtime
  if (method === 'eth_gasPrice') return '0x10'
  if (method === 'eth_estimateGas') { estimates++; return '0x123456' }
  if (method === 'eth_call') {
   const selector = params[0].data.slice(0, 10)
   if (selector === iface.getSighash('paused')) return iface.encodeFunctionResult('paused', [!!overrides.paused])
   if (selector === iface.getSighash('mintedBy')) return iface.encodeFunctionResult('mintedBy', [0])
   if (selector === iface.getSighash('minted')) return iface.encodeFunctionResult('minted', [params[0].to.toLowerCase() === info.address.toLowerCase() ? !!overrides.minted : !!overrides.reserved])
  }
  throw Error('Unexpected request: ' + method)
 }
 return { fetch, rpc, estimates: () => estimates }
}
test('read-only preflight validates real artwork and estimates an available mint', async () => {
 const m = mocks(), result = await inspect({ token: '1', buyer }, m)
 assert.equal(result.artworkProofValid, true); assert.equal(result.readyToRequestWallet, true); assert.equal(m.estimates(), 1)
})
test('paused, reserved, minted, or duplicate artwork is never estimated as ready', async () => {
 for (const key of ['paused', 'reserved', 'minted', 'exists']) {
  const m = mocks({ [key]: true }), result = await inspect({ token: '1', buyer }, m)
  assert.equal(result.readyToRequestWallet, false, key); assert.equal(m.estimates(), 0, key)
 }
})
