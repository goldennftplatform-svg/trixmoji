(function(root){
 'use strict';
 async function call(body){var response=await fetch('/.netlify/functions/trix-hunt-beta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)}),data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'Online playtest unavailable');return data;}
 async function start(pack,nickname,playerId,payment){
  var created=await call({action:'start',pack:pack,nickname:nickname,playerId:playerId,payment:payment}),state=created.state,pending=null;
  function update(data){state=data.state;return data.receipt;}
  return {id:created.id,get state(){return state;},get pending(){return !!pending;},
   async shoot(hit){if(pending)throw Error('Previous shot needs checking');pending={action:'shot',id:created.id,token:created.token,requestId:crypto.randomUUID(),hit:hit};try{var receipt=update(await call(pending));pending=null;return receipt;}catch(e){throw e;}},
   async retry(){if(!pending)throw Error('No shot to check');var receipt=update(await call(pending));pending=null;return receipt;},
   async cancel(){if(pending)throw Error('Check the previous shot first');update(await call({action:'finish',id:created.id,token:created.token}));}
  };
 }
 async function leaderboard(){return (await call({action:'leaderboard'})).players;}
 root.TrixHuntBeta={start:start,leaderboard:leaderboard};
}(window));
