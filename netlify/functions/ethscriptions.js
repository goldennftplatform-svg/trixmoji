const wrap = require('./_vercel-adapter')
const handler = require('../../api/ethscriptions')
const { connect, withConnection } = require('../../api/lib/ethscriptions-blobs')
const { report } = require('../../api/lib/ethscriptions-diagnostics')

const httpHandler = wrap(handler)

exports.handler = async function (event, context) {
  let connection
  try {
    connection = connect(event)
  } catch (e) {
    const diagnostic = report('blob-runtime-connect', e)
    return { statusCode: 503, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Netlify storage connection is not available.', diagnostic }) }
  }
  return withConnection(connection, () => httpHandler(event, context))
}
