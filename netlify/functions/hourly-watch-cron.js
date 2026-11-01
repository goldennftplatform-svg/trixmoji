const { connectNetlifyBlobs: connectDaily } = require('../../api/lib/daily-watch-store')
const { connectNetlifyBlobs: connectTrix } = require('../../api/lib/trix-live-store')
const daily = require('../../api/daily-watch')
const boxes = require('../../api/trix-boxes')
const memes = require('../../api/trix-memes')

exports.handler = async function (event) {
  try {
    connectDaily(event)
  } catch (e) {}
  try {
    connectTrix(event)
  } catch (e) {}

  const out = { ok: true, scheduled: true, at: new Date().toISOString(), desks: null, boxes: null, memes: null }
  try {
    out.desks = await daily.runAll('schedule')
  } catch (e) {
    out.desks = { error: String(e && e.message ? e.message : e) }
  }
  try {
    const board = await memes.buildBoard({ full: false, budgetMs: 18000 })
    const { saveLive } = require('../../api/lib/trix-live-store')
    const fs = require('fs')
    const path = require('path')
    try {
      const floorFile = path.join(__dirname, '../../assets/data/trix-memes.json')
      const floor = JSON.parse(fs.readFileSync(floorFile, 'utf8'))
      const floorN = floor && floor.stats ? Number(floor.stats.memes) || 0 : 0
      const liveN = board && board.stats ? Number(board.stats.memes) || 0 : 0
      if (floorN > liveN) {
        board.stats = Object.assign({}, board.stats || {}, { memes: floorN, floorApplied: true })
      }
    } catch (eFloor) {}
    await saveLive({ memes: board })
    out.memes = {
      users: board && board.uniqueUsers,
      counted: board && board.stats && board.stats.memes,
      updatedAt: board && board.updatedAt
    }
  } catch (e) {
    out.memes = { error: String(e && e.message ? e.message : e) }
  }
  try {
    const snap = await boxes.refreshLive('schedule')
    out.boxes = {
      minted: snap && snap.public && snap.public.boxesMinted,
      memesCounted: snap && snap.public && snap.public.memesCounted,
      launches: snap && snap.public && snap.public.launches,
      source: snap && snap.source
    }
  } catch (e) {
    out.boxes = { error: String(e && e.message ? e.message : e) }
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(out)
  }
}

exports.config = {
  schedule: '7 * * * *'
}
