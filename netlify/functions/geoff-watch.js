const wrap = require('./_vercel-adapter')
const handler = require('../../api/geoff-watch')
const { connectNetlifyBlobs } = require('../../api/lib/geoff-watch-store')

const httpHandler = wrap(handler)

exports.handler = async function (event, context) {
  try {
    connectNetlifyBlobs(event)
  } catch (e) {}
  return httpHandler(event, context)
}
