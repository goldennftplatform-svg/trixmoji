'use strict'
const { test } = require('node:test'), assert = require('node:assert/strict'), { ethers } = require('ethers')
const { inspect } = require('../../assets/js/core/ethscription-route-probe')
const owner = '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E', code = '0xef010063c0c19a282a1b52b07dd5a65b58948a07dae32b'
function fixture(signError = { code: -32004, message: 'Method not supported' }) {
 const calls = [], provider = { request: async q => {
  calls.push(q)
  if (q.method === 'eth_chainId') return '0x1'
  if (q.method === 'eth_accounts') return [owner]
  if (q.method === 'eth_getCode') return code
  if (q.method === 'eth_call') return ethers.utils.defaultAbiCoder.encode(['bool'], [false])
  if (q.method === 'eth_signTransaction') { assert.deepEqual(q.params, []); throw signError }
  throw Error('Unexpected method: ' + q.method)
 } }
 return { provider, calls }
}
test('read-only check detects unsupported signing and does not submit a transaction', async () => {
 const f = fixture(), result = await inspect(f.provider)
 assert.equal(result.delegated, true); assert.equal(result.delegateCallSupported, false); assert.equal(result.signTransactionProbe, 'unsupported'); assert.equal(result.depositCompatible, 'not-proven')
 assert.equal(f.calls.some(x => x.method === 'eth_sendTransaction' || x.method === 'eth_sendRawTransaction'), false)
})
test('invalid-parameter response remains inconclusive for deposit compatibility', async () => {
 const f = fixture({ code: -32602, message: 'Invalid params' }), result = await inspect(f.provider)
 assert.equal(result.signTransactionProbe, 'invalid-request-rejected'); assert.equal(result.depositCompatible, 'not-proven')
})
