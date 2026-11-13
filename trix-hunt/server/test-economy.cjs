'use strict'
// Local simulation only: this ledger neither holds ETH nor proves gameplay.
const fs=require('node:fs/promises'),path=require('node:path')
const {ethers}=require('ethers')
const ID=/^[A-Za-z0-9_-]{1,64}$/
const PACKS=['bullet','shotgun','sniper']
async function createTestEconomy({directory,quote}){
 const filename=path.join(directory,'test-economy.json');let rows=[]
 try{rows=JSON.parse(await fs.readFile(filename,'utf8'));if(!Array.isArray(rows))throw Error('Invalid test ledger')}catch(e){if(e.code!=='ENOENT')throw e}
 let queue=Promise.resolve()
 async function mutate(fn){const op=queue.then(async()=>{const next=JSON.parse(JSON.stringify(rows)),result=await fn(next);const tmp=filename+'.'+process.pid+'.tmp';await fs.writeFile(tmp,JSON.stringify(next),{mode:0o600});await fs.rename(tmp,filename);rows=next;return result});queue=op.then(()=>{},()=>{});return op}
 return {
  async start(body){
   if(!body||Object.keys(body).sort().join(',')!=='pack,sessionId'||!ID.test(String(body.sessionId||''))||!PACKS.includes(body.pack))throw Error('Invalid test round')
   return mutate(async next=>{
    const existing=next.find(r=>r.sessionId===body.sessionId);if(existing){if(existing.pack!==body.pack)throw Error('Session conflict');return existing}
    const q=await quote(),p=q.prices.find(x=>x.pack===body.pack);if(!q.ok||q.chainId!=='11155111'||!p||!/^\d+$/.test(p.wei)||ethers.BigNumber.from(p.wei).lte(0)||!ethers.BigNumber.from(p.wei).mod(10).isZero())throw Error('Quote unavailable')
    const row={sessionId:body.sessionId,pack:body.pack,priceWei:p.wei,feedAnswer:q.answer,quoteBlockTimestamp:q.blockTimestamp,status:'active',shots:0,hits:0,refundWei:'0',spentWei:'0'};next.push(row);return row
   })
  },
  async finish(body){
   if(!body||Object.keys(body).sort().join(',')!=='hits,sessionId,shots'||!ID.test(String(body.sessionId||''))||!Number.isInteger(body.shots)||!Number.isInteger(body.hits)||body.shots<0||body.shots>10||body.hits<0||body.hits>body.shots)throw Error('Invalid test round')
   return mutate(async next=>{const r=next.find(x=>x.sessionId===body.sessionId);if(!r)throw Error('Unknown session');if(r.status==='finished'){if(r.shots!==body.shots||r.hits!==body.hits)throw Error('Session conflict');return r}const price=ethers.BigNumber.from(r.priceWei),spent=price.div(10).mul(body.shots);r.status='finished';r.shots=body.shots;r.hits=body.hits;r.spentWei=spent.toString();r.refundWei=price.sub(spent).toString();return r})
  },
  async summary(){await queue;const total=rows.reduce((a,r)=>{const price=ethers.BigNumber.from(r.priceWei);if(r.status==='active')a.held=a.held.add(price);else{a.spent=a.spent.add(r.spentWei);a.refunds=a.refunds.add(r.refundWei)}return a},{held:ethers.constants.Zero,spent:ethers.constants.Zero,refunds:ethers.constants.Zero});return {rounds:rows.length,active:rows.filter(r=>r.status==='active').length,heldWei:total.held.toString(),spentWei:total.spent.toString(),refundWei:total.refunds.toString(),recent:rows.slice(-20).reverse()}}
 }
}
module.exports={createTestEconomy}
