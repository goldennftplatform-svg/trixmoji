DOSWAPZ v2 - Time Machine + Orbit Renovation
=============================================

FOLDER LAYOUT
-------------
 index.html, portal.html, 404.html entry points (root)

 classic/ PAST era (original DOSWAPZ)
 hub.html
 pages/

 orbit/ ORBIT era (renovated void skin)
 hub.html
 pages/

 assets/ shared CSS, JS, images, data
 api/ serverless endpoints
 apps/cryptodad-mobile/ Capacitor mobile app
 dev/
 build/ orbit rebuild scripts
 scripts/ tests + local server
 docs/ notes
 sim/ cryptodad/cryptomom sims

TWO COMPLETE SITES (not CSS overlays)

 PAST (default) classic/pages/ classic/hub.html
 ORBIT (renovated) orbit/pages/ orbit/hub.html

 LEFT ALONE (classic in both eras):
 classic/pages/cryptodad/*
 classic/pages/basement/cryptomom/*

USER FLOW
---------
 1. index.html -> classic boot -> classic/hub.html
 2. Hub has TIME MACHINE link -> portal.html
 3. Portal split screen: PAST | ORBIT
 4. Pick the OTHER timeline -> glitch travel -> new hub
 5. Orbit hub + orbit/pages/* for renovated experience

PREVIEW (do NOT double-click HTML files - use HTTP)
---------------------------------------------------
 Double-click START-SITE.bat (or Desktop START-DOSWAPZ.bat)
 - or - 
 cd C:\Users\franc\Desktop\DOSWAPZ
 node start-site-server.js

 That server serves static pages AND all /api/* handlers.

 Classic hub: http://127.0.0.1:8890/classic/hub.html
 Portal: http://127.0.0.1:8890/portal.html
 Orbit hub: http://127.0.0.1:8890/orbit/hub.html
 Harbinger: http://127.0.0.1:8890/classic/pages/harbinger.html

 Optional env (local .env or Netlify site env):
 XAI_API_KEY Harbinger LLM
 HARBINGER_ALLOWED_ORIGINS CORS allowlist for chat API
 KV_REST_API_URL / TOKEN attic + swap counters
 SOLANA_RPC_URL / HELIUS_API_KEY better RPC

REBUILD ORBIT PAGES (after classic page edits)
----------------------------------------------
 powershell -ExecutionPolicy Bypass -File .\dev\build\build-orbit-pages.ps1
 powershell -ExecutionPolicy Bypass -File .\dev\build\build-hub-orbit.ps1

 build-orbit-pages.ps1 applies the void theme (orbit-void-content.css overrides)
 and rewrites links. cryptodad + cryptomom stay on classic/pages.

LEGACY URLS (deploy redirects)
------------------------------
 /hub.html -> /classic/hub.html
 /hub-orbit.html -> /orbit/hub.html
 /pages/* -> /classic/pages/*
 /pages-orbit/* -> /orbit/pages/*

NETLIFY DEPLOY (IMPORTANT)
--------------------------
 DO NOT use drag-and-drop - the site is ~460MB (images) and exceeds
 Netlify's 25MB manual upload limit. That is likely why you saw
 "access denied" / "doesn't fit structure".

 Use Git + Netlify (recommended):
 1. Push the DOSWAPZ folder to a GitHub repo
 2. Netlify -> Add new site -> Import from Git
 3. Settings (auto-read from netlify.toml):
 Build command: npm install --omit=dev
 Publish dir: .
 Functions dir: netlify/functions
 4. Deploy - then test:
 https://YOUR-SITE.netlify.app/
 https://YOUR-SITE.netlify.app/orbit/hub.html
 https://YOUR-SITE.netlify.app/portal.html

 Or Netlify CLI (from DOSWAPZ folder):
 npm install -g netlify-cli
 netlify login
 netlify deploy --prod

 Optional env vars (for live counters / attic posts via KV):
 KV_REST_API_URL
 KV_REST_API_TOKEN
 Without these, pages still work using bundled JSON fallbacks.

 Before you deploy, run:
 node dev/scripts/test-netlify-ready.mjs
 (must print "All Netlify readiness checks passed")

 Fixed in this version:
 - netlify.toml was corrupted (duplicate redirects) - now clean
 - .netlifyignore excludes dev/, apps/, scripts from deploy
 - API routes wired to netlify/functions/ (fixes /api/swap-stats 404)
 - KOL Fighter shelved (~394MB) - excluded from deploy, hub link removed
 - Deploy size ~65MB assets (was ~460MB with KOL images)

BACKUP
------
 See previous-versions/ for older full copies