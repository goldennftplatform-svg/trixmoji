(function(){
 'use strict';
 var total=500,pageSize=40,page=0,grid=document.getElementById('boothGrid');
 function render(){
  var start=page*pageSize,end=Math.min(total,start+pageSize);grid.textContent='';
  for(var id=start;id<end;id++){
   var card=document.createElement('article');card.className='booth-card';
   var image=document.createElement('img');image.src='/assets/ethscriptions/trixmoji-launch/'+id+'.webp';image.alt='TrixMoji #'+id;image.loading='lazy';image.width=180;image.height=180;
   var label=document.createElement('div'),name=document.createElement('strong'),tag=document.createElement('span');name.textContent='TRIXMOJI #'+id;tag.textContent='PREVIEW';label.append(name,tag);card.append(image,label);grid.append(card);
  }
  document.getElementById('boothRange').textContent=(start+1)+'–'+end+' / '+total+' EXAMPLES';
  document.getElementById('boothPage').textContent='PAGE '+(page+1)+' / '+Math.ceil(total/pageSize);
  document.getElementById('boothPrev').disabled=page===0;document.getElementById('boothNext').disabled=end===total;
 }
 document.getElementById('boothPrev').onclick=function(){if(page>0){page--;render();document.getElementById('boothTitle').scrollIntoView({block:'start'});}};
 document.getElementById('boothNext').onclick=function(){if((page+1)*pageSize<total){page++;render();document.getElementById('boothTitle').scrollIntoView({block:'start'});}};
 render();
}());
