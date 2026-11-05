'use strict'
// Independently verify file bytes, exact URI hashes and every ordered Merkle proof.
// This does not check the live indexer, deploy a contract, or send transactions.
const fs = require('fs'), path = require('path'), crypto = require('crypto')
const root = path.resolve(__dirname, '../../assets/ethscriptions/clean-pop-webp-v2')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
const hash = data => crypto.createHash('sha256').update(data).digest()
if (manifest.count !== 10000 || !Array.isArray(manifest.files) || manifest.files.length !== 10000 || !/^0x[0-9a-f]{64}$/.test(manifest.root)) throw Error('Invalid candidate manifest.')
const seen = new Set(); let total = 0, largest = 0
for (let i = 0; i < manifest.files.length; i++) {
 const row = manifest.files[i]
 if (row.id !== i || row.image !== i + '.webp' || !Array.isArray(row.proof) || row.proof.length !== 14) throw Error('Invalid manifest row #' + i)
 const bytes = fs.readFileSync(path.join(root, row.image)), uri = 'data:image/webp;base64,' + bytes.toString('base64')
 if (bytes.length !== row.fileBytes || hash(bytes).toString('hex') !== row.sha256 || hash(Buffer.from(uri)).toString('hex') !== row.contentSha256) throw Error('File or URI hash mismatch for #' + i)
 if (seen.has(row.contentSha256)) throw Error('Duplicate candidate URI for #' + i)
 seen.add(row.contentSha256); total += bytes.length; largest = Math.max(largest, bytes.length)
 let current = Buffer.from(row.contentSha256, 'hex'), index = i
 for (const siblingHex of row.proof) {
  if (!/^0x[0-9a-f]{64}$/.test(siblingHex)) throw Error('Malformed proof for #' + i)
  const sibling = Buffer.from(siblingHex.slice(2), 'hex')
  current = hash(index % 2 ? Buffer.concat([sibling, current]) : Buffer.concat([current, sibling])); index = Math.floor(index / 2)
 }
 if ('0x' + current.toString('hex') !== manifest.root) throw Error('Proof mismatch for #' + i)
}
if (total !== manifest.totalBytes || largest !== manifest.maxFileBytes) throw Error('Manifest aggregate mismatch')
console.log(JSON.stringify({ verified: true, count: seen.size, root: manifest.root, totalBytes: total, maxFileBytes: largest, note: 'Local verification only; existing indexer uniqueness and deployment remain unverified.' }, null, 2))
