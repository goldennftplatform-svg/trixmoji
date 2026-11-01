const wrap = require('./_vercel-adapter');
const handler = require('../../api/attic-posts');
exports.handler = wrap(handler);