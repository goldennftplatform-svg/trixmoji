/**
 * Remove shade/block "stairs" glyphs and mojibake play/stop icons
 * that render as wingdings (e.g.  on present-era pages.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const SKIP = new Set(['node_modules', 'cryptodad-mobile', '.git', 'apps']);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(html|js|css)$/i.test(e.name)) acc.push(p);
  }
  return acc;
}

function clean(text) {
  let t = text;
  // entire stairs decorative blocks
  t = t.replace(/\s*<div class="stairs">[\s\S]*?<\/div>/gi, '');
  // raw shade stacks
  t = t.replace(/{2,}(<br\s*\/?>)?\s*/g, '');
  t = t.replace(/[]+/g, '');
  // mojibake for ▶ ▼ ■     etc (UTF-8 misread as latin1)
  // Patterns:           
  t = t.replace(/<"'`]*/g, '');
  // CSS content: ' '
  t = t.replace(/content:\s*'']*'\s*;?/g, "content: '';");
  t = t.replace(/content:\s*""]*"\s*;?/g, 'content: "";');
  // leftover empty play-prefix spacing on buttons
  t = t.replace(/>\s+([A-Z])/g, '>$1');
  return t;
}

let fixed = 0;
for (const f of walk(root)) {
  const before = fs.readFileSync(f, 'utf8');
  // only touch files that look relevant
  if (
    !before.includes('stairs') &&
    !before.includes('') &&
    !before.includes('') &&
    !before.includes('') &&
    !before.includes('')
  ) {
    continue;
  }
  const after = clean(before);
  if (after !== before) {
    fs.writeFileSync(f, after, 'utf8');
    console.log('fixed', path.relative(root, f));
    fixed += 1;
  }
}
console.log('done, files fixed:', fixed);
