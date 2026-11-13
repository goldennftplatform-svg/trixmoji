(function () {
  'use strict';
  var engine = window.TrixHuntEngine;
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var $ = function (id) { return document.getElementById(id); };
  var artBase = '/assets/ethscriptions/trixmoji-launch/';
  var inventory = [], session = null, pack = 'bullet', target = null, reveal = null, pendingFinish = false, targetsSeen = 0, roundReady = false;
  var aim = { x: 480, y: 240 }, soundOn = false, audio = null, messageTimer = 0;
  var localLeaderboard = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  var targetProgressKey='trix-hunt-target-progress-v1';
  var sessionId = '', playerId = '', activeName = '', roundRecorded = false, economyActive = false, shotPending = false, pendingShot = null, finishPending = false;
  var colors = { sky: '#319fe4', grass: '#06cf4f', soil: '#9d5435', lime: '#d0ff00' };
  var difficulty = { bullet: { size: 84, speed: 536.25, seconds: 3 }, shotgun: { size: 69, speed: 653.25, seconds: 2.3 }, sniper: { size: 53, speed: 540, seconds: 1.6 } };

  function imageUrl(id) { return artBase + encodeURIComponent(id) + '.webp'; }
  function money(cents) { return '$' + (cents / 100).toFixed(2); }
  function testEth(wei){var s=String(wei).padStart(19,'0'),fraction=s.slice(-18).replace(/0+$/,'');return s.slice(0,-18)+(fraction?'.'+fraction:'');}
  async function testRoundStart(id,selectedPack){
    if(!localLeaderboard)return false;
    try{var response=await fetch('/test-round/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:id,pack:selectedPack}),signal:AbortSignal.timeout(12000)});var data=await response.json();if(!response.ok||!data.ok)throw Error('unavailable');$('testEconomyStatus').hidden=false;$('testEconomyStatus').textContent='Simulated pack: '+testEth(data.round.priceWei)+' test ETH. No payment sent.';return true;}
    catch(_){$('testEconomyStatus').hidden=false;$('testEconomyStatus').textContent='Test ETH accounting unavailable; this round uses play money only.';return false;}
  }
  async function testRoundFinish(id,s){
    if(!economyActive)return;
    try{var response=await fetch('/test-round/finish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:id,shots:s.shotsTaken,hits:s.results.length})});var data=await response.json();if(!response.ok||!data.ok)throw Error('unavailable');$('testEconomyStatus').textContent='Simulated refund: '+testEth(data.round.refundWei)+' test ETH · '+s.results.length+' demo prizes. No ETH or assets moved.';}
    catch(_){$('testEconomyStatus').textContent='Test ETH round could not be recorded. No ETH or assets moved.';}
  }
  function leaderboardNotice(message) {
    var list=$('leaderboard');list.textContent='';var p=document.createElement('p');p.className='disclaimer';p.textContent=message;list.appendChild(p);
  }
  async function refreshLeaderboard() {
    try {
      var players;if(localLeaderboard){var response=await fetch('/leaderboard',{cache:'no-store'});if(!response.ok)throw new Error('unavailable');players=(await response.json()).players;}else players=await window.TrixHuntBeta.leaderboard();
      var list=$('leaderboard');list.textContent='';
      if(!Array.isArray(players)||!players.length){leaderboardNotice('No scores yet. Play a round to set the pace.');return;}
      players.slice(0,10).forEach(function(player){
        var row=document.createElement('div');row.className='leader-row';
        var rank=document.createElement('b'),name=document.createElement('span'),hits=document.createElement('span'),accuracy=document.createElement('span');
        rank.textContent=String(player.rank).padStart(2,'0');name.className='leader-name';name.textContent=player.nickname;
        hits.textContent=player.hits+' HITS';accuracy.textContent=Math.round(player.accuracy*100)+'%';row.append(rank,name,hits,accuracy);list.append(row);
      });
    } catch (_) { leaderboardNotice(localLeaderboard?'Start the local playtest server to save and view scores.':'Online playtest leaderboard is temporarily unavailable.'); }
  }
  async function recordRound(state) {
    if(roundRecorded||!localLeaderboard)return;
    roundRecorded=true;
    try {
      var response=await fetch('/round',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:sessionId,playerId:playerId,nickname:activeName,shots:state.shotsTaken,hits:state.results.length})});
      if(!response.ok)throw new Error('unavailable');await refreshLeaderboard();
    } catch (_) {leaderboardNotice('Round could not be saved. Start the local playtest server and try again.');}
  }
  function announce(value, duration) {
    $('message').textContent = value;
    clearTimeout(messageTimer);
    if (duration) messageTimer = setTimeout(function () { $('message').textContent = ''; }, duration);
  }
  async function loadInventory() {
    var loaded = await window.TrixInventory.load();
    if (!loaded.some(function (a) { return a.rank === 1; }) || !loaded.some(function (a) { return a.rank !== 1; })) throw new Error('Demo tiers unavailable');
    inventory = loaded;
    $('start').disabled = false; $('start').innerHTML = 'START PLAYTEST <span>↗</span>';
  }
  function initAudio() {
    if (!soundOn) return;
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audio) audio = new AudioContext();
    if (audio.state === 'suspended') audio.resume();
  }
  function beep(type) {
    if (!soundOn) return;
    initAudio(); if (!audio) return;
    var t = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = type === 'shot' ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(type === 'shot' ? 220 : type === 'hit' ? 610 : 190, t);
    osc.frequency.exponentialRampToValueAtTime(type === 'shot' ? 55 : type === 'hit' ? 1050 : 95, t + .12);
    gain.gain.setValueAtTime(.055, t); gain.gain.exponentialRampToValueAtTime(.0001, t + .16);
    osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + .17);
  }
  function rounded(x, y, w, h, r, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  }
  function ellipse(x, y, rx, ry, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }
  function scene(t) {
    var w = canvas.width, h = canvas.height;
    ctx.fillStyle = colors.sky; ctx.fillRect(0, 0, w, h);
    // Original arcade scenery, inspired by the local Trix Hunt film.
    ctx.fillStyle = '#793c49'; ctx.beginPath(); ctx.moveTo(115,420); ctx.lineTo(125,230); ctx.lineTo(95,165); ctx.lineTo(111,160); ctx.lineTo(139,228); ctx.lineTo(162,179); ctx.lineTo(175,183); ctx.lineTo(146,277); ctx.lineTo(150,420); ctx.fill();
    [[90,145],[156,190],[78,230],[165,270],[110,260]].forEach(function (p) {
      rounded(p[0]-42,p[1]-23,84,48,18,'#00aa45'); rounded(p[0]-33,p[1]-31,68,24,10,'#06d359');
      for (var j=0;j<7;j++) { ctx.fillStyle='#009f41'; ctx.fillRect(p[0]-31+(j*19)%65,p[1]-20+(j*11)%35,5,5); }
    });
    ctx.fillStyle = colors.grass; ctx.fillRect(0, 414, w, 83);
    ellipse(830,412,46,47,'#00ad48'); ellipse(824,403,28,37,'#08d455');
    for (var i=0;i<100;i++) {
      var x=(i*107)%w, y=421+(i*29)%70;
      ctx.strokeStyle=i%5?'#00a948':'#e8f0cc';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y+8);ctx.lineTo(x-4,y-7-(i%3)*3);ctx.stroke();
    }
    ctx.fillStyle=colors.soil;ctx.fillRect(0,497,w,103);ctx.fillStyle='#503325';ctx.fillRect(0,495,w,5);
    for (var n=0;n<38;n++) {ctx.fillStyle='#513127';ctx.fillRect((n*173)%w,510+(n*31)%80,6,4);}
    drawDog(t); drawFrog(t);
  }
  function drawDog(t) {
    var active = !!session && session.state.status === 'active', bob = active ? Math.sin(t/180)*3 : 0;
    var x=238,y=429+bob;
    ellipse(x,y,47,27,'#603d27');ellipse(x,y-4,41,24,'#d49a42');
    ctx.fillStyle='#a8712f';ctx.beginPath();ctx.moveTo(x-4,y-21);ctx.lineTo(x+1,y-63);ctx.lineTo(x+20,y-44);ctx.lineTo(x+31,y-60);ctx.lineTo(x+41,y-20);ctx.fill();
    ellipse(x+19,y-27,31,27,'#e4b35d');ellipse(x+37,y-14,23,13,'#f0d198');ellipse(x+52,y-19,8,6,'#241c19');
    rounded(x-1,y-38,23,14,4,'#171720');rounded(x+23,y-38,23,14,4,'#171720');ctx.fillStyle='#a968df';ctx.fillRect(x+4,y-34,13,3);ctx.fillStyle='#6ae9dd';ctx.fillRect(x+27,y-34,12,3);
    ctx.strokeStyle='#b77b36';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(x-36,y-7);ctx.lineTo(x-55,y-24+Math.sin(t/120)*6);ctx.stroke();
    if(reveal && reveal.prize) {ctx.fillStyle='#cfff00';ctx.fillRect(x+49,y-11,16,19);ctx.strokeStyle='#1c2618';ctx.lineWidth=2;ctx.strokeRect(x+49,y-11,16,19);}
  }
  function drawFrog(t) {
    var x=793,y=421+Math.sin(t/270)*3;
    ellipse(x,y+22,50,38,'#983461');ellipse(x,y+17,43,33,'#d64d99');
    ellipse(x,y-24,52,41,'#812a60');ellipse(x,y-28,47,37,'#e663a8');
    ellipse(x-22,y-53,20,19,'#ed83b7');ellipse(x+22,y-53,20,19,'#ed83b7');
    ellipse(x-21,y-47,17,12,'#f6ede2');ellipse(x+21,y-47,17,12,'#f6ede2');
    var look=Math.max(-5,Math.min(5,(aim.x-x)/80));ellipse(x-19+look,y-47,6,7,'#332733');ellipse(x+23+look,y-47,6,7,'#332733');
    ctx.strokeStyle='#a14379';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x-39,y-54);ctx.lineTo(x-4,y-57);ctx.moveTo(x+4,y-57);ctx.lineTo(x+39,y-54);ctx.stroke();
    ctx.strokeStyle='#a45b2e';ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(x+1,y-19,28,9,0,0,Math.PI);ctx.stroke();
    var angle=Math.atan2(aim.y-(y+2),aim.x-x), bx=x+Math.cos(angle)*64,by=y+Math.sin(angle)*64;
    ctx.strokeStyle='#833461';ctx.lineWidth=17;ctx.beginPath();ctx.moveTo(x,y+22);ctx.lineTo(x+Math.cos(angle)*35,y+Math.sin(angle)*35);ctx.stroke();
    ctx.strokeStyle='#27363a';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(x+Math.cos(angle)*23,y+Math.sin(angle)*23);ctx.lineTo(bx,by);ctx.stroke();
  }
  function makeTarget() {
    var n = targetsSeen;
    var settings = difficulty[pack];
    target = { born: performance.now(), seed: Math.random()*10, direction: n%2 ? -1 : 1, x: n%2 ? 720 : 210, y: 190, baseSize: settings.size, size: settings.size };
    if (soundOn) beep('dog');
  }
  function targetPosition(now) {
    var elapsed=(now-target.born)/1000, speed=difficulty[pack].speed;
    var track=(elapsed*speed) % 1200, travel=track<600?track:1200-track;
    target.x=target.direction===1?170+travel:790-travel;
    target.y=155+65*Math.sin(elapsed*2.15+target.seed)+35*Math.sin(elapsed*.9+target.seed);
    target.size=target.baseSize*(1-.32*Math.min(elapsed/difficulty[pack].seconds,1));
    return target;
  }
  function rememberTargets(){if(!localLeaderboard)try{localStorage.setItem(targetProgressKey,JSON.stringify({id:session.id,count:targetsSeen}));}catch(_){}}
  async function nextTargetOrFinish() {
    if (!session || shotPending) return;
    hud();
    if (targetsSeen>=10 || session.state.status!=='active') {
      if (session.state.status==='active') {
        shotPending=true;$('cancel').disabled=true;
        try{await session.cancel();finishPending=false;$('retryShot').hidden=true;}
        catch(_){finishPending=true;$('retryShot').textContent='RETRY FINISHING ROUND';$('retryShot').hidden=false;announce('CONNECTION LOST · RETRY FINISH',0);return;}
        finally{shotPending=false;$('cancel').disabled=false;}
      }
      hud();finishRound();
    } else makeTarget();
  }
  function render(now) {
    ctx.clearRect(0,0,960,600);scene(now);
    if (session && session.state.status === 'active' && target && !reveal) {
      var elapsed=(now-target.born)/1000;
      if(elapsed>=difficulty[pack].seconds){target=null;targetsSeen++;rememberTargets();announce('GOT AWAY!',650);nextTargetOrFinish();}
      else {var p=targetPosition(now);rounded(p.x-p.size/2,p.y-p.size/2,p.size,p.size,6,'#213331');rounded(p.x-p.size/2+5,p.y-p.size/2+5,p.size-10,p.size-10,3,'#f6f4df');}
    }
    if (reveal) {
      var age=now-reveal.time, alpha=Math.max(0,1-age/1400), s=106, rx=reveal.x-s/2, ry=reveal.y-s/2+Math.min(110,age*.09);
      ctx.globalAlpha=alpha;rounded(rx-5,ry-5,s+10,s+10,6,'#f5f3da');
      if (reveal.image.complete && reveal.image.naturalWidth) ctx.drawImage(reveal.image,rx,ry,s,s);
      ctx.globalAlpha=1;
      if (age>1400) {reveal=null;if(pendingFinish){pendingFinish=false;nextTargetOrFinish();}else if(session && session.state.status==='active')nextTargetOrFinish();}
    }
    if (session && session.state.status==='active') {
      ctx.strokeStyle='#142826';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(aim.x-16,aim.y);ctx.lineTo(aim.x-6,aim.y);ctx.moveTo(aim.x+6,aim.y);ctx.lineTo(aim.x+16,aim.y);ctx.moveTo(aim.x,aim.y-16);ctx.lineTo(aim.x,aim.y-6);ctx.moveTo(aim.x,aim.y+6);ctx.lineTo(aim.x,aim.y+16);ctx.stroke();
    }
    requestAnimationFrame(render);
  }
  function hud() {
    var s=session.state;$('ammo').textContent=String(s.shotsRemaining).padStart(2,'0');$('hits').textContent=String(s.results.length).padStart(2,'0');
    $('targetsLeft').textContent=String(Math.max(0,10-targetsSeen)).padStart(2,'0');
    $('currentPack').textContent=({bullet:'BULLET SHOTS',shotgun:'SHOTGUN SLUGS',sniper:'SNIPE SHOTS'})[pack];
  }
  function addPrize(receipt) {
    var container=$('prizes');if(container.querySelector('.empty-prizes'))container.textContent='';
    var item=document.createElement('article');item.className='prize';
    var img=document.createElement('img');img.src=imageUrl(receipt.prize.id);img.alt='TrixMoji #' + receipt.prize.id;img.loading='lazy';
    var info=document.createElement('div'),name=document.createElement('b'),meta=document.createElement('small');
    name.textContent='#'+receipt.prize.id;meta.textContent='$'+receipt.prize.symbol;info.append(name,meta);item.append(img,info);container.prepend(item);
    $('prizeCount').textContent=String(session.state.results.length).padStart(2,'0')+' CAPTURED';
  }
  function setControls(active) {
    document.querySelectorAll('.pack').forEach(function (button) {button.disabled=active;});
    $('nickname').disabled=active;
    $('start').hidden=active;$('cancel').hidden=!active;if(!active){$('retryShot').hidden=true;$('cancel').disabled=false;}
  }
  function finishRound() {
    var s=session.state; target=null;roundReady=false;setControls(false);if(!localLeaderboard)try{localStorage.removeItem(targetProgressKey);}catch(_){}$('cabinetState').textContent='ROUND COMPLETE';
    $('start').innerHTML='PLAY AGAIN <span>↗</span>'; $('welcome').hidden=false;
    $('welcome').querySelector('h2').innerHTML='NICE<br><em>SHOTS.</em>';
    $('welcome').querySelector('p').textContent=localLeaderboard?s.results.length+' CARDS CAPTURED · '+money(s.refundCents)+' DEMO REFUND':s.results.length+' CARDS CAPTURED · REFUND AWAITS SETTLEMENT';
    if(s.reason==='tier_exhausted')announce('TIER EMPTY · '+money(s.refundCents)+' DEMO REFUND',5000);
    recordRound(s);
    testRoundFinish(sessionId,s);
    if(!localLeaderboard){window.TrixBetaPay.armSettlement(s);refreshLeaderboard();}
  }
  function prizeDetails(receipt){if(receipt&&receipt.prize){var item=inventory.find(function(x){return x.id===receipt.prize.id;});receipt.prize=item||{id:receipt.prize.id,symbol:'TRIX'};}return receipt;}
  function handleShot(receipt,hit,pos){
    receipt=prizeDetails(receipt);hud();
    if(receipt.type==='error'){finishRound();return;}
    targetsSeen++;rememberTargets();hud();
    if(hit){beep('hit');addPrize(receipt);var img=new Image();img.src=imageUrl(receipt.prize.id);reveal={time:performance.now(),x:pos.x,y:pos.y,image:img,prize:receipt.prize};announce('#'+receipt.prize.id+' · $'+receipt.prize.symbol,1300);if(session.state.status!=='active'||targetsSeen>=10)pendingFinish=true;}
    else{announce('MISS!',650);nextTargetOrFinish();}
  }
  async function fire(x,y) {
    if(!session || session.state.status!=='active' || !target || reveal || shotPending || pendingShot || finishPending)return;
    if((performance.now()-target.born)/1000>=difficulty[pack].seconds){target=null;targetsSeen++;rememberTargets();announce('GOT AWAY!',650);nextTargetOrFinish();return;}
    aim.x=x;aim.y=y;var pos=targetPosition(performance.now()),half=pos.size/2;
    var hit=Math.abs(x-pos.x)<=half && Math.abs(y-pos.y)<=half;
    target=null;shotPending=true;$('cancel').disabled=true;beep('shot');
    try{var receipt=await session.shoot(hit);shotPending=false;$('cancel').disabled=false;handleShot(receipt,hit,pos);}
    catch(_){shotPending=false;pendingShot={hit:hit,pos:pos};$('retryShot').textContent='RETRY CHECKING LAST SHOT';$('retryShot').hidden=false;announce('CONNECTION LOST · RETRY SHOT',0);}
  }
  function position(event) {var rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};}
  canvas.addEventListener('pointermove',function(event){var p=position(event);aim.x=p.x;aim.y=p.y;});
  canvas.addEventListener('pointerdown',function(event){event.preventDefault();canvas.focus();initAudio();var p=position(event);fire(p.x,p.y);});
  canvas.addEventListener('keydown',function(event){var keys={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]};if(keys[event.key]){event.preventDefault();aim.x=Math.max(0,Math.min(960,aim.x+keys[event.key][0]));aim.y=Math.max(0,Math.min(600,aim.y+keys[event.key][1]));}else if(event.key===' '||event.key==='Enter'){event.preventDefault();fire(aim.x,aim.y);}});
  document.querySelectorAll('.pack').forEach(function(button){button.addEventListener('click',function(){pack=button.dataset.pack;$('walletAmmo').textContent=({bullet:'BULLET SHOTS',shotgun:'SHOTGUN SLUGS',sniper:'SNIPE SHOTS'})[pack];document.querySelectorAll('.pack').forEach(function(b){var selected=b===button;b.classList.toggle('active',selected);b.setAttribute('aria-checked',String(selected));});});});
  $('nickname').addEventListener('input',function(){$('walletPlayer').textContent=this.value.trim()||'Anonymous';});
  $('sound').addEventListener('click',function(){soundOn=!soundOn;this.setAttribute('aria-pressed',String(soundOn));this.setAttribute('aria-label',soundOn?'Turn sound off':'Turn sound on');this.querySelector('span').textContent=soundOn?'SOUND ON':'SOUND OFF';initAudio();if(soundOn)beep('hit');});
  $('start').addEventListener('click',async function(){
    if(roundReady){roundReady=false;$('welcome').hidden=true;$('cabinetState').textContent='ROUND IN PROGRESS';setControls(true);if(targetsSeen>=10){nextTargetOrFinish();return;}makeTarget();initAudio();canvas.focus();return;}
    $('start').disabled=true;
    document.querySelectorAll('.pack').forEach(function(button){button.disabled=true;});$('nickname').disabled=true;
    var enteredName=$('nickname').value;
    try {
      playerId=localStorage.getItem('trix-hunt-local-player')||crypto.randomUUID();
      if(!/^[A-Za-z0-9_-]{1,64}$/.test(playerId))playerId=crypto.randomUUID();
      localStorage.setItem('trix-hunt-local-player',playerId);localStorage.setItem('trix-hunt-local-name',enteredName);
    } catch (_) {playerId=crypto.randomUUID();}
    try{var identity=await window.TrixPlayerIdentity.resolve(enteredName,window.ethereum,playerId);playerId=identity.playerId;activeName=identity.nickname;}
    catch(_){activeName='PLAYER-'+playerId.replace(/[^A-Za-z0-9]/g,'').slice(0,6).toUpperCase();}
    sessionId=crypto.randomUUID();roundRecorded=false;
    try{
      if(localLeaderboard){economyActive=await testRoundStart(sessionId,pack);var config={order:window.TrixInventory.auto(inventory).map(function(item){return item.id;}),bestCount:9};session=engine.createSession({pack:pack,inventory:window.TrixInventory.apply(inventory,config),players:1});}
      else{economyActive=false;var payment=await window.TrixBetaPay.prepare(pack);if(!enteredName.trim())activeName=payment.wallet.slice(0,6)+'...'+payment.wallet.slice(-4);session=await window.TrixHuntBeta.start(pack,activeName,playerId,payment);window.TrixBetaPay.markPlaying();}
    }catch(error){$('start').disabled=false;setControls(false);var detail=error.message||'Sepolia test unavailable. Please try again.';$('testEconomyStatus').hidden=false;$('testEconomyStatus').textContent=detail;if(!localLeaderboard){$('paymentStatus').textContent=detail;$('betaPayment').open=true;$('betaPayment').scrollIntoView({behavior:'smooth',block:'center'});}return;}
    $('start').disabled=false;reveal=null;pendingFinish=false;finishPending=false;shotPending=false;pendingShot=null;targetsSeen=Math.min(10,session.state.shotsTaken);
    if(!localLeaderboard)try{var progress=JSON.parse(localStorage.getItem(targetProgressKey)||'null');if(progress&&progress.id===session.id&&Number.isInteger(progress.count))targetsSeen=Math.min(10,Math.max(targetsSeen,progress.count));rememberTargets();}catch(_){}
    $('prizes').innerHTML='<div class="empty-prizes"><span>✳</span><p>Your catches land here.<br><small>Hit a mystery card to reveal it.</small></p></div>';$('prizeCount').textContent='00 CAPTURED';
    if(session.state.results.length)session.state.results.forEach(function(item){addPrize(prizeDetails({prize:item.prize,player:item.player}));});
    setControls(true);hud();if(session.state.status!=='active'){finishRound();return;}roundReady=true;$('start').hidden=false;$('start').innerHTML='START ROUND <span>↗</span>';$('cabinetState').textContent='READY WHEN YOU ARE';$('welcome').hidden=false;$('welcome').querySelector('h2').innerHTML='READY<br><em>TO PLAY.</em>';$('welcome').querySelector('p').textContent='PRESS START ROUND WHEN YOU ARE READY';$('start').focus({preventScroll:true});
  });
  $('cancel').addEventListener('click',function(){if(!session||session.state.status!=='active'||shotPending||pendingShot)return;if(roundReady){roundReady=false;$('start').hidden=true;}target=null;reveal=null;pendingFinish=false;targetsSeen=10;nextTargetOrFinish();});
  $('retryShot').addEventListener('click',async function(){if(!session||shotPending)return;if(finishPending){finishPending=false;nextTargetOrFinish();return;}if(!pendingShot||typeof session.retry!=='function')return;shotPending=true;$('retryShot').disabled=true;try{var receipt=await session.retry(),saved=pendingShot;pendingShot=null;$('retryShot').hidden=true;$('cancel').disabled=false;shotPending=false;handleShot(receipt,saved.hit,saved.pos);}catch(_){announce('CONNECTION LOST · RETRY SHOT',0);}finally{shotPending=false;$('retryShot').disabled=false;}});
  $('refreshLeaderboard').addEventListener('click',refreshLeaderboard);
  window.addEventListener('trix-sepolia-resume',function(){if(roundReady)return;var saved=window.TrixBetaPay.savedPack();if(!saved)return;var button=document.querySelector('.pack[data-pack="'+saved+'"]');if(button)button.click();$('start').click();});
  requestAnimationFrame(render);
  if(localLeaderboard)$('testAdminLink').hidden=false;
  try {var savedName=localStorage.getItem('trix-hunt-local-name')||'';$('nickname').value=savedName==='PLAYER'?'':savedName;$('walletPlayer').textContent=$('nickname').value.trim()||'Anonymous';}catch(_){}
  refreshLeaderboard();
  loadInventory().catch(function(error){$('start').textContent='COULD NOT LOAD COLLECTION';$('start').disabled=true;announce(error.message,0);});
}());
