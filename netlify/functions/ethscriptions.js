const wrap = require('./_vercel-adapter')
const handler = require('../../api/ethscriptions')
const { connectNetlifyBlobs } = require('../../api/lib/account-store')

const httpHandler = wrap(handler)

exports.handler = async function (event, context) {
  try {
    const connected = connectNetlifyBlobs(event)
    if (!connected) console.warn('[ethscriptions] Blobs bridge did not initialize; checking runtime-provided context.')
  } catch (e) {
    console.error('[ethscriptions] Blobs bridge initialization failed.')
  }
  return httpHandler(event, context)
}
