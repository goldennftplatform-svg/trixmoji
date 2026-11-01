const handler = require('../../api/daily-watch')
const { connectNetlifyBlobs, loadState } = require('../../api/lib/daily-watch-store')
const { INTERVAL_MS } = require('../../api/lib/daily-watch-probe')

exports.handler = async function (event) {
  try {
    connectNetlifyBlobs(event)
  } catch (e) {}

  try {
    const state = await loadState()
    const ran = []
    const skipped = []
    for (const id of handler.DESK_IDS) {
      const desk = state.desks && state.desks[id]
      const last = desk && desk.lastDailyAt ? Date.parse(desk.lastDailyAt) : 0
      const stale = !Number.isFinite(last) || Date.now() - last >= INTERVAL_MS
      if (!stale) {
        skipped.push(id)
        continue
      }
      await handler.runDesk(id, 'schedule')
      ran.push(id)
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        scheduled: true,
        ran,
        skipped,
        at: new Date().toISOString()
      })
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        scheduled: true,
        error: String(err && err.message ? err.message : err)
      })
    }
  }
}

exports.config = {
  schedule: '12 * * * *'
}
