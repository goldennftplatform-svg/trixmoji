const handler = require('../../api/deploy-watch')
const { connectNetlifyBlobs } = require('../../api/lib/deploy-watch-store')
const xgate = require('../../api/lib/x-gate-store')

exports.handler = async function (event) {
  try {
    connectNetlifyBlobs(event)
  } catch (e) {}
  try {
    xgate.connectNetlifyBlobs(event)
  } catch (e2) {}
  try {
    const sites = await handler.runAll('schedule')
    const summary = {}
    Object.keys(sites || {}).forEach(function (id) {
      const s = sites[id] || {}
      summary[id] = {
        deployHit: !!s.deployHit,
        fingerprint: s.current && s.current.fingerprint,
        xDraftId: s.xDraftId || null,
        error: s.error || s.storeError || null
      }
    })
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, scheduled: true, at: new Date().toISOString(), sites: summary })
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, scheduled: true, error: String(e && e.message ? e.message : e) })
    }
  }
}

exports.config = {
  schedule: '*/15 * * * *'
}
