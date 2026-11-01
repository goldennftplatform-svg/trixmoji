const wrap = require('./_vercel-adapter');
const handler = require('../../api/pond-community');
exports.handler = wrap(handler);
