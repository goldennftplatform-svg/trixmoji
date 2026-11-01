const wrap = require('./_vercel-adapter')
const handler = require('../../api/mail-gate')
const { connectNetlifyBlobs } = require('../../api/lib/mail-gate-store')

const httpHandler = wrap(handler)

exports.handler = async function (event, context) {
  try {
    connectNetlifyBlobs(event)
  } catch (e) {}
  return httpHandler(event, context)
}
