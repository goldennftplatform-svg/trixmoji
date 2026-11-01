const wrap = require('./_vercel-adapter')
const handler = require('../../api/trix-memes')
exports.handler = wrap(handler)
