(function (root) {
 'use strict'
 var active = null
 function setActive(value) {
  active = value
  if (root.dispatchEvent && typeof Event !== 'undefined') root.dispatchEvent(new Event('market-wallet-change'))
  if (value.provider.on) {
   var provider = value.provider
   var clear = function () { if (active && active.provider === provider) { active = null; if (root.dispatchEvent && typeof Event !== 'undefined') root.dispatchEvent(new Event('market-wallet-change')) } }
   provider.on('accountsChanged', clear); provider.on('chainChanged', clear); provider.on('disconnect', clear)
  }
  return value
 }
 async function connect(host, report) {
  report = report || function () {}
  var settings = await fetch('/api/ethscriptions', { cache: 'no-store', signal: AbortSignal.timeout(10000) }).then(function (response) {
   if (!response.ok) throw new Error('Wallet options unavailable')
   return response.json()
  }).catch(function () { return {} })
  EthscriptionCheckout.configure(settings.walletConnectProjectId || '')
  report('Choose your wallet below.')
   var provider = await EthscriptionCheckout.choose(host, report)
   await EthscriptionCheckout.ensureChain(provider)
   var accounts = await provider.request({ method: 'eth_accounts' })
   if (!accounts || !accounts[0]) throw Error('No Ethereum account connected.')
   await EthscriptionCheckout.identity(provider, accounts[0])
   return setActive({ provider: provider, address: accounts[0] })
 }
 var api = { connect: connect, current: function () { return active } }
 if (typeof module !== 'undefined' && module.exports) module.exports = api
 else root.MarketWalletConnector = api
 var host = typeof document !== 'undefined' && document.getElementById('marketWalletConnect')
 if (!host) return
 var button = document.createElement('button'), choices = document.createElement('div'), status = document.createElement('p')
 button.type = 'button'; button.textContent = 'CONNECT ETHEREUM WALLET'
 status.setAttribute('role', 'status'); status.textContent = 'Connect your Ethereum wallet to view your collection and manage your listings.'
 host.append(button, choices, status)
 button.onclick = async function () {
  button.disabled = true; choices.textContent = ''
  try {
   var result = await connect(choices, function (message) { status.textContent = message })
   status.textContent = 'Connected: ' + result.address + ' · Ethereum mainnet.'
   if (result.provider.on) result.provider.on('accountsChanged', function () { status.textContent = 'Wallet account changed. Connect again to confirm the current address.' })
  } catch (error) { status.textContent = error && error.message ? error.message : 'Wallet connection failed.' }
  finally { button.disabled = false }
 }
})(typeof window !== 'undefined' ? window : globalThis)
