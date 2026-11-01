/* DOSWAPZ Mail Gate client — pay SOL / ETH / BTC, sign, pass the gate. */
(function () {
  'use strict'

  var SOL_WEB3 = 'https://cdn.jsdelivr.net/npm/@solana/web3.js@1.91.0/lib/index.iife.min.js'
  var ETHERS = 'https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js'
  var connected = null
  var quote = null
  var ticket = null
  var prepared = null
  var busy = false

  function $(id) { return document.getElementById(id) }
  function set(id, t) { var el = $(id); if (el) el.textContent = t }
  function show(id, t, kind) {
    var el = $(id)
    if (!el) return
    el.textContent = t || ''
    el.style.color = kind === 'bad' ? '#ff6666' : kind === 'ok' ? '#66ff99' : '#ffff00'
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script')
      s.src = src
      s.onload = resolve
      s.onerror = function () { reject(new Error('script fail ' + src)) }
      document.head.appendChild(s)
    })
  }
  async function api(action, data) {
    var r = await fetch('/api/mail-gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: action }, data || {}))
    })
    var j = await r.json().catch(function () { return {} })
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status))
    return j
  }
  function chain() {
    var el = $('chain')
    return el ? el.value : 'sol'
  }
  function short(a) {
    a = String(a || '')
    return a.length < 16 ? a : a.slice(0, 6) + '…' + a.slice(-6)
  }
  async function disconnect() {
    try {
      if (connected && connected.chain === 'sol' && connected.provider && connected.provider.disconnect) {
        await connected.provider.disconnect()
      }
    } catch (e) {}
    try {
      if (window.ethereum && window.ethereum.request) {
        window.ethereum.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }).catch(function () {})
      }
    } catch (e2) {}
    connected = null
    var chip = $('walletChip')
    if (chip) { chip.textContent = 'WALLET: OFF'; chip.className = 'pill dim' }
  }

  async function health() {
    try {
      var d = await fetch('/api/mail-gate', { cache: 'no-store' }).then(function (r) { return r.json() })
      set('health',
        (d.ok ? 'GATE LIVE' : 'GATE DOWN') +
        ' * PAY TO PASS * ' +
        (d.sendEnabled ? 'SMTP ON' : 'FILE ON PAY')
      )
      if (d.treasuries) {
        set('addrSol', d.treasuries.sol)
        set('addrEth', d.treasuries.eth)
        set('addrBtc', d.treasuries.btc)
      }
      if (d.fees) {
        if (d.fees.sol) set('feeSol', d.fees.sol.amountLabel)
        if (d.fees.eth) set('feeEth', d.fees.eth.amountLabel)
        if (d.fees.btc) set('feeBtc', d.fees.btc.amountLabel)
      }
      var sendPill = $('sendPill')
      if (sendPill) {
        sendPill.textContent = d.sendEnabled ? 'SMTP ON' : 'PAY TO PASS'
        sendPill.className = 'pill hot'
      }
    } catch (e) {
      set('health', 'GATE API NOT DEPLOYED YET')
    }
  }

  async function refreshQuote() {
    quote = await api('quote', { chain: chain() })
    set('quoteLine', 'PAY ' + quote.amountLabel + '  →  ' + quote.to)
    var btcRow = $('btcRow')
    if (btcRow) btcRow.style.display = chain() === 'btc' ? 'block' : 'none'
  }

  async function connect() {
    var c = chain()
    if (c === 'btc') {
      connected = { chain: 'btc', address: 'btc-manual' }
      $('walletChip').className = 'pill hot'
      $('walletChip').textContent = 'BTC: send then paste txid'
      return
    }
    if (c === 'sol') {
      if (!window.solanaWeb3) await loadScript(SOL_WEB3)
      var w = window.solana || window.solflare
      if (!w) throw new Error('Install Phantom or Solflare')
      var resp = await w.connect()
      var pk = (resp && resp.publicKey ? resp.publicKey : w.publicKey).toString()
      connected = { chain: 'sol', address: pk, provider: w }
    } else {
      if (typeof ethers === 'undefined') await loadScript(ETHERS)
      if (!window.ethereum) throw new Error('Install MetaMask or Coinbase Wallet')
      var acc = await window.ethereum.request({ method: 'eth_requestAccounts' })
      var chainId = await window.ethereum.request({ method: 'eth_chainId' })
      if (chainId !== '0x1') throw new Error('Switch to Ethereum mainnet')
      connected = { chain: 'eth', address: acc[0], provider: window.ethereum }
    }
    $('walletChip').className = 'pill hot'
    $('walletChip').textContent = 'WALLET: ' + short(connected.address)
  }

  async function paySol() {
    if (!window.solanaWeb3) await loadScript(SOL_WEB3)
    var w = connected.provider
    var from = new solanaWeb3.PublicKey(connected.address)
    var to = new solanaWeb3.PublicKey(quote.to)
    var conn = new solanaWeb3.Connection(location.origin + '/api/solana-rpc', 'confirmed')
    var tx = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports: Number(quote.amountNative)
      })
    )
    tx.feePayer = from
    var bh = await conn.getLatestBlockhash()
    tx.recentBlockhash = bh.blockhash
    var sig
    if (typeof w.signAndSendTransaction === 'function') {
      var out = await w.signAndSendTransaction(tx)
      sig = typeof out === 'string' ? out : out.signature
    } else {
      var signed = await w.signTransaction(tx)
      sig = await conn.sendRawTransaction(signed.serialize())
    }
    await conn.confirmTransaction(sig, 'confirmed')
    return sig
  }

  async function payEth() {
    if (typeof ethers === 'undefined') await loadScript(ETHERS)
    var provider = new ethers.providers.Web3Provider(window.ethereum)
    var net = await provider.getNetwork()
    if (net.chainId !== 1) throw new Error('Switch to Ethereum mainnet')
    var signer = provider.getSigner()
    var tx = await signer.sendTransaction({
      to: quote.to,
      value: ethers.BigNumber.from(String(quote.amountNative))
    })
    await tx.wait(1)
    return tx.hash
  }

  async function pay() {
    if (!quote) await refreshQuote()
    var c = chain()
    var txid
    if (c === 'btc') {
      txid = ($('btcTxid') && $('btcTxid').value || '').trim()
      if (!txid) throw new Error('Send BTC to the published address, then paste the txid')
    } else {
      if (!connected || connected.chain !== c) await connect()
      txid = c === 'sol' ? await paySol() : await payEth()
    }
    var from = connected && connected.address && connected.address !== 'btc-manual' ? connected.address : ''
    var out = await api('pay', { chain: c, txid: txid, from: from })
    ticket = out.ticket
    show('payStatus', 'PAID * ' + short(txid), 'ok')
    set('payTxid', txid)
    return ticket
  }

  async function signSol(payload) {
    var bytes = new TextEncoder().encode(payload)
    var w = connected.provider
    var out = await w.signMessage(bytes, 'utf8')
    var sig = out && out.signature ? out.signature : out
    if (sig instanceof Uint8Array) {
      var s = ''
      for (var i = 0; i < sig.length; i++) s += String.fromCharCode(sig[i])
      return btoa(s)
    }
    return sig
  }

  async function signEth(payload) {
    if (typeof ethers === 'undefined') await loadScript(ETHERS)
    var provider = new ethers.providers.Web3Provider(window.ethereum)
    var signer = provider.getSigner()
    return signer.signMessage(payload)
  }

  async function passGate() {
    if (!ticket) throw new Error('Pay the gate fee first')
    var c = chain()
    if (c !== 'btc' && (!connected || connected.chain !== c)) await connect()
    var prep = await api('prepare', {
      domain: 'doswapz.com',
      from: $('from').value,
      to: $('to').value,
      subject: $('subject').value,
      body: $('body').value,
      chain: ticket.chain,
      payTxid: ticket.txid
    })
    prepared = prep
    $('payload').textContent = prep.payload
    var walletType = c === 'eth' ? 'ethereum' : c
    var signature
    var walletAddress = connected && connected.address !== 'btc-manual' ? connected.address : ticket.from || ticket.txid
    if (c === 'sol') signature = await signSol(prep.payload)
    else if (c === 'eth') signature = await signEth(prep.payload)
    else signature = 'btc:' + ticket.txid
    var auth = await api('authorize', {
      messageId: prep.messageId,
      walletType: walletType,
      walletAddress: walletAddress,
      signature: signature,
      payload: prep.payload,
      payloadHash: prep.payloadHash,
      timestamp: prep.timestamp,
      payTxid: ticket.txid,
      from: $('from').value,
      to: $('to').value,
      subject: $('subject').value,
      body: $('body').value
    })
    var sent = await api('send', { messageId: auth.messageId })
    show('gateStatus', 'GATE OPEN * ' + (sent.note || sent.mode) + ' * ' + auth.messageId, 'ok')
    await disconnect()
    return sent
  }

  function bind() {
    var ch = $('chain')
    if (ch) ch.onchange = function () {
      disconnect()
      refreshQuote().catch(function (e) { show('payStatus', e.message, 'bad') })
    }
    $('btnConnect').onclick = function () {
      connect().then(function () { show('payStatus', 'connected', 'ok') }).catch(function (e) { show('payStatus', e.message, 'bad') })
    }
    $('btnPay').onclick = function () {
      if (busy) return
      busy = true
      show('payStatus', 'sending fee…', 'warn')
      pay().then(function () { busy = false }).catch(function (e) {
        busy = false
        show('payStatus', e.message, 'bad')
      })
    }
    $('btnPass').onclick = function () {
      if (busy) return
      busy = true
      show('gateStatus', 'signing…', 'warn')
      passGate().then(function () { busy = false }).catch(function (e) {
        busy = false
        show('gateStatus', e.message, 'bad')
      })
    }
    $('btnCopySol').onclick = function () { navigator.clipboard.writeText($('addrSol').textContent) }
    $('btnCopyEth').onclick = function () { navigator.clipboard.writeText($('addrEth').textContent) }
    $('btnCopyBtc').onclick = function () { navigator.clipboard.writeText($('addrBtc').textContent) }
  }

  document.addEventListener('DOMContentLoaded', function () {
    bind()
    health()
    refreshQuote().catch(function () {})
  })
})()
