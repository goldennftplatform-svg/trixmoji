/** * Final sitewide purge of leftover mojibake / weird symbols * (, , broken emoji, garbage, etc.)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const SKIP = new Set([
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
 if (SKIP.has(e.name)) continue;
 const p = path.join(dir, e.name);
 const rel = path.relative(root, p).replace(/\\/g, '/');
 if ([...SKIP].some((s) => rel === s || rel.startsWith(s + '/'))) continue;
 if (e.isDirectory()) walk(p, acc);
 else if (/\.(html|js|css|txt|md)$/i.test(e.name)) acc.push(p);
 }
 return acc;
}

function clean(t) {
 // Broken multiply / dash combos from x or —
 t = t.replace(/24\s*\s*-\s*24/g, '24 x 24');
 t = t.replace(/\s*-\s*/g, ' x ');
 t = t.replace(/ x /g, ' x ');
 t = t.replace(/\u00d7/g, ' x ');

 // Middle-dot leftovers became " * " or " * "
 t = t.replace(/\s*\*\s*/g, ' * ');
 t = t.replace(/\s* * \s*/g, ' * ');
 t = t.replace(/\s+/g, ' ');
 t = t.replace(//g, '');
 t = t.replace(//g, '');

 // Broken star/dagger decorations: or junk
 t = t.replace(/\s*-\s*†/g, '');
 t = t.replace(/\s*-\s*\*/g, '');
 t = t.replace(/<"']*/g, '');
 t = t.replace(/<"']*/g, '');
 t = t.replace(/<"']*/g, '');
 t = t.replace(/<"']*/g, '');
 t = t.replace(/<"']*/g, '');
 t = t.replace(/<"']*/g, ''); // emoji mojibake start
 t = t.replace(//g, '');
 t = t.replace(//g, '');

 // Common residual sequences
 t = t.replace(/¢[^\s<"']*/g, '');
 t = t.replace(/ * /g, ' * ');
 t = t.replace(/ * /g, ' * ');

 // Tool button emoji mojibake -> ASCII labels if empty-looking
 t = t.replace(
 /data-tool="pencil"[^>]*>[\s\S]*?<\/button>/,
 'data-tool="pencil" title="Pencil">PEN<\/button>'
 );
 t = t.replace(
 /data-tool="eraser"[^>]*>[\s\S]*?<\/button>/,
 'data-tool="eraser" title="Eraser">ERASE<\/button>'
 );
 t = t.replace(
 /data-tool="fill"[^>]*>[\s\S]*?<\/button>/,
 'data-tool="fill" title="Fill">FILL<\/button>'
 );
 t = t.replace(
 /data-tool="picker"[^>]*>[\s\S]*?<\/button>/,
 'data-tool="picker" title="Eyedropper">PICK<\/button>'
 );

 // Numbered section headers that became "1. TARGET"
 t = t.replace(/(\d+)\s*\*\s*/g, '$1. ');
 t = t.replace(/(\d+)\s*\s*\*\s*/g, '$1. ');

 // Collapse spaced junk
 t = t.replace(/[ \t]{2,}/g, ' ');
 t = t.replace(/ \* \* /g, ' * ');
 t = t.replace(/\s+\*\s+/g, ' * ');

 return t;
}

let fixed = 0;
const changed = [];
for (const f of walk(root)) {
 let before;
 try {
 before = fs.readFileSync(f, 'utf8');
 } catch (e) {
 continue;
 }
 if (!/[ && !before.includes('') && !before.includes('')) {
 // still check for broken patterns
 if (!/\s*-\s*†|24\s*|data-tool="pencil"/.test(before)) continue;
 }
 const after = clean(before);
 if (after !== before) {
 fs.writeFileSync(f, after, 'utf8');
 fixed++;
 changed.push(path.relative(root, f));
 }
}

console.log('files fixed:', fixed);
changed.forEach((f) => console.log(' -', f));

// Verify phunk maker status line
const phunk = path.join(root, 'orbit', 'pages', 'basement', 'phunk-maker.html');
if (fs.existsSync(phunk)) {
 const t = fs.readFileSync(phunk, 'utf8');
 const m = t.match(/ETHEREUM PHUNK[^<\n]{0,40}/);
 const tools = t.match(/data-tool="pencil"[\s\S]{0,80}/);
 console.log('phunk status sample:', m && m[0]);
 console.log('pencil btn sample:', tools && tools[0].replace(/\s+/g, ' ').slice(0, 100));
 console.log('still has weird A', /[]/.test(t));
}
