const wrap = require('./_vercel-adapter');
const handler = require('../../api/awardz');
exports.handler = wrap(handler);
