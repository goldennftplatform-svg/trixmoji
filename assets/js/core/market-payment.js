(function (root) {
 'use strict'
 var KEY = 'trixmoji.market.payment.v1'
 function records() {
  var data = JSON.parse(root.localStorage.getItem(KEY) || '[]')
  if (!Array.isArray(data)) throw Error('Saved marketplace payments are invalid. Do not pay again.')
  return data
 }
 function save(row) {
  var data = records().filter(function (x) { return x.id !== row.id })
  data.push(row); root.localStorage.setItem(KEY, JSON.stringify(data))
 }
 function remove(id) { root.localStorage.setItem(KEY, JSON.stringify(records().filter(function (x) { return x.id !== id }))) }
 async function send(options) {
  if (!/^[a-f0-9]{16}$/.test(String(options.id)) || !/^0x[a-f0-9]{40}$/i.test(String(options.from)) || !/^0x[a-f0-9]{40}$/i.test(String(options.escrow)) || BigInt(options.amountWei) <= 0n) throw Error('Invalid marketplace payment details.')
  if (!root.navigator.locks) throw Error('This browser cannot coordinate marketplace tabs.')
  return root.navigator.locks.request(KEY, { ifAvailable: true }, async function (lock) {
   if (!lock) throw Error('A marketplace payment is already running in another tab.')
   if (records().some(function (row) { return row.state !== 'paid' && row.state !== 'confirmed' && row.state !== 'failed' })) throw Error('Check the previous marketplace transaction before sending another.')
   await options.preflight()
   var started = Date.now(), invalid = false, sent = false
   function changed() { invalid = true }
   if (options.provider.on) { options.provider.on('accountsChanged', changed); options.provider.on('chainChanged', changed) }
   async function approve() {
    if (sent) throw Error('A wallet request has already been made. Do not pay again.')
    if (invalid || Date.now() - started > 60000 || Date.now() < started) throw Error('Wallet, network, or quote changed. Prepare the purchase again.')
    var row = { kind: 'payment', id: options.id, buyer: options.from, escrow: options.escrow, amountWei: String(options.amountWei), state: 'awaiting-wallet', hash: '', at: new Date().toISOString() }
    save(row); sent = true
    var hash
    try {
     // Called directly from the review button, after the durable intent was saved.
     hash = await options.provider.request({ method: 'eth_sendTransaction', params: [{ from: row.buyer, to: row.escrow, value: '0x' + BigInt(row.amountWei).toString(16), data: '0x', chainId: '0x1' }] })
    } catch (error) {
     if (Number(error && error.code) === 4001) remove(row.id)
     throw error
    }
    if (!/^0x[a-f0-9]{64}$/i.test(String(hash))) throw Error('Wallet returned no transaction hash. Check wallet Activity; do not pay again.')
    row.hash = hash; row.state = 'submitted'
    try { save(row) } catch (_) { throw Error('Payment submitted: ' + hash + '. Save this hash; browser storage failed. Do not pay again.') }
    return row
   }
   try {
    var row = await options.review({ approve: approve, amountWei: String(options.amountWei), escrow: options.escrow })
    if (!sent || !row || !row.hash) throw Error('No payment transaction was submitted.')
    return row
   } finally {
    if (options.provider.removeListener) { options.provider.removeListener('accountsChanged', changed); options.provider.removeListener('chainChanged', changed) }
   }
  })
 }
 async function transfer(options) {
  if (!/^0x[a-f0-9]{64}$/i.test(String(options.id)) || !/^0x[a-f0-9]{40}$/i.test(String(options.from)) || !/^0x[a-f0-9]{40}$/i.test(String(options.to)) || /^0x0{40}$/i.test(options.to) || options.from.toLowerCase() === options.to.toLowerCase()) throw Error('Enter a valid Ethscription ID and a different destination wallet.')
  if (!root.navigator.locks) throw Error('This browser cannot coordinate marketplace tabs.')
  return root.navigator.locks.request(KEY, { ifAvailable: true }, async function (lock) {
   if (!lock) throw Error('A marketplace transaction is already running in another tab.')
   if (records().some(function (row) { return row.state !== 'paid' && row.state !== 'confirmed' && row.state !== 'failed' })) throw Error('Check the previous marketplace transaction before sending another.')
   await options.preflight()
   var started = Date.now(), invalid = false, sent = false
   function changed() { invalid = true }
   if (options.provider.on) { options.provider.on('accountsChanged', changed); options.provider.on('chainChanged', changed) }
   async function approve() {
    if (sent) throw Error('A wallet request has already been made. Check wallet Activity before trying again.')
    if (invalid || Date.now() - started > 60000 || Date.now() < started) throw Error('Wallet, network, or review changed. Prepare the transfer again.')
    var row = { kind: 'transfer', id: options.id.toLowerCase(), from: options.from, to: options.to, state: 'awaiting-wallet', hash: '', at: new Date().toISOString() }
    save(row); sent = true
    var hash
    try {
     hash = await options.provider.request({ method: 'eth_sendTransaction', params: [{ from: row.from, to: row.to, value: '0x0', data: row.id, chainId: '0x1' }] })
    } catch (error) {
     if (Number(error && error.code) === 4001) remove(row.id)
     throw error
    }
    if (!/^0x[a-f0-9]{64}$/i.test(String(hash))) throw Error('Wallet returned no transaction hash. Check wallet Activity before retrying.')
    row.hash = hash; row.state = 'submitted'
    try { save(row) } catch (_) { throw Error('Transfer submitted: ' + hash + '. Save this hash; browser storage failed.') }
    return row
   }
   try {
    var row = await options.review({ approve: approve, id: options.id, from: options.from, to: options.to })
    if (!sent || !row || !row.hash) throw Error('No transfer transaction was submitted.')
    return row
   } finally {
    if (options.provider.removeListener) { options.provider.removeListener('accountsChanged', changed); options.provider.removeListener('chainChanged', changed) }
   }
  })
 }
 async function reconcile(row, api) {
  if (!/^0x[a-f0-9]{64}$/i.test(String(row.hash || ''))) throw Error('Check wallet Activity and enter the transaction hash. Do not pay again.')
  var result = await api(row.kind === 'transfer' ? { action: 'marketVerifyTransfer', id: row.id, hash: row.hash, from: row.from, to: row.to } : { action: 'pay', id: row.id, payTx: row.hash })
  if (!result || !result.ok) throw Error(result && result.error || 'Payment not confirmed. Do not pay again.')
  row.state = row.kind === 'transfer' ? 'confirmed' : 'paid'; save(row); return result
 }
 var api = { records: records, send: send, transfer: transfer, reconcile: reconcile }
 if (typeof module !== 'undefined' && module.exports) module.exports = api
 else root.MarketplacePayment = api
})(typeof window !== 'undefined' ? window : globalThis)
