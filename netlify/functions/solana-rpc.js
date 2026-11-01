const wrap = require('./_vercel-adapter');
const handler = require('../../api/solana-rpc');
exports.handler = wrap(handler);