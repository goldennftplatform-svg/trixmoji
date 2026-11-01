from pathlib import Path

OUT = Path(__file__).resolve().parent

def page(title, badge, desc, root, bg, nav, filename):
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>DOSWAPZ // PRESENT · {title}</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root {{
{root}
  --r-md: 22px; --r-lg: 28px; --pill: 999px;
}}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{
  min-height: 100%;
  background: {bg};
  color: var(--text);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}}
body {{ padding: 28px 18px 100px; }}
.top {{ max-width: 980px; margin: 0 auto 18px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }}
.badge {{ display: inline-flex; gap: 8px; padding: 8px 14px; border-radius: var(--pill); border: 1px solid var(--line); background: var(--glass); font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--dim); }}
.badge b {{ color: var(--accent); font-weight: 600; }}
.crumbs {{ display: flex; flex-wrap: wrap; gap: 8px; }}
.crumbs a {{ text-decoration: none; color: var(--dim); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; border: 1px solid var(--line); background: var(--glass); border-radius: var(--pill); padding: 8px 12px; }}
.crumbs a:hover {{ color: #fff; border-color: var(--line-hot); }}
.crumbs a.hot {{ color: var(--accent2); border-color: color-mix(in srgb, var(--accent2) 45%, transparent); }}
.hero {{ max-width: 980px; margin: 0 auto 22px; text-align: center; }}
.hero h1 {{
  font-family: 'Space Grotesk', system-ui, sans-serif; font-weight: 600;
  font-size: clamp(32px, 6.5vw, 52px); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 10px;
  background: linear-gradient(120deg, var(--text) 0%, var(--accent) 45%, var(--accent2) 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}}
.hero p {{ max-width: 540px; margin: 0 auto; color: var(--dim); font-size: 14px; line-height: 1.55; }}
.swatches {{ max-width: 980px; margin: 0 auto 22px; display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }}
.swatch {{ width: 70px; text-align: center; }}
.swatch i {{ display: block; width: 46px; height: 46px; margin: 0 auto 6px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.12); box-shadow: 0 6px 16px rgba(0,0,0,0.35); }}
.swatch span {{ font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); }}
.grid {{ max-width: 980px; margin: 0 auto; display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 18px; }}
@media (max-width: 820px) {{ .grid {{ grid-template-columns: 1fr; }} }}
.panel {{
  border-radius: var(--r-lg); border: 1px solid var(--line);
  background: var(--panel-bg);
  box-shadow: 0 14px 44px var(--shadow), 0 0 0 1px rgba(255,255,255,0.04) inset;
  backdrop-filter: blur(18px) saturate(1.2); padding: 22px;
}}
.panel h2 {{ font-family: 'Space Grotesk', system-ui, sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); margin-bottom: 16px; }}
.soft-card {{ border-radius: var(--r-md); border: 1px solid color-mix(in srgb, var(--line) 70%, transparent); background: rgba(0,0,0,0.22); padding: 16px; margin-bottom: 12px; }}
.soft-card .lab {{ font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim); margin-bottom: 8px; }}
.soft-card .val {{ font-family: 'Space Grotesk', system-ui, sans-serif; font-size: 22px; color: #fff; }}
.field {{ display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }}
.field label {{ font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim); }}
.field input, .field select {{ width: 100%; border: 1px solid var(--line); background: rgba(0,0,0,0.28); color: var(--text); border-radius: var(--r-md); padding: 12px 16px; font: inherit; outline: none; }}
.field input:focus, .field select:focus {{ border-color: var(--line-hot); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }}
.row {{ display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; }}
.btn {{ appearance: none; border: 1px solid var(--line); background: var(--glass); color: var(--text); border-radius: var(--pill); padding: 11px 18px; font: inherit; font-size: 12px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(0,0,0,0.28); }}
.btn:hover {{ border-color: var(--line-hot); color: #fff; }}
.btn.primary {{ background: var(--btn-primary); border-color: color-mix(in srgb, var(--accent2) 50%, transparent); color: #fff; }}
.btn.ghost {{ background: transparent; }}
.pills {{ display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }}
.pill {{ border-radius: var(--pill); border: 1px solid var(--line); padding: 6px 12px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); background: rgba(0,0,0,0.2); }}
.pill.on {{ color: var(--accent2); border-color: color-mix(in srgb, var(--accent2) 45%, transparent); }}
.orb-row {{ display: flex; gap: 14px; flex-wrap: wrap; margin-top: 14px; }}
.orb {{ width: 64px; height: 64px; border-radius: 50%; border: 2px solid currentColor; display: flex; align-items: center; justify-content: center; font-family: 'Space Grotesk', system-ui, sans-serif; font-weight: 600; font-size: 14px; box-shadow: 0 0 20px color-mix(in srgb, currentColor 40%, transparent); background: rgba(0,0,0,0.28); }}
.foot {{ max-width: 980px; margin: 28px auto 0; text-align: center; color: var(--dim); font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; }}
.foot a {{ color: var(--accent); }}
.navp {{ max-width: 980px; margin: 18px auto 0; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }}
.navp a {{ font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); text-decoration: none; border: 1px solid var(--line); border-radius: var(--pill); padding: 6px 10px; }}
</style>
</head>
<body>
  <div class="top">
    <div class="badge"><b>{badge}</b> soft · sample</div>
    <nav class="crumbs">
      <a href="/orbit/hub.html">Present hub</a>
      <a class="hot" href="present-palette-index.html">All palettes</a>
      <a href="/classic/hub.html">Past CRT</a>
    </nav>
  </div>
  <header class="hero">
    <h1>{title}</h1>
    <p>{desc}</p>
  </header>
  <div class="swatches">
    <div class="swatch"><i style="background:var(--void)"></i><span>Void</span></div>
    <div class="swatch"><i style="background:var(--accent)"></i><span>Accent</span></div>
    <div class="swatch"><i style="background:var(--accent2)"></i><span>Accent 2</span></div>
    <div class="swatch"><i style="background:var(--accent3)"></i><span>Accent 3</span></div>
    <div class="swatch"><i style="background:var(--mint)"></i><span>Cool</span></div>
    <div class="swatch"><i style="background:var(--text)"></i><span>Text</span></div>
  </div>
  <div class="grid">
    <section class="panel">
      <h2>Swap-style panel</h2>
      <div class="pills"><span class="pill on">Live</span><span class="pill">0% fee</span><span class="pill">Soft UI</span></div>
      <div class="field"><label>From</label><select><option>SOL</option><option>USDC</option></select></div>
      <div class="field"><label>Amount</label><input value="1.25"></div>
      <div class="field"><label>To mint</label><input placeholder="Paste mint"></div>
      <div class="row">
        <button class="btn primary" type="button">Connect · Swap</button>
        <button class="btn" type="button">Disconnect</button>
        <button class="btn ghost" type="button">Docs</button>
      </div>
    </section>
    <aside class="panel">
      <h2>Stats cards</h2>
      <div class="soft-card"><div class="lab">Total swaps</div><div class="val">12,480</div></div>
      <div class="soft-card"><div class="lab">Volume 24h</div><div class="val">$84.2k</div></div>
      <div class="soft-card"><div class="lab">Palette</div><div class="val" style="font-size:15px;color:var(--accent)">{title}</div></div>
      <div class="orb-row">
        <div class="orb" style="color:var(--accent)">A</div>
        <div class="orb" style="color:var(--accent2)">S</div>
        <div class="orb" style="color:var(--accent3)">V</div>
        <div class="orb" style="color:var(--mint)">T</div>
      </div>
    </aside>
  </div>
  <nav class="navp">{nav}</nav>
  <p class="foot">Local sample · pick a palette · <a href="present-palette-index.html">index</a></p>
</body>
</html>
"""
    (OUT / filename).write_text(html, encoding="utf-8")
    print("wrote", filename)

palettes = [
    dict(
        file="present-palette-void-dusk.html",
        title="Void Dusk",
        badge="VOID DUSK",
        desc="Plum void, orchid primary, warm amber CTAs. Soft night luxury.",
        root="""
  --void: #09070f;
  --line: rgba(196, 170, 255, 0.22); --line-hot: rgba(255, 184, 120, 0.55);
  --accent: #c9a8ff; --accent2: #ffb87a; --accent3: #ff9ec8; --mint: #8ef0d0;
  --text: rgba(248, 244, 255, 0.94); --dim: rgba(186, 176, 210, 0.68);
  --glass: rgba(22, 16, 36, 0.72);
  --panel-bg: linear-gradient(160deg, rgba(56, 40, 88, 0.42), rgba(22, 14, 36, 0.85) 55%, rgba(10, 8, 18, 0.94));
  --shadow: rgba(60, 20, 100, 0.32);
  --btn-primary: linear-gradient(135deg, rgba(170, 110, 255, 0.45), rgba(255, 140, 100, 0.32));
""",
        bg="radial-gradient(ellipse at 50% -5%, rgba(160, 100, 255, 0.18), transparent 45%), radial-gradient(ellipse at 100% 40%, rgba(255, 140, 100, 0.08), transparent 42%), linear-gradient(180deg, #120e1c, #09070f)",
        dots=["#09070f", "#c9a8ff", "#ffb87a", "#ff9ec8"],
    ),
    dict(
        file="present-palette-arctic.html",
        title="Arctic Ice",
        badge="ARCTIC ICE",
        desc="Cold slate void, ice blue, frost mint. Clean modern Present.",
        root="""
  --void: #060a10;
  --line: rgba(140, 200, 255, 0.22); --line-hot: rgba(160, 255, 240, 0.5);
  --accent: #7ecbff; --accent2: #7dffe8; --accent3: #a8c4ff; --mint: #b8fff0;
  --text: rgba(236, 246, 255, 0.94); --dim: rgba(150, 180, 210, 0.7);
  --glass: rgba(12, 22, 36, 0.72);
  --panel-bg: linear-gradient(160deg, rgba(30, 50, 80, 0.45), rgba(10, 18, 32, 0.88) 55%, rgba(6, 10, 18, 0.94));
  --shadow: rgba(20, 60, 120, 0.3);
  --btn-primary: linear-gradient(135deg, rgba(80, 170, 255, 0.4), rgba(60, 230, 200, 0.28));
""",
        bg="radial-gradient(ellipse at 50% 0%, rgba(80, 160, 255, 0.16), transparent 44%), radial-gradient(ellipse at 90% 70%, rgba(60, 255, 220, 0.07), transparent 40%), linear-gradient(180deg, #0a121c, #060a10)",
        dots=["#060a10", "#7ecbff", "#7dffe8", "#a8c4ff"],
    ),
    dict(
        file="present-palette-ember.html",
        title="Ember Night",
        badge="EMBER NIGHT",
        desc="Charcoal void, ember orange, gold heat. Warm Present.",
        root="""
  --void: #0c0806;
  --line: rgba(255, 160, 100, 0.22); --line-hot: rgba(255, 210, 120, 0.55);
  --accent: #ff9a5c; --accent2: #ffd27a; --accent3: #ff7a8a; --mint: #ffc9a0;
  --text: rgba(255, 246, 238, 0.94); --dim: rgba(210, 180, 160, 0.7);
  --glass: rgba(28, 16, 12, 0.75);
  --panel-bg: linear-gradient(160deg, rgba(80, 40, 24, 0.45), rgba(28, 14, 10, 0.9) 55%, rgba(10, 6, 4, 0.95));
  --shadow: rgba(100, 30, 10, 0.35);
  --btn-primary: linear-gradient(135deg, rgba(255, 120, 60, 0.45), rgba(255, 190, 80, 0.3));
""",
        bg="radial-gradient(ellipse at 40% 0%, rgba(255, 100, 40, 0.16), transparent 44%), radial-gradient(ellipse at 100% 60%, rgba(255, 180, 60, 0.08), transparent 40%), linear-gradient(180deg, #16100c, #0c0806)",
        dots=["#0c0806", "#ff9a5c", "#ffd27a", "#ff7a8a"],
    ),
    dict(
        file="present-palette-jade.html",
        title="Jade Hollow",
        badge="JADE HOLLOW",
        desc="Forest void, jade green, soft lime. Present, not CRT phosphor.",
        root="""
  --void: #050a08;
  --line: rgba(100, 230, 180, 0.2); --line-hot: rgba(180, 255, 160, 0.5);
  --accent: #5fe0b0; --accent2: #b6ff8a; --accent3: #7dffd0; --mint: #d4ffe0;
  --text: rgba(236, 255, 246, 0.94); --dim: rgba(150, 200, 180, 0.68);
  --glass: rgba(10, 28, 22, 0.72);
  --panel-bg: linear-gradient(160deg, rgba(24, 60, 48, 0.45), rgba(8, 22, 16, 0.9) 55%, rgba(4, 10, 8, 0.95));
  --shadow: rgba(10, 80, 50, 0.28);
  --btn-primary: linear-gradient(135deg, rgba(40, 200, 140, 0.4), rgba(160, 255, 100, 0.25));
""",
        bg="radial-gradient(ellipse at 50% 0%, rgba(40, 200, 140, 0.14), transparent 44%), radial-gradient(ellipse at 10% 80%, rgba(160, 255, 100, 0.06), transparent 40%), linear-gradient(180deg, #0a1410, #050a08)",
        dots=["#050a08", "#5fe0b0", "#b6ff8a", "#7dffd0"],
    ),
    dict(
        file="present-palette-pearl.html",
        title="Pearl Fog",
        badge="PEARL FOG",
        desc="Light Present: pale fog panels, graphite text, soft lilac.",
        root="""
  --void: #e8e6f0;
  --line: rgba(80, 70, 110, 0.18); --line-hot: rgba(120, 90, 180, 0.4);
  --accent: #6b5b95; --accent2: #9b7ed9; --accent3: #c4a0e8; --mint: #7eb8c9;
  --text: rgba(28, 24, 40, 0.92); --dim: rgba(70, 64, 90, 0.7);
  --glass: rgba(255, 255, 255, 0.65);
  --panel-bg: linear-gradient(160deg, rgba(255,255,255,0.88), rgba(236, 232, 248, 0.94));
  --shadow: rgba(60, 40, 100, 0.12);
  --btn-primary: linear-gradient(135deg, rgba(120, 90, 180, 0.35), rgba(160, 140, 220, 0.4));
""",
        bg="radial-gradient(ellipse at 50% 0%, rgba(180, 160, 255, 0.25), transparent 45%), radial-gradient(ellipse at 100% 80%, rgba(255, 200, 220, 0.2), transparent 40%), linear-gradient(180deg, #f4f2fa, #e8e6f0)",
        dots=["#e8e6f0", "#6b5b95", "#9b7ed9", "#c4a0e8"],
    ),
    dict(
        file="present-palette-neon-void.html",
        title="Neon Void",
        badge="NEON VOID",
        desc="True black, magenta + electric cyan. Loud Present, soft corners.",
        root="""
  --void: #000000;
  --line: rgba(255, 0, 200, 0.28); --line-hot: rgba(0, 255, 255, 0.55);
  --accent: #ff3dce; --accent2: #00f0ff; --accent3: #b14dff; --mint: #39ff14;
  --text: rgba(245, 245, 255, 0.94); --dim: rgba(170, 170, 200, 0.65);
  --glass: rgba(12, 0, 18, 0.8);
  --panel-bg: linear-gradient(160deg, rgba(40, 0, 40, 0.55), rgba(0, 0, 0, 0.94) 55%, rgba(0, 20, 30, 0.92));
  --shadow: rgba(255, 0, 180, 0.15);
  --btn-primary: linear-gradient(135deg, rgba(255, 0, 180, 0.4), rgba(0, 220, 255, 0.3));
""",
        bg="radial-gradient(ellipse at 30% 10%, rgba(255, 0, 180, 0.14), transparent 42%), radial-gradient(ellipse at 90% 70%, rgba(0, 240, 255, 0.1), transparent 40%), linear-gradient(180deg, #050508, #000)",
        dots=["#000000", "#ff3dce", "#00f0ff", "#b14dff"],
    ),
]

nav = "\n".join(f'<a href="{p["file"]}">{p["title"]}</a>' for p in palettes)

for p in palettes:
    page(p["title"], p["badge"], p["desc"], p["root"], p["bg"], nav, p["file"])

# index
cards = []
for p in palettes:
    dots = "".join(f'<i style="background:{c}"></i>' for c in p["dots"])
    cards.append(
        f'<a class="card" href="{p["file"]}"><div class="dots">{dots}</div>'
        f'<h2>{p["title"]}</h2><p>{p["desc"]}</p></a>'
    )

index = f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DOSWAPZ // Present palettes</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
body {{ margin:0; min-height:100vh; background:#08060c; color:#eee; font-family:Inter,system-ui,sans-serif; padding:40px 20px; }}
h1 {{ font-family:'Space Grotesk',system-ui,sans-serif; letter-spacing:.14em; text-transform:uppercase; font-size:clamp(28px,5vw,42px); text-align:center; margin-bottom:10px; }}
.sub {{ text-align:center; color:#998; margin-bottom:32px; font-size:14px; }}
.grid {{ max-width:900px; margin:0 auto; display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; }}
a.card {{ display:block; text-decoration:none; color:inherit; border-radius:22px; border:1px solid rgba(255,255,255,.12); padding:18px; background:rgba(20,16,32,.75); transition:.15s; }}
a.card:hover {{ transform:translateY(-2px); border-color:rgba(200,160,255,.4); }}
a.card h2 {{ font-family:'Space Grotesk',system-ui,sans-serif; font-size:15px; letter-spacing:.12em; text-transform:uppercase; margin:0 0 8px; }}
a.card p {{ margin:0; color:#998; font-size:13px; line-height:1.45; }}
.dots {{ display:flex; gap:6px; margin-bottom:12px; }}
.dots i {{ width:18px; height:18px; border-radius:50%; border:1px solid rgba(255,255,255,.15); }}
</style></head><body>
<h1>Present palettes</h1>
<p class="sub">Same soft shapes · six color schemes · each opened in its own tab</p>
<div class="grid">
{''.join(cards)}
</div>
</body></html>
"""
(OUT / "present-palette-index.html").write_text(index, encoding="utf-8")
print("wrote present-palette-index.html")
print("DONE", len(palettes))
