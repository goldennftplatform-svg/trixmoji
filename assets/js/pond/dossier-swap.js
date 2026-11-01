/* DOSWAPZ Pond Scum - OLD REWARDS-POOL RAILS dossier swap
 * Jupiter Metis Swap API v1 + Pond0x Partner Referral Fee Vaults only.
 * Fees go into Pond rewards-pool vaults so protocol can index swaps (manifest/boost/stats).
 * Real wallet txs only. Manifest lag 3-5 min; Pond filters still apply.
 * NEVER uses Ultra / v2-only / zero-fee generic Jupiter paths.
 *
 * ACCESS: OLD RAILS = Pond community only (server /api/pond-community).
 * Regular DOSWAPZ Jupiter (/classic/pages/doswapz/swap.html) stays open to any Solana wallet.
 */
(function () {
  'use strict';

  var cfg = window.POND_CONFIG || {};
  var SOL = 'So11111111111111111111111111111111111111112';

  var walletProvider = null;
  var connectedPubkey = null;
  var lastQuote = null;
  var quoteSeq = 0;
  var quoteTimer = null;
  var swapBusy = false;
  var autoRunning = false;
  var autoCancel = false;

  /* Community gate state for old rails */
  var communityAllowed = false;
  var communityChecking = false;
  var communityReason = '';
  var communityMessage = '';

  function $(id) {
    return document.getElementById(id);
  }

  function shortAddr(addr) {
    if (!addr || addr.length < 10) return addr || '';
    return addr.slice(0, 4) + '...' + addr.slice(-4);
  }

  function vaults() {
    return cfg.pondFeeVaults || {};
  }

  function tokens() {
    return Array.isArray(cfg.dossierTokens) ? cfg.dossierTokens : [];
  }

  function feeBps() {
    var n = Number(cfg.platformFeeBps);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 100;
  }

  function slipBps() {
    var el = $('dsSlippage');
    if (el) {
      var v = parseInt(el.value, 10);
      if (Number.isFinite(v) && v >= 0) return v;
    }
    var n = Number(cfg.slippageBps);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 100;
  }

  function rpcUrl() {
    var el = $('dsRpc');
    var custom = el && el.value ? el.value.trim() : '';
    if (custom && /^https?:\/\//i.test(custom)) return custom;
    return cfg.defaultRpc || 'https://api.mainnet-beta.solana.com';
  }

  function rpcFallbacks() {
    var primary = rpcUrl();
    var list = [primary];
    var extras = [
      'https://api.mainnet-beta.solana.com',
      'https://solana-rpc.publicnode.com',
      'https://rpc.ankr.com/solana'
    ];
    extras.forEach(function (u) {
      if (list.indexOf(u) === -1) list.push(u);
    });
    return list;
  }

  function jupiterBases() {
    if (Array.isArray(cfg.jupiterBases) && cfg.jupiterBases.length) return cfg.jupiterBases;
    return ['https://lite-api.jup.ag/swap/v1', 'https://api.jup.ag/swap/v1'];
  }

  function detectWallet() {
    if (window.solana && window.solana.isPhantom) return window.solana;
    if (window.solflare && window.solflare.isSolflare) return window.solflare;
    if (window.solana) return window.solana;
    return null;
  }

  function getConnection(url) {
    if (!window.solanaWeb3) return null;
    return new solanaWeb3.Connection(url || rpcUrl(), 'confirmed');
  }

  function errText(err) {
    if (!err) return 'unknown error';
    if (typeof err === 'string') return err;
    var parts = [];
    if (err.message) parts.push(err.message);
    if (err.logs && err.logs.length) {
      parts.push(err.logs.slice(-3).join(' | '));
    }
    if (err.toString && !err.message) parts.push(String(err));
    var s = parts.join(' — ') || 'unknown error';
    if (s.length > 280) s = s.slice(0, 277) + '...';
    return s;
  }

  function findToken(mint) {
    var list = tokens();
    for (var i = 0; i < list.length; i++) {
      if (list[i].mint === mint) return list[i];
    }
    return null;
  }

  function feeVaultForMint(mint) {
    var map = vaults();
    return map[mint] || null;
  }

  /** Hard allowlist: feeAccount must be a known Pond rewards-pool vault */
  function isPondRewardsVault(addr) {
    if (!addr || typeof addr !== 'string') return false;
    var map = vaults();
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      if (map[keys[i]] === addr) return true;
    }
    return false;
  }

  function assertPondFeeAccount(feeAccount) {
    if (!isPondRewardsVault(feeAccount)) {
      throw new Error(
        'BLOCKED: feeAccount is not a Pond rewards-pool vault — refusing swap (would not count on protocol)'
      );
    }
    var bps = feeBps();
    if (!bps || bps < 1) {
      throw new Error(
        'BLOCKED: platformFeeBps must be > 0 for Pond rewards-pool rails'
      );
    }
    return true;
  }

  function setStatus(msg, color) {
    var el = $('dsStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.color = color || '#ffff00';
  }

  function jupiterPath() {
    return cfg.jupiterSwapPath || '/classic/pages/doswapz/swap.html';
  }

  function communityGateEnabled() {
    /* Always on for old rails — safest for users + site (not a client opt-out) */
    return true;
  }

  function autoMaxAllowed() {
    var n = Number(cfg.oldRailsAutoMax);
    if (!Number.isFinite(n) || n < 1) return 5;
    return Math.min(20, Math.floor(n));
  }

  function autoMinWaitSec() {
    var n = Number(cfg.oldRailsAutoMinWaitSec);
    if (!Number.isFinite(n) || n < 8) return 12;
    return Math.floor(n);
  }

  function setGateBanner(allowed, message) {
    var el = $('dsCommunityGate');
    if (!el) return;
    if (!communityGateEnabled()) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    if (allowed) {
      el.style.borderColor = '#00aa00';
      el.style.color = '#b8ffb8';
      el.innerHTML =
        '<strong>OLD RAILS UNLOCKED</strong><br>' +
        (message || 'Wallet authorized for old rewards-pool rails.') +
        ' Regular Jupiter remains open to any Solana wallet.';
    } else {
      el.style.borderColor = '#ff4466';
      el.style.color = '#ffb3c0';
      el.innerHTML =
        '<strong>OLD RAILS LOCKED — ACTIVATED POND RIG REQUIRED</strong><br>' +
        (message ||
          'Wallet must appear on the Dune activated-rigs list (synced to DOSWAPZ).') +
        ' Anyone with Solana can still swap on ' +
        '<a href="' +
        jupiterPath() +
        '" style="color:#ffff00;">regular DOSWAPZ Jupiter</a>. ' +
        '<a href="' +
        (cfg.docsCommunityRules || '/docs/community-swap-rules.html') +
        '" style="color:#ffff00;">Rules</a>';
    }
  }

  function setControlsLocked(locked) {
    var ids = [
      'dsFromToken',
      'dsToToken',
      'dsFromAmount',
      'dsSlippage',
      'dsFlipBtn',
      'dsSwapBtn',
      'dsAutoBtn'
    ];
    ids.forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = !!locked;
    });
  }

  async function checkCommunityAccess(wallet) {
    if (!communityGateEnabled()) {
      communityAllowed = true;
      communityReason = 'gate_disabled';
      communityMessage = 'Community gate disabled in config.';
      setGateBanner(true, communityMessage);
      setControlsLocked(false);
      return true;
    }
    if (!wallet) {
      communityAllowed = false;
      communityReason = 'no_wallet';
      communityMessage = 'Connect a wallet to check Pond community access.';
      setGateBanner(false, communityMessage);
      setControlsLocked(true);
      return false;
    }

    communityChecking = true;
    setStatus('CHECKING POND COMMUNITY ACCESS (old rails)...', '#ffff00');
    try {
      var url =
        (cfg.communityProxy || '/api/pond-community') +
        '?wallet=' +
        encodeURIComponent(wallet);
      var res = await fetch(url, { cache: 'no-store' });
      var data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }
      communityAllowed = !!(data && data.allowed);
      communityReason = (data && data.reason) || (communityAllowed ? 'ok' : 'denied');
      communityMessage =
        (data && data.message) ||
        (communityAllowed
          ? 'Pond community verified.'
          : 'Not recognized as Pond community for old rails.');
      setGateBanner(communityAllowed, communityMessage);
      setControlsLocked(!communityAllowed);
      if (communityAllowed) {
        setStatus(
          'POND COMMUNITY OK — old rails unlocked for ' + shortAddr(wallet),
          '#00ff00'
        );
      } else {
        setStatus(
          'OLD RAILS LOCKED — use regular Jupiter (any Solana) or a Pond community wallet',
          '#ff5555'
        );
        lastQuote = null;
        var outEl = $('dsToAmount');
        if (outEl) outEl.value = '';
      }
      return communityAllowed;
    } catch (err) {
      communityAllowed = false;
      communityReason = 'check_failed';
      communityMessage =
        'Could not verify Pond community. Old rails locked. Use regular Jupiter swap.';
      setGateBanner(false, communityMessage);
      setControlsLocked(true);
      setStatus(communityMessage, '#ff5555');
      return false;
    } finally {
      communityChecking = false;
      updateWalletUi();
    }
  }

  function requireCommunityAccess(actionLabel) {
    if (!communityGateEnabled()) return true;
    if (communityAllowed) return true;
    setStatus(
      'BLOCKED: ' +
        (actionLabel || 'Old rails') +
        ' requires Pond community wallet. Open regular Jupiter for any Solana wallet.',
      '#ff5555'
    );
    setGateBanner(false, communityMessage || 'Pond community only on old rails.');
    return false;
  }

  function setRoute(msg) {
    var el = $('dsRoute');
    if (el) el.textContent = msg;
  }

  function setVaultLine(msg) {
    var el = $('dsVaultLine');
    if (el) el.textContent = msg;
  }

  function populateTokenSelects() {
    var list = tokens();
    var fromSel = $('dsFromToken');
    var toSel = $('dsToToken');
    if (!fromSel || !toSel) return;

    var fromVal = fromSel.value;
    var toVal = toSel.value;

    fromSel.innerHTML = '';
    toSel.innerHTML = '';

    list.forEach(function (t) {
      var o1 = document.createElement('option');
      o1.value = t.mint;
      o1.textContent = t.symbol;
      fromSel.appendChild(o1);

      var o2 = document.createElement('option');
      o2.value = t.mint;
      o2.textContent = t.symbol;
      toSel.appendChild(o2);
    });

    if (fromVal && findToken(fromVal)) fromSel.value = fromVal;
    else if (list[0]) fromSel.value = list[0].mint;

    if (toVal && findToken(toVal) && toVal !== fromSel.value) toSel.value = toVal;
    else {
      var pick = list.find(function (t) {
        return t.mint !== fromSel.value;
      });
      if (pick) toSel.value = pick.mint;
    }

    updateVaultDisplay();
  }

  function updateVaultDisplay() {
    var fromMint = $('dsFromToken') ? $('dsFromToken').value : '';
    var tok = findToken(fromMint);
    var vault = feeVaultForMint(fromMint);
    if (!tok) {
      setVaultLine('SELECT FROM TOKEN - need Pond fee vault on input mint');
      return;
    }
    if (!vault) {
      setVaultLine(
        tok.symbol + ' has no Pond fee vault mapped - swap will not use old rails correctly'
      );
      return;
    }
    setVaultLine(
      'POND REWARDS-POOL VAULT (' +
        tok.symbol +
        '): ' +
        shortAddr(vault) +
        ' * fee ' +
        (feeBps() / 100).toFixed(2) +
        '% * old rails (protocol-count path)'
    );
  }

  function toAtomic(amount, decimals) {
    var n = Number(amount);
    if (!isFinite(n) || n <= 0) return null;
    var factor = Math.pow(10, decimals);
    var raw = Math.floor(n * factor + 1e-9);
    if (raw <= 0) return null;
    return String(raw);
  }

  function formatAtomic(raw, decimals) {
    var n = Number(raw);
    if (!isFinite(n)) return '';
    var val = n / Math.pow(10, decimals);
    return val.toLocaleString(undefined, {
      maximumFractionDigits: Math.min(decimals, 6),
      minimumFractionDigits: 0
    });
  }

  function routeLabels(routePlan) {
    if (!routePlan || !routePlan.length) return 'Jupiter Metis';
    var seen = {};
    var labels = [];
    routePlan.forEach(function (step) {
      var info = step.swapInfo || step;
      var label = info.label || info.ammKey || 'DEX';
      if (!seen[label]) {
        seen[label] = true;
        labels.push(label);
      }
    });
    return labels.join(' -> ') || 'Jupiter Metis';
  }

  async function fetchJsonWithFallback(path, opts) {
    var bases = jupiterBases();
    var lastErr = null;
    for (var i = 0; i < bases.length; i++) {
      try {
        var res = await fetch(bases[i] + path, opts);
        if (!res.ok) {
          var txt = await res.text();
          throw new Error('HTTP ' + res.status + ': ' + txt.slice(0, 220));
        }
        return await res.json();
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Jupiter Metis request failed');
  }

  async function fetchQuote(inputMint, outputMint, amount) {
    var qs = new URLSearchParams({
      inputMint: inputMint,
      outputMint: outputMint,
      amount: amount,
      slippageBps: String(slipBps()),
      platformFeeBps: String(feeBps())
    });
    return fetchJsonWithFallback('/quote?' + qs.toString());
  }

  async function buildSwapTx(quote, userPublicKey, feeAccount) {
    /* SAFETY: never build a tx that sends fees off Pond rewards-pool vaults */
    assertPondFeeAccount(feeAccount);
    return fetchJsonWithFallback('/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
        feeAccount: feeAccount
      })
    });
  }

  async function fetchBalance(pubkey, mint, decimals) {
    var conn = getConnection();
    if (!conn || !window.solanaWeb3) return null;
    try {
      if (mint === SOL) {
        var lamports = await conn.getBalance(new solanaWeb3.PublicKey(pubkey));
        return lamports / 1e9;
      }
      var accounts = await conn.getParsedTokenAccountsByOwner(
        new solanaWeb3.PublicKey(pubkey),
        { mint: new solanaWeb3.PublicKey(mint) }
      );
      if (!accounts.value.length) return 0;
      var total = 0;
      accounts.value.forEach(function (acc) {
        var info = acc.account.data.parsed && acc.account.data.parsed.info;
        if (info && info.tokenAmount && info.tokenAmount.uiAmount != null) {
          total += Number(info.tokenAmount.uiAmount);
        }
      });
      return total;
    } catch (e) {
      return null;
    }
  }

  async function refreshBalance() {
    var el = $('dsBalance');
    if (!el) return;
    if (!connectedPubkey) {
      el.textContent = '';
      return;
    }
    var fromMint = $('dsFromToken') && $('dsFromToken').value;
    var tok = findToken(fromMint);
    if (!tok) {
      el.textContent = '';
      return;
    }
    el.textContent = 'BALANCE - loading...';
    var bal = await fetchBalance(connectedPubkey, tok.mint, tok.decimals);
    if (bal == null) {
      el.textContent = 'BALANCE - unavailable (check RPC)';
      return;
    }
    el.textContent =
      'BALANCE - ' +
      tok.symbol +
      ': ' +
      bal.toLocaleString(undefined, { maximumFractionDigits: Math.min(tok.decimals, 6) });
  }

  function updateWalletUi() {
    var connectBtn = $('dsConnectBtn');
    var disconnectBtn = $('dsDisconnectBtn');
    var info = $('dsWalletInfo');
    var help = $('dsWalletHelp');
    var swapBtn = $('dsSwapBtn');

    if (connectedPubkey) {
      if (connectBtn) connectBtn.style.display = 'none';
      if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
      if (info) info.textContent = shortAddr(connectedPubkey) + ' connected (REAL TXS)';
      if (help) help.style.display = 'none';
    } else {
      if (connectBtn) connectBtn.style.display = 'inline-block';
      if (disconnectBtn) disconnectBtn.style.display = 'none';
      if (info) info.textContent = '';
      if (help) help.style.display = detectWallet() ? 'none' : 'block';
    }

    if (swapBtn) {
      var canSwap =
        connectedPubkey &&
        lastQuote &&
        !swapBusy &&
        !autoRunning &&
        (!communityGateEnabled() || communityAllowed) &&
        !communityChecking;
      swapBtn.disabled = !canSwap;
      if (communityGateEnabled() && connectedPubkey && !communityAllowed) {
        swapBtn.textContent = 'OLD RAILS LOCKED';
      } else {
        swapBtn.textContent = swapBusy ? 'SWAPPING...' : 'SWAP (OLD RAILS)';
      }
    }
  }

  /**
   * SAFETY: page-scoped session only. Never stores keys.
   * Auto-disconnect after every signed tx attempt (success or fail after wallet prompt).
   */
  async function disconnectWallet(silent, statusMsg) {
    var provider = walletProvider || detectWallet();
    if (provider && typeof provider.disconnect === 'function') {
      try {
        await provider.disconnect();
      } catch (e) {}
    }
    walletProvider = null;
    connectedPubkey = null;
    communityAllowed = false;
    communityReason = '';
    communityMessage = '';
    /* Drop live quote so a reconnect must re-quote with a fresh fee path */
    lastQuote = null;
    quoteSeq++;

    var out = $('dsToAmount');
    if (out) out.value = '';
    var bal = $('dsBalance');
    if (bal) bal.textContent = '';

    setGateBanner(false, 'Connect a Pond community wallet for old rails.');
    setControlsLocked(true);
    updateWalletUi();
    if (!silent) {
      setStatus(statusMsg || 'WALLET DISCONNECTED - reconnect for next swap', '#00cc00');
    } else if (statusMsg) {
      setStatus(statusMsg, '#00ff00');
    }
  }

  async function connectWallet(opts) {
    opts = opts || {};
    var onlyIfTrusted = !!opts.onlyIfTrusted;
    var provider = detectWallet();
    if (!provider) {
      setStatus('No Solana wallet detected. Install Phantom or Solflare.', '#ff5555');
      var help = $('dsWalletHelp');
      if (help) help.style.display = 'block';
      return false;
    }
    if (!window.solanaWeb3) {
      setStatus('solanaWeb3 not loaded - hard refresh (Ctrl+F5).', '#ff5555');
      return false;
    }
    try {
      setStatus(
        onlyIfTrusted ? 'RECONNECTING (TRUSTED)...' : 'CONNECTING WALLET (REAL TX)...',
        '#ffff00'
      );
      var resp = await provider.connect({ onlyIfTrusted: onlyIfTrusted });
      walletProvider = provider;
      var pk = resp && resp.publicKey
        ? resp.publicKey
        : provider.publicKey;
      if (!pk) throw new Error('No public key from wallet');
      connectedPubkey = pk.toString ? pk.toString() : String(pk);
      updateWalletUi();
      var ok = await checkCommunityAccess(connectedPubkey);
      if (!ok) {
        await refreshBalance();
        return true; /* connected, but old rails locked */
      }
      setStatus(
        'WALLET CONNECTED - wait for QUOTE READY then tap SWAP (OLD RAILS)',
        '#00ff00'
      );
      await refreshBalance();
      debouncedQuote();
      return true;
    } catch (err) {
      if (onlyIfTrusted) {
        setStatus(
          'Reconnect required - click CONNECT WALLET (REAL TX) for next swap',
          '#ffaa00'
        );
      } else {
        setStatus('Connect failed: ' + errText(err), '#ff5555');
      }
      return false;
    }
  }

  function flipTokens() {
    var fromSel = $('dsFromToken');
    var toSel = $('dsToToken');
    if (!fromSel || !toSel) return;
    var a = fromSel.value;
    fromSel.value = toSel.value;
    toSel.value = a;
    updateVaultDisplay();
    debouncedQuote();
    refreshBalance();
  }

  async function updateQuote() {
    updateVaultDisplay();
    var fromMint = $('dsFromToken') && $('dsFromToken').value;
    var toMint = $('dsToToken') && $('dsToToken').value;
    var amountEl = $('dsFromAmount');
    var amount = amountEl ? amountEl.value : '';
    var outEl = $('dsToAmount');
    var fromTok = findToken(fromMint);
    var toTok = findToken(toMint);
    var vault = feeVaultForMint(fromMint);

    if (communityGateEnabled() && connectedPubkey && !communityAllowed) {
      lastQuote = null;
      if (outEl) outEl.value = '';
      setRoute('OLD RAILS LOCKED — Pond community only');
      updateWalletUi();
      return;
    }

    if (!fromTok || !toTok) {
      lastQuote = null;
      if (outEl) outEl.value = '';
      setRoute('SELECT TOKENS WITH POND FEE VAULTS');
      updateWalletUi();
      return;
    }

    if (fromMint === toMint) {
      lastQuote = null;
      if (outEl) outEl.value = '';
      setStatus('PICK TWO DIFFERENT TOKENS', '#ff5555');
      updateWalletUi();
      return;
    }

    if (!vault) {
      lastQuote = null;
      if (outEl) outEl.value = '';
      setStatus('No Pond fee vault for ' + fromTok.symbol + ' - cannot use old rails', '#ff5555');
      updateWalletUi();
      return;
    }

    var atomic = toAtomic(amount, fromTok.decimals);
    if (!atomic) {
      lastQuote = null;
      if (outEl) outEl.value = '';
      setStatus('ENTER A VALID AMOUNT', '#ff5555');
      setRoute(
        'OLD RAILS * Metis v1 * Pond vault ' +
          shortAddr(vault) +
          ' * fee ' +
          (feeBps() / 100).toFixed(2) +
          '%'
      );
      updateWalletUi();
      return;
    }

    var seq = ++quoteSeq;
    setStatus('FETCHING METIS v1 QUOTE (OLD RAILS)...', '#ffff00');
    if (outEl) outEl.value = '...';

    try {
      var quote = await fetchQuote(fromMint, toMint, atomic);
      if (seq !== quoteSeq) return;

      if (!quote || !quote.outAmount) {
        throw new Error(quote && quote.error ? quote.error : 'No route / outAmount');
      }

      lastQuote = {
        quote: quote,
        from: fromTok,
        to: toTok,
        feeAccount: vault,
        atomic: atomic
      };

      if (outEl) {
        outEl.value = formatAtomic(quote.outAmount, toTok.decimals) + ' ' + toTok.symbol;
      }

      var impact =
        quote.priceImpactPct != null ? Number(quote.priceImpactPct) : null;
      setRoute(
        'ROUTE: ' +
          routeLabels(quote.routePlan) +
          ' * OLD REWARDS-POOL RAILS * METIS v1 * POND FEE VAULT ' +
          shortAddr(vault) +
          ' * FEE ' +
          (feeBps() / 100).toFixed(2) +
          '%' +
          ' * SLIP ' +
          (slipBps() / 100).toFixed(2) +
          '%' +
          (impact != null && isFinite(impact) ? ' * IMPACT ' + impact.toFixed(3) + '%' : '')
      );
      setStatus(
        'QUOTE READY - fee to Pond rewards-pool vault (protocol swap path when Pond indexes)',
        '#00ff00'
      );
      updateWalletUi();
    } catch (err) {
      if (seq !== quoteSeq) return;
      lastQuote = null;
      if (outEl) outEl.value = '';
      setStatus('Quote failed: ' + (err.message || err), '#ff5555');
      setRoute('OLD RAILS quote failed - check amount / pair / RPC');
      updateWalletUi();
    }
  }

  function debouncedQuote() {
    if (quoteTimer) clearTimeout(quoteTimer);
    quoteTimer = setTimeout(function () {
      updateQuote();
    }, 350);
  }

  async function confirmSig(sig) {
    var rpcs = rpcFallbacks();
    var lastErr = null;
    for (var i = 0; i < rpcs.length; i++) {
      try {
        var conn = getConnection(rpcs[i]);
        if (!conn) continue;
        /* Poll signature status - more reliable than legacy confirm(sig) */
        var deadline = Date.now() + 45000;
        while (Date.now() < deadline) {
          var st = await conn.getSignatureStatuses([sig], { searchTransactionHistory: true });
          var val = st && st.value && st.value[0];
          if (val) {
            if (val.err) throw new Error('On-chain error: ' + JSON.stringify(val.err));
            if (
              val.confirmationStatus === 'confirmed' ||
              val.confirmationStatus === 'finalized'
            ) {
              return true;
            }
          }
          await new Promise(function (r) {
            setTimeout(r, 1200);
          });
        }
        /* Timed out on this RPC - try next / soft-accept */
      } catch (e) {
        lastErr = e;
        if (e && /On-chain error/i.test(String(e.message || e))) throw e;
      }
    }
    if (lastErr) console.warn('[POND DOSSIER SWAP] confirm soft-fail', lastErr);
    return false;
  }

  async function sendSignedTransaction(provider, tx) {
    /* Prefer wallet-send first (Phantom/Solflare handle RPC better than public nodes) */
    if (typeof provider.signAndSendTransaction === 'function') {
      var sent = await provider.signAndSendTransaction(tx);
      var sig1 = sent && (sent.signature || sent);
      if (!sig1) throw new Error('Wallet returned no signature');
      return String(sig1);
    }

    if (typeof provider.signTransaction !== 'function') {
      throw new Error('Wallet cannot sign transactions');
    }

    var signed = await provider.signTransaction(tx);
    var raw = signed.serialize();
    var rpcs = rpcFallbacks();
    var lastSendErr = null;

    for (var i = 0; i < rpcs.length; i++) {
      try {
        var conn = getConnection(rpcs[i]);
        if (!conn) continue;
        setStatus('SENDING via RPC ' + (i + 1) + '/' + rpcs.length + '...', '#ffff00');
        var sig = await conn.sendRawTransaction(raw, {
          skipPreflight: false,
          maxRetries: 3,
          preflightCommitment: 'confirmed'
        });
        return sig;
      } catch (e) {
        lastSendErr = e;
      }
    }
    throw lastSendErr || new Error('All RPCs failed to send transaction');
  }

  async function executeSwap() {
    if (swapBusy) return { ok: false, reason: 'busy' };
    if (!connectedPubkey) {
      setStatus('Connect wallet first (use CONNECT WALLET REAL TX below, not soft-sign above)', '#ff5555');
      return { ok: false, reason: 'no_wallet' };
    }
    /* Re-check community right before old-rails swap (cannot trust UI alone) */
    if (communityGateEnabled()) {
      var stillOk = await checkCommunityAccess(connectedPubkey);
      if (!stillOk || !requireCommunityAccess('SWAP (OLD RAILS)')) {
        return { ok: false, reason: 'not_pond_community' };
      }
    }
    if (!lastQuote || !lastQuote.quote) {
      setStatus('Wait for green QUOTE READY first', '#ff5555');
      return { ok: false, reason: 'no_quote' };
    }
    if (!window.solanaWeb3) {
      setStatus('solanaWeb3 missing - hard refresh the page', '#ff5555');
      return { ok: false, reason: 'no_web3' };
    }

    var provider = walletProvider || detectWallet();
    if (!provider) {
      setStatus('Wallet not available - install Phantom/Solflare', '#ff5555');
      return { ok: false, reason: 'no_provider' };
    }

    /* Ensure provider still connected */
    try {
      if (provider.publicKey) {
        var pk = provider.publicKey.toString
          ? provider.publicKey.toString()
          : String(provider.publicKey);
        if (pk && pk !== connectedPubkey) connectedPubkey = pk;
      }
    } catch (e) {}

    var walletTouched = false;
    var successSig = null;
    var dossierWallet = connectedPubkey;
    swapBusy = true;
    updateWalletUi();
    setStatus('BUILDING OLD-RAILS TX (fee -> Pond vault)...', '#ffff00');

    try {
      /* Refresh quote so feeAccount stays aligned with current amounts */
      var fresh = await fetchQuote(
        lastQuote.from.mint,
        lastQuote.to.mint,
        lastQuote.atomic
      );
      if (!fresh || !fresh.outAmount) throw new Error('Fresh quote failed');

      /* Prefer input vault (AquaVaults-proven); fall back to output vault if Metis rejects */
      var feeCandidates = [];
      var inVault = feeVaultForMint(lastQuote.from.mint);
      var outVault = feeVaultForMint(lastQuote.to.mint);
      if (inVault) feeCandidates.push(inVault);
      if (outVault && outVault !== inVault) feeCandidates.push(outVault);
      if (!feeCandidates.length) throw new Error('No Pond fee vault for this pair');

      var swapRes = null;
      var feeAccount = feeCandidates[0];
      var lastBuildErr = null;
      for (var fi = 0; fi < feeCandidates.length; fi++) {
        feeAccount = feeCandidates[fi];
        try {
          swapRes = await buildSwapTx(fresh, connectedPubkey, feeAccount);
          if (swapRes && swapRes.swapTransaction) break;
          lastBuildErr = new Error('No swapTransaction from Jupiter Metis');
          swapRes = null;
        } catch (buildErr) {
          lastBuildErr = buildErr;
          swapRes = null;
        }
      }
      if (!swapRes || !swapRes.swapTransaction) {
        throw lastBuildErr || new Error('No swapTransaction from Jupiter Metis');
      }
      /* Final gate: only Pond rewards-pool vaults leave this function */
      assertPondFeeAccount(feeAccount);
      lastQuote.feeAccount = feeAccount;
      setVaultLine(
        'USING POND REWARDS-POOL VAULT: ' +
          shortAddr(feeAccount) +
          ' * fee ' +
          (feeBps() / 100).toFixed(2) +
          '% * old rails'
      );

      var txBytes = Uint8Array.from(atob(swapRes.swapTransaction), function (c) {
        return c.charCodeAt(0);
      });
      var tx = solanaWeb3.VersionedTransaction.deserialize(txBytes);

      setStatus('APPROVE IN WALLET (Pond rewards-pool rails)...', '#ffff00');
      walletTouched = true;
      var sig = await sendSignedTransaction(provider, tx);
      successSig = sig;
      setStatus('CONFIRMING ' + shortAddr(sig) + '...', '#ffff00');
      try {
        await confirmSig(sig);
      } catch (confErr) {
        console.warn('[POND DOSSIER SWAP] confirm soft-fail', confErr);
      }
      finishSuccess(sig, dossierWallet);
      return { ok: true, signature: sig };
    } catch (err) {
      var msg = errText(err);
      var failStatus;
      if (/User rejected|rejected the request|cancelled|canceled/i.test(msg)) {
        failStatus = 'Wallet rejected * AUTO-DISCONNECTED * reconnect to try again';
      } else if (/insufficient|0x1|custom program error: 0x1/i.test(msg)) {
        failStatus =
          'Swap failed: insufficient funds * AUTO-DISCONNECTED * need token + tiny SOL for fees';
      } else if (/blockhash|expired/i.test(msg)) {
        failStatus = 'Swap failed: blockhash expired * AUTO-DISCONNECTED * reconnect and retry';
      } else if (/403|429|rate|fetch/i.test(msg)) {
        failStatus =
          'Swap failed: RPC rate limit * AUTO-DISCONNECTED * paste private RPC then reconnect';
      } else {
        failStatus = 'Swap failed: ' + msg + ' * AUTO-DISCONNECTED';
      }
      setStatus(failStatus, '#ff5555');
      console.error('[POND DOSSIER SWAP]', err);
      /* stash for finally so disconnect keeps the failure message */
      executeSwap._lastFailStatus = failStatus;
      return { ok: false, reason: 'error', error: msg };
    } finally {
      swapBusy = false;
      /*
       * SAFETY: auto-disconnect after every wallet-touched tx attempt
       * (success, fail after approve, or user reject). Session never lingers.
       */
      if (walletTouched || successSig) {
        var postMsg = successSig
          ? 'CONFIRMED ' +
            shortAddr(successSig) +
            ' * WALLET AUTO-DISCONNECTED * reconnect for next swap * dossier lag 3-5 min'
          : executeSwap._lastFailStatus ||
            'WALLET AUTO-DISCONNECTED after tx attempt * reconnect for next swap';
        executeSwap._lastFailStatus = null;
        await disconnectWallet(true, postMsg);
        if (successSig) {
          var txLink = $('dsTxLink');
          if (txLink) {
            txLink.href = 'https://solscan.io/tx/' + encodeURIComponent(successSig);
            txLink.textContent = 'VIEW ON SOLSCAN -> ' + shortAddr(successSig);
            txLink.style.display = 'inline-block';
          }
        }
      } else {
        updateWalletUi();
        await refreshBalance();
        debouncedQuote();
      }
    }
  }

  function finishSuccess(sig, dossierWallet) {
    var link = 'https://solscan.io/tx/' + encodeURIComponent(sig);
    var txLink = $('dsTxLink');
    if (txLink) {
      txLink.href = link;
      txLink.textContent = 'VIEW ON SOLSCAN -> ' + shortAddr(sig);
      txLink.style.display = 'inline-block';
    }

    /* Dossier refresh uses saved/paste wallet - not the live session (we disconnect) */
    var w =
      dossierWallet ||
      localStorage.getItem('pond_scum_wallet') ||
      ($('walletPaste') && $('walletPaste').value.trim()) ||
      '';
    if (w && window.POND_SCUM && typeof window.POND_SCUM.loadDossierForWallet === 'function') {
      setTimeout(function () {
        window.POND_SCUM.loadDossierForWallet(w).catch(function () {});
      }, 4000);
    }
  }

  function autoModeContinuous() {
    var el = $('dsAutoMode');
    return el && el.value === 'continuous';
  }

  function autoUseRandom() {
    var el = $('dsAutoRandom');
    return !!(el && el.checked);
  }

  function pickAutoAmount() {
    var amountEl = $('dsFromAmount');
    if (autoUseRandom()) {
      var minEl = $('dsAutoMin');
      var maxEl = $('dsAutoMax');
      var min = minEl ? parseFloat(minEl.value) : 0.01;
      var max = maxEl ? parseFloat(maxEl.value) : 0.05;
      if (!Number.isFinite(min) || min <= 0) min = 0.01;
      if (!Number.isFinite(max) || max <= min) max = min + 0.01;
      var val = min + Math.random() * (max - min);
      /* 4–6 decimal places depending on size */
      var rounded = val >= 1 ? val.toFixed(4) : val.toFixed(6);
      if (amountEl) amountEl.value = rounded;
      return parseFloat(rounded);
    }
    var fixed = amountEl ? parseFloat(amountEl.value) : NaN;
    return Number.isFinite(fixed) && fixed > 0 ? fixed : null;
  }

  function setAutoProgress(msg) {
    var progress = $('dsAutoProgress');
    if (progress) progress.textContent = msg;
  }

  function appendAutoLog(line) {
    var log = $('dsAutoLog');
    if (!log) return;
    var t = new Date().toLocaleTimeString();
    var prev = log.textContent || '';
    var next = '[' + t + '] ' + line + (prev ? '\n' + prev : '');
    /* keep last ~12 lines */
    var lines = next.split('\n');
    if (lines.length > 12) lines = lines.slice(0, 12);
    log.textContent = lines.join('\n');
  }

  function setAutoUiRunning(running) {
    var startBtn = $('dsAutoStart');
    var stopBtn = $('dsAutoStop');
    var panel = $('dsAutoPanel');
    if (startBtn) startBtn.style.display = running ? 'none' : 'inline-block';
    if (stopBtn) stopBtn.style.display = running ? 'inline-block' : 'none';
    if (panel) {
      if (running) panel.classList.add('ds-auto-active');
      else panel.classList.remove('ds-auto-active');
    }
    var controls = [
      'dsAutoCount',
      'dsAutoWait',
      'dsAutoMode',
      'dsAutoFlip',
      'dsAutoRandom',
      'dsAutoMin',
      'dsAutoMax',
      'dsAutoFailStop'
    ];
    controls.forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = running;
    });
    updateWalletUi();
  }

  async function ensureWalletForAuto() {
    if (connectedPubkey) return true;
    setAutoProgress('Reconnecting wallet (safe disconnect after last tx)...');
    var re = await connectWallet({ onlyIfTrusted: true });
    if (!re) re = await connectWallet({ onlyIfTrusted: false });
    return !!(re && connectedPubkey);
  }

  async function runAutoSwap() {
    if (autoRunning) return;

    /* Continuous farm loops are unsafe for users + site reputation — disabled */
    if (autoModeContinuous() && cfg.oldRailsAllowContinuous !== true) {
      setStatus(
        'Continuous auto-swap is disabled on old rails (safety). Use a small finite count (max ' +
          autoMaxAllowed() +
          ') or regular Jupiter for open trading.',
        '#ff5555'
      );
      var modeEl = $('dsAutoMode');
      if (modeEl) modeEl.value = 'count';
      return;
    }

    var continuous = false;
    var countEl = $('dsAutoCount');
    var waitEl = $('dsAutoWait');
    var failStopEl = $('dsAutoFailStop');
    var total = countEl ? parseInt(countEl.value, 10) : 3;
    var waitSec = waitEl ? parseInt(waitEl.value, 10) : autoMinWaitSec();
    var failStop = failStopEl ? parseInt(failStopEl.value, 10) : 2;
    var maxAuto = autoMaxAllowed();

    if (!Number.isFinite(total) || total < 1) {
      setStatus('Set auto-swap count between 1 and ' + maxAuto, '#ff5555');
      return;
    }
    if (total > maxAuto) {
      total = maxAuto;
      if (countEl) countEl.value = String(maxAuto);
      setStatus('Auto count capped at ' + maxAuto + ' per session (safety)', '#ffaa00');
    }
    if (!Number.isFinite(waitSec) || waitSec < autoMinWaitSec()) {
      waitSec = autoMinWaitSec();
      if (waitEl) waitEl.value = String(waitSec);
    }
    if (!Number.isFinite(failStop) || failStop < 1) failStop = 2;

    if (!pickAutoAmount() && !autoUseRandom()) {
      setStatus('Set a valid amount (or enable Random amount)', '#ff5555');
      return;
    }

    /* First connect if needed */
    if (!connectedPubkey) {
      var okConnect = await connectWallet({ onlyIfTrusted: false });
      if (!okConnect) {
        setStatus('Connect wallet before starting auto-swapper', '#ff5555');
        return;
      }
    }

    /* Pond community required for any old-rails auto activity */
    var communityOk = await checkCommunityAccess(connectedPubkey);
    if (!communityOk) {
      setStatus(
        'Auto old-rails blocked — Pond community only. Use regular Jupiter for any Solana wallet.',
        '#ff5555'
      );
      return;
    }

    autoRunning = true;
    autoCancel = false;
    setAutoUiRunning(true);
    setStatus(
      'AUTO SWAPPER ON - old rewards-pool rails * disconnects after each tx',
      '#ffff00'
    );
    appendAutoLog(
      'START ' +
        (continuous ? 'continuous' : total + ' swaps') +
        ' * wait ' +
        waitSec +
        's * flip=' +
        !!($('dsAutoFlip') && $('dsAutoFlip').checked) +
        ' * random=' +
        autoUseRandom()
    );

    var ok = 0;
    var fail = 0;
    var streakFail = 0;
    var i = 0;

    while (i < total && !autoCancel) {
      i++;
      var label = continuous ? '#' + i + ' (∞)' : i + ' / ' + total;
      setAutoProgress(
        'AUTO ' + label + ' * ok ' + ok + ' * fail ' + fail + ' * reconnecting…'
      );

      if (!(await ensureWalletForAuto())) {
        fail++;
        streakFail++;
        appendAutoLog('FAIL ' + label + ' - wallet reconnect cancelled/stopped');
        setStatus(
          'Auto-swapper stopped - approve reconnect for each safe disconnect, or Stop',
          '#ffaa00'
        );
        break;
      }

      /* Flip after first successful round (or each round if checked) */
      if (i > 1 && $('dsAutoFlip') && $('dsAutoFlip').checked) {
        flipTokens();
        await sleep(350);
      }

      var amt = pickAutoAmount();
      if (!amt) {
        fail++;
        streakFail++;
        appendAutoLog('FAIL ' + label + ' - invalid amount');
        if (streakFail >= failStop) {
          appendAutoLog('STOP - ' + failStop + ' fails in a row');
          break;
        }
        continue;
      }

      setAutoProgress(
        'AUTO ' +
          label +
          ' * amount ' +
          amt +
          ' * ok ' +
          ok +
          ' * fail ' +
          fail +
          ' * quoting…'
      );
      await updateQuote();
      if (!lastQuote) {
        fail++;
        streakFail++;
        appendAutoLog('FAIL ' + label + ' - no quote for amount ' + amt);
        if (streakFail >= failStop) {
          appendAutoLog('STOP - ' + failStop + ' fails in a row');
          break;
        }
        continue;
      }

      setAutoProgress(
        'AUTO ' + label + ' * approve in wallet… * ok ' + ok + ' * fail ' + fail
      );
      try {
        var result = await executeSwap();
        if (result && result.ok) {
          ok++;
          streakFail = 0;
          appendAutoLog(
            'OK ' +
              label +
              ' * ' +
              shortAddr(result.signature) +
              ' * amt ' +
              amt +
              ' * auto-disconnected'
          );
        } else {
          fail++;
          streakFail++;
          appendAutoLog('FAIL ' + label + ' * amt ' + amt);
        }
      } catch (e) {
        fail++;
        streakFail++;
        appendAutoLog('FAIL ' + label + ' * ' + errText(e));
      }

      if (streakFail >= failStop) {
        appendAutoLog('STOP - ' + failStop + ' consecutive fails');
        setStatus(
          'Auto-swapper stopped after ' + failStop + ' fails in a row',
          '#ffaa00'
        );
        break;
      }

      var more = continuous ? !autoCancel : i < total && !autoCancel;
      if (more && waitSec > 0) {
        for (var s = waitSec; s > 0; s--) {
          if (autoCancel) break;
          setAutoProgress(
            'AUTO ' +
              label +
              ' done * ok ' +
              ok +
              ' * fail ' +
              fail +
              ' * next in ' +
              s +
              's'
          );
          await sleep(1000);
        }
      }
    }

    await disconnectWallet(
      true,
      (autoCancel ? 'AUTO SWAPPER STOPPED' : 'AUTO SWAPPER DONE') +
        ' - ok ' +
        ok +
        ' / fail ' +
        fail +
        ' * WALLET DISCONNECTED * refresh dossier in 3-5 min'
    );

    setAutoProgress(
      (autoCancel ? 'STOPPED' : 'DONE') + ' - ok ' + ok + ' / fail ' + fail
    );
    appendAutoLog('END ok=' + ok + ' fail=' + fail);

    autoRunning = false;
    setAutoUiRunning(false);
  }

  function stopAutoSwap() {
    autoCancel = true;
    setStatus('Stopping auto-swapper after current step…', '#ffaa00');
    setAutoProgress('STOPPING…');
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function bind() {
    var connectBtn = $('dsConnectBtn');
    var disconnectBtn = $('dsDisconnectBtn');
    var swapBtn = $('dsSwapBtn');
    var flipBtn = $('dsFlipBtn');
    var fromSel = $('dsFromToken');
    var toSel = $('dsToToken');
    var amount = $('dsFromAmount');
    var slip = $('dsSlippage');
    var autoStart = $('dsAutoStart');
    var autoStop = $('dsAutoStop');

    if (connectBtn) connectBtn.addEventListener('click', connectWallet);
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnectWallet);
    if (swapBtn) swapBtn.addEventListener('click', executeSwap);
    if (flipBtn) flipBtn.addEventListener('click', flipTokens);
    if (fromSel) {
      fromSel.addEventListener('change', function () {
        updateVaultDisplay();
        refreshBalance();
        debouncedQuote();
      });
    }
    if (toSel) toSel.addEventListener('change', debouncedQuote);
    if (amount) amount.addEventListener('input', debouncedQuote);
    if (slip) slip.addEventListener('input', debouncedQuote);
    if (autoStart) autoStart.addEventListener('click', runAutoSwap);
    if (autoStop) autoStop.addEventListener('click', stopAutoSwap);

    var randomToggle = $('dsAutoRandom');
    if (randomToggle) {
      randomToggle.addEventListener('change', function () {
        var wrap = $('dsAutoRandomWrap');
        if (wrap) {
          wrap.style.opacity = randomToggle.checked ? '1' : '0.45';
        }
      });
      var wrap0 = $('dsAutoRandomWrap');
      if (wrap0) wrap0.style.opacity = randomToggle.checked ? '1' : '0.45';
    }

    var modeEl = $('dsAutoMode');
    if (modeEl) {
      modeEl.addEventListener('change', function () {
        var countWrap = $('dsAutoCountWrap');
        if (countWrap) {
          countWrap.style.display =
            modeEl.value === 'continuous' ? 'none' : 'inline-flex';
        }
      });
    }
  }

  function init() {
    var panel = $('dossierSwapPanel');
    if (!panel) return;

    populateTokenSelects();
    bind();
    updateWalletUi();
    updateVaultDisplay();
    setRoute(
      'OLD RAILS STANDBY * Pond community only * Jupiter Metis v1 * Pond fee vaults * fee ' +
        (feeBps() / 100).toFixed(2) +
        '%'
    );
    setStatus(
      'OLD RAILS: Pond community only · no continuous auto · max 5/session · Jupiter open to any Solana wallet',
      '#00cc00'
    );
    setGateBanner(
      false,
      'Connect a Pond community wallet to unlock old rails. Anyone with Solana can use regular DOSWAPZ Jupiter.'
    );
    setControlsLocked(true);

    /* Force safe auto defaults in DOM */
    var modeEl0 = $('dsAutoMode');
    if (modeEl0) modeEl0.value = 'count';
    var countEl0 = $('dsAutoCount');
    if (countEl0) {
      countEl0.max = String(autoMaxAllowed());
      if (parseInt(countEl0.value, 10) > autoMaxAllowed()) {
        countEl0.value = String(Math.min(3, autoMaxAllowed()));
      }
    }
    var waitEl0 = $('dsAutoWait');
    if (waitEl0) {
      waitEl0.min = String(autoMinWaitSec());
      if (parseInt(waitEl0.value, 10) < autoMinWaitSec()) {
        waitEl0.value = String(autoMinWaitSec());
      }
    }

    if (!detectWallet()) {
      var help = $('dsWalletHelp');
      if (help) help.style.display = 'block';
    }

    /* Default amount */
    var amount = $('dsFromAmount');
    if (amount && !amount.value) amount.value = '0.1';

    /* SAFETY: never leave a live wallet session on tab close/hide */
    window.addEventListener('beforeunload', function () {
      try {
        var p = walletProvider || detectWallet();
        if (p && typeof p.disconnect === 'function') p.disconnect();
      } catch (e) {}
      walletProvider = null;
      connectedPubkey = null;
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden' && connectedPubkey && !swapBusy && !autoRunning) {
        disconnectWallet(true, 'WALLET AUTO-DISCONNECTED (tab hidden) - reconnect to swap');
      }
    });

    /* No quote until community gate passes (if enabled) */
    if (!communityGateEnabled()) debouncedQuote();
  }

  window.POND_DOSSIER_SWAP = {
    updateQuote: updateQuote,
    connectWallet: connectWallet,
    disconnectWallet: disconnectWallet,
    executeSwap: executeSwap,
    checkCommunityAccess: checkCommunityAccess
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
