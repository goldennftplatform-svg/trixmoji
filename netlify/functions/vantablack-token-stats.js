const wrap = require('./_vercel-adapter');
const handler = require('../../api/vantablack-token-stats');
exports.handler = wrap(handler);