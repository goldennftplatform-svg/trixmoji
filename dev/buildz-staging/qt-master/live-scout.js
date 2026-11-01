import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bs58 from 'bs58';
import { Connection, Keypair, PublicKey, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.join(ROOT, '.env');
const STATE_FILE = path.join(ROOT, 'swing-state.json');
const TRADE_LOG = path.join(ROOT, 'live-trades.jsonl');

function loadEnv(){
  if(!fs.existsSync(ENV_FILE)) return;
  for(const line of fs.readFileSync(ENV_FILE,'utf8').split(/\r?\n/)){
    const s=line.trim();
    if(!s || s.startsWith('#') || !s.includes('=')) continue;
    const i=s.indexOf('=');
    const k=s.slice(0,i).trim();
    let v=s.slice(i+1).trim();
    if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
    if(k && process.env[k]===undefined) process.env[k]=v;
  }
}
loadEnv();

const bool=(v,d=false)=>v===undefined?d:String(v).toLowerCase()==='true';
const num=(k,d,min=-Infinity,max=Infinity)=>{const n=Number(process.env[k]);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):d};

const liveValue=String(process.env.ENABLE_LIVE ?? '').trim().toLowerCase();
const LIVE=['1','true','yes','on'].includes(liveValue);
if(!LIVE) throw new Error(`LIVE BLOCKED. ENABLE_LIVE is not enabled (received: ${liveValue||'unset'}). Start with .\\start-live.cmd or set ENABLE_LIVE=true in this PowerShell session.`);
if(!process.env.BOT_SECRET_KEY || !process.env.BOT_PUBLIC_ADDRESS) throw new Error('BOT_SECRET_KEY and BOT_PUBLIC_ADDRESS are required locally.');

let wallet;
try{ wallet=Keypair.fromSecretKey(bs58.decode(process.env.BOT_SECRET_KEY.trim())); }
catch{ throw new Error('BOT_SECRET_KEY could not be decoded. Refusing to trade.'); }
if(wallet.publicKey.toBase58()!==process.env.BOT_PUBLIC_ADDRESS.trim()) throw new Error('Wallet key/address mismatch. Refusing to trade.');

const RPC=process.env.RPC_URL||'https://api.mainnet-beta.solana.com';
const JUP=process.env.JUPITER_BASE||'https://lite-api.jup.ag/swap/v1';
const DEX=process.env.DEXSCREENER_BASE||'https://api.dexscreener.com';
const SOL='So11111111111111111111111111111111111111112';
const USDC='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT='Es9vMFrzaCERmJfrF4H2FYD4y3aVhYvGmYkTq7nK1d1';
const conn=new Connection(RPC,'confirmed');

const CFG={
  tradeUsd:num('MAX_TRADE_USD',0.50,0.01,1000),
  reserveSol:num('RESERVE_SOL',0.02,0.005,100),
  maxPositions:num('MAX_OPEN_POSITIONS',5,1,5),
  maxDailyLoss:num('MAX_DAILY_LOSS_USD',2,0.25,10000),
  maxConsecutiveLosses:num('MAX_CONSECUTIVE_LOSSES',3,1,20),
  maxImpact:num('MAX_PRICE_IMPACT_PCT',1.5,0.05,10),
  slippageBps:num('SLIPPAGE_BPS',75,10,300),
  hardStop:num('STOP_LOSS_PCT',5,1,25),
  trailActivate:num('TRAILING_ACTIVATE_PCT',10,2,100),
  trailPct:num('TRAILING_STOP_PCT',7,1,30),
  maxHoldMin:num('MAX_HOLD_MINUTES',180,5,1440),
  pollSec:num('POLL_SECONDS',20,10,120),
  minDiscoveryLiq:num('MIN_DISCOVERY_LIQUIDITY_USD',10000,5000,10000000),
  minEntryLiq:num('MIN_LIQUIDITY_USD',25000,5000,10000000),
  minVol5:num('MIN_VOLUME_5M_USD',250,0,10000000),
  minVol1:num('MIN_VOLUME_1H_USD',1500,0,100000000),
  minTx:num('MIN_TXNS_5M',3,0,10000),
  minScore:num('MIN_SCORE',58,0,100),
  reboundPct:num('BUY_REBOUND_PCT',1.5,0.25,20),
  max5m:num('BUY_MAX_5M_CHANGE',7,1,50),
  cooldownSec:num('ENTRY_COOLDOWN_SECONDS',45,0,3600),
  candidateCap:num('MAX_CANDIDATES',50,10,100),
  historyKeep:num('HISTORY_SAMPLES',36,12,200),
  maxApiConcurrency:num('DISCOVERY_CONCURRENCY',3,1,8),
};

const EXCLUDED_SYMBOLS=new Set(['SOL','WSOL','USDC','USDT','USDS','DAI','PYUSD','EURC','WETH','WBTC','BTC','ETH','JITOSOL','MSOL','BSOL','STSOL','JUPSOL']);
const EXCLUDED_MINTS=new Set([SOL,USDC,USDT,'So11111111111111111111111111111111111111112']);
const ALLOW=new Set((process.env.TOKEN_ALLOWLIST||'').split(',').map(s=>s.trim()).filter(Boolean));

let positions=new Map();
let history=new Map();
let candidateCache=new Map();
let dayPnl=0, consecutiveLosses=0, dayStart='';
let lastTradeAt=0;
let discoveryBusy=false, tickBusy=false;

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function fetchJson(url,opts={},retries=2){
  let last;
  for(let attempt=0;attempt<=retries;attempt++){
    try{
      const c=new AbortController();
      const t=setTimeout(()=>c.abort(),Number(process.env.HTTP_TIMEOUT_MS||10000));
      const r=await fetch(url,{...opts,signal:c.signal,headers:{accept:'application/json',...(opts.headers||{})}});
      clearTimeout(t);
      if(!r.ok){
        const body=await r.text().catch(()=> '');
        const e=new Error(`${r.status} ${url}${body?` | ${body.slice(0,180)}`:''}`); e.status=r.status; throw e;
      }
      return await r.json();
    }catch(e){
      last=e;
      if(attempt<retries) await sleep(350*(attempt+1));
    }
  }
  throw last;
}

function loadState(){
  try{
    const d=JSON.parse(fs.readFileSync(STATE_FILE,'utf8'));
    if(d.positions) positions=new Map(Object.entries(d.positions));
    if(d.history) history=new Map(Object.entries(d.history));
    if(d.candidateCache) candidateCache=new Map(Object.entries(d.candidateCache));
    dayPnl=Number(d.dayPnl)||0; consecutiveLosses=Number(d.consecutiveLosses)||0; dayStart=d.dayStart||'';
  }catch{}
}
function saveState(){
  const cleanHistory={};
  for(const [m,a] of history){cleanHistory[m]=a.slice(-CFG.historyKeep);}
  const cleanCache={};
  for(const [m,c] of candidateCache) cleanCache[m]=c;
  try{fs.writeFileSync(STATE_FILE,JSON.stringify({positions:Object.fromEntries(positions),history:cleanHistory,candidateCache:cleanCache,dayPnl,consecutiveLosses,dayStart},null,2));}catch(e){console.error('STATE SAVE ERROR',e.message)}
}
function logTrade(x){try{fs.appendFileSync(TRADE_LOG,JSON.stringify({time:new Date().toISOString(),...x})+'\n')}catch(e){console.error('TRADE LOG ERROR',e.message)}}

async function solBalance(){return (await conn.getBalance(wallet.publicKey,'confirmed'))/LAMPORTS_PER_SOL;}
async function tokenRawBalance(mint){
  const res=await conn.getParsedTokenAccountsByOwner(wallet.publicKey,{mint:new PublicKey(mint)},'confirmed');
  let total=0;
  for(const a of res.value) total += Number(a.account.data.parsed.info.tokenAmount.amount||0);
  return Math.floor(total);
}

function validCandidate(p){
  if(!p || p.chainId!=='solana' || !p.baseToken?.address || !(Number(p.priceUsd)>0)) return false;
  const mint=p.baseToken.address;
  const sym=String(p.baseToken.symbol||'').trim().toUpperCase();
  const name=String(p.baseToken.name||'').trim().toUpperCase();
  const q=String(p.quoteToken?.symbol||'').trim().toUpperCase();
  if(EXCLUDED_MINTS.has(mint)) return false;
  if(ALLOW.size && !ALLOW.has(mint)) return false;
  if(EXCLUDED_SYMBOLS.has(sym)||EXCLUDED_SYMBOLS.has(name)) return false;
  // DexScreener commonly reports native-SOL pools as WSOL. Treat SOL/WSOL as the same quote asset.
  if(!['SOL','WSOL','USDC','USDT'].includes(q)) return false;
  const liq=Number(p.liquidity?.usd)||0;
  const v5=Number(p.volume?.m5)||0;
  const v1=Number(p.volume?.h1)||0;
  const ch5=Number.isFinite(Number(p.priceChange?.m5))?Number(p.priceChange.m5):0;
  const ch1=Number.isFinite(Number(p.priceChange?.h1))?Number(p.priceChange.h1):0;
  if(liq<CFG.minDiscoveryLiq || !Number.isFinite(ch5)||!Number.isFinite(ch1)) return false;
  return true;
}

function candidateFromPair(p){
  const buys=Number(p.txns?.m5?.buys)||0, sells=Number(p.txns?.m5?.sells)||0, tx=buys+sells;
  const liq=Number(p.liquidity?.usd)||0, v5=Number(p.volume?.m5)||0, v1=Number(p.volume?.h1)||0;
  const ch5=Number(p.priceChange?.m5)||0, ch1=Number(p.priceChange?.h1)||0;
  // Score is a ranking aid only. Entry requires independent setup checks.
  const activity=Math.min(20,Math.log10(v1/1000+1)*8)+Math.min(14,tx/4);
  const liquidity=Math.min(22,Math.log10(liq/1000+1)*8);
  const pullback=Math.max(0,Math.min(18,Math.abs(Math.min(ch1,0))*0.9));
  const momentum=Math.max(0,Math.min(12,ch5*1.6));
  const buyPressure=tx?Math.min(14,(buys/tx)*14):0;
  return {address:p.baseToken.address,symbol:p.baseToken.symbol||'UNKNOWN',name:p.baseToken.name||'Unknown',price:Number(p.priceUsd),liquidity:liq,volume5m:v5,volume1h:v1,buys,sells,change5m:ch5,change1h:ch1,score:Math.min(100,liquidity+activity+pullback+momentum+buyPressure),pairAddress:p.pairAddress,quoteSymbol:p.quoteToken?.symbol||''};
}

async function limitedMap(items,limit,fn){
  const out=[]; let idx=0;
  async function worker(){while(true){const i=idx++;if(i>=items.length)return;try{const x=await fn(items[i],i);if(x!==undefined)out.push(x)}catch{}}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return out;
}

async function discover(){
  if(discoveryBusy) return [...candidateCache.values()].sort((a,b)=>b.score-a.score).slice(0,CFG.candidateCap);
  discoveryBusy=true;
  try{
    const pairMap=new Map();
    let apiPairs=0, acceptedPairs=0;
    let failedSearches=0;
    const addPair=(p)=>{
      apiPairs++;
      if(!validCandidate(p)) return;
      acceptedPairs++;
      const mint=p.baseToken.address;
      const c=candidateFromPair(p);
      const old=pairMap.get(mint);
      if(!old || c.score>old.score) pairMap.set(mint,c);
    };

    // Discovery is deliberately based on the PAIRS returned by the APIs.
    // The old implementation converted discovery results into mints and then
    // performed a second token lookup, which frequently returned nothing and
    // collapsed the universe to zero candidates.
    const searches=['WSOL','USDC','USDT','SOL','pump','meme','ai','cat','dog','bonk','wif','gaming','defi'];
    for(const q of searches){
      try{
        const d=await fetchJson(`${DEX}/latest/dex/search?q=${encodeURIComponent(q)}`,{},2);
        for(const p of d?.pairs||[]) addPair(p);
      }catch(e){ failedSearches++; /* one failed source must not kill discovery */ }
      await sleep(250);
    }

    // Direct trending/new-pool discovery. Keep only pools for which we can
    // obtain actual DexScreener pair data below.
    const mintSet=new Set([...pairMap.keys()]);
    for(const url of [
      `${DEX}/token-profiles/latest/v1`,
      `${DEX}/token-boosts/latest/v1`,
      `${DEX}/token-boosts/top/v1`
    ]){
      try{
        const d=await fetchJson(url,{},2);
        for(const x of(Array.isArray(d)?d:[])){
          if(x?.chainId==='solana' && x?.tokenAddress && !EXCLUDED_MINTS.has(x.tokenAddress)) mintSet.add(x.tokenAddress);
        }
      }catch{}
      await sleep(250);
    }

    // Refresh discovered profile/boost mints in small batches.
    const refresh=[...mintSet].filter(m=>!pairMap.has(m)).slice(0,450);
    for(let i=0;i<refresh.length;i+=25){
      const batch=refresh.slice(i,i+25);
      try{
        const d=await fetchJson(`${DEX}/tokens/v1/solana/${batch.join(',')}`,{},2);
        for(const p of(Array.isArray(d)?d:[])) addPair(p);
      }catch{}
      await sleep(150);
    }

    // GeckoTerminal is a fallback source, not a source of fake zero-data candidates.
    try{
      const d=await fetchJson('https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1',{},1);
      const ids=(d?.data||[]).map(x=>x?.relationships?.base_token?.data?.id||'').map(x=>x.replace(/^solana_/i,'')).filter(Boolean);
      const missing=ids.filter(m=>!pairMap.has(m)).slice(0,50);
      if(missing.length){
        const dd=await fetchJson(`${DEX}/tokens/v1/solana/${missing.join(',')}`,{},1);
        for(const p of(Array.isArray(dd)?dd:[])) addPair(p);
      }
    }catch{}

    // Preserve recently valid candidates through temporary API failures.
    const now=Date.now();
    for(const [mint,c] of candidateCache){
      if(!pairMap.has(mint) && now-(c.updatedAt||0)<180000) pairMap.set(mint,c);
    }

    candidateCache=new Map([...pairMap].map(([m,c])=>[m,{...c,updatedAt:now}]));
    const result=[...pairMap.values()]
      .filter(c=>validCandidate({chainId:'solana',baseToken:{address:c.address,symbol:c.symbol,name:c.name},quoteToken:{symbol:c.quoteSymbol},priceUsd:c.price,liquidity:{usd:c.liquidity},volume:{m5:c.volume5m,h1:c.volume1h},priceChange:{m5:c.change5m,h1:c.change1h}}))
      .sort((a,b)=>b.score-a.score)
      .slice(0,CFG.candidateCap);
    if(!result.length) console.log(`DISCOVERY DEBUG | apiPairs ${apiPairs} | accepted ${acceptedPairs} | searchErrors ${failedSearches} | cache ${candidateCache.size}`);
    return result;
  }finally{discoveryBusy=false;}
}

function remember(c){
  if(!c?.price || !Number.isFinite(c.price))return;
  const arr=history.get(c.address)||[];
  const last=arr[arr.length-1];
  // One sample per polling cycle, not duplicate writes.
  if(last && Date.now()-last.time<CFG.pollSec*800)return;
  arr.push({time:Date.now(),price:c.price,score:c.score,change5m:c.change5m,change1h:c.change1h,volume5m:c.volume5m,volume1h:c.volume1h,buys:c.buys,sells:c.sells});
  while(arr.length>CFG.historyKeep)arr.shift();
  history.set(c.address,arr);
}

function setupSignal(c){
  const arr=history.get(c.address)||[];
  if(c.score<CFG.minScore || c.liquidity<CFG.minEntryLiq || c.volume1h<CFG.minVol1 || c.volume5m<CFG.minVol5 || c.buys+c.sells<CFG.minTx) return {ok:false,reason:'activity'};
  if(c.change5m>CFG.max5m)return {ok:false,reason:'chasing'};
  if(arr.length<5)return {ok:false,reason:'warming'};
  const prices=arr.map(x=>x.price).filter(Number.isFinite);
  if(prices.length<5)return {ok:false,reason:'warming'};
  const low=Math.min(...prices.slice(0,-2));
  const high=Math.max(...prices.slice(0,-2));
  const rebound=(c.price-low)/low*100;
  const pullback=(high-c.price)/high*100;
  const prev=prices[prices.length-2];
  const rising=c.price>prev;
  const buyPressure=(c.buys+c.sells)>0?c.buys/(c.buys+c.sells):0;
  const higherWeak=c.change1h<=-2 || (c.change1h<=4 && rebound>=3);
  const notChasing=pullback>=0.75 || c.change5m<=3.5;
  const ok=rising&&rebound>=CFG.reboundPct&&higherWeak&&notChasing&&buyPressure>=0.45;
  return {ok,reason:ok?'confirmed':'not-confirmed',rebound,pullback,buyPressure};
}

async function quote(input,output,amount){
  const u=new URL(`${JUP}/quote`);
  u.searchParams.set('inputMint',input);u.searchParams.set('outputMint',output);u.searchParams.set('amount',String(Math.floor(amount)));
  u.searchParams.set('slippageBps',String(CFG.slippageBps));u.searchParams.set('restrictIntermediateTokens','true');
  return fetchJson(u.toString(),{},1);
}

async function swap(input,output,amount){
  const q=await quote(input,output,amount);
  const impact=Number(q.priceImpactPct||0);
  if(!q?.routePlan?.length)throw new Error('No Jupiter route.');
  if(Number.isFinite(impact)&&impact>CFG.maxImpact)throw new Error(`Price impact ${impact.toFixed(2)}% exceeds ${CFG.maxImpact}%`);
  const r=await fetch(`${JUP}/swap`,{method:'POST',headers:{'Content-Type':'application/json','accept':'application/json'},body:JSON.stringify({
    quoteResponse:q,userPublicKey:wallet.publicKey.toBase58(),wrapAndUnwrapSol:true,dynamicComputeUnitLimit:true,
    useSharedAccounts:false,dynamicSlippage:false,prioritizationFeeLamports:'auto'
  })});
  if(!r.ok)throw new Error(`Jupiter swap ${r.status}: ${(await r.text()).slice(0,400)}`);
  const body=await r.json(); if(!body.swapTransaction)throw new Error('Jupiter returned no swapTransaction.');
  const tx=VersionedTransaction.deserialize(Buffer.from(body.swapTransaction,'base64')); tx.sign([wallet]);
  // Keep preflight ON. Use confirmed consistently, as recommended by Solana docs.
  const sig=await conn.sendRawTransaction(tx.serialize(),{skipPreflight:false,preflightCommitment:'confirmed',maxRetries:5});
  const conf=await conn.confirmTransaction(sig,'confirmed');
  if(conf.value.err)throw new Error(`Transaction confirmed with error: ${JSON.stringify(conf.value.err)}`);
  return {sig,q,priceImpact:impact};
}

async function currentTokenValueSol(mint,raw){
  if(!raw)return 0;
  try{const q=await quote(mint,SOL,raw);return Number(q.outAmount)/1e9}catch{return 0}
}

async function maxOpenPositions(sol){
  try{
    const q=await quote(SOL,USDC,1e9); const solUsd=Number(q.outAmount)/1e6;
    if(!Number.isFinite(solUsd)||solUsd<=0)return 0;
    const slots=Math.floor(Math.max(0,sol-CFG.reserveSol)/(CFG.tradeUsd/solUsd));
    return Math.min(CFG.maxPositions,Math.max(0,slots));
  }catch{return 0}
}

function resetDayIfNeeded(){
  const d=new Date().toISOString().slice(0,10);
  if(dayStart!==d){dayStart=d;dayPnl=0;consecutiveLosses=0;saveState();}
}

async function managePositions(candidates){
  for(const [mint,pos] of [...positions]){
    const c=candidates.find(x=>x.address===mint);
    if(c?.price) pos.lastPrice=c.price;
    const price=pos.lastPrice||pos.entryPrice;
    if(!price)continue;
    pos.highestPrice=Math.max(pos.highestPrice||pos.entryPrice,price);
    const pct=(price-pos.entryPrice)/pos.entryPrice*100;
    const fromHigh=(price-pos.highestPrice)/pos.highestPrice*100;
    const age=(Date.now()-pos.opened)/60000;
    const hard=pct<=-CFG.hardStop;
    const trail=pct>=CFG.trailActivate && fromHigh<=-CFG.trailPct;
    const timeout=age>=CFG.maxHoldMin;
    if(!hard&&!trail&&!timeout)continue;

    try{
      let raw=await tokenRawBalance(mint);
      if(raw<=0){positions.delete(mint);saveState();continue;}
      // Verify the route and price immediately before selling; retry with slightly less size
      // because tiny residual dust/rounding can make an otherwise valid route fail.
      let res=null,lastErr=null;
      for(const cut of [1,0.998,0.995,0.99]){
        try{res=await swap(mint,SOL,Math.floor(raw*cut));break}catch(e){lastErr=e;}
      }
      if(!res)throw lastErr||new Error('Sell failed after retries.');
      const reason=hard?'HARD_STOP':trail?'TRAILING_STOP':'MAX_HOLD';
      const actualSolOut=Number(res.q.outAmount)/1e9;
      const estimatedUsd=Number(pos.budgetUsd)||CFG.tradeUsd;
      const estimatedPnl=estimatedUsd*(pct/100);
      dayPnl+=estimatedPnl; consecutiveLosses=estimatedPnl<0?consecutiveLosses+1:0;
      logTrade({side:'SELL',symbol:pos.symbol,mint,reason,pct,fromHigh,age,estimatedPnl,actualSolOut,signature:res.sig,priceImpact:res.priceImpact});
      console.log(`🔴 SELL ${pos.symbol} ${pct.toFixed(2)}% | ${reason} | ${res.sig}`);
      positions.delete(mint);lastTradeAt=Date.now();saveState();
    }catch(e){
      console.error(`SELL ERROR ${pos.symbol}: ${e.message}`);
      logTrade({side:'SELL_ERROR',symbol:pos.symbol,mint,error:e.message});
    }
  }
}

async function buyBest(candidates,maxPos,sol){
  if(positions.size>=maxPos)return;
  if(dayPnl<=-CFG.maxDailyLoss || consecutiveLosses>=CFG.maxConsecutiveLosses)return;
  if((Date.now()-lastTradeAt)/1000<CFG.cooldownSec)return;
  if(sol<=CFG.reserveSol+0.002)return;

  let chosen=null, signal=null;
  for(const c of candidates){
    if(positions.has(c.address))continue;
    const s=setupSignal(c); if(s.ok){chosen=c;signal=s;break;}
  }
  if(!chosen)return;

  try{
    const solUsdQ=await quote(SOL,USDC,1e9); const solUsd=Number(solUsdQ.outAmount)/1e6;
    if(!Number.isFinite(solUsd)||solUsd<=0)return;
    const spendUsd=Math.min(CFG.tradeUsd,(sol-CFG.reserveSol)*solUsd);
    if(spendUsd<=0)return;
    const lamports=Math.floor((spendUsd/solUsd)*1e9);
    if(lamports<5000)return;
    const before=await solBalance();
    const res=await swap(SOL,chosen.address,lamports);
    const after=await solBalance();
    const spentSol=Math.max(0,before-after);
    const raw=await tokenRawBalance(chosen.address);
    if(raw<=0)throw new Error('BUY confirmed but no token balance was found. Refusing to create an open position.');
    const entryPrice=chosen.price;
    positions.set(chosen.address,{symbol:chosen.symbol,mint:chosen.address,opened:Date.now(),entryPrice,highestPrice:entryPrice,budgetUsd:Math.min(spendUsd,CFG.tradeUsd),spentSol,tokenRaw:raw,entrySignature:res.sig});
    logTrade({side:'BUY',symbol:chosen.symbol,mint:chosen.address,budgetUsd:Math.min(spendUsd,CFG.tradeUsd),spentSol,entryPrice,score:chosen.score,signal,signature:res.sig,priceImpact:res.priceImpact});
    lastTradeAt=Date.now();saveState();
    console.log(`🟢 BUY ${chosen.symbol} ~$${Math.min(spendUsd,CFG.tradeUsd).toFixed(2)} | rebound ${signal.rebound.toFixed(2)}% | 5m ${chosen.change5m.toFixed(2)}% | ${res.sig}`);
  }catch(e){console.error(`BUY ERROR ${chosen.symbol}: ${e.message}`);logTrade({side:'BUY_ERROR',symbol:chosen.symbol,mint:chosen.address,error:e.message});}
}

async function tick(){
  if(tickBusy)return; tickBusy=true;
  try{
    resetDayIfNeeded();
    const sol=await solBalance();
    const candidates=await discover();
    for(const c of candidates)remember(c);
    const maxPos=await maxOpenPositions(sol);
    console.log(`${new Date().toLocaleTimeString()} | wallet SOL ${sol.toFixed(4)} | candidates ${candidates.length} | open ${positions.size}/${maxPos} | day P/L ~$${dayPnl.toFixed(2)}`);
    if(candidates.length) console.log(candidates.slice(0,12).map(c=>`${c.symbol} score ${c.score.toFixed(1)} | 5m ${c.change5m.toFixed(2)}% | 1h ${c.change1h.toFixed(2)}% | liq $${Math.round(c.liquidity).toLocaleString()}`).join('\n'));
    else console.log('No tradable candidates this cycle — cached universe will be retained while discovery retries.');

    await managePositions(candidates);
    const sol2=await solBalance();
    const max2=await maxOpenPositions(sol2);
    await buyBest(candidates,max2,sol2);
    saveState();
  }catch(e){console.error(`CYCLE ERROR: ${e.message}`);logTrade({side:'SYSTEM_ERROR',error:e.message});}
  finally{tickBusy=false;}
}

console.log('⚡ QUANTUM TRADER TOKEN SCOUT — SWING MODE V8');
console.log(`Wallet ${wallet.publicKey.toBase58()}`);
console.log(`Trade ~$${CFG.tradeUsd} | hard stop ${CFG.hardStop}% | trailing +${CFG.trailActivate}% / ${CFG.trailPct}% | max positions ${CFG.maxPositions} | reserve ${CFG.reserveSol} SOL | max impact ${CFG.maxImpact}%`);
console.log('Strategy: broad discovery -> persistent history -> pullback/rebound confirmation -> controlled entry -> hard/trailing/time exits.');
console.log('Safety: preflight ON, confirmed RPC, price-impact guard, daily loss guard, consecutive-loss halt, actual token-balance verification.');
console.log(`Live gate: ENABLE_LIVE=${liveValue || 'unset'} | env file: ${fs.existsSync(ENV_FILE)?'FOUND':'MISSING'}`);
console.log('Starting in 10 seconds. Ctrl+C = emergency stop.');
loadState();
setTimeout(async()=>{await tick();setInterval(tick,CFG.pollSec*1000)},10000);
