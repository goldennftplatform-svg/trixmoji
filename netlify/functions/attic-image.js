const wrap = require('./_vercel-adapter');
const handler = require('../../api/attic-image');
exports.handler = wrap(handler);