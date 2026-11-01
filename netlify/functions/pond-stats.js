const wrap = require('./_vercel-adapter');
const handler = require('../../api/pond-stats');
exports.handler = wrap(handler);