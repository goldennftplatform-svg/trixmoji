'use strict'
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../..')
const source = path.resolve(root, '../TRIX-PHUNKS/assets-v2')
const destination = path.join(root, 'assets/data/phunk-catalog.json')
const dictionary = [], lookup = new Map(), items = []
for (let id = 0; id < 10000; id++) {
 const meta = JSON.parse(fs.readFileSync(path.join(source, id + '.json'), 'utf8'))
 if (meta.name !== 'TRIXMOJI PHUNKS #' + id) throw new Error('Metadata ID mismatch: ' + id)
 const entries = (meta.attributes || []).filter(a => a.trait_type !== 'TRiX Token').map(a => [String(a.trait_type), String(a.value)])
 for (const token of meta.properties && meta.properties.tokens || []) entries.push(['Token', String(token.symbol) + ' · ' + String(token.token)])
 const indexes = new Set()
 for (const [group, value] of entries) {
  const key = group + '\0' + value
  if (!lookup.has(key)) { lookup.set(key, dictionary.length); dictionary.push({ group, value, count: 0 }) }
  indexes.add(lookup.get(key))
 }
 for (const index of indexes) dictionary[index].count++
 items.push({ id, t: [...indexes] })
}
const catalog = { version: 1, supply: items.length, source: 'TRIX-PHUNKS assets-v2 metadata',
 note: 'Trait metadata is from the supplied V2 collection. Preview images are the existing website images matched by piece number. Catalogue entries are not proof of minting, ownership or sale listings. Metadata royalty fields are not used for pricing.', dictionary, items }
fs.writeFileSync(destination, JSON.stringify(catalog))
console.log(JSON.stringify({ items: items.length, traits: dictionary.length, bytes: fs.statSync(destination).size, groups: [...new Set(dictionary.map(t => t.group))] }, null, 2))
