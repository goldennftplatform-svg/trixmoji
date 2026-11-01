const fs = require('fs');
const path = require('path');
const a = require('./vantablack-erc20-artifact.json');
const out =
 '/** Auto-generated ERC-20 artifact for Vantablack multi-chain launch - do not edit by hand */\n' +
 'window.VB_ERC20_ARTIFACT = ' +
 JSON.stringify(a) +
 ';\n';
const dest = path.join(__dirname, '..', '..', 'assets', 'js', 'basement', 'vb-erc20-artifact.js');
fs.writeFileSync(dest, out);
console.log('wrote', dest, out.length);
