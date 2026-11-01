/**
 * $PORK live pasture — one line of pigs.
 * Buys graze the line up. Sells graze it down.
 * Pigs walk and graze on the grass; they do not float.
 */
(function () {
  var FIELD = document.getElementById('herd');
  var TAPE = document.getElementById('tape');
  var HUD = {
    price: document.getElementById('hudPrice'),
    chg: document.getElementById('hudChg'),
    buys: document.getElementById('hudBuys'),
    sells: document.getElementById('hudSells'),
    vol: document.getElementById('hudVol'),
    mcap: document.getElementById('hudMcap'),
    pulse: document.getElementById('hudPulse'),
    status: document.getElementById('hudStatus')
  };

  var WALK = [
    '/assets/images/pork-pasture/walk/0.png',
    '/assets/images/pork-pasture/walk/1.png',
    '/assets/images/pork-pasture/walk/2.png',
    '/assets/images/pork-pasture/walk/3.png'
  ];
  var GRAZE = [
    '/assets/images/pork-pasture/graze/0.png',
    '/assets/images/pork-pasture/graze/1.png',
    '/assets/images/pork-pasture/graze/2.png',
    '/assets/images/pork-pasture/graze/0.png'
  ];
  var POLL_MS = 12000;
  var FRESH_MS = 15 * 60 * 1000;
  var WALK_FPS = 7;
  var GRAZE_FPS = 3.2;
  var WALK_SPEED = 5.8;
  var TURN_SPEED = 130;
  var ARRIVE = 0.45;

  var actors = {};
  var firstPaint = true;
  var lastTick = 0;

  WALK.concat(GRAZE).forEach(function (src) {
    var im = new Image();
    im.src = src;
  });

  function hash(s) {
    var h = 2166136261;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function unit(seed, n) {
    return (hash(seed + ':' + n) % 10000) / 10000;
  }

  function fmtUsd(n, digits) {
    n = Number(n) || 0;
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
    if (n >= 1) return '$' + n.toFixed(digits == null ? 2 : digits);
    if (n > 0) return '$' + n.toPrecision(3);
    return '$0';
  }

  function fmtPrice(n) {
    n = Number(n) || 0;
    if (!n) return '—';
    if (n < 0.000001) return n.toExponential(2);
    return n.toFixed(11).replace(/0+$/, '').replace(/\.$/, '');
  }

  function fmtPct(n) {
    n = Number(n) || 0;
    var sign = n > 0 ? '+' : '';
    return sign + n.toFixed(2) + '%';
  }

  function ago(ts) {
    var t = Date.parse(ts || 0);
    if (!t) return '';
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return Math.floor(s) + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    return Math.floor(s / 3600) + 'h';
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function pigSize(p) {
    if (p.whale) return 56 + Math.min(22, p.usd / 8);
    return 38 + Math.min(14, Math.sqrt(Math.max(1, p.usd)) * 1.4);
  }

  function angDiff(a, b) {
    var d = ((b - a + 540) % 360) - 180;
    return d;
  }

  function approachAng(cur, target, maxStep) {
    var d = angDiff(cur, target);
    if (Math.abs(d) <= maxStep) return target;
    return cur + (d > 0 ? maxStep : -maxStep);
  }

  function chartLine(trades) {
    var list = (trades || [])
      .slice()
      .filter(function (t) {
        return t && t.id && (t.side === 'buy' || t.side === 'sell');
      })
      .sort(function (a, b) {
        return Date.parse(a.ts || 0) - Date.parse(b.ts || 0);
      });
    if (list.length > 20) list = list.slice(-20);

    var y = 68;
    var pts = [];
    var i;
    for (i = 0; i < list.length; i++) {
      var t = list[i];
      var mag = 3.4 + Math.min(9, Math.log10((t.usd || 1) + 1) * 3.8);
      y += t.side === 'buy' ? -mag : mag;
      y = clamp(y, 20, 86);
      pts.push({
        id: t.id,
        side: t.side,
        usd: t.usd,
        ts: t.ts,
        tx: t.tx,
        etherscan: t.etherscan,
        whale: !!t.whale,
        x: 8 + (list.length < 2 ? 42 : (i / (list.length - 1)) * 84),
        y: y
      });
    }
    for (i = 0; i < pts.length; i++) {
      var cur = pts[i];
      var nxt = pts[i + 1] || pts[i - 1] || cur;
      cur.rot = (Math.atan2(nxt.x - cur.x, -(nxt.y - cur.y)) * 180) / Math.PI;
    }
    return pts;
  }

  function spawnAt(p, from) {
    var el = document.createElement('button');
    el.type = 'button';
    el.id = 'pig-' + p.id;
    el.className = 'pig pig-' + p.side + (p.whale ? ' pig-whale' : '');
    el.innerHTML = '<span class="hoof"></span><img alt="" src="' + GRAZE[0] + '">';
    FIELD.appendChild(el);
    var startX = from ? from.x : p.x;
    var startY = from ? from.y : p.y;
    var startRot = from ? from.rot : p.rot;
    var a = {
      id: p.id,
      el: el,
      img: el.querySelector('img'),
      x: startX,
      y: startY,
      tx: p.x,
      ty: p.y,
      rot: startRot,
      trot: p.rot,
      state: firstPaint ? 'graze' : 'walk',
      frame: Math.floor(unit(p.id, 3) * GRAZE.length),
      acc: unit(p.id, 4),
      hold: 0,
      size: pigSize(p),
      side: p.side,
      leaving: false,
      href: p.etherscan || '',
      title: ''
    };
    actors[p.id] = a;
    return a;
  }

  function setTargets(data) {
    var pigs = chartLine(data.trades);
    var seen = {};
    var lastActor = null;
    var i;
    var ids = Object.keys(actors);
    for (i = 0; i < ids.length; i++) {
      if (actors[ids[i]] && !actors[ids[i]].leaving) lastActor = actors[ids[i]];
    }

    pigs.forEach(function (p) {
      seen[p.id] = true;
      var a = actors[p.id];
      if (!a) a = spawnAt(p, firstPaint ? null : lastActor);
      a.tx = p.x;
      a.ty = p.y;
      a.trot = p.rot;
      a.side = p.side;
      a.size = pigSize(p);
      a.href = p.etherscan || '';
      a.title =
        (p.side === 'buy' ? 'BUY · graze up' : 'SELL · graze down') +
        ' · ' +
        fmtUsd(p.usd) +
        (p.ts ? ' · ' + ago(p.ts) : '');
      a.fresh = !!(p.ts && Date.now() - Date.parse(p.ts) < FRESH_MS);
      a.el.dataset.href = a.href;
      a.el.title = a.title;
      lastActor = a;
    });

    Object.keys(actors).forEach(function (id) {
      if (seen[id]) return;
      var a = actors[id];
      if (a.leaving) return;
      a.leaving = true;
      a.tx = clamp(a.x + (a.side === 'buy' ? -4 : 4), -8, 108);
      a.ty = clamp(a.y + 10, 8, 110);
    });

    firstPaint = false;
  }

  function paintActor(a) {
    a.el.style.left = a.x + '%';
    a.el.style.top = a.y + '%';
    a.el.style.width = a.size + 'px';
    a.el.style.setProperty('--rot', a.rot.toFixed(1) + 'deg');
    a.el.className =
      'pig pig-' +
      a.side +
      ' pig-' +
      a.state +
      (a.fresh ? ' pig-fresh' : '') +
      (a.leaving ? ' pig-leave' : '');
  }

  function stepActor(a, dt) {
    var dx = a.tx - a.x;
    var dy = a.ty - a.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var wantRot = dist > ARRIVE ? (Math.atan2(dx, -dy) * 180) / Math.PI : a.trot;
    a.rot = approachAng(a.rot, wantRot, TURN_SPEED * dt);

    if (dist > ARRIVE) {
      a.state = 'walk';
      var step = WALK_SPEED * dt;
      if (step > dist) step = dist;
      a.x += (dx / dist) * step;
      a.y += (dy / dist) * step;
      a.acc += dt * WALK_FPS;
      while (a.acc >= 1) {
        a.acc -= 1;
        a.frame = (a.frame + 1) % WALK.length;
      }
      if (a.img.getAttribute('src') !== WALK[a.frame]) a.img.src = WALK[a.frame];
    } else {
      a.x = a.tx;
      a.y = a.ty;
      a.state = 'graze';
      if (a.hold > 0) {
        a.hold -= dt;
      } else {
        a.acc += dt * GRAZE_FPS;
        while (a.acc >= 1) {
          a.acc -= 1;
          a.frame = (a.frame + 1) % GRAZE.length;
          if (a.frame === 0) a.hold = 0.35 + unit(a.id + a.frame, 9) * 0.9;
        }
      }
      if (a.img.getAttribute('src') !== GRAZE[a.frame]) a.img.src = GRAZE[a.frame];
      if (a.leaving && dist <= ARRIVE) {
        a.el.remove();
        delete actors[a.id];
        return;
      }
    }
    paintActor(a);
  }

  function loop(now) {
    if (!lastTick) lastTick = now;
    var dt = Math.min(0.05, (now - lastTick) / 1000);
    lastTick = now;
    Object.keys(actors).forEach(function (id) {
      if (actors[id]) stepActor(actors[id], dt);
    });
    requestAnimationFrame(loop);
  }

  function renderTape(data) {
    if (!TAPE) return;
    var rows = (data.trades || []).slice(0, 10);
    if (!rows.length) {
      TAPE.innerHTML = '<div class="tape-empty">NO FRESH PRINTS — HERD IS WAITING</div>';
      return;
    }
    TAPE.innerHTML = rows
      .map(function (t) {
        return (
          '<a class="tape-row tape-' +
          t.side +
          '" href="' +
          (t.etherscan || '#') +
          '" target="_blank" rel="noopener noreferrer">' +
          '<span class="tape-side">' +
          t.side.toUpperCase() +
          '</span>' +
          '<span class="tape-usd">' +
          fmtUsd(t.usd) +
          '</span>' +
          '<span class="tape-ago">' +
          ago(t.ts) +
          '</span>' +
          '</a>'
        );
      })
      .join('');
  }

  function renderHud(data) {
    if (HUD.price) HUD.price.textContent = fmtPrice(data.priceUsd);
    if (HUD.chg) {
      HUD.chg.textContent = fmtPct(data.change && data.change.h24);
      HUD.chg.className = 'hud-chg ' + ((data.change && data.change.h24) >= 0 ? 'up' : 'down');
    }
    if (HUD.buys) HUD.buys.textContent = String((data.flow && data.flow.buys24) || 0);
    if (HUD.sells) HUD.sells.textContent = String((data.flow && data.flow.sells24) || 0);
    if (HUD.vol) HUD.vol.textContent = fmtUsd(data.volume24h, 0);
    if (HUD.mcap) HUD.mcap.textContent = fmtUsd(data.marketCap, 0);
    if (HUD.pulse) {
      var lastPrint = data.trades && data.trades[0];
      var live = !!(lastPrint && lastPrint.ts && Date.now() - Date.parse(lastPrint.ts) < FRESH_MS);
      HUD.pulse.classList.toggle('live', live);
      if (!lastPrint) HUD.pulse.textContent = 'GRAZING';
      else if (lastPrint.side === 'buy') HUD.pulse.textContent = live ? 'WALKING UP' : 'LAST BUY · UP';
      else HUD.pulse.textContent = live ? 'WALKING DOWN' : 'LAST SELL · DOWN';
    }
    if (HUD.status) {
      HUD.status.textContent =
        'CA 0xb9f5…344E · ' +
        ((data.trades && data.trades.length) || 0) +
        ' prints · updated ' +
        new Date(data.updatedAt).toLocaleTimeString();
    }
  }

  async function tick() {
    try {
      var res = await fetch('/api/pork-pasture?_=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      if (!data || !data.ok) throw new Error((data && data.error) || 'bad feed');
      renderHud(data);
      setTargets(data);
      renderTape(data);
    } catch (err) {
      if (HUD.status) HUD.status.textContent = 'TAPE BROKE — ' + (err.message || err);
      if (HUD.pulse) {
        HUD.pulse.textContent = 'OFF';
        HUD.pulse.classList.remove('live');
      }
    }
  }

  if (FIELD) {
    FIELD.addEventListener('click', function (e) {
      var btn = e.target.closest('.pig');
      if (!btn || !btn.dataset.href) return;
      window.open(btn.dataset.href, '_blank', 'noopener');
    });
  }

  tick();
  setInterval(tick, POLL_MS);
  requestAnimationFrame(loop);
})();
