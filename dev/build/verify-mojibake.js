const fs = require('fs');
const path = require('path');
const files = [
 'orbit/pages/degen/trailer.html',
 'orbit/pages/basement.html',
 'orbit/pages/harbinger.html',
 'orbit/pages/13th-step.html',
 'orbit/pages/doswapz/swap.html',
 'classic/hub.html',
 'classic/pages/degen/trailer.html'
];
let dirty = 0;
for (const f of files) {
 const t = fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
 const bad = /
 const title = (t.match(/id="orbitTitle">([^<]+)/) || t.match(/class="header">([^<]+)/) || t.match(/<title>([^<]+)/) || [, '?'])[1];
 const sub = (t.match(/id="stageSub">([^<]+)/) || [, '-'])[1];
 console.log((bad ? 'DIRTY' : 'ok '), f);
 console.log(' title:', title);
 console.log(' sub :', sub);
 if (bad) dirty++;
}
console.log('dirty count', dirty);
