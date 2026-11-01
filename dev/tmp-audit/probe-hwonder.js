const { probeDesk } = require('../../api/lib/daily-watch-probe')
;(async () => {
  const started = Date.now()
  const out = await probeDesk('geoff', 8000)
  const index = out.rows.find((r) => r.id === 'hwonder-index')
  const ev = out.rows.find((r) => r.id === 'gh-hwonder-events')
  const user = out.rows.find((r) => r.id === 'gh-hwonder')
  console.log(JSON.stringify({
    elapsedMs: Date.now() - started,
    hwonderPosts: index && index.hwonder && index.hwonder.count,
    slugs: index && index.hwonder && index.hwonder.posts.map((p) => p.slug),
    newestEvent: ev && ev.github && ev.github.newest,
    newestRepo: user && user.github && user.github.newest,
    downs: out.rows.filter((r) => !r.ok).map((r) => r.id + ' ' + (r.error || r.status))
  }, null, 2))
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
