const wrap = require('./_vercel-adapter');
const handler = require('../../api/x-gate');
exports.handler = wrap(handler);
