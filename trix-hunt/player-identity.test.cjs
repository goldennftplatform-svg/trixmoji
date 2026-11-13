'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),{resolve}=require('./player-identity.js')
const wallet='0x47cf60bdd877203264921d05ce26f81f6d36aa3e',id='a1234567-bbbb-4444-8888-cccccccccccc'
test('uses an entered name without opening or querying a wallet',async()=>{let calls=0;const r=await resolve('  TRIX Fan! ',{request(){calls++;}},id);assert.deepEqual(r,{nickname:'TRIX Fan',playerId:id});assert.equal(calls,0)})
test('blank name uses an already-connected wallet as the label without changing player ID or requesting a popup',async()=>{let calls=[];const r=await resolve('',{request:async({method})=>{calls.push(method);return[wallet]}},id);assert.equal(r.nickname,'0x47cf...aa3e');assert.equal(r.playerId,id);assert.deepEqual(calls,['eth_accounts'])})
test('blank name without a connected wallet remains playable with an anonymous label',async()=>{const r=await resolve('',{request:async()=>[]},id);assert.equal(r.nickname,'PLAYER-A12345');assert.equal(r.playerId,id)})
