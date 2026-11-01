# DEGEN KOL FIGHTER '85 - Image Assets

Two separate asset sets:

1. **Playable character sprites** - standalone labeled JPGs (your Downloads files)
2. **Fight screen backgrounds** - full-stage reference art (no character cropping)

## Playable characters (`characters/`)

Each fighter is its own labeled reference image, copied from Downloads:

| Project file | Source (Downloads) | Role |
|--------------|-------------------|------|
| `characters/degen.jpg` | `DEGEN.jpg` | **Player** (always left) |
| `characters/donalt.jpg` | `DON ALT.jpg` | Ladder opponent |
| `characters/roger-ver.jpg` | `ROGER VER.jpg` | Ladder opponent |
| `characters/ansem.jpg` | `ANSEM.jpg` | Ladder opponent |
| `characters/michael-saylor.jpg` | `MICHAELSAYLOR.jpg` | Ladder opponent |
| `characters/vitalik-buterin.jpg` | `VITALIK BUTERIN.jpg` | Ladder opponent |
| `characters/jason-williams.jpg` | `JASON WILLIAMS.jpg` | Ladder opponent |
| `characters/bitboy.jpg` | `BITBOY.jpg` | Ladder opponent |
| `characters/crypto-bitlord.jpg` | `CRYPTO BITLORD.jpg` | Ladder opponent |
| `characters/dogedesigner.jpg` | `DOGEDESIGNER.jpg` | Ladder opponent |
| `characters/jimmy-edgar.jpg` | `JIMMY EDGAR.jpg` | Ladder opponent |
| `characters/pauly0x.jpg` | `PAULY0X.jpg` | **Boss** |

Loaded at runtime by `kol-fighter-sprites.js`. White/checkerboard JPG backgrounds are stripped on load so sprites composite cleanly over fight screens.

## Fight screen backgrounds (`screens/`)

Full-stage art only - used as arena backdrops behind the labeled sprites.

| File | Fighter stage | Notes |
|------|---------------|-------|
| `screens/title.jpg` | Title screen | DEGEN KOL FIGHTER - chart arc BG |
| `screens/donalt.jpg` | DonAlt | Stock-chart arena |
| `screens/roger-ver.jpg` | Roger Ver | Ruined city, Bitcoin flag |
| `screens/michael-saylor.jpg` | Michael Saylor | Mountain dusk, ₿ center |
| `screens/vitalik-buterin.jpg` | Vitalik Buterin | ETH diamond geometry |
| `screens/jason-williams.jpg` | Jason Williams | Control room |
| `screens/bitboy.jpg` | BitBoy | Crypto burst BG |
| `screens/crypto-bitlord.jpg` | Crypto Bitlord | Palace columns |
| `screens/dogedesigner.jpg` | DogeDesigner | Floating coin icons |
| `screens/jimmy-edgar.jpg` | Jimmy Edgar | Circuit-board split |
| `screens/pauly0x.jpg` | Pauly0x (boss) | Taco RV / Pond0x desert |

### Missing background

| Fighter | Status |
|---------|--------|
| Ansem | No fight-screen background yet - game falls back to procedural moon stage |

## Game path

`classic/pages/degen/kol-fighter.html`