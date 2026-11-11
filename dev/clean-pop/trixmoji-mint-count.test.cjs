'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),{inspect}=require('../../netlify/functions/trixmoji-mint-count')
const creator='0x14F9B4a11A10A83C6A686012110Dc2bd54eFD673',id=n=>'0x'+n.toString(16).padStart(64,'0')
test('counts unique indexed creations across pages',async()=>{
 let calls=0;const fetch=async()=>({ok:true,json:async()=>++calls===1?{result:[{creator,transaction_hash:id(1)},{creator,transaction_hash:id(2)}],pagination:{has_more:true,page_key:id(99)}}:{result:[{creator,transaction_hash:id(2)},{creator,transaction_hash:id(3)}],pagination:{has_more:false}}})
 assert.deepEqual(await inspect({fetch}),{count:3,supply:10000,complete:true,source:'ethscriptions-indexer'})
})
test('reports a lower bound on later network failure and rejects invalid pagination',async()=>{
 let calls=0;const fetch=async()=>{if(++calls===2)throw Error('timeout');return {ok:true,json:async()=>({result:[{creator,transaction_hash:id(1)}],pagination:{has_more:true,page_key:id(99)}})}}
 assert.equal((await inspect({fetch})).complete,false)
 const bad=async()=>({ok:true,json:async()=>({result:[{creator,transaction_hash:id(1)}],pagination:{has_more:true,page_key:id(99)}})})
 await assert.rejects(inspect({fetch:bad}),/pagination/)
})
