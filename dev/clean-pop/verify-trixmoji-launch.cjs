'use strict'
// Independent byte, metadata and ordered-proof verification; no chain calls.
const fs = require('fs'), path = require('path'), crypto = require('crypto')
const dir = path.resolve(__dirname, '../../assets/ethscriptions/trixmoji-launch')
const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
const hash = data => crypto.createHash('sha256').update(data).digest()
if (m.count !== 10000 || m.files.length !== 10000 || !/^0x[\da-f]{64}$/.test(m.root)) throw Error('Invalid manifest')
const seen = new Set(); let total = 0, largest = 0
for (let i = 0; i < 10000; i++) {
 const row = m.files[i]
 if (row.id !== i || row.image !== `${i}.webp` || row.metadata !== `${i}.json` || row.proof.length !== 14) throw Error(`Invalid row ${i}`)
 const bytes = fs.readFileSync(path.join(dir, row.image)), meta = JSON.parse(fs.readFileSync(path.join(dir, row.metadata), 'utf8'))
 if (meta.seller_fee_basis_points !== 250 || meta.image !== row.image || meta.properties?.edition !== i) throw Error(`Invalid metadata ${i}`)
 const uri = 'data:image/webp;base64,' + bytes.toString('base64')
 if (bytes.length !== row.fileBytes || hash(bytes).toString('hex') !== row.sha256 || hash(uri).toString('hex') !== row.contentSha256) throw Error(`Invalid image/hash ${i}`)
 if (seen.has(row.contentSha256)) throw Error(`Duplicate URI ${i}`)
 seen.add(row.contentSha256); total += bytes.length; largest = Math.max(largest, bytes.length)
 let current = Buffer.from(row.contentSha256, 'hex'), index = i
 for (const sibling of row.proof) {
  if (!/^0x[\da-f]{64}$/.test(sibling)) throw Error(`Invalid proof ${i}`)
  const b = Buffer.from(sibling.slice(2), 'hex')
  current = hash(index % 2 ? Buffer.concat([b, current]) : Buffer.concat([current, b])); index = Math.floor(index / 2)
 }
 if ('0x' + current.toString('hex') !== m.root) throw Error(`Incorrect proof ${i}`)
}
if (total !== m.totalBytes || largest !== m.maxFileBytes || seen.size !== m.uniqueContentUris) throw Error('Invalid aggregate')
console.log(JSON.stringify({verified: true, count: seen.size, root: m.root, totalBytes: total, maxFileBytes: largest, note: 'Local verification; on-chain uniqueness remains unchecked.'}, null, 2))
