(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TrixPlayerIdentity=factory();}(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function name(value){return String(value||'').replace(/[^A-Za-z0-9 ._-]/g,'').trim().replace(/ +/g,' ').slice(0,24);}
 async function connectedAccount(ethereum){
  var providers=ethereum?(Array.isArray(ethereum.providers)?ethereum.providers:[ethereum]):[];
  var accounts=await Promise.all(providers.map(async function(provider){
   if(!provider||typeof provider.request!=='function')return null;var timer;
   try{var result=await Promise.race([provider.request({method:'eth_accounts'}),new Promise(function(resolve){timer=setTimeout(function(){resolve([]);},1000);})]);return Array.isArray(result)&&/^0x[a-f0-9]{40}$/i.test(String(result[0]||''))?result[0]:null;}
   catch(_){return null;}finally{clearTimeout(timer);}
  }));
  return accounts.find(Boolean)||null;
 }
 async function resolve(value,ethereum,fallbackId){
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(String(fallbackId||'')))throw Error('Invalid player ID');
  var typed=name(value);if(typed)return {nickname:typed,playerId:fallbackId};
  var wallet=await connectedAccount(ethereum);
  if(wallet)return {nickname:wallet.slice(0,6)+'...'+wallet.slice(-4),playerId:fallbackId};
  return {nickname:'PLAYER-'+fallbackId.replace(/[^A-Za-z0-9]/g,'').slice(0,6).toUpperCase(),playerId:fallbackId};
 }
 return {resolve:resolve,connectedAccount:connectedAccount};
}));
