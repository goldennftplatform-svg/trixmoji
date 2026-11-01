;(async () => {
  console.log('AT', new Date().toISOString())
  const r = await fetch('https://doswapz.com/api/trix-boxes?meters=1', { cache: 'no-store' })
  const j = await r.json()
  console.log('API', r.status)
  console.log(JSON.stringify({
    updatedAt: j.updatedAt,
    minted: j.mintedTotal,
    posted: j.public && j.public.memesPosted,
    launches: j.public && j.public.launches,
    live: j.public && j.public.live
  }, null, 2))
  const js = await fetch('https://doswapz.com/assets/js/trix-boxes.js?v=20260919meters2', { cache: 'no-store' })
  const t = await js.text()
  console.log('JS', js.status, 'hasMeters1', t.includes('meters=1'), 'hasPostedKpi', t.includes('MEMES POSTED'))
  const html = await (await fetch('https://doswapz.com/classic/pages/geoffwatch-box.html', { cache: 'no-store' })).text()
  console.log('HTML meters2', html.includes('20260919meters2'))
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
