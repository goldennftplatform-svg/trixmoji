// Check the exact deployed artifact's complete ABI before forming a raw deposit.
const fs = require('node:fs');
const path = require('node:path');
const dependency = process.env.TRIX_TEST_DEPS
    ? require('node:module').createRequire(path.join(process.env.TRIX_TEST_DEPS, 'package.json')) : require;
const { ethers } = dependency('ethers');

function preflight(abi, id) {
    const utils = ethers.utils || ethers;
    if (!utils.isHexString(id, 32) || BigInt(id) === 0n) throw new Error('ID must be nonzero 32-byte hex');
    if (!Array.isArray(abi) || !abi.some(f => f.type === 'function')) throw new Error('complete artifact ABI required');
    const iface = new (ethers.Interface || ethers.utils.Interface)(abi);
    const selector = id.slice(0, 10).toLowerCase();
    const matches = iface.fragments.filter(f => f.type === 'function' && (f.selector || iface.getSighash(f)).toLowerCase() === selector)
        .map(f => f.format('sighash'));
    return { id, selector, matches, safeFromSelectorCollision: matches.length === 0 };
}

if (require.main === module) {
    try {
        const [file, id] = process.argv.slice(2);
        if (!file || !id) throw new Error('usage: node vault-preflight.cjs <artifact-or-abi.json> <32-byte-id>');
        const json = JSON.parse(fs.readFileSync(file, 'utf8'));
        const result = preflight(Array.isArray(json) ? json : json.abi, id);
        console.log(JSON.stringify(result, null, 2));
        if (!result.safeFromSelectorCollision) process.exitCode = 1;
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { preflight };
