(function () {
  'use strict';
  var engine = window.TrixHuntEngine;
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var $ = function (id) { return document.getElementById(id); };
  var ids = [3100,2890,5822,3443,6089,635,5905,7804,7523,372,2386,2491,2711,5314,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29];
  var artBase = '/assets/ethscriptions/trixmoji-launch/';
  var inventory = [], session = null, pack = 'bullet', target = null, reveal = null, pendingFinish = false, targetsSeen = 0;
  var aim = { x: 480, y: 240 }, soundOn = false, audio = null, messageTimer = 0;
  var colors = { sky: '#319fe4', grass: '#06cf4f', soil: '#9d5435', lime: '#d0ff00' };
  var difficulty = { bullet: { size: 104, speed: 275, seconds: 3 }, shotgun: { size: 86, speed: 335, seconds: 2.3 }, sniper: { size: 66, speed: 400, seconds: 1.6 } };

  function imageUrl(id) { return artBase + encodeURIComponent(id) + '.webp'; }
  function money(cents) { return '$' + (cents / 100).toFixed(2); }
  function announce(value, duration) {
    $('message').textContent = value;
    clearTimeout(messageTimer);
    if (duration) messageTimer = setTimeout(function () { $('message').textContent = ''; }, duration);
  }
  async function loadInventory() {
    var loaded = await Promise.all(ids.map(async function (id) {
      var response = await fetch(artBase + id + '.json');
      if (!response.ok) throw new Error('Collection metadata unavailable for #' + id);
      var data = await response.json();
      var tokens = (data.properties && data.properties.tokens || []).filter(function (t) { return Number.isInteger(t.rank) && t.rank > 0; });
      tokens.sort(function (a, b) { return a.rank - b.rank; });
      if (!tokens.length) throw new Error('Missing token metadata for #' + id);
      return { id: id, rank: tokens[0].rank, symbol: tokens[0].symbol, tiles: tokens.map(function (t) { return { rank: t.rank, symbol: t.symbol, pixels: t.pixels }; }) };
    }));
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
  function nextTargetOrFinish() {
    if (!session) return;
    hud();
    if (targetsSeen>=10 || session.state.status!=='active') {
      if (session.state.status==='active') session.cancel();
      hud();finishRound();
    } else makeTarget();
  }
  function render(now) {
    ctx.clearRect(0,0,960,600);scene(now);
    if (session && session.state.status === 'active' && target && !reveal) {
      var elapsed=(now-target.born)/1000;
      if(elapsed>=difficulty[pack].seconds){target=null;targetsSeen++;announce('GOT AWAY!',650);nextTargetOrFinish();}
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
    $('start').hidden=active;$('cancel').hidden=!active;
  }
  function finishRound() {
    var s=session.state; target=null;setControls(false);$('cabinetState').textContent='ROUND COMPLETE';
    $('start').innerHTML='PLAY AGAIN <span>↗</span>'; $('welcome').hidden=false;
    $('welcome').querySelector('h2').innerHTML='NICE<br><em>SHOTS.</em>';
    $('welcome').querySelector('p').textContent=s.results.length+' CARDS CAPTURED · '+money(s.refundCents)+' DEMO REFUND';
    if(s.reason==='tier_exhausted')announce('TIER EMPTY · '+money(s.refundCents)+' DEMO REFUND',5000);
  }
  function fire(x,y) {
    if(!session || session.state.status!=='active' || !target || reveal)return;
    if((performance.now()-target.born)/1000>=difficulty[pack].seconds){target=null;targetsSeen++;announce('GOT AWAY!',650);nextTargetOrFinish();return;}
    aim.x=x;aim.y=y;var pos=targetPosition(performance.now()),half=pos.size/2;
    var hit=Math.abs(x-pos.x)<=half && Math.abs(y-pos.y)<=half;
    var receipt=session.shoot(hit);beep('shot');hud();
    if(receipt.type==='error'){finishRound();return;}
    targetsSeen++;hud();
    if(hit){
      beep('hit');addPrize(receipt);var img=new Image();img.src=imageUrl(receipt.prize.id);
      reveal={time:performance.now(),x:pos.x,y:pos.y,image:img,prize:receipt.prize};target=null;
      announce('#'+receipt.prize.id+' · $'+receipt.prize.symbol,1300);
      if(session.state.status!=='active'||targetsSeen>=10)pendingFinish=true;
    }else{
      announce('MISS!',650);
      nextTargetOrFinish();
    }
  }
  function position(event) {var rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};}
  canvas.addEventListener('pointermove',function(event){var p=position(event);aim.x=p.x;aim.y=p.y;});
  canvas.addEventListener('pointerdown',function(event){event.preventDefault();canvas.focus();initAudio();var p=position(event);fire(p.x,p.y);});
  canvas.addEventListener('keydown',function(event){var keys={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]};if(keys[event.key]){event.preventDefault();aim.x=Math.max(0,Math.min(960,aim.x+keys[event.key][0]));aim.y=Math.max(0,Math.min(600,aim.y+keys[event.key][1]));}else if(event.key===' '||event.key==='Enter'){event.preventDefault();fire(aim.x,aim.y);}});
  document.querySelectorAll('.pack').forEach(function(button){button.addEventListener('click',function(){pack=button.dataset.pack;document.querySelectorAll('.pack').forEach(function(b){var selected=b===button;b.classList.toggle('active',selected);b.setAttribute('aria-checked',String(selected));});});});
  $('sound').addEventListener('click',function(){soundOn=!soundOn;this.setAttribute('aria-pressed',String(soundOn));this.setAttribute('aria-label',soundOn?'Turn sound off':'Turn sound on');this.querySelector('span').textContent=soundOn?'SOUND ON':'SOUND OFF';initAudio();if(soundOn)beep('hit');});
  $('start').addEventListener('click',function(){
    session=engine.createSession({pack:pack,inventory:inventory,players:1});reveal=null;pendingFinish=false;targetsSeen=0;
    $('prizes').innerHTML='<div class="empty-prizes"><span>✳</span><p>Your catches land here.<br><small>Hit a mystery card to reveal it.</small></p></div>';$('prizeCount').textContent='00 CAPTURED';
    $('welcome').hidden=true;$('cabinetState').textContent='ROUND IN PROGRESS';setControls(true);hud();makeTarget();initAudio();canvas.focus();
  });
  $('cancel').addEventListener('click',function(){if(!session||session.state.status!=='active')return;session.cancel();reveal=null;pendingFinish=false;hud();finishRound();});
  requestAnimationFrame(render);
  loadInventory().catch(function(error){$('start').textContent='COULD NOT LOAD COLLECTION';$('start').disabled=true;announce(error.message,0);});
}());
