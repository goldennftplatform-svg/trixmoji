const wrap = require('./_vercel-adapter');
const handler = require('../../api/pond-dossier');
exports.handler = wrap(handler);