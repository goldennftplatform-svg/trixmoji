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
   return setActive({ provider: provider, address: accounts[0], walletInfo: typeof EthscriptionCheckout.walletInfo === 'function' ? EthscriptionCheckout.walletInfo(provider) : null })
 }
 var api = { connect: connect, current: function () { return active } }
 if (typeof module !== 'undefined' && module.exports) module.exports = api
 else root.MarketWalletConnector = api
 var host = typeof document !== 'undefined' && document.getElementById('marketWalletConnect')
 if (!host) return
 var button = document.createElement('button'), choices = document.createElement('div'), status = document.createElement('p'), menu = document.createElement('div'), heading = document.createElement('strong'), address = document.createElement('p')
 button.type = 'button'; button.textContent = '◉  CONNECT WALLET'; button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-haspopup', 'true')
 menu.className = 'wallet-menu'; menu.hidden = true; menu.setAttribute('aria-label', 'Connected wallet')
 heading.className = 'wallet-menu-heading'; heading.textContent = 'CONNECTED WALLET · ETHEREUM'; address.className = 'wallet-menu-address'; menu.append(heading, address)
 function closeMenu() { menu.hidden = true; button.setAttribute('aria-expanded', 'false') }
 function menuButton(label, callback) { var item = document.createElement('button'); item.type = 'button'; item.textContent = label; item.onclick = function () { closeMenu(); callback() }; menu.appendChild(item) }
 menuButton('◈  MY WALLET', function () { var tab = document.getElementById('myWallet'); if (tab) tab.click() })
 menuButton('▣  MY ESCROW', function () { var tab = document.getElementById('myEscrow'); if (tab) tab.click() })
 menuButton('⇄  CHANGE WALLET', function () { openWalletChooser() })
 menuButton('↪  DISCONNECT', function () { active = null; if (root.dispatchEvent && typeof Event !== 'undefined') root.dispatchEvent(new Event('market-wallet-change')); status.textContent = 'Wallet disconnected from this page.' })
 status.setAttribute('role', 'status'); status.textContent = ''
 host.append(button, menu, choices, status)
 if (root.addEventListener) root.addEventListener('market-wallet-change', function () { if (!active) { closeMenu(); button.textContent = '◉  CONNECT WALLET'; button.title = ''; status.textContent = 'Wallet changed. Connect again.' } })
 if (document.addEventListener) document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !menu.hidden) { closeMenu(); button.focus() } })
 if (document.addEventListener) document.addEventListener('click', function (event) { if (!host.contains(event.target)) closeMenu() })
 async function openWalletChooser() {
   button.disabled = true; choices.textContent = ''
   try {
    var result = await connect(choices, function (message) { status.textContent = message })
    button.textContent = '◉  ' + result.address.slice(0, 6) + '…' + result.address.slice(-4) + '  ▾'; button.title = 'Connected: ' + result.address; address.textContent = result.address
    status.textContent = ''
   } catch (error) { status.textContent = error && error.message ? error.message : 'Wallet connection failed.' }
   finally { button.disabled = false }
 }
 button.onclick = function () { if (!active) return openWalletChooser(); menu.hidden = !menu.hidden; button.setAttribute('aria-expanded', String(!menu.hidden)) }
})(typeof window !== 'undefined' ? window : globalThis)
