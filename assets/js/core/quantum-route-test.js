(function (root, factory) {
 'use strict'
 if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('ethers').ethers)
 else root.QuantumRouteTest = factory(root.ethers)
})(typeof window !== 'undefined' ? window : globalThis, function (ethers) {
 'use strict'
 var KEY = 'trixmoji.quantum-route-test.v1', OLD_KEY = 'trixmoji.ethscription.route-probe.v1', LOCK = 'trixmoji.quantum-route-test', owner = '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E', recipient = '0x5f5d219c6B3f732eBDCe4BFD9c4655957Ff472C4', delegatedCode = '0xef010063c0c19a282a1b52b07dd5a65b58948a07dae32b'
 function same(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 function create(options) {
  if (!options || !options.provider || typeof options.provider.request !== 'function' || !options.storage || !options.locks || typeof options.generateData !== 'function' || typeof options.isUnused !== 'function') throw Error('Wallet route test is not configured.')
  var provider = options.provider
  function rpc(method, params) { return provider.request({ method: method, params: params || [] }) }
  function saved() { return JSON.parse(options.storage.getItem(KEY) || 'null') }
  function oldSaved() { return JSON.parse(options.storage.getItem(OLD_KEY) || 'null') }
  async function identity(requireDelegated) {
   if (BigInt(await rpc('eth_chainId')) !== 1n) throw Error('Switch to Ethereum mainnet.')
   var accounts = await rpc('eth_accounts'); if (!accounts || !same(accounts[0], owner)) throw Error('Connect wallet ' + owner + '.')
   if (requireDelegated && !same(await rpc('eth_getCode', [owner, 'latest']), delegatedCode)) throw Error('The wallet delegation changed. This test will not request an account upgrade.')
  }
  async function plan(confirmedPreviousFailure) {
   await identity(true)
   if (saved()) throw Error('A route test is already saved. Check it before trying again.')
   var oldRaw = options.storage.getItem(OLD_KEY), old = oldSaved(), oldPending = old && (old.state === 'awaiting-wallet' || old.state === 'submitted')
   var nonces = await Promise.all([rpc('eth_getTransactionCount', [owner, 'latest']), rpc('eth_getTransactionCount', [owner, 'pending'])]), nonce = ethers.BigNumber.from(nonces[0])
   if (!nonce.eq(nonces[1])) throw Error('The wallet has a pending transaction. Resolve it before testing.')
   if (oldPending) {
    if (old.hash) throw Error('The earlier test has a transaction hash. Check it before continuing.')
    if (confirmedPreviousFailure !== true || !/^\d+$/.test(String(old.nonce || '')) || !nonce.eq(old.nonce)) throw Error('Confirm the earlier failed test has no pending wallet request or hash; its saved nonce must remain unchanged.')
   }
   var code = await rpc('eth_getCode', [recipient, 'latest']); if (code !== '0x' && code !== '0x0') throw Error('The destination wallet has contract code; the test is unavailable.')
   var data = options.generateData(); if (!/^0x[a-f0-9]{64}$/i.test(String(data)) || !(await options.isUnused(data))) throw Error('Could not confirm that the random test data is unused.')
   if (oldPending) {
    if (options.storage.getItem(OLD_KEY) !== oldRaw) throw Error('The previous test record changed. Reload and inspect it.')
    options.storage.setItem(OLD_KEY + '.archive.' + Date.now(), JSON.stringify({ original: old, reason: 'confirmed failed; nonce unchanged' })); options.storage.removeItem(OLD_KEY)
   }
   // Same shape as Quantum's live transfer: leave gas, fees and nonce to the wallet.
   return { tx: { from: owner, to: recipient, value: '0x0', data: data }, startingNonce: nonce.toString(), preparedAt: Date.now() }
  }
  async function run(confirmedPreviousFailure, review) {
   if (typeof review !== 'function') throw Error('A wallet review is required.')
   return options.locks.request(LOCK, { ifAvailable: true }, async function (lock) {
    if (!lock) throw Error('A route test is already in progress.')
    var prepared = await plan(confirmedPreviousFailure), changed = false, sent = false
    function invalid() { changed = true }
    if (provider.on) { provider.on('accountsChanged', invalid); provider.on('chainChanged', invalid) }
    async function approve() {
     if (sent) throw Error('A wallet request was already made. Check Activity before retrying.')
     if (changed || Date.now() - prepared.preparedAt > 60000 || Date.now() < prepared.preparedAt) throw Error('Wallet, network or review changed. Prepare the test again.')
     var row = { state: 'awaiting-wallet', from: owner, to: recipient, data: prepared.tx.data, startingNonce: prepared.startingNonce, hash: '' }
     options.storage.setItem(KEY, JSON.stringify(row)); sent = true
     var hash
     try { hash = await provider.request({ method: 'eth_sendTransaction', params: [prepared.tx] }) }
     catch (e) { if (Number(e && e.code) === 4001) options.storage.removeItem(KEY); throw e }
     if (!/^0x[a-f0-9]{64}$/i.test(String(hash || ''))) throw Error('Wallet returned no hash. Check Activity; do not retry.')
     row.hash = hash; row.state = 'submitted'; options.storage.setItem(KEY, JSON.stringify(row)); return row
    }
    try { var row = await review({ from: owner, to: recipient, data: prepared.tx.data, approve: approve }); if (!sent || !row || !row.hash) throw Error('No test transaction was submitted.'); return row }
    finally { if (provider.removeListener) { provider.removeListener('accountsChanged', invalid); provider.removeListener('chainChanged', invalid) } }
   })
  }
  async function check(hash) {
   var row = saved(); if (!row || !/^0x[a-f0-9]{64}$/i.test(String(hash || ''))) throw Error('Enter the transaction hash from wallet Activity.')
   if (row.hash && !same(row.hash, hash)) throw Error('The hash does not match the saved test.')
   await identity(false)
   var result = await Promise.all([rpc('eth_getTransactionByHash', [hash]), rpc('eth_getTransactionReceipt', [hash])]), tx = result[0], receipt = result[1]
   if (!tx || !receipt) throw Error('The test is not confirmed yet. Do not submit another.')
   if (!same(tx.hash, hash) || !same(receipt.transactionHash, hash)) throw Error('The transaction hash does not match.')
   if (receipt.status !== '0x1') throw Error('The test transaction failed. Check wallet Activity before retrying.')
   var input = String(tx.input || tx.data || '').toLowerCase(), value = ethers.BigNumber.from(tx.value || 0)
   var direct = same(tx.from, row.from) && same(tx.to, row.to) && same(input, row.data) && value.isZero() && ethers.BigNumber.from(tx.nonce).eq(row.startingNonce)
   if (!direct && (!input.includes(row.to.slice(2).toLowerCase()) || !input.includes(row.data.slice(2).toLowerCase()))) throw Error('The confirmed transaction does not contain the expected test call.')
   row.hash = hash; row.state = direct ? 'direct' : 'wrapped'; options.storage.setItem(KEY, JSON.stringify(row))
   return { direct: direct, hash: hash, transactionTo: tx.to, blockNumber: Number(BigInt(receipt.blockNumber)) }
  }
  async function recoverUnsent(confirmed) {
   if (confirmed !== true) throw Error('Confirm in MetaMask that no test approval, pending transaction, or transaction hash exists.')
   return options.locks.request(LOCK, { ifAvailable: true }, async function (lock) {
    if (!lock) throw Error('The wallet request is still open. Resolve it in MetaMask before recovery.')
    var snapshot = options.storage.getItem(KEY), row = saved()
    if (!row || row.state !== 'awaiting-wallet' || row.hash || !same(row.from, owner) || !same(row.to, recipient) || !/^\d+$/.test(String(row.startingNonce || '')) || !/^0x[a-f0-9]{64}$/i.test(String(row.data || ''))) throw Error('Only the original no-hash test request can be recovered.')
    await identity(false)
    var counts = await Promise.all([rpc('eth_getTransactionCount', [owner, 'latest']), rpc('eth_getTransactionCount', [owner, 'pending'])])
    if (!ethers.BigNumber.from(counts[0]).eq(row.startingNonce) || !ethers.BigNumber.from(counts[1]).eq(row.startingNonce)) throw Error('The wallet nonce changed or a transaction is pending. Check wallet Activity before continuing.')
    if (options.storage.getItem(KEY) !== snapshot) throw Error('The saved test changed during the check. Reload and inspect it.')
    options.storage.setItem(KEY + '.archive.' + Date.now(), JSON.stringify({ original: row, reason: 'no hash; owner confirmed wallet activity and nonce unchanged' }))
    options.storage.removeItem(KEY); return { recovered: true }
   })
  }
  return { plan: plan, run: run, check: check, saved: saved, oldSaved: oldSaved, recoverUnsent: recoverUnsent }
 }
 return { create: create }
})
