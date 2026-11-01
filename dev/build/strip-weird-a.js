/** * Remove "weird A" leftovers (, , and related Latin-1/UTF-8 mojibake) * especially on present degen pages. Also normalize x and similar.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const targets = [
 path.join(root, 'orbit', 'pages', 'degen'),
 path.join(root, 'classic', 'pages', 'degen'),
 path.join(root, '4th test', 'pages', 'degen')
];

function walk(d, acc = []) {
 if (!fs.existsSync(d)) return acc;
 for (const e of fs.readdirSync(d, { withFileTypes: true })) {
 const p = path.join(d, e.name);
 if (e.isDirectory()) walk(p, acc);
 else if (/\.(html|js|css|txt|md)$/i.test(e.name)) acc.push(p);
 }
 return acc;
}

function clean(t) {
 // broken multiply / dash combos
 t = t.replace(/\s*-\s*/g, ' x ');
 t = t.replace(/ x /g, ' x ');
 t = t.replace(/ x /g, ' x ');
 t = t.replace(/\u00d7/g, ' x '); // x 
 // common lone mojibake A-like chars
 t = t.replace(/(?=[\s"'<,.;:!?\-\/])/g, '');
 t = t.replace(/(?=[\s"'<,.;:!?\-\/])/g, '');
 t = t.replace(//g, '');
 t = t.replace(//g, '');
 // leftover from previous strip partials
 t = t.replace(/ '');
 t = t.replace(/ '');
 t = t.replace(/ '');
 // collapse "x x" spacing
 t = t.replace(/\s{2,}/g, ' ');
 t = t.replace(/ x x /g, ' x ');
 return t;
}

let n = 0;
for (const dir of targets) {
 for (const f of walk(dir)) {
 const before = fs.readFileSync(f, 'utf8');
 const after = clean(before);
 if (after !== before) {
 fs.writeFileSync(f, after, 'utf8');
 console.log('fixed', path.relative(root, f));
 n++;
 }
 }
}
console.log('files fixed', n);

// verify degen orbit has no high-latin A leftovers
for (const f of walk(path.join(root, 'orbit', 'pages', 'degen'))) {
 const t = fs.readFileSync(f, 'utf8');
 if (/[]/.test(t)) console.log('STILL DIRTY', f);
}
console.log('done');
