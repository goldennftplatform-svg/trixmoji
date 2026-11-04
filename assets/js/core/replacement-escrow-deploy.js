(function () {
 'use strict'
 var el = function (id) { return document.getElementById(id) }, artifact, client, busy = false
 var creator = '0x915A3D363D0a4e4470B531f008F5142c540E5417', verifier = '0x5f5d219c6B3f732eBDCe4BFD9c4655957Ff472C4'
 var hash = '0x24e2043c17ee70fdd20b016e4b33e077127f61f109d065776380603267318a4b'
 function same(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase() }
 function say(s) { el('status').textContent = s }
 function controls() { el('connect').disabled = busy || !artifact; el('prepare').disabled = busy || !client }
 function saved() { var row = client && client.saved(); el('saved').hidden = !row; if (!row) return; el('savedDetails').textContent = row.state + (row.address ? ' · contract ' + row.address : ''); if (row.hash) el('hash').value = row.hash }
 function review(q) { return new Promise(function (resolve, reject) {
  var host = el('review'), text = document.createElement('p'), yes = document.createElement('button'), no = document.createElement('button')
  host.hidden = false; host.textContent = ''; text.textContent = 'Ethereum mainnet · deploying wallet ' + q.deployer + ' · creator ' + q.creator + ' · verifier ' + q.verifier + ' · predicted address ' + q.predictedAddress + ' · estimated gas ' + q.estimatedGas + ' · estimated cost ' + EthscriptionCheckout.eth(q.estimatedGasCostWei) + ' ETH. Wallet shows final fee. This deploys a new contract and does not move #6.'
  yes.textContent = 'APPROVE DEPLOYMENT IN WALLET'; no.textContent = 'CANCEL'
  yes.onclick = function () { yes.disabled = true; no.disabled = true; say('Waiting for wallet. Do not repeat.'); q.approve().then(function (row) { host.hidden = true; resolve(row) }, function (error) { host.hidden = true; reject(error) }) }
  no.onclick = function () { host.hidden = true; reject(Error('Cancelled; no deployment requested.')) }; host.append(text, yes, no)
 }) }
 el('connect').onclick = async function () { busy = true; controls(); try {
  var provider = await EthscriptionCheckout.choose(el('wallets'), say); await EthscriptionCheckout.ensureChain(provider)
  var accounts = await provider.request({ method: 'eth_accounts' }), account = accounts && accounts[0]
  if (!same(account, creator) && !same(account, verifier)) throw Error('Connect the creator or verifier wallet.')
  client = TrixmojiEscrowDeployment.create({ provider: provider, storage: localStorage, locks: navigator.locks, storageKey: 'trixmoji.market.deployment.replacement-v1', artifact: artifact, creator: creator, verifier: verifier, deployer: account, chainId: 1, expectedBytecodeHash: hash })
  saved(); say('Connected ' + account + '. Preparation performs read-only wallet estimates.')
 } catch (error) { say(error.message) } finally { busy = false; controls() } }
 el('prepare').onclick = async function () { if (busy || !client) return; busy = true; controls(); try { say('Checking wallet, bytecode, nonce and deployment gas…'); var row = await client.run(review); say('Submitted ' + row.hash + '. Verify it after confirmation; do not repeat.'); saved() } catch (error) { say(error.message); saved() } finally { busy = false; controls() } }
 el('check').onclick = async function () { if (!client || busy) return; busy = true; controls(); try { var result = await client.check(el('hash').value.trim()); say(result.confirmed ? 'Deployment confirmed: ' + result.address + '. Runtime hash: ' + result.runtimeHash + '. The market is not switched to this contract.' : 'Deployment failed. Check wallet activity.'); saved() } catch (error) { say(error.message) } finally { busy = false; controls() } }
 fetch('/assets/data/trixmoji-escrow-replacement-artifact.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw Error('Replacement artifact unavailable.'); return r.json() }).then(function (data) {
  if (data.version !== 'trixmoji-escrow-replacement-experimental-v1' || data.chainId !== 1 || !same(data.creator, creator) || !same(data.verifier, verifier) || !same(data.bytecodeHash, hash) || !same(ethers.utils.keccak256(data.bytecode), hash)) throw Error('Replacement artifact does not match the pinned build.')
  artifact = data; el('details').textContent = 'Creator: ' + creator + '\nVerifier: ' + verifier + '\nCreation bytecode hash: ' + hash; say('Artifact loaded. Connect a deploying wallet.'); controls()
 }).catch(function (error) { say(error.message) })
})()
