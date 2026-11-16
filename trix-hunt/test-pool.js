(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TrixTestPool=factory();}(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 var best=[3100,2890,5822,3443,6089,635,5905,7804,7523];
 var seed=[372,2386,2491,2711,5314],excluded=new Set(best.concat(seed));
 var normal=seed.concat(Array.from({length:5000},function(_,i){return i;}).filter(function(id){return !excluded.has(id);})).slice(0,4991);
 return {best:best,normal:normal,all:best.concat(normal).sort(function(a,b){return a-b;})};
}));
