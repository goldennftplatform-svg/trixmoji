# JIMPTHY — Open World Prototype

GTA-style third-person open neighborhood with a high-detail raccoon (Jimpthy) and yellow backpack.

**Reference images = art direction only.** They are never used as in-game textures or backgrounds.

## Run

```bash
cd classic/pages/arcade/jimothy
python -m http.server 8765
```

Open: **http://127.0.0.1:8765/**  
Hard-refresh: `Ctrl+F5`

## Controls (GTA-like)

| Input | Action |
|--------|--------|
| **Click** canvas | Lock mouse |
| **Mouse** | Orbit camera 360° |
| **Scroll** | Zoom |
| **WASD** | Move (relative to camera) |
| **Shift** | Run |
| **Space** | Jump |
| **E** | Collect / interact |
| **V** | VHS filter |
| **Esc** | Pause |

## Project layout

```
jimothy/
  index.html
  README.md
  css/style.css
  js/
    main.js      — boot + loop
    world.js     — open neighborhood (3×3 blocks, cars, props)
    player.js    — movement, jump, sprite animation
    camera.js    — free orbit third-person cam
    input.js     — keyboard + pointer lock
    vhs.js       — glitch overlay
    audio.js     — SFX/music slots
  assets/
    jimothy/     — character frames (front/side/back/walk/jump)
    audio/       — drop music_loop.mp3, sfx_*.wav
    ref/         — style refs only (not rendered)
```

## Features

- Multi-block open streets & alleys
- Fixed golden-hour sun, long dynamic shadows
- Green muscle cars, graffiti brick buildings, poles, litter
- Dust atmosphere + sun glow
- Collectible balls/cubes scattered around the map
- Character billboard uses high-detail raccoon art (backpack bounce on move)

## Audio placeholders

Put files in `assets/audio/`: `music_loop.mp3`, `sfx_jump.wav`, `sfx_land.wav`, `sfx_eat.wav`, `sfx_hurt.wav`, `sfx_ui.wav`

## Not live

Local only until you greenlight a deploy.
