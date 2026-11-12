(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TrixHuntAdminWallet=factory();}(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function same(a,b){return String(a||'').toLowerCase()===String(b||'').toLowerCase();}
 async function selectCreator(provider,expected){
  if(!provider||typeof provider.request!=='function')throw Error('Wallet provider unavailable. Connect again.');
  try{await provider.request({method:'wallet_requestPermissions',params:[{eth_accounts:{}}]});}
  catch(error){if(Number(error&&error.code)===4001)throw Error('Account selection was cancelled. Choose the creator account and try again.');throw Error('This wallet could not open its account selector. Open the wallet, select the creator account, then connect again.');}
  var accounts=await provider.request({method:'eth_accounts'});
  if(!Array.isArray(accounts)||!same(accounts[0],expected))throw Error('Connected account: '+(accounts&&accounts[0]||'none')+'. Select creator wallet '+expected+' in your wallet, then try again.');
  return accounts[0];
 }
 return {selectCreator:selectCreator};
}));
