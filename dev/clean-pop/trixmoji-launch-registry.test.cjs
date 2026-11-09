'use strict'
const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('fs'), path=require('path'), {ethers}=require('ethers')
const {createCleanPopRegistry}=require('../../api/lib/trixmoji-market/clean-pop-registry.cjs')
const a=require('../../assets/data/trixmoji-launch-candidate.json'), m=require('../../assets/ethscriptions/trixmoji-launch/manifest.json')
test('launch registry recognizes the new root and rejects the previous collection',async()=>{
 const token=419, id=ethers.utils.id('launch-registry-test'), buyer='0x1111111111111111111111111111111111111111', iface=new ethers.utils.Interface(a.abi)
 const uri='data:image/webp;base64,'+fs.readFileSync(path.resolve(__dirname,'../../assets/ethscriptions/trixmoji-launch/419.webp')).toString('base64')
 const data=iface.encodeFunctionData('mint',[uri,m.files[token].proof,token]),event=iface.encodeEventLog(iface.getEvent('ethscriptions_protocol_CreateEthscription'),[buyer,uri])
 const tx={hash:id,from:buyer,to:a.address,value:ethers.BigNumber.from(a.priceWei),data},receipt={status:1,transactionHash:id,logs:[{address:a.address,...event}]}
 const indexed={transaction_hash:id,creator:a.address,initial_owner:buyer,content_sha:ethers.utils.sha256(ethers.utils.toUtf8Bytes(uri)),content_uri:uri}
 const config={provider:{getTransaction:async()=>tx,getTransactionReceipt:async()=>receipt},indexer:async()=>indexed,minter:a.address,abi:a.abi,root:a.root,mintPriceWei:a.priceWei,mimeType:'image/webp',allowWrappedMints:true}
 assert.equal((await createCleanPopRegistry(config)(id)).tokenNo,token)
 config.root=require('../../assets/data/clean-pop-webp-v2-candidate.json').root
 await assert.rejects(createCleanPopRegistry(config)(id),/does not match the approved root/)
})
