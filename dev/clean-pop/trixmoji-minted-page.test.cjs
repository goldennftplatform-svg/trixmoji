'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),{ethers}=require('ethers')
const {inspect}=require('../../netlify/functions/trixmoji-minted-page'),info=require('../../assets/data/trixmoji-launch-candidate.json')
function fixture(options={}){return async (_url,request)=>{const batch=JSON.parse(request.body),rows=batch.map(q=>({jsonrpc:'2.0',id:q.id,result:q.id===1?'0x1':q.id===2?(options.wrongCode?'0x':info.runtime):ethers.utils.hexZeroPad(q.id===7?'0x01':'0x00',32)}));if(options.missing)rows.pop();return {ok:true,json:async()=>rows.reverse()}}}
test('minted-page returns only minted IDs despite out-of-order RPC batch replies',async()=>{const out=await inspect({page:'11'},{fetch:fixture()});assert.equal(out.contract,info.address);assert.deepEqual(out.minted,[444])})
test('minted-page fails closed on wrong code, incomplete data or invalid page',async()=>{await assert.rejects(inspect({page:'11'},{fetch:fixture({wrongCode:true})}),/mismatch/);await assert.rejects(inspect({page:'11'},{fetch:fixture({missing:true})}),/batch/);await assert.rejects(inspect({page:'250'},{fetch:fixture()}),/Invalid page/)})
