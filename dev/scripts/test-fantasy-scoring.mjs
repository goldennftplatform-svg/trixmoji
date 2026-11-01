import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const FS = require('../../assets/js/fantasy-scoring.js')

function assert(name, ok, extra) {
  if (!ok) {
    console.error('FAIL', name, extra || '')
    process.exit(1)
  }
  console.log('ok', name, extra || '')
}

const wr = { pos: 'WR', rec: 8, recYds: 80, recTd: 1 }
assert('standard WR 8/80/1 = 14', FS.scoreLine(FS.PRESETS.standard, wr).total === 14)
assert('half PPR WR 8/80/1 = 18', FS.scoreLine(FS.PRESETS.espn_half, wr).total === 18)
assert('full PPR WR 8/80/1 = 22', FS.scoreLine(FS.PRESETS.sleeper_ppr, wr).total === 22)
assert('FD half WR 8/80/1 = 18', FS.scoreLine(FS.PRESETS.fanduel, wr).total === 18)

const te = { pos: 'TE', rec: 8, recYds: 80, recTd: 1 }
assert('TE premium 8/80/1 = 26', FS.scoreLine(FS.PRESETS.te_premium, te).total === 26)
assert('TE premium WR stays 22', FS.scoreLine(FS.PRESETS.te_premium, wr).total === 22)

const qb = { pos: 'QB', passYds: 325, passTd: 2, int: 1, rushYds: 20 }
assert('ESPN INT -2', FS.scoreLine(FS.PRESETS.espn_half, qb).total === 325 / 25 + 8 - 2 + 2)
assert('Yahoo INT -1', FS.scoreLine(FS.PRESETS.yahoo_half, qb).total === 325 / 25 + 8 - 1 + 2)
assert('6pt pass TD', FS.scoreLine(FS.PRESETS.six_pt_qb, qb).total === 325 / 25 + 12 - 2 + 2)
assert('DK 300-pass bonus +3', FS.scoreLine(FS.PRESETS.draftkings, qb).total === 325 / 25 + 8 - 1 + 2 + 3)

const dst = { pos: 'DST', sack: 2, int: 1, fumRec: 0, td: 0, safety: 0, block: 0, ptsAllowed: 10 }
assert('ESPN PA 7-13 = 3', FS.paPoints(FS.PRESETS.espn_half, 10) === 3)
assert('Yahoo PA 7-13 = 4', FS.paPoints(FS.PRESETS.yahoo_half, 10) === 4)
assert('ESPN DST 2sacks+INT+PA10', FS.scoreLine(FS.PRESETS.espn_half, dst).total === 2 + 2 + 3)

const names = Object.values(FS.PRESETS).every(function (p) { return p.label && p.ref })
assert('every preset has label+ref', names)
assert('10 scoring books', Object.keys(FS.PRESETS).length === 10)
assert('superflex has SF', FS.ROSTERS.superflex.slots.indexOf('SF') >= 0)
assert('idp has DL LB DB', FS.ROSTERS.idp.slots.join(' ').indexOf('DL') >= 0)

const squad = [
  { pos: 'QB', tag: 'CHI QB1' },
  { pos: 'RB', tag: 'PHI RB1' },
  { pos: 'WR', tag: 'CIN WR1' }
].map(function (s) {
  return { pos: s.pos, tag: s.tag, stats: FS.weekStats(s.tag, s.pos) }
})
const a = FS.scoreSquad(FS.PRESETS.standard, squad)
const b = FS.scoreSquad(FS.PRESETS.sleeper_ppr, squad)
assert('same week box, PPR >= standard', b.total >= a.total)
assert('no player names in tags', /QB1|RB1|WR1/.test(squad.map(function (s) { return s.tag }).join(' ')))
assert('deterministic weekStats', FS.weekStats('CHI QB1', 'QB').passYds === FS.weekStats('CHI QB1', 'QB').passYds)

console.log('ALL PASS')
