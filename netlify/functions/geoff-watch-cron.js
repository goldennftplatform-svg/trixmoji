const handler = require('../../api/geoff-watch')
const { connectNetlifyBlobs } = require('../../api/lib/geoff-watch-store')

exports.handler = async function (event) {
  try {
    connectNetlifyBlobs(event)
  } catch (e) {}

  try {
    const state = await handler.runScan('schedule')
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        scheduled: true,
        at: state.lastCycle && state.lastCycle.at,
        samples: (state.rows || []).length
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
  schedule: '*/2 * * * *'
}
