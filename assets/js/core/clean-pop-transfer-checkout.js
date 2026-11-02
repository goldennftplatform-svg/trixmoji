(function (root) {
 'use strict'
 var KEY = 'trixmoji.clean-pop.transfer.v1', LOCK = 'trixmoji-clean-pop-transfer', active = 0
 function same(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 function records() { var rows = JSON.parse(root.localStorage.getItem(KEY) || '[]'); if (!Array.isArray(rows)) throw Error('Saved transfer records are invalid. Do not transfer again.'); return rows }
 function save(rows) { root.localStorage.setItem(KEY, JSON.stringify(rows)) }
 function update(row) { var rows = records().filter(function (x) { return x.id !== row.id }); rows.push(row); save(rows) }
 function remove(id) { save(records().filter(function (x) { return x.id !== id })) }
 function read(provider, method, params) {
  return new Promise(function (resolve, reject) {
   var timer = setTimeout(function () { reject(Error('Wallet did not respond to ' + method + '. No transfer was sent by this check.')) }, 20000)
   try { Promise.resolve(provider.request({ method: method, params: params || [] })).then(function (v) { clearTimeout(timer); resolve(v) }, function (e) { clearTimeout(timer); reject(e) }) } catch (e) { clearTimeout(timer); reject(e) }
  })
 }
 async function send(options) {
  if (!/^0x[a-f0-9]{64}$/i.test(String(options.id)) || !/^0x[a-f0-9]{40}$/i.test(String(options.from)) || !/^0x[a-f0-9]{40}$/i.test(String(options.to)) || /^0x0{40}$/i.test(options.to) || same(options.from, options.to) || BigInt(options.gas || 0) <= 0n) throw Error('Invalid transfer details.')
  if (!root.navigator.locks) throw Error('Use a browser with Web Locks support for transfers.')
  return root.navigator.locks.request(LOCK, { ifAvailable: true }, async function (lock) {
   if (!lock) throw Error('A transfer is already being prepared in another tab.')
   if (records().some(function (r) { return r.state !== 'complete' && r.state !== 'failed' })) throw Error('Check the previous saved transfer before sending another.')
   await options.preflight()
   if (BigInt(await read(options.provider, 'eth_chainId')) !== 1n) throw Error('Switch to Ethereum mainnet.')
   var accounts = await read(options.provider, 'eth_accounts')
   if (!accounts || !same(accounts[0], options.from)) throw Error('Wallet changed. Reconnect the original wallet.')
   var latest = BigInt(await read(options.provider, 'eth_getTransactionCount', [options.from, 'latest'])), pending = BigInt(await read(options.provider, 'eth_getTransactionCount', [options.from, 'pending']))
   if (latest !== pending) throw Error('The wallet reports a pending transaction. Resolve it before sending.')
   var started = Date.now(), invalid = false, sent = false
   function changed() { invalid = true }
   if (options.provider.on) { options.provider.on('accountsChanged', changed); options.provider.on('chainChanged', changed) }
   async function approve() {
    if (sent) throw Error('A wallet request was already made. Check Activity before retrying.')
    if (invalid || Date.now() - started > 60000 || Date.now() < started) throw Error('Wallet, network, or review changed. Prepare the transfer again.')
    var row = { id: options.id.toLowerCase(), from: options.from, to: options.to, tokenNo: options.tokenNo, startingNonce: latest.toString(), state: 'awaiting-wallet', hash: '', at: new Date().toISOString() }
    update(row); sent = true; var hash
    try {
     active++
     hash = await options.provider.request({ method: 'eth_sendTransaction', params: [{ from: row.from, to: row.to, data: row.id, value: '0x0', chainId: '0x1', gas: '0x' + (BigInt(options.gas) + BigInt(options.gas) / 5n).toString(16) }] })
    } catch (error) { if (Number(error && error.code) === 4001) remove(row.id); throw error }
    finally { active-- }
    if (!/^0x[a-f0-9]{64}$/i.test(String(hash))) throw Error('Wallet returned no hash. Check Activity; do not send again.')
    row.hash = hash; row.state = 'submitted'
    try { update(row) } catch (_) { throw Error('Transfer submitted: ' + hash + '. Save this hash; browser storage failed.') }
    return row
   }
   try {
    var result = await options.review({ approve: approve, id: options.id, from: options.from, to: options.to, tokenNo: options.tokenNo, gasWei: options.gasWei })
    if (!sent || !result || !result.hash) throw Error('No transfer transaction was submitted.')
    return result
   } finally { if (options.provider.removeListener) { options.provider.removeListener('accountsChanged', changed); options.provider.removeListener('chainChanged', changed) } }
  })
 }
 async function reconcile(row, verify) {
  if (!/^0x[a-f0-9]{64}$/i.test(String(row.hash || ''))) throw Error('Enter the transfer hash from wallet Activity; do not send again.')
  var result = await verify(row)
  if (!result || !result.complete || !same(result.id, row.id) || !same(result.hash, row.hash) || !same(result.from, row.from) || !same(result.to, row.to)) throw Error('The transfer is not independently confirmed and indexed yet.')
  row.state = 'complete'; update(row); return result
 }
 async function recoverUnsent(options) {
  if (options.confirmed !== true) throw Error('Confirm there is no pending transfer, transaction hash, or open wallet approval.')
  if (!root.navigator.locks) throw Error('Use a browser with Web Locks support.')
  return root.navigator.locks.request(LOCK, { ifAvailable: true }, async function (lock) {
   if (!lock || active > 0) throw Error('A wallet request is still running. Finish or reject it before recovery.')
   var snapshot = root.localStorage.getItem(KEY), rows = records(), row = rows.find(function (x) { return same(x.id, options.id) })
   if (!row || row.state !== 'awaiting-wallet' || row.hash || !same(row.from, options.from) || !/^\d+$/.test(String(row.startingNonce || ''))) throw Error('Only this wallet’s no-hash transfer request can be recovered.')
   if (BigInt(await read(options.provider, 'eth_chainId')) !== 1n) throw Error('Switch to Ethereum mainnet.')
   var accounts = await read(options.provider, 'eth_accounts')
   if (!accounts || !same(accounts[0], row.from)) throw Error('Reconnect the original sending wallet.')
   var latest = BigInt(await read(options.provider, 'eth_getTransactionCount', [row.from, 'latest'])), pending = BigInt(await read(options.provider, 'eth_getTransactionCount', [row.from, 'pending']))
   if (latest !== BigInt(row.startingNonce) || pending !== latest) throw Error('The wallet nonce changed or a transaction is pending. Inspect Activity before retrying.')
   var owned = await options.verifyOwner(row)
   if (!owned || !owned.owned || !same(owned.currentOwner, row.from)) throw Error('The indexer no longer shows this piece in the sending wallet.')
   if (root.localStorage.getItem(KEY) !== snapshot || active > 0) throw Error('Saved transfer changed while checking. Reload and inspect it.')
   root.localStorage.setItem(KEY + '.recovery.' + Date.now(), JSON.stringify({ original: row, at: new Date().toISOString() }))
   save(rows.filter(function (item) { return item !== row })); return { recovered: true }
  })
 }
 var api = { records: records, send: send, reconcile: reconcile, recoverUnsent: recoverUnsent }
 if (typeof module !== 'undefined' && module.exports) module.exports = api
 else root.CleanPopTransferCheckout = api
})(typeof window !== 'undefined' ? window : globalThis)
