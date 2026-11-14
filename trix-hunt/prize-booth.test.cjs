'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
test('preview pages cover 500 distinct existing collection images',()=>{
 const nodes=new Map();function element(id){if(!nodes.has(id))nodes.set(id,{children:[],textContent:'',append(...items){this.children.push(...items)},scrollIntoView(){}});return nodes.get(id)}
 const grid=element('boothGrid');Object.defineProperty(grid,'textContent',{set(){this.children=[]}})
 const document={getElementById:element,createElement:()=>({children:[],append(...items){this.children.push(...items)}})}
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'prize-booth.js'),'utf8'),{document})
 const seen=new Set();for(let page=0;page<13;page++){for(const card of grid.children){const src=card.children[0].src;assert(!seen.has(src));seen.add(src);assert(fs.existsSync(path.join(__dirname,'..',src.slice(1))),src)}if(page<12)element('boothNext').onclick()}
 assert.equal(seen.size,500);assert.equal(element('boothNext').disabled,true);assert.equal(grid.children.length,20);element('boothPrev').onclick();assert.equal(grid.children.length,40)
})
