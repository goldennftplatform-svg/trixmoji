'use strict'
// Build the new collection's catalogue from its own artist-provided metadata.
const fs=require('fs'),path=require('path')
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'assets/ethscriptions/trixmoji-launch'),target=path.join(root,'assets/data/trixmoji-launch-catalog.json')
const dictionary=[],lookup=new Map(),items=[]
for(let id=0;id<10000;id++){
 const m=JSON.parse(fs.readFileSync(path.join(dir,`${id}.json`),'utf8'))
 if(m.properties?.edition!==id||!Array.isArray(m.attributes))throw Error(`Invalid metadata #${id}`)
 const traits=[],seen=new Set()
 for(const a of m.attributes){
  if(typeof a.trait_type!=='string'||typeof a.value!=='string'||!a.trait_type||!a.value)throw Error(`Invalid trait #${id}`)
  const group=a.trait_type,value=a.value,key=JSON.stringify([group,value]);if(seen.has(key))continue;seen.add(key)
  let i=lookup.get(key);if(i===undefined){i=dictionary.length;lookup.set(key,i);dictionary.push({group,value,count:0})}dictionary[i].count++;traits.push(i)
 }
 items.push({id,t:traits})
}
fs.writeFileSync(target,JSON.stringify({supply:10000,dictionary,items})+'\n',{flag:'wx'})
console.log(JSON.stringify({items:items.length,traits:dictionary.length,path:target}))
