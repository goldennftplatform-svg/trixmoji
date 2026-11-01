DOSWAPZ - Game Logic Restored to Validated Version

The Crypto Dad game (pages/cryptodad/play.html) has been restored to the same logic that was tested with 500,000+ Monte Carlo simulations per strategy.

Crypto Mom (pages/basement/cryptomom/play.html) - Basement [18+] - validated with 500,000 sims per strategy.
See dev/docs/CRYPTOMOM_SIM.txt and dev/sim/simulate_cryptomom.py.

Key behaviors from the simulations:
- Safe choices (Family Time, legal hustles) stabilize or improve Family and keep Heat low.
- Risky/illegal actions significantly increase Heat.
- High Heat leads to police events, family damage, divorce, and foreclosure.
- The game is player-driven: consistent safe play succeeds; dangerous play leads to bad endings.

Both sets of images are included:
- Colorful versions (used in the simulated version): images/cryptodad_colorful/
- Green CRT placeholders: images/cryptodad/

The landing page now links directly to the game (original flow).

All pages use DOSWAPZ branding and doswapz.com.

Copy this entire folder to your local C:\Users\franc\OneDrive\Desktop\DOSWAPZ

=== PRODUCTION NOTES (added pre-launch) ===
- Pure static site. No build step required.
- Deploy the whole folder as-is to Vercel / Netlify / Cloudflare Pages.
- See DEPLOY.md for exact steps (local test, preview deploy, GoDaddy DNS cutover).
- Live platform. Real wallet connects and on-chain actions on swap (Jupiter) and math mint (Ethereum). Strong risk disclaimers on all pages.
- Current live domain points to GoDaddy Website Builder placeholder - DNS change will replace it.
- Local verification: all main pages + key images return 200 when served statically.
- Created: robots.txt, sitemap.xml, 404.html (themed), vercel.json, netlify.toml, site.webmanifest, .nojekyll
