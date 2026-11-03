(function (root, factory) {
 'use strict'
 if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('ethers').ethers)
 else root.EthscriptionRouteProbe = factory(root.ethers)
})(typeof window !== 'undefined' ? window : globalThis, function (ethers) {
 'use strict'
 function classify(error) {
  var code = Number(error && error.code), message = String(error && error.message || '')
  if (code === -32601 || code === -32004 || code === 4200 || /method.*(not supported|not available|does not exist)/i.test(message)) return 'unsupported'
  if (code === -32602 || /invalid params|invalid input|missing.*param/i.test(message)) return 'invalid-request-rejected'
  if (code === 4001 || code === 4100) return 'not-authorized'
  return 'inconclusive'
 }
 function request(provider, payload) {
  return new Promise(function (resolve, reject) {
   var timer = setTimeout(function () { reject(Error('Wallet did not respond to ' + payload.method + '.')) }, 12000)
   try { Promise.resolve(provider.request(payload)).then(function (value) { clearTimeout(timer); resolve(value) }, function (error) { clearTimeout(timer); reject(error) }) }
   catch (error) { clearTimeout(timer); reject(error) }
  })
 }
 async function inspect(provider) {
  if (!provider || typeof provider.request !== 'function') throw Error('Connect an Ethereum wallet first.')
  var chain = await request(provider, { method: 'eth_chainId' }), accounts = await request(provider, { method: 'eth_accounts' })
  if (BigInt(chain) !== 1n) throw Error('Switch to Ethereum mainnet before checking.')
  if (!accounts || !ethers.utils.isAddress(accounts[0] || '')) throw Error('Connect an Ethereum wallet first.')
  var address = ethers.utils.getAddress(accounts[0]), code = await request(provider, { method: 'eth_getCode', params: [address, 'latest'] })
  if (!/^0x(?:[a-f0-9]{2})*$/i.test(String(code || ''))) throw Error('Wallet account code could not be read.')
  var delegated = /^0xef0100[a-f0-9]{40}$/i.test(code), hasCode = code.toLowerCase() !== '0x', delegateCall = null
  if (hasCode) {
   try {
    var iface = new ethers.utils.Interface(['function supportsExecutionMode(bytes32) view returns (bool)']), mode = '0xff' + '00'.repeat(31)
    var raw = await request(provider, { method: 'eth_call', params: [{ to: address, data: iface.encodeFunctionData('supportsExecutionMode', [mode]) }, 'latest'] })
    delegateCall = iface.decodeFunctionResult('supportsExecutionMode', raw)[0]
   } catch (_) {}
  }
  // Empty parameters can never describe a transaction. This does not request a
  // valid signature and never calls eth_sendTransaction or eth_sendRawTransaction.
  var signMethod = 'inconclusive'
  try { await request(provider, { method: 'eth_signTransaction', params: [] }) } catch (error) { signMethod = classify(error) }
  return { account: address, delegated: delegated, hasCode: hasCode, delegateCallSupported: delegateCall, signTransactionProbe: signMethod, depositCompatible: 'not-proven' }
 }
 return { inspect: inspect, classify: classify }
})
