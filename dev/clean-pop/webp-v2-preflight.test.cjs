'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { ethers } = require('ethers')
const { inspect } = require('../../netlify/functions/clean-pop-webp-v2-preflight')
const info = require('../../assets/data/clean-pop-webp-v2-candidate.json'), manifest = require('../../assets/ethscriptions/clean-pop-webp-v2/manifest.json')
const token = 419, image = fs.readFileSync(path.resolve(__dirname, '../../assets/ethscriptions/clean-pop-webp-v2/' + token + '.webp')), iface = new ethers.utils.Interface(info.abi), buyer = '0x1111111111111111111111111111111111111111'
function mocks(options = {}) {
 let estimated = 0
 const fetch = async url => url.includes('/manifest.json') ? { ok: true, json: async () => manifest } : url.includes('/exists/') ? { ok: true, json: async () => ({ result: { exists: !!options.exists } }) } : { ok: true, arrayBuffer: async () => image }
 const rpc = async (_, method, params) => {
  if (method === 'eth_chainId') return '0x1'
  if (method === 'eth_getCode') return options.noCode ? '0x' : info.runtime
  if (method === 'eth_gasPrice') return '0x10'
  if (method === 'eth_estimateGas') { estimated++; if (options.estimateError) throw Error(options.estimateError); return '0x123456' }
  if (method === 'eth_call') {
   const selector = params[0].data.slice(0,10)
   if (selector === iface.getSighash('paused')) return iface.encodeFunctionResult('paused', [!!options.paused])
   if (selector === iface.getSighash('minted')) return iface.encodeFunctionResult('minted', [!!options.minted])
   if (selector === iface.getSighash('mintedBy')) return iface.encodeFunctionResult('mintedBy', [options.count || 0])
  }
  throw Error('Unexpected RPC ' + method)
 }
 return { fetch, rpc, estimates: () => estimated }
}
test('WebP preflight permits formerly reserved number with valid artwork and an exact deployed runtime', async () => {
 const m = mocks(), result = await inspect({ token: String(token), buyer }, m)
 assert.equal(result.readyToRequestWallet, true); assert.equal(result.artworkProofValid, true); assert.equal(result.contentSha256, manifest.files[token].contentSha256); assert.equal(m.estimates(), 1)
})
test('WebP preflight blocks undeployed runtime, paused/minted items, wallet cap, duplicate content and other estimate errors', async () => {
 await assert.rejects(inspect({ token: String(token), buyer }, mocks({ noCode: true })), /not deployed/)
 for (const options of [{ paused: true }, { minted: true }, { count: 20 }, { exists: true }]) { const m = mocks(options), result = await inspect({ token: String(token), buyer }, m); assert.equal(result.readyToRequestWallet, false); assert.equal(m.estimates(), 0) }
 const bad = await inspect({ token: String(token), buyer }, mocks({ estimateError: 'execution reverted' })); assert.equal(bad.readyToRequestWallet, false)
 const funds = await inspect({ token: String(token), buyer }, mocks({ estimateError: 'insufficient funds for gas' })); assert.equal(funds.readyToRequestWallet, true); assert.equal(funds.insufficientFunds, true)
 const outOfFunds = await inspect({ token: String(token), buyer }, mocks({ estimateError: 'EVM error: OutOfFunds' })); assert.equal(outOfFunds.readyToRequestWallet, true); assert.equal(outOfFunds.insufficientFunds, true)
})
