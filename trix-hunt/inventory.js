(function (root) {
  'use strict';
  var KEY='trix-hunt-demo-inventory-v1';
  var ids=[3100,2890,5822,3443,6089,635,5905,7804,7523,372,2386,2491,2711,5314,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29];
  var base='/assets/ethscriptions/trixmoji-launch/';
  async function load() {
    async function fetchItem(id){
      var response=await fetch(base+id+'.json');if(!response.ok)throw Error('Metadata unavailable for #'+id);
      var data=await response.json(),tokens=(data.properties&&data.properties.tokens||[]).filter(function(t){return Number.isInteger(t.rank)&&t.rank>0;});
      tokens.sort(function(a,b){return a.rank-b.rank || (b.pixels||0)-(a.pixels||0);});
      if(!tokens.length)throw Error('Missing token metadata for #'+id);
      return {id:id,rank:tokens[0].rank,metadataRank:tokens[0].rank,symbol:tokens[0].symbol,pixels:tokens[0].pixels||0,tiles:tokens.map(function(t){return {rank:t.rank,symbol:t.symbol,pixels:t.pixels};})};
    }
    var result=[];for(var i=0;i<ids.length;i+=6)result.push.apply(result,await Promise.all(ids.slice(i,i+6).map(fetchItem)));return result;
  }
  function auto(items){return items.slice().sort(function(a,b){return a.metadataRank-b.metadataRank||b.pixels-a.pixels||a.id-b.id;});}
  function read(items){
    var config;try{config=JSON.parse(localStorage.getItem(KEY)||'null');}catch(_){config=null;}
    var fallback={mode:'auto',order:auto(items).map(function(x){return x.id;}),bestCount:Math.min(9,Math.max(1,items.length-1))};
    if(!config||!['auto','manual'].includes(config.mode)||!Array.isArray(config.order)||config.order.length!==items.length||!Number.isInteger(config.bestCount)||config.bestCount<1||config.bestCount>=items.length)return fallback;
    var allowed=new Set(items.map(function(x){return x.id;}));
    if(new Set(config.order).size!==items.length||config.order.some(function(id){return !allowed.has(id);}))return fallback;
    if(config.mode==='auto')config.order=fallback.order;
    return config;
  }
  function apply(items,config){
    var byId=new Map(items.map(function(item){return [item.id,item];}));
    return config.order.map(function(id,index){var item=byId.get(id);return Object.assign({},item,{rank:index<config.bestCount?1:Math.max(2,item.metadataRank)});});
  }
  function save(config){localStorage.setItem(KEY,JSON.stringify(config));}
  root.TrixInventory={load:load,auto:auto,read:read,apply:apply,save:save};
}(window));
