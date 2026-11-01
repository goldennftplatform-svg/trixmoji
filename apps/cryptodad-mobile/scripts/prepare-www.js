const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function rmrf(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) rmrf(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(dir);
}

const files = [
  'index.html',
  'manifest.json',
  'sw.js',
  'privacy-policy.html'
];

const dirs = ['icons', 'images'];

rmrf(www);
fs.mkdirSync(www, { recursive: true });

for (const file of files) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) throw new Error('Missing required file: ' + file);
  fs.copyFileSync(src, path.join(www, file));
}

for (const dir of dirs) {
  const src = path.join(root, dir);
  if (!fs.existsSync(src)) throw new Error('Missing required directory: ' + dir);
  copyRecursive(src, path.join(www, dir));
}

console.log('Prepared www/ for Capacitor sync');