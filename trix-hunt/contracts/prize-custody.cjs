'use strict'
// Local proof building block. The caller must obtain all evidence from trusted,
// fresh chain/indexer sources and verify the deployment artifact independently.
const { ethers } = require('ethers')
const { verifyDirectDeposit } = require('../../api/lib/trixmoji-market/direct-deposit-proof.cjs')
const DEPOSITOR = '0x47cf60bdd877203264921d05ce26f81f6d36aa3e'
const MINTER = '0x14f9b4a11a10a83c6a686012110dc2bd54efd673'
const same = (a,b) => String(a||'').toLowerCase() === String(b||'').toLowerCase()
const iface = new ethers.utils.Interface(['event PotentialDeposit(bytes32 indexed id,address indexed depositor,uint256 blockNumber)'])

function verifyPrizeDeposit(input) {
 const { deployment,chainId,runtimeCode,roles,transaction,receipt,asset,indexedBlock,latestBlock,entry,registry,id,hash }=input
 if (!deployment || chainId!==1 || deployment.chainId!==1 || !ethers.utils.isAddress(deployment.address||'') || !same(deployment.depositor,DEPOSITOR) || !same(deployment.curator,DEPOSITOR) || !/^0x[a-f0-9]{64}$/i.test(String(deployment.runtimeHash||''))) throw Error('Giveaway deployment is not verified.')
 if (!runtimeCode || runtimeCode==='0x' || !same(ethers.utils.keccak256(runtimeCode),deployment.runtimeHash)) throw Error('Giveaway vault bytecode mismatch.')
 if (!roles || !same(roles.depositor,DEPOSITOR) || !same(roles.curator,DEPOSITOR)) throw Error('Giveaway vault roles do not match.')
 if (!entry || Number(entry.status)!==1 || !Number.isSafeInteger(Number(entry.receivedBlock))) throw Error('Vault deposit is not available.')
 const proof=verifyDirectDeposit({seller:DEPOSITOR,escrow:deployment.address,id,hash,transaction,receipt,asset,indexedBlock,latestBlock,recordedBlock:Number(entry.receivedBlock)})
 const events=(receipt.logs||[]).filter(log=>{
  if(!same(log.address,deployment.address))return false
  try{const parsed=iface.parseLog(log);return parsed.name==='PotentialDeposit'&&same(parsed.args.id,id)&&same(parsed.args.depositor,DEPOSITOR)&&parsed.args.blockNumber.eq(receipt.blockNumber)}catch(_){return false}
 })
 if(events.length!==1)throw Error('Matching vault deposit event unavailable.')
 if(!registry || !same(registry.id,id) || !same(asset.creator,MINTER) || !/^0x[a-f0-9]{64}$/i.test(String(registry.contentSha||'')) || !same(asset.content_sha,registry.contentSha) || !Number.isInteger(registry.tokenNo) || registry.tokenNo<0 || registry.tokenNo>=10000)throw Error('TrixMoji provenance is not verified.')
 return {...proof,tokenNo:registry.tokenNo,eligible:true}
}
module.exports={verifyPrizeDeposit}
