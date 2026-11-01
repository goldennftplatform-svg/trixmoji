const wrap = require('./_vercel-adapter');
const handler = require('../../api/trix-ticker');
exports.handler = wrap(handler);