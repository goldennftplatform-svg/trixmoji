/* DOSWAPZ - I SEE YOU wallet surveillance terminal + PnL */
(function () {
  'use strict';

  var cfg = window.DOSWAPZ_I_SEE_YOU_CONFIG || {};
  var busy = false;
  var lastData = null;

  function $(id) {
    return document.getElementById(id);
  }

  function shortAddr(addr) {
    if (!addr || addr.length < 12) return addr || ' - ';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  function setStatus(msg, color) {
    var el = $('isyStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.color = color || '#00cc66';
  }

  function formatTime(ts) {
    if (!ts) return ' - ';
    var d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ' - ';
    return d.toLocaleString();
  }

  function fmtUsd(n, digits) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    var v = Number(n);
    var d = digits != null ? digits : Math.abs(v) >= 100 ? 2 : Math.abs(v) >= 1 ? 2 : 4;
    var sign = v > 0 ? '+' : '';
    return sign + '$' + v.toFixed(d);
  }

  function fmtUsdPlain(n, digits) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    var v = Number(n);
    var d = digits != null ? digits : Math.abs(v) >= 100 ? 2 : Math.abs(v) >= 1 ? 2 : 4;
    return '$' + v.toFixed(d);
  }

  function fmtAmt(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    var v = Number(n);
    if (Math.abs(v) >= 1e6) return v.toExponential(2);
    if (Math.abs(v) >= 1000) return v.toFixed(2);
    if (Math.abs(v) >= 1) return v.toFixed(4);
    return v.toFixed(6);
  }

  function pnlClass(n) {
    if (n == null || !Number.isFinite(Number(n))) return 'isy-pnl-flat';
    if (Number(n) > 0) return 'isy-pnl-pos';
    if (Number(n) < 0) return 'isy-pnl-neg';
    return 'isy-pnl-flat';
  }

  var SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,50}$/;
  var EVM_RE = /^0x[a-fA-F0-9]{40}$/;
  var BTC_RE = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;

  function normalizeAddress(addr) {
    return String(addr || '')
      .trim()
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/^solana:/i, '')
      .trim();
  }

  function detectChainId(addr) {
    addr = normalizeAddress(addr);
    if (!addr) return null;
    if (EVM_RE.test(addr)) return 'eth';
    if (BTC_RE.test(addr)) return 'btc';
    if (SOL_RE.test(addr)) return 'sol';
    return null;
  }

  function chainLabel(chainId) {
    var hit = null;
    chainList().some(function (c) {
      if (c.id === chainId) {
        hit = c.label;
        return true;
      }
      return false;
    });
    return hit || chainId;
  }

  function validateAddress(chain, addr) {
    addr = normalizeAddress(addr);
    if (!addr) return false;
    if (chain === 'sol') return SOL_RE.test(addr);
    if (chain === 'btc') return BTC_RE.test(addr);
    return EVM_RE.test(addr);
  }

  function validationError(chain, addr) {
    addr = normalizeAddress(addr);
    if (!addr) return 'ENTER A WALLET ADDRESS';
    if (chain === 'sol' && !SOL_RE.test(addr)) {
      return 'NOT A VALID SOLANA ADDRESS - EXPECT 32 - 50 BASE58 CHARS (NO 0, O, I, l)';
    }
    if (chain === 'btc' && !BTC_RE.test(addr)) {
      return 'NOT A VALID BITCOIN ADDRESS - USE bc1... OR 1... / 3... FORMAT';
    }
    if (chain !== 'sol' && chain !== 'btc' && !EVM_RE.test(addr)) {
      return 'NOT A VALID EVM ADDRESS - MUST START WITH 0x + 40 HEX CHARS';
    }
    return 'INVALID ADDRESS FOR ' + chainLabel(chain).toUpperCase();
  }

  function getSelectedChain() {
    var active = document.querySelector('.isy-chain-opt.is-active');
    if (active) return active.getAttribute('data-chain');
    var chainSel = $('isyChain');
    return chainSel && chainSel.value ? chainSel.value : cfg.defaultChain || 'sol';
  }

  function saveLast(chain, address) {
    try {
      localStorage.setItem(
        cfg.storageKey || 'doswapz_iseeyou_last',
        JSON.stringify({ chain: chain, address: address })
      );
    } catch (e) {}
  }

  function loadLast() {
    try {
      var raw = localStorage.getItem(cfg.storageKey || 'doswapz_iseeyou_last');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function renderStats(data) {
    var el = $('isyStats');
    if (!el) return;
    var s = data.stats || {};
    var html =
      '<span class="isy-stat"><strong>' +
      (s.total || 0) +
      '</strong> ACTIVITY</span>' +
      '<span class="isy-stat"><strong>' +
      (s.swaps || 0) +
      '</strong> SWAPS</span>' +
      '<span class="isy-stat">SOURCE: ' +
      (s.source || 'proxy').toUpperCase() +
      '</span>';
    if (data.pnl && data.pnl.solPriceUsd) {
      html +=
        '<span class="isy-stat">SOL: <strong>$' +
        Number(data.pnl.solPriceUsd).toFixed(2) +
        '</strong></span>';
    }
    el.innerHTML = html;
  }

  function renderPnl(data) {
    var summary = $('isyPnlSummary');
    var tokenBody = $('isyPnlTokenBody');
    var tokenEmpty = $('isyPnlTokenEmpty');
    var panel = $('isyPnlPanel');
    var noteEl = $('isyPnlNote');

    if (!summary) return;

    var pnl = data && data.pnl;
    if (!pnl || !pnl.tokens) {
      if (panel) panel.style.display = pnl && pnl.note ? '' : panel ? panel.style.display : '';
      summary.innerHTML =
        '<div class="isy-pnl-banner">' +
        (pnl && pnl.note
          ? esc(pnl.note)
          : 'PnL ENGINE ACTIVE ON SOLANA — SWITCH CHAIN OR TRACK A SOL WALLET') +
        '</div>';
      if (tokenBody) tokenBody.innerHTML = '';
      if (tokenEmpty) {
        tokenEmpty.style.display = 'block';
        tokenEmpty.textContent = pnl && pnl.note ? pnl.note : 'NO TOKEN PnL FOR THIS CHAIN YET';
      }
      if (noteEl) noteEl.textContent = '';
      return;
    }

    if (panel) panel.style.display = '';

    var total = pnl.totalPnlUsd;
    var realized = pnl.realizedUsd;
    var unrealized = pnl.unrealizedUsd;

    summary.innerHTML =
      '<div class="isy-pnl-cards">' +
      card('TOTAL PnL', fmtUsd(total), pnlClass(total)) +
      card('REALIZED', fmtUsd(realized), pnlClass(realized)) +
      card('UNREALIZED', fmtUsd(unrealized), pnlClass(unrealized)) +
      card('OPEN VALUE', fmtUsdPlain(pnl.openValueUsd), 'isy-pnl-flat') +
      card('OPEN COST', fmtUsdPlain(pnl.openCostUsd), 'isy-pnl-flat') +
      card('TOKENS', String(pnl.tokenCount || 0), 'isy-pnl-flat') +
      '</div>';

    if (noteEl) {
      noteEl.textContent =
        (pnl.note || '') +
        ' Method: ' +
        (pnl.method || 'FIFO') +
        '. Window: last ' +
        (pnl.windowTrades || (data.trades || []).length) +
        ' txs.';
    }

    if (!tokenBody) return;
    var tokens = pnl.tokens || [];
    if (!tokens.length) {
      tokenBody.innerHTML = '';
      if (tokenEmpty) {
        tokenEmpty.style.display = 'block';
        tokenEmpty.textContent = 'NO TOKEN POSITIONS IN WINDOW';
      }
      return;
    }
    if (tokenEmpty) tokenEmpty.style.display = 'none';

    tokenBody.innerHTML = tokens
      .map(function (t) {
        var mintShort = t.mint && t.mint.length > 12 ? shortAddr(t.mint) : t.mint || '—';
        var mintLink =
          t.mint && t.mint !== 'SOL'
            ? '<a href="https://solscan.io/token/' +
              encodeURIComponent(t.mint) +
              '" target="_blank" rel="noopener noreferrer" title="' +
              esc(t.mint) +
              '">' +
              esc(t.symbol || mintShort) +
              '</a>'
            : esc(t.symbol || mintShort);
        return (
          '<tr>' +
          '<td class="isy-token-sym">' +
          mintLink +
          '</td>' +
          '<td>' +
          fmtAmt(t.remaining) +
          '</td>' +
          '<td>' +
          fmtAmt(t.bought) +
          ' / ' +
          fmtAmt(t.sold) +
          '</td>' +
          '<td>' +
          fmtUsdPlain(t.avgCostUsd, 6) +
          '</td>' +
          '<td>' +
          fmtUsdPlain(t.currentPriceUsd, 6) +
          '</td>' +
          '<td>' +
          fmtUsdPlain(t.marketValueUsd) +
          '</td>' +
          '<td class="' +
          pnlClass(t.realizedUsd) +
          '">' +
          fmtUsd(t.realizedUsd) +
          '</td>' +
          '<td class="' +
          pnlClass(t.unrealizedUsd) +
          '">' +
          fmtUsd(t.unrealizedUsd) +
          '</td>' +
          '<td class="' +
          pnlClass(t.totalPnlUsd) +
          '"><strong>' +
          fmtUsd(t.totalPnlUsd) +
          '</strong></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function card(label, value, cls) {
    return (
      '<div class="isy-pnl-card">' +
      '<div class="isy-pnl-card-label">' +
      label +
      '</div>' +
      '<div class="isy-pnl-card-value ' +
      (cls || '') +
      '">' +
      value +
      '</div>' +
      '</div>'
    );
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderTrades(data) {
    var body = $('isyTradeBody');
    var empty = $('isyEmpty');
    if (!body) return;

    var trades = data.trades || [];
    if (!trades.length) {
      body.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    body.innerHTML = trades
      .map(function (t) {
        var typeCls = 'isy-type-' + String(t.type || 'tx').toLowerCase().replace(/[^a-z0-9_]/g, '');
        var pnlCell = '—';
        var pnlCls = 'isy-pnl-flat';
        if (t.pnl && t.pnl.realizedUsd != null && Number(t.pnl.realizedUsd) !== 0) {
          pnlCell = fmtUsd(t.pnl.realizedUsd);
          pnlCls = pnlClass(t.pnl.realizedUsd);
        } else if (t.legs && t.legs.length) {
          pnlCell = '<span class="isy-pnl-muted">legs</span>';
        }
        return (
          '<tr>' +
          '<td class="isy-time">' +
          formatTime(t.time) +
          '</td>' +
          '<td><span class="isy-type ' +
          typeCls +
          '">' +
          esc(t.type || 'TX') +
          '</span></td>' +
          '<td class="isy-detail">' +
          esc(t.detail || ' - ') +
          '</td>' +
          '<td class="' +
          pnlCls +
          ' isy-tx-pnl">' +
          pnlCell +
          '</td>' +
          '<td class="isy-hash"><a href="' +
          esc(t.explorerUrl) +
          '" target="_blank" rel="noopener noreferrer">' +
          shortAddr(t.hash) +
          '</a></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function renderTarget(data) {
    var el = $('isyTarget');
    if (!el) return;
    el.textContent = data.chainLabel + ' * ' + data.address;
  }

  async function trackWallet(chain, address) {
    if (busy) return;

    address = normalizeAddress(address);
    chain = chain || getSelectedChain();

    if (!validateAddress(chain, address)) {
      var guessed = detectChainId(address);
      if (guessed && guessed !== chain) {
        setChainValue(guessed, false);
        chain = guessed;
      } else {
        setStatus(validationError(chain, address), '#ff6666');
        return;
      }
    }

    busy = true;
    setStatus('SCANNING ' + chainLabel(chain).toUpperCase() + (chain === 'sol' ? ' + PnL...' : '...'), '#66ccff');
    if ($('isyTrackBtn')) $('isyTrackBtn').disabled = true;

    var params = new URLSearchParams();
    params.set('address', address);
    params.set('chain', chain);
    if (chain === 'sol') params.set('limit', String(cfg.maxTrades || 40));
    var url = (cfg.apiUrl || '/api/wallet-trades') + '?' + params.toString();

    try {
      var res = await fetch(url, { headers: { Accept: 'application/json' } });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'Tracker failed');

      lastData = data;
      saveLast(chain, address);
      renderTarget(data);
      renderStats(data);
      renderPnl(data);
      renderTrades(data);

      var n = (data.trades || []).length;
      var extra = '';
      if (data.pnl && data.pnl.tokens) {
        extra = ' | PnL ' + fmtUsd(data.pnl.totalPnlUsd);
      }
      setStatus('SURVEILLANCE ACTIVE - ' + n + ' RECORDS' + extra, '#00ff66');

      var raw = $('isyRaw');
      if (raw) raw.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      setStatus(String(err.message || err).toUpperCase(), '#ff6666');
      renderTrades({ trades: [] });
      renderPnl({ pnl: null });
      var stats = $('isyStats');
      if (stats) stats.innerHTML = '';
    } finally {
      busy = false;
      if ($('isyTrackBtn')) $('isyTrackBtn').disabled = false;
    }
  }

  function detectSolanaWallet() {
    if (window.solana && window.solana.isPhantom) return window.solana;
    if (window.solflare && window.solflare.isSolflare) return window.solflare;
    if (window.solana) return window.solana;
    return null;
  }

  async function connectSolana() {
    var w = detectSolanaWallet();
    if (!w) {
      setStatus('NO SOLANA WALLET - PASTE ADDRESS OR INSTALL PHANTOM', '#ffaa44');
      return;
    }
    try {
      var resp = await w.connect();
      var pk = resp.publicKey
        ? resp.publicKey.toString()
        : w.publicKey && w.publicKey.toString();
      if (!pk) throw new Error('Wallet did not return a public key');
      setChainValue('sol', false);
      $('isyAddress').value = pk;
      setStatus('SOLANA WALLET LINKED - ' + shortAddr(pk), '#00ff66');
      await trackWallet('sol', pk);
    } catch (err) {
      setStatus(String(err.message || err).toUpperCase(), '#ff6666');
    }
  }

  async function connectEvm() {
    var eth = window.ethereum;
    if (!eth) {
      setStatus('NO EVM WALLET - PASTE ADDRESS OR INSTALL METAMASK', '#ffaa44');
      return;
    }
    try {
      var accounts = await eth.request({ method: 'eth_requestAccounts' });
      var addr = accounts && accounts[0];
      if (!addr) throw new Error('No account returned');
      setChainValue('eth', false);
      $('isyAddress').value = addr;
      setStatus('ETH WALLET LINKED - ' + shortAddr(addr), '#00ff66');
      await trackWallet('eth', addr);
    } catch (err) {
      setStatus(String(err.message || err).toUpperCase(), '#ff6666');
    }
  }

  var FALLBACK_CHAINS = [
    { id: 'sol', label: 'Solana (SOL)' },
    { id: 'eth', label: 'Ethereum (ETH)' },
    { id: 'base', label: 'Base' },
    { id: 'polygon', label: 'Polygon' },
    { id: 'arb', label: 'Arbitrum' },
    { id: 'btc', label: 'Bitcoin (BTC)' }
  ];

  function chainList() {
    return cfg.chains && cfg.chains.length ? cfg.chains : FALLBACK_CHAINS;
  }

  function setChainValue(chainId, announce) {
    var chainSel = $('isyChain');
    if (!chainSel) return;
    chainSel.value = chainId;
    document.querySelectorAll('.isy-chain-opt').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-chain') === chainId);
    });
    if (announce) {
      var picked = null;
      chainList().some(function (c) {
        if (c.id === chainId) {
          picked = c;
          return true;
        }
        return false;
      });
      if (picked) setStatus('CHAIN: ' + picked.label.toUpperCase(), '#ffaa66');
    }
  }

  function populateChains() {
    var chainSel = $('isyChain');
    if (!chainSel) return;
    var chains = chainList();
    chainSel.innerHTML = chains
      .map(function (c) {
        return '<option value="' + c.id + '">' + c.label + '</option>';
      })
      .join('');
    if (cfg.defaultChain) chainSel.value = cfg.defaultChain;
  }

  function renderChainPicker() {
    var chainSel = $('isyChain');
    var host = $('isyChainPick');
    if (!chainSel || !host) return;

    var chains = chainList();
    host.innerHTML = chains
      .map(function (c) {
        var active = chainSel.value === c.id ? ' is-active' : '';
        return (
          '<button type="button" class="isy-chain-opt' +
          active +
          '" data-chain="' +
          c.id +
          '">' +
          c.label +
          '</button>'
        );
      })
      .join('');

    host.querySelectorAll('.isy-chain-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setChainValue(btn.getAttribute('data-chain'), true);
      });
    });

    chainSel.addEventListener('change', function () {
      setChainValue(chainSel.value, true);
    });
  }

  function bindUi() {
    populateChains();
    renderChainPicker();

    var addrInput = $('isyAddress');
    var trackBtn = $('isyTrackBtn');
    var solBtn = $('isyConnectSol');
    var evmBtn = $('isyConnectEvm');

    if (evmBtn) evmBtn.textContent = 'CONNECT ETH';

    if (trackBtn) {
      trackBtn.addEventListener('click', function () {
        trackWallet(getSelectedChain(), addrInput.value);
      });
    }

    if (addrInput) {
      addrInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') trackWallet(getSelectedChain(), addrInput.value);
      });
      addrInput.addEventListener('blur', function () {
        var cleaned = normalizeAddress(addrInput.value);
        if (cleaned !== addrInput.value) addrInput.value = cleaned;
        var guess = detectChainId(cleaned);
        if (guess && guess !== getSelectedChain()) {
          setChainValue(guess, false);
          setStatus(
            'DETECTED ' + chainLabel(guess).toUpperCase() + ' ADDRESS - CHAIN SWITCHED',
            '#ffaa66'
          );
        }
      });
    }

    if (solBtn) solBtn.addEventListener('click', connectSolana);
    if (evmBtn) evmBtn.addEventListener('click', connectEvm);

    var last = loadLast();
    if (last && last.address && addrInput) {
      if (last.chain) setChainValue(last.chain, false);
      addrInput.value = normalizeAddress(last.address);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUi);
  } else {
    bindUi();
  }
})();
