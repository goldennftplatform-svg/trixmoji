'use strict'
const wrap = require('./_vercel-adapter')
const handler = require('../../api/trixmoji-market').webpV2
const { connect, withConnection } = require('../../api/lib/ethscriptions-blobs')
const httpHandler = wrap(handler)
exports.handler = async function (event, context) {
 try { const connection = connect(event); return await withConnection(connection, () => httpHandler(event, context)) }
 catch (_) { return { statusCode: 503, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Market storage is unavailable.' }) } }
}
