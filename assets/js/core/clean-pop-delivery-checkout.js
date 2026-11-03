(function (root) {
 'use strict'
 var KEY = 'trixmoji.clean-pop.delivery.v1', LOCK = 'trixmoji-clean-pop-delivery', active = 0
 function same(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 function records() { var rows = JSON.parse(root.localStorage.getItem(KEY) || '[]'); if (!Array.isArray(rows)) throw Error('Saved delivery records are invalid. Do not send again.'); return rows }
 function save(rows) { root.localStorage.setItem(KEY, JSON.stringify(rows)) }
 function update(row) { var rows = records().filter(function (x) { return x.id !== row.id }); rows.push(row); save(rows) }
 function remove(id) { save(records().filter(function (x) { return x.id !== id })) }
 function rpc(provider, method, params) {
  return new Promise(function (resolve, reject) {
   var timer = setTimeout(function () { reject(Error('Wallet did not respond to ' + method + '. No delivery transaction was requested by this check.')) }, 20000)
   try { Promise.resolve(provider.request({ method: method, params: params || [] })).then(function (v) { clearTimeout(timer); resolve(v) }, function (e) { clearTimeout(timer); reject(e) }) } catch (e) { clearTimeout(timer); reject(e) }
  })
 }
 async function send(options) {
  if (!root.navigator.locks) throw Error('Use a browser with Web Locks support for creator deliveries.')
  if (!Number.isInteger(options.tokenNo) || options.tokenNo < 0 || options.tokenNo >= 10000 || !/^0x[a-f0-9]{64}$/i.test(String(options.legacyId)) || !/^0x[a-f0-9]{40}$/i.test(String(options.recipient)) || !options.tx || !same(options.tx.from, options.info.creator) || !same(options.tx.to, options.info.address) || options.tx.value !== '0x0' || !/^0x74dc07c6[a-f0-9]+$/i.test(String(options.tx.data)) || BigInt(options.tx.gas || 0) <= 0n) throw Error('Delivery transaction does not match the approved contract.')
  try {
   var decoded = new root.ethers.utils.Interface(options.info.abi).decodeFunctionData('deliverReplacement', options.tx.data)
   if (!decoded.tokenNo.eq(options.tokenNo) || !same(decoded.legacyId, options.legacyId) || !same(decoded.recipient, options.recipient)) throw Error('Mismatch')
  } catch (_) { throw Error('Delivery calldata does not match the selected token and recipient.') }
  return root.navigator.locks.request(LOCK, { ifAvailable: true }, async function (lock) {
   if (!lock) throw Error('A creator delivery is already running in another tab.')
   if (records().some(function (r) { return r.state !== 'complete' && r.state !== 'failed' })) throw Error('Check the previous creator delivery before sending another.')
   await options.preflight()
   var started = Date.now(), invalidated = false, sent = false
   function changed() { invalidated = true }
   if (options.provider.on) { options.provider.on('accountsChanged', changed); options.provider.on('chainChanged', changed) }
   async function approve() {
    if (sent) throw Error('The wallet request was already made. Check wallet Activity.')
    if (invalidated || Date.now() - started > 60000 || Date.now() < started) throw Error('Wallet, network, or quote changed. Prepare the delivery again.')
    var row = { id: options.legacyId.toLowerCase(), tokenNo: options.tokenNo, legacyId: options.legacyId, recipient: options.recipient, creator: options.info.creator, contract: options.info.address, state: 'awaiting-wallet', hash: '', at: new Date().toISOString() }
    update(row); sent = true; var hash
    try { active++; hash = await options.provider.request({ method: 'eth_sendTransaction', params: [Object.assign({}, options.tx, { chainId: '0x1' })] }) }
    catch (error) { if (Number(error && error.code) === 4001) remove(row.id); throw error }
    finally { active-- }
    if (!/^0x[a-f0-9]{64}$/i.test(String(hash))) throw Error('Wallet returned no transaction hash. Check wallet Activity; do not send again.')
    row.hash = hash; row.state = 'submitted'
    try { update(row) } catch (_) { throw Error('Delivery submitted: ' + hash + '. Save this hash; browser storage failed.') }
    return row
   }
   try {
    var row = await options.review({ approve: approve, tokenNo: options.tokenNo, recipient: options.recipient, gasWei: options.gasWei })
    if (!sent || !row || !row.hash) throw Error('No delivery transaction was submitted.')
    return row
   } finally { if (options.provider.removeListener) { options.provider.removeListener('accountsChanged', changed); options.provider.removeListener('chainChanged', changed) } }
  })
 }
 async function reconcile(row, verify) {
  if (!/^0x[a-f0-9]{64}$/i.test(String(row.hash || ''))) throw Error('Check wallet Activity and enter the delivery transaction hash. Do not send again.')
  var result = await verify(row)
  if (!result || !result.complete) throw Error(result && result.error || 'Delivery confirmation or indexing is pending. Do not send again.')
  row.state = 'complete'; update(row); return result
 }
 async function recoverUnsent(options) {
  if (options.confirmed !== true) throw Error('Confirm there is no pending delivery transaction or wallet approval.')
  if (!root.navigator.locks) throw Error('Use a browser with Web Locks support.')
  return root.navigator.locks.request(LOCK, { ifAvailable: true }, async function (lock) {
   if (!lock || active > 0) throw Error('A wallet request is still running. Finish or reject it before recovery.')
   var snapshot = root.localStorage.getItem(KEY), rows = records(), row = rows.find(function (x) { return x.id === String(options.legacyId).toLowerCase() })
   if (!row || row.state !== 'awaiting-wallet' || row.hash || !same(row.creator, options.info.creator) || !same(row.contract, options.info.address) || !Number.isInteger(row.tokenNo)) throw Error('Recovery applies only to the creator’s no-hash delivery request.')
   if (BigInt(await rpc(options.provider, 'eth_chainId')) !== 1n) throw Error('Switch to Ethereum mainnet.')
   var accounts = await rpc(options.provider, 'eth_accounts')
   if (!accounts || !same(accounts[0], row.creator)) throw Error('Reconnect the creator wallet.')
   if (!same(await rpc(options.provider, 'eth_getCode', [row.contract, 'latest']), options.info.runtime)) throw Error('Deployed contract runtime mismatch.')
   var minted = await rpc(options.provider, 'eth_call', [{ to: row.contract, data: '0x7dc0bf3f' + BigInt(row.tokenNo).toString(16).padStart(64, '0') }, 'latest'])
   var replaced = await rpc(options.provider, 'eth_call', [{ to: row.contract, data: '0xaaa24594' + row.legacyId.slice(2) }, 'latest'])
   if (!/^0x[0-9a-f]{64}$/i.test(String(minted)) || !/^0x[0-9a-f]{64}$/i.test(String(replaced))) throw Error('Could not read the delivery state.')
   if (BigInt(minted) !== 0n || BigInt(replaced) !== 0n) throw Error('This token or legacy ID has already been used. Check its transaction before continuing.')
   var latest = BigInt(await rpc(options.provider, 'eth_getTransactionCount', [row.creator, 'latest'])), pending = BigInt(await rpc(options.provider, 'eth_getTransactionCount', [row.creator, 'pending']))
   if (latest !== pending) throw Error('The creator wallet RPC reports pending transactions. Resolve them before recovery.')
   if (root.localStorage.getItem(KEY) !== snapshot || active > 0) throw Error('Delivery record changed while checking. Reload and inspect it.')
   root.localStorage.setItem(KEY + '.recovery.' + Date.now(), JSON.stringify({ original: row, checkedNonce: latest.toString(), at: new Date().toISOString() }))
   save(rows.filter(function (item) { return item !== row })); return { recovered: true }
  })
 }
 var api = { records: records, send: send, reconcile: reconcile, recoverUnsent: recoverUnsent }
 if (typeof module !== 'undefined' && module.exports) module.exports = api
 else root.CleanPopDeliveryCheckout = api
})(typeof window !== 'undefined' ? window : globalThis)
