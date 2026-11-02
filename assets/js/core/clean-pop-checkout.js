(function (root) {
 'use strict'
 var KEY = 'trixmoji.clean-pop.checkout.v1'
 function records() {
  var rows = JSON.parse(root.localStorage.getItem(KEY) || '[]')
  if (!Array.isArray(rows)) throw new Error('Saved Clean Pop checkout data is invalid. Do not mint again.')
  return rows
 }
 function save(rows) { root.localStorage.setItem(KEY, JSON.stringify(rows)) }
 function update(row) {
  var rows = records().filter(function (x) { return x.id !== row.id })
  rows.push(row); save(rows)
 }
 function remove(id) { save(records().filter(function (x) { return x.id !== id })) }
 function same(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 function readRpc(provider, payload, timeoutMs) {
  return new Promise(function (resolve, reject) {
   var timer = setTimeout(function () { var error = new Error('Wallet did not respond to ' + payload.method + '. No mint transaction has been requested.'); error.code = 'RPC_TIMEOUT'; reject(error) }, timeoutMs)
   try { Promise.resolve(provider.request(payload)).then(function (value) { clearTimeout(timer); resolve(value) }, function (error) { clearTimeout(timer); reject(error) }) }
   catch (error) { clearTimeout(timer); reject(error) }
  })
 }
 async function send(options) {
  var progress = options.progress || function () {}
  if (!root.navigator.locks) throw new Error('This browser cannot coordinate checkout tabs. Use a current browser.')
  return root.navigator.locks.request('trixmoji-clean-pop-checkout', { ifAvailable: true }, async function (lock) {
   if (!lock) throw new Error('Clean Pop checkout is already running in another tab.')
   if (records().some(function (r) { return r.state !== 'complete' && r.state !== 'failed' })) {
    throw new Error('A previous Clean Pop mint needs checking before another transaction.')
   }
   progress('Checking wallet, network and piece availability…')
   await options.preflight()
   progress('Estimating transaction gas…')
   var estimate, gasPrice, fallback
   async function serverEstimate() {
    if (!options.gasFallback) throw new Error('The wallet did not finish estimating gas. No mint transaction was requested.')
    if (!fallback) { progress('Wallet estimate timed out. Checking the same mint through the site’s read-only Ethereum RPC…'); fallback = await options.gasFallback() }
    if (!fallback || BigInt(fallback.gas || 0) <= 0n || BigInt(fallback.gasPrice || 0) <= 0n) throw new Error('A reliable gas estimate is unavailable. No mint transaction was requested.')
    return fallback
   }
   try { estimate = BigInt(await readRpc(options.provider, { method: 'eth_estimateGas', params: [options.tx] }, options.rpcTimeoutMs || 45000)) }
   catch (error) { if (error.code !== 'RPC_TIMEOUT') throw error; estimate = BigInt((await serverEstimate()).gas) }
   try { gasPrice = BigInt(await readRpc(options.provider, { method: 'eth_gasPrice' }, options.rpcTimeoutMs || 20000)) }
   catch (error) { if (error.code !== 'RPC_TIMEOUT') throw error; gasPrice = BigInt((await serverEstimate()).gasPrice) }
   progress('Rechecking availability before the wallet review…')
   await options.preflight()
   var reviewedAt = Date.now(), invalidated = false, sent = false
   function changed() { invalidated = true }
   if (options.provider.on) { options.provider.on('accountsChanged', changed); options.provider.on('chainChanged', changed) }
   async function approve() {
    if (sent) throw new Error('The wallet request was already made. Do not submit again.')
    if (invalidated || Date.now() - reviewedAt > 60000 || Date.now() < reviewedAt) throw new Error('Wallet, network, or quote changed. Prepare the mint again.')
    var row = { id: String(options.tokenNo), tokenNo: options.tokenNo, buyer: options.from,
     state: 'awaiting-wallet', hash: '', contract: options.tx.to, at: new Date().toISOString() }
    update(row); sent = true
    progress('Transaction requested from your wallet. Open the selected wallet extension to approve or reject. Do not submit again.')
    var hash
    try {
     // Called directly from the review button click: no asynchronous RPC between click and wallet request.
     hash = await options.provider.request({ method: 'eth_sendTransaction', params: [Object.assign({}, options.tx, { chainId: '0x1', gas: '0x' + (estimate + estimate / 5n).toString(16) })] })
    } catch (error) {
     if (Number(error && error.code) === 4001) remove(row.id)
     throw error
    }
    if (!/^0x[a-f0-9]{64}$/i.test(String(hash))) throw new Error('Wallet returned no valid transaction hash. Check wallet activity; do not mint again.')
    row.hash = hash; row.state = 'submitted'
    try { update(row) } catch (_) { throw new Error('Transaction submitted: ' + hash + '. Save this hash; browser storage failed. Do not mint again.') }
    return row
   }
   try {
    var result = await options.review({ gas: estimate * gasPrice, price: BigInt(options.tx.value), approve: approve })
    if (!sent || !result || !result.hash) throw new Error('No wallet transaction was submitted.')
    return result
   } finally {
    if (options.provider.removeListener) { options.provider.removeListener('accountsChanged', changed); options.provider.removeListener('chainChanged', changed) }
   }
  })
 }
 async function reconcile(row, verify) {
  if (!/^0x[a-f0-9]{64}$/i.test(String(row.hash || ''))) throw new Error('Check wallet activity and supply its transaction hash. Do not mint again.')
  var result = await verify(row)
  if (!result || !result.complete) throw new Error((result && result.message) || 'Mint confirmation or indexing is pending. Do not mint again.')
  row.state = 'complete'; update(row); return result
 }
 var api = { records: records, send: send, reconcile: reconcile }
 if (typeof module !== 'undefined' && module.exports) module.exports = api
 else root.CleanPopCheckout = api
})(typeof window !== 'undefined' ? window : globalThis)
