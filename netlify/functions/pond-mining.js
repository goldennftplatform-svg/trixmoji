const wrap = require('./_vercel-adapter');
const handler = require('../../api/pond-mining');
exports.handler = wrap(handler);