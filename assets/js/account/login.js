/**
 * DOSWAPZ account login. Wallet signature or email.
 * The signature is a login only. It does not send a transaction.
 */
(function () {
  var statusEl = document.getElementById('status')
  var sessionBox = document.getElementById('sessionBox')
  var gateBox = document.getElementById('gateBox')
  var sessionText = document.getElementById('sessionText')
  var walletPanel = document.getElementById('walletPanel')
  var emailPanel = document.getElementById('emailPanel')
  var signPreview = document.getElementById('signPreview')
  var signBtn = document.getElementById('signBtn')
  var pending = null

  function show(msg) {
    if (statusEl) statusEl.textContent = msg || ''
  }

  function boxesOk() {
    var age = document.getElementById('age18')
    var terms = document.getElementById('acceptTerms')
    return !!(age && age.checked && terms && terms.checked)
  }

  function attestation() {
    if (!boxesOk()) {
      show('Check both boxes. You must be 18 or older and accept the terms.')
      return null
    }
    return { acceptTerms: true, age18: true }
  }

  async function api(method, body) {
    var opts = { method: method, credentials: 'same-origin', headers: {} }
    if (body) {
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
    var res = await fetch('/api/account', opts)
    var data = {}
    try {
      data = await res.json()
    } catch (e) {
      data = {}
    }
    if (!res.ok || data.ok === false) {
      var err = new Error(data.error || 'Request failed')
      err.status = res.status
      throw err
    }
    return data
  }

  function paintSession(user) {
    if (!sessionBox || !gateBox) return
    if (!user) {
      sessionBox.hidden = true
      gateBox.hidden = false
      if (sessionText) sessionText.textContent = ''
      return
    }
    var line = 'IN * ' + user.method
    if (user.email) line += ' * ' + user.email
    if (user.wallets && user.wallets[0]) line += ' * ' + user.wallets[0].chain + ' ' + user.wallets[0].address
    if (sessionText) sessionText.textContent = line
    sessionBox.hidden = false
    gateBox.hidden = true
  }

  function solanaProvider() {
    var phantom = window.phantom && window.phantom.solana
    if (phantom && typeof phantom.signMessage === 'function') return phantom
    if (window.solana && typeof window.solana.signMessage === 'function') return window.solana
    return null
  }

  function bytesToB64(sig) {
    var u8 = sig instanceof Uint8Array ? sig : new Uint8Array(sig)
    var s = ''
    for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
    return btoa(s)
  }

  function showChoice(which) {
    if (walletPanel) walletPanel.hidden = which !== 'wallet'
    if (emailPanel) emailPanel.hidden = which !== 'email'
    pending = null
    if (signPreview) {
      signPreview.textContent = ''
      signPreview.hidden = true
    }
    if (signBtn) signBtn.hidden = true
  }

  async function prepareWallet() {
    var gate = attestation()
    if (!gate) return
    var chainEl = document.getElementById('chain')
    var chain = chainEl ? chainEl.value : 'solana'
    show(chain === 'ethereum' ? 'Connecting Ethereum wallet...' : 'Connecting Solana wallet...')
    var address = ''
    if (chain === 'solana') {
      var provider = solanaProvider()
      if (!provider) {
        show('No Solana wallet found. Install Phantom or another wallet that can sign a message.')
        return
      }
      var resp = await provider.connect()
      address = resp && resp.publicKey ? resp.publicKey.toString() : ''
    } else {
      if (!window.ethereum || typeof window.ethereum.request !== 'function') {
        show('No Ethereum wallet found. Install a wallet that can sign a message.')
        return
      }
      var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      address = accounts && accounts[0] ? accounts[0] : ''
    }
    if (!address) {
      show('The wallet did not return an address.')
      return
    }
    var ch = await api('POST', Object.assign({ action: 'challenge', chain: chain, address: address }, gate))
    pending = { chain: chain, address: address, challengeId: ch.challengeId, message: ch.message }
    if (signPreview) {
      signPreview.textContent = ch.message
      signPreview.hidden = false
    }
    if (signBtn) signBtn.hidden = false
    show('Read the login message. Then sign it. Reject anything that is a transaction or a token approval.')
  }

  async function signWallet() {
    if (!pending) {
      show('Prepare the login first.')
      return
    }
    var gate = attestation()
    if (!gate) return
    show('Waiting for your wallet signature. This is a login only.')
    var signature = ''
    if (pending.chain === 'solana') {
      var provider = solanaProvider()
      if (!provider) throw new Error('Solana wallet disconnected.')
      var signed = await provider.signMessage(new TextEncoder().encode(pending.message), 'utf8')
      var sig = signed && signed.signature ? signed.signature : signed
      signature = typeof sig === 'string' ? sig : bytesToB64(sig)
    } else {
      signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [pending.message, pending.address]
      })
    }
    var out = await api(
      'POST',
      Object.assign(
        { action: 'verify', challengeId: pending.challengeId, signature: signature },
        gate
      )
    )
    pending = null
    if (signPreview) {
      signPreview.textContent = ''
      signPreview.hidden = true
    }
    if (signBtn) signBtn.hidden = true
    paintSession(out.user)
    show('Logged in. No coins moved.')
  }

  async function email(action) {
    var gate = attestation()
    if (!gate) return
    var emailEl = document.getElementById(action === 'email-register' ? 'regEmail' : 'loginEmail')
    var passEl = document.getElementById(action === 'email-register' ? 'regPass' : 'loginPass')
    var email = emailEl ? emailEl.value : ''
    var password = passEl ? passEl.value : ''
    show(action === 'email-register' ? 'Creating the account...' : 'Checking the account...')
    var out = await api('POST', Object.assign({ action: action, email: email, password: password }, gate))
    if (passEl) passEl.value = ''
    paintSession(out.user)
    show(action === 'email-register' ? 'Account created. Password stored only as a hash.' : 'Logged in.')
  }

  document.getElementById('pickWallet').addEventListener('click', function () {
    showChoice('wallet')
    show('Wallet login signs a message. It does not send coins.')
  })
  document.getElementById('pickEmail').addEventListener('click', function () {
    showChoice('email')
    show('Email is the account name. The password is stored only as a slow hash.')
  })
  document.getElementById('prepareBtn').addEventListener('click', function () {
    prepareWallet().catch(function (e) {
      show(e.message || 'Wallet login failed.')
    })
  })
  signBtn.addEventListener('click', function () {
    signWallet().catch(function (e) {
      show(e.message || 'Signature failed.')
    })
  })
  document.getElementById('registerBtn').addEventListener('click', function () {
    email('email-register').catch(function (e) {
      show(e.message || 'Could not register.')
    })
  })
  document.getElementById('loginBtn').addEventListener('click', function () {
    email('email-login').catch(function (e) {
      show(e.message || 'Could not log in.')
    })
  })
  document.getElementById('logoutBtn').addEventListener('click', function () {
    api('POST', { action: 'logout' })
      .then(function () {
        paintSession(null)
        show('Signed out.')
      })
      .catch(function (e) {
        show(e.message || 'Could not sign out.')
      })
  })
  document.getElementById('deleteBtn').addEventListener('click', function () {
    if (!window.confirm('Delete this off-chain account on this site? Chain history stays. This cannot be undone here.')) return
    api('POST', { action: 'delete', confirm: 'DELETE' })
      .then(function () {
        paintSession(null)
        show('Off-chain account deleted.')
      })
      .catch(function (e) {
        show(e.message || 'Could not delete the account.')
      })
  })

  api('GET')
    .then(function (data) {
      if (!data.configured) show('Account login is not armed on this host.')
      paintSession(data.user)
    })
    .catch(function () {
      show('Account service did not answer.')
    })
})()
