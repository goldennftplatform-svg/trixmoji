const wrap = require('./_vercel-adapter');
const handler = require('../../api/token-safety');
exports.handler = wrap(handler);
