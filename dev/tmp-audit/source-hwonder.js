const fs = require('fs')
;(async () => {
  const r = await fetch('https://www.hwonder.com/', {
    headers: { 'User-Agent': 'DoswapzWatch/1.0' }
  })
  const t = await r.text()
  fs.writeFileSync('dev/tmp-audit/hwonder-home.html', t)
  const hrefs = [...t.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
  console.log('bytes', t.length)
  console.log('hrefs')
  ;[...new Set(hrefs)].forEach((h) => console.log(h))
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
