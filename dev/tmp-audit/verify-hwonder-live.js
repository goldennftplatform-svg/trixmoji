;(async () => {
  console.log('AT', new Date().toISOString())
  const r = await fetch('https://doswapz.com/api/daily-watch?desk=geoff', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: '{}'
  })
  const j = await r.json()
  const d = j.desk || {}
  const hw = d.hwonder || {}
  console.log('HTTP', r.status, 'ok', j.ok)
  console.log(JSON.stringify({
    postCount: hw.postCount,
    slugs: (hw.posts || []).map((p) => p.slug),
    newestEvent: hw.newestEvent,
    newestRepo: hw.newestRepo,
    notices: (d.notices || []).slice(0, 5)
  }, null, 2))
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
