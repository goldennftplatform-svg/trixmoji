(function (root) {
 'use strict'
 function createCheckout(KEY) {
 var activeWalletRequests = 0
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
    if (!fallback) { progress(options.preferServerGas ? 'Estimating this mint through the site’s read-only Ethereum RPC…' : 'Wallet estimate timed out. Checking the same mint through the site’s read-only Ethereum RPC…'); fallback = await options.gasFallback() }
     if (!fallback || (!fallback.insufficientFunds && (BigInt(fallback.gas || 0) <= 0n || BigInt(fallback.gasPrice || 0) <= 0n))) throw new Error('A reliable gas estimate is unavailable. No mint transaction was requested.')
    return fallback
   }
   if (options.preferServerGas) {
     var server = await serverEstimate(); estimate = server.insufficientFunds ? null : BigInt(server.gas); gasPrice = server.insufficientFunds ? null : BigInt(server.gasPrice)
   } else {
    try { estimate = BigInt(await readRpc(options.provider, { method: 'eth_estimateGas', params: [options.tx] }, options.rpcTimeoutMs || 45000)) }
    catch (error) { if (error.code !== 'RPC_TIMEOUT') throw error; estimate = BigInt((await serverEstimate()).gas) }
    try { gasPrice = BigInt(await readRpc(options.provider, { method: 'eth_gasPrice' }, options.rpcTimeoutMs || 20000)) }
    catch (error) { if (error.code !== 'RPC_TIMEOUT') throw error; gasPrice = BigInt((await serverEstimate()).gasPrice) }
   }
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
     activeWalletRequests++
      var requestTx = Object.assign({}, options.tx, { chainId: '0x1' })
      if (estimate !== null) requestTx.gas = '0x' + (estimate + estimate / 5n).toString(16)
      hash = await options.provider.request({ method: 'eth_sendTransaction', params: [requestTx] })
    } catch (error) {
     if (Number(error && error.code) === 4001) remove(row.id)
     throw error
    } finally { activeWalletRequests-- }
    if (!/^0x[a-f0-9]{64}$/i.test(String(hash))) throw new Error('Wallet returned no valid transaction hash. Check wallet activity; do not mint again.')
    row.hash = hash; row.state = 'submitted'
    try { update(row) } catch (_) { throw new Error('Transaction submitted: ' + hash + '. Save this hash; browser storage failed. Do not mint again.') }
    return row
   }
   try {
     var result = await options.review({ gas: estimate === null ? null : estimate * gasPrice, insufficientFunds: estimate === null, price: BigInt(options.tx.value), approve: approve })
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
 async function recoverUnsent(options) {
  if (options.confirmed !== true) throw new Error('Confirm there is no pending mint transaction or open wallet approval request.')
  if (!root.navigator.locks) throw new Error('Use a browser with Web Locks support to recover this request.')
  return root.navigator.locks.request('trixmoji-clean-pop-checkout', { ifAvailable: true }, async function (lock) {
   if (!lock || activeWalletRequests > 0) throw new Error('A wallet request is still running. Finish or reject it in the wallet before recovery.')
   var snapshot = root.localStorage.getItem(KEY), rows = records(), id = String(options.tokenNo)
   var row = rows.find(function (item) { return item.id === id })
   if (!row || row.state !== 'awaiting-wallet' || row.hash || !same(row.buyer, options.from) || !same(row.contract, options.info.address) || !Number.isInteger(row.tokenNo) || row.tokenNo < 0 || row.tokenNo >= 10000) throw new Error('Recovery applies only to this wallet’s no-hash mint request. Check any saved transaction hash instead.')
   var rpc = function (method, params) { return readRpc(options.provider, { method: method, params: params || [] }, 20000) }
   if (BigInt(await rpc('eth_chainId')) !== 1n) throw new Error('Switch to Ethereum mainnet.')
   var accounts = await rpc('eth_accounts')
   if (!accounts || !same(accounts[0], row.buyer)) throw new Error('Reconnect the original minting wallet.')
   var code = await rpc('eth_getCode', [row.contract, 'latest'])
   if (!code || !same(code, options.info.runtime)) throw new Error('Clean Pop contract code does not match the approved deployment.')
   var data = '0x7dc0bf3f' + BigInt(row.tokenNo).toString(16).padStart(64, '0')
   var minted = await rpc('eth_call', [{ to: row.contract, data: data }, 'latest'])
   if (!/^0x[0-9a-f]{64}$/i.test(String(minted)) || BigInt(minted) > 1n) throw new Error('Could not verify the token’s mint state.')
   if (BigInt(minted) !== 0n) throw new Error('This token is already minted. Check wallet activity and its transaction hash instead of retrying.')
   var latest = BigInt(await rpc('eth_getTransactionCount', [row.buyer, 'latest']))
   var pending = BigInt(await rpc('eth_getTransactionCount', [row.buyer, 'pending']))
   if (pending !== latest) throw new Error('The wallet RPC reports a pending transaction. Resolve it before clearing this request.')
   if (root.localStorage.getItem(KEY) !== snapshot || activeWalletRequests > 0) throw new Error('Saved checkout changed while checking. Reload and inspect it.')
   root.localStorage.setItem(KEY + '.recovery.' + Date.now(), JSON.stringify({ original: row, checkedNonce: latest.toString(), at: new Date().toISOString() }))
   save(rows.filter(function (item) { return item !== row }))
   return { recovered: true, tokenNo: row.tokenNo }
  })
 }
  return { records: records, send: send, reconcile: reconcile, recoverUnsent: recoverUnsent }
 }
 var api = createCheckout('trixmoji.clean-pop.checkout.v1')
 api.createWebpV2 = function () { return createCheckout('trixmoji.clean-pop.checkout.webp-v2') }
 api.createTrixMojiLaunch = function () { return createCheckout('trixmoji.launch.checkout') }
 if (typeof module !== 'undefined' && module.exports) module.exports = api
 else root.CleanPopCheckout = api
})(typeof window !== 'undefined' ? window : globalThis)
