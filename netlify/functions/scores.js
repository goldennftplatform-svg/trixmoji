const wrap = require('./_vercel-adapter');
const handler = require('../../api/scores');
exports.handler = wrap(handler);
