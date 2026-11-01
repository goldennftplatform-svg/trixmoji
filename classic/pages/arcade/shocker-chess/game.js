(function () {
  'use strict';

  var E = window.ShockerChess;
  var ASSET = '/classic/pages/arcade/shocker-chess/assets/';
  var MINT = 'E6LwzUpR2NsdUzAiGzZb1K5PbffkXANagXHt1R4BTRiX';
  var KIND = { 1: 'p', 2: 'n', 3: 'b', 4: 'r', 5: 'q', 6: 'k' };
  var LEVEL_NAME = {
    1: 'Level 1 · blunders often',
    2: 'Level 2 · loose',
    3: 'Level 3 · casual',
    4: 'Level 4 · club',
    5: 'Level 5 · solid',
    6: 'Level 6 · sharp',
    7: 'Level 7 · strong',
    8: 'Level 8 · severe',
    9: 'Level 9 · ruthless',
    10: 'Level 10 · deepest search'
  };
  var SNAP = {
    price: 0.00004571,
    change: 1.01,
    mcap: 45719,
    liq: 19420,
    vol: 2235,
    live: false
  };

  var pos = E.startPos();
  var userColor = E.WHITE;
  var level = 5;
  var muted = false;
  var thinking = false;
  var thinkToken = 0;
  var selected = null;
  var last = null;
  var pending = null;
  var drag = null;
  var stack = [];
  var audioCtx = null;
  var worker = null;

  var boardEl = document.getElementById('board');
  var ranksEl = document.getElementById('ranks');
  var filesEl = document.getElementById('files');
  var movesEl = document.getElementById('moves');
  var statusText = document.getElementById('statusText');
  var statusSub = document.getElementById('statusSub');
  var promoEl = document.getElementById('promo');
  var ghost = document.getElementById('ghost');

  function pieceSrc(piece) {
    var side = E.colorOf(piece) === E.WHITE ? 'w' : 'b';
    return ASSET + side + '-' + KIND[E.typeOf(piece)] + '.png';
  }

  function flipped() { return userColor === E.BLACK; }

  function myTurn() {
    return !thinking && pos.turn === userColor && !currentOutcome().over && !pending;
  }

  function repCount() {
    var key = E.keyOf(pos);
    var n = 0;
    for (var i = 0; i < stack.length; i++) if (stack[i].key === key) n++;
    return n;
  }

  function currentOutcome() {
    return E.outcome(pos, repCount());
  }

  function setStatus(title, sub) {
    statusText.textContent = title;
    statusSub.textContent = sub || '';
  }

  function describeTurn() {
    var oc = currentOutcome();
    if (oc.over) {
      if (oc.reason === 'checkmate') {
        var youWin = oc.winner === userColor;
        setStatus(youWin ? 'Checkmate. You win.' : 'Checkmate. The computer wins.', 'Game over.');
      } else if (oc.reason === 'stalemate') setStatus('Stalemate.', 'Draw.');
      else if (oc.reason === 'fifty-move') setStatus('Draw by the fifty-move rule.', 'No capture or pawn move for 50 moves.');
      else if (oc.reason === 'insufficient') setStatus('Draw by insufficient material.', 'Neither side can force a mate.');
      else if (oc.reason === 'repetition') setStatus('Draw by repetition.', 'The same position occurred three times.');
      else setStatus('Game over.', oc.reason);
      return;
    }
    if (thinking) {
      setStatus('Computer is thinking…', 'Level ' + level);
      return;
    }
    var who = pos.turn === E.WHITE ? 'White' : 'Black';
    var you = pos.turn === userColor;
    setStatus((oc.reason === 'check' ? 'Check. ' : '') + (you ? 'Your move.' : who + ' to move.'), who + ' to play.');
  }

  function renderCoords() {
    var flip = flipped();
    ranksEl.innerHTML = '';
    filesEl.innerHTML = '';
    for (var i = 0; i < 8; i++) {
      var rank = document.createElement('span');
      rank.textContent = String(flip ? i + 1 : 8 - i);
      ranksEl.appendChild(rank);
      var file = document.createElement('span');
      file.textContent = 'abcdefgh'[flip ? 7 - i : i];
      filesEl.appendChild(file);
    }
  }

  function legalFrom(sq) {
    return E.legalMoves(pos).filter(function (m) { return m.from === sq; });
  }

  function renderBoard() {
    var flip = flipped();
    var targets = selected == null ? [] : legalFrom(selected);
    var oc = currentOutcome();
    boardEl.innerHTML = '';
    for (var row = 0; row < 8; row++) {
      for (var col = 0; col < 8; col++) {
        var file = flip ? 7 - col : col;
        var rank = flip ? row : 7 - row;
        var sq = (rank << 4) | file;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sq ' + (((file + rank) & 1) ? 'light' : 'dark');
        btn.dataset.sq = String(sq);
        if (last && (sq === last.from || sq === last.to)) btn.classList.add('last');
        if (selected === sq) btn.classList.add('sel');
        var piece = pos.b[sq];
        if (piece && E.typeOf(piece) === E.KING && E.colorOf(piece) === pos.turn && (oc.reason === 'check' || oc.reason === 'checkmate')) {
          btn.classList.add('check');
        }
        var hit = null;
        for (var t = 0; t < targets.length; t++) if (targets[t].to === sq) hit = targets[t];
        if (hit) {
          var mark = document.createElement('i');
          mark.className = hit.captured || hit.ep ? 'ring' : 'dot';
          btn.appendChild(mark);
        }
        if (piece) {
          var img = document.createElement('img');
          img.className = 'piece';
          img.alt = '';
          img.src = pieceSrc(piece);
          btn.appendChild(img);
          btn.setAttribute('aria-label', E.sqName(sq));
        } else {
          btn.setAttribute('aria-label', E.sqName(sq));
        }
        btn.addEventListener('pointerdown', onDown);
        boardEl.appendChild(btn);
      }
    }
  }

  function renderMoves() {
    var plies = stack.filter(function (row) { return row.san; });
    movesEl.innerHTML = '';
    for (var i = 0; i < plies.length; i += 2) {
      var li = document.createElement('li');
      var num = document.createElement('span');
      num.textContent = (i / 2 + 1) + '.';
      li.appendChild(num);
      li.appendChild(document.createTextNode(plies[i].san));
      var black = document.createElement('span');
      black.textContent = plies[i + 1] ? plies[i + 1].san : '';
      black.style.color = '#f6f3ee';
      li.appendChild(black);
      movesEl.appendChild(li);
    }
    movesEl.scrollTop = movesEl.scrollHeight;
  }

  function render() {
    renderCoords();
    renderBoard();
    renderMoves();
    describeTurn();
  }

  function blip(freq) {
    if (muted) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq || 480;
      g.gain.setValueAtTime(0.035, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.07);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + 0.08);
    } catch (err) { /* sound is optional */ }
  }

  function commit(move, mover) {
    var san = E.toSan(pos, move);
    last = { from: move.from, to: move.to };
    E.make(pos, move);
    stack.push({ fen: E.toFen(pos), san: san, mover: mover, key: E.keyOf(pos), from: move.from, to: move.to });
    selected = null;
    pending = null;
    hidePromo();
    render();
    blip(move.captured || move.ep ? 220 : 520);
    var oc = currentOutcome();
    if (!oc.over && mover === userColor) computer();
  }

  function attempt(from, to, promo) {
    if (!myTurn() && !pending) return;
    var moves = legalFrom(from).filter(function (m) { return m.to === to; });
    if (!moves.length) {
      selected = null;
      render();
      return;
    }
    if (moves.length > 1) {
      if (!promo) {
        pending = { from: from, to: to };
        showPromo();
        return;
      }
      moves = moves.filter(function (m) { return m.promo === promo; });
    }
    if (!moves.length) return;
    pending = null;
    hidePromo();
    commit(moves[0], userColor);
  }

  function showPromo() {
    var box = document.getElementById('promoChoices');
    box.innerHTML = '';
    var side = userColor === E.WHITE ? 'w' : 'b';
    [E.QUEEN, E.ROOK, E.BISHOP, E.KNIGHT].forEach(function (type) {
      var btn = document.createElement('button');
      btn.type = 'button';
      var img = document.createElement('img');
      img.alt = KIND[type];
      img.src = ASSET + side + '-' + KIND[type] + '.png';
      btn.appendChild(img);
      btn.addEventListener('click', function () {
        var from = pending.from;
        var to = pending.to;
        pending = null;
        attempt(from, to, type);
      });
      box.appendChild(btn);
    });
    promoEl.classList.add('on');
  }

  function hidePromo() { promoEl.classList.remove('on'); }

  function onDown(e) {
    if (e.button != null && e.button !== 0) return;
    if (!myTurn()) return;
    var sq = parseInt(e.currentTarget.dataset.sq, 10);
    var piece = pos.b[sq];
    var mine = piece && E.colorOf(piece) === userColor;
    if (selected != null && selected !== sq) {
      var legal = legalFrom(selected).some(function (m) { return m.to === sq; });
      if (legal) {
        attempt(selected, sq);
        return;
      }
    }
    if (!mine) {
      selected = null;
      render();
      return;
    }
    selected = sq;
    drag = { sq: sq, x: e.clientX, y: e.clientY, pid: e.pointerId, moved: false, piece: piece };
    render();
  }

  document.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.pid) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
      drag.moved = true;
      if (ghost.hidden) {
        ghost.src = pieceSrc(drag.piece);
        ghost.hidden = false;
      }
    }
    ghost.style.left = e.clientX + 'px';
    ghost.style.top = e.clientY + 'px';
  });

  document.addEventListener('pointercancel', function () {
    if (!drag) return;
    drag = null;
    ghost.hidden = true;
    render();
  });

  document.addEventListener('pointerup', function (e) {
    if (!drag || e.pointerId !== drag.pid) return;
    var from = drag.sq;
    var moved = drag.moved;
    ghost.hidden = true;
    drag = null;
    if (!moved) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    var sqEl = el && el.closest ? el.closest('[data-sq]') : null;
    if (!sqEl) {
      selected = null;
      render();
      return;
    }
    var to = parseInt(sqEl.dataset.sq, 10);
    if (to === from) return;
    attempt(from, to);
  });

  function computer() {
    if (currentOutcome().over || pos.turn === userColor) return;
    thinking = true;
    describeTurn();
    var id = ++thinkToken;
    var fen = E.toFen(pos);
    var lv = level;
    var started = Date.now();
    var apply = function (uci) {
      if (id !== thinkToken) return;
      thinking = false;
      var live = E.parseFen(fen);
      var move = E.fromUci(live, uci);
      if (!move || E.toFen(pos) !== fen) {
        describeTurn();
        return;
      }
      move = E.fromUci(pos, uci);
      if (!move) {
        describeTurn();
        return;
      }
      commit(move, userColor ^ 1);
    };
    if (worker) {
      worker.onmessage = function (e) {
        var data = e.data || {};
        if (data.id !== id) return;
        var wait = Math.max(0, 180 - (Date.now() - started));
        setTimeout(function () { apply(data.uci); }, wait);
      };
      worker.postMessage({ id: id, fen: fen, level: lv });
      return;
    }
    setTimeout(function () {
      var result = E.search(E.parseFen(fen), lv);
      apply(result && result.uci);
    }, 40);
  }

  function resetWorker() {
    if (worker) {
      worker.terminate();
      worker = null;
    }
    try { worker = new Worker('/classic/pages/arcade/shocker-chess/engine.js'); }
    catch (err) { worker = null; }
  }

  function newGame() {
    thinkToken++;
    thinking = false;
    resetWorker();
    pending = null;
    selected = null;
    last = null;
    hidePromo();
    ghost.hidden = true;
    drag = null;
    pos = E.startPos();
    stack = [{ fen: E.toFen(pos), san: null, mover: null, key: E.keyOf(pos) }];
    render();
    if (userColor === E.BLACK) computer();
    else setStatus('Your move.', 'You play white. Level ' + level + '.');
  }

  function undo() {
    if (pending) return;
    if (stack.length < 2) return;
    thinkToken++;
    thinking = false;
    var lastRow = stack[stack.length - 1];
    if (lastRow.mover === userColor) stack.pop();
    else {
      stack.pop();
      if (stack.length > 1 && stack[stack.length - 1].mover === userColor) stack.pop();
    }
    var row = stack[stack.length - 1];
    pos = E.parseFen(row.fen);
    selected = null;
    last = row.from == null ? null : { from: row.from, to: row.to };
    resetWorker();
    render();
  }

  function setLevel(n) {
    level = Math.max(1, Math.min(10, n));
    try { localStorage.setItem('shockerChessLevel', String(level)); } catch (err) {}
    var buttons = document.querySelectorAll('#levels button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('on', Number(buttons[i].dataset.level) === level);
    }
    document.getElementById('levelName').textContent = LEVEL_NAME[level];
    if (thinking) describeTurn();
  }

  function setColor(color) {
    userColor = color;
    document.getElementById('playWhite').classList.toggle('on', color === E.WHITE);
    document.getElementById('playBlack').classList.toggle('on', color === E.BLACK);
    try { localStorage.setItem('shockerChessColor', color === E.WHITE ? 'w' : 'b'); } catch (err) {}
    newGame();
  }

  function bootLevels() {
    var box = document.getElementById('levels');
    for (var n = 1; n <= 10; n++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.level = String(n);
      btn.textContent = String(n);
      btn.addEventListener('click', function (ev) { setLevel(Number(ev.currentTarget.dataset.level)); });
      box.appendChild(btn);
    }
  }

  function money(n, digits) {
    if (n == null || isNaN(n)) return '—';
    return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  }

  function priceText(n) {
    if (n == null || isNaN(n)) return '—';
    if (n >= 1) return money(n, 2);
    return '$' + Number(n).toFixed(8);
  }

  function renderMarket(m) {
    var changeClass = m.change > 0 ? 'up' : m.change < 0 ? 'down' : '';
    var change = (m.change > 0 ? '+' : '') + Number(m.change).toFixed(2) + '%';
    var rows = [
      ['Price', priceText(m.price)],
      ['24h', change],
      ['Market cap', money(m.mcap, 0)],
      ['Liquidity', money(m.liq, 0)],
      ['Volume 24h', money(m.vol, 0)],
      ['Supply', '1,000,000,000']
    ];
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      var cls = rows[i][0] === '24h' ? changeClass : '';
      html += '<div class="stat"><span>' + rows[i][0] + '</span><b class="' + cls + '">' + rows[i][1] + '</b></div>';
    }
    document.getElementById('stats').innerHTML = html;
    document.getElementById('marketNote').textContent = m.live
      ? 'Price, 24h change, market cap, liquidity, and volume are live from DexScreener. Name, mint, supply, and description are the TRiX token record.'
      : 'Showing the 4 Oct 2026 DexScreener snapshot. Live refresh did not load. Name, mint, supply, and description are the TRiX token record.';
  }

  function fillIdentity() {
    document.getElementById('desc').textContent = 'Original meme from early 2000s internet and normie culture. Timeless classic. The shocker is a hand gesture made by extending the index, middle, and little fingers while curling the ring finger and thumb down. Once you see it you instantly know. 2 in the PINK 1 in the STINK.';
    document.getElementById('meta').textContent = 'Created 3 Sep 2026 by 2RICH (verified). Mint decimals 6. Graduated on TRiX LaunchLab to a Raydium CPMM pool. Creator wallet 5BDW4oMwgd2o33uJRKpVPXbbDaXKeuZ9Xk68jagFzM3f.';
    var logo = document.getElementById('tokenLogo');
    logo.addEventListener('error', function () {
      logo.src = ASSET + 'emblem.png';
    });
  }

  function loadMarket() {
    renderMarket(SNAP);
    fetch('https://api.dexscreener.com/latest/dex/tokens/' + MINT)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var pairs = (j && j.pairs) || [];
        pairs.sort(function (a, b) { return ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0); });
        var p = pairs[0];
        if (!p) return;
        renderMarket({
          price: Number(p.priceUsd),
          change: Number(p.priceChange && p.priceChange.h24),
          mcap: Number(p.marketCap),
          liq: Number(p.liquidity && p.liquidity.usd),
          vol: Number(p.volume && p.volume.h24),
          live: true
        });
      })
      .catch(function () { renderMarket(SNAP); });
  }

  document.getElementById('newGame').addEventListener('click', newGame);
  document.getElementById('undo').addEventListener('click', undo);
  document.getElementById('playWhite').addEventListener('click', function () { setColor(E.WHITE); });
  document.getElementById('playBlack').addEventListener('click', function () { setColor(E.BLACK); });
  document.getElementById('mute').addEventListener('click', function (e) {
    muted = !muted;
    e.currentTarget.textContent = muted ? 'Sound off' : 'Sound on';
    e.currentTarget.setAttribute('aria-pressed', muted ? 'true' : 'false');
  });
  document.getElementById('copyMint').addEventListener('click', function () {
    var btn = document.getElementById('copyMint');
    var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1200); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(MINT).then(done);
    else done();
  });
  document.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key >= '1' && e.key <= '9') setLevel(Number(e.key));
    else if (e.key === '0') setLevel(10);
    else if (e.key === 'u' || e.key === 'U') undo();
    else if (e.key === 'n' || e.key === 'N') newGame();
    else if (e.key === 'Escape') {
      selected = null;
      pending = null;
      hidePromo();
      render();
    }
  });

  try {
    var savedLevel = Number(localStorage.getItem('shockerChessLevel'));
    if (savedLevel >= 1 && savedLevel <= 10) level = savedLevel;
    if (localStorage.getItem('shockerChessColor') === 'b') userColor = E.BLACK;
  } catch (err) {}

  promoEl.addEventListener('click', function (e) {
    if (e.target !== promoEl) return;
    pending = null;
    selected = null;
    hidePromo();
    render();
  });

  bootLevels();
  setLevel(level);
  document.getElementById('playWhite').classList.toggle('on', userColor === E.WHITE);
  document.getElementById('playBlack').classList.toggle('on', userColor === E.BLACK);
  fillIdentity();
  loadMarket();
  newGame();

  window.__shocker = {
    fen: function () { return E.toFen(pos); },
    play: function (uci) {
      var move = E.fromUci(pos, uci);
      if (!move || pos.turn !== userColor || thinking) return E.toFen(pos);
      commit(move, userColor);
      return E.toFen(pos);
    },
    level: function () { return level; },
    thinking: function () { return thinking; }
  };
})();
