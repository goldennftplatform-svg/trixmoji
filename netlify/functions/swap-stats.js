const wrap = require('./_vercel-adapter');
const handler = require('../../api/swap-stats');
exports.handler = wrap(handler);