(function(){
  'use strict';
  var items=[],config=null;
  function $(id){return document.getElementById(id);}
  function make(tag,className,text){var node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function count(){var n=Number($('bestCount').value);return Number.isInteger(n)&&n>=1&&n<items.length?n:null;}
  function render(){
    var list=$('inventoryList');list.textContent='';var best=count();
    var byId=new Map(items.map(function(item){return[item.id,item];}));
    config.order.forEach(function(id,index){
      var item=byId.get(id),row=make('article','inventory-item'+(best!==null&&index<best?' best':''));
      var image=make('img');image.src='/assets/ethscriptions/trixmoji-launch/'+id+'.webp';image.alt='TrixMoji #'+id;image.loading='lazy';
      var copy=make('div','item-copy');copy.append(make('strong',null,'#'+id+'  ·  $'+item.symbol),make('span',null,'COIN RANK '+item.metadataRank+' / '+item.pixels+' COIN TILES'),make('small',null,(best!==null&&index<best?'BEST POOL':'STANDARD POOL')+' · POSITION '+(index+1)));
      var controls=make('div','move-controls');
      [-1,1].forEach(function(delta){var btn=make('button',null,delta<0?'↑':'↓');btn.type='button';btn.disabled=index+delta<0||index+delta>=config.order.length;btn.setAttribute('aria-label','Move #'+id+(delta<0?' up':' down'));btn.addEventListener('click',function(){var next=index+delta;var tmp=config.order[next];config.order[next]=config.order[index];config.order[index]=tmp;config.mode='manual';$('saveStatus').textContent='Manual order changed. Save to apply it to your next local playtest round.';render();var moved=document.querySelector('[aria-label="Move #'+id+(delta<0?' up':' down')+'"]');if(moved&&!moved.disabled)moved.focus();});controls.append(btn);});
      row.append(image,copy,controls);list.append(row);
    });
    $('inventoryCount').textContent=items.length+' DEMO PIECES · '+config.mode.toUpperCase();
  }
  async function escrow(){
    $('refreshEscrow').disabled=true;$('escrowStatus').textContent='Checking indexed escrow…';
    try{
      var url=location.hostname==='127.0.0.1'||location.hostname==='localhost'?'/escrow-snapshot':'/.netlify/functions/trixmoji-market-launch';
      var response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Market API unavailable');
      var data=await response.json();if(!data.ok||!Array.isArray(data.deposits)||!Array.isArray(data.listings)||!Number.isSafeInteger(data.indexedBlock))throw Error('Incomplete market response');
      $('escrowCount').textContent=data.deposits.length;$('listingCount').textContent=data.listings.length;$('indexedBlock').textContent=data.indexedBlock.toLocaleString();
      $('escrowStatus').textContent='Read-only snapshot of '+String(data.marketAddress||'market escrow')+' · refreshed '+new Date().toLocaleTimeString();
      var container=$('escrowItems');container.textContent='';
      if(!data.deposits.length)container.append(make('div','escrow-item','No verified TrixMoji deposits returned in this snapshot.'));
      data.deposits.forEach(function(item){container.append(make('div','escrow-item','#'+String(item.tokenNo)+' · '+String(item.id)+' · DEPOSITOR '+String(item.seller)+' · '+(item.cooldown?'COOLDOWN '+item.cooldown+' BLOCKS':'COOLDOWN COMPLETE')));});
    }catch(error){$('escrowStatus').textContent='Escrow snapshot unavailable. Retry before relying on inventory.';$('escrowCount').textContent='—';$('listingCount').textContent='—';$('indexedBlock').textContent='—';$('escrowItems').textContent='';}
    finally{$('refreshEscrow').disabled=false;}
  }
  $('refreshEscrow').addEventListener('click',escrow);
  $('bestCount').addEventListener('input',function(){if(config)render();});
  $('autoRank').addEventListener('click',function(){if(!config)return;config.order=window.TrixInventory.auto(items).map(function(item){return item.id;});config.mode='auto';$('saveStatus').textContent='Metadata order calculated. Save to apply it to the demo.';render();});
  $('saveOrder').addEventListener('click',function(){if(!config)return;var n=count();if(n===null){$('saveStatus').textContent='Choose a best-pool size between 1 and '+(items.length-1)+'.';return;}config.bestCount=n;try{window.TrixInventory.save(config);$('saveStatus').textContent='Saved in this browser. The next playtest round uses this '+config.mode+' order.';}catch(_){$('saveStatus').textContent='Could not save: browser storage is unavailable.';}});
  window.TrixInventory.load().then(function(loaded){items=loaded;config=window.TrixInventory.read(items);$('bestCount').max=items.length-1;$('bestCount').value=config.bestCount;render();}).catch(function(error){$('inventoryCount').textContent='UNAVAILABLE';$('saveStatus').textContent=error.message;});
  escrow();
  setInterval(function(){if(!document.hidden&&!$('refreshEscrow').disabled)escrow();},120000);
}());
