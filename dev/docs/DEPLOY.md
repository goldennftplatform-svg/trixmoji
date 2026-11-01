# DOSWAPZ - Pre-Launch & Deploy Guide (Busy User Edition)

**Goal**: Get the real retro site live on doswapz.com (replacing the current GoDaddy placeholder) with minimal time from you.

## 1. Local Test (Do This First - 10-20 min)
```powershell
cd "C:\Users\franc\Desktop\DOSWAPZ"
python -m http.server 8000
```
- Open http://localhost:8000
- Click EVERYTHING:
 - Splash entry (mouse + keyboard)
 - Hub navigation (all sections)
 - Crypto Dad game - play several runs (safe vs risky)
 - Mint page - both sides, generate + "mint"
 - Swap page - connect (Phantom) + simulate
 - Scoreboard - post with signature (Phantom)
 - Gallery, how-to-play, meat, etc.
- DevTools: Console clean? All images load? Lighthouse decent?
- Phone test (same WiFi): http://YOUR-PC-IP:8000 (find IP with `ipconfig`)

All main pages + key images already verified 200 in pre-launch probes.

## 2. Choose a Host (pick one)
**Recommended (easiest for static + custom domain + free HTTPS + previews):**
- **Vercel** (git push or drag folder)
- **Netlify** (drag the whole DOSWAPZ folder - works instantly)
- **Cloudflare Pages** (excellent + good DNS control)

Free tiers are more than enough.

## 3. Deploy a Preview (no DNS change yet)
- Sign up / log in (use GitHub if possible for future ease).
- Drag the entire `DOSWAPZ` folder (or connect a repo).
- Get a preview URL like `https://doswapz-abc123.vercel.app` or `https://main--doswapz.netlify.app`.
- Test the preview the same way as localhost (especially mobile + wallet flows).

## 4. DNS Cutover at GoDaddy (the only step that requires your login)
Current reality: doswapz.com points at GoDaddy Website Builder placeholder.

Options (pick one):

**Easiest for most people (Cloudflare route):**
1. Create free Cloudflare account.
2. Add doswapz.com and follow their nameserver change instructions at GoDaddy.
3. In Cloudflare, add a CNAME (or use their "proxied" for apex) pointing to your host (Vercel/Netlify give exact records).
4. Turn on "Always Use HTTPS" and "SSL/TLS Full".

**Direct at GoDaddy (no Cloudflare):**
1. Log into GoDaddy -> My Products -> DNS for doswapz.com.
2. Delete or edit existing A/AAAA/CNAME records that point to GoDaddy builder.
3. Add the records your host provides:
 - Usually an A record for @ (apex) + CNAME for www.
 - Vercel/Netlify will show the exact values after you add the custom domain in their dashboard.
4. Once DNS propagates (check with `nslookup doswapz.com` or whatsmy dns.net), the custom site will appear.
5. In GoDaddy Website Builder settings, turn off / delete the placeholder site (otherwise it can conflict).

**After cutover:**
- Visit https://doswapz.com and https://www.doswapz.com (set up redirect at host if needed).
- Confirm padlock (HTTPS).
- Re-test a couple pages + wallet flows from real domain.
- The old "Swap, Shop, Sustain" placeholder should be gone.

## 5. Post-Launch (optional, low priority)
- Add a real OG image (share card) - replace the placeholder in meta.
- Add lightweight analytics (Plausible or GA4) if you want numbers.
- Set up a contact form (Netlify Forms or Formspree) if the current donate pages aren't enough.
- Compress large JPGs in images/ if you notice slow loads.
- Git init + push to GitHub (highly recommended for future updates):
 ```powershell
 # install Git for Windows first if missing
 git init
 git add .
 git commit -m "initial production static site"
 git remote add origin https://github.com/YOUR/doswapz.git
 git push -u origin main
 ```

## Quick Commands (copy-paste)
Local test:
```powershell
cd "C:\Users\franc\Desktop\DOSWAPZ"; python -m http.server 8000
```

Check current DNS (PowerShell):
```powershell
Resolve-DnsName doswapz.com
```

Force a quick local full probe (from project dir):
```powershell
python -c "
import http.server,socketserver,threading,time,urllib.request
PORT=8765
with socketserver.TCPServer(('',PORT),http.server.SimpleHTTPRequestHandler) as h:
 t=threading.Thread(target=h.serve_forever);t.daemon=True;t.start();time.sleep(0.7)
 for p in ['/','/classic/hub.html','/doswapz-mint.html','/GrokBuild_cryptoDad_v1.html','/images/cryptodad/family_high.jpg']:
 try: print(p, urllib.request.urlopen(f'http://localhost:{PORT}{p}',timeout=5).getcode())
 except Exception as e: print(p,'ERR',e)
 h.shutdown()
"
```

## Tonight - Live Mint Launch Checklist
1. Deploy from `C:\Users\franc\Desktop\DOSWAPZ` (Vercel/Netlify drag-drop or `vercel --prod` / `netlify deploy --prod`).
2. Run `node scripts/test-mint-page.mjs` - all checks must pass before deploy.
3. After deploy, open `https://doswapz.com/doswapz-mint.html` and confirm:
 - Badge says **LIVE** (not UNDISCLOSED / COMING SOON)
 - CONNECT / MINT buttons visible
 - No blurred undisclosed overlay
4. Test with a burner wallet on **Ethereum Mainnet**: connect -> mint 1 -> wait for confirm -> wallet auto-disconnects -> reconnect to mint again.
5. Verify ETH lands at `0x5be58476DF379BAdc88b552F603db227C0D95bac` on Etherscan.

**Critical:** Production was still serving the old undisclosed mint build as of last check. You must redeploy tonight for live mint to go public.

## What This Site Actually Is
Live platform (static frontend with real on-chain actions where implemented).
- Crypto Dad game = validated mechanics, live experience.
- Swap = live 0% Jupiter-powered when real Solana wallet connected (real tx possible).
- Math mint = live on Ethereum when real ETH wallet connected (real tx sent). Wallet auto-disconnects after each confirmed mint. Mint funds recipient: `0x5be58476DF379BAdc88b552F603db227C0D95bac` (see `js/doswapz-mint-config.js`).
- Mobile app = Coming Soon page only (playable web build removed; desktop game remains).
- Scoreboard = signature-only live feature; empty table until player opts to soft-sign.
- Strong risk disclaimers ("never risk more than you can afford to lose", "do your own research", "DOSWAPZ accepts NO responsibility") are present on all pages.

This is a live artistic/crypto-themed platform. Users can execute real transactions. Always emphasize personal responsibility.

## Support
If anything breaks in local test or preview, note the exact page + error (console screenshot or text) and send it. I can patch the static files directly.

Good luck - the site looks and feels special. Once DNS flips it will be a strong launch.
