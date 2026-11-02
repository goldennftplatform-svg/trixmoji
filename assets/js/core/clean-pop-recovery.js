(function (root) {
 'use strict'
 async function inspect(provider, creator, address, saved) {
  if (!saved || saved.address.toLowerCase() !== address.toLowerCase()) throw new Error('Saved attempt does not match this contract.')
  if (saved.hash || saved.state !== 'awaiting-wallet') throw new Error('This attempt has a transaction hash or an unexpected state. Inspect its receipt before resetting.')
  if (BigInt(await provider.request({method:'eth_chainId'})) !== 1n) throw new Error('Switch to Ethereum mainnet.')
  const accounts = await provider.request({method:'eth_accounts'})
  if (!accounts || !accounts[0] || accounts[0].toLowerCase() !== creator.toLowerCase()) throw new Error('Connect the configured creator wallet.')
  const code = await provider.request({method:'eth_getCode',params:[address,'latest']})
  if (code !== '0x' && code !== '0x0') throw new Error('Contract code already exists. Use VERIFY CONTRACT CODE instead of deploying again.')
  const latest = BigInt(await provider.request({method:'eth_getTransactionCount',params:[creator,'latest']}))
  const pending = BigInt(await provider.request({method:'eth_getTransactionCount',params:[creator,'pending']}))
  if (pending !== latest) throw new Error('Your wallet RPC reports a pending transaction. Resolve it before clearing the attempt.')
  return {latestNonce:latest.toString(),pendingNonce:pending.toString()}
 }
 const api = {inspect:inspect}
 if (typeof module !== 'undefined' && module.exports) module.exports=api
 else root.CleanPopRecovery=api
})(typeof window !== 'undefined' ? window : globalThis)
