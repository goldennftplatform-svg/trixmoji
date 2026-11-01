const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', '..', 'orbit', 'pages', 'degen');

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

for (const f of walk(dir)) {
  const t = fs.readFileSync(f, 'utf8');
  const lines = t.split(/\n/);
  const hits = [];
  lines.forEach((l, i) => {
    // non-ascii printable-ish
    if (/[^\x09\x0A\x0D\x20-\x7E]/.test(l)) {
      const odd = [...l].filter((ch) => ch.charCodeAt(0) > 127).map((ch) => ch + ' U+' + ch.charCodeAt(0).toString(16));
      hits.push({ n: i + 1, line: l.trim().slice(0, 140), odd: odd.slice(0, 12) });
    }
  });
  if (hits.length) {
    console.log('\n==', path.relative(path.join(dir, '..', '..'), f));
    hits.slice(0, 40).forEach((h) => {
      console.log(h.n + ':', h.line);
      console.log('   odd:', h.odd.join(', '));
    });
  }
}
