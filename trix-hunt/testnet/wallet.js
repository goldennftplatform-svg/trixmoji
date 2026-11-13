(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TrixSepoliaWallet=factory();}(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function walletError(error){
  var code=Number(error&&(error.code||(error.data&&error.data.originalError&&error.data.originalError.code)));
  if(code===4001)return Error('The wallet request was cancelled. Open your wallet and try again.');
  if(code===-32002)return Error('Your wallet already has a request open. Open the wallet extension and finish or reject it before trying again.');
  var detail=typeof(error&&error.message)==='string'?error.message.replace(/https?:\/\/\S+/gi,'[private URL]').slice(0,180):'';
  return Error(detail?'Wallet connection: '+detail:'The wallet did not respond. Open the wallet extension and try again.');
 }
 async function request(provider,method,params,timeoutMs){
  var timer;
  try{
   // Invoke the provider synchronously while the connect click is still active.
   var pending=provider.request({method:method,params:params||[]});
   return await Promise.race([Promise.resolve(pending),new Promise(function(_,reject){timer=setTimeout(function(){reject(Error('The wallet did not respond. Open the wallet extension and check for a pending request before retrying.'));},timeoutMs||60000);})]);
  }
   catch(error){var friendly=walletError(error);friendly.code=error&&(error.code||(error.data&&error.data.originalError&&error.data.originalError.code));throw friendly;}finally{clearTimeout(timer);}
 }
 function selected(accounts,expected){
  var account=Array.isArray(accounts)&&accounts[0];
  if(!/^0x[a-f0-9]{40}$/i.test(String(account||''))||(expected&&String(account).toLowerCase()!==expected.toLowerCase())){
   var error=Error(expected?'Connected: '+(account||'no account')+'. Select test wallet '+expected+' in your wallet.':'No Ethereum account was selected.');error.code='WRONG_ACCOUNT';throw error;
  }
  return account;
 }
 async function connect(provider,expected,onProgress){
  onProgress=onProgress||function(){};if(!provider||typeof provider.request!=='function')throw Error('Choose a wallet extension, then connect again.');
  onProgress('Open your wallet extension and approve the connection if requested.');
  var accounts=await request(provider,'eth_requestAccounts');
  var account=selected(accounts,expected);
  var chain=await request(provider,'eth_chainId');
  var isSepolia=function(value){try{return BigInt(value)===11155111n;}catch(_){return false;}};
  if(!isSepolia(chain)){
   onProgress('Open your wallet and approve switching to the Sepolia test network.');
   try{await request(provider,'wallet_switchEthereumChain',[{chainId:'0xaa36a7'}]);}
   catch(error){
    if(Number(error.code)!==4902&&!/unrecognized chain|unknown chain|chain.*not.*added/i.test(error.message))throw error;
    onProgress('Sepolia is missing from this wallet. Approve adding Ethereum Sepolia, then approve the network switch.');
    await request(provider,'wallet_addEthereumChain',[{chainId:'0xaa36a7',chainName:'Ethereum Sepolia',nativeCurrency:{name:'Sepolia Ether',symbol:'ETH',decimals:18},rpcUrls:['https://ethereum-sepolia-rpc.publicnode.com'],blockExplorerUrls:['https://sepolia.etherscan.io']}]);
    await request(provider,'wallet_switchEthereumChain',[{chainId:'0xaa36a7'}]);
   }
   chain=await request(provider,'eth_chainId');
  }
  if(!isSepolia(chain))throw Error('The wallet is not on Sepolia. Switch networks in your wallet and connect again.');
   selected(await request(provider,'eth_accounts'),expected);
   return account;
 }
 async function selectAccount(provider,expected){
  try{await request(provider,'wallet_requestPermissions',[{eth_accounts:{}}]);}
  catch(error){if(/cancelled|pending request|already has a request/i.test(error.message))throw error;throw Error('Your wallet could not open account selection. Select the test account in the wallet extension, then click CONNECT TEST WALLET.');}
  return selected(await request(provider,'eth_accounts'),expected);
 }
 return {connect:connect,selectAccount:selectAccount};
}));
