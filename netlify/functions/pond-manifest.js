const wrap = require('./_vercel-adapter');
const handler = require('../../api/pond-manifest');
exports.handler = wrap(handler);