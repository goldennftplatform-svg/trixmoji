const SP='/classic/pages/arcade/jimmy-edgar-big-brawl/sprites/';
const IM={
 p:['portrait-00.png','portrait-01.png','portrait-02.png','portrait-03.png','portrait-04.png','portrait-05.png','portrait-06.png','portrait-07.png','portrait-08.png','portrait-09.png','portrait-10.png','portrait-11.png','portrait-12.png'].map(n=>SP+n),
 t:['card-00.png','card-01.png','card-02.png','card-03.png','card-04.png','card-05.png','card-06.png','card-07.png','card-08.png','card-09.png','card-10.png','card-11.png','card-12.png'].map(n=>SP+n),
 j:SP+'jimmy.png'
};
const cv=document.getElementById('c'),mg=cv.getContext('2d'),W=800,H=450,PF='"Press Start 2P",monospace';
const off=document.createElement('canvas');off.width=400;off.height=225;const wg=off.getContext('2d');let g=mg;
const ld=s=>{const i=new Image();i.src=s;return i},di=(i,...a)=>{if(i.complete&&i.naturalWidth)mg.drawImage(i,...a)},PI=IM.p.map(ld),TI=IM.t.map(ld),JI=ld(IM.j);
const keys={};
const E=[
['Rachel','#c98b66','#6b3420','long','#151515','#c0202a','#d63030',1,1,''],
['Liz','#f3c9a5','#f1d27a','long','#2a52c8','#2a52c8','#d2542c',1,1,''],
['Tina','#b57a55','#2a1a14','long','#8b3fb5','#8b3fb5','#1a1a1a',.95,.97,''],
['Sara','#f0bf9a','#ff7ab8','spike','#222','#1a2a5a','#5aa0e0',.95,.97,''],
['Val','#7a4a2c','#1a0f0a','afro','#e0b020','#e0b020','#3a2a08',1,1.03,''],
['Kat','#f0bf9a','#d8402a','long','#2f8f3f','#2f8f3f','#d63030',1,1.02,'cap'],
['Aliana','#5fdc4a','#2b6b2a','short','#1a4d1a','#1a4d1a','#1a3a1a',1.05,1.05,'ears','Green alien'],
['Vikki','#e8eef5','#f4f6fb','long','#c9d8f0','#dfeaff','#3a5fd0',1,1.1,'ears','Nordic white alien'],
['Mona','#c98b86','#2a1a1a','long','#c85fbf','#c85fbf','#6a2a8a',1.55,1,''],
['Nikki','#a07050','#111','short','#111','#111','#d63030',1.1,1.05,'mask'],
['Zoe','#3f8ff0','#2a5fc0','short','#1a3a8a','#1a3a8a','#2a3a8a',1,1.05,'ears','Blue alien'],
['Seraph','#a63228','#111','short','#151515','#c0202a','#d63030',1.05,1.12,'horns','Demon'],
['The Queen','#63c94a','#3a9a2a','none','#e05fbf','#2f8f3f','#8a3ac0',1.35,1.3,'snakes','Final boss']
].map((a,i)=>{const d={t:a[0],sk:a[1],hr:a[2],hs:a[3],tp:a[4],sh:a[5],gl:a[6],sx:a[7],sy:a[8],ex:a[9],tag:a[10]||''};
d.w=Math.round(52*d.sx);d.h=Math.round(128*d.sy);d.hp=45+i*22;d.sp=70+i*9;d.dmg=7+i*1.4;d.wt=Math.max(.16,.5-i*.03);d.cool=Math.max(.45,1-i*.045);d.blk=.1+i*.04;d.cmb=i*.05;return d});
const JC={sk:'#d9a066',hr:'#111',hs:'none',tp:'',sh:'#111',gl:'#f4f4f4',sx:1,sy:1,ex:'',pants:1,tank:1,hg:1};
const diff=i=>i<4?'EASY':i<7?'MEDIUM':i<10?'HARD':i<12?'VERY HARD':'LEGENDARY';
let S='title',lvl=0,p,e,pops=[],shake=0,kt=0,keep=100,T=0,ft=0;
function mk(){p={x:150,y:330,f:1,hp:keep,sta:100,cd:0,pt:0,inv:0,kx:0,wk:0,moving:0};const d=E[lvl];e={d,x:650,y:330,hp:d.hp,sta:100,f:-1,cd:1.2,wind:0,pt:0,kx:0,hit:0,rot:0,wk:0,moving:0};ft=0}
function pop(t,x,y,c){pops.push({t,x,y,c:c||'#ffd23f',l:.7})}
function press(){
 if(S==='title'){lvl=0;keep=100;S='intro'}
 else if(S==='intro'){mk();S='fight'}
 else if(S==='over'){keep=100;S='intro'}
 else if(S==='win'){S='title'}
 else if(S==='fight'&&p.cd<=0){if(p.sta<16)pop('TIRED',p.x,p.y-150,'#5aa0e0');else punch()}
}
function punch(){
 const mx=(keys.ArrowRight||keys.KeyD?1:0)-(keys.ArrowLeft||keys.KeyA?1:0);
 if(!mx&&e&&e.x!==p.x)p.f=e.x>p.x?1:-1;
 p.pt=.18;p.cd=.3;p.sta-=16;
 const d=e.d,dx=(e.x-p.x)*p.f,dy=e.y-p.y;
 if(dx>-10&&dx<d.w/2+52&&Math.abs(dy)<32){
  const bk=Math.random()<d.blk;e.hp-=(8+(Math.random()*4|0))*(bk?.25:1);e.hit=Math.max(.08,.25-lvl*.012);e.kx=p.f*(bk?60:160)*Math.sqrt(60/d.w)*(1-lvl*.04);shake=bk?2:4;
  if(lvl<4&&!bk)e.wind=0;
  pop(bk?'BLOCK':['POW!','WHAM!','BAM!'][Math.random()*3|0],e.x,e.y-d.h-10,bk?'#5aa0e0':'#ffd23f');
  if(e.hp<=0){S='ko';kt=1.5;e.kx=p.f*520;keep=Math.min(100,p.hp+20);pop('K.O.!',W/2,190,'#ff4f8b')}
 }
}
addEventListener('keydown',ev=>{
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(ev.code))ev.preventDefault();
 keys[ev.code]=true;
 if(!ev.repeat&&(ev.code==='Space'||ev.code==='Enter'))press();
});
addEventListener('keyup',ev=>keys[ev.code]=false);
cv.addEventListener('pointerdown',press);
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
function update(dt){
 T+=dt;shake=Math.max(0,shake-dt*30);
 pops.forEach(o=>{o.l-=dt;o.y-=30*dt});pops=pops.filter(o=>o.l>0);
 if(S==='ko'){e.x+=e.kx*dt;e.kx*=Math.pow(.1,dt);e.rot+=dt*14;kt-=dt;if(kt<=0){lvl++;S=lvl>=E.length?'win':'intro'}return}
 if(S!=='fight')return;
 ft+=dt;p.cd-=dt;p.pt-=dt;p.inv-=dt;e.pt-=dt;p.sta=Math.min(100,p.sta+26*dt);e.sta=Math.min(100,e.sta+(24+lvl*4)*dt);
 const mx=(keys.ArrowRight||keys.KeyD?1:0)-(keys.ArrowLeft||keys.KeyA?1:0),my=(keys.ArrowDown||keys.KeyS?1:0)-(keys.ArrowUp||keys.KeyW?1:0);
 if(mx)p.f=mx;
 else if(e.x!==p.x)p.f=e.x>p.x?1:-1;
 const l=Math.hypot(mx,my)||1;p.x+=mx/l*210*dt+p.kx*dt;p.y+=my/l*160*dt;p.kx*=Math.pow(.02,dt);
 p.moving=mx||my;p.wk+=p.moving?dt*12:0;
 p.x=cl(p.x,40,W-40);p.y=cl(p.y,240,425);
 const d=e.d,dx=p.x-e.x,dy=p.y-e.y,reach=d.w/2+40;
 e.f=dx<0?-1:1;e.hit-=dt;e.moving=0;
 if(e.wind>0){
  e.wind-=dt;
  if(e.wind<=0){
   e.pt=.18;
   if(Math.abs(dx)<reach+14+lvl*2&&Math.abs(dy)<34+lvl&&p.inv<=0){p.hp-=d.dmg;p.kx=e.f*260;p.inv=.4;shake=9;pop('OOF!',p.x,p.y-150,'#ff4f8b');
    if(p.hp<=0){p.hp=0;S='over'}}
   e.cd=Math.random()<d.cmb?.22:d.cool;
  }
 }else if(e.hit<=0){
  const st=d.sp*dt;
  if(Math.abs(dx)>reach*.8){e.x+=Math.sign(dx)*st;e.moving=1}
  if(Math.abs(dy)>10){e.y+=Math.sign(dy)*Math.min(st*.8,Math.abs(dy));e.moving=1}
  e.wk+=e.moving?dt*10:0;e.cd-=dt;
  if(e.cd<=0&&e.sta>=25&&Math.abs(dx)<reach+10&&Math.abs(dy)<26){e.wind=d.wt;e.sta-=25}
 }
 e.x=cl(e.x+e.kx*dt,40,W-40);e.kx*=Math.pow(.02,dt);e.y=cl(e.y,240,425);
}
function R(x,y,w,h,c){g.fillStyle=c;g.fillRect(x,y,w,h)}
function C(x,y,r,c){g.fillStyle=c;g.beginPath();g.arc(x,y,r,0,7);g.fill()}
function Tri(a,b,c2,d,e2,f,col){g.fillStyle=col;g.beginPath();g.moveTo(a,b);g.lineTo(c2,d);g.lineTo(e2,f);g.fill()}
function boxer(o,c){
 const b=Math.sin(o.wk)*3,hx=2,hy=-118;
 g.save();g.translate(o.x,o.y);
 if(o.rot){g.translate(0,-c.h/2);g.rotate(o.rot);g.translate(0,c.h/2)}
 g.scale(o.f*c.sx,c.sy);
 R(-26,-3,52,6,'rgba(0,0,0,.35)');
 [-15+b,3-b].forEach(x=>{R(x,-58,13,58,c.pants?c.sh:c.sk);if(!c.pants)R(x-1,-58,15,26,c.sh);R(x-1,-7,16,7,c.pants?'#e8e8e8':'#222')});
 if(c.tank){R(-19,-104,36,50,'#f2f2f2');R(-19,-58,36,6,'#111');R(-6,-58,12,6,'#ddd')}
 else{R(-18,-102,34,24,c.tp);R(-16,-78,30,20,c.sk);R(-18,-62,34,6,c.sh)}
 R(-3,-108,10,7,c.sk);
 if(c.hs==='afro')C(-2,-124,22,c.hr);
 if(c.hs==='long')R(-19,-130,20,52,c.hr);
 if(c.ex==='snakes'){g.strokeStyle=c.hr;g.lineWidth=5;for(let i=0;i<7;i++){g.beginPath();g.moveTo(hx-10+i*4,hy-10);g.quadraticCurveTo(hx-22+i*8,hy-38+Math.sin(T*4+i)*5,hx-26+i*9,hy-16+Math.sin(T*3+i)*6);g.stroke()}}
 if(c.ex==='ears')Tri(-9,-124,-24,-134,-9,-114,c.sk);
 C(hx,hy,14,c.sk);
 if(c.hs!=='none'&&c.hs!=='afro'&&!c.hg){g.fillStyle=c.hr;g.beginPath();g.arc(hx,hy-1,15,Math.PI,6.2);g.fill()}
 if(c.hs==='spike'){[-8,0,8].forEach(x=>Tri(hx+x-4,hy-12,hx+x,hy-26,hx+x+4,hy-12,c.hr))}
 if(c.ex==='mask'){C(hx,hy,14.5,'#c02020');R(2,-130,12,4,'#111');R(-8,-116,10,8,'#111')}
 if(c.ex==='horns'){Tri(-6,-128,-12,-148,2,-130,'#d6d0c0');Tri(8,-129,14,-148,-1,-131,'#d6d0c0')}
 if(c.ex==='cap'){R(-13,-134,30,8,'#111');R(12,-129,10,4,'#111')}
 if(c.hg){R(-13,-134,28,13,'#111');R(-13,-124,8,20,'#111');R(6,-132,10,4,'#eee');R(-4,-128,6,3,'#444')}
 if(c.hg)R(2,-111,13,8,'#2a1a14');
 R(9,-121,5,4,'#fff');R(11,-120,2,3,'#111');R(6,-125,9,2,'#111');R(9,-109,6,2,'#7a2a2a');
 g.strokeStyle=c.sk;g.lineWidth=8;g.beginPath();g.moveTo(-6,-96);g.lineTo(14,-104);g.stroke();C(16,-106,9,c.gl);
 const [gx,gy]=o.pt>0?[50,-98]:o.wind>0?[-6,-92]:[26,-98];
 g.beginPath();g.moveTo(8,-96);g.lineTo(gx,gy);g.stroke();C(gx,gy,o.pt>0?12:10,c.gl);
 if(o.wind>0){R(-2,-c.h-16,5,12,'#ff4f8b');R(-2,-c.h+1,5,5,'#ff4f8b')}
 g.restore();
}
function bg(){
 R(0,0,W,H,'#1f4a34');
 for(let i=0;i<9;i++){R(i*100,120,3,100,'#173a28');R(20+i*100,20,72,80,'#7fa6c8');R(20+i*100,20,72,3,'#0f2a1c');for(let k=0;k<4;k++)R(26+i*100+k*18,50+(k*7)%18,12,50-(k*7)%18,'#5b7f9c')}
 R(0,100,W,6,'#173a28');R(0,120,W,6,'#173a28');
 R(636,0,3,60,'#333');R(618,60,38,74,'#111');R(618,60,38,6,'#333');
 R(0,235,W,H,'#1d3f8f');R(0,235,W,5,'#0f2560');for(let i=0;i<6;i++)R(0,260+i*36,W,2,'rgba(255,255,255,.07)');
 [[190,'#d33'],[212,'#eee'],[234,'#3a5fd0']].forEach(a=>R(0,a[0],W,5,a[1]));
 R(12,170,10,80,'#888');R(778,170,10,80,'#888');
}
function pnl(x,y,w,h){mg.fillStyle='#0a1430';mg.fillRect(x,y,w,h);mg.strokeStyle='#3a8fe8';mg.lineWidth=2;mg.strokeRect(x+1,y+1,w-2,h-2)}
function bar(x,y,w,h,v,c,r){mg.fillStyle='#111a33';mg.fillRect(x,y,w,h);mg.fillStyle=c;const ww=w*cl(v,0,1);mg.fillRect(r?x+w-ww:x,y,ww,h);mg.strokeStyle='#8fb8f0';mg.lineWidth=1;mg.strokeRect(x+.5,y+.5,w-1,h-1)}
function txt(s,x,y,sz,c,al){mg.font=sz+'px '+PF;mg.textAlign=al||'center';mg.lineWidth=sz/4;mg.strokeStyle='#050a1a';mg.lineJoin='round';mg.strokeText(s,x,y);mg.fillStyle=c||'#fff';mg.fillText(s,x,y)}
function hud(){
 const d=e.d;
 pnl(6,6,330,62);di(JI,14,12,50,50);txt('JIMMY EDGAR',72,26,10,'#fff','left');bar(72,32,252,12,p.hp/100,'#4cd137');bar(72,48,252,10,p.sta/100,'#2a8fe8');
 pnl(464,6,330,62);di(PI[lvl],736,12,50,50);txt(d.t.toUpperCase(),728,26,10,'#fff','right');bar(476,32,252,12,e.hp/d.hp,'#4cd137',1);bar(476,48,252,10,e.sta/100,'#2a8fe8',1);
 pnl(342,6,116,62);txt('ROUND '+(lvl+1),400,28,10,'#ffd23f');const s=Math.floor(ft);txt(Math.floor(s/60)+':'+String(s%60).padStart(2,'0'),400,55,18,'#fff');
}
function draw(){
 g=wg;wg.setTransform(.5,0,0,.5,0,0);if(shake>0)wg.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
 bg();
 if(e&&S!=='title'&&S!=='intro'&&S!=='win')[[p.y,()=>boxer(p,{...JC,h:128})],[e.y,()=>boxer(e,e.d)]].sort((m,n)=>m[0]-n[0]).forEach(o=>o[1]());
 g=mg;mg.imageSmoothingEnabled=false;mg.drawImage(off,0,0,W,H);
 if(S==='fight'||S==='ko'||S==='over')hud();
 pops.forEach(o=>txt(o.t,o.x,o.y,o.t==='K.O.!'?48:18,o.c));
 if(S==='fight'||S==='ko')return;
 mg.fillStyle='rgba(6,11,28,.9)';mg.fillRect(0,0,W,H);
 if(S==='title'){di(JI,40,90,300,330);txt("JIMMY EDGAR'S",570,120,20,'#ffd23f');txt('BIG',570,190,50,'#ff4f8b');txt('BRAWL',570,250,50,'#ff4f8b');txt('13 women. One ring.',570,300,12);txt('"It ain\'t just a fight...',570,340,9,'#8fb8f0');txt("it's personal.\"",570,358,9,'#8fb8f0');txt('Press Space',570,410,16,'#4cd137')}
 if(S==='intro'){const d=E[lvl];txt('ROUND '+(lvl+1)+' OF 13',W/2,44,16,'#ffd23f');di(TI[lvl],220,64,360,290);mg.strokeStyle='#3a8fe8';mg.lineWidth=3;mg.strokeRect(220,64,360,290);txt('JIMMY EDGAR vs '+d.t.toUpperCase(),W/2,384,14,'#fff');txt((d.tag?d.tag+'. ':'')+diff(lvl),W/2,408,10,'#ff4f8b');txt('Press Space to fight',W/2,436,12,'#4cd137')}
 if(S==='over'){txt('YOU GOT FLATTENED',W/2,200,28,'#ff4f8b');txt('Press Space to rematch '+E[lvl].t,W/2,260,12)}
 if(S==='win'){di(TI[12],270,40,260,210);txt('CHAMPION!',W/2,300,36,'#ffd23f');txt('Jimmy Edgar beat all 13 women.',W/2,350,12);txt('Press Space to play again',W/2,400,12,'#4cd137')}
}
document.querySelectorAll('[data-hold]').forEach(el=>{
 const code=el.getAttribute('data-hold');
 const down=ev=>{ev.preventDefault();keys[code]=true};
 const up=()=>{keys[code]=false};
 el.addEventListener('pointerdown',down);
 el.addEventListener('pointerup',up);
 el.addEventListener('pointercancel',up);
 el.addEventListener('pointerleave',up);
 el.addEventListener('contextmenu',ev=>ev.preventDefault());
});
const punchBtn=document.getElementById('punch');
if(punchBtn)punchBtn.addEventListener('pointerdown',ev=>{ev.preventDefault();press()});
let last=performance.now();
function loop(n){const dt=Math.min(.05,(n-last)/1000);last=n;update(dt);draw();requestAnimationFrame(loop)}
requestAnimationFrame(loop);
