'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function harness(){
  const data=new Map(),window={};
  const localStorage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,String(value))};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'inventory.js'),'utf8'),{window,localStorage,Set,Map,Number,JSON,Object,Array});
  return {api:window.TrixInventory,data};
}
const sample=[{id:1,rank:4,metadataRank:4,symbol:'VOID',pixels:50,tiles:[]},{id:2,rank:1,metadataRank:1,symbol:'CRACK',pixels:5,tiles:[]},{id:3,rank:1,metadataRank:1,symbol:'CRACK',pixels:8,tiles:[]}];
test('automatic ranking uses coin rank, then tile count',()=>{
  const {api}=harness();assert.deepEqual(Array.from(api.auto(sample),x=>x.id),[3,2,1]);
});
test('manual order selects the demo best tier and preserves metadata',()=>{
  const {api}=harness();const config={mode:'manual',order:[1,3,2],bestCount:1};api.save(config);
  const read=api.read(sample),result=api.apply(sample,read);
  assert.deepEqual(Array.from(result,x=>x.id),[1,3,2]);assert.deepEqual(Array.from(result,x=>x.rank),[1,2,2]);assert.equal(result[0].metadataRank,4);assert.equal(sample[0].rank,4);
});
test('invalid or stale saved orders fall back safely',()=>{
  const {api,data}=harness();data.set('trix-hunt-demo-inventory-v1',JSON.stringify({mode:'manual',order:[1,1,3],bestCount:1}));
  const config=api.read(sample);assert.equal(config.mode,'auto');assert.deepEqual(Array.from(config.order),[3,2,1]);
});
