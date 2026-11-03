(function (root, factory) {
 'use strict'
 if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('ethers').ethers)
 else root.TrixmojiEscrowDeployment = factory(root.ethers)
})(typeof window !== 'undefined' ? window : globalThis, function (ethers) {
 'use strict'
 var KEY = 'trixmoji.market.deployment.v1'
 function same(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 function addr(value) { if (!ethers.utils.isAddress(value) || same(value, ethers.constants.AddressZero)) throw Error('Invalid Ethereum address.'); return ethers.utils.getAddress(value) }
 function create(config) {
  if (!config || !config.provider || typeof config.provider.request !== 'function' || !config.storage || !config.locks || !config.artifact || !config.artifact.abi || !/^0x[a-f0-9]+$/i.test(String(config.artifact.bytecode || '')) || !/^0x[a-f0-9]{64}$/i.test(String(config.expectedBytecodeHash || ''))) throw Error('Escrow deployment is not configured.')
  var creator = addr(config.creator), verifier = addr(config.verifier), chainId = Number(config.chainId), provider = config.provider
  if (same(creator, verifier)) throw Error('Use a separate verifier address from the creator wallet.')
  if (!Number.isSafeInteger(chainId) || chainId < 1) throw Error('Invalid deployment chain.')
  if (!same(ethers.utils.keccak256(config.artifact.bytecode), config.expectedBytecodeHash)) throw Error('Escrow creation bytecode does not match the reviewed build.')
  var iface = new ethers.utils.Interface(config.artifact.abi), factory = new ethers.ContractFactory(config.artifact.abi, config.artifact.bytecode)
  if (!iface.deploy || iface.deploy.inputs.length !== 2 || iface.deploy.inputs[0].name !== 'verifier_' || iface.deploy.inputs[0].type !== 'address' || iface.deploy.inputs[1].name !== 'creator_' || iface.deploy.inputs[1].type !== 'address' || iface.deploy.payable) throw Error('Escrow constructor ABI does not match the reviewed build.')
  function saved() { return JSON.parse(config.storage.getItem(KEY) || 'null') }
  function rpc(method, params) {
   return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () { reject(Error('Wallet did not respond to ' + method + '. No new deployment transaction was requested.')) }, 20000)
    try { Promise.resolve(provider.request({ method: method, params: params || [] })).then(function (value) { clearTimeout(timer); resolve(value) }, function (error) { clearTimeout(timer); reject(error) }) }
    catch (error) { clearTimeout(timer); reject(error) }
   })
  }
  async function identity() {
   if (BigInt(await rpc('eth_chainId')) !== BigInt(chainId)) throw Error('Wallet is on the wrong network.')
   var accounts = await rpc('eth_accounts')
   if (!accounts || !same(accounts[0], creator)) throw Error('Connect the configured creator wallet.')
  }
  async function plan() {
   await identity()
   var previous = saved()
   if (previous && ['awaiting-wallet', 'submitted', 'confirmed'].includes(previous.state)) throw Error('A deployment request already exists. Check its transaction before trying again.')
   var counts = await Promise.all([rpc('eth_getTransactionCount', [creator, 'latest']), rpc('eth_getTransactionCount', [creator, 'pending'])])
   if (!ethers.BigNumber.from(counts[0]).eq(counts[1])) throw Error('The creator wallet has a pending transaction. Resolve it before deployment.')
   var nonce = ethers.BigNumber.from(counts[0]).toNumber()
   var expectedAddress = ethers.utils.getContractAddress({ from: creator, nonce: nonce })
   var existing = await rpc('eth_getCode', [expectedAddress, 'latest'])
   if (existing && existing !== '0x' && existing !== '0x0') throw Error('The predicted contract address already contains code.')
   var built = factory.getDeployTransaction(verifier, creator)
   var tx = { from: creator, data: built.data, value: '0x0' }
   var estimate = ethers.BigNumber.from(await rpc('eth_estimateGas', [tx])), gasPrice = ethers.BigNumber.from(await rpc('eth_gasPrice'))
   if (estimate.isZero() || gasPrice.isZero()) throw Error('Deployment gas estimate is unavailable.')
   var balance = ethers.BigNumber.from(await rpc('eth_getBalance', [creator, 'latest']))
   if (balance.lt(estimate.mul(gasPrice))) throw Error('The creator wallet balance is below the estimated deployment gas cost.')
   return { tx: tx, creator: creator, verifier: verifier, chainId: chainId, startingNonce: nonce, predictedAddress: expectedAddress,
    initcodeHash: ethers.utils.keccak256(tx.data), estimatedGas: estimate.toString(), estimatedGasPriceWei: gasPrice.toString(), estimatedGasCostWei: estimate.mul(gasPrice).toString(), balanceWei: balance.toString(), preparedAt: Date.now() }
  }
  async function run(review) {
   if (typeof review !== 'function') throw Error('A creator wallet review is required.')
   return config.locks.request(KEY, { ifAvailable: true }, async function (lock) {
    if (!lock) throw Error('An escrow deployment is already running in another tab.')
    var prepared = await plan(), invalid = false, sent = false
    function changed() { invalid = true }
    if (provider.on) { provider.on('accountsChanged', changed); provider.on('chainChanged', changed) }
    async function approve() {
     if (sent) throw Error('A deployment request was already sent. Check the wallet before retrying.')
     if (invalid || Date.now() - prepared.preparedAt > 60000 || Date.now() < prepared.preparedAt) throw Error('Wallet, network or gas quote changed. Prepare deployment again.')
     var row = { state: 'awaiting-wallet', creator: creator, verifier: verifier, chainId: chainId, startingNonce: prepared.startingNonce,
      predictedAddress: prepared.predictedAddress, initcodeHash: prepared.initcodeHash, hash: '', at: new Date().toISOString() }
     config.storage.setItem(KEY, JSON.stringify(row)); sent = true
     var hash
     try { hash = await provider.request({ method: 'eth_sendTransaction', params: [Object.assign({}, prepared.tx, { chainId: ethers.utils.hexValue(chainId), gas: ethers.BigNumber.from(prepared.estimatedGas).mul(12).div(10).toHexString() })] }) }
     catch (error) { if (Number(error && error.code) === 4001) config.storage.removeItem(KEY); throw error }
     if (!/^0x[a-f0-9]{64}$/i.test(String(hash))) throw Error('No deployment hash returned. Check the wallet; do not deploy again.')
     row.hash = hash; row.state = 'submitted'
     try { config.storage.setItem(KEY, JSON.stringify(row)) } catch (_) { throw Error('Deployment submitted: ' + hash + '. Save this hash; local storage failed.') }
     return row
    }
    try {
     var result = await review({ creator: creator, verifier: verifier, chainId: chainId, predictedAddress: prepared.predictedAddress,
      estimatedGas: prepared.estimatedGas, estimatedGasCostWei: prepared.estimatedGasCostWei, approve: approve })
     if (!sent || !result || !result.hash) throw Error('No deployment transaction was submitted.')
     return result
    } finally { if (provider.removeListener) { provider.removeListener('accountsChanged', changed); provider.removeListener('chainChanged', changed) } }
   })
  }
  async function check(hash) {
   await identity()
   var row = saved()
   if (!row || !/^0x[a-f0-9]{64}$/i.test(String(hash || '')) || !same(row.creator, creator) || !same(row.verifier, verifier)) throw Error('A matching saved deployment and transaction hash are required.')
   var results = await Promise.all([rpc('eth_getTransactionByHash', [hash]), rpc('eth_getTransactionReceipt', [hash])]), tx = results[0], receipt = results[1]
   if (!tx || !receipt) throw Error('Deployment is not confirmed yet. Do not submit another.')
   if (!same(tx.from, creator) || tx.to || !same(ethers.utils.keccak256(tx.input || tx.data), row.initcodeHash) || !ethers.BigNumber.from(tx.value || 0).isZero()) throw Error('Transaction does not match the saved escrow deployment.')
   if (receipt.status === '0x0') { row.state = 'failed'; row.hash = hash; config.storage.setItem(KEY, JSON.stringify(row)); return { failed: true, hash: hash } }
   if (receipt.status !== '0x1' || !ethers.utils.isAddress(receipt.contractAddress || '')) throw Error('Deployment receipt is incomplete.')
   var address = ethers.utils.getAddress(receipt.contractAddress), expected = ethers.utils.getContractAddress({ from: creator, nonce: ethers.BigNumber.from(tx.nonce).toNumber() })
   if (!same(address, expected)) throw Error('Created contract address does not match the deployment transaction.')
   var code = await rpc('eth_getCode', [address, 'latest'])
   if (!code || code === '0x' || code === '0x0') throw Error('No contract code is available at the created address.')
   async function read(method) { return iface.decodeFunctionResult(method, await rpc('eth_call', [{ to: address, data: iface.encodeFunctionData(method) }, 'latest']))[0] }
   var values = await Promise.all([read('creator'), read('verifier'), read('ROYALTY_BPS')])
   if (!same(values[0], creator) || !same(values[1], verifier) || !ethers.BigNumber.from(values[2]).eq(250)) throw Error('Deployed escrow configuration does not match the reviewed constructor.')
   row.state = 'confirmed'; row.hash = hash; row.address = address; row.runtimeHash = ethers.utils.keccak256(code)
   config.storage.setItem(KEY, JSON.stringify(row))
   return { confirmed: true, hash: hash, address: address, creator: creator, verifier: verifier, royaltyBps: 250, runtimeHash: row.runtimeHash }
  }
  async function recoverUnsent(confirmed) {
   if (confirmed !== true) throw Error('Confirm that no deployment transaction or open wallet request exists.')
   return config.locks.request(KEY, { ifAvailable: true }, async function (lock) {
    if (!lock) throw Error('A deployment request is still running. Check the wallet first.')
    var snapshot = config.storage.getItem(KEY), row = saved()
    if (!row || row.state !== 'awaiting-wallet' || row.hash || !same(row.creator, creator) || !same(row.verifier, verifier) || row.chainId !== chainId || !Number.isSafeInteger(row.startingNonce) || row.startingNonce < 0) throw Error('Only this creator’s no-hash deployment request can be recovered.')
    await identity()
    var counts = await Promise.all([rpc('eth_getTransactionCount', [creator, 'latest']), rpc('eth_getTransactionCount', [creator, 'pending'])])
    if (!ethers.BigNumber.from(counts[0]).eq(row.startingNonce) || !ethers.BigNumber.from(counts[1]).eq(row.startingNonce)) throw Error('The wallet nonce changed or a transaction is pending. Inspect wallet activity before retrying.')
    var predicted = ethers.utils.getContractAddress({ from: creator, nonce: row.startingNonce })
    if (!same(predicted, row.predictedAddress)) throw Error('Saved deployment address does not match the creator nonce.')
    var code = await rpc('eth_getCode', [predicted, 'latest'])
    if (code && code !== '0x' && code !== '0x0') throw Error('Contract code already exists at the predicted address. Inspect the deployment instead.')
    if (config.storage.getItem(KEY) !== snapshot) throw Error('Saved deployment changed while checking. Reload and inspect it.')
    config.storage.setItem(KEY + '.recovery.' + Date.now(), JSON.stringify({ original: row, at: new Date().toISOString() }))
    config.storage.removeItem(KEY); return { recovered: true }
   })
  }
  return { plan: plan, run: run, check: check, recoverUnsent: recoverUnsent, saved: saved }
 }
 return { create: create }
})
