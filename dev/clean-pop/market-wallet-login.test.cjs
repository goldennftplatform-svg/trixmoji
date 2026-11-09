'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),{create}=require('../../assets/js/core/market-wallet-login')
const address='0x1111111111111111111111111111111111111111'
function element(){return {children:[],hidden:false,checked:false,disabled:false,textContent:'',append(...nodes){this.children.push(...nodes)},appendChild(node){this.children.push(node)},setAttribute(){}}}
function setup(existing){
 const host=element(),calls=[],document={createElement:element,createTextNode:text=>({textContent:text})}
 const provider={request:async q=>{calls.push(q);return '0xsignature'}}
 const fetch=async (url,opts)=>{calls.push({url,opts});let body=opts.body?JSON.parse(opts.body):null,value=opts.method==='GET'?{ok:true,user:existing||null}:body.action==='challenge'?{ok:true,challengeId:'abc',message:'Sign in to DOSWAPZ'}:{ok:true,user:{wallets:[{chain:'ethereum',address}]}};return {ok:true,json:async()=>value}}
 const identity=async(p,a)=>{assert.equal(p,provider);assert.equal(a,address)}
 return {host,calls,provider,login:create({document,fetch,identity}),connection:{provider,address}}
}
test('existing matching Ethereum session requires no signature',async()=>{
 const f=setup({wallets:[{chain:'ethereum',address}]});const r=await f.login.ensure(f.connection,f.host);assert.equal(r.alreadySignedIn,true);assert.equal(f.calls.length,1)
})
test('sign-in requires explicit attestations and uses selected wallet for signature',async()=>{
 const f=setup(),pending=f.login.ensure(f.connection,f.host);await new Promise(r=>setImmediate(r))
 const section=f.host.children[0],age=section.children[1].children[0],terms=section.children[2].children[0],prepare=section.children[3],preview=section.children[4],sign=section.children[5]
 await prepare.onclick();assert.match(section.children[7].textContent,/both boxes/);assert.equal(f.calls.length,1)
 age.checked=true;terms.checked=true;await prepare.onclick();assert.equal(preview.textContent,'Sign in to DOSWAPZ');assert.equal(sign.hidden,false);assert.equal(f.calls.some(c=>c.method==='personal_sign'),false)
 await sign.onclick();assert.equal((await pending).signedIn,true);assert.deepEqual(f.calls.find(c=>c.method==='personal_sign').params,['Sign in to DOSWAPZ',address]);assert.equal(f.calls.some(c=>c.method==='eth_sendTransaction'),false)
})
test('cancelling sign-in makes no signature or transaction request',async()=>{
 const f=setup(),pending=f.login.ensure(f.connection,f.host);await new Promise(r=>setImmediate(r));f.host.children[0].children[6].onclick();await assert.rejects(pending,/cancelled/);assert.equal(f.calls.some(c=>c.method==='personal_sign'||c.method==='eth_sendTransaction'),false)
})
