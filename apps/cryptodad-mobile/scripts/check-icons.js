const fs = require('fs');
const path = require('path');

const required = ['icons/icon-192.png', 'icons/icon-512.png'];
let ok = true;

for (const rel of required) {
  const full = path.join(__dirname, '..', rel);
  if (!fs.existsSync(full)) {
    console.error('MISSING:', rel);
    ok = false;
  } else {
    console.log('OK:', rel);
  }
}

process.exit(ok ? 0 : 1);