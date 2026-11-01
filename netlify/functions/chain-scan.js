const wrap = require('./_vercel-adapter');
const handler = require('../../api/chain-scan');
exports.handler = wrap(handler);
