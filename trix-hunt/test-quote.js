(function(){
 'use strict';
 var panel=document.getElementById('testQuotePanel');
 if(!panel||!['127.0.0.1','localhost'].includes(location.hostname))return;
 panel.hidden=false;
 function formatWei(value){var s=String(value).padStart(19,'0'),whole=s.slice(0,-18),fraction=s.slice(-18).replace(/0+$/,'');return whole+(fraction?'.'+fraction:'');}
 async function refresh(){
  var status=document.getElementById('testQuoteStatus');
  try{var endpoint=location.port==='8790'?'/quote':'/test-quote',response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.timeout(15000)}),data=await response.json();
   if(!response.ok||!data.ok||data.chainId!=='11155111'||!Array.isArray(data.prices))throw Error('unavailable');
   document.querySelectorAll('[data-test-quote]').forEach(function(el){var row=data.prices.find(function(item){return item.pack===el.dataset.testQuote;});el.textContent=row?formatWei(row.wei)+' TEST ETH':'—';});
   status.textContent='Sepolia feed · reference quote only · no payment or prize transfer';
  }catch(_){status.textContent='Sepolia quote unavailable. No payment was requested.';document.querySelectorAll('[data-test-quote]').forEach(function(el){el.textContent='—';});}
 }
 refresh();setInterval(function(){if(!document.hidden)refresh();},60000);
}());
