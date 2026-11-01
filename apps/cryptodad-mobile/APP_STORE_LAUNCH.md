# Crypto Dad Mobile — Google Play & App Store Launch Guide

**Status:** Web app is store-ready after bug fixes. Native wrappers still need to be built on your machine (one-time setup).

## What is ready now
- Public site shows **Coming Soon** at `cryptodad-mobile-app.html` (playable mobile web removed)
- Hub link: **CRYPTO DAD → Mobile App** → Coming Soon page
- `/cryptodad-mobile/*` redirects to Coming Soon (Netlify + Vercel)
- Privacy policy: `cryptodad-mobile/privacy-policy.html` (required by both stores)
- App icons: `icons/icon-192.png`, `icons/icon-512.png`
- PWA manifest + service worker (offline shell)
- Bug fixes: image paths, secret pixel, `sleep()` crash

## What you need (accounts + tools)
| Item | Google Play | Apple App Store |
|------|-------------|-----------------|
| Developer account | $25 one-time | $99/year |
| Build machine | Windows OK (Android Studio) | **Mac required** for iOS archive |
| Node.js LTS | Yes | Yes |
| Android Studio | Yes | — |
| Xcode | — | Yes (Mac only) |

## Step 1 — Local test (10 min)
```powershell
cd "C:\Users\franc\Desktop\DOSWAPZ"
python -m http.server 8000
```
Open http://localhost:8000/cryptodad-mobile-app.html — should show Coming Soon (Google Play + App Store).

**Smoke test checklist:**
- [ ] Coming Soon page loads from hub **CRYPTO DAD → Mobile App**
- [ ] `/cryptodad-mobile/` redirects to Coming Soon (not playable web game)
- [ ] Full desktop game still works at `GrokBuild_cryptoDad_v1.html`
- [ ] Privacy link opens when native wrapper is built

## Step 2 — Run automated tests
```powershell
cd "C:\Users\franc\Desktop\DOSWAPZ\cryptodad-mobile"
python test_mobile_game.py
```
Should print `PASSED` (assets + 1000 logic simulations).

## Step 3 — Install Capacitor wrapper
From `cryptodad-mobile` folder:
```powershell
npm install
npm run prepare:www
npx cap add android
# iOS (Mac only):
# npx cap add ios
npm run cap:sync
```
`prepare:www` copies only web assets into `www/` (keeps `node_modules` out of the app bundle).

## Step 4 — Android (Google Play)
1. Open Android Studio: `npx cap open android`
2. Build → Generate Signed Bundle (AAB)
3. Play Console → Create app → **Games** category
4. Required listings:
   - Short description: *Keep Family high. Keep Heat low. Survive the bunker life.*
   - Full description: mention simulation, mature themes, no real money
   - Privacy policy URL: `https://doswapz.com/cryptodad-mobile/privacy-policy.html`
   - Content rating questionnaire (likely Teen due to crime/simulated stress themes)
   - Screenshots: phone 1080×1920 (min 2)
   - Feature graphic: 1024×500
   - App icon: use `icons/icon-512.png`
5. Upload AAB → Internal testing → Production

## Step 5 — iOS (App Store)
**Requires a Mac with Xcode.**
1. `npx cap open ios` on Mac
2. Set bundle ID: `com.doswapz.cryptodad`
3. Signing & Capabilities → your Apple Developer team
4. Archive → Distribute to App Store Connect
5. App Store Connect:
   - Privacy policy URL (same as above)
   - Age rating: likely 12+ or 17+ (crime / stress simulation)
   - Screenshots per device size (6.7", 6.5", 5.5" if supporting older phones)
   - Review notes: *Single-player offline simulation. No IAP, no accounts, no wallet.*

## Store listing copy (starter)
**Subtitle:** Keep Family high. Keep Heat low.  
**Keywords:** simulation, retro, pixel, strategy, family, survival  
**Category:** Games → Simulation  

**Disclaimer line for description:**  
*Fictional life simulation. Not financial or life advice. Mature themes including crime and consequences.*

## Deploy privacy policy to production
Before submitting, host the mobile folder on doswapz.com so the privacy URL is live:
- `https://doswapz.com/cryptodad-mobile/privacy-policy.html`

Deploy the whole `DOSWAPZ` folder (same as main site) — the mobile app is a subfolder.

## Mobile vs desktop game
The mobile build is a **streamlined** version of Crypto Dad:
- Core weekly loop: Trade, Hustle, Family, Bank, Store, Lay Low
- Secret pixel + Toasty easter egg
- Simplified trade/hustle math (faster sessions)

The full desktop game remains at `GrokBuild_cryptoDad_v1.html`.

## Optional before launch
- [ ] Store screenshots from a real phone
- [ ] Custom 1024×500 feature graphic (Play Store)
- [ ] Support email in Play Console / App Store Connect
- [ ] Version bump in `package.json` for updates

## If review asks about gambling/crypto
State clearly: **No real cryptocurrency, no wallet, no IAP, no gambling mechanics.** In-game dollars are fictional simulation stats only.