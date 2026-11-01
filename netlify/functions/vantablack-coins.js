const wrap = require('./_vercel-adapter');
const handler = require('../../api/vantablack-coins');
exports.handler = wrap(handler);