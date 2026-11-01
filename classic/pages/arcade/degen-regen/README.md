# DEGEN REGEN

HTML5 regenerative farming simulator (FarmVille-style loop + real regen mechanics).

## Why HTML5 (not Godot binary in-repo)
- Web-export friendly for Netlify / DOSWAPZ Arcade
- No Godot editor required to play or deploy
- Same architecture maps cleanly to Godot later:
  - `data/crops.js` → Resource / JSON
  - `js/game.js` → Main + Farm + Soil systems
  - tile array → TileMap + custom data layers

## Architecture
```
degen-regen/
  index.html          # shell + overlays
  css/style.css       # retro UI
  data/crops.js       # crops, tools, events, tips
  js/game.js          # state, sim, render, save
```

## Core systems
1. **Grid farm** — tiles with soil health, crop, growth, mulch, rotation history  
2. **Crops** — cash vs cover; multi-stage growth; harvest economy  
3. **Soil** — degrades with till/bare/monocrop; rebuilds with cover/compost/no-till  
4. **Livestock** — chickens (pests/manure), sheep (graze + wool), cattle (pasture carbon); overgraze if herd >> covers  
5. **Events** — pests, drought, erosion, regen rain, carbon grants, livestock boom  
6. **Progression** — XP unlocks tools, livestock, expansion, cert  

## Play
Open `/classic/pages/arcade/degen-regen/` on the site or via local server.

## Godot port notes
- One TileMap layer for soil visual (4 atlas variants by soil band)
- Crop scenes or animated sprites per stage
- Autoload `FarmData` from the same crop catalog
- `FileAccess` save mirrors `localStorage` schema in `SAVE_KEY`
