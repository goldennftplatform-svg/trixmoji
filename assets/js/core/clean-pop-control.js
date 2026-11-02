(function (root) {
 'use strict'
 var KEY = 'trixmoji.clean-pop-v1.open-sale'
 var CALL = '0x16c38b3c' + '0'.repeat(64)
 function same(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 function saved() { return JSON.parse(root.localStorage.getItem(KEY) || 'null') }
 function bounded(provider, progress) {
  return { request: function (payload) {
   var signing = payload.method === 'eth_sendTransaction'
   if (progress) progress(signing ? 'Transaction approval requested from the connected wallet. Open its extension to approve or reject.' : 'Waiting for wallet: ' + payload.method)
   return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
     reject(Error(signing ? 'The wallet has not returned a transaction hash. Its request may still be pending. Do not submit another transaction.' : 'Wallet did not respond to ' + payload.method + '. Preparation stopped before sending an opening transaction.'))
    }, signing ? 90000 : 20000)
    try {
     Promise.resolve(provider.request(payload)).then(function (value) { clearTimeout(timer); resolve(value) }, function (error) {
      clearTimeout(timer)
      var code = Number(error && (error.code || error.data && error.data.originalError && error.data.originalError.code))
      if (code === -32002) reject(Error('The wallet already has a pending request. Open the wallet extension and finish or reject it before continuing.'))
      else reject(error)
     })
    } catch (error) { clearTimeout(timer); reject(error) }
   })
  } }
 }
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
 function assertNoPending() {
  var existing = saved()
  if (existing && ['awaiting-wallet', 'submitted'].includes(existing.state)) throw Error(existing.hash ? 'Opening transaction saved: ' + existing.hash + '. Check this hash before submitting another transaction.' : 'An earlier opening request has no saved hash. It may still be in the wallet. This browser will not send a duplicate request.')
 }
 async function prepare(provider, info, progress) {
  provider = bounded(provider, progress)
  var state = await inspect(provider, info)
  if (!state.paused) return { alreadyOpen: true }
  assertNoPending()
  var tx = { from: info.creator, to: info.address, chainId: '0x1', value: '0x0', data: CALL }
  var gas = BigInt(await provider.request({ method: 'eth_estimateGas', params: [tx] }))
  var price = BigInt(await provider.request({ method: 'eth_gasPrice' }))
  tx.gas = '0x' + (gas + gas / 5n).toString(16)
  return { tx: tx, estimatedGasWei: (gas * price).toString(), preparedAt: Date.now() }
 }
 async function submit(provider, info, plan, progress) {
  provider = bounded(provider, progress)
  if (!plan || Date.now() - plan.preparedAt > 60000 || Date.now() < plan.preparedAt || !plan.tx || !same(plan.tx.from, info.creator) || !same(plan.tx.to, info.address) || plan.tx.data !== CALL || plan.tx.chainId !== '0x1' || plan.tx.value !== '0x0') throw Error('Prepare the opening transaction again; its review expired or does not match the contract.')
  if (!root.navigator.locks) throw Error('Use a browser with Web Locks support to coordinate wallet requests.')
  return root.navigator.locks.request(KEY, { ifAvailable: true }, async function (lock) {
   if (!lock) throw Error('An opening request is already running in another tab.')
   assertNoPending()
   var row = { state: 'awaiting-wallet', contract: info.address, creator: info.creator, at: new Date().toISOString() }
   root.localStorage.setItem(KEY, JSON.stringify(row))
   var hash
   try {
    // No RPC preflight or native browser confirm between this explicit approval and the wallet request.
    hash = await provider.request({ method: 'eth_sendTransaction', params: [plan.tx] })
   } catch (error) {
    if (Number(error && error.code) === 4001) root.localStorage.removeItem(KEY)
    throw error
   }
   if (!/^0x[0-9a-f]{64}$/i.test(String(hash))) throw Error('No transaction hash returned. Inspect wallet activity before retrying.')
   row.state = 'submitted'; row.hash = hash
   try { root.localStorage.setItem(KEY, JSON.stringify(row)) } catch (_) { throw Error('Transaction submitted: ' + hash + '. Save this hash; browser storage failed.') }
   return row
  })
 }
 async function open(provider, info, review, progress) {
  var original = provider
  progress = progress || function () {}
  provider = { request: function (payload) {
   var signing = payload.method === 'eth_sendTransaction'
   progress(signing ? 'Wallet approval requested. Open the selected wallet extension to approve or reject. Do not submit again.' : 'Checking ' + payload.method + '…')
   return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
     reject(Error(signing ? 'Wallet approval did not return a hash. The request may still be pending in the wallet. Inspect wallet Activity; do not submit again.' : 'Wallet RPC did not respond to ' + payload.method + '. No opening transaction has been requested at this step.'))
    }, signing ? 90000 : 20000)
    Promise.resolve().then(function () { return original.request(payload) }).then(function (value) { clearTimeout(timer); resolve(value) }, function (error) { clearTimeout(timer); reject(error) })
   })
  } }
  if (!root.navigator.locks) throw Error('Use a browser with Web Locks support to coordinate wallet requests.')
  return root.navigator.locks.request(KEY, { ifAvailable: true }, async function (lock) {
   if (!lock) throw Error('An opening request is already running in another tab.')
   var existing = saved()
    if (existing && ['awaiting-wallet', 'submitted'].includes(existing.state)) throw Error(existing.hash ? 'Opening transaction saved: ' + existing.hash + '. Use CHECK OPENING TRANSACTION; do not submit again.' : 'A previous wallet request has an unknown outcome and no saved hash. Inspect wallet Activity and supply its hash; do not submit again.')
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
 var api = { saved: saved, inspect: inspect, prepare: prepare, submit: submit, open: open, check: check }
 if (typeof module !== 'undefined' && module.exports) module.exports = api
 else root.CleanPopControl = api
})(typeof window !== 'undefined' ? window : globalThis)
