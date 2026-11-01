const wrap = require('./_vercel-adapter');
const handler = require('../../api/auth-logout');
exports.handler = wrap(handler);
