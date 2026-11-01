const wrap = require('./_vercel-adapter');
const handler = require('../../api/pork-pasture');
exports.handler = wrap(handler);
