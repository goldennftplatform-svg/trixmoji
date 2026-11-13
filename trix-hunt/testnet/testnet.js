(function(){
 'use strict';
 var ACCOUNT='0x47cf60bdd877203264921d05ce26f81f6d36aa3e',CHAIN=11155111,KEY='trix-hunt-sepolia-vault-test-v1';
 var $=function(id){return document.getElementById(id)}, providers=[],provider=null,signer=null,artifact=null,busy=false,rawProvider=null,watched=new WeakSet();
 var state;try{state=JSON.parse(localStorage.getItem(KEY)||'null')||{stage:'new'};}catch(_){state={stage:'new'};}
 function same(a,b){return String(a||'').toLowerCase()===String(b||'').toLowerCase();}
 function save(){localStorage.setItem(KEY,JSON.stringify(state));}
 function say(s){$('status').textContent=s;}
 function facts(){var pending=state.pending;$('facts').textContent='Network: Sepolia (11155111)\nTest wallet: '+ACCOUNT+'\nTest vault: '+(state.vault||'not deployed')+'\nTest item: '+(state.id||'not created')+'\nStage: '+state.stage+(pending?'\nPending: '+pending.step+' · '+(pending.hash||'no hash saved'):'');}
 function controls(){['connect','selectAccount','refreshWallets','deploy','create','deposit','recover','check','clearUnsent','newTest'].forEach(function(id){$(id).disabled=true;});$('connect').disabled=busy;$('selectAccount').disabled=busy;$('refreshWallets').disabled=busy;$('walletButtons').querySelectorAll('button').forEach(function(b){b.disabled=busy;});var ready=!!provider&&!!artifact&&!busy;
  var canRecover=!!(state.pending&&state.pending.step==='create'&&!state.pending.hash&&state.stage==='deployed');$('noHashRecovery').hidden=!canRecover;
  if(ready&&state.pending){$('check').disabled=false;if(canRecover&&$('walletChecked').checked)$('clearUnsent').disabled=false;}
  else if(ready){if(state.stage==='new')$('deploy').disabled=false;if(state.stage==='deployed')$('create').disabled=false;if(state.stage==='created')$('deposit').disabled=false;if(state.stage==='deposited')$('recover').disabled=false;if(state.stage==='complete')$('newTest').disabled=false;}facts();}
 function addProvider(p,name){if(!p||!p.request||providers.some(function(x){return x.provider===p;}))return;providers.push({provider:p,name:name});var index=String(providers.length-1),opt=document.createElement('option');opt.value=index;opt.textContent=name;$('walletProvider').append(opt);if(p.isRabby)$('walletProvider').value=index;var button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='CONNECT '+name.toUpperCase();button.disabled=busy;button.onclick=function(){$('walletProvider').value=index;connectProvider(p);};$('walletButtons').append(button,document.createTextNode(' '));}
 window.addEventListener('eip6963:announceProvider',function(event){if(event.detail)addProvider(event.detail.provider,(event.detail.info&&event.detail.info.name)||'Ethereum wallet');});
 function discover(){window.dispatchEvent(new Event('eip6963:requestProvider'));setTimeout(function(){var list=window.ethereum&&(window.ethereum.providers||[window.ethereum])||[];list.forEach(function(p){addProvider(p,p.isRabby?'Rabby':p.isMetaMask?'MetaMask':'Browser wallet');});if(provider||busy)return;if(!providers.length)say('No browser wallet was found. Open this page in your wallet-enabled browser, unlock the extension and click FIND WALLETS AGAIN.');else say((state.stage==='deployed'?'The test vault is verified. ':'')+'Choose your wallet and click CONNECT TEST WALLET. If no pop-up appears, open the wallet extension to check for a pending request.');},350);}
 discover();
 async function identity(){if(!provider)throw Error('Connect the wallet first.');var chain=await provider.send('eth_chainId',[]),accounts=await provider.send('eth_accounts',[]);if(Number(BigInt(chain))!==CHAIN)throw Error('Switch the wallet to Ethereum Sepolia before continuing.');if(!accounts[0]||!same(accounts[0],ACCOUNT))throw Error('Select the configured test wallet '+ACCOUNT+'.');}
 async function json(url){var r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Local indexer is not ready yet.');return r.json();}
 function nonce(){var b=crypto.getRandomValues(new Uint8Array(16));return Array.from(b,function(x){return x.toString(16).padStart(2,'0');}).join('');}
 async function waitIndexed(id,receipt,owner,previous,from,to){
  for(var i=0;i<36;i++){
   var status=await json('/indexer/status');
   if(Number(status.last_imported_block)>=receipt.blockNumber){
    try{var data=await json('/indexer/ethscriptions/'+id),a=data.result;
     var transfer=Array.isArray(a.ethscription_transfers)&&a.ethscription_transfers.some(function(t){return same(t.transaction_hash,receipt.transactionHash)&&same(t.from_address,from)&&same(t.to_address,to);});
     if(same(a.transaction_hash,id)&&same(a.current_owner,owner)&&(!previous||same(a.previous_owner,previous))&&transfer)return a;
    }catch(_){}
   }
   say('Transaction confirmed. Waiting for the Sepolia indexer to verify the exact transfer…');await new Promise(function(r){setTimeout(r,5000);});
  }
  throw Error('Indexer verification is still pending. Use CHECK PENDING TRANSACTION; do not repeat the transfer.');
 }
 async function deployedVault(address){
  var code=await provider.getCode(address);if(!code||code==='0x'||!same(ethers.utils.keccak256(code),artifact.runtimeHash))throw Error('Test vault bytecode does not match the compiled artifact.');
  var contract=new ethers.Contract(address,artifact.abi,provider);var roles=await Promise.all([contract.depositor(),contract.curator()]);
  if(!same(roles[0],ACCOUNT)||!same(roles[1],ACCOUNT))throw Error('Test vault roles do not match the selected wallet.');return contract;
 }
 async function checkPending(){
  await identity();var p=state.pending;if(!p)throw Error('No pending transaction.');
  var hash=p.hash||$('pendingHash').value.trim();if(!/^0x[a-f0-9]{64}$/i.test(hash))throw Error('Enter the transaction hash from wallet activity; do not send another transaction.');
  p.hash=hash;save();var tx=await provider.getTransaction(hash),receipt=await provider.getTransactionReceipt(hash);
  if(!tx||!receipt)throw Error('Transaction is not confirmed yet. Check again shortly.');
  if(!same(tx.hash,hash)||!same(receipt.transactionHash,hash)||!same(tx.from,ACCOUNT)||!same(tx.data,p.data)||!ethers.BigNumber.from(tx.value).isZero()||(p.to?!same(tx.to,p.to):!!tx.to))throw Error('Transaction does not match the saved test request. Keep this record and inspect wallet activity.');
  if(receipt.status!==1)throw Error('Transaction failed. Keep this record for inspection before retrying.');
  if(p.step==='deploy'){
   if(!receipt.contractAddress)throw Error('No test vault address was created.');await deployedVault(receipt.contractAddress);state.vault=receipt.contractAddress;state.stage='deployed';
  } else if(p.step==='create'){
   await waitIndexed(hash,receipt,ACCOUNT,null,ACCOUNT,ACCOUNT);state.id=hash;state.stage='created';
  } else if(p.step==='deposit'){
   var contract=await deployedVault(state.vault),entry=await contract.entries(state.id);
   var matches=receipt.logs.filter(function(log){if(!same(log.address,state.vault))return false;try{var e=contract.interface.parseLog(log);return e.name==='PotentialDeposit'&&same(e.args.id,state.id)&&same(e.args.depositor,ACCOUNT)&&e.args.blockNumber.eq(receipt.blockNumber);}catch(_){return false;}});
   if(matches.length!==1||Number(entry.status)!==1||!entry.receivedBlock.eq(receipt.blockNumber))throw Error('Vault entry or deposit event does not match. Inspect before continuing.');
   await waitIndexed(state.id,receipt,state.vault,ACCOUNT,ACCOUNT,state.vault);state.depositBlock=receipt.blockNumber;state.stage='deposited';
  } else if(p.step==='recover'){
   var vault=await deployedVault(state.vault),topic=ethers.utils.id('ethscriptions_protocol_TransferEthscriptionForPreviousOwner(address,address,bytes32)');
   var event=receipt.logs.some(function(log){return same(log.address,state.vault)&&same(log.topics[0],topic)&&same(log.topics[1],ethers.utils.hexZeroPad(ACCOUNT,32))&&same(log.topics[2],ethers.utils.hexZeroPad(ACCOUNT,32))&&same(log.topics[3],state.id);});
   if(!event)throw Error('Matching Ethscriptions return event was not found. Inspect before continuing.');
   await waitIndexed(state.id,receipt,ACCOUNT,state.vault,state.vault,ACCOUNT);state.stage='complete';
  }else throw Error('Unknown saved test step.');
  state.pending=null;save();say(state.stage==='complete'?'Success: the test item returned to your wallet and the local Sepolia indexer confirmed the exact transfer.':'Step verified. Continue with the next button.');
 }
 async function request(step,to,data){
  if(!navigator.locks)throw Error('This test needs a browser with Web Locks support to prevent duplicate wallet requests.');
  return navigator.locks.request(KEY,{ifAvailable:true},async function(lock){
   if(!lock)throw Error('A test request is already running in another tab.');
   await identity();var saved=JSON.parse(localStorage.getItem(KEY)||'null');if(state.pending||(saved&&saved.pending)||(saved&&saved.stage!==state.stage))throw Error('A previous test request needs checking. Reload this page.');
   var nonces=await Promise.all([provider.getTransactionCount(ACCOUNT,'latest'),provider.getTransactionCount(ACCOUNT,'pending')]);
   if(nonces[0]!==nonces[1])throw Error('The wallet has a pending transaction. Resolve it before starting another test.');
   state.pending={step:step,to:to||null,data:data,hash:null,startingNonce:nonces[0]};save();controls();
   try{say('Open your wallet extension and approve the Sepolia test transaction.');var request={from:ACCOUNT,data:data,value:'0x0'};if(to)request.to=to;var hash=await rawProvider.request({method:'eth_sendTransaction',params:[request]});if(!/^0x[a-f0-9]{64}$/i.test(String(hash||'')))throw Error('The wallet returned no hash. Check wallet activity before retrying.');state.pending.hash=hash;save();say('Submitted. Checking the Sepolia transaction and indexer…');await checkPending();}
   catch(error){var code=error&&error.code;if((Number(code)===4001||code==='ACTION_REJECTED')&&!state.pending.hash){state.pending=null;save();throw Error('Wallet request was rejected; no transaction was sent.');}throw error;}
  });
 }
 async function clearUnsent(){
  if(!$('walletChecked').checked)throw Error('First check your wallet for an open approval or pending transaction.');
  if(!navigator.locks)throw Error('This check needs a browser with Web Locks support.');
  return navigator.locks.request(KEY,{ifAvailable:true},async function(lock){
   if(!lock)throw Error('A test request is still running in another tab.');
   await identity();var snapshot=localStorage.getItem(KEY),saved=JSON.parse(snapshot||'null');if(!saved||JSON.stringify(saved)!==JSON.stringify(state))throw Error('The saved request changed. Reload and inspect it.');
   await deployedVault(saved.vault);
   var deploymentHash='0x7803ee8ade658f013a9d95742d3df4edc955cf60c6229e86d95bcf7e8ac432dc';
   var checks=await Promise.all([provider.getTransaction(deploymentHash),provider.getTransactionReceipt(deploymentHash),provider.getTransactionCount(ACCOUNT,'latest'),provider.getTransactionCount(ACCOUNT,'pending'),json('/indexer/status')]);
   var payload;try{payload=ethers.utils.toUtf8String(saved.pending.data);}catch(_){throw Error('The saved test request is invalid.');}
   var testPayload=false;try{testPayload=/^TRIX-HUNT-SEPOLIA-TEST-[a-f0-9]{32}$/.test(atob(payload.split(',')[1]||''))&&payload.startsWith('data:text/plain;base64,');}catch(_){}
   var evidence={walletChecked:true,testPayload:testPayload,deployment:checks[0],receipt:checks[1],latest:checks[2],pending:checks[3],indexed:Number(checks[4].last_imported_block),head:Number(checks[4].current_block_number)};
   TrixSepoliaNoHash.check(saved,evidence);
   var again=await Promise.all([provider.getTransactionCount(ACCOUNT,'latest'),provider.getTransactionCount(ACCOUNT,'pending')]);
   if(again[0]!==evidence.latest||again[1]!==evidence.pending||localStorage.getItem(KEY)!==snapshot)throw Error('The wallet or saved request changed. Reload and inspect it.');
   localStorage.setItem(KEY+'.recovery.'+Date.now(),snapshot);state.pending=null;save();$('walletChecked').checked=false;
   say('The unsent test request was checked and cleared. No transaction was sent. You can now try CREATE TEST ITEM again.');
  });
 }
 async function run(fn){if(busy)return;busy=true;controls();try{await fn();}catch(e){say(e.message||'Test step failed.');}finally{busy=false;controls();}}
 async function finishConnect(p){
  await TrixSepoliaWallet.connect(p,ACCOUNT,say);
  provider=new ethers.providers.Web3Provider(p,'any');signer=provider.getSigner();await identity();artifact=await json('/artifact');if(artifact.chainId!==CHAIN||!same(artifact.depositor,ACCOUNT)||!same(artifact.curator,ACCOUNT))throw Error('Test artifact configuration is invalid.');
  rawProvider=p;
  if(p.on&&!watched.has(p)){watched.add(p);['accountsChanged','chainChanged','disconnect'].forEach(function(event){p.on(event,function(){if(rawProvider===p){provider=null;signer=null;rawProvider=null;say('Wallet or network changed. Connect the test account again.');controls();}});});}
  say(state.pending?'Wallet connected on Sepolia. Your earlier deployment is saved; click CHECK PENDING TRANSACTION.':'Connected to Sepolia. Use the next enabled button.');
 }
 function connectProvider(p){run(async function(){if(!p)throw Error('No wallet selected. Unlock your wallet and click FIND WALLETS AGAIN.');provider=null;signer=null;rawProvider=p;await finishConnect(p);});}
 $('connect').onclick=function(){var selected=providers[Number($('walletProvider').value)];connectProvider(selected&&selected.provider);};
 $('refreshWallets').onclick=function(){say('Looking for wallet extensions…');discover();};
 $('selectAccount').onclick=function(){var selected=providers[Number($('walletProvider').value)],p=selected&&selected.provider;run(async function(){if(!p)throw Error('Choose your wallet first.');provider=null;signer=null;rawProvider=p;say('Open the wallet extension and select the test account.');await TrixSepoliaWallet.selectAccount(p,ACCOUNT);await finishConnect(p);});};
 $('deploy').onclick=function(){run(async function(){var f=new ethers.ContractFactory(artifact.abi,artifact.bytecode,signer);var tx=f.getDeployTransaction(ACCOUNT,ACCOUNT);await request('deploy',null,tx.data);});};
 $('create').onclick=function(){run(async function(){await deployedVault(state.vault);var uri='data:text/plain;base64,'+btoa('TRIX-HUNT-SEPOLIA-TEST-'+nonce());await request('create',ACCOUNT,ethers.utils.hexlify(ethers.utils.toUtf8Bytes(uri)));});};
 $('deposit').onclick=function(){run(async function(){var vault=await deployedVault(state.vault),sighashes=Object.keys(vault.interface.functions).map(function(k){return vault.interface.getSighash(k).toLowerCase();});if(sighashes.includes(state.id.slice(0,10).toLowerCase()))throw Error('Test ID conflicts with a vault function selector. Do not send.');var data=await json('/indexer/ethscriptions/'+state.id);if(!data.result||!same(data.result.current_owner,ACCOUNT))throw Error('Indexer does not show the test item in this wallet.');await request('deposit',state.vault,state.id);});};
 $('recover').onclick=function(){run(async function(){var vault=await deployedVault(state.vault),head=await provider.getBlockNumber();if(head<state.depositBlock+5)throw Error('Waiting for five Sepolia blocks after deposit. Try again shortly.');var data=await json('/indexer/ethscriptions/'+state.id);if(!data.result||!same(data.result.current_owner,state.vault)||!same(data.result.previous_owner,ACCOUNT))throw Error('Indexer does not confirm the test vault owns this item.');await request('recover',state.vault,vault.interface.encodeFunctionData('recover',[state.id]));});};
 $('newTest').onclick=function(){run(async function(){if(!navigator.locks)throw Error('This test needs Web Locks support.');await navigator.locks.request(KEY,{ifAvailable:true},async function(lock){if(!lock)throw Error('Another test request is running.');await identity();var snapshot=localStorage.getItem(KEY),saved=JSON.parse(snapshot||'null');if(!saved||saved.stage!=='complete'||saved.pending||JSON.stringify(saved)!==JSON.stringify(state)||!/^0x[a-f0-9]{64}$/i.test(String(saved.id||'')))throw Error('The completed test record changed. Reload and inspect it.');await deployedVault(saved.vault);var check=await Promise.all([json('/indexer/status'),json('/indexer/ethscriptions/'+saved.id)]),status=check[0],item=check[1].result,head=Number(status.current_block_number),indexed=Number(status.last_imported_block);if(!Number.isSafeInteger(head)||!Number.isSafeInteger(indexed)||indexed>head||head-indexed>2||!item||!same(item.transaction_hash,saved.id)||!same(item.current_owner,ACCOUNT)||!same(item.previous_owner,saved.vault))throw Error('Indexer does not currently confirm the previous test item returned. Try again later.');if(localStorage.getItem(KEY)!==snapshot)throw Error('The test record changed. Reload and inspect it.');localStorage.setItem(KEY+'.completed.'+saved.id,snapshot);state={stage:'deployed',vault:saved.vault,pending:null};save();say('Ready for another test item. The verified test vault is reused; no transaction was sent.');});});};
 $('check').onclick=function(){run(checkPending);};
 $('walletChecked').onchange=controls;
 $('clearUnsent').onclick=function(){run(clearUnsent);};
 controls();
}());
