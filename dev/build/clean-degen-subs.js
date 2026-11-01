const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', '..', 'orbit', 'pages', 'degen');

for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith('.html')) continue;
  const f = path.join(dir, name);
  let t = fs.readFileSync(f, 'utf8');
  const before = t;
  // simplify stage sub: drop leading "degen$ - " / "degen - " prefixes
  t = t.replace(
    /id="stageSub">degen\$?\s*-\s*/gi,
    'id="stageSub">'
  );
  t = t.replace(
    /id="stageSub">kol fighter\s*-\s*/gi,
    'id="stageSub">'
  );
  if (t !== before) {
    fs.writeFileSync(f, t);
    console.log('sub cleaned', name);
  }
}
console.log('done');
