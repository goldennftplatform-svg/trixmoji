/* MOMS — 10-level corridor shooter. Title shows DOOM, then DOO blacks out and OMS lands. */
(function () {
  const W = 400, H = 250, VIEW = 200, HUD = 50;
  const ASSET = "/classic/pages/arcade/moms/assets/";
  const params = (typeof location !== "undefined") ? new URLSearchParams(location.search) : new URLSearchParams();
  const BOT = params.get("bot") === "1";
  let pick = Math.max(1, Math.min(10, +(params.get("level") || 1) || 1));
  let mode = "title";
  let titleT = 0;
  let cardT = 0, cardIndex = 0, card = null;
  let deadT = 0, winT = 0;
  let pendingCarry = null;
  let st = null;
  let high = 0;
  let muted = !!BOT;
  let audioOn = false;
  let audioCtx = null;
  let axisX = 0, axisY = 0, lookDx = 0, fireHeld = false;
  const keys = new Set();
  const reduceMotion = (typeof matchMedia !== "undefined") && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const titleHold = params.get("t");
  if (titleHold != null && titleHold !== "") titleT = +titleHold || 0;
  else if (reduceMotion || params.get("intro") === "done") titleT = 8;
  const root = (typeof window !== "undefined") ? window : globalThis;
  root.__errs = root.__errs || [];
  if (typeof window !== "undefined") window.addEventListener("error", function (e) { root.__errs.push(String(e.message || e)); });

  const GLYPH = {
    A:[14,17,17,31,17,17,17], B:[30,17,17,30,17,17,30], C:[14,17,16,16,16,17,14],
    D:[30,17,17,17,17,17,30], E:[31,16,16,30,16,16,31], F:[31,16,16,30,16,16,16],
    G:[14,17,16,23,17,17,14], H:[17,17,17,31,17,17,17], I:[31,4,4,4,4,4,31],
    J:[7,2,2,2,2,18,12], K:[17,18,20,24,20,18,17], L:[16,16,16,16,16,16,31],
    M:[17,27,21,21,17,17,17], N:[17,25,21,19,17,17,17], O:[14,17,17,17,17,17,14],
    P:[30,17,17,30,16,16,16], Q:[14,17,17,17,21,18,13], R:[30,17,17,30,20,18,17],
    S:[14,17,16,14,1,17,14], T:[31,4,4,4,4,4,4], U:[17,17,17,17,17,17,14],
    V:[17,17,17,17,17,10,4], W:[17,17,17,21,21,21,10], X:[17,17,10,4,10,17,17],
    Y:[17,17,10,4,4,4,4], Z:[31,1,2,4,8,16,31],
    0:[14,17,19,21,25,17,14], 1:[4,12,4,4,4,4,14], 2:[14,17,1,2,4,8,31],
    3:[14,17,1,6,1,17,14], 4:[2,6,10,18,31,2,2], 5:[31,16,30,1,1,17,14],
    6:[6,8,16,30,17,17,14], 7:[31,1,2,4,8,8,8], 8:[14,17,17,14,17,17,14],
    9:[14,17,17,15,1,2,12],
    " ":[0,0,0,0,0,0,0], "-":[0,0,0,31,0,0,0], ".":[0,0,0,0,0,6,6],
    "!":[4,4,4,4,4,0,4], "'":[6,6,4,0,0,0,0], "/":[1,1,2,4,8,16,16],
    "%":[17,17,2,4,8,17,17], ":":[0,6,6,0,6,6,0]
  };

  const GUNS = [
    { name:"FISTS", delay:0.38, melee:true, range:1.3, damage:[10,18] },
    { name:"PISTOL", delay:0.28, ammo:"bull", pellets:1, spread:0.035, damage:[9,16] },
    { name:"SHOTGUN", delay:0.72, ammo:"shel", pellets:6, spread:0.16, damage:[4,9] },
    { name:"CHAINGUN", delay:0.08, ammo:"bull", pellets:1, spread:0.07, damage:[6,11] },
    { name:"ROCKET", delay:0.85, ammo:"rckt", rocket:true },
    { name:"PLASMA", delay:0.11, ammo:"cell", pellets:1, spread:0.02, damage:[12,20] }
  ];
  const SPECS = {
    imp:   { hp:28,  speed:1.35, radius:0.28, melee:0.72, meleeCd:1.1,  damage:[4,8],   pain:0.4,  points:100,  scale:0.72, retreat:true, shot:true, shotRange:9, shotCd:1.45, shotDmg:8,  shotSpeed:5.6, shotKind:"fire", sprite:"imp" },
    pinky: { hp:60,  speed:2.2,  radius:0.32, melee:0.9,  meleeCd:0.85, damage:[8,16],  pain:0.32, points:150,  scale:0.86, sprite:"pinky" },
    moms:  { hp:170, speed:2.3,  radius:0.4,  melee:1.15, meleeCd:0.9,  damage:[12,20], pain:0.16, points:1000, scale:1.32, shot:true, shotRange:7.2, shotCd:1.3, shotDmg:11, shotSpeed:4.3, shotKind:"wine", sprite:"moms" },
    giant: { hp:520, speed:1.65, radius:0.55, melee:1.45, meleeCd:1.05, damage:[18,30], pain:0.08, points:5000, scale:1.9,  shot:true, shotRange:8.5, shotCd:1.05, shotDmg:14, shotSpeed:4.5, shotKind:"wine", sprite:"moms" }
  };

  function empty(w, h) {
    const g = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) row.push(x === 0 || y === 0 || x === w - 1 || y === h - 1 ? "#" : ".");
      g.push(row);
    }
    return g;
  }
  function hwall(g, x0, x1, y, ch) { for (let x = x0; x <= x1; x++) g[y][x] = ch || "#"; }
  function vwall(g, x, y0, y1, ch) { for (let y = y0; y <= y1; y++) g[y][x] = ch || "#"; }
  function put(g, x, y, ch) {
    if (!g[y] || g[y][x] === undefined) throw new Error("oob " + ch + " " + x + "," + y);
    if ("#%*@+X".includes(g[y][x])) throw new Error("blocked " + ch + " @" + x + "," + y + " on " + g[y][x]);
    g[y][x] = ch;
  }
  function door(g, x, y, ch) {
    if (!g[y] || g[y][x] === undefined) throw new Error("door oob " + x + "," + y);
    g[y][x] = ch || "+";
  }
  function dress(g, ch) {
    const h = g.length, w = g[0].length;
    for (let x = 2; x < w - 2; x += 3) {
      if (g[0][x] === "#") g[0][x] = ch;
      if (g[h - 1][x] === "#") g[h - 1][x] = ch;
    }
    for (let y = 2; y < h - 2; y += 3) {
      if (g[y][0] === "#") g[y][0] = ch;
      if (g[y][w - 1] === "#") g[y][w - 1] = ch;
    }
  }
  function packLevel(g, name, line, look) {
    look = look || {};
    return {
      name: name, line: line,
      floor: look.floor == null ? 6 : look.floor,
      ceil: look.ceil == null ? 8 : look.ceil,
      fog: look.fog || 0.05,
      tint: look.tint || [1, 1, 1],
      map: g.map(function (r) { return r.join(""); })
    };
  }

  function level1() {
    const g = empty(22, 14); dress(g, "%");
    hwall(g, 8, 16, 4); hwall(g, 8, 16, 10); vwall(g, 8, 4, 10); vwall(g, 16, 4, 10);
    door(g, 8, 7, "+"); door(g, 12, 4, "+"); door(g, 16, 7, "X");
    put(g, 2, 7, ">"); put(g, 12, 7, "M"); put(g, 5, 4, "I"); put(g, 15, 12, "I"); put(g, 7, 11, "P");
    put(g, 2, 2, "h"); put(g, 12, 8, "h"); put(g, 14, 6, "a"); put(g, 18, 3, "s"); put(g, 2, 11, "b");
    put(g, 6, 2, "t"); put(g, 18, 11, "t");
    return packLevel(g, "FRONT DOOR", "SHE HEARD YOU COME IN.", { floor:6, ceil:8, fog:0.042, tint:[1.05, 0.94, 0.8] });
  }
  function level2() {
    const g = empty(26, 16); dress(g, "%");
    hwall(g, 2, 10, 3, "*"); hwall(g, 2, 10, 12, "*"); vwall(g, 2, 3, 12, "*"); vwall(g, 10, 3, 12, "*");
    door(g, 10, 7, "+"); door(g, 6, 3, "+");
    hwall(g, 14, 23, 4); hwall(g, 14, 23, 13); vwall(g, 14, 4, 13); vwall(g, 23, 4, 13);
    door(g, 14, 8, "+"); door(g, 23, 8, "X");
    put(g, 12, 2, "v"); put(g, 6, 8, "M");
    put(g, 4, 5, "I"); put(g, 8, 10, "I"); put(g, 16, 6, "I");
    put(g, 20, 10, "P"); put(g, 18, 8, "P");
    put(g, 8, 5, "h"); put(g, 20, 6, "h"); put(g, 16, 11, "a");
    put(g, 4, 10, "s"); put(g, 21, 12, "s"); put(g, 12, 8, "b");
    put(g, 5, 6, "t"); put(g, 19, 5, "t");
    return packLevel(g, "WINE CELLAR", "DO NOT TOUCH THE GOOD BOTTLE.", { floor:7, ceil:9, fog:0.07, tint:[0.85, 0.48, 0.55] });
  }
  function level3() {
    const g = empty(28, 16); dress(g, "*");
    vwall(g, 6, 1, 6); vwall(g, 12, 1, 6); vwall(g, 18, 1, 6); vwall(g, 24, 1, 6);
    hwall(g, 1, 26, 6);
    door(g, 4, 6, "+"); door(g, 9, 6, "+"); door(g, 15, 6, "+"); door(g, 21, 6, "+");
    vwall(g, 6, 10, 14); vwall(g, 12, 10, 14); vwall(g, 18, 10, 14); vwall(g, 24, 10, 14);
    hwall(g, 1, 26, 10);
    door(g, 4, 10, "+"); door(g, 9, 10, "+"); door(g, 15, 10, "+"); door(g, 26, 8, "X");
    put(g, 2, 8, ">"); put(g, 21, 3, "M");
    put(g, 4, 3, "I"); put(g, 9, 4, "I"); put(g, 15, 3, "I");
    put(g, 4, 12, "P"); put(g, 9, 12, "I"); put(g, 15, 13, "P");
    put(g, 22, 12, "h"); put(g, 2, 3, "h"); put(g, 8, 8, "s"); put(g, 16, 8, "a"); put(g, 24, 8, "b");
    put(g, 3, 8, "t"); put(g, 20, 8, "t");
    return packLevel(g, "LAUNDRY ROOM", "THE DRYER IS NOT THE DANGER.", { floor:15, ceil:10, fog:0.03, tint:[0.9, 1.0, 1.15] });
  }
  function level4() {
    const g = empty(12, 26); dress(g, "%");
    put(g, 6, 2, "v");
    [5, 8, 11, 14, 17, 20, 23].forEach(function (y) { hwall(g, 1, 10, y); door(g, 6, y, "+"); });
    door(g, 6, 25, "X");
    put(g, 2, 4, "I"); put(g, 9, 4, "P"); put(g, 3, 7, "I"); put(g, 8, 7, "P");
    put(g, 2, 10, "I"); put(g, 9, 10, "P"); put(g, 4, 13, "M"); put(g, 8, 16, "h");
    put(g, 3, 16, "M"); put(g, 9, 19, "a"); put(g, 2, 19, "s"); put(g, 8, 22, "U");
    put(g, 3, 22, "b"); put(g, 9, 3, "h"); put(g, 2, 7, "t");
    return packLevel(g, "MINIVAN", "NOBODY IS BUCKLED.", { floor:16, ceil:11, fog:0.038, tint:[1.15, 0.98, 0.7] });
  }
  function level5() {
    const g = empty(28, 18); dress(g, "%");
    vwall(g, 14, 2, 15); door(g, 14, 5, "+"); door(g, 14, 12, "+");
    hwall(g, 18, 25, 4); hwall(g, 18, 25, 10); vwall(g, 18, 4, 10); vwall(g, 25, 4, 10);
    door(g, 18, 7, "+"); door(g, 25, 7, "X");
    put(g, 3, 9, ">"); put(g, 6, 5, "I"); put(g, 8, 12, "I"); put(g, 5, 14, "P"); put(g, 10, 8, "P");
    put(g, 11, 4, "M"); put(g, 20, 7, "M"); put(g, 16, 6, "I"); put(g, 16, 13, "P"); put(g, 22, 6, "I");
    put(g, 22, 12, "h"); put(g, 4, 3, "h"); put(g, 8, 3, "s"); put(g, 4, 15, "a"); put(g, 16, 9, "b");
    put(g, 7, 9, "t"); put(g, 20, 14, "t");
    return packLevel(g, "CARPOOL LANE", "TWO OF THEM. ONE OF YOU.", { floor:17, ceil:11, fog:0.04, tint:[0.75, 0.8, 0.9] });
  }
  function level6() {
    const g = empty(30, 16); dress(g, "@");
    vwall(g, 10, 2, 13); vwall(g, 20, 2, 13);
    door(g, 10, 5, "+"); door(g, 10, 11, "+"); door(g, 20, 4, "+"); door(g, 20, 12, "+");
    door(g, 29, 8, "X");
    put(g, 3, 8, ">"); put(g, 5, 4, "I"); put(g, 6, 12, "P"); put(g, 4, 6, "h");
    put(g, 14, 8, "M"); put(g, 15, 4, "I"); put(g, 16, 12, "P"); put(g, 13, 11, "a"); put(g, 17, 6, "K");
    put(g, 24, 8, "M"); put(g, 23, 4, "I"); put(g, 25, 12, "P"); put(g, 26, 5, "I"); put(g, 22, 12, "P");
    put(g, 27, 6, "r"); put(g, 27, 11, "r"); put(g, 8, 8, "s"); put(g, 14, 3, "b");
    put(g, 5, 10, "t"); put(g, 24, 3, "t");
    return packLevel(g, "PTA NIGHT", "BRING A ROCKET.", { floor:18, ceil:10, fog:0.045, tint:[0.75, 1.05, 0.7] });
  }
  function level7() {
    const g = empty(26, 20); dress(g, "*");
    [[4, 4, 6], [16, 4, 6], [4, 14, 6], [8, 10, 5]].forEach(function (w) { hwall(g, w[0], w[0] + w[2], w[1], "%"); });
    door(g, 25, 10, "X");
    put(g, 2, 10, ">"); put(g, 8, 8, "M"); put(g, 18, 16, "M");
    put(g, 6, 16, "I"); put(g, 12, 6, "I"); put(g, 20, 6, "I"); put(g, 10, 12, "I"); put(g, 22, 12, "I");
    put(g, 5, 7, "P"); put(g, 12, 16, "P"); put(g, 20, 16, "P"); put(g, 16, 12, "P");
    put(g, 3, 3, "h"); put(g, 22, 3, "h"); put(g, 3, 17, "a"); put(g, 12, 3, "s"); put(g, 8, 17, "b");
    put(g, 21, 8, "s"); put(g, 6, 5, "t"); put(g, 18, 8, "t");
    return packLevel(g, "SIDELINE", "SHE BROUGHT SNACKS.", { floor:19, ceil:11, fog:0.032, tint:[1.0, 1.08, 0.75] });
  }
  function level8() {
    const g = empty(27, 18); dress(g, "@");
    vwall(g, 9, 1, 16); vwall(g, 18, 1, 16); hwall(g, 1, 25, 9);
    door(g, 9, 5, "+"); door(g, 9, 13, "+"); door(g, 18, 4, "+"); door(g, 18, 14, "+");
    door(g, 5, 9, "+"); door(g, 14, 9, "+"); door(g, 22, 9, "+"); door(g, 26, 14, "X");
    put(g, 3, 4, ">"); put(g, 7, 6, "I"); put(g, 5, 14, "P"); put(g, 4, 12, "M");
    put(g, 13, 5, "I"); put(g, 14, 6, "M"); put(g, 12, 14, "P"); put(g, 15, 13, "I");
    put(g, 22, 5, "L"); put(g, 23, 13, "M"); put(g, 21, 12, "I"); put(g, 24, 6, "P"); put(g, 24, 15, "P");
    put(g, 6, 7, "h"); put(g, 13, 15, "h"); put(g, 21, 4, "a"); put(g, 7, 3, "s"); put(g, 15, 3, "b");
    put(g, 24, 4, "c"); put(g, 3, 15, "c"); put(g, 16, 7, "t"); put(g, 8, 11, "t");
    return packLevel(g, "BOOK CLUB", "THREE MOMS. ONE OPINION.", { floor:18, ceil:12, fog:0.062, tint:[1.1, 0.78, 0.42] });
  }
  function level9() {
    const g = empty(29, 21); dress(g, "*");
    [5, 10, 15, 20, 24].forEach(function (x, i) {
      vwall(g, x, 1, 19, "@");
      const gap = 3 + ((i * 5) % 12);
      door(g, x, gap, "+");
      door(g, x, gap + 6, "+");
      if (gap + 12 <= 18) door(g, x, gap + 12, "+");
    });
    door(g, 28, 10, "X");
    put(g, 2, 10, ">"); put(g, 3, 4, "I"); put(g, 7, 16, "I"); put(g, 8, 6, "P");
    put(g, 12, 12, "I"); put(g, 13, 4, "M"); put(g, 12, 18, "P"); put(g, 17, 8, "I");
    put(g, 17, 15, "M"); put(g, 18, 3, "P"); put(g, 22, 11, "I"); put(g, 22, 17, "P");
    put(g, 26, 6, "M"); put(g, 26, 14, "I"); put(g, 25, 16, "P");
    put(g, 3, 16, "h"); put(g, 8, 14, "h"); put(g, 16, 5, "a"); put(g, 21, 5, "s");
    put(g, 26, 9, "b"); put(g, 7, 3, "c"); put(g, 14, 16, "r"); put(g, 4, 8, "t"); put(g, 23, 8, "t");
    return packLevel(g, "THE ATTIC", "SHE HAS BEEN UP HERE FOR YEARS.", { floor:6, ceil:13, fog:0.085, tint:[0.72, 0.66, 0.58] });
  }
  function level10() {
    const g = empty(32, 22); dress(g, "%");
    [[6, 5], [22, 5], [6, 14], [22, 14], [14, 9]].forEach(function (p) {
      g[p[1]][p[0]] = "#"; g[p[1]][p[0] + 1] = "#"; g[p[1] + 1][p[0]] = "#"; g[p[1] + 1][p[0] + 1] = "#";
    });
    door(g, 16, 0, "X");
    put(g, 16, 20, "^"); put(g, 16, 11, "G"); put(g, 8, 8, "M"); put(g, 24, 8, "M"); put(g, 11, 16, "M");
    put(g, 4, 4, "I"); put(g, 28, 4, "I"); put(g, 4, 18, "I"); put(g, 28, 18, "I"); put(g, 10, 12, "I"); put(g, 22, 16, "I");
    put(g, 8, 16, "P"); put(g, 24, 16, "P"); put(g, 10, 6, "P"); put(g, 20, 6, "P"); put(g, 12, 18, "P");
    put(g, 4, 10, "h"); put(g, 28, 10, "h"); put(g, 16, 18, "h"); put(g, 6, 18, "a"); put(g, 26, 18, "a");
    put(g, 10, 18, "s"); put(g, 22, 18, "b"); put(g, 12, 4, "r"); put(g, 20, 4, "r"); put(g, 8, 4, "c");
    put(g, 24, 4, "K"); put(g, 14, 4, "t"); put(g, 18, 18, "t");
    return packLevel(g, "MOM'S HOUSE", "BIG MOMS IS HOME.", { floor:7, ceil:14, fog:0.048, tint:[1.2, 0.5, 0.4] });
  }

  const LEVELS = [level1(), level2(), level3(), level4(), level5(), level6(), level7(), level8(), level9(), level10()];

  function kindOf(ch) {
    return { I:"imp", P:"pinky", M:"moms", G:"giant", h:"health", a:"armor", b:"bullets", s:"shells", r:"rockets", c:"cells", U:"chaingun", K:"launcher", L:"plasma", t:"torch" }[ch] || null;
  }
  function parseLevel(rows) {
    const h = rows.length, w = rows[0].length;
    if (rows.some(function (r) { return r.length !== w; })) throw new Error("ragged");
    const grid = [], ents = [];
    let start = null;
    const wall = { "#":1, "%":2, "*":3, "@":4, "+":5, "X":6 };
    for (let y = 0; y < h; y++) {
      grid[y] = [];
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        grid[y][x] = wall[ch] || 0;
        if ("><^v".includes(ch)) start = { x: x + 0.5, y: y + 0.5, ch: ch };
        const k = kindOf(ch);
        if (k) ents.push({ kind: k, x: x + 0.5, y: y + 0.5 });
      }
    }
    if (!start) throw new Error("no start");
    return { grid: grid, w: w, h: h, start: start, ents: ents };
  }
  function analyze(p) {
    const seen = new Set(), q = [[p.start.x | 0, p.start.y | 0]];
    seen.add(q[0][0] + "," + q[0][1]);
    let exit = false;
    const need = new Set();
    p.ents.forEach(function (e) { if (e.kind === "moms" || e.kind === "giant") need.add((e.x | 0) + "," + (e.y | 0)); });
    while (q.length) {
      const cur = q.pop(), x = cur[0], y = cur[1];
      if (p.grid[y][x] === 6) exit = true;
      need.delete(x + "," + y);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        const nx = x + d[0], ny = y + d[1];
        if (ny < 0 || nx < 0 || ny >= p.h || nx >= p.w) return;
        const c = p.grid[ny][nx];
        if (c !== 0 && c !== 5 && c !== 6) return;
        const k = nx + "," + ny;
        if (seen.has(k)) return;
        seen.add(k); q.push([nx, ny]);
      });
    }
    return { exit: exit, momsReach: need.size === 0, moms: p.ents.filter(function (e) { return e.kind === "moms" || e.kind === "giant"; }).length };
  }
  function doorBlocks(grid, x, y) {
    const c = grid[y] && grid[y][x];
    return c >= 1 && c <= 6;
  }
  function nearestSeen(p) {
    let best = 99, who = "";
    p.ents.forEach(function (e) {
      if (!SPECS[e.kind]) return;
      const d = Math.hypot(e.x - p.start.x, e.y - p.start.y);
      if (d >= best) return;
      const dist = d || 0.0001, steps = Math.max(1, Math.ceil(dist / 0.12));
      let clear = true;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        if (doorBlocks(p.grid, (e.x + (p.start.x - e.x) * t) | 0, (e.y + (p.start.y - e.y) * t) | 0)) { clear = false; break; }
      }
      if (clear) { best = d; who = e.kind; }
    });
    return { d: best, who: who };
  }
  function selfTest() {
    const problems = [], lines = [];
    LEVELS.forEach(function (lv) {
      try {
        const p = parseLevel(lv.map);
        const a = analyze(p);
        lines.push(lv.name + " " + p.w + "x" + p.h + " moms " + a.moms + " exit " + a.exit + " reach " + a.momsReach);
        if (!a.exit) problems.push(lv.name + " exit blocked");
        if (!a.momsReach) problems.push(lv.name + " moms walled off");
        if (a.moms < 1) problems.push(lv.name + " no moms");
        const near = nearestSeen(p);
        if (near.d < 3.2) problems.push(lv.name + " " + near.who + " in your face " + near.d.toFixed(1));
      } catch (e) { problems.push(lv.name + " " + e.message); }
    });
    const combat = combatSmoke();
    if (combat) problems.push(combat);
    return { problems: problems, lines: lines };
  }
  function combatSmoke() {
    const g = empty(14, 10);
    put(g, 2, 5, ">"); put(g, 8, 5, "M");
    st = stateFrom(parseLevel(g.map(function (r) { return r.join(""); })), 0);
    st.weapon = 1; st.ammo.bull = 20;
    const mom = st.enemies[0], hp = mom.hp;
    shootPellets(1, 0, 40);
    if (mom.hp >= hp) return "pistol missed hp " + mom.hp;
    damageEnemy(mom, 99999);
    if (momsLeft() !== 0) return "moms survived a kill";
    st.px = 2.5; st.py = 5.5;
    tryMove(-4, 0);
    if (st.px < 1) return "walked through wall " + st.px;
    const gd = empty(8, 8); door(gd, 4, 4, "+"); put(gd, 2, 4, ">");
    st = stateFrom(parseLevel(gd.map(function (r) { return r.join(""); })), 0);
    st.doors["4,4"].vel = 1;
    updateDoors(0.4);
    if (st.doors["4,4"].pos <= 0.2) return "door stayed shut";
    return null;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function defaultCarry() {
    return { score:0, health:100, armor:0, ammo:{ bull:50, shel:50, rckt:0, cell:0 }, owned:{ 0:true, 1:true, 2:true, 3:false, 4:false, 5:false }, weapon:0 };
  }
  function facingOf(ch) {
    if (ch === "<") return [-1, 0];
    if (ch === "v") return [0, 1];
    if (ch === "^") return [0, -1];
    return [1, 0];
  }
  function applyFacing(ch) {
    const f = facingOf(ch);
    st.dirX = f[0]; st.dirY = f[1];
    st.planeX = -st.dirY * 0.66; st.planeY = st.dirX * 0.66;
  }
  function spawnEnemy(e) {
    const spec = SPECS[e.kind];
    return { kind:e.kind, spec:spec, x:e.x, y:e.y, hp:spec.hp, radius:spec.radius, dead:false, deathT:0, awake:false, pain:0, cd:0.7 + Math.random() * 0.45, anim:Math.random() * 3, attackT:0, lunge:0, _see:false };
  }
  function stateFrom(p, index) {
    const enemies = [], items = [], decors = [], doors = {};
    p.ents.forEach(function (e) {
      if (SPECS[e.kind]) enemies.push(spawnEnemy(e));
      else if (e.kind === "torch") decors.push(e);
      else items.push({ kind:e.kind, x:e.x, y:e.y });
    });
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const c = p.grid[y][x];
      if (c === 5 || c === 6) doors[x + "," + y] = { pos:0, vel:0, wait:0, exit:c === 6 };
    }
    return {
      index:index, grid:p.grid, w:p.w, h:p.h,
      floor:LEVELS[index] ? LEVELS[index].floor : 6,
      ceil:LEVELS[index] && LEVELS[index].ceil != null ? LEVELS[index].ceil : 8,
      fog:LEVELS[index] && LEVELS[index].fog ? LEVELS[index].fog : 0.05,
      tint:LEVELS[index] && LEVELS[index].tint ? LEVELS[index].tint : [1, 1, 1],
      px:p.start.x, py:p.start.y, dirX:1, dirY:0, planeX:0, planeY:0.66, startCh:p.start.ch,
      enemies:enemies, items:items, decors:decors, doors:doors, projectiles:[], puffs:[],
      health:100, armor:0, ammo:{ bull:50, shel:50, rckt:0, cell:0 }, max:{ bull:200, shel:50, rckt:50, cell:300 },
      owned:{ 0:true, 1:true, 2:true, 3:false, 4:false, 5:false }, weapon:0,
      fireCd:0, hurtCd:0.3, pain:0, shake:0, bob:0, kick:0, flash:0, score:0, kills:0,
      msg:"", msgT:0, mapOn:false, mapFlash:0, seeT:0, time:0, lastSrc:"", cleared:false, bot:false, botTime:0, god:false, grace:0
    };
  }
  function begin(index, carry) {
    carry = carry || defaultCarry();
    const p = parseLevel(LEVELS[index].map);
    st = stateFrom(p, index);
    applyFacing(p.start.ch);
    st.score = carry.score; st.health = carry.health; st.armor = carry.armor;
    st.ammo = clone(carry.ammo); st.owned = clone(carry.owned);
    st.owned[0] = st.owned[1] = st.owned[2] = true;
    st.weapon = st.owned[carry.weapon] ? carry.weapon : 1;
    st.grace = 1.5;
    st.msg = "2 PISTOL   3 SHOTGUN"; st.msgT = 1.5;
    st.scoreMark = st.score; st.healthMark = st.health; st.armorMark = st.armor;
    st.ammoMark = clone(st.ammo); st.ownedMark = clone(st.owned); st.weaponMark = st.weapon;
  }

  function cell(x, y) {
    if (!st || y < 0 || x < 0 || y >= st.h || x >= st.w) return 1;
    return st.grid[y][x];
  }
  function doorPos(x, y) { const d = st.doors[x + "," + y]; return d ? d.pos : 0; }
  function solidCell(x, y) {
    const c = cell(x, y);
    if (c >= 1 && c <= 4) return true;
    if (c === 5 || c === 6) return doorPos(x, y) < 0.72;
    return false;
  }
  function solidAt(x, y, rad) {
    const pts = [[0, 0], [rad, 0], [-rad, 0], [0, rad], [0, -rad], [rad * 0.7, rad * 0.7], [rad * 0.7, -rad * 0.7], [-rad * 0.7, rad * 0.7], [-rad * 0.7, -rad * 0.7]];
    for (let i = 0; i < pts.length; i++) if (solidCell((x + pts[i][0]) | 0, (y + pts[i][1]) | 0)) return true;
    return false;
  }
  function tryMove(dx, dy) {
    const r = 0.18;
    if (!solidAt(st.px + dx, st.py, r)) st.px += dx;
    if (!solidAt(st.px, st.py + dy, r)) st.py += dy;
  }
  function rotate(a) {
    const c = Math.cos(a), s = Math.sin(a);
    const dx = st.dirX, dy = st.dirY;
    st.dirX = dx * c - dy * s; st.dirY = dx * s + dy * c;
    const px = st.planeX, py = st.planeY;
    st.planeX = px * c - py * s; st.planeY = px * s + py * c;
  }
  function momsLeft() {
    let n = 0;
    for (let i = 0; i < st.enemies.length; i++) {
      const e = st.enemies[i];
      if ((e.kind === "moms" || e.kind === "giant") && !e.dead) n++;
    }
    return n;
  }
  function momsCount() {
    let dead = 0, all = 0;
    for (let i = 0; i < st.enemies.length; i++) {
      const e = st.enemies[i];
      if (e.kind === "moms" || e.kind === "giant") { all++; if (e.dead) dead++; }
    }
    return { dead: dead, all: all };
  }
  function message(s) { st.msg = s; st.msgT = 2.1; }
  function noteScore() {
    if (!st || st.score <= high) return;
    high = st.score;
    try { localStorage.setItem("momsHigh", String(high)); } catch (e) {}
  }
  function randRange(pair) { return pair[0] + Math.random() * (pair[1] - pair[0]); }
  function lineClear(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / 0.12));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (solidCell((x0 + (x1 - x0) * t) | 0, (y0 + (y1 - y0) * t) | 0)) return false;
    }
    return true;
  }
  function refreshSight() {
    for (let i = 0; i < st.enemies.length; i++) {
      const e = st.enemies[i];
      if (e.dead) continue;
      e._see = lineClear(e.x, e.y, st.px, st.py);
      if (e._see && Math.hypot(e.x - st.px, e.y - st.py) < 12) e.awake = true;
    }
  }
  function damageEnemy(e, dmg) {
    if (!e || e.dead) return;
    e.hp -= dmg; e.awake = true;
    if (Math.random() < e.spec.pain) e.pain = 0.22;
    if (e.hp <= 0) {
      e.hp = 0; e.dead = true; e.deathT = 0;
      st.score += e.spec.points; st.kills++;
      noteScore();
      if (e.kind === "moms" || e.kind === "giant") {
        message(e.kind === "giant" ? "BIG MOMS DOWN" : "MOMS DOWN");
        sfxMom();
        if (momsLeft() === 0) message("ALL MOMS DOWN. FIND THE EXIT.");
      }
    }
  }
  function hurtPlayer(dmg, src) {
    if (mode !== "play" || st.hurtCd > 0 || st.god) return;
    dmg = Math.max(1, dmg | 0);
    let absorb = 0;
    if (st.armor > 0) { absorb = Math.min(st.armor, Math.ceil(dmg * 0.4)); st.armor -= absorb; }
    st.health -= dmg - absorb;
    st.hurtCd = 0.42; st.pain = 0.45; st.shake = Math.min(0.35, st.shake + 0.14); st.lastSrc = src || "";
    sfxPain();
    if (st.health <= 0) { st.health = 0; die(); }
  }
  function die() {
    if (mode !== "play") return;
    mode = "dead"; deadT = 0; noteScore(); sfxDeath();
  }
  function puff(x, y) { st.puffs.push({ x:x, y:y, life:0.18 }); }
  function shootPellets(n, spread, damage) {
    const base = Math.atan2(st.dirY, st.dirX);
    sfxShot(st.weapon);
    for (let i = 0; i < n; i++) {
      const a = base + (spread ? (Math.random() - 0.5) * spread : 0);
      const dx = Math.cos(a), dy = Math.sin(a);
      let x = st.px, y = st.py, hit = false;
      for (let s = 0; s < 240; s++) {
        x += dx * 0.055; y += dy * 0.055;
        if (solidCell(x | 0, y | 0)) { puff(x, y); break; }
        for (let k = 0; k < st.enemies.length; k++) {
          const e = st.enemies[k];
          if (e.dead) continue;
          if (Math.hypot(e.x - x, e.y - y) < e.radius * 0.9) {
            damageEnemy(e, Array.isArray(damage) ? randRange(damage) : damage);
            puff(x, y); hit = true; break;
          }
        }
        if (hit) break;
      }
    }
  }
  function launchRocket() {
    sfxRocket();
    st.projectiles.push({ x:st.px + st.dirX * 0.35, y:st.py + st.dirY * 0.35, vx:st.dirX * 8, vy:st.dirY * 8, dmg:80, selfDmg:36, splash:2.15, fromPlayer:true, life:2.4, kind:"rocket", src:"rocket" });
  }
  function tryFire() {
    if (st.fireCd > 0) return;
    const gun = GUNS[st.weapon];
    if (!gun) return;
    if (gun.ammo) {
      if (st.ammo[gun.ammo] <= 0) { message("OUT OF AMMO"); autoSwap(); return; }
      st.ammo[gun.ammo]--;
    }
    st.fireCd = gun.delay; st.kick = gun.melee ? 4 : 8; st.flash = 0.045;
    wakeNoise();
    if (gun.melee) { melee(gun); return; }
    if (gun.rocket) { launchRocket(); return; }
    shootPellets(gun.pellets, gun.spread, gun.damage);
  }
  function melee(gun) {
    sfxPunch();
    const face = Math.atan2(st.dirY, st.dirX);
    for (let i = 0; i < st.enemies.length; i++) {
      const e = st.enemies[i];
      if (e.dead) continue;
      const dx = e.x - st.px, dy = e.y - st.py, dist = Math.hypot(dx, dy);
      if (dist > gun.range) continue;
      let d = Math.atan2(dy, dx) - face;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 0.7) damageEnemy(e, randRange(gun.damage));
    }
  }
  function wakeNoise() {
    for (let i = 0; i < st.enemies.length; i++) {
      const e = st.enemies[i];
      if (!e.dead && Math.hypot(e.x - st.px, e.y - st.py) < 12) e.awake = true;
    }
  }
  function autoSwap() {
    const order = [2, 1, 3, 5, 4, 0];
    for (let i = 0; i < order.length; i++) {
      const w = order[i];
      if (!st.owned[w]) continue;
      const g = GUNS[w];
      if (!g.ammo || st.ammo[g.ammo] > 0) { st.weapon = w; return; }
    }
    st.weapon = 0;
  }
  function explode(p) {
    for (let i = 0; i < st.enemies.length; i++) {
      const e = st.enemies[i];
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (!e.dead && d < p.splash) damageEnemy(e, p.dmg * (1 - d / p.splash));
    }
    const pd = Math.hypot(st.px - p.x, st.py - p.y);
    if (pd < p.splash) hurtPlayer(p.selfDmg * (1 - pd / p.splash), "rocket");
    st.shake = Math.min(0.4, st.shake + 0.2);
    sfxBoom();
  }
  function updateProjectiles(dt) {
    for (let i = 0; i < st.projectiles.length; i++) {
      const p = st.projectiles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
      if (solidCell(p.x | 0, p.y | 0)) {
        if (p.splash) explode(p);
        p.dead = true; puff(p.x, p.y); continue;
      }
      if (p.fromPlayer) {
        for (let k = 0; k < st.enemies.length; k++) {
          const e = st.enemies[k];
          if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < e.radius + 0.2) {
            if (p.splash) explode(p); else damageEnemy(e, p.dmg);
            p.dead = true; break;
          }
        }
      } else if (Math.hypot(st.px - p.x, st.py - p.y) < 0.34) {
        hurtPlayer(p.dmg, p.src); p.dead = true;
      }
    }
    st.projectiles = st.projectiles.filter(function (p) { return !p.dead; });
  }
  function stepEnemy(e, dx, dy) {
    const r = e.radius;
    if (!solidAt(e.x + dx, e.y, r)) e.x += dx;
    if (!solidAt(e.x, e.y + dy, r)) e.y += dy;
  }
  function launchEnemyShot(e) {
    const dx = st.px - e.x, dy = st.py - e.y;
    const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.08;
    st.projectiles.push({ x:e.x, y:e.y, vx:Math.cos(a) * e.spec.shotSpeed, vy:Math.sin(a) * e.spec.shotSpeed, dmg:e.spec.shotDmg, src:e.kind, life:3, kind:e.spec.shotKind || "fire", fromPlayer:false });
    if (e.kind === "moms" || e.kind === "giant") sfxMom(); else sfxImp();
  }
  function updateEnemy(e, dt) {
    if (e.dead) { e.deathT += dt; return; }
    e.anim += dt;
    if (e.attackT > 0) e.attackT -= dt;
    if (e.pain > 0) { e.pain -= dt; return; }
    const dx = st.px - e.x, dy = st.py - e.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    if (!e.awake) { if (dist < 9 && e._see) e.awake = true; else return; }
    e.cd -= dt;
    const spec = e.spec;
    if (dist < spec.melee && e.cd <= 0) {
      e.cd = spec.meleeCd; e.attackT = 0.32;
      stepEnemy(e, dx / dist * 0.22, dy / dist * 0.22);
      hurtPlayer(randRange(spec.damage), e.kind);
      if (e.kind === "moms" || e.kind === "giant") sfxMom();
      return;
    }
    if (spec.shot && dist > 2.5 && dist < spec.shotRange && e._see && e.cd <= 0) {
      e.cd = spec.shotCd; e.attackT = 0.28; launchEnemyShot(e); return;
    }
    let mx = dx / dist, my = dy / dist;
    if (spec.retreat && dist < 2.4) { mx = -mx; my = -my; }
    const sp = spec.speed * dt;
    stepEnemy(e, mx * sp, my * sp);
  }
  function addAmmo(type, n) {
    if (st.ammo[type] >= st.max[type]) return false;
    st.ammo[type] = Math.min(st.max[type], st.ammo[type] + n);
    return true;
  }
  function collect(it) {
    if (it.kind === "health") {
      if (st.health >= 100) return false;
      st.health = Math.min(100, st.health + 25); message("HEALTH"); sfxPickup(); return true;
    }
    if (it.kind === "armor") {
      if (st.armor >= 100) return false;
      st.armor = Math.min(100, st.armor + 50); message("ARMOR"); sfxPickup(); return true;
    }
    if (it.kind === "bullets") { if (!addAmmo("bull", 20)) return false; message("BULLETS"); sfxPickup(); return true; }
    if (it.kind === "shells") { if (!addAmmo("shel", 6)) return false; message("SHELLS"); sfxPickup(); return true; }
    if (it.kind === "rockets") { if (!addAmmo("rckt", 2)) return false; message("ROCKETS"); sfxPickup(); return true; }
    if (it.kind === "cells") { if (!addAmmo("cell", 30)) return false; message("CELLS"); sfxPickup(); return true; }
    if (it.kind === "chaingun") { st.owned[3] = true; addAmmo("bull", 40); st.weapon = 3; message("CHAINGUN"); sfxPickup(); return true; }
    if (it.kind === "launcher") { st.owned[4] = true; addAmmo("rckt", 2); st.weapon = 4; message("ROCKET LAUNCHER"); sfxPickup(); return true; }
    if (it.kind === "plasma") { st.owned[5] = true; addAmmo("cell", 40); st.weapon = 5; message("PLASMA RIFLE"); sfxPickup(); return true; }
    return false;
  }
  function updateDoors(dt) {
    for (const k in st.doors) {
      const d = st.doors[k];
      if (d.vel > 0) {
        d.pos = Math.min(1, d.pos + dt * 1.7);
        if (d.pos >= 1) { d.vel = 0; d.wait = d.exit ? 999 : 2.6; }
      } else if (d.vel < 0) {
        d.pos = Math.max(0, d.pos - dt * 1.5);
        if (d.pos <= 0) d.vel = 0;
      } else if (d.pos >= 1 && !d.exit) {
        d.wait -= dt;
        const parts = k.split(",");
        const near = Math.hypot((+parts[0] + 0.5) - st.px, (+parts[1] + 0.5) - st.py) < 1.15;
        if (d.wait <= 0 && !near) d.vel = -1;
      }
    }
  }
  function useTarget() {
    for (let i = 0; i < 2; i++) {
      const dist = i ? 1.05 : 0.6;
      const x = (st.px + st.dirX * dist) | 0, y = (st.py + st.dirY * dist) | 0;
      const c = cell(x, y);
      if (c === 5 || c === 6) return [x, y, c];
    }
    return null;
  }
  function tryUse() {
    const t = useTarget();
    if (!t) { message("NOTHING TO OPEN"); return; }
    const d = st.doors[t[0] + "," + t[1]];
    if (!d) return;
    if (t[2] === 6 && momsLeft() > 0) { message("MOMS IS STILL UP"); return; }
    if (d.exit) { d.vel = 1; sfxDoor(); return; }
    d.vel = d.pos > 0.9 ? -1 : 1;
    sfxDoor();
  }
  function checkExit() {
    const cx = st.px | 0, cy = st.py | 0;
    if (st.grid[cy] && st.grid[cy][cx] === 6 && doorPos(cx, cy) > 0.8 && momsLeft() === 0) clearLevel();
  }
  function clearLevel() {
    if (st.cleared) return;
    st.cleared = true;
    st.score += 1000 + 250 * st.index;
    noteScore();
    sfxWin();
    if (st.index >= LEVELS.length - 1) { mode = "win"; winT = 0; return; }
    pendingCarry = { score:st.score, health:st.health, armor:st.armor, ammo:clone(st.ammo), owned:clone(st.owned), weapon:st.weapon };
    showCard(st.index + 1);
  }
  function update(dt) {
    if (st.frozen) return;
    st.time += dt;
    st.fireCd = Math.max(0, st.fireCd - dt);
    st.hurtCd = Math.max(0, st.hurtCd - dt);
    st.pain = Math.max(0, st.pain - dt);
    st.shake = Math.max(0, st.shake - dt);
    st.kick = Math.max(0, st.kick - dt * 30);
    st.flash = Math.max(0, st.flash - dt);
    if (st.grace > 0) {
      st.grace -= dt;
      if (st.grace <= 0) message("DROP EVERY MOMS");
    }
    st.msgT = Math.max(0, st.msgT - dt);
    st.mapFlash = Math.max(0, st.mapFlash - dt);
    if (st.bot) botThink(dt);
    let fwd = 0, strafe = 0, turn = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) fwd += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) fwd -= 1;
    if (keys.has("KeyA")) strafe -= 1;
    if (keys.has("KeyD")) strafe += 1;
    if (keys.has("ArrowLeft")) turn -= 1;
    if (keys.has("ArrowRight")) turn += 1;
    fwd += -axisY; strafe += axisX;
    const run = keys.has("ShiftLeft") || keys.has("ShiftRight") || Math.hypot(axisX, axisY) > 0.82;
    const sp = (run ? 3.15 : 2.05) * dt;
    const rx = -st.dirY, ry = st.dirX;
    const moving = Math.abs(fwd) + Math.abs(strafe) > 0.05;
    if (moving) {
      tryMove((st.dirX * fwd + rx * strafe) * sp, (st.dirY * fwd + ry * strafe) * sp);
      st.bob += dt * (run ? 13 : 8);
    }
    const look = Math.max(-0.5, Math.min(0.5, lookDx));
    rotate(turn * 2.25 * dt + look);
    lookDx = 0;
    if (fireHeld || keys.has("ControlLeft") || keys.has("ControlRight") || keys.has("KeyJ")) tryFire();
    st.seeT -= dt;
    if (st.seeT <= 0) { st.seeT = 0.16; refreshSight(); }
    if (st.grace <= 0) for (let i = 0; i < st.enemies.length; i++) updateEnemy(st.enemies[i], dt);
    updateProjectiles(dt);
    updateDoors(dt);
    for (let i = st.items.length - 1; i >= 0; i--) {
      const it = st.items[i];
      if (Math.hypot(it.x - st.px, it.y - st.py) < 0.52 && collect(it)) st.items.splice(i, 1);
    }
    st.puffs = st.puffs.filter(function (p) { p.life -= dt; return p.life > 0; });
    checkExit();
  }
  function botThink(dt) {
    st.botTime += dt;
    let target = null, best = 1e9;
    for (let i = 0; i < st.enemies.length; i++) {
      const e = st.enemies[i];
      if (e.dead) continue;
      const d = Math.hypot(e.x - st.px, e.y - st.py) + ((e.kind === "moms" || e.kind === "giant") ? 0 : 8);
      if (d < best) { best = d; target = e; }
    }
    if (target) {
      const a = Math.atan2(target.y - st.py, target.x - st.px);
      st.dirX = Math.cos(a); st.dirY = Math.sin(a);
      st.planeX = -st.dirY * 0.66; st.planeY = st.dirX * 0.66;
      fireHeld = true;
      if (Math.hypot(target.x - st.px, target.y - st.py) > 1.8) tryMove(st.dirX * dt * 2.2, st.dirY * dt * 2.2);
    }
    if (st.botTime > 2.2) { fireHeld = false; st.bot = false; st.frozen = true; }
  }

  let pack = function (r, g, b) { return (255 << 24) | (b << 16) | (g << 8) | (r & 255); };
  function shade(c, s) {
    s = Math.max(0, Math.min(1.35, s));
    const r = ((c & 255) * s) | 0, g = (((c >> 8) & 255) * s) | 0, b = (((c >> 16) & 255) * s) | 0;
    return pack(Math.min(255, r), Math.min(255, g), Math.min(255, b));
  }
  function worldShade(c, s) {
    const tint = (st && st.tint) || [1, 1, 1];
    s = Math.max(0, Math.min(1.35, s));
    return pack(
      Math.min(255, ((c & 255) * s * tint[0]) | 0),
      Math.min(255, (((c >> 8) & 255) * s * tint[1]) | 0),
      Math.min(255, (((c >> 16) & 255) * s * tint[2]) | 0)
    );
  }
  let TEX = [];
  function buildTextures() {
    function noise(x, y) { return ((x * 13 + y * 7) * 17) & 15; }
    function metal(gore) {
      const t = new Uint32Array(4096);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        let n = noise(x, y);
        let r = 86 + n, g = 74 + n, b = 62 + (n >> 1);
        if (x % 16 === 0 || y % 32 === 0) { r -= 28; g -= 28; b -= 24; }
        const rx = x % 16, ry = y % 16;
        if ((rx - 4) * (rx - 4) + (ry - 4) * (ry - 4) < 5) { r = 140; g = 128; b = 110; }
        if (gore && ((x * 17 + y * 3) % 29) < 7) { r = 130 + (y % 18); g = 18; b = 14; }
        t[y * 64 + x] = pack(r, g, b);
      }
      return t;
    }
    function brick() {
      const t = new Uint32Array(4096);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const row = (y / 8) | 0, off = (row & 1) ? 8 : 0;
        const mortar = (y % 8 === 0) || ((x + off) % 16 === 0);
        let r = mortar ? 48 : 92 + noise(x, y), g = mortar ? 16 : 28, b = mortar ? 14 : 22;
        t[y * 64 + x] = pack(r, g, b);
      }
      return t;
    }
    function tech() {
      const t = metal(false);
      function pix(x, y, c) { if (x >= 0 && y >= 0 && x < 64 && y < 64) t[y * 64 + x] = c; }
      const bone = pack(210, 196, 160), hole = pack(20, 12, 12);
      for (let y = 22; y < 46; y++) for (let x = 24; x < 40; x++) {
        const dx = x - 32, dy = y - 32;
        if (dx * dx / 70 + dy * dy / 90 < 1) pix(x, y, bone);
      }
      [[28, 30], [34, 30]].forEach(function (p) { pix(p[0], p[1], hole); pix(p[0] + 1, p[1], hole); pix(p[0], p[1] + 1, hole); });
      for (let x = 29; x < 35; x++) pix(x, 38, hole);
      return t;
    }
    function doorTex(exit) {
      const t = new Uint32Array(4096);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        let r = 92, g = 62, b = 36;
        if (x % 10 === 0) { r -= 30; g -= 22; b -= 14; }
        if (y < 4 || y > 59 || x < 3 || x > 60) { r = 48; g = 40; b = 32; }
        if (exit && y > 28 && y < 36) { r = 210; g = 40; b = 90; }
        t[y * 64 + x] = pack(r, g, b);
      }
      return t;
    }
    function stone(blood) {
      const t = new Uint32Array(4096);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const mortar = (x % 16 === 0) || (y % 16 === 0);
        let n = noise(x, y);
        let r = mortar ? 48 : 108 + n, g = mortar ? 40 : 86 + (n >> 1), b = mortar ? 32 : 62;
        if (blood && ((x * 9 + y * 5) % 23) < 4) { r = 120; g = 20; b = 16; }
        t[y * 64 + x] = pack(r, g, b);
      }
      return t;
    }
    function sky() {
      const t = new Uint32Array(4096);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        let r = 70 + (y % 17) * 2, g = 8 + (noise(x, y) % 6), b = 8;
        if (((x * 3 + y) % 19) < 3) { r -= 20; }
        t[y * 64 + x] = pack(r, g, b);
      }
      return t;
    }
    function gradCeil(top, bot) {
      const t = new Uint32Array(4096);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const u = y / 63, n = (noise(x, y) % 7) - 3;
        t[y * 64 + x] = pack(
          Math.max(0, Math.min(255, top[0] + (bot[0] - top[0]) * u + n)),
          Math.max(0, Math.min(255, top[1] + (bot[1] - top[1]) * u + n)),
          Math.max(0, Math.min(255, top[2] + (bot[2] - top[2]) * u + n))
        );
      }
      return t;
    }
    function mottled(base, vary, line) {
      const t = new Uint32Array(4096);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const n = noise(x, y) % vary;
        let r = base[0] + n, g = base[1] + ((n * 3) % vary), b = base[2] + ((n * 5) % vary);
        if (line === "tile" && (x % 16 === 0 || y % 16 === 0)) { r = base[0] - 36; g = base[1] - 36; b = base[2] - 30; }
        if (line === "plank" && (y % 10 === 0 || (x + ((y / 10) | 0) * 7) % 18 === 0)) { r -= 28; g -= 18; b -= 10; }
        if (line === "lane" && y > 30 && y < 35) { r = 196; g = 168; b = 48; }
        if (line === "grass" && ((x * 5 + y * 3) % 11) < 2) { r -= 16; g += 18; b -= 10; }
        t[y * 64 + x] = pack(Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b)));
      }
      return t;
    }
    TEX = [
      metal(false), metal(true), brick(), tech(), doorTex(false), doorTex(true), stone(false), stone(true), sky(),
      gradCeil([48, 6, 18], [10, 0, 8]),
      gradCeil([186, 214, 196], [130, 158, 148]),
      gradCeil([86, 156, 214], [168, 206, 232]),
      gradCeil([96, 42, 12], [36, 14, 6]),
      gradCeil([78, 70, 62], [34, 30, 26]),
      gradCeil([150, 16, 8], [36, 0, 0]),
      mottled([188, 198, 204], 14, "tile"),
      mottled([118, 82, 54], 18, ""),
      mottled([54, 56, 60], 10, "lane"),
      mottled([132, 86, 48], 16, "plank"),
      mottled([42, 104, 38], 20, "grass")
    ];
  }

  const sprites = {};
  function grabCanvas(c) {
    const g = c.getContext("2d");
    return { w:c.width, h:c.height, data:g.getImageData(0, 0, c.width, c.height).data, img:c };
  }
  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return [c, c.getContext("2d")];
  }
  function buildFallbacks() {
    function blob(skin, eye) {
      const pair = makeCanvas(48, 64), g = pair[1];
      g.fillStyle = skin; g.fillRect(10, 16, 28, 32); g.fillRect(8, 40, 10, 16); g.fillRect(30, 40, 10, 16);
      g.fillStyle = eye; g.fillRect(16, 24, 6, 4); g.fillRect(26, 24, 6, 4);
      g.fillStyle = "#111"; g.fillRect(18, 32, 12, 6);
      return grabCanvas(pair[0]);
    }
    function momsFallback() {
      const pair = makeCanvas(64, 84), g = pair[1];
      g.fillStyle = "#e2b15a"; g.beginPath(); g.arc(32, 16, 14, 0, 7); g.fill();
      g.fillStyle = "#f0c090"; g.fillRect(22, 16, 20, 16);
      g.fillStyle = "#3aa0ff"; g.fillRect(24, 22, 6, 3); g.fillRect(34, 22, 6, 3);
      g.fillStyle = "#c01018"; g.fillRect(26, 28, 12, 6);
      g.fillStyle = "#ff4f93"; g.fillRect(16, 32, 32, 18);
      g.fillStyle = "#111";
      const word = "$MOMS";
      for (let i = 0; i < word.length; i++) glyphAt(word[i], 18 + i * 5, 36, 1, "#111", g);
      g.fillStyle = "#3a4e86"; g.fillRect(20, 50, 24, 8);
      g.fillStyle = "#f0c090"; g.fillRect(22, 58, 8, 14); g.fillRect(34, 58, 8, 14);
      g.fillStyle = "#f4f4f4"; g.fillRect(20, 70, 10, 6); g.fillRect(34, 70, 10, 6);
      g.fillStyle = "#8a1020"; g.fillRect(8, 8, 6, 8); g.fillStyle = "#ddd"; g.fillRect(10, 16, 2, 10);
      return grabCanvas(pair[0]);
    }
    function icon(kind) {
      const pair = makeCanvas(18, 18), g = pair[1];
      if (kind === "health") { g.fillStyle = "#f2f2f2"; g.fillRect(2, 2, 14, 14); g.fillStyle = "#e02020"; g.fillRect(7, 4, 4, 10); g.fillRect(4, 7, 10, 4); }
      else if (kind === "armor") { g.fillStyle = "#2a6adf"; g.fillRect(3, 2, 12, 10); g.fillRect(6, 12, 6, 4); }
      else if (kind === "bullets") { g.fillStyle = "#e0b040"; g.fillRect(3, 6, 12, 8); }
      else if (kind === "shells") { g.fillStyle = "#c04028"; g.fillRect(4, 3, 4, 12); g.fillRect(10, 3, 4, 12); }
      else if (kind === "rockets") { g.fillStyle = "#888"; g.fillRect(7, 2, 4, 12); g.fillStyle = "#e04020"; g.fillRect(6, 12, 6, 3); }
      else if (kind === "cells") { g.fillStyle = "#39d0ff"; g.fillRect(4, 4, 10, 10); }
      else if (kind === "chaingun") { g.fillStyle = "#666"; g.fillRect(2, 8, 14, 5); g.fillRect(4, 4, 4, 6); }
      else if (kind === "launcher") { g.fillStyle = "#6a7a48"; g.fillRect(2, 6, 14, 6); }
      else { g.fillStyle = "#2080ff"; g.fillRect(3, 6, 12, 6); g.fillStyle = "#9ad8ff"; g.fillRect(12, 7, 3, 4); }
      return grabCanvas(pair[0]);
    }
    function ball(col) {
      const pair = makeCanvas(14, 14), g = pair[1];
      g.fillStyle = col; g.beginPath(); g.arc(7, 7, 5, 0, 7); g.fill();
      return grabCanvas(pair[0]);
    }
    function rocket() {
      const pair = makeCanvas(16, 8), g = pair[1];
      g.fillStyle = "#9aa"; g.fillRect(2, 2, 10, 4); g.fillStyle = "#e44"; g.fillRect(11, 1, 4, 6);
      return grabCanvas(pair[0]);
    }
    function torch(frame) {
      const pair = makeCanvas(14, 22), g = pair[1];
      g.fillStyle = "#6a5840"; g.fillRect(6, 10, 3, 10);
      g.fillStyle = frame ? "#ffb020" : "#ff6010"; g.fillRect(4, 2, 6, 10);
      g.fillStyle = "#ffe080"; g.fillRect(6, 4, 2, 5);
      return grabCanvas(pair[0]);
    }
    function puffIcon() {
      const pair = makeCanvas(10, 10), g = pair[1];
      g.fillStyle = "#ffd0a0"; g.fillRect(3, 3, 4, 4); g.fillRect(1, 4, 2, 2); g.fillRect(7, 4, 2, 2);
      return grabCanvas(pair[0]);
    }
    sprites.moms = momsFallback();
    sprites.imp = blob("#6a3c24", "#ff3018");
    sprites.pinky = blob("#c42828", "#ffe14a");
    ["health", "armor", "bullets", "shells", "rockets", "cells", "chaingun", "launcher", "plasma"].forEach(function (k) { sprites[k] = icon(k); });
    sprites.fire = ball("#ff8a1a"); sprites.wine = ball("#7a1020"); sprites.rocket = rocket();
    sprites.torch = [torch(0), torch(1)]; sprites.puff = puffIcon();
  }
  function loadArt() {
    const files = { moms:"moms.png", momsWalk:"moms-walk.png", momsDeath:"moms-death.png", imp:"imp.png", pinky:"pinky.png", hands:"hands.png" };
    Object.keys(files).forEach(function (k) {
      const img = new Image();
      img.onload = function () {
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        sprites[k] = { w:c.width, h:c.height, data:g.getImageData(0, 0, c.width, c.height).data, img:c };
      };
      img.src = ASSET + files[k] + "?v=20261006moms";
    });
  }

  let frame = null, pix = null, zbuf = null, buf = null, bctx = null, ctx = null, canvas = null;
  function drawSpan(x, dist, texId, tx, side, open) {
    const lineH = VIEW / dist;
    const shift = lineH * (open || 0);
    const y0 = VIEW / 2 - lineH / 2 - shift;
    const y1 = VIEW / 2 + lineH / 2 - shift;
    const tex = TEX[texId] || TEX[0];
    const dim = Math.max(0.22, 1 - dist * (st.fog || 0.06)) * (side ? 0.78 : 1);
    const ys = Math.max(0, y0 | 0), ye = Math.min(VIEW - 1, y1 | 0);
    const step = 64 / lineH;
    let texPos = (ys - y0) * step;
    for (let y = ys; y <= ye; y++) {
      const ty = (texPos | 0) & 63;
      texPos += step;
      const i = y * W + x;
      if (dist < zbuf[i]) { zbuf[i] = dist; pix[i] = worldShade(tex[ty * 64 + tx], dim); }
    }
  }
  function renderWorld() {
    zbuf.fill(1e9);
    const dirX = st.dirX, dirY = st.dirY, planeX = st.planeX, planeY = st.planeY;
    const horizon = VIEW / 2;
    const texF = TEX[st.floor || 6] || TEX[6], texC = TEX[st.ceil == null ? 8 : st.ceil] || TEX[8];
    for (let y = 0; y < VIEW; y++) {
      if (y === horizon) { for (let x = 0; x < W; x++) pix[y * W + x] = worldShade(pack(40, 16, 16), 1); continue; }
      const rowDist = (0.5 * VIEW) / Math.abs(y - horizon);
      const rayX0 = dirX - planeX, rayY0 = dirY - planeY, rayX1 = dirX + planeX, rayY1 = dirY + planeY;
      const stepX = rowDist * (rayX1 - rayX0) / W, stepY = rowDist * (rayY1 - rayY0) / W;
      let fx = st.px + rowDist * rayX0, fy = st.py + rowDist * rayY0;
      const floor = y > horizon;
      const dim = Math.max(floor ? 0.25 : 0.32, 1 - rowDist * (floor ? 0.075 : 0.05));
      const tex = floor ? texF : texC;
      for (let x = 0; x < W; x++) {
        pix[y * W + x] = worldShade(tex[(((fy * 64) | 0) & 63) * 64 + (((fx * 64) | 0) & 63)], dim);
        fx += stepX; fy += stepY;
      }
    }
    for (let x = 0; x < W; x++) {
      const camX = 2 * x / W - 1;
      const rayDirX = dirX + planeX * camX, rayDirY = dirY + planeY * camX;
      let mapX = st.px | 0, mapY = st.py | 0;
      const deltaX = Math.abs(1 / (rayDirX || 1e-8)), deltaY = Math.abs(1 / (rayDirY || 1e-8));
      let stepX, stepY, sideX, sideY, side = 0;
      if (rayDirX < 0) { stepX = -1; sideX = (st.px - mapX) * deltaX; } else { stepX = 1; sideX = (mapX + 1 - st.px) * deltaX; }
      if (rayDirY < 0) { stepY = -1; sideY = (st.py - mapY) * deltaY; } else { stepY = 1; sideY = (mapY + 1 - st.py) * deltaY; }
      let hit = 0, perp = 0, tx = 0, doorHit = null;
      for (let s = 0; s < 80; s++) {
        if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; }
        else { sideY += deltaY; mapY += stepY; side = 1; }
        if (mapX < 0 || mapY < 0 || mapX >= st.w || mapY >= st.h) break;
        const c = st.grid[mapY][mapX];
        if (c === 5 || c === 6) {
          const open = doorPos(mapX, mapY);
          if (open < 0.985 && !doorHit) {
            const dist = Math.max(0.05, side === 0 ? sideX - deltaX : sideY - deltaY);
            let wallX = side === 0 ? st.py + dist * rayDirY : st.px + dist * rayDirX;
            wallX -= Math.floor(wallX);
            let dtx = (wallX * 64) | 0;
            if (side === 0 && rayDirX > 0) dtx = 63 - dtx;
            if (side === 1 && rayDirY < 0) dtx = 63 - dtx;
            doorHit = { dist:dist, open:open, tx:dtx & 63, tex:c === 6 ? 5 : 4, side:side };
          }
          continue;
        }
        if (c >= 1 && c <= 4) {
          hit = c;
          perp = Math.max(0.05, side === 0 ? sideX - deltaX : sideY - deltaY);
          let wallX = side === 0 ? st.py + perp * rayDirY : st.px + perp * rayDirX;
          wallX -= Math.floor(wallX);
          tx = (wallX * 64) | 0;
          if (side === 0 && rayDirX > 0) tx = 63 - tx;
          if (side === 1 && rayDirY < 0) tx = 63 - tx;
          tx &= 63;
          break;
        }
      }
      if (hit) drawSpan(x, perp, hit - 1, tx, side, 0);
      if (doorHit && (!hit || doorHit.dist < perp + 0.02)) drawSpan(x, doorHit.dist, doorHit.tex, doorHit.tx, doorHit.side, doorHit.open);
    }
    renderSprites();
    bctx.putImageData(frame, 0, 0);
  }
  function pickSprite(e) {
    if (e.spec.sprite !== "moms") return sprites[e.spec.sprite];
    if (e.dead) return sprites.momsDeath || sprites.moms;
    if (e.attackT > 0) return sprites.moms;
    if (((e.anim * 6) | 0) % 2 === 1 && sprites.momsWalk) return sprites.momsWalk;
    return sprites.moms;
  }
  function pushBill(list, x, y, spr, scale, extra) {
    if (!spr) return;
    const sx = x - st.px, sy = y - st.py;
    const inv = 1 / (st.planeX * st.dirY - st.dirX * st.planeY);
    const tx = inv * (st.dirY * sx - st.dirX * sy);
    const ty = inv * (-st.planeY * sx + st.planeX * sy);
    if (ty < 0.08) return;
    list.push({ spr:spr, tx:tx, ty:ty, scale:scale || 1, flash:extra && extra.flash, bob:extra && extra.bob, sink:extra && extra.sink });
  }
  function renderSprites() {
    const list = [];
    for (let i = 0; i < st.enemies.length; i++) {
      const e = st.enemies[i];
      if (e.dead && e.deathT > 12) continue;
      const sc = e.spec.scale * (e.dead ? 1 : 1 + Math.sin(e.anim * 8) * 0.025);
      pushBill(list, e.x, e.y, pickSprite(e), sc, { flash:e.pain > 0, sink:e.dead ? Math.min(12, e.deathT * 20) : 0 });
    }
    for (let i = 0; i < st.items.length; i++) {
      const it = st.items[i];
      pushBill(list, it.x, it.y, sprites[it.kind], 0.42, { bob:Math.sin(st.time * 4 + it.x) * 8 });
    }
    for (let i = 0; i < st.decors.length; i++) {
      const d = st.decors[i];
      const fr = sprites.torch ? sprites.torch[(st.time * 8 | 0) % 2] : null;
      pushBill(list, d.x, d.y, fr, 0.5, null);
    }
    for (let i = 0; i < st.projectiles.length; i++) {
      const p = st.projectiles[i];
      pushBill(list, p.x, p.y, sprites[p.kind], p.kind === "rocket" ? 0.28 : 0.22, null);
    }
    for (let i = 0; i < st.puffs.length; i++) pushBill(list, st.puffs[i].x, st.puffs[i].y, sprites.puff, 0.2, null);
    list.sort(function (a, b) { return b.ty - a.ty; });
    for (let n = 0; n < list.length; n++) blit(list[n]);
  }
  function blit(s) {
    const spr = s.spr, h = Math.abs((VIEW / s.ty) * s.scale) | 0;
    const w = Math.abs(h * (spr.w / spr.h)) | 0;
    if (h < 2 || w < 2 || h > 2000) return;
    const screenX = ((W / 2) * (1 + s.tx / s.ty)) | 0;
    const y0 = ((VIEW - h) / 2 + (s.bob || 0) + (s.sink || 0)) | 0;
    const x0 = (screenX - w / 2) | 0;
    const dim = s.flash ? 1 : Math.max(0.34, 1 - s.ty * 0.055);
    for (let sx = 0; sx < w; sx++) {
      const x = x0 + sx;
      if (x < 0 || x >= W) continue;
      const u = ((sx * spr.w) / w) | 0;
      for (let sy = 0; sy < h; sy++) {
        const y = y0 + sy;
        if (y < 0 || y >= VIEW) continue;
        const v = ((sy * spr.h) / h) | 0;
        const o = (v * spr.w + u) * 4;
        if (spr.data[o + 3] < 28) continue;
        const i = y * W + x;
        if (s.ty >= zbuf[i]) continue;
        let r = spr.data[o], g = spr.data[o + 1], b = spr.data[o + 2];
        if (s.flash) { r = g = b = 255; }
        else { r = (r * dim) | 0; g = (g * dim) | 0; b = (b * dim) | 0; }
        pix[i] = pack(r, g, b);
        zbuf[i] = s.ty;
      }
    }
  }

  function glyphAt(ch, x, y, scale, fill, context) {
    const g = GLYPH[ch] || GLYPH[" "];
    const c = context || ctx;
    c.fillStyle = fill;
    for (let r = 0; r < 7; r++) {
      const bits = g[r];
      for (let col = 0; col < 5; col++) if (bits & (1 << (4 - col))) c.fillRect(x + col * scale, y + r * scale, scale, scale);
    }
  }
  function text(str, x, y, scale, col, align) {
    str = String(str).toUpperCase();
    const w = str.length * 6 * scale - scale;
    if (align === "center") x -= w / 2;
    else if (align === "right") x -= w;
    for (let i = 0; i < str.length; i++) glyphAt(str[i], x + i * 6 * scale, y, scale, col);
  }
  function logoChar(ch, x, y, scale, fill, hi) {
    const o = Math.max(1, (scale * 0.16) | 0);
    glyphAt(ch, x - o, y, scale, "#140000");
    glyphAt(ch, x + o, y, scale, "#140000");
    glyphAt(ch, x, y - o, scale, "#140000");
    glyphAt(ch, x, y + o, scale, "#140000");
    glyphAt(ch, x, y, scale, fill);
    if (hi) {
      const g = GLYPH[ch];
      ctx.fillStyle = hi;
      for (let r = 0; r < 2; r++) {
        const bits = g[r];
        for (let col = 0; col < 5; col++) if (bits & (1 << (4 - col))) ctx.fillRect(x + col * scale, y + r * scale, scale, scale);
      }
    }
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function blackAmt(t, start) {
    const u = (t - start) / 0.4;
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    return Math.sin(u * 36) > 0 ? Math.min(1, 0.4 + u) : u * 0.12;
  }
  function titleWord(t) {
    if (t < 1.2) return "DOOM";
    if (t < 3.5) return "DOOM";
    return "MOMS";
  }
  function drawTitle() {
    const t = titleT;
    ctx.fillStyle = "#070000"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#4a0000"; ctx.fillRect(0, 0, W, 22);
    ctx.fillStyle = "#1a0000"; ctx.fillRect(0, 22, W, 16);
    ctx.fillStyle = "#240808"; ctx.fillRect(0, 188, W, 62);
    const slotW = 56, origin = (W - 4 * slotW) / 2 + 6, y = 48, base = 7;
    const b = [blackAmt(t, 1.35), blackAmt(t, 1.75), blackAmt(t, 2.15)];
    const slide = (function () { const u = clamp((t - 2.55) / 0.55, 0, 1); return u * u * (3 - 2 * u); })();
    const ghostA = 1 - slide;
    const doom = ["D", "O", "O"];
    function place(ch, slot, alpha, black, scale, white, dropI) {
      if (alpha < 0.03) return;
      const drop = dropI == null ? 1 : clamp((t - dropI * 0.12) / 0.2, 0, 1);
      const sc = base * scale;
      const cx = origin + slot * slotW + (5 * base) / 2;
      const cy = y + (7 * base) / 2 + (1 - drop) * -30;
      const px = cx - (5 * sc) / 2, py = cy - (7 * sc) / 2;
      ctx.globalAlpha = alpha * drop;
      const fill = white ? "#fff" : black > 0.82 ? "#000" : black > 0.35 ? "#2a0000" : "#d10e0e";
      logoChar(ch, px, py, sc, fill, white || black > 0.2 ? null : "#ff6a32");
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 3; i++) place(doom[i], i, ghostA, b[i], 1, false, i);
    place("M", 3 + (0 - 3) * slide, 1, 0, 1, false, 3);
    [["O", 3.2], ["M", 3.42], ["S", 3.64]].forEach(function (p, i) {
      const u = (t - p[1]) / 0.22;
      if (u < 0) return;
      place(p[0], i + 1, Math.min(1, u * 2), 0, u >= 1 ? 1 : 1.85 - 0.85 * Math.min(1, u), u < 0.3, null);
    });
    if (t > 4.05) {
      const a = Math.min(1, (t - 4.05) / 0.35);
      ctx.globalAlpha = a;
      text("TEN LEVELS", W / 2, 118, 2, "#ffb0a0", "center");
      text("SHE IS THE ONE YOU DROP", W / 2, 138, 1, "#c8c0b8", "center");
      ctx.globalAlpha = 1;
      if (sprites.moms && sprites.moms.img && sprites.moms.w > 80) {
        const im = sprites.moms.img, dh = 100, dw = dh * (im.width / im.height);
        ctx.globalAlpha = a;
        ctx.drawImage(im, 16, H - dh - 28, dw, dh);
        ctx.globalAlpha = 1;
      }
    }
    if (Math.sin(t * 6) > 0 || t < 4) text(t > 4 ? "CLICK OR ENTER" : "", W / 2, 168, 1, "#fff", "center");
    const lv = LEVELS[pick - 1];
    text("LEVEL " + pick + "  " + lv.name, W / 2, 206, 1, "#f0d080", "center");
    text("KEYS 1-0 PICK A LEVEL", W / 2, 220, 1, "#8a8078", "center");
    text("HIGH " + high, W / 2, 234, 1, "#6a6460", "center");
  }
  function drawWeapon() {
    const bob = Math.sin(st.bob) * 6, kick = st.kick;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, VIEW); ctx.clip();
    if (st.weapon === 0 && sprites.hands && sprites.hands.img && sprites.hands.w > 80) {
      const im = sprites.hands.img, dw = W * 0.9, dh = dw * (im.height / im.width);
      ctx.drawImage(im, (W - dw) / 2, VIEW - dh + 16 + bob - kick * 0.4, dw, dh);
    } else drawGunShape(st.weapon, bob, kick);
    if (st.flash > 0 && st.weapon !== 0) {
      ctx.fillStyle = st.weapon === 5 ? "#9ad8ff" : "#ffe08a";
      ctx.fillRect(W / 2 - 8, VIEW - 86 + bob - kick, 16, 12);
    }
    ctx.restore();
  }
  function drawGunShape(gun, bob, kick) {
    const x = W / 2 + 36, y = VIEW - 4 + bob - kick;
    ctx.fillStyle = "#c49a78";
    ctx.fillRect(x - 10, y - 28, 26, 32);
    if (gun === 1) { ctx.fillStyle = "#5c5c5c"; ctx.fillRect(x - 2, y - 52, 8, 28); ctx.fillStyle = "#222"; ctx.fillRect(x - 3, y - 56, 10, 6); }
    else if (gun === 2) { ctx.fillStyle = "#5a4632"; ctx.fillRect(x - 8, y - 70, 16, 48); ctx.fillStyle = "#9a9a9a"; ctx.fillRect(x - 10, y - 58, 20, 6); }
    else if (gun === 3) { ctx.fillStyle = "#2c2c2c"; ctx.fillRect(x - 16, y - 40, 34, 14); ctx.fillRect(x + 8, y - 52, 8, 18); }
    else if (gun === 4) { ctx.fillStyle = "#66704a"; ctx.fillRect(x - 12, y - 46, 28, 14); ctx.fillStyle = "#444"; ctx.fillRect(x + 10, y - 54, 8, 12); }
    else { ctx.fillStyle = "#1a3a66"; ctx.fillRect(x - 8, y - 42, 22, 12); ctx.fillStyle = "#9ad8ff"; ctx.fillRect(x + 12, y - 40, 8, 8); }
  }
  function drawFace(x, y) {
    const hp = st.health, pain = st.pain > 0;
    ctx.fillStyle = "#0c0c0c"; ctx.fillRect(x, y, 36, 36);
    ctx.fillStyle = "#e2b07a"; ctx.fillRect(x + 8, y + 8, 20, 22);
    ctx.fillStyle = "#c49a55"; ctx.fillRect(x + 6, y + 4, 24, 8);
    ctx.fillStyle = pain ? "#fff" : "#20160f";
    const look = pain ? 1 : 0;
    ctx.fillRect(x + 11, y + 14, 4, 4 + look); ctx.fillRect(x + 21, y + 14, 4, 4 + look);
    ctx.fillStyle = "#901818";
    const mouth = hp < 30 || pain ? 8 : 4;
    ctx.fillRect(x + 13, y + 24, 10, mouth);
    if (hp < 60) { ctx.fillStyle = "#901414"; ctx.fillRect(x + 8, y + 20, 3, 5); ctx.fillRect(x + 26, y + 12, 3, 4); }
    if (hp < 30) { ctx.fillRect(x + 14, y + 10, 8, 3); ctx.fillRect(x + 10, y + 28, 4, 3); }
  }
  function panel(x, y, w, h) {
    ctx.fillStyle = "#2a2a2a"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#6e6e6e"; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = "#111"; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
  }
  function drawHud() {
    ctx.fillStyle = "#1a1a1a"; ctx.fillRect(0, VIEW, W, HUD);
    const y = VIEW + 2;
    panel(2, y, 52, 46); panel(56, y, 78, 46); panel(136, y, 62, 46);
    panel(200, y, 40, 46); panel(242, y, 70, 46); panel(314, y, 84, 46);
    const gun = GUNS[st.weapon];
    const shown = gun && gun.ammo ? st.ammo[gun.ammo] : st.ammo.bull;
    text(String(shown), 28, y + 8, 2, "#ff2a1a", "center");
    text("AMMO", 28, y + 30, 1, "#c8c8c8", "center");
    text(st.health + "%", 95, y + 8, 2, "#ff2a1a", "center");
    text("HEALTH", 95, y + 30, 1, "#c8c8c8", "center");
    const arms = [[2, 1], [3, 2], [4, 3], [5, 4], [6, 5], [7, -1]];
    for (let i = 0; i < arms.length; i++) {
      const n = arms[i][0], wpn = arms[i][1];
      const owned = wpn >= 0 && st.owned[wpn];
      const on = wpn === st.weapon;
      text(String(n), 146 + (i % 3) * 16, y + 8 + ((i / 3) | 0) * 16, 1, on ? "#ff2a1a" : owned ? "#f0f0f0" : "#4a4a4a");
    }
    text("ARMS", 166, y + 36, 1, "#c8c8c8", "center");
    drawFace(202, y + 4);
    text(st.armor + "%", 277, y + 8, 2, "#ff2a1a", "center");
    text("ARMOR", 277, y + 30, 1, "#c8c8c8", "center");
    const rows = [["BULL", st.ammo.bull, st.max.bull], ["SHEL", st.ammo.shel, st.max.shel], ["RCKT", st.ammo.rckt, st.max.rckt], ["CELL", st.ammo.cell, st.max.cell]];
    for (let i = 0; i < rows.length; i++) text(rows[i][0] + " " + rows[i][1] + "/" + rows[i][2], 318, y + 4 + i * 10, 1, "#d8d8d8");
  }
  function drawMap() {
    if (!st.mapOn && st.mapFlash <= 0) return;
    const s = 3, ox = 6, oy = 16;
    ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(ox - 2, oy - 2, st.w * s + 4, st.h * s + 4);
    for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) {
      const c = st.grid[y][x];
      if (!c) continue;
      ctx.fillStyle = c === 6 ? (momsLeft() ? "#665533" : "#ffcc44") : c >= 5 ? "#887766" : "#5c534c";
      ctx.fillRect(ox + x * s, oy + y * s, s, s);
    }
    ctx.fillStyle = "#fff"; ctx.fillRect(ox + (st.px | 0) * s, oy + (st.py | 0) * s, s, s);
    for (let i = 0; i < st.enemies.length; i++) {
      const e = st.enemies[i];
      if (e.dead) continue;
      ctx.fillStyle = (e.kind === "moms" || e.kind === "giant") ? "#ff77cc" : "#ffb040";
      ctx.fillRect(ox + (e.x | 0) * s, oy + (e.y | 0) * s, s, s);
    }
  }
  function drawWorld() {
    const ox = st.shake > 0 ? ((Math.random() * 6 - 3) | 0) : 0;
    const oy = st.shake > 0 ? ((Math.random() * 4 - 2) | 0) : 0;
    renderWorld();
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, VIEW);
    ctx.drawImage(buf, ox, oy);
    drawWeapon();
    if (st.pain > 0) { ctx.fillStyle = "rgba(160,0,0," + Math.min(0.45, st.pain) + ")"; ctx.fillRect(0, 0, W, VIEW); }
    const cx = W / 2, cy = VIEW / 2;
    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.fillRect(cx - 5, cy, 3, 1); ctx.fillRect(cx + 2, cy, 3, 1);
    ctx.fillRect(cx, cy - 5, 1, 3); ctx.fillRect(cx, cy + 2, 1, 3);
    const mc = momsCount();
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(4, 4, 168, 12);
    text("LV " + (st.index + 1) + "  MOMS " + mc.dead + "/" + mc.all, 8, 6, 1, "#ffb0a8");
    text(String(st.score), W - 8, 6, 1, "#ffd27a", "right");
    if (st.msgT > 0) text(st.msg, W / 2, VIEW - 18, 1, "#ffe7a0", "center");
    drawMap();
    drawHud();
  }
  function drawCard() {
    ctx.fillStyle = "#070000"; ctx.fillRect(0, 0, W, H);
    const lv = LEVELS[cardIndex];
    text("LEVEL " + (cardIndex + 1), W / 2, 70, 2, "#ff2a1a", "center");
    text(lv.name, W / 2, 100, 2, "#f4f4f4", "center");
    text(lv.line, W / 2, 130, 1, "#c8b8a8", "center");
    text("DROP EVERY MOMS", W / 2, 160, 1, "#ffb0a8", "center");
    if (st) text("SCORE " + st.score, W / 2, 184, 1, "#ffd27a", "center");
  }
  function drawDead() {
    drawWorld();
    ctx.fillStyle = "rgba(40,0,0,.45)"; ctx.fillRect(0, 0, W, VIEW);
    const line = (st.lastSrc === "moms" || st.lastSrc === "giant") ? "MOMS GOT YOU" : "YOU DIED";
    text(line, W / 2, 80, 2, "#ff2a1a", "center");
    text("ENTER RETRIES", W / 2, 110, 1, "#fff", "center");
  }
  function drawWin() {
    ctx.fillStyle = "#070000"; ctx.fillRect(0, 0, W, H);
    text("MOMS DOWN", W / 2, 70, 2, "#ff2a1a", "center");
    text("THE HOUSE IS QUIET", W / 2, 100, 1, "#f4f4f4", "center");
    text("SCORE " + (st ? st.score : 0), W / 2, 130, 2, "#ffd27a", "center");
    text("HIGH " + high, W / 2, 156, 1, "#c8c8c8", "center");
    text("ENTER", W / 2, 190, 1, "#fff", "center");
  }
  function drawPause() {
    drawWorld();
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(0, 0, W, VIEW);
    text("PAUSED", W / 2, 90, 2, "#fff", "center");
  }
  function draw() {
    if (mode === "title") drawTitle();
    else if (mode === "card") drawCard();
    else if (mode === "win") drawWin();
    else if (mode === "dead") drawDead();
    else if (mode === "pause") drawPause();
    else if (st) drawWorld();
    publish();
  }
  function publish() {
    const el = document.getElementById("report");
    if (!el) return;
    const payload = {
      mode: mode, word: titleWord(titleT), errs: window.__errs || [],
      art: {
        moms: !!(sprites.moms && sprites.moms.w > 80),
        walk: !!(sprites.momsWalk && sprites.momsWalk.w > 80),
        death: !!(sprites.momsDeath && sprites.momsDeath.w > 80),
        imp: !!(sprites.imp && sprites.imp.w > 80),
        pinky: !!(sprites.pinky && sprites.pinky.w > 80),
        hands: !!(sprites.hands && sprites.hands.w > 80)
      },
      level: st ? LEVELS[st.index].name : null,
      health: st ? st.health : null,
      moms: st ? momsLeft() : null,
      score: st ? st.score : null,
      px: st ? +st.px.toFixed(2) : null,
      py: st ? +st.py.toFixed(2) : null
    };
    el.textContent = JSON.stringify(payload);
    window.__moms = payload;
  }

  function showCard(i) { mode = "card"; cardT = 0; cardIndex = i; card = LEVELS[i]; }
  function enterPlay() {
    begin(cardIndex, pendingCarry); pendingCarry = null;
    fireHeld = false; lookDx = 0;
    mode = "play";
  }
  function startGame() { unlockAudio(); pendingCarry = null; showCard(pick - 1); }
  function retry() {
    if (!st) return;
    pendingCarry = { score:st.scoreMark, health:st.healthMark, armor:st.armorMark, ammo:clone(st.ammoMark), owned:clone(st.ownedMark), weapon:st.weaponMark };
    begin(st.index, pendingCarry); pendingCarry = null; mode = "play";
  }
  function cycle(dir) {
    for (let k = 1; k <= 6; k++) {
      const i = (st.weapon + dir * k + 60) % 6;
      if (st.owned[i]) { st.weapon = i; return; }
    }
  }
  function unlockAudio() {
    audioOn = true;
    try { ac(); } catch (e) {}
  }
  function ac() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
  function tone(freq, dur, type, gain, slide) {
    if (!audioOn || muted) return;
    try {
      const a = ac(), t = a.currentTime, o = a.createOscillator(), g = a.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  function noise(dur, gain) {
    if (!audioOn || muted) return;
    try {
      const a = ac(), n = a.createBuffer(1, Math.max(1, (a.sampleRate * dur) | 0), a.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource(); src.buffer = n;
      const g = a.createGain(), f = a.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 900;
      g.gain.setValueAtTime(gain, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
      src.connect(f); f.connect(g); g.connect(a.destination); src.start();
    } catch (e) {}
  }
  function sfxShot(w) { if (w === 2) noise(0.16, 0.22); else if (w === 3) noise(0.05, 0.12); else if (w === 5) tone(880, 0.06, "square", 0.05, 220); else noise(0.07, 0.14); }
  function sfxRocket() { noise(0.2, 0.2); tone(180, 0.25, "sawtooth", 0.06, 60); }
  function sfxBoom() { noise(0.28, 0.25); }
  function sfxPunch() { noise(0.06, 0.12); }
  function sfxPickup() { tone(880, 0.06, "square", 0.05); tone(1320, 0.08, "square", 0.04); }
  function sfxDoor() { tone(90, 0.12, "square", 0.05, 50); }
  function sfxPain() { tone(140, 0.12, "sawtooth", 0.06, 70); }
  function sfxDeath() { tone(200, 0.4, "sawtooth", 0.07, 40); }
  function sfxMom() { noise(0.12, 0.08); tone(160, 0.2, "sawtooth", 0.05, 55); }
  function sfxImp() { tone(520, 0.08, "square", 0.04, 200); }
  function sfxWin() { tone(330, 0.1, "square", 0.05); tone(440, 0.14, "square", 0.05); }
  function onKey(e) {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].indexOf(e.code) >= 0) e.preventDefault();
    if (e.repeat) return;
    unlockAudio();
    if (mode === "title" && e.code.indexOf("Digit") === 0) {
      const n = +e.code.slice(5); pick = n === 0 ? 10 : n; return;
    }
    if (e.code === "Enter" || (e.code === "Space" && mode !== "play")) {
      if (mode === "title") startGame();
      else if (mode === "card") enterPlay();
      else if (mode === "dead") retry();
      else if (mode === "win") { mode = "title"; titleT = reduceMotion ? 100 : 0; }
      else if (mode === "pause") mode = "play";
      return;
    }
    if (mode !== "play" || !st) return;
    if (e.code === "KeyE" || e.code === "Space") tryUse();
    if (e.code === "KeyR") retry();
    if (e.code === "Tab") st.mapOn = !st.mapOn;
    if (e.code === "KeyN") muted = !muted;
    if (e.code.indexOf("Digit") === 0) {
      const n = +e.code.slice(5);
      if (n >= 1 && n <= 6) { if (st.owned[n - 1]) st.weapon = n - 1; else message("NOT IN THE ARMS"); }
    }
  }
  function boot() {
    canvas = document.getElementById("g");
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    buf = document.createElement("canvas");
    buf.width = W; buf.height = VIEW;
    bctx = buf.getContext("2d", { willReadFrequently: true });
    frame = bctx.createImageData(W, VIEW);
    pix = new Uint32Array(frame.data.buffer, frame.data.byteOffset, W * VIEW);
    zbuf = new Float32Array(W * VIEW);
    const test = bctx.createImageData(1, 1);
    const u = new Uint32Array(test.data.buffer, test.data.byteOffset, 1);
    u[0] = pack(10, 20, 30);
    if (test.data[0] !== 10 || test.data[1] !== 20 || test.data[2] !== 30) {
      pack = function (r, g, b) { return (255 << 24) | ((r & 255) << 16) | ((g & 255) << 8) | (b & 255); };
    }
    buildTextures();
    buildFallbacks();
    loadArt();
    try { high = +localStorage.getItem("momsHigh") || 0; } catch (e) {}
    addEventListener("keydown", function (e) { keys.add(e.code); onKey(e); });
    addEventListener("keyup", function (e) { keys.delete(e.code); });
    function tryLock() {
      if (!canvas.requestPointerLock || document.pointerLockElement === canvas) return;
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(function () {});
      } catch (err) {}
    }
    canvas.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      unlockAudio();
      tryLock();
      if (mode === "title") { startGame(); return; }
      if (mode === "card") { enterPlay(); return; }
      if (mode === "dead") { retry(); return; }
      if (mode === "win") { mode = "title"; titleT = 100; return; }
      if (mode === "pause") { mode = "play"; return; }
      if (mode === "play") fireHeld = true;
    });
    addEventListener("mouseup", function () { fireHeld = false; });
    addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      if (mode !== "play" || !st || st.frozen) return;
      const mx = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
      if (!mx) return;
      lookDx += mx * 0.0036;
    }, true);
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      if (mode === "play") cycle(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    const stick = document.getElementById("stick"), nub = document.getElementById("nub");
    if (stick) {
      let sid = null;
      function moveStick(e) {
        const r = stick.getBoundingClientRect();
        let x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
        const m = Math.hypot(x, y), max = r.width / 2;
        if (m > max) { x *= max / m; y *= max / m; }
        axisX = x / max; axisY = y / max;
        nub.style.left = (38 + x) + "px"; nub.style.top = (38 + y) + "px";
      }
      stick.addEventListener("pointerdown", function (e) { sid = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); unlockAudio(); });
      stick.addEventListener("pointermove", function (e) { if (e.pointerId === sid) moveStick(e); });
      function endStick() { sid = null; axisX = 0; axisY = 0; nub.style.left = "38px"; nub.style.top = "38px"; }
      stick.addEventListener("pointerup", endStick); stick.addEventListener("pointercancel", endStick);
    }
    let lookTouch = null;
    canvas.addEventListener("touchstart", function (e) {
      if (e.target !== canvas) return;
      lookTouch = { x:e.touches[0].clientX, y:e.touches[0].clientY };
      if (mode === "title") startGame();
    }, { passive: false });
    canvas.addEventListener("touchmove", function (e) {
      if (!lookTouch) return;
      e.preventDefault();
      const t = e.touches[0];
      lookDx += (t.clientX - lookTouch.x) * 0.012;
      lookTouch = { x:t.clientX, y:t.clientY };
    }, { passive: false });
    canvas.addEventListener("touchend", function () { lookTouch = null; });
    function hold(id, down, up) {
      const b = document.getElementById(id); if (!b) return;
      b.addEventListener("pointerdown", function (e) { e.preventDefault(); e.stopPropagation(); unlockAudio(); down(); });
      b.addEventListener("pointerup", function () { if (up) up(); });
      b.addEventListener("pointercancel", function () { if (up) up(); });
    }
    hold("btn-fire", function () {
      if (mode === "title") startGame(); else if (mode === "card") enterPlay(); else fireHeld = true;
    }, function () { fireHeld = false; });
    hold("btn-use", function () { if (mode === "play") tryUse(); else if (mode === "title") startGame(); });
    hold("btn-gun", function () { if (mode === "play") cycle(1); });
    function fit() {
      const help = document.getElementById("help");
      const availW = document.documentElement.clientWidth;
      const availH = Math.max(1, document.documentElement.clientHeight - (help ? help.offsetHeight : 0));
      const scale = Math.min(availW / W, availH / H);
      canvas.style.width = Math.max(1, Math.floor(W * scale)) + "px";
      canvas.style.height = Math.max(1, Math.floor(H * scale)) + "px";
    }
    addEventListener("resize", fit);
    if (window.visualViewport) visualViewport.addEventListener("resize", fit);
    const stage = document.getElementById("stage");
    if (window.ResizeObserver && stage) new ResizeObserver(fit).observe(stage);
    fit();
    if (BOT || params.get("lookat") === "1") {
      st = { health:1 };
      startGame(); enterPlay();
      if (params.get("lookat") === "1") {
        const mom = st.enemies.filter(function (e) { return e.kind === "moms" || e.kind === "giant"; })[0];
        if (mom) {
          const spots = [[-2.2, 0], [2.2, 0], [0, -2.2], [0, 2.2], [-1.5, 0.4]];
          for (let i = 0; i < spots.length; i++) {
            const x = mom.x + spots[i][0], y = mom.y + spots[i][1];
            if (!solidAt(x, y, 0.18)) { st.px = x; st.py = y; break; }
          }
          const a = Math.atan2(mom.y - st.py, mom.x - st.px);
          st.dirX = Math.cos(a); st.dirY = Math.sin(a);
          st.planeX = -st.dirY * 0.66; st.planeY = st.dirX * 0.66;
        }
        st.frozen = true;
      } else {
        st.god = true; st.bot = true; st.botTime = 0;
      }
    }
    let last = 0;
    function frameLoop(now) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      try {
        if (mode === "title" && (titleHold == null || titleHold === "")) titleT += dt;
        else if (mode === "card") { cardT += dt; if (cardT > 2.4) enterPlay(); }
        else if (mode === "dead") deadT += dt;
        else if (mode === "win") winT += dt;
        else if (mode === "play") update(dt);
        draw();
      } catch (err) {
        root.__errs.push(String(err && err.stack || err));
        const el = document.getElementById("report");
        if (el) el.textContent = window.__errs.join("\n");
      }
      requestAnimationFrame(frameLoop);
    }
    requestAnimationFrame(frameLoop);
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { selfTest: selfTest, LEVELS: LEVELS };
  if (typeof document !== "undefined") boot();
})();
