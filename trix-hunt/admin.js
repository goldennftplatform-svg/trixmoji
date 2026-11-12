(function(){
 'use strict';
 var ADMIN='0x915a3d363d0a4e4470b531f008f5142c540e5417',MARKET='0x21c1a938d06f87a039abfc48d1ccb459f55b1685';
 var token='',version=null,items=[],order=[],mode='auto',dirty=false,pendingProvider=null,watchedProviders=new WeakSet();
 function $(id){return document.getElementById(id);}
 function make(tag,cls,value){var e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e;}
 function signMessage(nonce,expires){return ['Trix Hunt inventory admin','Action: sign in','Chain: 1','Escrow: '+MARKET,'Admin: '+ADMIN,'Nonce: '+nonce,'Expires: '+expires].join('\n');}
 async function api(body){var response=await fetch('/.netlify/functions/trix-hunt-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});var data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'Admin service unavailable');return data;}
 function lock(message){token='';$('adminContent').hidden=true;$('adminLogin').hidden=false;$('loginStatus').textContent=message||'';}
 async function metadata(deposit){var response=await fetch('/assets/ethscriptions/trixmoji-launch/'+deposit.tokenNo+'.json');if(!response.ok)throw Error('Metadata unavailable for #'+deposit.tokenNo);var data=await response.json();var t=(data.properties&&data.properties.tokens||[]).filter(function(x){return Number.isInteger(x.rank)&&x.rank>0;}).sort(function(a,b){return a.rank-b.rank||(b.pixels||0)-(a.pixels||0);});if(!t.length)throw Error('Missing token metadata for #'+deposit.tokenNo);return {id:deposit.id.toLowerCase(),tokenNo:deposit.tokenNo,rank:t[0].rank,symbol:t[0].symbol,pixels:t[0].pixels||0,cooldown:deposit.cooldown};}
 function sorted(){return items.slice().sort(function(a,b){return a.rank-b.rank||b.pixels-a.pixels||a.tokenNo-b.tokenNo;}).map(function(x){return x.id;});}
 function count(){var n=Number($('bestCount').value);return Number.isInteger(n)&&n>=0&&n<=items.length?n:null;}
 function render(){
  var list=$('inventoryList');list.textContent='';var lookup=new Map(items.map(function(x){return[x.id,x];})),best=count();
  order.forEach(function(id,index){var item=lookup.get(id);if(!item)return;var row=make('article','inventory-item'+(best!==null&&index<best?' best':''));var img=make('img');img.src='/assets/ethscriptions/trixmoji-launch/'+item.tokenNo+'.webp';img.alt='TrixMoji #'+item.tokenNo;img.loading='lazy';
   var copy=make('div','item-copy');copy.append(make('strong',null,'#'+item.tokenNo+' · $'+item.symbol),make('span',null,'COIN RANK '+item.rank+' / '+item.pixels+' COIN TILES'),make('small',null,(best!==null&&index<best?'BEST POOL':'STANDARD')+' · POSITION '+(index+1)),make('span',null,item.cooldown?'COOLDOWN '+item.cooldown+' BLOCKS':'COOLDOWN COMPLETE'));
   var controls=make('div','move-controls');[-1,1].forEach(function(delta){var b=make('button',null,delta<0?'↑':'↓');b.type='button';b.disabled=index+delta<0||index+delta>=order.length;b.setAttribute('aria-label','Move #'+item.tokenNo+(delta<0?' up':' down'));b.onclick=function(){var next=index+delta,tmp=order[next];order[next]=order[index];order[index]=tmp;mode='manual';dirty=true;$('saveStatus').textContent='Order changed; save to persist.';render();};controls.append(b);});row.append(img,copy,controls);list.append(row);
  });
  if(!order.length)list.append(make('p','disclaimer','No verified creator-owned escrow deposits found.'));
  $('inventoryCount').textContent=items.length+' CREATOR DEPOSITS';$('orderMode').textContent=mode.toUpperCase();
 }
 async function refresh(){
  $('refreshEscrow').disabled=true;$('escrowStatus').textContent='Checking verified creator deposits…';
  try{var data=await api({action:'data',token:token});items=await Promise.all(data.deposits.map(metadata));version=data.version;
   var ids=new Set(items.map(function(x){return x.id;})),saved=data.config&&data.config.order;
   var valid=Array.isArray(saved)&&saved.length===items.length&&new Set(saved).size===saved.length&&saved.every(function(id){return ids.has(id);});
   mode=valid&&data.config.mode==='manual'?'manual':'auto';order=mode==='manual'?saved.slice():sorted();
   $('bestCount').max=items.length;$('bestCount').value=valid&&Number.isInteger(data.config.bestCount)?Math.min(data.config.bestCount,items.length):items.length;
   $('escrowCount').textContent=items.length;$('indexedBlock').textContent=data.indexedBlock.toLocaleString();$('escrowStatus').textContent='Indexed escrow '+data.marketAddress+' · block '+data.indexedBlock.toLocaleString();
   dirty=false;$('saveStatus').textContent=valid?'Saved order loaded.':'Inventory changed or no saved order; review and save.';render();
  }catch(error){if(error.message==='Unauthorized')lock('Session expired. Connect the creator wallet again.');else $('escrowStatus').textContent=error.message;}
  finally{$('refreshEscrow').disabled=false;}
 }
 async function signIn(provider,address){
    await EthscriptionCheckout.identity(provider,address);
    var bytes=crypto.getRandomValues(new Uint8Array(16)),nonce='0x'+Array.from(bytes,function(b){return b.toString(16).padStart(2,'0');}).join(''),expires=Math.floor(Date.now()/1000)+120;
    $('loginStatus').textContent='Open your wallet and sign the admin login message. No transaction is requested.';
    var signature=await provider.request({method:'personal_sign',params:[signMessage(nonce,expires),address]});
    await EthscriptionCheckout.identity(provider,address);
    var result=await api({action:'login',nonce:nonce,expires:expires,signature:signature});
    await EthscriptionCheckout.identity(provider,address);
    if(provider.on&&!watchedProviders.has(provider)){watchedProviders.add(provider);['accountsChanged','chainChanged','disconnect'].forEach(function(event){provider.on(event,function(){if(token)lock('Wallet changed. Connect the creator wallet again.');});});}
    token=result.token;pendingProvider=null;$('selectAdmin').hidden=true;$('adminLogin').hidden=true;$('adminContent').hidden=false;await refresh();
 }
 $('connectAdmin').onclick=async function(){
  $('connectAdmin').disabled=true;$('loginStatus').textContent='Choose the creator wallet.';
  try{var connection=await MarketWalletConnector.connect($('walletChoices'),function(m){$('loginStatus').textContent=m;});
   if(connection.address.toLowerCase()!==ADMIN){pendingProvider=connection.provider;$('selectAdmin').hidden=false;throw Error('Connected: '+connection.address+'. Required creator: '+ADMIN+'. Select the creator account in your wallet.');}
   await signIn(connection.provider,connection.address);
  }catch(error){lock(error.message||'Wallet login failed.');}finally{$('connectAdmin').disabled=false;}
 };
 $('selectAdmin').onclick=async function(){
  $('selectAdmin').disabled=true;$('loginStatus').textContent='Select the creator account in your wallet.';
  try{var address=await TrixHuntAdminWallet.selectCreator(pendingProvider,ADMIN);await signIn(pendingProvider,address);}
  catch(error){lock(error.message||'Could not select the creator account.');}finally{$('selectAdmin').disabled=false;}
 };
 window.addEventListener('market-wallet-change',function(){if(token&&!MarketWalletConnector.current())lock('Wallet changed. Connect the creator wallet again.');});
 $('refreshEscrow').onclick=refresh;$('bestCount').oninput=function(){dirty=true;render();};
 $('autoRank').onclick=function(){order=sorted();mode='auto';dirty=true;$('saveStatus').textContent='Metadata order calculated; save to persist.';render();};
 $('saveOrder').onclick=async function(){var n=count();if(n===null){$('saveStatus').textContent='Enter a valid best-pool size.';return;}$('saveOrder').disabled=true;try{await api({action:'save',token:token,order:order,mode:mode,bestCount:n,version:version});await refresh();$('saveStatus').textContent='Order saved for the creator’s verified escrow deposits.';}catch(error){$('saveStatus').textContent=error.message;if(error.message==='Unauthorized')lock('Session expired. Connect again.');}finally{$('saveOrder').disabled=false;}};
 setInterval(function(){if(token&&!dirty&&!document.hidden&&!$('refreshEscrow').disabled)refresh();},120000);
}());
