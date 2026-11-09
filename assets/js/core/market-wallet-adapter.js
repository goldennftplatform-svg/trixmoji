(function (root, factory) {
 'use strict'
 if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('ethers').ethers)
 else root.TrixmojiMarketWallet = factory(root.ethers)
})(typeof window !== 'undefined' ? window : globalThis, function (ethers) {
 'use strict'
 function same(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 function assetId(id) { if (!/^0x[a-f0-9]{64}$/i.test(String(id || ''))) throw Error('Invalid Ethscription ID.'); return id.toLowerCase() }
 function address(value) { if (!ethers.utils.isAddress(value) || same(value, ethers.constants.AddressZero)) throw Error('Invalid Ethereum address.'); return ethers.utils.getAddress(value) }
 function positive(value) { var n = ethers.BigNumber.from(value); if (n.lte(0)) throw Error('Amount must be positive.'); return n }
 function create(config) {
  if (!config || !config.provider || typeof config.provider.request !== 'function' || !config.storage || !config.locks || !config.abi || !/^0x[a-f0-9]{64}$/i.test(String(config.runtimeHash || ''))) throw Error('Incomplete market configuration.')
  var KEY = config.storageKey || 'trixmoji.market.contract.transaction.v1'
  if (!['trixmoji.market.contract.transaction.v1', 'trixmoji.market.contract.transaction.webp-v2', 'trixmoji.market.contract.transaction.launch'].includes(KEY)) throw Error('Invalid market transaction storage key.')
  var market = address(config.market), expectedCreator = address(config.creator), expectedVerifier = address(config.verifier)
  var chainId = Number(config.chainId), iface = new ethers.utils.Interface(config.abi), provider = config.provider
  if (!Number.isSafeInteger(chainId) || chainId < 1 || typeof config.readAsset !== 'function') throw Error('Invalid network or indexer configuration.')
  function read() { var rows = JSON.parse(config.storage.getItem(KEY) || '[]'); if (!Array.isArray(rows)) throw Error('Invalid saved market transactions.'); return rows }
  function write(row) { var rows = read().filter(function (x) { return x.key !== row.key }); rows.push(row); config.storage.setItem(KEY, JSON.stringify(rows)) }
  function remove(key) { config.storage.setItem(KEY, JSON.stringify(read().filter(function (x) { return x.key !== key }))) }
  async function rpc(method, params) { return provider.request({ method: method, params: params || [] }) }
  async function call(method, args) {
   var result = await rpc('eth_call', [{ to: market, data: iface.encodeFunctionData(method, args || []) }, 'latest'])
   return iface.decodeFunctionResult(method, result)
  }
  async function identity() {
   if (BigInt(await rpc('eth_chainId')) !== BigInt(chainId)) throw Error('Wallet is on the wrong network.')
   var accounts = await rpc('eth_accounts'); if (!accounts || !accounts[0]) throw Error('Connect an Ethereum wallet first.')
   var account = address(accounts[0]), code = await rpc('eth_getCode', [market, 'latest'])
   if (!code || code === '0x' || !same(ethers.utils.keccak256(code), config.runtimeHash)) throw Error('Market runtime does not match the configured deployment.')
   var settings = await Promise.all([call('creator'), call('verifier')])
   if (!same(settings[0][0], expectedCreator) || !same(settings[1][0], expectedVerifier)) throw Error('Market creator or verifier does not match the configured deployment.')
   return account
  }
  async function owned(id, current, previous) {
   var result = await config.readAsset(id)
   if (!result || !same(result.transaction_hash, id) || !same(result.current_owner, current) || (previous && !same(result.previous_owner, previous))) throw Error('Indexer does not confirm the required ownership or escrow custody.')
   if (config.minter && !same(result.creator, config.minter)) throw Error('Asset does not belong to the configured collection.')
   return result
  }
   async function prepare(action, args, account) {
   args = args || {}; var id, data, to = market, value = ethers.constants.Zero
    if (action === 'gift' || action === 'deposit' || action === 'depositAndList') {
     id = assetId(args.id); await owned(id, account)
      if (action === 'deposit' || action === 'depositAndList') {
      if (action === 'depositAndList' && config.combinedDepositEnabled !== true) throw Error('Combined deposit-and-list is not enabled for this escrow.')
     var recorded = (await call('depositBlock', [account, id]))[0]
      if (!recorded.isZero()) throw Error('This wallet already has an escrow deposit record for this piece. Do not send it again; the existing record must be checked first.')
    }
    to = action === 'gift' ? address(args.recipient) : market
    if (same(to, account) || (action === 'gift' && same(to, market))) throw Error('Choose a different gift recipient; use deposit for escrow.')
     data = action === 'depositAndList' ? ethers.utils.hexConcat([id, ethers.utils.id('DEPOSIT_AND_LIST_SIGNATURE'), ethers.utils.hexZeroPad(positive(args.amountWei).toHexString(), 32), ethers.constants.HashZero]) : id
   } else if (action === 'list' || action === 'cancel') {
    id = assetId(args.id); await owned(id, market, account)
    data = action === 'list' ? iface.encodeFunctionData('list', [id, positive(args.amountWei)]) : iface.encodeFunctionData('cancel', [id])
   } else if (action === 'buy' || action === 'auction') {
    id = assetId(args.id)
    var seller = action === 'auction' ? account : address(args.seller)
    await owned(id, market, seller)
    if (action === 'buy' && same(account, seller)) throw Error('Seller cannot buy their own listing.')
    if (typeof config.authorize !== 'function') throw Error('The protected market verifier is not configured.')
    var amount = positive(args.amountWei), kind = action === 'buy' ? 0 : 1
    var duration = kind ? Number(args.duration) : 0
    if (kind && (!Number.isInteger(duration) || duration < 3600 || duration > 604800)) throw Error('Auction duration must be between one hour and seven days.')
    var auth = await config.authorize({ id: id, seller: seller, buyer: kind ? ethers.constants.AddressZero : account, kind: kind, amount: amount.toString(), duration: duration })
    if (!auth || !auth.approval || !/^0x[a-f0-9]+$/i.test(String(auth.signature || ''))) throw Error('Verifier did not return an authorization.')
    var a = auth.approval
    if (!same(a.id, id) || !same(a.seller, seller) || !same(a.buyer, kind ? ethers.constants.AddressZero : account) || Number(a.kind) !== kind || Number(a.duration) !== duration || !ethers.BigNumber.from(a.amount).eq(amount)) throw Error('Verifier authorization does not match the requested transaction.')
    if (action === 'buy') { value = amount; data = iface.encodeFunctionData('buy', [a, auth.signature]) }
    else data = iface.encodeFunctionData('startAuction', [a, auth.signature])
   } else if (action === 'bid' || action === 'settle') {
    id = assetId(args.id); var auctionSeller = address(args.seller)
    await owned(id, market, auctionSeller)
    var nonce = ethers.BigNumber.from(args.nonce)
    if (action === 'bid') { value = positive(args.amountWei); data = iface.encodeFunctionData('bid', [auctionSeller, id, nonce]) }
    else data = iface.encodeFunctionData('settle', [auctionSeller, id, nonce])
   } else if (action === 'withdraw') {
    to = market; data = iface.encodeFunctionData('withdraw', [address(args.recipient)])
   } else throw Error('Unknown market action.')
   var tx = { from: account, to: to, value: ethers.utils.hexValue(value), data: data }
   await rpc('eth_call', [tx, 'latest'])
   var estimate = ethers.BigNumber.from(await rpc('eth_estimateGas', [tx]))
   // Keep Ethscription transfer requests minimal; let the wallet fill gas/network fields.
   // This request shape alone does not guarantee the wallet's broadcast routing.
   var ethscriptionTransfer = action === 'gift' || action === 'deposit' || action === 'depositAndList'
   if (!ethscriptionTransfer) {
    tx.gas = ethers.utils.hexValue(estimate.mul(12).div(10))
    tx.chainId = ethers.utils.hexValue(chainId)
   }
   return { action: action, assetId: id || null, tx: tx, estimatedGas: estimate.toString(), preparedAt: Date.now() }
  }
  async function run(action, args, review) {
   if (typeof review !== 'function') throw Error('A wallet review is required.')
   return config.locks.request(KEY, { ifAvailable: true }, async function (lock) {
    if (!lock) throw Error('A market transaction is already being prepared in another tab.')
    var pending = read().filter(function (row) { return row.state !== 'complete' && row.state !== 'failed' })
    if (pending.length) throw Error('Deposit/send blocked by ' + pending.length + ' saved request(s): ' + pending.map(function (row) { return row.action + ' · ' + row.state + ' · ' + (row.hash || 'NO HASH — wallet request was not confirmed') + ' · account ' + row.from + ' · escrow ' + row.to }).join('; ') + '. Use the saved-request checks above; do not submit another transaction.')
    var account = await identity(), plan = await prepare(action, args, account)
    if (!same(await identity(), account)) throw Error('Wallet account changed while preparing.')
    var nonceValues = await Promise.all([rpc('eth_getTransactionCount', [account, 'latest']), rpc('eth_getTransactionCount', [account, 'pending'])])
    if (!ethers.BigNumber.from(nonceValues[0]).eq(nonceValues[1])) throw Error('The wallet has a pending transaction. Resolve it before starting another market action.')
    var startingNonce = ethers.BigNumber.from(nonceValues[0]).toString()
    var invalid = false, sent = false
    function changed() { invalid = true }
    if (provider.on) { provider.on('accountsChanged', changed); provider.on('chainChanged', changed) }
    async function approve() {
     if (sent) throw Error('Wallet request already made. Check activity before retrying.')
     if (invalid || Date.now() - plan.preparedAt > 60000 || Date.now() < plan.preparedAt) throw Error('Wallet, network, or review changed. Prepare the transaction again.')
     if (action === 'deposit' || action === 'depositAndList') {
      var expected = action === 'deposit' ? assetId(args.id) : ethers.utils.hexConcat([assetId(args.id), ethers.utils.id('DEPOSIT_AND_LIST_SIGNATURE'), ethers.utils.hexZeroPad(positive(args.amountWei).toHexString(), 32), ethers.constants.HashZero])
      if (!same(plan.tx.to, market) || !same(plan.tx.data, expected) || plan.tx.value !== '0x0' || Object.keys(plan.tx).sort().join(',') !== 'data,from,to,value') throw Error('Deposit request does not match the expected escrow transfer. No transaction requested.')
      if (invalid || Date.now() - plan.preparedAt > 60000 || Date.now() < plan.preparedAt) throw Error('Wallet, network, or review changed. Prepare the transaction again.')
     }
     var row = { key: Date.now() + ':' + Math.random().toString(36).slice(2), action: action, assetId: plan.assetId, chainId: chainId, from: account, to: plan.tx.to, data: plan.tx.data, value: plan.tx.value, startingNonce: startingNonce, state: 'awaiting-wallet', hash: '' }
     write(row); sent = true
     var hash
     try { hash = await provider.request({ method: 'eth_sendTransaction', params: [plan.tx] }) }
     catch (error) {
      // Wallets may nest the EIP-1193 user-rejection code in an original error.
      var codes = [error && error.code, error && error.data && error.data.code, error && error.data && error.data.originalError && error.data.originalError.code, error && error.error && error.error.code]
      var rejected = codes.some(function (code) { return Number(code) === 4001 || code === 'ACTION_REJECTED' })
      if (rejected) remove(row.key)
      throw error
     }
     if (!/^0x[a-f0-9]{64}$/i.test(String(hash))) throw Error('Wallet returned no hash. Check wallet activity; do not retry.')
     row.hash = hash; row.state = 'submitted'
     try { write(row) } catch (_) { throw Error('Submitted transaction ' + hash + '. Save it; local storage failed.') }
     return row
    }
    try {
     var result = await review({ action: plan.action, assetId: plan.assetId, to: plan.tx.to, valueWei: ethers.BigNumber.from(plan.tx.value).toString(), estimatedGas: plan.estimatedGas, approve: approve })
     if (!sent || !result || !result.hash) throw Error('No market transaction was submitted.')
     return result
    } finally {
     if (provider.removeListener) { provider.removeListener('accountsChanged', changed); provider.removeListener('chainChanged', changed) }
    }
   })
  }
  async function reconcile(row, verifyIndexed) {
   if (!row || !/^0x[a-f0-9]{64}$/i.test(String(row.hash || ''))) throw Error('Check wallet activity and supply the transaction hash.')
   if (BigInt(await rpc('eth_chainId')) !== BigInt(chainId)) throw Error('Wallet is on the wrong network.')
   var values = await Promise.all([rpc('eth_getTransactionByHash', [row.hash]), rpc('eth_getTransactionReceipt', [row.hash])]), tx = values[0], receipt = values[1]
   if (!tx || !receipt) throw Error('Transaction is not confirmed. Do not retry.')
   var matches = same(tx.from, row.from) && same(tx.to, row.to) && same(tx.input || tx.data, row.data) && ethers.BigNumber.from(tx.value).eq(row.value)
   // Listing is an ordinary contract call, so a successful wallet wrapper can
   // be verified through its single inner call and the escrow's Listed event.
   // Ethscription deposits remain restricted to a direct outer transaction.
   if (!matches && row.action === 'list' && same(tx.from, row.from) && same(tx.to, '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3') && ethers.BigNumber.from(tx.value).isZero()) {
    try {
     var wrapper = new ethers.utils.Interface(['function redeemDelegations(bytes[] permissionContexts, bytes32[] modes, bytes[] executionCallDatas)'])
     var parsed = wrapper.parseTransaction({ data: tx.input || tx.data }), execution = parsed.args.executionCallDatas[0]
     matches = parsed.name === 'redeemDelegations' && parsed.args.permissionContexts.length === 1 && parsed.args.modes.length === 1 && parsed.args.executionCallDatas.length === 1 && same(parsed.args.modes[0], ethers.constants.HashZero) && ethers.utils.hexDataLength(execution) >= 56 && same(ethers.utils.hexDataSlice(execution, 0, 20), row.to) && ethers.BigNumber.from(ethers.utils.hexDataSlice(execution, 20, 52)).eq(row.value) && same(ethers.utils.hexDataSlice(execution, 52), row.data)
    } catch (_) { matches = false }
   }
   if (!matches) {
     if ((row.action === 'deposit' || row.action === 'depositAndList') && receipt.status === '0x1' && same(tx.from, row.from) && !same(tx.to, row.to)) {
     var found = (receipt.logs || []).some(function (log) { if (!same(log.address, market)) return false; try { var event = iface.parseLog(log); return event.name === 'Deposited' && same(event.args.seller, row.from) && same(event.args.id, row.assetId) } catch (_) { return false } })
     if (found) {
      var indexed = await config.readAsset(row.assetId)
      if (indexed && same(indexed.transaction_hash, row.assetId) && same(indexed.current_owner, row.from)) throw Error('The wallet sent a wrapped deposit; the indexer still shows this piece in your wallet. The escrow may have a false deposit record. Do not retry; recovery is needed.')
     }
    }
    throw Error('Transaction does not match the saved market action. Do not retry until it is checked.')
   }
   if (receipt.status === '0x0') { row.state = 'failed'; write(row); return { failed: true, hash: row.hash } }
   if (receipt.status !== '0x1') throw Error('Transaction receipt status is unavailable.')
   if (typeof verifyIndexed !== 'function' || !(await verifyIndexed(row, receipt))) throw Error('Transaction confirmed; protocol indexing or settlement verification is pending.')
   row.state = 'complete'; write(row); return { complete: true, hash: row.hash }
  }
  async function recoverUnsent(key, confirmed, verifyNotApplied) {
   if (confirmed !== true || typeof verifyNotApplied !== 'function') throw Error('Confirm no wallet approval or pending transaction and provide state verification.')
   return config.locks.request(KEY, { ifAvailable: true }, async function (lock) {
    if (!lock) throw Error('A wallet request is still running. Resolve it before recovery.')
    var snapshot = config.storage.getItem(KEY), row = read().find(function (item) { return item.key === key })
    if (!row || row.state !== 'awaiting-wallet' || row.hash || !/^\d+$/.test(String(row.startingNonce || ''))) throw Error('Only a no-hash request with a recorded starting nonce can be recovered.')
    var account = await identity()
    if (!same(account, row.from) || row.chainId !== chainId) throw Error('Reconnect the original wallet on the original network.')
    var nonceValues = await Promise.all([rpc('eth_getTransactionCount', [account, 'latest']), rpc('eth_getTransactionCount', [account, 'pending'])])
    var latestNonce = ethers.BigNumber.from(nonceValues[0]), pendingNonce = ethers.BigNumber.from(nonceValues[1]), startNonce = ethers.BigNumber.from(row.startingNonce)
    // A later confirmed transaction can consume the saved nonce. For listing
    // requests only, a current indexed custody + exact listing-state check can
    // prove the requested listing is not active even when the nonce advanced.
    // Transfers retain the stricter original-nonce requirement.
    if (!pendingNonce.eq(latestNonce) || latestNonce.lt(startNonce) || (!latestNonce.eq(startNonce) && row.action !== 'list')) throw Error('Wallet nonce changed or a transaction is pending. Inspect wallet activity before retrying.')
   if (!(await verifyNotApplied(row))) throw Error('The market or indexed asset state has changed. Inspect the transaction before retrying.')
   nonceValues = await Promise.all([rpc('eth_getTransactionCount', [account, 'latest']), rpc('eth_getTransactionCount', [account, 'pending'])])
    if (!ethers.BigNumber.from(nonceValues[0]).eq(latestNonce) || !ethers.BigNumber.from(nonceValues[1]).eq(latestNonce)) throw Error('Wallet nonce changed or a transaction is pending. Inspect wallet activity before retrying.')
    if (config.storage.getItem(KEY) !== snapshot) throw Error('Saved transaction changed while checking. Reload and inspect it.')
    config.storage.setItem(KEY + '.recovery.' + Date.now(), JSON.stringify({ original: row, at: new Date().toISOString() }))
    remove(row.key); return { recovered: true }
   })
  }
  async function reconcileClearedWrapped(key, cancelHash, readStatus) {
   if (!/^0x[a-f0-9]{64}$/i.test(String(cancelHash || '')) || typeof readStatus !== 'function') throw Error('Provide the confirmed recovery transaction hash.')
   return config.locks.request(KEY, { ifAvailable: true }, async function (lock) {
    if (!lock) throw Error('A market request is still active. Resolve it before checking recovery.')
    var snapshot = config.storage.getItem(KEY), row = read().find(function (item) { return item.key === key })
    if (!row || !['deposit', 'depositAndList'].includes(row.action) || !/^0x[a-f0-9]{64}$/i.test(String(row.hash || '')) || !same(row.to, market) || !/^0x[a-f0-9]{64}$/i.test(String(row.assetId || '')) || row.state === 'complete' || row.state === 'failed') throw Error('The saved deposit does not match this escrow or is already resolved.')
    var account = await identity(); if (!same(account, row.from)) throw Error('Connect the wallet that made the saved deposit.')
    var result = await Promise.all([rpc('eth_getTransactionByHash', [row.hash]), rpc('eth_getTransactionReceipt', [row.hash]), rpc('eth_getTransactionByHash', [cancelHash]), rpc('eth_getTransactionReceipt', [cancelHash]), rpc('eth_blockNumber'), readStatus(), config.readAsset(row.assetId), call('depositBlock', [row.from, row.assetId])])
    var tx = result[0], receipt = result[1], cancel = result[2], cancelReceipt = result[3], head = Number(BigInt(result[4])), indexed = Number(result[5] && result[5].last_imported_block), asset = result[6]
    if (!tx || !receipt) throw Error('Saved deposit transaction not found or not confirmed: ' + row.hash)
    if (!cancel || !cancelReceipt) throw Error('Recovery transaction not found or not confirmed: ' + cancelHash)
    if (!same(tx.hash, row.hash) || !same(receipt.transactionHash, row.hash)) throw Error('Deposit receipt does not match the saved hash.')
    if (!same(cancel.hash, cancelHash) || !same(cancelReceipt.transactionHash, cancelHash)) throw Error('Recovery receipt does not match the recovery hash.')
    if (receipt.status !== '0x1' || cancelReceipt.status !== '0x1') throw Error('Deposit or recovery transaction failed on-chain.')
    if (!same(tx.from, row.from) || !same(cancel.from, row.from)) throw Error('Deposit or recovery was not sent from the saved wallet.')
    if (same(tx.to, market)) throw Error('Deposit was sent directly to the market; use CHECK TRANSACTION instead of wrapped recovery.')
    var depositBlock = Number(BigInt(receipt.blockNumber)), cancelBlock = Number(BigInt(cancelReceipt.blockNumber))
    if (!Number.isSafeInteger(depositBlock) || !Number.isSafeInteger(cancelBlock) || depositBlock < 1 || cancelBlock <= depositBlock) throw Error('Recovery does not follow the saved deposit.')
    function hasEvent(logs, name) { return (logs || []).some(function (log) { if (!same(log.address, market)) return false; try { var event = iface.parseLog(log); return event.name === name && same(event.args.seller, row.from) && same(event.args.id, row.assetId) } catch (_) { return false } }) }
    if (!hasEvent(receipt.logs, 'Deposited')) throw Error('Deposit receipt has no matching Deposited event for this wallet and asset.')
    if (!hasEvent(cancelReceipt.logs, 'Cancelled')) throw Error('Recovery receipt has no matching Cancelled event for this wallet and asset.')
    if (!result[7][0].isZero()) throw Error('The on-chain escrow deposit record is not cleared yet.')
    if (!Number.isSafeInteger(indexed) || indexed < cancelBlock) throw Error('Indexer has not imported the recovery block yet.')
    if (!Number.isSafeInteger(head) || indexed > head || head - indexed > 12) throw Error('Indexer freshness could not be verified (head ' + head + ', indexed ' + indexed + ').')
    if (!asset || !same(asset.transaction_hash, row.assetId)) throw Error('Indexer did not return this asset.')
    if (!same(asset.current_owner, row.from)) throw Error('Indexer owner is ' + asset.current_owner + ', expected ' + row.from + '.')
    if (config.storage.getItem(KEY) !== snapshot) throw Error('Saved market requests changed. Reload and inspect them.')
    var rows = read(), index = rows.findIndex(function (item) { return item.key === key })
    if (index < 0 || !same(rows[index].hash, row.hash)) throw Error('The saved request changed. Reload and inspect it.')
    config.storage.setItem(KEY + '.recovery.' + Date.now(), JSON.stringify({ original: rows[index], cancellationHash: cancelHash, at: new Date().toISOString() }))
    rows[index].state = 'failed'; rows[index].resolution = 'Wrapped deposit was canceled; indexer confirms the asset remains with the seller. Recovery: ' + cancelHash
    config.storage.setItem(KEY, JSON.stringify(rows)); return { resolved: true }
   })
  }
  return { run: run, reconcile: reconcile, recoverUnsent: recoverUnsent, reconcileClearedWrapped: reconcileClearedWrapped, records: read }
 }
 return { create: create }
})
