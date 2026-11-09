(function (root, factory) {
 'use strict'
 if (typeof module !== 'undefined' && module.exports) module.exports = factory()
 else root.TrixmojiMarketLogin = factory()
})(typeof window !== 'undefined' ? window : globalThis, function () {
 'use strict'
 function same(a,b){return String(a||'').toLowerCase()===String(b||'').toLowerCase()}
 function create(config){
  if(!config||!config.fetch||!config.document||!config.identity)throw Error('Wallet login is not configured.')
  async function api(method,body){var opts={method:method,credentials:'same-origin',cache:'no-store',headers:{}};if(body){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body)}var request=config.fetch,r=await request('/api/account',opts),data=await r.json();if(!r.ok||data.ok===false)throw Error(data.error||'Wallet sign-in unavailable.');return data}
  async function ensure(connection,host){
   if(!connection||!connection.provider||!connection.address||!host)throw Error('Connect an Ethereum wallet first.')
   var session=await api('GET'),wallets=session.user&&session.user.wallets
   var ethereumWallet=Array.isArray(wallets)&&wallets.find(function(w){return w.chain==='ethereum'&&w.address})
   if(ethereumWallet&&same(ethereumWallet.address,connection.address))return {signedIn:true,alreadySignedIn:true}
   return new Promise(function(resolve,reject){
    var doc=config.document,section=doc.createElement('div'),description=doc.createElement('p'),ageLabel=doc.createElement('label'),age=doc.createElement('input'),termsLabel=doc.createElement('label'),terms=doc.createElement('input'),termsLink=doc.createElement('a'),prepare=doc.createElement('button'),cancel=doc.createElement('button'),preview=doc.createElement('pre'),sign=doc.createElement('button'),message=doc.createElement('p'),challenge=null
    section.className='market-login';description.textContent='Sign in with your connected Ethereum wallet before buying or creating an auction. Sign-in is a message signature only; it does not send funds or approve a token.'
    age.type='checkbox';terms.type='checkbox';ageLabel.append(age,doc.createTextNode(' I am 18 or older (or the age of majority where I live).'));termsLink.href='/docs/legal.html#s6a';termsLink.target='_blank';termsLink.rel='noopener noreferrer';termsLink.textContent='DOSWAPZ Terms';termsLabel.append(terms,doc.createTextNode(' I accept the '),termsLink,doc.createTextNode('.'))
    prepare.type=cancel.type=sign.type='button';prepare.textContent='PREPARE WALLET SIGN-IN';cancel.textContent='CANCEL';sign.textContent='SIGN LOGIN IN WALLET';sign.hidden=true;preview.hidden=true;message.setAttribute('role','status')
    section.append(description,ageLabel,termsLabel,prepare,preview,sign,cancel,message);host.textContent='';host.hidden=false;host.appendChild(section)
    function close(){host.hidden=true;host.textContent=''}
    cancel.onclick=function(){close();reject(Error('Wallet sign-in cancelled. No transaction requested.'))}
    prepare.onclick=async function(){prepare.disabled=true;try{if(!age.checked||!terms.checked)throw Error('Check both boxes to continue.');await config.identity(connection.provider,connection.address);challenge=await api('POST',{action:'challenge',chain:'ethereum',address:connection.address,acceptTerms:true,age18:true});if(!challenge.challengeId||typeof challenge.message!=='string'||!challenge.message)throw Error('Invalid wallet sign-in challenge.');preview.textContent=challenge.message;preview.hidden=false;sign.hidden=false;message.textContent='Read the message, then sign in your selected wallet.'}catch(e){message.textContent=e.message;challenge=null}finally{prepare.disabled=false}}
    sign.onclick=async function(){sign.disabled=true;cancel.disabled=true;try{if(!challenge||!age.checked||!terms.checked)throw Error('Prepare sign-in and confirm both boxes first.');await config.identity(connection.provider,connection.address);var signature=await connection.provider.request({method:'personal_sign',params:[challenge.message,connection.address]});var result=await api('POST',{action:'verify',challengeId:challenge.challengeId,signature:signature,acceptTerms:true,age18:true});if(!result.user||!Array.isArray(result.user.wallets)||!result.user.wallets.some(function(w){return w.chain==='ethereum'&&same(w.address,connection.address)}))throw Error('Signed-in account does not match the selected wallet.');await config.identity(connection.provider,connection.address);close();resolve({signedIn:true,alreadySignedIn:false})}catch(e){message.textContent=e.message;sign.disabled=false;cancel.disabled=false}}
   })
  }
  return {ensure:ensure}
 }
 return {create:create}
})
