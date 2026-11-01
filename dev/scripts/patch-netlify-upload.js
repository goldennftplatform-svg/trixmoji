const fs = require('fs');
const p = process.argv[2];
const bak = p + '.bak-grok';
if (!fs.existsSync(bak)) fs.copyFileSync(p, bak);
let s = fs.readFileSync(bak, 'utf8');
s = s.replace(
  'const { assetType, body, filepath, invocationMode, normalizedPath, runtime, timeout } = fileObj;',
  'const { assetType, body, filepath, invocationMode, normalizedPath, runtime, timeout } = fileObj;\n        console.error("[upload-start]", assetType, normalizedPath);'
);
s = s.replace(
  'lastError = error;',
  'lastError = error; console.error("[upload-fail]", error && error.status, error && error.message, JSON.stringify(error && error.json));'
);
fs.writeFileSync(p, s);
console.log('patched', {
  start: s.includes('[upload-start]'),
  fail: s.includes('[upload-fail]'),
});
