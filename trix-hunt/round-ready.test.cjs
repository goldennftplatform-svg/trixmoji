'use strict'
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')

test('confirmed or resumed play waits for START ROUND before creating a target',async()=>{
 const elements=new Map(),events={},storage=new Map();let targetStarts=0,sessionStarts=0,payments=0
 function element(id){if(!elements.has(id)){const handlers={},children={};elements.set(id,{id,handlers,hidden:false,disabled:false,value:'',textContent:'',innerHTML:'',dataset:{},classList:{toggle(){}},addEventListener(type,fn){handlers[type]=fn},click(){if(!this.disabled&&handlers.click)return handlers.click.call(this,{})},setAttribute(){},appendChild(){},focus(){},scrollIntoView(){},querySelector(s){return children[s]||(children[s]={innerHTML:'',textContent:''})},querySelectorAll(){return []},getContext(){return {}},getBoundingClientRect(){return {left:0,top:0,width:960,height:600}}})}return elements.get(id)}
 const session={id:'round-1',state:{status:'active',shotsTaken:0,shotsRemaining:10,results:[]}}
 const window={TrixHuntEngine:{},TrixInventory:{async load(){return [{id:'1',rank:1},{id:'2',rank:2}]}},TrixPlayerIdentity:{async resolve(){return {playerId:'player',nickname:'Tester'}}},TrixBetaPay:{async prepare(){payments++;return {wallet:'0x1111111111111111111111111111111111111111'}},markPlaying(){},savedPack(){return 'bullet'}},TrixHuntBeta:{async start(){sessionStarts++;return session},async leaderboard(){return []}},addEventListener(type,fn){events[type]=fn}}
 const document={getElementById:element,querySelectorAll(){return []},querySelector(){return null},createElement(){return element('created')}}
 const context=vm.createContext({window,document,location:{hostname:'public.example'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:{randomUUID:()=> 'player'},performance:{now(){targetStarts++;return 0}},requestAnimationFrame(){},setTimeout,clearTimeout,Image:function(){},console})
 vm.runInContext(fs.readFileSync(path.join(__dirname,'game.js'),'utf8'),context)
 await new Promise(resolve=>setImmediate(resolve));assert.equal(element('start').disabled,false)
 await element('start').click();assert.equal(payments,1);assert.equal(sessionStarts,1);assert.equal(targetStarts,0);assert.equal(element('start').hidden,false);assert.match(element('start').innerHTML,/START ROUND/);assert.equal(element('welcome').hidden,false)
 events['trix-sepolia-resume']();assert.equal(targetStarts,0)
 await element('start').click();assert.equal(targetStarts,1);assert.equal(element('start').hidden,true);assert.equal(element('welcome').hidden,true);assert.equal(sessionStarts,1)
})
