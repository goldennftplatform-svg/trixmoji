'use strict'
// Local, loopback-only test harness. It never accesses a wallet or signing key.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module')
const deps=process.env.TRIX_TEST_DEPS
if(!deps)throw Error('Set TRIX_TEST_DEPS to the test dependency directory.')
const solc=createRequire(path.join(deps,'package.json'))('solc'),{ethers}=require('ethers')
const {readQuote}=require('./quote.cjs')
const {compile:compileSettlement}=require('./compile-settlement.cjs')
if(!solc.version().startsWith('0.8.30+'))throw Error('Unexpected Solidity compiler version.')
const source=fs.readFileSync(path.join(__dirname,'../contracts/TrixGiveawayVault.sol'),'utf8')
const input={language:'Solidity',sources:{'Vault.sol':{content:source}},settings:{evmVersion:'shanghai',optimizer:{enabled:false},outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode']}}}}
const result=JSON.parse(solc.compile(JSON.stringify(input))),errors=(result.errors||[]).filter(e=>e.severity==='error')
if(errors.length)throw Error('Vault compilation failed.')
const compiled=result.contracts['Vault.sol'].TrixGiveawayVault
const selected='0x47cf60bdd877203264921d05ce26f81f6d36aa3e'
let runtime=compiled.evm.deployedBytecode.object.split('')
for(const positions of Object.values(compiled.evm.deployedBytecode.immutableReferences))for(const position of positions){
 const encoded=ethers.utils.hexZeroPad(selected,position.length).slice(2)
 runtime.splice(position.start*2,position.length*2,...encoded)
}
const artifact={abi:compiled.abi,bytecode:'0x'+compiled.evm.bytecode.object,runtimeHash:ethers.utils.keccak256('0x'+runtime.join('')),compiler:solc.version(),chainId:11155111,depositor:selected,curator:selected}
const settlementArtifact=compileSettlement(solc)
const quoteProvider=process.env.TRIX_SEPOLIA_RPC_URL?new ethers.providers.JsonRpcProvider({url:process.env.TRIX_SEPOLIA_RPC_URL,timeout:10000},11155111):null
let cachedQuote=null,quoteAt=0
const server=http.createServer(async(req,res)=>{
 const host='127.0.0.1:'+server.address().port
 if(req.headers.host!==host || (req.headers.origin&&req.headers.origin!=='http://'+host) || (req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))){res.writeHead(403);return res.end('Forbidden')}
 if(req.method!=='GET'){res.writeHead(405);return res.end('GET only')}
 const url=new URL(req.url,'http://'+host),files={'/':'index.html','/testnet.js':'testnet.js','/wallet.js':'wallet.js','/nohash.js':'nohash.js','/test-quote.js':'../test-quote.js','/economy.html':'economy.html','/economy.js':'economy.js','/ethers.js':'../../node_modules/ethers/dist/ethers.umd.min.js'}
 if(url.pathname==='/artifact'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify(artifact))}
 if(url.pathname==='/settlement-artifact'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify(settlementArtifact))}
 if(url.pathname==='/quote'){
  try{if(!quoteProvider)throw Error('unavailable');if(!cachedQuote||Date.now()-quoteAt>30000){cachedQuote=await readQuote(quoteProvider);quoteAt=Date.now()}res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({ok:true,...cachedQuote}))}
  catch(_){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({ok:false,error:'Sepolia test quote unavailable'}))}
 }
 if(url.pathname==='/last-demo-round'){
  try{const r=await fetch('http://127.0.0.1:8787/test-economy',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('unavailable');const data=await r.json(),round=(data.recent||[]).find(x=>x.status==='finished');res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({ok:true,round:round||null}))}
  catch(_){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({ok:false,error:'Local demo ledger unavailable'}))}
 }
 if(url.pathname==='/indexer/status'||/^\/indexer\/ethscriptions\/0x[a-f0-9]{64}$/i.test(url.pathname)){
  try{const upstream=await fetch('http://127.0.0.1:4000'+url.pathname.slice('/indexer'.length),{signal:AbortSignal.timeout(10000)});const body=await upstream.text();res.writeHead(upstream.status,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(body)}catch(_){res.writeHead(503);return res.end('Indexer unavailable')}
 }
 if(!files[url.pathname]){res.writeHead(404);return res.end('Not found')}
 try{const content=fs.readFileSync(path.join(__dirname,files[url.pathname]));res.writeHead(200,{'Content-Type':url.pathname==='/'||url.pathname.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(content)}catch(_){res.writeHead(500);return res.end('File unavailable')}
})
server.listen(8790,'127.0.0.1',()=>console.log('Sepolia test: http://127.0.0.1:8790/'))
