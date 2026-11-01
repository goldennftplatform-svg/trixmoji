const wrap = require('./_vercel-adapter')
const handler = require('../../api/trix-boxes')
exports.handler = wrap(handler)
