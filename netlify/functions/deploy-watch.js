const wrap = require('./_vercel-adapter')
const handler = require('../../api/deploy-watch')
const { connectNetlifyBlobs } = require('../../api/lib/deploy-watch-store')
const xgate = require('../../api/lib/x-gate-store')

const httpHandler = wrap(handler)

exports.handler = async function (event, context) {
  try {
    connectNetlifyBlobs(event)
  } catch (e) {}
  try {
    xgate.connectNetlifyBlobs(event)
  } catch (e2) {}
  return httpHandler(event, context)
}
