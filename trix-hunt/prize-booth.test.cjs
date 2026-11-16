'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
test('preview pages cover the 5,000 distinct playtest pool images',()=>{
 const nodes=new Map();function element(id){if(!nodes.has(id))nodes.set(id,{children:[],textContent:'',append(...items){this.children.push(...items)},scrollIntoView(){}});return nodes.get(id)}
 const grid=element('boothGrid');Object.defineProperty(grid,'textContent',{set(){this.children=[]}})
 const document={getElementById:element,createElement:()=>({children:[],append(...items){this.children.push(...items)}})}
 const pool=require('./test-pool.js');vm.runInNewContext(fs.readFileSync(path.join(__dirname,'prize-booth.js'),'utf8'),{document,window:{TrixTestPool:pool}})
 const seen=new Set();for(let page=0;page<125;page++){for(const card of grid.children){const src=card.children[0].src;assert(!seen.has(src));seen.add(src);assert(fs.existsSync(path.join(__dirname,'..',src.slice(1))),src)}if(page<124)element('boothNext').onclick()}
 assert.equal(seen.size,5000);assert.equal(element('boothNext').disabled,true);assert.equal(grid.children.length,40);element('boothPrev').onclick();assert.equal(grid.children.length,40)
})
