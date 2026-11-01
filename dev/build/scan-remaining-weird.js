const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');

function walk(dir, acc = []) {
 for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
 if (['node_modules', 'cryptodad-mobile', 'apps', '.git'].includes(e.name)) continue;
 const p = path.join(dir, e.name);
 if (e.isDirectory()) walk(p, acc);
 else if (/\.html$/i.test(e.name)) acc.push(p);
 }
 return acc;
}

const re = /[]|| \*| -|||
let hits = 0;
for (const f of walk(path.join(root, 'orbit'))) {
 const t = fs.readFileSync(f, 'utf8');
 if (!re.test(t)) continue;
 hits++;
 const lines = t.split(/\n/);
 console.log('\n', path.relative(root, f));
 lines.forEach((l, i) => {
 if (re.test(l)) console.log(i + 1 + ':', l.trim().slice(0, 140));
 });
}
console.log('\nhit files', hits);

// show phunk lines
const ph = fs.readFileSync(path.join(root, 'orbit', 'pages', 'basement', 'phunk-maker.html'), 'utf8');
console.log('\nPHUNK status:', (ph.match(/status">[^<]+/) || [])[0]);
console.log('PHUNK sub:', (ph.match(/class="sub">[^<]+/) || [])[0]);
console.log('tools:', [...ph.matchAll(/data-tool="[^"]+"[^>]*>[^<]+/g)].map((m) => m[0]));
