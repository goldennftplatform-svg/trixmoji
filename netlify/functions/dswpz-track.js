const wrap = require('./_vercel-adapter');
const handler = require('../../api/dswpz-track');
exports.handler = wrap(handler);
