'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const WIDTH = 16384

function existing(paths) {
  for (let i = 0; i < paths.length; i++) {
    if (paths[i] && fs.existsSync(paths[i])) return paths[i]
  }
  throw new Error('The phunk minter file is missing.')
}

function leavesPath() {
  return existing([
    path.join(__dirname, 'phunk-leaves.bin'),
    path.join(process.cwd(), 'api', 'lib', 'phunk-leaves.bin')
  ])
}

function infoPath() {
  return existing([
    path.join(__dirname, '..', '..', 'assets', 'data', 'phunk-minter.json'),
    path.join(__dirname, '..', 'assets', 'data', 'phunk-minter.json'),
    path.join(process.cwd(), 'assets', 'data', 'phunk-minter.json'),
    path.join(__dirname, 'phunk-minter.json')
  ])
}

let cached = null

function tree() {
  if (cached) return cached
  const info = JSON.parse(fs.readFileSync(infoPath(), 'utf8'))
  const buf = fs.readFileSync(leavesPath())
  if (buf.length !== WIDTH * 32) throw new Error('The phunk list is the wrong size.')
  const leaves = new Array(WIDTH)
  for (let i = 0; i < WIDTH; i++) leaves[i] = buf.subarray(i * 32, i * 32 + 32)
  const levels = [leaves]
  while (levels[levels.length - 1].length > 1) {
    const cur = levels[levels.length - 1]
    const next = new Array(cur.length / 2)
    for (let i = 0; i < cur.length; i += 2) {
      next[i / 2] = crypto.createHash('sha256').update(Buffer.concat([cur[i], cur[i + 1]])).digest()
    }
    levels.push(next)
  }
  const root = levels[levels.length - 1][0].toString('hex')
  if (root !== String(info.root || '').replace(/^0x/i, '').toLowerCase()) {
    throw new Error('The phunk list does not match the minter.')
  }
  cached = { info: info, levels: levels }
  return cached
}

function info() {
  return tree().info
}

function proof(index) {
  const n = Number(index)
  if (!Number.isInteger(n) || n < 0 || n >= 10000) throw new Error('That phunk is not in this collection.')
  const levels = tree().levels
  const out = []
  let idx = n
  for (let level = 0; level < levels.length - 1; level++) {
    out.push('0x' + levels[level][idx ^ 1].toString('hex'))
    idx >>= 1
  }
  if (out.length !== 14) throw new Error('The picture proof is the wrong size.')
  return out
}

function matches(index, sha) {
  const n = Number(index)
  return Number.isInteger(n) && n >= 0 && n < 10000 &&
    tree().levels[0][n].toString('hex') === String(sha).replace(/^0x/i, '').toLowerCase()
}

module.exports = { info, proof, matches }
