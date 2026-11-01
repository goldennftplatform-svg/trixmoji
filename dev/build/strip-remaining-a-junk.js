const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');

function walk(dir, acc = []) {
 if (!fs.existsSync(dir)) return acc;
 for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
 if (['node_modules', 'cryptodad-mobile', 'apps', '.git'].includes(e.name)) continue;
 const p = path.join(dir, e.name);
 if (e.isDirectory()) walk(p, acc);
 else if (/\.(html|js|css)$/i.test(e.name)) acc.push(p);
 }
 return acc;
}

function clean(t) {
 // box-drawing comments / leftover mojibake
 t = t.replace(/---+/g, '---');
 t = t.replace(/-<"']*/g, '-');
 t = t.replace(/\s*/g, '');
 t = t.replace(/BTC/g, 'BTC');
 t = t.replace(/\s*-\s*‡\s*/g, '');
 t = t.replace(/\s*-\s*Ž\s*/g, '');
 t = t.replace(/\s*-\s*[A-Za-z]*/g, '');
 t = t.replace(/ð\s*\*\s*/g, '');
 t = t.replace(/<"']*/g, '');
 t = t.replace(/UP/DN<"']*/g, 'UP/DN');
 t = t.replace(/[^\x00-\x7F]*/g, '');
 t = t.replace(/[]/g, '');
 // cleanup double spaces in text (not indentation carefully - only multi space mid-line already done)
 t = t.replace(/[ \t]{2,}/g, ' ');
 return t;
}

let n = 0;
for (const f of walk(root)) {
 const before = fs.readFileSync(f, 'utf8');
 if (!/[]/.test(before)) continue;
 const after = clean(before);
 if (after !== before) {
 fs.writeFileSync(f, after);
 console.log('fixed', path.relative(root, f));
 n++;
 }
}
console.log('fixed', n);

// final check
let dirty = 0;
for (const f of walk(path.join(root, 'orbit'))) {
 const t = fs.readFileSync(f, 'utf8');
 if (/[]|| \*/.test(t)) {
 dirty++;
 console.log('DIRTY', path.relative(root, f));
 }
}
console.log('orbit dirty remaining', dirty);
