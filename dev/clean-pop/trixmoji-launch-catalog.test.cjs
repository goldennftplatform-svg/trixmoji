'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path')
const catalog=require('../../assets/data/trixmoji-launch-catalog.json')
test('catalogue represents each new artwork metadata file and its trait counts',()=>{
 assert.equal(catalog.supply,10000);assert.equal(catalog.items.length,10000)
 const counts=Array(catalog.dictionary.length).fill(0),dir=path.resolve(__dirname,'../../assets/ethscriptions/trixmoji-launch')
 for(let id=0;id<10000;id++){
  const meta=JSON.parse(fs.readFileSync(path.join(dir,`${id}.json`),'utf8')),item=catalog.items[id]
  assert.equal(item.id,id)
  const expected=new Set(meta.attributes.map(a=>JSON.stringify([a.trait_type,a.value])))
  const actual=new Set(item.t.map(i=>{const d=catalog.dictionary[i];counts[i]++;return JSON.stringify([d.group,d.value])}))
  assert.deepEqual(actual,expected)
 }
 catalog.dictionary.forEach((d,i)=>assert.equal(d.count,counts[i]))
})
