(function (root, factory) {
 'use strict'
 if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('ethers').ethers)
 else root.CleanPopWebpV2Deployment = factory(root.ethers)
})(typeof window !== 'undefined' ? window : globalThis, function (ethers) {
 'use strict'
 var KEY = 'trixmoji.clean-pop-webp-v2.deployment'
 var expected = { creator: '0x915A3D363D0a4e4470B531f008F5142c540E5417', site: '0x15e85a85B7026875d3529EF0c6de2723C285DA11',
  factory: '0x4e59b44847b379578588920ca78fbf26c0b4956c', factoryHash: '0x2fa86add0aed31f33a762c9d88e807c475bd51d0f52bd0955754b2608f7e4989',
  address: '0xD085EB56d7195Bdf4a17bf3107FDC938a118B704', root: '0xfe6a7cece9e254f117607c2ef328ca17e47141be89c50a893d1547bc2bc838cc',
  bytecodeHash: '0xa0f5e5d6804546d7a3cd980b743d79a16cdf86f5209b1e3abfc0d822ff09f1c7', runtimeHash: '0x4ce7d8626b0f962fe55be514b37d3749ce69957d0a9d50025288e46cfcb747dc',
  payloadHash: '0x1d631d28f512489b7c26b99b0c4e3030f1c6b54a65686118d35c8617845cdcfe', priceWei: '200000000000000' }
 function same(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 function create(config) {
  if (!config || !config.provider || typeof config.provider.request !== 'function' || !config.storage || !config.locks || !config.artifact) throw Error('Deployment preparation is not configured.')
  var a = config.artifact, provider = config.provider, iface = new ethers.utils.Interface(a.abi)
  if (!same(a.creator, expected.creator) || !same(a.site, expected.site) || !same(a.factory, expected.factory) || !same(a.address, expected.address) || !same(a.root, expected.root) || String(a.priceWei) !== expected.priceWei || Number(a.chainId) !== 1 || !same(ethers.utils.keccak256(a.bytecode), expected.bytecodeHash) || !same(ethers.utils.keccak256(a.runtime), expected.runtimeHash) || !same(ethers.utils.keccak256(a.deployData), expected.payloadHash) || !same(ethers.utils.getCreate2Address(a.factory, a.salt, ethers.utils.keccak256(a.bytecode)), a.address)) throw Error('Candidate does not match the reviewed deployment.')
  function rpc(method, params) { return provider.request({ method: method, params: params || [] }) }
  function saved() { return JSON.parse(config.storage.getItem(KEY) || 'null') }
  async function identity() {
   if (BigInt(await rpc('eth_chainId')) !== 1n) throw Error('Switch to Ethereum mainnet.')
   var accounts = await rpc('eth_accounts'); if (!accounts || !same(accounts[0], expected.creator)) throw Error('Connect the configured creator wallet ' + expected.creator + '.')
  }
  async function plan() {
   await identity()
   var row = saved(); if (row && row.state !== 'failed') throw Error('A deployment request is already saved. Check it before retrying.')
   var values = await Promise.all([rpc('eth_getCode', [a.factory, 'latest']), rpc('eth_getCode', [a.address, 'latest']), rpc('eth_getTransactionCount', [expected.creator, 'latest']), rpc('eth_getTransactionCount', [expected.creator, 'pending']), rpc('eth_getBalance', [expected.creator, 'latest']), rpc('eth_gasPrice')])
   if (!same(ethers.utils.keccak256(values[0]), expected.factoryHash)) throw Error('Deployment factory does not match the reviewed factory.')
   if (values[1] !== '0x') throw Error('The predicted address already contains code. Inspect before deploying.')
   if (!ethers.BigNumber.from(values[2]).eq(values[3])) throw Error('Creator wallet has a pending transaction. Resolve it before deploying.')
   var tx = { from: expected.creator, to: a.factory, value: '0x0', data: a.deployData }, simulation = await Promise.all([rpc('eth_call', [tx, 'latest']), rpc('eth_estimateGas', [tx])])
   if (!same(simulation[0], a.address)) throw Error('Factory simulation returned a different address.')
   var gas = ethers.BigNumber.from(simulation[1]), gasPrice = ethers.BigNumber.from(values[5]), balance = ethers.BigNumber.from(values[4])
   if (gas.isZero() || gasPrice.isZero()) throw Error('Deployment gas estimate is unavailable.')
   if (balance.lt(gas.mul(gasPrice))) throw Error('Creator balance is below the estimated deployment fee.')
   return { tx: tx, nonce: ethers.BigNumber.from(values[2]).toString(), estimatedGas: gas.toString(), estimatedCostWei: gas.mul(gasPrice).toString(), preparedAt: Date.now() }
  }
  async function run(review) {
   if (typeof review !== 'function') throw Error('Deployment review is required.')
   return config.locks.request(KEY, { ifAvailable: true }, async function (lock) {
    if (!lock) throw Error('A deployment request is active in another tab.')
    var p = await plan(), invalid = false, sent = false
    function changed() { invalid = true }
    if (provider.on) { provider.on('accountsChanged', changed); provider.on('chainChanged', changed) }
    async function approve() {
     if (sent || invalid || Date.now() - p.preparedAt > 60000 || Date.now() < p.preparedAt) throw Error('Deployment review expired or wallet changed. Prepare again.')
     var row = { state: 'awaiting-wallet', hash: '', nonce: p.nonce, creator: expected.creator, address: expected.address, payloadHash: expected.payloadHash }
     config.storage.setItem(KEY, JSON.stringify(row)); sent = true
     var hash
     try { hash = await provider.request({ method: 'eth_sendTransaction', params: [Object.assign({}, p.tx, { gas: ethers.utils.hexValue(ethers.BigNumber.from(p.estimatedGas).mul(12).div(10)), chainId: '0x1' })] }) }
     catch (error) { if (Number(error && error.code) === 4001) config.storage.removeItem(KEY); throw error }
     if (!/^0x[a-f0-9]{64}$/i.test(String(hash || ''))) throw Error('No deployment hash returned. Check wallet activity; do not retry.')
     row.hash = hash; row.state = 'submitted'; config.storage.setItem(KEY, JSON.stringify(row)); return row
    }
    try { var result = await review({ address: a.address, root: a.root, creator: a.creator, site: a.site, priceWei: a.priceWei, maxPerWallet: 20, estimatedGas: p.estimatedGas, estimatedCostWei: p.estimatedCostWei, approve: approve }); if (!sent || !result || !result.hash) throw Error('No deployment transaction was submitted.'); return result }
    finally { if (provider.removeListener) { provider.removeListener('accountsChanged', changed); provider.removeListener('chainChanged', changed) } }
   })
  }
  async function check(hash) {
   await identity(); var row = saved()
   if (!row || !/^0x[a-f0-9]{64}$/i.test(String(hash || '')) || !same(row.creator, expected.creator) || !same(row.address, expected.address) || !same(row.payloadHash, expected.payloadHash)) throw Error('A matching saved deployment and transaction hash are required.')
   var results = await Promise.all([rpc('eth_getTransactionByHash', [hash]), rpc('eth_getTransactionReceipt', [hash])]), tx = results[0], receipt = results[1]
   if (!tx || !receipt) throw Error('Deployment is not confirmed. Check again; do not retry.')
   if (!same(tx.hash, hash) || !same(receipt.transactionHash, hash) || !same(tx.from, expected.creator) || !same(tx.to, a.factory) || !same(tx.input || tx.data, a.deployData) || !ethers.BigNumber.from(tx.value || '0x0').isZero()) throw Error('Transaction does not match the reviewed deployment.')
   if (receipt.status === '0x0') { row.state = 'failed'; row.hash = hash; config.storage.setItem(KEY, JSON.stringify(row)); return { failed: true } }
   if (receipt.status !== '0x1') throw Error('Deployment receipt status is unavailable.')
   var code = await rpc('eth_getCode', [a.address, 'latest']); if (!same(ethers.utils.keccak256(code), expected.runtimeHash)) throw Error('Deployed runtime does not match the candidate.')
   async function read(name) { return iface.decodeFunctionResult(name, await rpc('eth_call', [{ to: a.address, data: iface.encodeFunctionData(name) }, 'latest']))[0] }
   var values = await Promise.all([read('OWNER'), read('SITE'), read('PRICE'), read('ROOT'), read('paused')])
   if (!same(values[0], expected.creator) || !same(values[1], expected.site) || !values[2].eq(expected.priceWei) || !same(values[3], expected.root)) throw Error('Deployed terms do not match the reviewed candidate.')
   row.hash = hash; row.state = 'confirmed'; config.storage.setItem(KEY, JSON.stringify(row)); return { confirmed: true, address: a.address, paused: values[4] }
  }
  async function recoverUnsent(confirmed) {
   if (confirmed !== true) throw Error('Confirm there is no pending deployment or open wallet request.')
   return config.locks.request(KEY, { ifAvailable: true }, async function (lock) {
    if (!lock) throw Error('A deployment request is still active.')
    var snapshot = config.storage.getItem(KEY), row = saved()
    if (!row || row.state !== 'awaiting-wallet' || row.hash || !/^\d+$/.test(String(row.nonce || '')) || !same(row.creator, expected.creator) || !same(row.address, expected.address) || !same(row.payloadHash, expected.payloadHash)) throw Error('Only a matching no-hash request can be checked.')
    await identity()
    var result = await Promise.all([rpc('eth_getTransactionCount', [expected.creator, 'latest']), rpc('eth_getTransactionCount', [expected.creator, 'pending']), rpc('eth_getCode', [a.address, 'latest'])])
    if (!ethers.BigNumber.from(result[0]).eq(row.nonce) || !ethers.BigNumber.from(result[1]).eq(row.nonce) || result[2] !== '0x') throw Error('Nonce changed, a transaction is pending, or code exists. Inspect wallet activity.')
    if (config.storage.getItem(KEY) !== snapshot) throw Error('Saved deployment changed while checking.')
    config.storage.setItem(KEY + '.recovery.' + Date.now(), JSON.stringify({ original: row, checkedAt: new Date().toISOString() })); config.storage.removeItem(KEY)
    return { recovered: true }
   })
  }
  return { plan: plan, run: run, check: check, saved: saved, recoverUnsent: recoverUnsent }
 }
 return { create: create }
})
