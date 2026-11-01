const wrap = require('./_vercel-adapter');
const handler = require('../../api/attic-share');
exports.handler = wrap(handler);