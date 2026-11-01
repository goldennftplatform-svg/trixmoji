const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', '..', 'orbit', 'pages', 'doswapz', 'swap.html');
let t = fs.readFileSync(p, 'utf8');

if (!t.includes('swap-orbit.css')) {
 t = t.replace(
 'href="/assets/css/era-transition.css">',
 'href="/assets/css/era-transition.css">\n <link rel="stylesheet" href="/assets/css/swap-orbit.css?v=swapfix5">'
 );
}

const pairs = [
 [' -> ', ' -> '],
 ['v', 'v'],
 [' - ', ' - '],
 [' - ', ' - '],
 [' * ', ' * '],
 [' * ', ' * '],
 ['...', '...'],
 ['<- ', '<- ']
];
for (const [a, b] of pairs) {
 while (t.includes(a)) t = t.split(a).join(b);
}

t = t.replace(/cursor-blink">|<\/span>/g, 'cursor-blink">|</span>');
t = t.replace(/cursor-blink"><\/span>/g, 'cursor-blink">|</span>');
t = t.replace(/ - /g, ' - ');
t = t.replace(/ -> /g, ' -> ');
t = t.replace(/<- /g, '<- ');
t = t.replace(/<script src="\/assets\/js\/core\/rabbit-icon\.js"><\/script>\s*/g, '');

if (!t.includes('FTWR_RABBIT_DISABLED')) {
 t = t.replace(
 '<script src="/assets/js/swap/swap.js"></script>',
 '<script src="/assets/js/swap/swap.js"></script>\n' +
 ' <script>/* FTWR_RABBIT_DISABLED */window.FTWR_RABBIT={decorate:function(){},makeIcon:function(){return document.createElement("span");}};<\/script>'
 );
}

// Ensure hollow sub is clean ascii
t = t.replace(
 /<p class="hollow-sub" id="stageSub">[\s\S]*?<\/p>/,
 '<p class="hollow-sub" id="stageSub">jupiter * trix * live<span class="cursor-blink">|</span></p>'
);

// Clean known HTML strings that still use unicode dashes
t = t.replace(
 /REAL WALLET \(Phantom \/ Solflare\)[\s\S]*?PAGE-SCOPED ONLY/,
 'REAL WALLET (Phantom / Solflare) - PAGE-SCOPED ONLY'
);
t = t.replace(
 /WALLET SAFETY[\s\S]*?SWAP ONLY/,
 'WALLET SAFETY - SWAP ONLY'
);
t = t.replace(
 /If no wallet detected[\s\S]*?demo mode/,
 'If no wallet detected -> demo mode'
);
t = t.replace(
 /VERIFICATION DIRECTIVE[\s\S]*?READ AND COMPLY/,
 'VERIFICATION DIRECTIVE - READ AND COMPLY'
);
t = t.replace(
 /DOSWAPZ[\s\S]*?0% SWAP[\s\S]*?SOLANA[\s\S]*?PAGE-SCOPED/,
 'DOSWAPZ - 0% SWAP * SOLANA * PAGE-SCOPED'
);
t = t.replace(
 /Pond dossier swaps[\s\S]*?<a href="\/orbit\/pages\/pond-scum\.html">/,
 'Pond dossier swaps -> <a href="/orbit/pages/pond-scum.html">'
);
t = t.replace(
 /class="swap-arrow">[\s\S]*?<\/div>/,
 'class="swap-arrow">v</div>'
);
t = t.replace(
 /JUPITER SWAP[\s\S]*?TRIX MARKET[\s\S]*?0% PLATFORM FEE[\s\S]*?LIVE/,
 'JUPITER SWAP * TRIX MARKET * 0% PLATFORM FEE * LIVE'
);
t = t.replace(
 /ROUTE VIA JUPITER[\s\S]*?0% DOSWAPZ FEE[\s\S]*?LIVE QUOTE/,
 'ROUTE VIA JUPITER * 0% DOSWAPZ FEE * LIVE QUOTE'
);
t = t.replace(
 /Private queries[\s\S]*?No public rate limits[\s\S]*?\(demo\)/,
 'Private queries * No public rate limits * (demo)'
);
t = t.replace(
 /TOTAL SWAPS COMPLETED ON DOSWAPZ: <span class="count" id="swapCountValue">[\s\S]*?<\/span>/,
 'TOTAL SWAPS COMPLETED ON DOSWAPZ: <span class="count" id="swapCountValue">-</span>'
);
t = t.replace(
 /href="\/orbit\/(?:test-hub|hub)\.html">[\s\S]*?(?:TEST )?HUB/,
 'href="/orbit/hub.html"><- HUB'
);

fs.writeFileSync(p, t, 'utf8');

const s = fs.readFileSync(p, 'utf8');
console.log('css', s.includes('swap-orbit.css'));
console.log('unicode leftover', /[ -> v - - * * <- ]/.test(s));
console.log('pond', (s.match(/Pond dossier[^<]{0,50}/) || [])[0]);
console.log('arrow', (s.match(/swap-arrow">[^<]+/) || [])[0]);
console.log('wallet', (s.match(/REAL WALLET[^<]+/) || [])[0]);
console.log('btn nav', (s.match(/hub\.html">[^<]+/) || [])[0]);
