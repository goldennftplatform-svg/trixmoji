const wrap = require('./_vercel-adapter');
const handler = require('../../api/auth-x');
exports.handler = wrap(handler);
