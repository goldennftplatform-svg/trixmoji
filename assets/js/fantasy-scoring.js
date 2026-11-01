;(function (root) {
  'use strict'

  function clone(o) {
    return JSON.parse(JSON.stringify(o))
  }

  function paBands(rows) {
    return rows.map(function (r) {
      return { lo: r[0], hi: r[1], pts: r[2] }
    })
  }

  var BASE = {
    passYdPer: 25,
    passTd: 4,
    int: -2,
    sack: 0,
    rushYdPer: 10,
    rushTd: 6,
    rec: 0,
    recYdPer: 10,
    recTd: 6,
    teRec: null,
    twoPt: 2,
    fumLost: -2,
    retTd: 6,
    passBonus300: 0,
    passBonus400: 0,
    rushBonus100: 0,
    recBonus100: 0,
    longTd40: 0,
    longTd50: 0,
    xp: 1,
    fg0_39: 3,
    fg40_49: 4,
    fg50: 5,
    fgMiss: 0,
    dstSack: 1,
    dstInt: 2,
    dstFr: 2,
    dstTd: 6,
    dstSafety: 2,
    dstBlock: 2,
    idpSolo: 1,
    idpAst: 0.5,
    idpSack: 2,
    idpInt: 3,
    idpFf: 2,
    idpFr: 2,
    idpPd: 1,
    idpTd: 6,
    captainMult: 1,
    pa: paBands([
      [0, 0, 10],
      [1, 6, 7],
      [7, 13, 4],
      [14, 20, 1],
      [21, 27, 0],
      [28, 34, -1],
      [35, 99, -4]
    ])
  }

  var ESPN_PA = paBands([
    [0, 0, 5],
    [1, 6, 4],
    [7, 13, 3],
    [14, 17, 1],
    [18, 27, 0],
    [28, 34, -1],
    [35, 45, -3],
    [46, 99, -5]
  ])

  var PRESETS = {
    espn_half: Object.assign(clone(BASE), {
      id: 'espn_half',
      label: 'ESPN Half-PPR',
      ref: 'ESPN default (half-PPR, 4-pt pass TD, INT -2)',
      rec: 0.5,
      pa: ESPN_PA
    }),
    yahoo_half: Object.assign(clone(BASE), {
      id: 'yahoo_half',
      label: 'Yahoo Half-PPR',
      ref: 'Yahoo default (half-PPR, 4-pt pass TD, INT -1)',
      rec: 0.5,
      int: -1
    }),
    nfl_ppr: Object.assign(clone(BASE), {
      id: 'nfl_ppr',
      label: 'NFL.com PPR',
      ref: 'NFL Fantasy default (full PPR, 4-pt pass TD, INT -2)',
      rec: 1
    }),
    sleeper_ppr: Object.assign(clone(BASE), {
      id: 'sleeper_ppr',
      label: 'Sleeper PPR',
      ref: 'Sleeper common (full PPR, 4-pt pass TD)',
      rec: 1
    }),
    standard: Object.assign(clone(BASE), {
      id: 'standard',
      label: 'Standard / Non-PPR',
      ref: 'Classic Yahoo-style (0 PPR, yards + TDs only)',
      rec: 0,
      int: -2
    }),
    te_premium: Object.assign(clone(BASE), {
      id: 'te_premium',
      label: 'TE Premium PPR',
      ref: 'Sleeper / MFL style: WR/RB 1 PPR, TE 1.5 PPR',
      rec: 1,
      teRec: 1.5
    }),
    six_pt_qb: Object.assign(clone(BASE), {
      id: 'six_pt_qb',
      label: '6-Point Passing TD',
      ref: 'Half-PPR with 6-pt pass TDs (QB-heavy)',
      rec: 0.5,
      passTd: 6
    }),
    draftkings: Object.assign(clone(BASE), {
      id: 'draftkings',
      label: 'DraftKings-style',
      ref: 'DFS: full PPR, 4-pt pass TD, INT -1, 300-pass / 100-rush / 100-rec bonuses',
      rec: 1,
      int: -1,
      fumLost: -1,
      passBonus300: 3,
      rushBonus100: 3,
      recBonus100: 3
    }),
    fanduel: Object.assign(clone(BASE), {
      id: 'fanduel',
      label: 'FanDuel-style',
      ref: 'DFS: half-PPR, 4-pt pass TD, INT -1',
      rec: 0.5,
      int: -1
    }),
    idp: Object.assign(clone(BASE), {
      id: 'idp',
      label: 'IDP + Half-PPR',
      ref: 'ESPN custom IDP: solo/ast tackles, sacks, INTs instead of only DST',
      rec: 0.5,
      pa: ESPN_PA
    })
  }

  var ROSTERS = {
    classic: { id: 'classic', label: 'Classic', slots: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'DST'] },
    espn: { id: 'espn', label: 'ESPN / NFL (w/ K)', slots: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DST'] },
    superflex: { id: 'superflex', label: 'Superflex / 2QB', slots: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'SF', 'DST'] },
    idp: { id: 'idp', label: 'IDP', slots: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'DL', 'LB', 'DB'] },
    bestball: { id: 'bestball', label: 'Best Ball (no weekly lock)', slots: ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'DST'] }
  }

  function hash(s) {
    var h = 2166136261
    var str = String(s || '')
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }

  function rng(seed) {
    var x = seed || 1
    return function (n) {
      x = (x * 1664525 + 1013904223) >>> 0
      if (n == null) return x / 4294967296
      return x % n
    }
  }

  function weekStats(tag, pos) {
    var r = rng(hash(tag + '|' + pos + '|wk3'))
    var p = String(pos || '').toUpperCase()
    if (p === 'QB' || p === 'SF') {
      var att = 28 + r(12)
      var cmp = Math.min(att, 16 + r(12))
      var passYds = 180 + r(220)
      return {
        pos: p,
        att: att,
        cmp: cmp,
        passYds: passYds,
        passTd: r(5),
        int: r(3),
        sack: r(4),
        rushYds: r(55),
        rushTd: r(2) ? 0 : 1,
        rec: 0,
        recYds: 0,
        recTd: 0,
        fumLost: r(6) ? 0 : 1,
        twoPt: r(8) ? 0 : 1,
        longTd: r(5) ? 0 : 42 + r(20)
      }
    }
    if (p === 'DST') {
      var pa = r(42)
      return {
        pos: p,
        sack: r(6),
        int: r(3),
        fumRec: r(3),
        td: r(8) ? 0 : 1,
        safety: r(12) ? 0 : 1,
        block: r(10) ? 0 : 1,
        ptsAllowed: pa
      }
    }
    if (p === 'K') {
      var made = 1 + r(4)
      return {
        pos: p,
        xp: 1 + r(4),
        fg0_39: r(3),
        fg40_49: r(3),
        fg50: r(2),
        fgMiss: r(3) ? 0 : 1,
        made: made
      }
    }
    if (p === 'DL' || p === 'LB' || p === 'DB') {
      return {
        pos: p,
        solo: 2 + r(8),
        ast: r(6),
        sack: r(3) ? 0 : 1 + r(2) * 0.5,
        int: r(8) ? 0 : 1,
        ff: r(7) ? 0 : 1,
        fr: r(8) ? 0 : 1,
        pd: r(5),
        td: r(12) ? 0 : 1
      }
    }
    var rec = (p === 'RB' ? r(7) : 3 + r(9))
    var recYds = rec * (8 + r(12))
    var rushYds = p === 'RB' || p === 'FLEX' ? 20 + r(90) : r(25)
    return {
      pos: p,
      rushYds: rushYds,
      rushTd: r(5) ? 0 : 1,
      rec: rec,
      recYds: recYds,
      recTd: r(6) ? 0 : 1,
      fumLost: r(8) ? 0 : 1,
      twoPt: r(10) ? 0 : 1,
      longTd: r(6) ? 0 : 40 + r(25),
      passYds: 0,
      passTd: 0,
      int: 0
    }
  }

  function paPoints(rules, allowed) {
    var n = Number(allowed)
    if (!Number.isFinite(n)) return 0
    var bands = rules.pa || []
    for (var i = 0; i < bands.length; i++) {
      if (n >= bands[i].lo && n <= bands[i].hi) return bands[i].pts
    }
    return bands.length ? bands[bands.length - 1].pts : 0
  }

  function recPts(rules, pos, rec, tag) {
    var rate = rules.rec || 0
    var blob = String(pos || '') + ' ' + String(tag || '')
    if (rules.teRec != null && /\bTE\b/.test(blob)) rate = rules.teRec
    return rec * rate
  }

  function scoreLine(rules, stats) {
    stats = stats || {}
    var pos = String(stats.pos || '').toUpperCase()
    var lines = []
    function add(label, pts) {
      if (!pts) return
      lines.push({ label: label, pts: Number(pts.toFixed(2)) })
    }
    if (pos === 'DST') {
      add('Sack', (stats.sack || 0) * rules.dstSack)
      add('INT', (stats.int || 0) * rules.dstInt)
      add('Fumble rec', (stats.fumRec || 0) * rules.dstFr)
      add('TD', (stats.td || 0) * rules.dstTd)
      add('Safety', (stats.safety || 0) * rules.dstSafety)
      add('Block', (stats.block || 0) * rules.dstBlock)
      add('Pts allowed ' + (stats.ptsAllowed || 0), paPoints(rules, stats.ptsAllowed))
    } else if (pos === 'K') {
      add('XP', (stats.xp || 0) * rules.xp)
      add('FG 0-39', (stats.fg0_39 || 0) * rules.fg0_39)
      add('FG 40-49', (stats.fg40_49 || 0) * rules.fg40_49)
      add('FG 50+', (stats.fg50 || 0) * rules.fg50)
      add('FG miss', (stats.fgMiss || 0) * rules.fgMiss)
    } else if (pos === 'DL' || pos === 'LB' || pos === 'DB') {
      add('Solo', (stats.solo || 0) * rules.idpSolo)
      add('Ast', (stats.ast || 0) * rules.idpAst)
      add('Sack', (stats.sack || 0) * rules.idpSack)
      add('INT', (stats.int || 0) * rules.idpInt)
      add('FF', (stats.ff || 0) * rules.idpFf)
      add('FR', (stats.fr || 0) * rules.idpFr)
      add('PD', (stats.pd || 0) * rules.idpPd)
      add('TD', (stats.td || 0) * rules.idpTd)
    } else {
      add('Pass yds', (stats.passYds || 0) / rules.passYdPer)
      add('Pass TD', (stats.passTd || 0) * rules.passTd)
      add('INT', (stats.int || 0) * rules.int)
      add('Sack', (stats.sack || 0) * (rules.sack || 0))
      if (rules.passBonus300 && (stats.passYds || 0) >= 300) add('300+ pass', rules.passBonus300)
      if (rules.passBonus400 && (stats.passYds || 0) >= 400) add('400+ pass', rules.passBonus400)
      add('Rush yds', (stats.rushYds || 0) / rules.rushYdPer)
      add('Rush TD', (stats.rushTd || 0) * rules.rushTd)
      if (rules.rushBonus100 && (stats.rushYds || 0) >= 100) add('100+ rush', rules.rushBonus100)
      add('Rec', recPts(rules, pos, stats.rec || 0, stats.tag))
      add('Rec yds', (stats.recYds || 0) / rules.recYdPer)
      add('Rec TD', (stats.recTd || 0) * rules.recTd)
      if (rules.recBonus100 && (stats.recYds || 0) >= 100) add('100+ rec', rules.recBonus100)
      add('2-pt', (stats.twoPt || 0) * rules.twoPt)
      add('Fumble lost', (stats.fumLost || 0) * rules.fumLost)
      if ((stats.longTd || 0) >= 50 && rules.longTd50) add('50+ TD bonus', rules.longTd50)
      else if ((stats.longTd || 0) >= 40 && rules.longTd40) add('40+ TD bonus', rules.longTd40)
    }
    var total = lines.reduce(function (n, x) { return n + x.pts }, 0)
    if (rules.captainMult && rules.captainMult !== 1 && stats.captain) {
      var extra = total * (rules.captainMult - 1)
      add('Captain x' + rules.captainMult, extra)
      total += extra
    }
    return { total: Number(total.toFixed(2)), lines: lines, stats: stats }
  }

  function scoreSquad(rules, squad) {
    var rows = (squad || []).map(function (slot) {
      var stats = slot.stats || weekStats(slot.tag, slot.pos)
      var scored = scoreLine(rules, Object.assign({ pos: slot.pos, tag: slot.tag }, stats))
      return Object.assign({}, slot, { stats: stats, scored: scored })
    })
    var total = rows.reduce(function (n, r) { return n + r.scored.total }, 0)
    return { total: Number(total.toFixed(2)), rows: rows, rules: rules }
  }

  root.FantasyScoring = {
    PRESETS: PRESETS,
    ROSTERS: ROSTERS,
    weekStats: weekStats,
    scoreLine: scoreLine,
    scoreSquad: scoreSquad,
    paPoints: paPoints
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = root.FantasyScoring
})(typeof window !== 'undefined' ? window : globalThis)
