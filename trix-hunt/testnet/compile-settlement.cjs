'use strict'
const fs=require('node:fs'),path=require('node:path'),{ethers}=require('ethers')
const FEED='0x694AA1769357215DE4FAC081bf1f309aDC325306',OPERATOR='0x47cf60bdd877203264921d05ce26f81f6d36aa3e'
function compile(solc){
 if(!solc.version().startsWith('0.8.30+'))throw Error('Unexpected Solidity compiler version')
 const source=fs.readFileSync(path.join(__dirname,'../contracts/TrixHuntSepoliaSettlement.sol'),'utf8')
 const input={language:'Solidity',sources:{'Settlement.sol':{content:source}},settings:{evmVersion:'shanghai',optimizer:{enabled:false},outputSelection:{'*':{'':['ast'],'*':['abi','evm.bytecode.object','evm.deployedBytecode']}}}}
 const out=JSON.parse(solc.compile(JSON.stringify(input))),errors=(out.errors||[]).filter(e=>e.severity==='error');if(errors.length)throw Error('Settlement compilation failed')
 const contract=out.contracts['Settlement.sol'].TrixHuntSepoliaSettlement,ast=out.sources['Settlement.sol'].ast
 const def=ast.nodes.find(n=>n.nodeType==='ContractDefinition'&&n.name==='TrixHuntSepoliaSettlement')
 const immutableNames=new Map(def.nodes.filter(n=>n.nodeType==='VariableDeclaration'&&n.mutability==='immutable').map(n=>[String(n.id),n.name]))
 const refs=contract.evm.deployedBytecode.immutableReferences,runtime=contract.evm.deployedBytecode.object.split('')
 if(Object.keys(refs).length!==2)throw Error('Unexpected settlement immutables')
 for(const [id,positions] of Object.entries(refs)){const name=immutableNames.get(id),address=name==='feed'?FEED:name==='operator'?OPERATOR:null;if(!address)throw Error('Unexpected settlement role');for(const pos of positions){const encoded=ethers.utils.hexZeroPad(address,pos.length).slice(2);runtime.splice(pos.start*2,pos.length*2,...encoded)}}
 return {abi:contract.abi,bytecode:'0x'+contract.evm.bytecode.object,runtimeHash:ethers.utils.keccak256('0x'+runtime.join('')),compiler:solc.version(),chainId:11155111,feed:FEED,operator:OPERATOR}
}
module.exports={compile,FEED,OPERATOR}
