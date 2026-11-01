const wrap = require('./_vercel-adapter');
const handler = require('../../api/harbinger-chat');
exports.handler = wrap(handler);
