(function (root, factory) {
 'use strict'
 if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('ethers').ethers)
 else root.EthscriptionRouteProbe = factory(root.ethers)
})(typeof window !== 'undefined' ? window : globalThis, function (ethers) {
 'use strict'
 var KEY = 'trixmoji.ethscription.route-probe.v1', LOCK = 'trixmoji.ethscription.route-probe', target = '0x000000000000000000000000000000000000dEaD', account = '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E', expectedCode = '0xef010063c0c19a282a1b52b07dd5a65b58948a07dae32b'
 function same(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 function quantity(value) { return ethers.utils.hexValue(ethers.BigNumber.from(value)) }
 function create(options) {
  if (!options || !options.provider || typeof options.provider.request !== 'function' || !options.storage || !options.locks || typeof options.generateData !== 'function' || typeof options.isUnused !== 'function') throw Error('Route test is not configured.')
  function saved() { return JSON.parse(options.storage.getItem(KEY) || 'null') }
  function rpc(method, params) { return options.provider.request({ method: method, params: params || [] }) }
  async function identity() {
   var chain = await rpc('eth_chainId'), accounts = await rpc('eth_accounts')
   if (BigInt(chain) !== 1n || !accounts || !same(accounts[0], account)) throw Error('Connect wallet ' + account + ' on Ethereum mainnet.')
   if (!same(await rpc('eth_getCode', [account, 'latest']), expectedCode)) throw Error('The test requires the existing MetaMask delegated account; it will not request an account upgrade.')
  }
  async function plan() {
   await identity()
   if (saved()) throw Error('A test request is already saved. Check it before trying again.')
   var data = options.generateData()
   if (!/^0x[a-f0-9]{64}$/i.test(String(data)) || !(await options.isUnused(data))) throw Error('Could not verify that the test data is unrelated to any Ethscription.')
   var code = await rpc('eth_getCode', [target, 'latest'])
   if (code !== '0x' && code !== '0x0') throw Error('The test destination is not an empty address.')
   var result = await Promise.all([rpc('eth_getTransactionCount', [account, 'latest']), rpc('eth_getTransactionCount', [account, 'pending']), rpc('eth_getBlockByNumber', ['latest', false]), rpc('eth_gasPrice'), rpc('eth_getBalance', [account, 'latest'])])
   var nonce = ethers.BigNumber.from(result[0]); if (!nonce.eq(result[1])) throw Error('The wallet has a pending transaction. Resolve it before the route test.')
   if (!result[2] || !result[2].baseFeePerGas) throw Error('Current Ethereum fee data is unavailable.')
   var base = ethers.BigNumber.from(result[2].baseFeePerGas), gasPrice = ethers.BigNumber.from(result[3]), tip = gasPrice.gt(base) ? gasPrice.sub(base) : ethers.BigNumber.from(1), maxFee = base.mul(2).add(tip)
   var tx = { from: account, to: target, value: '0x0', data: data, chainId: '0x1', type: '0x2', nonce: quantity(nonce), maxFeePerGas: quantity(maxFee), maxPriorityFeePerGas: quantity(tip) }
   var estimate = ethers.BigNumber.from(await rpc('eth_estimateGas', [tx])), gas = estimate.mul(12).div(10)
   if (gas.isZero() || ethers.BigNumber.from(result[4]).lt(gas.mul(maxFee))) throw Error('The wallet does not have enough ETH for the maximum test fee.')
   tx.gas = quantity(gas)
   return { tx: tx, maxGasWei: gas.mul(maxFee).toString(), preparedAt: Date.now() }
  }
  async function run(review) {
   if (typeof review !== 'function') throw Error('A review is required.')
   return options.locks.request(LOCK, { ifAvailable: true }, async function (lock) {
    if (!lock) throw Error('A route test is already running.')
    var prepared = await plan(), changed = false, requested = false
    function invalid() { changed = true }
    if (options.provider.on) { options.provider.on('accountsChanged', invalid); options.provider.on('chainChanged', invalid) }
    async function approve() {
     if (requested) throw Error('The wallet request was already made. Check Activity.')
     if (changed || Date.now() - prepared.preparedAt > 60000 || Date.now() < prepared.preparedAt) throw Error('Wallet, network or quote changed. Prepare the test again.')
     var row = { state: 'awaiting-wallet', from: account, to: target, data: prepared.tx.data, nonce: ethers.BigNumber.from(prepared.tx.nonce).toString(), hash: '' }
     options.storage.setItem(KEY, JSON.stringify(row)); requested = true
     var hash
     try { hash = await options.provider.request({ method: 'eth_sendTransaction', params: [prepared.tx] }) }
     catch (e) { if (Number(e && e.code) === 4001) options.storage.removeItem(KEY); throw e }
     if (!/^0x[a-f0-9]{64}$/i.test(String(hash))) throw Error('No transaction hash was returned. Check wallet Activity; do not retry.')
     row.hash = hash; row.state = 'submitted'; options.storage.setItem(KEY, JSON.stringify(row)); return row
    }
    try { var row = await review({ to: target, from: account, data: prepared.tx.data, maxGasWei: prepared.maxGasWei, approve: approve }); if (!requested || !row || !row.hash) throw Error('No route test was submitted.'); return row }
    finally { if (options.provider.removeListener) { options.provider.removeListener('accountsChanged', invalid); options.provider.removeListener('chainChanged', invalid) } }
   })
  }
  async function check(hash) {
   var row = saved(); if (!row || !/^0x[a-f0-9]{64}$/i.test(String(hash || ''))) throw Error('Enter the route-test transaction hash from wallet Activity.')
   if (row.hash && !same(row.hash, hash)) throw Error('This hash does not match the saved test.')
   await identity()
   var values = await Promise.all([rpc('eth_getTransactionByHash', [hash]), rpc('eth_getTransactionReceipt', [hash])]), tx = values[0], receipt = values[1]
   if (!tx || !receipt) throw Error('The test transaction is not confirmed yet. Do not submit another.')
   if (!same(tx.hash, hash) || receipt.status !== '0x1') throw Error('The transaction did not match or did not succeed. Inspect wallet Activity.')
   var input = String(tx.input || tx.data || '').toLowerCase()
   var direct = same(tx.from, row.from) && same(tx.to, row.to) && same(input, row.data) && ethers.BigNumber.from(tx.value || 0).isZero() && ethers.BigNumber.from(tx.nonce).eq(row.nonce)
   if (!direct && (!input.includes(row.to.slice(2).toLowerCase()) || !input.includes(row.data.slice(2).toLowerCase()))) throw Error('The transaction does not contain the expected test call. Inspect wallet Activity.')
   row.hash = hash; row.state = direct ? 'direct' : 'wrapped'; row.checkedAt = new Date().toISOString(); options.storage.setItem(KEY, JSON.stringify(row))
   return { hash: hash, direct: direct, transactionTo: tx.to, expectedTo: row.to, blockNumber: Number(BigInt(receipt.blockNumber)), account: row.from }
  }
  return { plan: plan, run: run, check: check, saved: saved }
 }
 return { create: create }
})
