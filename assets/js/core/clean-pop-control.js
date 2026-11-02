(function (root) {
 'use strict'
 var KEY = 'trixmoji.clean-pop-v1.open-sale'
 var CALL = '0x16c38b3c' + '0'.repeat(64)
 function same(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 function saved() { return JSON.parse(root.localStorage.getItem(KEY) || 'null') }
 async function inspect(provider, info) {
  if (BigInt(await provider.request({ method: 'eth_chainId' })) !== 1n) throw Error('Switch to Ethereum mainnet.')
  var accounts = await provider.request({ method: 'eth_accounts' })
  if (!accounts || !same(accounts[0], info.creator)) throw Error('Connect the configured creator wallet.')
  var code = await provider.request({ method: 'eth_getCode', params: [info.address, 'latest'] })
  if (!code || !same(code, info.runtime)) throw Error('Deployed contract does not match the approved runtime.')
  var state = await provider.request({ method: 'eth_call', params: [{ to: info.address, data: '0x5c975abb' }, 'latest'] })
  if (!/^0x[0-9a-f]{64}$/i.test(String(state)) || BigInt(state) > 1n) throw Error('Could not read contract pause state.')
  return { paused: BigInt(state) === 1n }
 }
 async function open(provider, info, review) {
  if (!root.navigator.locks) throw Error('Use a browser with Web Locks support to coordinate wallet requests.')
  return root.navigator.locks.request(KEY, { ifAvailable: true }, async function (lock) {
   if (!lock) throw Error('An opening request is already running in another tab.')
   var existing = saved()
   if (existing && ['awaiting-wallet', 'submitted'].includes(existing.state)) throw Error('An opening request already exists. Check its transaction before retrying.')
   var state = await inspect(provider, info)
   if (!state.paused) return { alreadyOpen: true }
   var tx = { from: info.creator, to: info.address, value: '0x0', data: CALL }
   var gas = BigInt(await provider.request({ method: 'eth_estimateGas', params: [tx] }))
   var price = BigInt(await provider.request({ method: 'eth_gasPrice' }))
   await review({ estimatedGasWei: gas * price, contract: info.address })
   state = await inspect(provider, info)
   if (!state.paused) return { alreadyOpen: true }
   var row = { state: 'awaiting-wallet', contract: info.address, creator: info.creator, at: new Date().toISOString() }
   root.localStorage.setItem(KEY, JSON.stringify(row))
   var hash
   try { hash = await provider.request({ method: 'eth_sendTransaction', params: [Object.assign({}, tx, { gas: '0x' + (gas + gas / 5n).toString(16) })] }) }
   catch (error) {
    if (Number(error && error.code) === 4001) root.localStorage.removeItem(KEY)
    throw error
   }
   if (!/^0x[0-9a-f]{64}$/i.test(String(hash))) throw Error('No transaction hash returned. Inspect wallet activity before retrying.')
   row.state = 'submitted'; row.hash = hash
   try { root.localStorage.setItem(KEY, JSON.stringify(row)) } catch (_) { throw Error('Transaction submitted: ' + hash + '. Save this hash and check it before retrying.') }
   return row
  })
 }
 async function check(provider, info, hash) {
  if (!/^0x[0-9a-f]{64}$/i.test(String(hash || ''))) throw Error('Enter the transaction hash from the creator wallet. Do not retry while its outcome is unknown.')
  await inspect(provider, info)
  var tx = await provider.request({ method: 'eth_getTransactionByHash', params: [hash] })
  if (!tx || !same(tx.from, info.creator) || !same(tx.to, info.address) || !same(tx.input || tx.data, CALL) || BigInt(tx.value || '0x0') !== 0n) throw Error('That hash is not the creator’s Clean Pop opening transaction.')
  var receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] })
  if (!receipt) throw Error('Transaction is not confirmed yet. Do not send another.')
  if (receipt.status !== '0x1' && receipt.status !== '0x0') throw Error('Transaction receipt status is unavailable.')
  var row = { state: receipt.status === '0x1' ? 'confirmed' : 'failed', hash: hash, contract: info.address, creator: info.creator, at: new Date().toISOString() }
  if (row.state === 'confirmed' && (await inspect(provider, info)).paused) throw Error('Transaction confirmed, but the contract currently reports paused. Inspect its current state.')
  root.localStorage.setItem(KEY, JSON.stringify(row)); return row
 }
 var api = { saved: saved, inspect: inspect, open: open, check: check }
 if (typeof module !== 'undefined' && module.exports) module.exports = api
 else root.CleanPopControl = api
})(typeof window !== 'undefined' ? window : globalThis)
