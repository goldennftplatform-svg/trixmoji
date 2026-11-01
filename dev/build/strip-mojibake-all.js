/** * Strip UTF-8 mojibake and fancy punctuation sitewide (HTML/JS/CSS, not node_modules). * Targets: "" - * ' " " and block cursors / |
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const SKIP_DIRS = new Set([
 'node_modules',
 'cryptodad-mobile',
 'apps',
 '.git',
 'assets/images',
 'assets/media',
 'assets/videos',
 'assets/video'
]);

function walk(dir, acc = []) {
 let entries;
 try {
 entries = fs.readdirSync(dir, { withFileTypes: true });
 } catch (e) {
 return acc;
 }
 for (const e of entries) {
 if (SKIP_DIRS.has(e.name)) continue;
 const p = path.join(dir, e.name);
 const rel = path.relative(root, p).replace(/\\/g, '/');
 if ([...SKIP_DIRS].some((s) => rel.startsWith(s + '/') || rel === s)) continue;
 if (e.isDirectory()) walk(p, acc);
 else if (/\.(html|js|css|txt|md|json)$/i.test(e.name)) acc.push(p);
 }
 return acc;
}

function clean(text) {
 let t = text;

 // Direct mojibake sequences (most common)
 const pairs = [
 [/ - /g, ' - '],
 [/ - /g, ' - '],
 [/ * /g, ' * '],
 [/.../g, '...'],
 [/'/g, "'"],
 [/'/g, "'"],
 [/"/g, '"'],
 [/"\u009d/g, '"'],
 [/"\x9d/g, '"'],
 [/"/g, '"'], // leftover after partial matches - careful order
 [/""/g, ' - '],
 [/""/g, ' - '],
 [/ * /g, ' * '],
 [/.../g, '...'],
 [/'/g, "'"],
 [/'/g, "'"],
 [/"/g, '"'],
 [/"/g, '"'],
 // arrows that often break
 [/ -> /g, ' -> '],
 [/<- /g, '<- '],
 [/v/g, 'v'],
 [/^/g, '^'],
 [//g, ''],
 [//g, ''],
 [//g, ''],
 [//g, ''],
 [//g, ''],
 [//g, ''],
 [//g, ''],
 [//g, ''],
 // proper unicode fancy punctuation still in source
 [/\u2014/g, ' - '], // em dash
 [/\u2013/g, ' - '], // en dash
 [/\u2022/g, ' * '], // bullet
 [/\u2026/g, '...'],
 [/\u00b7/g, ' * '], // middle dot
 [/\u2192/g, ' -> '],
 [/\u2190/g, '<- '],
 [/\u2193/g, 'v'],
 [/\u2191/g, '^'],
 [/\u25b6/g, ''],
 [/\u25bc/g, ''],
 [/\u25a0/g, ''],
 [/\u2593/g, ''],
 [/\u2592/g, ''],
 [/\u2591/g, ''],
 [/\u2588/g, ''], // full block
 [/\u00a0/g, ' '], // nbsp
 // HTML entities often used for block cursor
 [/|/g, '|'],
 [/|/gi, '|'],
 [/ - /g, ' - '],
 [/ - /g, ' - '],
 [/ * /g, ' * '],
 [/ -> /g, ' -> '],
 [/<- /g, '<- '],
 [/.../g, '...']
 ];

 for (const [re, to] of pairs) {
 t = t.replace(re, to);
 }

 // cursor-blink spans that only held a block
 t = t.replace(
 /(<span class="cursor-blink">)\s*\|?\s*(<\/span>)/g,
 '$1|$2'
 );
 t = t.replace(
 /(<span class="cursor">)\s*\|?\s*(<\/span>)/g,
 '$1|$2'
 );

 // collapse multi-spaces from replacements but not newlines
 t = t.replace(/[ \t]{2,}/g, ' ');

 return t;
}

const files = walk(root);
let fixed = 0;
const changed = [];

for (const f of files) {
 let before;
 try {
 before = fs.readFileSync(f, 'utf8');
 } catch (e) {
 continue;
 }
 // quick filter
 if (
 !/"| - | - |\u2014|\u2013|\u2588|\u2022|\u00b7|\u2192/.test(
 before
 )
 ) {
 continue;
 }
 const after = clean(before);
 if (after !== before) {
 fs.writeFileSync(f, after, 'utf8');
 fixed += 1;
 changed.push(path.relative(root, f));
 }
}

console.log('files fixed:', fixed);
changed.slice(0, 80).forEach((f) => console.log(' -', f));
if (changed.length > 80) console.log(' ... +' + (changed.length - 80) + ' more');
