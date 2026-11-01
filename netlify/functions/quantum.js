const wrap = require('./_vercel-adapter');
const handler = require('../../api/quantum');
// Swing exits, honeypot gate, login arm, and Jupiter retry live in api/quantum.js.
exports.handler = wrap(handler);
