'use strict'
const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('fs'), path=require('path'), ganache=require('ganache'), {ethers}=require('ethers')
const minterArtifact=require('../../assets/data/trixmoji-launch-candidate.json'), marketArtifact=require('../../assets/data/trixmoji-escrow-replacement-artifact.json'), manifest=require('../../assets/ethscriptions/trixmoji-launch/manifest.json')
const {createMarketRuntime}=require('../../api/lib/trixmoji-market/market-runtime.cjs')
const {authenticateLaunchRequest}=require('../../api/lib/trixmoji-market/wallet-proof.cjs'), proof=require('../../assets/js/core/trixmoji-market-proof.js')
async function proofContext(body,wallet){const expires=Math.floor(Date.now()/1000)+120,nonce='0x'+require('crypto').randomBytes(16).toString('hex'),message=proof.message({...body,expires,nonce}),signature=await wallet.signMessage(message);return {body:{...body,walletProof:{expires,nonce,signature}}}}
test('launch art can be minted, deposited, listed and sold with local escrow and mocked indexer',async()=>{
 const rpc=ganache.provider({logging:{quiet:true},chain:{chainId:31337,hardfork:'shanghai'},miner:{blockGasLimit:30000000},wallet:{totalAccounts:5,defaultBalance:100,unlockedAccounts:[minterArtifact.creator]}}), provider=new ethers.providers.Web3Provider(rpc);provider.pollingInterval=20
 try {
  const [deployer,seller,buyer,verifier,creator]=Object.values(rpc.getInitialAccounts()).map(a=>new ethers.Wallet(a.secretKey,provider))
  await rpc.request({method:'evm_setAccountBalance',params:[minterArtifact.creator,'0x56BC75E2D63100000']})
  const minter=await new ethers.ContractFactory(minterArtifact.abi,minterArtifact.bytecode,provider.getSigner(minterArtifact.creator)).deploy();await minter.deployed()
  assert.equal(await minter.paused(),false)
  const token=419,uri='data:image/webp;base64,'+fs.readFileSync(path.resolve(__dirname,'../../assets/ethscriptions/trixmoji-launch/419.webp')).toString('base64')
  const minted=await(await minter.connect(seller).mint(uri,manifest.files[token].proof,token,{value:minterArtifact.priceWei})).wait(),id=minted.transactionHash
  const market=await new ethers.ContractFactory(marketArtifact.abi,marketArtifact.bytecode,deployer).deploy(verifier.address,creator.address);await market.deployed()
  const deposit=await(await seller.sendTransaction({to:market.address,data:id})).wait()
  for(let i=0;i<5;i++)await provider.send('evm_mine',[])
  const price=ethers.utils.parseEther('0.01');await(await market.connect(seller).list(id,price)).wait()
  const asset={transaction_hash:id,creator:minter.address,initial_owner:seller.address,current_owner:market.address,previous_owner:seller.address,content_uri:uri,content_sha:'0x'+manifest.files[token].contentSha256,ethscription_transfers:[{transaction_hash:deposit.transactionHash,from_address:seller.address,to_address:market.address,block_number:deposit.blockNumber}]}
  const indexer=async p=>p==='/status'?{last_imported_block:await provider.getBlockNumber()}:asset
  const runtime=await createMarketRuntime({provider,signer:verifier,indexer,authenticate:async context=>authenticateLaunchRequest(context.body),consumeQuota:async()=>true,chainId:31337,marketAddress:market.address,creator:creator.address,marketRuntimeHash:ethers.utils.keccak256(await provider.getCode(market.address)),marketAbi:marketArtifact.abi,minter:minter.address,minterRuntimeHash:ethers.utils.keccak256(await provider.getCode(minter.address)),minterAbi:minterArtifact.abi,artworkRoot:manifest.root,mintPriceWei:minterArtifact.priceWei,mintMimeType:'image/webp',marketStartBlock:deposit.blockNumber,confirmations:1})
  assert.equal((await runtime.list()).listings[0].id,id)
  const request={id,seller:seller.address,buyer:buyer.address,kind:0,amount:price.toString(),duration:0},signed=await runtime.issueApproval({body:request},request)
  await assert.rejects(market.connect(deployer).estimateGas.buy(signed.approval,signed.signature,{value:price}),/invalid purchase/)
  const bought=await(await market.connect(buyer).buy(signed.approval,signed.signature,{value:price})).wait()
  assert.ok(bought.events.some(e=>e.event==='ethscriptions_protocol_TransferEthscriptionForPreviousOwner'&&e.args.id===id))
 } finally {await rpc.disconnect()}
})
test('launch art can be auctioned and settled with local escrow and mocked indexer',async()=>{
 const rpc=ganache.provider({logging:{quiet:true},chain:{chainId:31337,hardfork:'shanghai'},miner:{blockGasLimit:30000000},wallet:{totalAccounts:5,defaultBalance:100,unlockedAccounts:[minterArtifact.creator]}}),provider=new ethers.providers.Web3Provider(rpc);provider.pollingInterval=20
 try {
  const [deployer,seller,buyer,verifier,creator]=Object.values(rpc.getInitialAccounts()).map(a=>new ethers.Wallet(a.secretKey,provider))
  await rpc.request({method:'evm_setAccountBalance',params:[minterArtifact.creator,'0x56BC75E2D63100000']})
  const minter=await new ethers.ContractFactory(minterArtifact.abi,minterArtifact.bytecode,provider.getSigner(minterArtifact.creator)).deploy();await minter.deployed()
  const token=0,uri='data:image/webp;base64,'+fs.readFileSync(path.resolve(__dirname,'../../assets/ethscriptions/trixmoji-launch/0.webp')).toString('base64')
  const minted=await(await minter.connect(seller).mint(uri,manifest.files[token].proof,token,{value:minterArtifact.priceWei})).wait(),id=minted.transactionHash
  const market=await new ethers.ContractFactory(marketArtifact.abi,marketArtifact.bytecode,deployer).deploy(verifier.address,creator.address);await market.deployed()
  const deposit=await(await seller.sendTransaction({to:market.address,data:id})).wait();for(let i=0;i<5;i++)await provider.send('evm_mine',[])
  const asset={transaction_hash:id,creator:minter.address,initial_owner:seller.address,current_owner:market.address,previous_owner:seller.address,content_uri:uri,content_sha:'0x'+manifest.files[token].contentSha256,ethscription_transfers:[{transaction_hash:deposit.transactionHash,from_address:seller.address,to_address:market.address,block_number:deposit.blockNumber}]}
  const indexer=async p=>p==='/status'?{last_imported_block:await provider.getBlockNumber()}:asset
  const runtime=await createMarketRuntime({provider,signer:verifier,indexer,authenticate:async context=>authenticateLaunchRequest(context.body),consumeQuota:async()=>true,chainId:31337,marketAddress:market.address,creator:creator.address,marketRuntimeHash:ethers.utils.keccak256(await provider.getCode(market.address)),marketAbi:marketArtifact.abi,minter:minter.address,minterRuntimeHash:ethers.utils.keccak256(await provider.getCode(minter.address)),minterAbi:minterArtifact.abi,artworkRoot:manifest.root,mintPriceWei:minterArtifact.priceWei,mintMimeType:'image/webp',marketStartBlock:deposit.blockNumber,confirmations:1})
  const reserve=ethers.utils.parseEther('0.01'),request={id,seller:seller.address,buyer:ethers.constants.AddressZero,kind:1,amount:reserve.toString(),duration:3600},signed=await runtime.issueApproval(await proofContext(request,seller),request)
  await(await market.connect(seller).startAuction(signed.approval,signed.signature)).wait()
  const auction=await market.auctions(seller.address,id);assert.equal(auction.reserve.toString(),reserve.toString())
  await(await market.connect(buyer).bid(seller.address,id,auction.nonce,{value:reserve})).wait()
  await provider.send('evm_increaseTime',[7200]);await provider.send('evm_mine',[])
  const receipt=await(await market.settle(seller.address,id,auction.nonce)).wait()
  assert.ok(receipt.events.some(e=>e.event==='ethscriptions_protocol_TransferEthscriptionForPreviousOwner'&&e.args.id===id))
 } finally {await rpc.disconnect()}
})
