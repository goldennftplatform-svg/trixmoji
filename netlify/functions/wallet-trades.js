const wrap = require('./_vercel-adapter');
const handler = require('../../api/wallet-trades');
exports.handler = wrap(handler);