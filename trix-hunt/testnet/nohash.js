(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TrixSepoliaNoHash=factory();}(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 var account='0x47cf60bdd877203264921d05ce26f81f6d36aa3e',vault='0x6d2b465ce1dd7a0192f67d6d257e06444d8a0eb1',deploy='0x7803ee8ade658f013a9d95742d3df4edc955cf60c6229e86d95bcf7e8ac432dc';
 function same(a,b){return String(a||'').toLowerCase()===String(b||'').toLowerCase();}
 function check(state,e){
  var p=state&&state.pending;
  if(!p||p.step!=='create'||p.hash||state.stage!=='deployed'||!same(state.vault,vault)||!same(p.to,account)||!/^0x[a-f0-9]+$/i.test(String(p.data||''))||!e||e.walletChecked!==true||e.testPayload!==true)throw Error('This check only applies to the saved no-hash test item request after you check your wallet.');
  var tx=e.deployment,receipt=e.receipt;
  if(!tx||!receipt||!same(tx.hash,deploy)||!same(receipt.transactionHash,deploy)||!same(tx.from,account)||tx.to!==null||receipt.status!==1||!same(receipt.contractAddress,vault)||!Number.isSafeInteger(tx.nonce)||!Number.isSafeInteger(receipt.blockNumber))throw Error('The saved test vault deployment could not be verified.');
  var baseline=p.startingNonce===undefined?tx.nonce+1:p.startingNonce;
  if(!Number.isSafeInteger(baseline)||baseline<tx.nonce+1||e.latest!==baseline||e.pending!==baseline)throw Error('The wallet nonce changed or a transaction is pending. Do not retry; inspect wallet activity.');
  if(!Number.isSafeInteger(e.indexed)||!Number.isSafeInteger(e.head)||e.indexed<receipt.blockNumber||e.indexed>e.head||e.head-e.indexed>2)throw Error('The Sepolia indexer is not sufficiently up to date.');
  return {baseline:baseline};
 }
 return {check:check};
}));
