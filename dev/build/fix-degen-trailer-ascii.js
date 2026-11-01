const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', '..', 'orbit', 'pages', 'degen', 'trailer.html');
let t = fs.readFileSync(p, 'utf8');

// Common mojibake for em dash / bullets when UTF-8 mis-decoded
const replacements = [
 [/ - /g, ' - '],
 [/ - /g, ' - '],
 [/ * /g, ' * '],
 [/'/g, "'"],
 [/'/g, "'"],
 [/"/g, '"'],
 [/"\u009d/g, '"'],
 [/"/g, '"'],
 [/""/g, ' - '],
 [/cursor-blink">|<\/span>/g, 'cursor-blink">|</span>'],
 [/cursor-blink"><\/span>/g, 'cursor-blink">|</span>']
];

for (const [re, to] of replacements) {
 t = t.replace(re, to);
}

// Force clean titles (explicit)
t = t.replace(
 /<title>[\s\S]*?<\/title>/,
 '<title>DOSWAPZ // DEGEN$ - OFFICIAL TRAILER // ORBIT</title>'
);
t = t.replace(
 /crumb-zone">[\s\S]*?<\/span>/,
 'crumb-zone">DEGEN$ - OFFICIAL TRAILER</span>'
);
t = t.replace(
 /id="orbitTitle">[\s\S]*?<\/h1>/,
 'id="orbitTitle">DEGEN$ - OFFICIAL TRAILER</h1>'
);
t = t.replace(
 /id="stageSub">[\s\S]*?<\/p>/,
 'id="stageSub">official trailer<span class="cursor-blink">|</span></p>'
);
t = t.replace(
 /hollowPageBoot\(['"][\s\S]*?['"]\)/,
 "hollowPageBoot('DEGEN$ - OFFICIAL TRAILER')"
);
t = t.replace(
 /SECURE VIDEO FEED[\s\S]*?DEGEN\$/,
 'SECURE VIDEO FEED - DEGEN$'
);
t = t.replace(
 /TRAILER TRANSMISSION IN PREP[\s\S]*?STAND BY FOR DEGEN\$ DROP/,
 'TRAILER TRANSMISSION IN PREP - STAND BY FOR DEGEN$ DROP'
);
t = t.replace(
 /DOSWAPZ[\s\S]*?CLASSIFIED TRAILER ARCHIVE[\s\S]*?COMSEC[\s\S]*?OPSEC WARNING/,
 'DOSWAPZ - CLASSIFIED TRAILER ARCHIVE * COMSEC / OPSEC WARNING'
);

fs.writeFileSync(p, t, 'utf8');
const s = fs.readFileSync(p, 'utf8');
console.log('title', (s.match(/<title>[^<]+/) || [])[0]);
console.log('h1', (s.match(/orbitTitle">[^<]+/) || [])[0]);
console.log('sub', (s.match(/stageSub">[^<]+/) || [])[0]);
console.log('mojibake left', s.includes('"'));
