const wrap = require('./_vercel-adapter');
const handler = require('../../api/attic-drops-check');
exports.handler = wrap(handler);
