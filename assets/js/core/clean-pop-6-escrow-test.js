(function (root, factory) {
 'use strict'
 if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('ethers').ethers)
 else root.CleanPop6EscrowTest = factory(root.ethers)
})(typeof window !== 'undefined' ? window : globalThis, function (ethers) {
 'use strict'
 var KEY = 'trixmoji.clean-pop.6.direct-escrow-test.v1', MARKET_LOCK = 'trixmoji.market.contract.transaction.v1', ROUTE_LOCK = 'trixmoji.quantum-route-test'
 var seller = '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E', escrow = '0xd935E162B6070C4FEAF600c67f7F729f318515a2', id = '0xdf234357362b4884a50aa356f0cc6c76a52e72634c29c8e7440ca8232e285e74'
 var runtimeHash = '0x773514ab71d5c588d5c83a4866beb041dabd069ef142f9eb46584dff72cf7e36'
 var iface = new ethers.utils.Interface(['function depositBlock(address,bytes32) view returns(uint256)', 'function creator() view returns(address)', 'function verifier() view returns(address)', 'event Deposited(address indexed seller,bytes32 indexed id,uint256 blockNumber)'])
 function same(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 function create(c) {
  if (!c || !c.provider || !c.storage || !c.locks || typeof c.readAsset !== 'function' || typeof c.readStatus !== 'function') throw Error('Escrow test is not configured.')
  var provider = c.provider
  function rpc(method, params) { return provider.request({ method: method, params: params || [] }) }
  function read(key) { return JSON.parse(c.storage.getItem(key) || 'null') }
  function saved() { return read(KEY) }
  function write(row) { c.storage.setItem(KEY, JSON.stringify(row)) }
  async function call(name, args) { return iface.decodeFunctionResult(name, await rpc('eth_call', [{ to: escrow, data: iface.encodeFunctionData(name, args || []) }, 'latest']))[0] }
  async function identity() {
   if (BigInt(await rpc('eth_chainId')) !== 1n) throw Error('Switch to Ethereum mainnet.')
   var accounts = await rpc('eth_accounts'); if (!accounts || !same(accounts[0], seller)) throw Error('Connect the #6 owner wallet ending aa3E.')
   var code = await rpc('eth_getCode', [escrow, 'latest'])
   if (!code || code === '0x' || !same(ethers.utils.keccak256(code), runtimeHash)) throw Error('Escrow code does not match the verified deployment.')
   var settings = await Promise.all([call('creator'), call('verifier')])
   if (!same(settings[0], '0x915A3D363D0a4e4470B531f008F5142c540E5417') || !same(settings[1], '0x5f5d219c6B3f732eBDCe4BFD9c4655957Ff472C4')) throw Error('Escrow settings do not match.')
  }
  function pendingPrior() {
   var route = read('trixmoji.quantum-route-test.v1'), old = read('trixmoji.ethscription.route-probe.v1')
   if ([route, old].some(function (r) { return r && ['awaiting-wallet', 'submitted'].includes(r.state) })) throw Error('An earlier wallet-route test has an unresolved outcome. Resolve its saved request first; no escrow request was made.')
   var market = read(MARKET_LOCK) || []
   if (!Array.isArray(market)) throw Error('Saved market records are invalid.')
   if (market.some(function (r) { return same(r.from, seller) && r.state !== 'failed' && r.state !== 'complete' })) throw Error('An earlier market transaction remains unresolved. Verify the #6 recovery before this test.')
  }
  async function ownership(expected, minimum) {
   var result = await Promise.all([c.readAsset(id), c.readStatus(), rpc('eth_blockNumber')]), asset = result[0], status = result[1], head = Number(BigInt(result[2])), indexed = Number(status && status.last_imported_block)
   if (!Number.isSafeInteger(indexed) || indexed < minimum || head - indexed > 2) throw Error('The Ethscriptions indexer is catching up. Wait and check again.')
   if (!asset || !same(asset.transaction_hash, id) || !same(asset.creator, '0x11019B7af0F833f5695a44584c5B31Bb1D0baabC') || !same(asset.current_owner, expected)) throw Error('The indexer does not show the required owner for #6.')
   return { asset: asset, head: head, indexed: indexed }
  }
  async function plan() {
   await identity(); pendingPrior(); if (saved()) throw Error('An escrow test is already saved. Check it before another request.')
   await ownership(seller, 0)
   if (!(await call('depositBlock', [seller, id])).isZero()) throw Error('A deposit record already exists. Do not send #6 again.')
   var nonces = await Promise.all([rpc('eth_getTransactionCount', [seller, 'latest']), rpc('eth_getTransactionCount', [seller, 'pending'])])
   if (BigInt(nonces[0]) !== BigInt(nonces[1])) throw Error('The wallet has a pending transaction. Resolve it first.')
   var tx = { from: seller, to: escrow, value: '0x0', data: id }
   await rpc('eth_call', [tx, 'latest'])
   var gas = ethers.BigNumber.from(await rpc('eth_estimateGas', [tx])); if (gas.isZero()) throw Error('Gas estimate is unavailable.')
   return { tx: tx, estimatedGas: gas.toString(), nonce: BigInt(nonces[0]).toString(), preparedAt: Date.now() }
  }
  async function run(review) {
   if (typeof review !== 'function') throw Error('A wallet review is required.')
   return c.locks.request(MARKET_LOCK, { ifAvailable: true }, function (marketLock) {
    if (!marketLock) throw Error('A market request is already open.')
    return c.locks.request(ROUTE_LOCK, { ifAvailable: true }, async function (routeLock) {
     if (!routeLock) throw Error('A wallet-route request is still open. Resolve it before depositing.')
     var p = await plan(), invalid = false, sent = false
     function changed() { invalid = true }
     if (provider.on) { provider.on('accountsChanged', changed); provider.on('chainChanged', changed) }
     async function approve() {
      if (sent) throw Error('Wallet request already made. Do not repeat it.')
      if (invalid || Date.now() - p.preparedAt > 60000 || Date.now() < p.preparedAt) throw Error('Wallet, network or review changed. Prepare again.')
      var row = { state: 'awaiting-wallet', from: seller, to: escrow, data: id, startingNonce: p.nonce, hash: '' }
      write(row); sent = true
      var hash
      try { hash = await provider.request({ method: 'eth_sendTransaction', params: [p.tx] }) }
      catch (e) { if (Number(e && e.code) === 4001) c.storage.removeItem(KEY); throw e }
      if (!/^0x[a-f0-9]{64}$/i.test(String(hash || ''))) throw Error('No hash returned. Check wallet Activity; do not retry.')
      row.hash = hash; row.state = 'submitted'; write(row); return row
     }
     try { var row = await review({ from: seller, to: escrow, id: id, estimatedGas: p.estimatedGas, approve: approve }); if (!sent || !row || !row.hash) throw Error('No escrow test was submitted.'); return row }
     finally { if (provider.removeListener) { provider.removeListener('accountsChanged', changed); provider.removeListener('chainChanged', changed) } }
    })
   })
  }
  async function check(hash) {
   var row = saved(); if (!row || !/^0x[a-f0-9]{64}$/i.test(String(hash || '')) || (row.hash && !same(row.hash, hash))) throw Error('Enter the matching escrow-test hash from wallet Activity.')
   await identity()
   var result = await Promise.all([rpc('eth_getTransactionByHash', [hash]), rpc('eth_getTransactionReceipt', [hash])]), tx = result[0], receipt = result[1]
   if (!tx || !receipt) throw Error('Transaction is not confirmed yet. Do not retry.')
   if (!same(tx.hash, hash) || !same(receipt.transactionHash, hash)) throw Error('Transaction hash mismatch.')
   if (receipt.status === '0x0') { row.hash = hash; row.state = 'failed'; write(row); return { state: 'failed', hash: hash } }
   if (receipt.status !== '0x1') throw Error('Receipt status is unavailable.')
   var found = (receipt.logs || []).some(function (log) { if (!same(log.address, escrow)) return false; try { var e = iface.parseLog(log); return e.name === 'Deposited' && same(e.args.seller, seller) && same(e.args.id, id) } catch (_) { return false } })
   if (!found) throw Error('The expected #6 deposit event is missing. Do not retry.')
   var block = Number(BigInt(receipt.blockNumber)), record = await call('depositBlock', [seller, id])
   if (!Number.isSafeInteger(block) || block < 1) throw Error('Receipt block is unavailable.')
   var direct = same(tx.from, seller) && same(tx.to, escrow) && same(tx.input || tx.data, id) && ethers.BigNumber.from(tx.value || 0).isZero() && ethers.BigNumber.from(tx.nonce).eq(row.startingNonce)
   if (!direct) { row.hash = hash; row.state = 'wrapped-unverified'; write(row); return { state: row.state, hash: hash } }
   var indexed = await ownership(escrow, block)
   if (indexed.head < block + 5) throw Error('Deposit confirmed. Wait for the five-block cooldown, then check again.')
   if (!record.eq(block) || !same(indexed.asset.previous_owner, seller)) throw Error('Escrow record or previous owner does not match.')
   var transfers = (indexed.asset.ethscription_transfers || []).filter(function (t) { return same(t.transaction_hash, hash) && same(t.from_address, seller) && same(t.to_address, escrow) && Number(t.block_number) === block })
   if (transfers.length !== 1) throw Error('The indexer has not confirmed the exact transfer.')
   row.hash = hash; row.state = 'verified'; write(row); return { state: 'verified', hash: hash }
  }
  return { plan: plan, run: run, check: check, saved: saved }
 }
 return { create: create }
})
