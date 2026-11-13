'use strict'
// Shared playtest only. Scores are client-reported and no ETH or assets move.
const crypto=require('crypto')
const PACKS={bullet:{priceCents:500,threshold:400},shotgun:{priceCents:750,threshold:5000},sniper:{priceCents:1000,threshold:8000}}
const BEST=[3100,2890,5822,3443,6089,635,5905,7804,7523]
const NORMAL=[372,2386,2491,2711,5314,...Array.from({length:30},(_,i)=>i)]
const HEX=/^(?:[a-f0-9]{32}|[a-f0-9]{64})$/,TOKEN=/^[a-f0-9]{64}$/,REQUEST=/^[A-Za-z0-9_-]{1,64}$/
const hash=x=>crypto.createHash('sha256').update(x).digest('hex')
function cleanName(value){const s=String(value||'').replace(/[^A-Za-z0-9 ._-]/g,'').trim().replace(/ +/g,' ');return s.slice(0,24)||'PLAYER'}
function publicState(s){return {pack:s.pack,shotsRemaining:10-s.shotsTaken,shotsTaken:s.shotsTaken,results:s.results,status:s.status,reason:s.reason,refundCents:s.refundCents,nextPlayer:0}}
function createBeta({store,now=()=>Date.now(),bytes=n=>crypto.randomBytes(n),randomInt=n=>crypto.randomInt(n),verifyPayment=null}){
 if(!store||typeof store.getWithMetadata!=='function'||typeof store.setJSON!=='function')throw Error('Playtest storage unavailable')
 async function start(body){
  if(!Object.hasOwn(PACKS,body.pack)||!REQUEST.test(String(body.playerId||'')))throw Error('Invalid pack or player')
  let payment=null,paidId=null,paidToken=null
  if(verifyPayment){const secret=String(body.payment&&body.payment.secret||'').toLowerCase();if(!/^0x[a-f0-9]{64}$/.test(secret))throw Error('Invalid test payment');const resumeId=require('ethers').ethers.utils.keccak256(secret).slice(2);const resumeToken=hash('trix-hunt-test-session:'+secret);const existing=await store.getWithMetadata('round-'+resumeId,{type:'json',consistency:'strong'});if(existing&&existing.data){const s=existing.data;if(s.tokenHash!==hash(resumeToken)||s.pack!==body.pack||!s.payment||!sameAddress(s.payment.wallet,body.payment.wallet)||String(s.payment.hash||'').toLowerCase()!==String(body.payment.hash||'').toLowerCase())throw Error('Invalid test payment');return {id:resumeId,token:resumeToken,state:publicState(s)}}payment=await verifyPayment({...body.payment,pack:['bullet','shotgun','sniper'].indexOf(body.pack)});paidId=payment.roundId.slice(2).toLowerCase();paidToken=resumeToken;payment.hash=String(body.payment.hash).toLowerCase()}
  for(let tries=0;tries<4;tries++){
   const id=paidId||bytes(16).toString('hex'),token=paidToken||bytes(32).toString('hex')
   const round={id,tokenHash:hash(token),pack:body.pack,playerId:body.playerId,nickname:cleanName(body.nickname),payment,startedAt:now(),shotsTaken:0,results:[],best:BEST.slice(),normal:NORMAL.slice(),requests:[],status:'active',reason:null,refundCents:0}
   const result=await store.setJSON('round-'+id,round,{onlyIfNew:true});if(result&&result.modified)return {id,token,state:publicState(round)}
   if(paidId){const previous=await store.getWithMetadata('round-'+id,{type:'json',consistency:'strong'});if(previous&&previous.data&&previous.data.tokenHash===hash(token)&&previous.data.pack===body.pack)return {id,token,state:publicState(previous.data)};throw Error('Invalid test payment')}
  }
  throw Error('Could not start playtest')
 }
 async function mutate(body,kind){
  if(!HEX.test(String(body.id||''))||!TOKEN.test(String(body.token||'')))throw Error('Invalid session')
  if(kind==='shot'&&(typeof body.hit!=='boolean'||!REQUEST.test(String(body.requestId||''))))throw Error('Invalid shot')
  const key='round-'+body.id
  for(let attempt=0;attempt<12;attempt++){
   const entry=await store.getWithMetadata(key,{type:'json',consistency:'strong'});if(!entry||!entry.etag||!entry.data||entry.data.tokenHash!==hash(body.token))throw Error('Invalid session')
   const s=entry.data;if(!Number.isFinite(s.startedAt)||now()-s.startedAt>86400000||now()<s.startedAt)throw Error('Session expired')
   if(kind==='shot'){
    const previous=s.requests.find(r=>r.requestId===body.requestId)
    if(previous){if(previous.hit!==body.hit)throw Error('Shot conflict');return {state:previous.state,receipt:previous.receipt,round:s}}
    if(s.status!=='active')throw Error('Round finished')
    let receipt={type:'shot',shot:s.shotsTaken+1,player:0,hit:body.hit,tier:null,prize:null}
    if(body.hit){const tier=randomInt(10000)<PACKS[s.pack].threshold?'best':'normal',pool=s[tier];receipt.tier=tier
     if(!pool.length){s.status='finished';s.reason='tier_exhausted';s.refundCents=(10-s.shotsTaken)*PACKS[s.pack].priceCents/10;receipt={type:'error',code:'tier_exhausted',tier,refundCents:s.refundCents}}
     else{const index=randomInt(pool.length),id=pool.splice(index,1)[0];receipt.prize={id};s.results.push({player:0,shot:receipt.shot,prize:{id}})}
    }
    if(receipt.type==='shot'){s.shotsTaken++;if(s.shotsTaken===10){s.status='finished';s.reason='ammo_exhausted'}}
    const state=publicState(s);s.requests.push({requestId:body.requestId,hit:body.hit,state,receipt});
    const saved=await store.setJSON(key,s,{onlyIfMatch:entry.etag});if(saved&&saved.modified)return {state,receipt,round:s}
   }else{
    if(s.status!=='active')return {state:publicState(s),round:s}
    s.status='finished';s.reason='cancelled';s.refundCents=(10-s.shotsTaken)*PACKS[s.pack].priceCents/10
    const saved=await store.setJSON(key,s,{onlyIfMatch:entry.etag});if(saved&&saved.modified)return {state:publicState(s),round:s}
   }
  }
  throw Error('Playtest is busy; retry')
 }
 async function record(s){
  if(s.status!=='finished'||s.shotsTaken===0)return
  for(let attempt=0;attempt<12;attempt++){
   const entry=await store.getWithMetadata('leaderboard-v1',{type:'json',consistency:'strong'}),rows=entry?entry.data:[]
   if(!Array.isArray(rows))throw Error('Leaderboard unavailable')
   if(rows.some(x=>x.id===s.id))return
   const next=rows.concat([{id:s.id,playerId:s.playerId,name:s.nickname,hits:s.results.length,shots:s.shotsTaken,at:now()}]).slice(-1000)
   const result=await store.setJSON('leaderboard-v1',next,entry?{onlyIfMatch:entry.etag}:{onlyIfNew:true});if(result&&result.modified)return
  }
  throw Error('Leaderboard busy')
 }
 async function leaderboard(){const entry=await store.getWithMetadata('leaderboard-v1',{type:'json',consistency:'strong'}),rows=entry?entry.data:[];if(!Array.isArray(rows))throw Error('Leaderboard unavailable');const players=new Map();for(const x of rows){const p=players.get(x.playerId)||{nickname:x.name,hits:0,shots:0};p.nickname=x.name;p.hits+=x.hits;p.shots+=x.shots;players.set(x.playerId,p)}return [...players.entries()].sort((a,b)=>b[1].hits-a[1].hits||(b[1].hits/(b[1].shots||1))-(a[1].hits/(a[1].shots||1))||a[0].localeCompare(b[0])).slice(0,20).map(([,x],i)=>({rank:i+1,...x,accuracy:x.shots?x.hits/x.shots:0}))}
 return {start,mutate,record,leaderboard}
}
function sameAddress(a,b){return String(a||'').toLowerCase()===String(b||'').toLowerCase()}
module.exports={createBeta}
