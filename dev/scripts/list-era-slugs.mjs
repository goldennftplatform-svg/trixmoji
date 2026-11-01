import fs from 'fs';
import path from 'path';

const root = path.resolve('C:/Users/franc/Desktop/DOSWAPZ');

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.isFile() && ent.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

function rels(base) {
  const files = walk(path.join(root, base));
  return files.map((f) => path.relative(path.join(root, base), f).split(path.sep).join('/'));
}

function slug(rel) {
  return rel.replace(/\/index\.html$/i, '').replace(/\.html$/i, '').replace(/\/$/, '');
}

const classic = rels('classic/pages');
const orbit = rels('orbit/pages');
console.log('CLASSIC', classic.length);
for (const r of classic) console.log('C\t' + slug(r) + '\t' + r);
console.log('ORBIT', orbit.length);
for (const r of orbit) console.log('O\t' + slug(r) + '\t' + r);
