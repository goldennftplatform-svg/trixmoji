const wrap = require('./_vercel-adapter');
const handler = require('../../api/attic-drops');
exports.handler = wrap(handler);
