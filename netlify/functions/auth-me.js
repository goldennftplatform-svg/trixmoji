const wrap = require('./_vercel-adapter');
const handler = require('../../api/auth-me');
exports.handler = wrap(handler);
