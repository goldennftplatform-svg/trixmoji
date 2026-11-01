/**
 * $SHOCKER CHESS engine.
 * 0x88 board, legal move generation, and a depth-limited search for levels 1–10.
 * Works in the page, in a Web Worker, and under Node.
 */
(function (root) {
  'use strict';

  var WHITE = 0;
  var BLACK = 1;
  var PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
  var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var INF = 100000;
  var MATE = 29000;

  var VAL = [0, 100, 320, 330, 500, 900, 20000];
  var LETTER = { 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };
  var PROMO_CH = { 2: 'n', 3: 'b', 4: 'r', 5: 'q' };
  var PROMO_FROM = { n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN };

  var KNIGHT_D = [14, 18, 31, 33, -14, -18, -31, -33];
  var BISHOP_D = [15, 17, -15, -17];
  var ROOK_D = [1, -1, 16, -16];
  var KING_D = [1, -1, 16, -16, 15, 17, -15, -17];

  // Piece-square tables, rank 1 first, a-file first. Mirrored for black.
  var PST = {
    1: [
      0, 0, 0, 0, 0, 0, 0, 0,
      4, 6, 8, -12, -12, 8, 6, 4,
      4, 2, 4, 8, 8, 4, 2, 4,
      2, 2, 8, 18, 18, 8, 2, 2,
      6, 6, 12, 22, 22, 12, 6, 6,
      12, 12, 18, 28, 28, 18, 12, 12,
      40, 40, 40, 40, 40, 40, 40, 40,
      0, 0, 0, 0, 0, 0, 0, 0
    ],
    2: [
      -50, -40, -30, -30, -30, -30, -40, -50,
      -40, -20, 0, 0, 0, 0, -20, -40,
      -30, 0, 12, 16, 16, 12, 0, -30,
      -30, 6, 16, 22, 22, 16, 6, -30,
      -30, 0, 16, 22, 22, 16, 0, -30,
      -30, 6, 12, 16, 16, 12, 6, -30,
      -40, -20, 0, 6, 6, 0, -20, -40,
      -50, -40, -30, -30, -30, -30, -40, -50
    ],
    3: [
      -18, -8, -8, -8, -8, -8, -8, -18,
      -8, 0, 0, 0, 0, 0, 0, -8,
      -8, 0, 6, 8, 8, 6, 0, -8,
      -8, 4, 6, 10, 10, 6, 4, -8,
      -8, 0, 8, 10, 10, 8, 0, -8,
      -8, 8, 8, 8, 8, 8, 8, -8,
      -8, 4, 0, 0, 0, 0, 4, -8,
      -18, -8, -8, -8, -8, -8, -8, -18
    ],
    4: [
      0, 0, 0, 4, 4, 0, 0, 0,
      -4, 0, 0, 0, 0, 0, 0, -4,
      -4, 0, 0, 0, 0, 0, 0, -4,
      -4, 0, 0, 0, 0, 0, 0, -4,
      -4, 0, 0, 0, 0, 0, 0, -4,
      -4, 0, 0, 0, 0, 0, 0, -4,
      6, 10, 10, 10, 10, 10, 10, 6,
      0, 0, 0, 0, 0, 0, 0, 0
    ],
    5: [
      -20, -10, -10, -6, -6, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 6, 6, 6, 6, 0, -10,
      -6, 0, 6, 8, 8, 6, 0, -6,
      -6, 0, 6, 8, 8, 6, 0, -6,
      -10, 0, 6, 6, 6, 6, 0, -10,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -20, -10, -10, -6, -6, -10, -10, -20
    ],
    6: [
      16, 26, 8, 0, 0, 8, 26, 16,
      12, 16, -4, -8, -8, -4, 16, 12,
      -8, -16, -20, -24, -24, -20, -16, -8,
      -16, -24, -28, -32, -32, -28, -24, -16,
      -20, -28, -32, -36, -36, -32, -28, -20,
      -24, -32, -36, -40, -40, -36, -32, -24,
      -28, -36, -40, -44, -44, -40, -36, -28,
      -32, -40, -44, -48, -48, -44, -40, -32
    ]
  };

  var LEVELS = {
    1: { depth: 1, noise: 1, qs: false, ms: 30, window: 0 },
    2: { depth: 1, noise: 0.62, qs: false, ms: 50, window: 80 },
    3: { depth: 2, noise: 0.34, qs: false, ms: 140, window: 50 },
    4: { depth: 2, noise: 0.14, qs: false, ms: 220, window: 36 },
    5: { depth: 3, noise: 0.05, qs: false, ms: 420, window: 28 },
    6: { depth: 3, noise: 0, qs: true, ms: 650, window: 22 },
    7: { depth: 3, noise: 0, qs: true, ms: 900, window: 16 },
    8: { depth: 4, noise: 0, qs: true, ms: 1400, window: 14 },
    9: { depth: 4, noise: 0, qs: true, ms: 2000, window: 10 },
    10: { depth: 5, noise: 0, qs: true, ms: 2800, window: 8 }
  };

  function pieceChar(p) {
    if (!p) return '';
    var ch = 'pnbrqk'.charAt((p & 7) - 1);
    return (p >> 3) === WHITE ? ch.toUpperCase() : ch;
  }

  function charPiece(ch) {
    var lower = ch.toLowerCase();
    var type = 'pnbrqk'.indexOf(lower) + 1;
    var color = ch === lower ? BLACK : WHITE;
    return type | (color << 3);
  }

  function typeOf(p) { return p & 7; }
  function colorOf(p) { return p >> 3; }
  function onBoard(sq) { return (sq & 0x88) === 0; }
  function fileOf(sq) { return sq & 7; }
  function rankOf(sq) { return sq >> 4; }
  function sqName(sq) { return 'abcdefgh'[fileOf(sq)] + (rankOf(sq) + 1); }
  function nameSq(name) {
    if (!name || name === '-') return -1;
    return (name.charCodeAt(0) - 97) + ((name.charCodeAt(1) - 49) << 4);
  }

  function emptyPos() {
    return {
      b: new Uint8Array(128),
      turn: WHITE,
      rights: 0,
      ep: -1,
      half: 0,
      full: 1,
      king: [-1, -1]
    };
  }

  function parseFen(fen) {
    var parts = fen.trim().split(/\s+/);
    var pos = emptyPos();
    var sq = 0x70;
    var board = parts[0];
    for (var i = 0; i < board.length; i++) {
      var ch = board.charAt(i);
      if (ch === '/') sq = ((sq >> 4) - 1) << 4;
      else if (ch >= '1' && ch <= '8') sq += ch.charCodeAt(0) - 48;
      else {
        var p = charPiece(ch);
        pos.b[sq] = p;
        if (typeOf(p) === KING) pos.king[colorOf(p)] = sq;
        sq++;
      }
    }
    pos.turn = parts[1] === 'b' ? BLACK : WHITE;
    var rights = parts[2] || '-';
    if (rights.indexOf('K') >= 0) pos.rights |= 1;
    if (rights.indexOf('Q') >= 0) pos.rights |= 2;
    if (rights.indexOf('k') >= 0) pos.rights |= 4;
    if (rights.indexOf('q') >= 0) pos.rights |= 8;
    pos.ep = nameSq(parts[3] || '-');
    pos.half = parseInt(parts[4] || '0', 10) || 0;
    pos.full = parseInt(parts[5] || '1', 10) || 1;
    return pos;
  }

  function toFen(pos) {
    var rows = [];
    for (var rank = 7; rank >= 0; rank--) {
      var row = '';
      var empty = 0;
      for (var file = 0; file < 8; file++) {
        var p = pos.b[(rank << 4) | file];
        if (!p) empty++;
        else {
          if (empty) { row += empty; empty = 0; }
          row += pieceChar(p);
        }
      }
      if (empty) row += empty;
      rows.push(row);
    }
    var rights = '';
    if (pos.rights & 1) rights += 'K';
    if (pos.rights & 2) rights += 'Q';
    if (pos.rights & 4) rights += 'k';
    if (pos.rights & 8) rights += 'q';
    if (!rights) rights = '-';
    return rows.join('/') + ' ' + (pos.turn === WHITE ? 'w' : 'b') + ' ' + rights + ' ' +
      (pos.ep < 0 ? '-' : sqName(pos.ep)) + ' ' + pos.half + ' ' + pos.full;
  }

  function startPos() { return parseFen(START); }

  function attacked(pos, sq, by) {
    var b = pos.b;
    var pawnDir = by === WHITE ? -1 : 1;
    var p1 = sq + pawnDir * 15;
    var p2 = sq + pawnDir * 17;
    if (onBoard(p1) && b[p1] === (PAWN | (by << 3))) return true;
    if (onBoard(p2) && b[p2] === (PAWN | (by << 3))) return true;
    var i, from, step, p;
    for (i = 0; i < 8; i++) {
      from = sq + KNIGHT_D[i];
      if (onBoard(from) && b[from] === (KNIGHT | (by << 3))) return true;
    }
    for (i = 0; i < 8; i++) {
      from = sq + KING_D[i];
      if (onBoard(from) && b[from] === (KING | (by << 3))) return true;
    }
    for (i = 0; i < 4; i++) {
      step = BISHOP_D[i];
      for (from = sq + step; onBoard(from); from += step) {
        p = b[from];
        if (!p) continue;
        if (colorOf(p) === by && (typeOf(p) === BISHOP || typeOf(p) === QUEEN)) return true;
        break;
      }
    }
    for (i = 0; i < 4; i++) {
      step = ROOK_D[i];
      for (from = sq + step; onBoard(from); from += step) {
        p = b[from];
        if (!p) continue;
        if (colorOf(p) === by && (typeOf(p) === ROOK || typeOf(p) === QUEEN)) return true;
        break;
      }
    }
    return false;
  }

  function inCheck(pos, color) {
    var c = color == null ? pos.turn : color;
    return attacked(pos, pos.king[c], c ^ 1);
  }

  function addMove(list, from, to, piece, captured, promo, castle, ep) {
    list.push({
      from: from,
      to: to,
      piece: piece,
      captured: captured || 0,
      promo: promo || 0,
      castle: castle || 0,
      ep: !!ep
    });
  }

  function pseudo(pos) {
    var list = [];
    var b = pos.b;
    var me = pos.turn;
    var them = me ^ 1;
    var push = me === WHITE ? 16 : -16;
    var startRank = me === WHITE ? 1 : 6;
    var i, sq, p, type, d, to, nxt, cap, rank;
    for (sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      p = b[sq];
      if (!p || colorOf(p) !== me) continue;
      type = typeOf(p);
      if (type === PAWN) {
        to = sq + push;
        if (onBoard(to) && !b[to]) {
          rank = rankOf(to);
          if ((me === WHITE && rank === 7) || (me === BLACK && rank === 0)) {
            addMove(list, sq, to, p, 0, QUEEN, 0, 0);
            addMove(list, sq, to, p, 0, ROOK, 0, 0);
            addMove(list, sq, to, p, 0, BISHOP, 0, 0);
            addMove(list, sq, to, p, 0, KNIGHT, 0, 0);
          } else {
            addMove(list, sq, to, p, 0, 0, 0, 0);
            if (rankOf(sq) === startRank) {
              nxt = to + push;
              if (onBoard(nxt) && !b[nxt]) addMove(list, sq, nxt, p, 0, 0, 0, 0);
            }
          }
        }
        for (d = 0; d < 2; d++) {
          to = sq + push + (d === 0 ? -1 : 1);
          if (!onBoard(to)) continue;
          if (pos.ep === to) {
            addMove(list, sq, to, p, PAWN | (them << 3), 0, 0, 1);
            continue;
          }
          cap = b[to];
          if (cap && colorOf(cap) === them) {
            rank = rankOf(to);
            if ((me === WHITE && rank === 7) || (me === BLACK && rank === 0)) {
              addMove(list, sq, to, p, cap, QUEEN, 0, 0);
              addMove(list, sq, to, p, cap, ROOK, 0, 0);
              addMove(list, sq, to, p, cap, BISHOP, 0, 0);
              addMove(list, sq, to, p, cap, KNIGHT, 0, 0);
            } else addMove(list, sq, to, p, cap, 0, 0, 0);
          }
        }
      } else if (type === KNIGHT) {
        for (d = 0; d < 8; d++) {
          to = sq + KNIGHT_D[d];
          if (!onBoard(to)) continue;
          cap = b[to];
          if (!cap || colorOf(cap) === them) addMove(list, sq, to, p, cap, 0, 0, 0);
        }
      } else if (type === KING) {
        for (d = 0; d < 8; d++) {
          to = sq + KING_D[d];
          if (!onBoard(to)) continue;
          cap = b[to];
          if (!cap || colorOf(cap) === them) addMove(list, sq, to, p, cap, 0, 0, 0);
        }
        if (!attacked(pos, sq, them)) {
          if (me === WHITE && (pos.rights & 1) && b[0x07] === (ROOK | (WHITE << 3)) && !b[0x05] && !b[0x06] &&
              !attacked(pos, 0x05, them) && !attacked(pos, 0x06, them)) {
            addMove(list, sq, 0x06, p, 0, 0, 1, 0);
          }
          if (me === WHITE && (pos.rights & 2) && b[0x00] === (ROOK | (WHITE << 3)) && !b[0x01] && !b[0x02] && !b[0x03] &&
              !attacked(pos, 0x03, them) && !attacked(pos, 0x02, them)) {
            addMove(list, sq, 0x02, p, 0, 0, 2, 0);
          }
          if (me === BLACK && (pos.rights & 4) && b[0x77] === (ROOK | (BLACK << 3)) && !b[0x75] && !b[0x76] &&
              !attacked(pos, 0x75, them) && !attacked(pos, 0x76, them)) {
            addMove(list, sq, 0x76, p, 0, 0, 1, 0);
          }
          if (me === BLACK && (pos.rights & 8) && b[0x70] === (ROOK | (BLACK << 3)) && !b[0x71] && !b[0x72] && !b[0x73] &&
              !attacked(pos, 0x73, them) && !attacked(pos, 0x72, them)) {
            addMove(list, sq, 0x72, p, 0, 0, 2, 0);
          }
        }
      } else {
        var deltas = type === BISHOP ? BISHOP_D : type === ROOK ? ROOK_D : KING_D;
        var n = type === QUEEN ? 8 : 4;
        if (type === QUEEN) deltas = KING_D;
        for (d = 0; d < n; d++) {
          var step = deltas[d];
          for (to = sq + step; onBoard(to); to += step) {
            cap = b[to];
            if (!cap) addMove(list, sq, to, p, 0, 0, 0, 0);
            else {
              if (colorOf(cap) === them) addMove(list, sq, to, p, cap, 0, 0, 0);
              break;
            }
          }
        }
      }
    }
    return list;
  }

  function make(pos, m) {
    var undo = {
      from: m.from,
      to: m.to,
      piece: m.piece,
      captured: m.captured,
      promo: m.promo,
      castle: m.castle,
      ep: m.ep,
      rights: pos.rights,
      epSq: pos.ep,
      half: pos.half,
      full: pos.full,
      turn: pos.turn,
      kingSq: pos.king[colorOf(m.piece)],
      rookFrom: -1,
      rookTo: -1,
      victim: -1
    };
    var b = pos.b;
    var me = pos.turn;
    b[m.from] = 0;
    if (m.ep) {
      undo.victim = m.to + (me === WHITE ? -16 : 16);
      b[undo.victim] = 0;
    }
    var placed = m.promo ? (m.promo | (me << 3)) : m.piece;
    b[m.to] = placed;
    if (typeOf(m.piece) === KING) pos.king[me] = m.to;
    if (m.castle) {
      if (me === WHITE && m.castle === 1) { undo.rookFrom = 0x07; undo.rookTo = 0x05; }
      else if (me === WHITE && m.castle === 2) { undo.rookFrom = 0x00; undo.rookTo = 0x03; }
      else if (me === BLACK && m.castle === 1) { undo.rookFrom = 0x77; undo.rookTo = 0x75; }
      else { undo.rookFrom = 0x70; undo.rookTo = 0x73; }
      b[undo.rookTo] = b[undo.rookFrom];
      b[undo.rookFrom] = 0;
    }
    var rights = pos.rights;
    if (typeOf(m.piece) === KING) {
      if (me === WHITE) rights &= ~3;
      else rights &= ~12;
    }
    if (m.from === 0x07 || m.to === 0x07) rights &= ~1;
    if (m.from === 0x00 || m.to === 0x00) rights &= ~2;
    if (m.from === 0x77 || m.to === 0x77) rights &= ~4;
    if (m.from === 0x70 || m.to === 0x70) rights &= ~8;
    pos.rights = rights;
    if (typeOf(m.piece) === PAWN && Math.abs(m.to - m.from) === 32) pos.ep = (m.from + m.to) >> 1;
    else pos.ep = -1;
    if (typeOf(m.piece) === PAWN || m.captured || m.ep) pos.half = 0;
    else pos.half++;
    if (me === BLACK) pos.full++;
    pos.turn = me ^ 1;
    return undo;
  }

  function unmake(pos, u) {
    var b = pos.b;
    var me = u.turn;
    pos.turn = me;
    pos.rights = u.rights;
    pos.ep = u.epSq;
    pos.half = u.half;
    pos.full = u.full;
    pos.king[me] = u.kingSq;
    if (u.rookFrom >= 0) {
      b[u.rookFrom] = b[u.rookTo];
      b[u.rookTo] = 0;
    }
    b[u.from] = u.piece;
    b[u.to] = u.ep ? 0 : u.captured;
    if (u.ep) b[u.victim] = u.captured;
  }

  function legalMoves(pos) {
    var pseudoMoves = pseudo(pos);
    var out = [];
    for (var i = 0; i < pseudoMoves.length; i++) {
      var m = pseudoMoves[i];
      var u = make(pos, m);
      var ok = !attacked(pos, pos.king[u.turn], pos.turn);
      unmake(pos, u);
      if (ok) out.push(m);
    }
    return out;
  }

  function sameMove(a, b) {
    return a.from === b.from && a.to === b.to && a.promo === b.promo && a.castle === b.castle && a.ep === b.ep;
  }

  function toUci(m) {
    return sqName(m.from) + sqName(m.to) + (m.promo ? PROMO_CH[m.promo] : '');
  }

  function fromUci(pos, uci) {
    var moves = legalMoves(pos);
    for (var i = 0; i < moves.length; i++) {
      if (toUci(moves[i]) === uci) return moves[i];
    }
    return null;
  }

  function toSan(pos, move) {
    var moves = legalMoves(pos);
    var m = null;
    for (var i = 0; i < moves.length; i++) if (sameMove(moves[i], move)) m = moves[i];
    if (!m) m = move;
    var base;
    if (m.castle === 1) base = 'O-O';
    else if (m.castle === 2) base = 'O-O-O';
    else {
      var type = typeOf(m.piece);
      base = '';
      if (type !== PAWN) {
        base = LETTER[type];
        var fileClash = false;
        var rankClash = false;
        var others = false;
        for (i = 0; i < moves.length; i++) {
          var o = moves[i];
          if (sameMove(o, m) || typeOf(o.piece) !== type || o.to !== m.to) continue;
          others = true;
          if (fileOf(o.from) === fileOf(m.from)) fileClash = true;
          else rankClash = true;
        }
        if (others) {
          if (!fileClash) base += 'abcdefgh'[fileOf(m.from)];
          else if (fileClash && !rankClash) base += String(rankOf(m.from) + 1);
          else base += sqName(m.from);
        }
      } else if (m.captured || m.ep) {
        base += 'abcdefgh'[fileOf(m.from)];
      }
      if (m.captured || m.ep) base += 'x';
      base += sqName(m.to);
      if (m.promo) base += '=' + LETTER[m.promo];
    }
    var u = make(pos, m);
    var check = inCheck(pos);
    var over = legalMoves(pos).length === 0;
    unmake(pos, u);
    if (over && check) base += '#';
    else if (check) base += '+';
    return base;
  }

  function insufficient(pos) {
    var minors = [];
    for (var sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      var p = pos.b[sq];
      if (!p || typeOf(p) === KING) continue;
      var t = typeOf(p);
      if (t === PAWN || t === ROOK || t === QUEEN) return false;
      minors.push({ t: t, c: colorOf(p), sq: sq });
    }
    if (minors.length === 0) return true;
    if (minors.length === 1) return true;
    if (minors.length === 2 && minors[0].t === BISHOP && minors[1].t === BISHOP) {
      var s0 = (fileOf(minors[0].sq) + rankOf(minors[0].sq)) & 1;
      var s1 = (fileOf(minors[1].sq) + rankOf(minors[1].sq)) & 1;
      if (s0 === s1 && minors[0].c !== minors[1].c) return true;
    }
    return false;
  }

  function outcome(pos, reps) {
    var moves = legalMoves(pos);
    if (!moves.length) {
      if (inCheck(pos)) return { over: true, reason: 'checkmate', winner: pos.turn ^ 1 };
      return { over: true, reason: 'stalemate', winner: null };
    }
    if (pos.half >= 100) return { over: true, reason: 'fifty-move', winner: null };
    if (insufficient(pos)) return { over: true, reason: 'insufficient', winner: null };
    if (reps && reps >= 3) return { over: true, reason: 'repetition', winner: null };
    return { over: false, reason: inCheck(pos) ? 'check' : '', winner: null };
  }

  function evaluate(pos) {
    var score = 0;
    for (var sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      var p = pos.b[sq];
      if (!p) continue;
      var type = typeOf(p);
      var color = colorOf(p);
      var rank = rankOf(sq);
      var r = color === WHITE ? rank : 7 - rank;
      var add = VAL[type] + PST[type][r * 8 + fileOf(sq)];
      score += color === WHITE ? add : -add;
    }
    return pos.turn === WHITE ? score : -score;
  }

  function mvv(m) {
    var s = 0;
    if (m.promo) s += 800 + VAL[m.promo];
    if (m.captured) s += 10 * VAL[typeOf(m.captured)] - VAL[typeOf(m.piece)];
    if (m.ep) s += 10 * VAL[PAWN];
    return s;
  }

  var deadline = 0;
  var expired = false;
  var nodes = 0;
  var useQs = false;

  function negamax(pos, depth, alpha, beta, ply) {
    if ((nodes & 255) === 0 && Date.now() > deadline) {
      expired = true;
      return 0;
    }
    nodes++;
    if (depth <= 0) return useQs ? quiesce(pos, alpha, beta, ply, 0) : evaluate(pos);
    var moves = legalMoves(pos);
    if (!moves.length) {
      if (inCheck(pos)) return -MATE + ply;
      return 0;
    }
    moves.sort(function (a, b) { return mvv(b) - mvv(a); });
    var best = -INF;
    for (var i = 0; i < moves.length; i++) {
      var u = make(pos, moves[i]);
      var score = -negamax(pos, depth - 1, -beta, -alpha, ply + 1);
      unmake(pos, u);
      if (expired) return 0;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }

  function quiesce(pos, alpha, beta, ply, qply) {
    nodes++;
    var stand = evaluate(pos);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (qply >= 6) return alpha;
    if ((nodes & 255) === 0 && Date.now() > deadline) {
      expired = true;
      return alpha;
    }
    var moves = legalMoves(pos);
    var caps = [];
    for (var i = 0; i < moves.length; i++) {
      if (moves[i].captured || moves[i].ep || moves[i].promo) caps.push(moves[i]);
    }
    caps.sort(function (a, b) { return mvv(b) - mvv(a); });
    for (i = 0; i < caps.length; i++) {
      var u = make(pos, caps[i]);
      var score = -quiesce(pos, -beta, -alpha, ply + 1, qply + 1);
      unmake(pos, u);
      if (expired) return alpha;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function search(pos, level) {
    level = Math.max(1, Math.min(10, level | 0));
    var cfg = LEVELS[level];
    var moves = legalMoves(pos);
    if (!moves.length) return null;
    if (cfg.noise >= 1 || (cfg.noise > 0 && Math.random() < cfg.noise)) {
      var pick = moves[(Math.random() * moves.length) | 0];
      return { move: pick, uci: toUci(pick), san: toSan(pos, pick), depth: 0, score: 0, nodes: 0 };
    }
    deadline = Date.now() + cfg.ms;
    expired = false;
    nodes = 0;
    useQs = !!cfg.qs;
    var best = moves[0];
    var completed = 0;
    var finishedScores = null;
    var finishedBest = best;
    for (var d = 1; d <= cfg.depth; d++) {
      if (Date.now() > deadline && completed >= 1) break;
      var localBest = null;
      var localScore = -INF;
      var scores = new Array(moves.length);
      var ordered = moves.slice().sort(function (a, b) {
        if (sameMove(a, best)) return -1;
        if (sameMove(b, best)) return 1;
        return mvv(b) - mvv(a);
      });
      var aborted = false;
      for (var i = 0; i < ordered.length; i++) {
        if (Date.now() > deadline && completed >= 1 && i > 0) { aborted = true; break; }
        var u = make(pos, ordered[i]);
        var score = -negamax(pos, d - 1, -INF, INF, 1);
        unmake(pos, u);
        if (expired) { aborted = true; break; }
        scores[i] = score;
        if (score > localScore) {
          localScore = score;
          localBest = ordered[i];
        }
      }
      if (!aborted && localBest) {
        best = localBest;
        completed = d;
        finishedBest = localBest;
        finishedScores = { moves: ordered, scores: scores, best: localScore };
      } else break;
    }
    var choice = finishedBest;
    if (finishedScores && cfg.window > 0) {
      var pool = [];
      for (i = 0; i < finishedScores.moves.length; i++) {
        if (finishedScores.scores[i] >= finishedScores.best - cfg.window) pool.push(finishedScores.moves[i]);
      }
      if (pool.length) choice = pool[(Math.random() * pool.length) | 0];
    }
    return {
      move: choice,
      uci: toUci(choice),
      san: toSan(pos, choice),
      depth: completed,
      score: finishedScores ? finishedScores.best : 0,
      nodes: nodes
    };
  }

  function perft(pos, depth) {
    if (depth === 0) return 1;
    var moves = legalMoves(pos);
    if (depth === 1) return moves.length;
    var n = 0;
    for (var i = 0; i < moves.length; i++) {
      var u = make(pos, moves[i]);
      n += perft(pos, depth - 1);
      unmake(pos, u);
    }
    return n;
  }

  function keyOf(pos) {
    // Repetition key: placement, turn, rights, ep. Not the clocks.
    return toFen(pos).split(' ').slice(0, 4).join(' ');
  }

  var API = {
    WHITE: WHITE,
    BLACK: BLACK,
    PAWN: PAWN,
    KNIGHT: KNIGHT,
    BISHOP: BISHOP,
    ROOK: ROOK,
    QUEEN: QUEEN,
    KING: KING,
    START: START,
    LEVELS: LEVELS,
    parseFen: parseFen,
    toFen: toFen,
    startPos: startPos,
    legalMoves: legalMoves,
    make: make,
    unmake: unmake,
    inCheck: inCheck,
    outcome: outcome,
    insufficient: insufficient,
    toUci: toUci,
    fromUci: fromUci,
    toSan: toSan,
    search: search,
    perft: perft,
    sqName: sqName,
    nameSq: nameSq,
    keyOf: keyOf,
    typeOf: typeOf,
    colorOf: colorOf,
    pieceChar: pieceChar
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
    self.onmessage = function (e) {
      var data = e.data || {};
      try {
        var pos = parseFen(data.fen);
        var result = search(pos, data.level);
        self.postMessage({
          id: data.id,
          uci: result ? result.uci : null,
          san: result ? result.san : null,
          depth: result ? result.depth : 0,
          score: result ? result.score : 0
        });
      } catch (err) {
        self.postMessage({ id: data.id, error: String(err && err.message || err) });
      }
    };
  } else {
    root.ShockerChess = API;
  }
})(typeof self !== 'undefined' ? self : this);
