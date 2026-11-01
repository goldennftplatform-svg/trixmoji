/* Chain watch + bag auto-sell, lives on the swap page. */
(function () {
 'use strict';

 var SOL = 'So11111111111111111111111111111111111111112';
 var TOKEN_PROG = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
 var TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
 var KEY = 'dz_chain_watch_v1';
 var catalog = [];
 var held = {};
 var safety = {};
 var soldAt = {};
 var pollTimer = null;
 var busy = false;
 var pnl = null;
 var lastTrades = [];

 function $(id) { return document.getElementById(id); }
 function esc(s) {
  return String(s || '').replace(/[&<>"]/g, function (c) {
   return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
  });
 }
 function fmtUsd(n) {
  if (n == null || !isFinite(Number(n))) return '-';
  var v = Number(n);
  var sign = v < 0 ? '-' : '';
  return sign + '$' + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 2 : 4);
 }
 function pnlCls(n) {
  if (n == null || !isFinite(Number(n)) || Number(n) === 0) return 'pnl-flat';
  return Number(n) > 0 ? 'pnl-pos' : 'pnl-neg';
 }
 function fmt(n) {
  n = Number(n);
  if (!isFinite(n)) return '-';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(3);
 }
 function loadMine() {
  try {
   var d = JSON.parse(localStorage.getItem(KEY) || '{}');
   return {
    autoSell: !!d.autoSell,
    sizeSol: d.sizeSol != null ? d.sizeSol : 0.05,
    minVol: d.minVol != null ? d.minVol : 3000,
    minLiq: d.minLiq != null ? d.minLiq : 2500,
    sellDrop1h: d.sellDrop1h != null ? d.sellDrop1h : 12,
    sellDrop24h: d.sellDrop24h != null ? d.sellDrop24h : 30
   };
  } catch (e) {
   return { autoSell: false, sizeSol: 0.05, minVol: 3000, minLiq: 2500, sellDrop1h: 12, sellDrop24h: 30 };
  }
 }
 function saveMine(m) {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {}
 }
 function pubkey() {
  return window.DOSWAPZ_SWAP && window.DOSWAPZ_SWAP.pubkey;
 }
 function setKeep(on) {
  if (window.DOSWAPZ_SWAP) window.DOSWAPZ_SWAP.keepConnected = !!on;
 }
 async function rpc(method, params) {
  var res = await fetch('/api/solana-rpc', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params })
  });
  var data = await res.json();
  if (data.error) throw new Error(data.error.message || 'RPC');
  return data.result;
 }
 async function loadHoldings(owner) {
  held = {};
  var opts = { encoding: 'jsonParsed' };
  var a = await rpc('getParsedTokenAccountsByOwner', [owner, { programId: TOKEN_PROG }, opts]).catch(function () { return null; });
  var b = await rpc('getParsedTokenAccountsByOwner', [owner, { programId: TOKEN_2022 }, opts]).catch(function () { return null; });
  function eat(res) {
   var val = res && res.value;
   if (!Array.isArray(val)) return;
   val.forEach(function (row) {
    var info = row.account && row.account.data && row.account.data.parsed && row.account.data.parsed.info;
    if (!info) return;
    var mint = info.mint;
    var amt = Number(info.tokenAmount && info.tokenAmount.uiAmount);
    if (mint && amt > 0) held[mint] = amt;
   });
  }
  eat(a); eat(b);
 }
 async function loadSafety(mints) {
  var uniq = [];
  var seen = {};
  (mints || []).forEach(function (m) {
   if (!m || seen[m] || safety[m]) return;
   seen[m] = true;
   uniq.push(m);
  });
  if (!uniq.length) return;
  for (var i = 0; i < uniq.length; i += 8) {
   var chunk = uniq.slice(i, i + 8);
   try {
    var res = await fetch('/api/token-safety?mints=' + chunk.join(','), { cache: 'no-store' });
    var data = await res.json();
    (data.tokens || []).forEach(function (t) { if (t && t.mint) safety[t.mint] = t; });
   } catch (e) {}
  }
 }
 function safetyBadge(mint) {
  var s = safety[mint];
  if (!s) return '<span class="watch">...</span>';
  if (s.honeypot || s.risk === 'HONEY') return '<span class="honey">HONEY</span>';
  if (s.risk === 'RISK') return '<span class="risk">RISK</span>';
  if (s.risk === 'UNK') return '<span class="watch">UNK</span>';
  return '<span class="buy">OK</span>';
 }
 function isDump(t, mine) {
  if (!t) return false;
  var d1 = Number(t.change1h);
  var d24 = Number(t.change24h);
  if (isFinite(d1) && d1 <= -Number(mine.sellDrop1h)) return true;
  if (isFinite(d24) && d24 <= -Number(mine.sellDrop24h)) return true;
  return false;
 }
 async function loadPnl(owner) {
  pnl = null;
  if (!owner) return;
  try {
   var res = await fetch('/api/wallet-trades?chain=sol&address=' + encodeURIComponent(owner) + '&limit=60', { cache: 'no-store' });
   var data = await res.json();
   pnl = data && data.pnl ? data.pnl : null;
   lastTrades = (data && data.trades) || [];
  } catch (e) {
   pnl = null;
   lastTrades = [];
  }
 }
 function pnlForMint(mint) {
  if (!pnl || !pnl.tokens) return null;
  var hit = null;
  pnl.tokens.forEach(function (t) {
   if (!t) return;
   if (t.mint === mint || t.mint === 'SOL' && mint === SOL) hit = t;
  });
  return hit;
 }
 function bagList(mine) {
  var out = [];
  Object.keys(held).forEach(function (mint) {
   if (mint === SOL) return;
   var t = catalog.filter(function (x) { return x.mint === mint; })[0] || {
    mint: mint, symbol: mint.slice(0, 4), change1h: null, change24h: null
   };
   var s = safety[mint] || {};
   var dump = isDump(t, mine);
   out.push({
    mint: mint,
    amount: held[mint],
    symbol: t.symbol || 'TOKEN',
    change1h: t.change1h,
    change24h: t.change24h,
    dump: dump,
    honeypot: !!s.honeypot,
    action: s.honeypot ? 'HONEY' : (dump ? 'SELL' : 'HOLD')
   });
  });
  return out;
 }
 function persistInputs() {
  var mine = loadMine();
  if ($('cwSizeSol')) mine.sizeSol = Number($('cwSizeSol').value) || 0.05;
  if ($('cwMinVol')) mine.minVol = Number($('cwMinVol').value) || 0;
  if ($('cwMinLiq')) mine.minLiq = Number($('cwMinLiq').value) || 0;
  if ($('cwDrop1h')) mine.sellDrop1h = Number($('cwDrop1h').value) || 12;
  if ($('cwDrop24h')) mine.sellDrop24h = Number($('cwDrop24h').value) || 30;
  saveMine(mine);
  paint();
 }
 function paint() {
  var mine = loadMine();
  if ($('cwSizeSol')) $('cwSizeSol').value = mine.sizeSol;
  if ($('cwMinVol')) $('cwMinVol').value = mine.minVol;
  if ($('cwMinLiq')) $('cwMinLiq').value = mine.minLiq;
  if ($('cwDrop1h')) $('cwDrop1h').value = mine.sellDrop1h;
  if ($('cwDrop24h')) $('cwDrop24h').value = mine.sellDrop24h;
  var arm = $('cwArmSell');
  if (arm) {
   arm.classList.toggle('on', !!mine.autoSell);
   arm.textContent = mine.autoSell ? 'AUTO SELL ARMED' : 'ARM AUTO SELL';
  }
  setKeep(!!mine.autoSell);
  var bags = bagList(mine);
  var dumps = bags.filter(function (b) { return b.dump && !b.honeypot; });
  var pk = pubkey();
  if ($('cwBagStatus')) {
   $('cwBagStatus').textContent = !pk
    ? 'CONNECT WALLET TO WATCH YOUR BAG'
    : (bags.length + ' HELD * ' + dumps.length + ' DUMPING * AUTO SELL ' + (mine.autoSell ? 'ON' : 'OFF') + (busy ? ' * SELLING...' : ''));
  }
  if ($('cwPnlWrap')) {
   if (!pk) {
    $('cwPnlWrap').innerHTML = '';
   } else if (!pnl || !pnl.tokens) {
    $('cwPnlWrap').innerHTML = '<div style="color:#00aa00;font-size:13px">PnL FROM ON-CHAIN BUYS (FIFO). CONNECT + SCAN TO LOAD COST BASIS.</div>';
   } else {
    $('cwPnlWrap').innerHTML =
     '<div class="cw-pnl-cards">' +
     '<div class="cw-pnl-card"><span>TOTAL PnL</span><b class="' + pnlCls(pnl.totalPnlUsd) + '">' + fmtUsd(pnl.totalPnlUsd) + '</b></div>' +
     '<div class="cw-pnl-card"><span>UNREALIZED</span><b class="' + pnlCls(pnl.unrealizedUsd) + '">' + fmtUsd(pnl.unrealizedUsd) + '</b></div>' +
     '<div class="cw-pnl-card"><span>REALIZED</span><b class="' + pnlCls(pnl.realizedUsd) + '">' + fmtUsd(pnl.realizedUsd) + '</b></div>' +
     '<div class="cw-pnl-card"><span>OPEN VALUE</span><b class="pnl-flat">' + fmtUsd(pnl.openValueUsd) + '</b></div>' +
     '<div class="cw-pnl-card"><span>OPEN COST</span><b class="pnl-flat">' + fmtUsd(pnl.openCostUsd) + '</b></div>' +
     '</div>' +
     '<div style="color:#00aa00;font-size:12px;margin-bottom:6px">FIFO FROM ON-CHAIN BUYS' +
     (pnl.windowTrades ? ' * LAST ' + pnl.windowTrades + ' TXS' : '') +
     (pnl.incomplete ? ' * WINDOW SAMPLE' : '') +
     (pnl.solPriceUsd ? ' * SOL $' + Number(pnl.solPriceUsd).toFixed(2) : '') +
     '</div>';
   }
  }
  if ($('cwBoughtWrap')) {
   var boughtTok = (pnl && pnl.tokens ? pnl.tokens : []).filter(function (t) {
    return t && t.mint !== 'SOL' && t.mint !== SOL && Number(t.bought) > 0;
   });
   if (!pk) {
    $('cwBoughtWrap').innerHTML = '';
   } else if (!boughtTok.length) {
    $('cwBoughtWrap').innerHTML = '<div style="color:#ffff00;letter-spacing:2px;margin:10px 0 4px">TOKENS BOUGHT</div><div style="color:#00aa00;font-size:13px">NO BUYS IN THE LAST ON-CHAIN WINDOW YET.</div>';
   } else {
    $('cwBoughtWrap').innerHTML =
     '<div style="color:#ffff00;letter-spacing:2px;margin:10px 0 4px">TOKENS BOUGHT * ' + boughtTok.length + '</div>' +
     '<table><thead><tr><th>TOKEN</th><th>BOUGHT</th><th>SOLD</th><th>STILL HELD</th><th>AVG COST</th><th>NOW</th><th>VALUE</th><th>TOTAL PnL</th><th></th></tr></thead><tbody>' +
     boughtTok.map(function (t) {
      var onchain = held[t.mint] != null ? Number(held[t.mint]) : Number(t.remaining) || 0;
      return '<tr><td>$' + esc(t.symbol || t.mint) +
       '<br><span style="color:#00aa00;font-size:11px">' + esc(String(t.mint).slice(0,4) + '...' + String(t.mint).slice(-4)) + '</span></td>' +
       '<td>' + (t.bought > 1 ? Number(t.bought).toFixed(2) : Number(t.bought).toPrecision(3)) + '</td>' +
       '<td>' + (t.sold > 0 ? (t.sold > 1 ? Number(t.sold).toFixed(2) : Number(t.sold).toPrecision(3)) : '-') + '</td>' +
       '<td>' + (onchain > 0 ? (onchain > 1 ? onchain.toFixed(3) : onchain.toPrecision(3)) : 'SOLD OUT') + '</td>' +
       '<td>' + fmtUsd(t.avgCostUsd) + '</td>' +
       '<td>' + fmtUsd(t.currentPriceUsd) + '</td>' +
       '<td>' + fmtUsd(t.marketValueUsd) + '</td>' +
       '<td class="' + pnlCls(t.totalPnlUsd) + '">' + fmtUsd(t.totalPnlUsd) + '</td>' +
       '<td>' + (onchain > 0 ? '<button type="button" class="btn" data-sell-mint="' + esc(t.mint) + '">SELL BACK</button>' : '') + '</td></tr>';
     }).join('') + '</tbody></table>';
   }
  }
  if ($('cwBuysWrap')) {
   var buys = (lastTrades || []).filter(function (tx) {
    if (!tx || (tx.type !== 'SWAP' && tx.type !== 'TOKEN')) return false;
    var legs = tx.legs || [];
    return legs.some(function (l) {
     return l && l.side === 'in' && l.mint && l.mint !== 'SOL' && l.mint !== SOL;
    });
   }).slice(0, 20);
   if (!pk) {
    $('cwBuysWrap').innerHTML = '';
   } else if (!buys.length) {
    $('cwBuysWrap').innerHTML = '';
   } else {
    $('cwBuysWrap').innerHTML =
     '<div style="color:#ffff00;letter-spacing:2px;margin:10px 0 4px">RECENT BUYS</div>' +
     '<table><thead><tr><th>TIME</th><th>BOUGHT</th><th>ROUTE</th><th>TX</th></tr></thead><tbody>' +
     buys.map(function (tx) {
      var ins = (tx.legs || []).filter(function (l) { return l.side === 'in' && l.mint !== 'SOL' && l.mint !== SOL; });
      var bought = ins.map(function (l) {
       var a = Number(l.amount);
       return (a > 1 ? a.toFixed(2) : a.toPrecision(3)) + ' $' + (l.symbol || '');
      }).join(', ');
      var when = tx.time ? String(tx.time).replace('T', ' ').slice(0, 16) : '-';
      var href = tx.explorerUrl || ('https://solscan.io/tx/' + tx.hash);
      return '<tr><td>' + esc(when) + '</td><td class="buy">' + esc(bought || '-') +
       '</td><td>' + esc(tx.detail || 'SWAP') + '</td><td><a class="btn" href="' + esc(href) +
       '" target="_blank" rel="noopener">SOLSCAN</a></td></tr>';
     }).join('') + '</tbody></table>';
   }
  }
  if ($('cwBagWrap')) {
   if (!bags.length) {
    $('cwBagWrap').innerHTML = pk ? '<div style="color:#00aa00">NO SPL BALANCES.</div>' : '';
   } else {
    $('cwBagWrap').innerHTML = '<table><thead><tr><th>BAG</th><th>HELD</th><th>BOUGHT</th><th>AVG COST</th><th>VALUE</th><th>uPnL</th><th>rPnL</th><th>1H</th><th>HP</th><th>CALL</th><th></th></tr></thead><tbody>' +
     bags.map(function (b) {
      var p = pnlForMint(b.mint);
      var heldAmt = Number(b.amount) || 0;
      var bought = p && p.bought != null ? p.bought : null;
      var avg = p && p.avgCostUsd != null ? p.avgCostUsd : null;
      var px = p && p.currentPriceUsd != null ? p.currentPriceUsd : null;
      var uPnl = p ? p.unrealizedUsd : null;
      var mkt = null;
      if (p && p.remaining > 0 && heldAmt > 0 && p.costBasisUsd != null && px != null) {
       mkt = heldAmt * px;
       uPnl = mkt - p.costBasisUsd * (heldAmt / p.remaining);
      } else if (px != null && heldAmt > 0) {
       mkt = heldAmt * px;
      }
      return '<tr><td>$' + esc(b.symbol) + '</td><td>' +
       (heldAmt > 1 ? heldAmt.toFixed(3) : heldAmt.toPrecision(3)) +
       '</td><td>' + (bought == null ? '-' : (bought > 1 ? bought.toFixed(2) : bought.toPrecision(3))) +
       '</td><td>' + (avg == null ? '-' : fmtUsd(avg)) +
       '</td><td>' + (mkt == null ? '-' : fmtUsd(mkt)) +
       '</td><td class="' + pnlCls(uPnl) + '">' + fmtUsd(uPnl) +
       '</td><td class="' + pnlCls(p && p.realizedUsd) + '">' + fmtUsd(p && p.realizedUsd) +
       '</td><td>' + (b.change1h == null ? '-' : ((b.change1h > 0 ? '+' : '') + Number(b.change1h).toFixed(1) + '%')) +
       '</td><td>' + safetyBadge(b.mint) + '</td><td class="' +
       (b.action === 'SELL' ? 'sell' : (b.action === 'HONEY' ? 'honey' : 'watch')) + '">' + esc(b.action) +
       '</td><td>' + (b.honeypot ? '' : '<button type="button" class="btn" data-sell-mint="' + esc(b.mint) + '">SELL BACK</button>') + '</td></tr>';
     }).join('') + '</tbody></table>';
   }
  }
  if ($('cwTableWrap')) {
   var rows = catalog.slice(0, 18).map(function (t) {
    var cls = t.action === 'BUY' ? 'buy' : (t.action === 'SELL' ? 'sell' : 'watch');
    var blocked = t.action === 'BUY' && safety[t.mint] && safety[t.mint].honeypot;
    return '<tr><td class="' + cls + '">' + esc(blocked ? 'BLOCK' : t.action) +
     '</td><td>$' + esc(t.symbol) + '</td><td>' + fmt(t.marketCap) +
     '</td><td>' + (t.change1h == null ? '-' : ((t.change1h > 0 ? '+' : '') + Number(t.change1h).toFixed(1) + '%')) +
     '</td><td>' + fmt(t.volume24h) + '</td><td class="' + (held[t.mint] ? 'held' : '') + '">' +
     (held[t.mint] ? 'YES' : '-') + '</td><td>' + safetyBadge(t.mint) +
     '</td><td>' + esc(t.reason) + '</td><td>' +
     (blocked ? '' : '<button type="button" class="btn" data-buy-mint="' + esc(t.mint) + '">BUY</button> ') +
     (held[t.mint] && !(safety[t.mint] && safety[t.mint].honeypot)
      ? '<button type="button" class="btn" data-sell-mint="' + esc(t.mint) + '">SELL</button>'
      : '') +
     '</td></tr>';
   }).join('');
   $('cwTableWrap').innerHTML = '<table><thead><tr><th>SIG</th><th>TOKEN</th><th>MCAP</th><th>1H</th><th>VOL</th><th>HELD</th><th>HP</th><th>WHY</th><th></th></tr></thead><tbody>' +
    rows + '</tbody></table>';
  }
 }
 async function scan() {
  if ($('cwScanStatus')) $('cwScanStatus').textContent = 'SCANNING SOLANA...';
  var res = await fetch('/api/chain-scan', { cache: 'no-store' });
  var data = await res.json();
  catalog = data.tokens || [];
  var c = data.counts || {};
  if ($('cwScanStatus')) {
   $('cwScanStatus').textContent = 'SCAN ' + (c.tokens || 0) + ' * BUY ' + (c.buy || 0) + ' * SELL ' + (c.sell || 0) + ' * WATCH ' + (c.watch || 0);
  }
  await loadSafety(catalog.map(function (t) { return t.mint; }).slice(0, 10));
  var pk = pubkey();
  if (pk) {
   await loadHoldings(pk);
   await loadSafety(Object.keys(held));
   await loadPnl(pk);
  }
  paint();
 }
 function loadSwap(t, action, amount) {
  var S = window.DOSWAPZ_SWAP;
  if (!S || !t) return;
  if (action === 'SELL') {
   var url = '?fromMint=' + encodeURIComponent(t.mint) + '&toMint=' + SOL;
   if (amount) url += '&amount=' + encodeURIComponent(amount);
   S.applyTokenToSide && window.location.replace('/classic/pages/doswapz/swap.html' + url);
   return;
  }
  window.location.href = '/classic/pages/doswapz/swap.html?fromMint=' + SOL +
   '&toMint=' + encodeURIComponent(t.mint) + '&amount=' + encodeURIComponent(loadMine().sizeSol);
 }
 async function sellOne(bag) {
  var S = window.DOSWAPZ_SWAP;
  if (!S || !S.runArmedSwap) throw new Error('Swap engine not ready');
  if (!pubkey()) throw new Error('Connect wallet');
  if (bag.honeypot) throw new Error('Honeypot — skip');
  setKeep(true);
  await S.runArmedSwap({
   fromMint: bag.mint,
   toMint: SOL,
   amount: bag.amount
  });
  soldAt[bag.mint] = Date.now();
 }
 async function sellDumps(force) {
  if (busy) return;
  var mine = loadMine();
  var dumps = bagList(mine).filter(function (b) {
   if (!b.dump || b.honeypot) return false;
   if (!force && soldAt[b.mint] && Date.now() - soldAt[b.mint] < 10 * 60 * 1000) return false;
   return true;
  });
  if (!dumps.length) {
   if ($('cwBagStatus')) $('cwBagStatus').textContent = 'NO DUMPING SELLABLE TOKENS';
   return;
  }
  busy = true;
  setKeep(true);
  try {
   for (var i = 0; i < dumps.length; i++) {
    if ($('cwBagStatus')) {
     $('cwBagStatus').textContent = 'AUTO SELL ' + (i + 1) + '/' + dumps.length + ' * $' + dumps[i].symbol + ' * SIGN IN WALLET';
    }
    await sellOne(dumps[i]);
   }
  } catch (e) {
   if ($('cwBagStatus')) $('cwBagStatus').textContent = 'AUTO SELL STOPPED: ' + (e.message || e);
   busy = false;
   paint();
   return;
  }
  busy = false;
  if (pubkey()) await loadHoldings(pubkey());
  paint();
 }
 async function tick() {
  var mine = loadMine();
  if (!mine.autoSell) return;
  if (!pubkey()) return;
  if (busy) return;
  try {
   await scan();
   await sellDumps(false);
  } catch (e) {
   if ($('cwBagStatus')) $('cwBagStatus').textContent = 'WATCH ERROR: ' + (e.message || e);
  }
 }
 function armToggle() {
  var mine = loadMine();
  mine.autoSell = !mine.autoSell;
  saveMine(mine);
  setKeep(!!mine.autoSell);
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (mine.autoSell) {
   if (!pubkey() && window.connectSwapWallet) window.connectSwapWallet();
   pollTimer = setInterval(tick, 60000);
   tick();
  }
  paint();
 }
 function bind() {
  if (!$('chainWatch')) return;
  ['cwSizeSol', 'cwMinVol', 'cwMinLiq', 'cwDrop1h', 'cwDrop24h'].forEach(function (id) {
   if ($(id)) $(id).addEventListener('change', persistInputs);
  });
  if ($('cwArmSell')) $('cwArmSell').onclick = armToggle;
  if ($('cwSellDumps')) $('cwSellDumps').onclick = function () { sellDumps(true); };
  if ($('cwRefresh')) $('cwRefresh').onclick = scan;
  function loadBuySell(mint, action) {
   var S = window.DOSWAPZ_SWAP;
   if (!S || !S.loadPair || !mint) return;
   if (action === 'SELL') {
    if (safety[mint] && safety[mint].honeypot) {
     if ($('cwBagStatus')) $('cwBagStatus').textContent = 'HONEYPOT — MAY NOT SELL';
     return;
    }
    S.loadPair(mint, SOL, held[mint]);
   } else {
    if (safety[mint] && safety[mint].honeypot) {
     if ($('cwScanStatus')) $('cwScanStatus').textContent = 'BLOCKED HONEYPOT';
     return;
    }
    S.loadPair(SOL, mint, loadMine().sizeSol);
   }
   var box = document.getElementById('jupiterSwapPanel');
   if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if ($('chainWatch')) {
   $('chainWatch').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    if (btn.getAttribute('data-sell-mint')) loadBuySell(btn.getAttribute('data-sell-mint'), 'SELL');
    if (btn.getAttribute('data-buy-mint')) loadBuySell(btn.getAttribute('data-buy-mint'), 'BUY');
   });
  }
  scan();
  var mine = loadMine();
  if (mine.autoSell) {
   setKeep(true);
   pollTimer = setInterval(tick, 60000);
  }
  paint();
 }

 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
 else bind();
})();
