/* DOSWAPZ boom box v2 test — stationary skin, tight hits, digital zoom */
(function () {
  'use strict';

  var IMG = '/assets/images/boombox/v2/';
  var MIN_LEN = 22;
  var MAX_LEN = 260;
  var FM_MIN = 88.0;
  var FM_MAX = 108.0;

  var STATIONS = [
    { freq: 88.1, name: 'DOSWAPZ LOFI', url: '/assets/media/lofi/doswapz-lofi.mp4', kind: 'video' },
    { freq: 91.7, name: 'GARDEN LOOP', url: '/assets/media/lofi/doswapz-lofi-garden.mp4', kind: 'video' },
    { freq: 95.3, name: 'BASEMENT MIX', url: '/assets/media/live-sim-lofi.mp4', kind: 'video' },
    { freq: 98.7, name: 'LILY PAD', url: '/assets/media/lily-pad.mp4', kind: 'video' },
    { freq: 102.5, name: 'AQUA DROP', url: '/assets/media/aqua-drop.mp4', kind: 'video' }
  ];

  /* Precise % boxes on the 1792x1008 3/4 skin. w/h = the knob, not a pad. */
  var HITS = [
    { id: 'spkL', l: 14.4, t: 52.2, w: 14.8, h: 28.0, shape: 'circle', act: 'muteL', title: 'LEFT SPK' },
    { id: 'spkR', l: 71.2, t: 41.6, w: 18.6, h: 34.2, shape: 'circle', act: 'muteR', title: 'RIGHT SPK' },
    { id: 'volK', l: 26.7, t: 36.6, w: 3.35, h: 6.9, shape: 'circle knob', act: 'vol', title: 'VOL' },
    { id: 'bassK', l: 17.1, t: 38.0, w: 4.7, h: 8.6, shape: 'circle knob', act: 'bass', title: 'BASS' },
    { id: 'tuneK', l: 67.7, t: 28.4, w: 3.25, h: 6.3, shape: 'circle knob', act: 'tune', title: 'TUNE' },
    { id: 'trebK', l: 74.0, t: 26.0, w: 5.1, h: 8.4, shape: 'circle knob', act: 'treble', title: 'TREB' },
    { id: 'cdL', l: 36.2, t: 16.6, w: 12.4, h: 13.6, shape: 'circle', act: 'cd', title: 'CD L' },
    { id: 'cdR', l: 56.4, t: 12.6, w: 14.2, h: 15.4, shape: 'circle', act: 'cd', title: 'CD R' },
    { id: 'tuner', l: 36.4, t: 33.1, w: 26.6, h: 5.1, shape: 'tuner', act: 'tuner', title: 'TUNER' },
    { id: 'play', l: 38.15, t: 42.15, w: 1.55, h: 2.45, shape: '', act: 'play', title: 'PLAY' },
    { id: 'stop', l: 40.05, t: 41.95, w: 1.55, h: 2.45, shape: '', act: 'stop', title: 'STOP' },
    { id: 'rew', l: 41.95, t: 41.75, w: 1.55, h: 2.45, shape: '', act: 'rew', title: 'REW' },
    { id: 'ff', l: 43.85, t: 41.55, w: 1.55, h: 2.45, shape: '', act: 'ff', title: 'FF' },
    { id: 'pause', l: 45.75, t: 41.35, w: 1.5, h: 2.4, shape: '', act: 'pause', title: 'PAUSE' },
    { id: 'rec', l: 52.55, t: 40.7, w: 1.7, h: 2.55, shape: '', act: 'rec', title: 'REC' },
    { id: 'rec2', l: 54.55, t: 40.5, w: 1.7, h: 2.55, shape: '', act: 'rec', title: 'REC' },
    { id: 'tr0', l: 50.7, t: 20.35, w: 1.45, h: 2.2, shape: '', act: 'track:0', title: 'T1' },
    { id: 'tr1', l: 52.4, t: 20.1, w: 1.45, h: 2.2, shape: '', act: 'track:1', title: 'T2' },
    { id: 'tr2', l: 54.1, t: 19.85, w: 1.45, h: 2.2, shape: '', act: 'track:2', title: 'T3' },
    { id: 'tapeA', l: 34.2, t: 50.6, w: 14.0, h: 14.4, shape: '', act: 'tapeA', title: 'TAPE A' },
    { id: 'digital', l: 50.6, t: 48.4, w: 14.8, h: 14.0, shape: '', act: 'digital', title: 'DIGITAL' },
    { id: 'tapeAPlay', l: 34.8, t: 66.4, w: 6.2, h: 2.5, shape: '', act: 'play', title: 'PLAY' },
    { id: 'tapeAStop', l: 41.4, t: 66.1, w: 6.0, h: 2.5, shape: '', act: 'stop', title: 'STOP' },
    { id: 'bot0', l: 39.4, t: 72.9, w: 1.55, h: 2.3, shape: '', act: 'track:3', title: 'T4' },
    { id: 'bot1', l: 41.4, t: 72.7, w: 1.55, h: 2.3, shape: '', act: 'track:4', title: 'T5' },
    { id: 'bot2', l: 48.6, t: 71.4, w: 1.5, h: 2.15, shape: '', act: 'rec', title: 'REC' },
    { id: 'power', l: 33.45, t: 79.05, w: 2.45, h: 4.05, shape: '', act: 'power', title: 'POWER' },
    { id: 'jack', l: 36.55, t: 79.2, w: 1.95, h: 3.6, shape: 'circle', act: 'phones', title: 'JACK' }
  ];

  var state = {
    power: true,
    mode: 'player',
    func: 0,
    vol: 0.72,
    bass: 0,
    treble: 0,
    muteL: false,
    muteR: false,
    phones: false,
    freq: 98.7,
    stationI: 3,
    playing: false,
    ant: { ang: 78, len: 168 },
    xform: false,
    playSince: 0,
    egg: -1,
    libI: 0,
    libArtist: null,
    libOpen: true,
    source: 'lib'
  };

  var LIBRARY = { artists: [], list: [] };

  var xformRaf = 0;

  var els = {};
  var drag = null;
  var ctx = null;
  var master = null;
  var analyser = null;
  var vizBuf = null;
  var bassFilter = null;
  var trebleFilter = null;
  var hooked = false;
  var toastTimer = 0;
  var raf = 0;
  var xformTimer = 0;
  var demoOsc = null;

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function toast(msg) {
    var t = els.toast;
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1500);
  }

  function blip(freq, dur, gain) {
    if (!ctx || !state.power) return;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq || 880;
    g.gain.value = gain || 0.04;
    o.connect(g);
    g.connect(master);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (dur || 0.07));
    o.stop(ctx.currentTime + (dur || 0.07) + 0.02);
  }

  function ensureAudio() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = state.vol;
    master.connect(ctx.destination);

    bassFilter = ctx.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 120;
    bassFilter.gain.value = state.bass;
    trebleFilter = ctx.createBiquadFilter();
    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 6500;
    trebleFilter.gain.value = state.treble;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    vizBuf = new Uint8Array(analyser.frequencyBinCount);
    bassFilter.connect(trebleFilter);
    trebleFilter.connect(analyser);
    analyser.connect(master);
    return ctx;
  }

  function hookMedia() {
    ensureAudio();
    if (els.video && !els.video._hooked) {
      try {
        ctx.createMediaElementSource(els.video).connect(bassFilter);
        els.video._hooked = true;
      } catch (e) {}
    }
  }

  function applyTone() {
    if (bassFilter) bassFilter.gain.value = state.bass;
    if (trebleFilter) trebleFilter.gain.value = state.treble;
    if (master) {
      var silent = !state.power || (state.muteL && state.muteR) || state.phones;
      master.gain.value = silent ? 0 : state.vol;
    }
    if (els.video) els.video.volume = state.vol;
    if (els.audio) {
      els.audio.volume = state.vol;
      els.audio.muted = !state.power || state.phones || (state.muteL && state.muteR);
    }
    syncKnob();
  }

  function station() {
    return STATIONS[state.stationI] || STATIONS[0];
  }

  function playStation(i, label) {
    if (!state.power) { toast('POWER OFF'); return; }
    ensureAudio();
    hookMedia();
    i = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
    state.stationI = i;
    state.freq = STATIONS[i].freq;
    state.playing = true;
    var st = STATIONS[i];
    if (els.video.getAttribute('src') !== st.url) els.video.src = st.url;
    els.video.loop = true;
    els.video.muted = false;
    els.video.volume = state.vol;
    els.video.play().catch(function () {
      startDemo();
    });
    stopDemoKeepViz(false);
    applyTone();
    updateHud();
    toast(label || st.name);
    blip(640, 0.05, 0.04);
    if (!state.playSince) state.playSince = Date.now();
    setPlayCap(true);
    syncKnob();
  }

  function startDemo() {
    ensureAudio();
    if (demoOsc) return;
    var o1 = ctx.createOscillator();
    var o2 = ctx.createOscillator();
    var g = ctx.createGain();
    o1.type = 'sawtooth';
    o2.type = 'square';
    o1.frequency.value = 110;
    o2.frequency.value = 165;
    g.gain.value = 0.05;
    o1.connect(g);
    o2.connect(g);
    g.connect(bassFilter);
    o1.start();
    o2.start();
    demoOsc = { o1: o1, o2: o2, g: g };
    state.playing = true;
    toast('DEMO TONE * MEDIA BLOCKED');
  }

  function stopDemoKeepViz(stopViz) {
    if (!demoOsc) return;
    try { demoOsc.o1.stop(); demoOsc.o2.stop(); } catch (e) {}
    demoOsc = null;
    if (stopViz) state.playing = false;
  }

  function pauseAll() {
    try { els.video.pause(); } catch (e) {}
    try { if (els.audio) els.audio.pause(); } catch (e2) {}
    stopDemoKeepViz(true);
    state.playing = false;
    state.playSince = 0;
    state.egg = -1;
    setPlayCap(false);
    updateHud();
  }

  function setPlayCap(down) {
    if (!els.playCap) return;
    els.playCap.classList.toggle('is-down', !!down);
  }

  function syncKnob() {
    if (!els.knobCap) return;
    var rot = (state.vol - 0.72) * 270;
    els.knobCap.style.transform = 'rotate(' + rot + 'deg)';
  }

  function togglePlay() {
    if (!state.power) { toast('POWER OFF'); return; }
    if (state.playing) {
      pauseAll();
      toast('PAUSE');
      return;
    }
    if (state.source === 'lib' && LIBRARY.list.length) {
      playLib(state.libI);
      return;
    }
    playStation(state.stationI, 'PLAY * ' + station().name);
  }

  function currentLib() {
    return LIBRARY.list[state.libI] || null;
  }

  function playLib(i) {
    if (!state.power) { toast('POWER OFF'); return; }
    if (!LIBRARY.list.length) { toast('NO LIBRARY'); return; }
    ensureAudio();
    hookMedia();
    i = ((i % LIBRARY.list.length) + LIBRARY.list.length) % LIBRARY.list.length;
    state.libI = i;
    state.source = 'lib';
    state.playing = true;
    var t = LIBRARY.list[i];
    try { els.video.pause(); } catch (e) {}
    if (els.video) {
      els.video.removeAttribute('src');
      try { els.video.load(); } catch (e3) {}
    }
    if (!els.audio) { toast('NO AUDIO'); return; }
    els.audio.muted = false;
    els.audio.loop = false;
    els.audio.volume = state.vol;
    if (els.audio.getAttribute('src') !== t.url) {
      els.audio.src = t.url;
      els.audio.load();
    }
    var playP = els.audio.play();
    if (playP && playP.catch) {
      playP.catch(function (err) {
        toast('PLAY FAIL');
        startDemo();
      });
    }
    stopDemoKeepViz(false);
    applyTone();
    if (!state.playSince) state.playSince = Date.now();
    setPlayCap(true);
    renderLib();
    updateHud();
    toast((t.artist || '') + ' * ' + t.title);
  }

  function loadLibrary(done) {
    fetch('/assets/data/library/index.json?v=lib1')
      .then(function (r) { return r.json(); })
      .then(function (idx) {
        var files = (idx.artists || []).map(function (a) {
          return fetch('/assets/data/library/' + a.file + '?v=lib1').then(function (r) { return r.json(); });
        });
        return Promise.all(files);
      })
      .then(function (artists) {
        LIBRARY.artists = artists;
        LIBRARY.list = [];
        artists.forEach(function (a) {
          (a.tracks || []).forEach(function (t) {
            LIBRARY.list.push({
              artist: a.name,
              artistId: a.id,
              title: t.title,
              genre: t.genre || '',
              url: t.url,
              suno: t.suno,
              kind: 'audio'
            });
          });
        });
        if (done) done();
      })
      .catch(function () { if (done) done(); });
  }

  function renderLib() {
    var box = els.libScreen;
    if (!box) return;
    var onPlayer = state.mode === 'player' && state.power;
    box.classList.toggle('is-on', onPlayer);
    if (!onPlayer) return;
    var cur = currentLib();
    var html = '';
    if (state.libArtist == null) {
      html += '<div class="lib-h">MEDIAPLAYER V1.0</div>';
      html += '<div class="lib-list">';
      LIBRARY.artists.forEach(function (a, i) {
        html += '<div class="row" data-artist="' + i + '">' + a.name.toUpperCase() +
          '<div class="sub">' + (a.tracks || []).length + ' TRACKS</div></div>';
      });
      if (!LIBRARY.artists.length) html += '<div class="row">NO ARTISTS</div>';
      html += '</div>';
      html += '<div class="lib-ready">READY</div>';
    } else {
      var a = LIBRARY.artists[state.libArtist];
      html += '<div class="lib-h">' + a.name.toUpperCase() + '</div>';
      html += '<div class="lib-list">';
      html += '<div class="row" data-lib="up">&lt; ARTISTS</div>';
      (a.tracks || []).forEach(function (t, i) {
        var active = cur && cur.url === t.url;
        html += '<div class="row' + (active ? ' on' : '') + '" data-play-artist="' + state.libArtist + '" data-play-i="' + i + '">' +
          (i + 1 < 10 ? '0' : '') + (i + 1) + '  ' + t.title.toUpperCase() + '</div>';
      });
      html += '</div>';
      html += '<div class="lib-ready">' + (state.playing && cur ? ('PLAY  ' + cur.title.toUpperCase()) : 'READY') + '</div>';
    }
    box.innerHTML = html;
    var sel = box.querySelector('.row.on');
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
  }

  function openLib() {
    state.libOpen = true;
    if (state.mode !== 'player') enterDigital();
    renderLib();
  }

  function closeLib() {
    state.libArtist = null;
    renderLib();
  }

  function setPower(on) {
    state.power = on;
    els.boomView.classList.toggle('is-off', !on);
    var pHit = $('power');
    if (pHit) pHit.classList.toggle('is-on', on);
    if (on) {
      ensureAudio();
      blip(220, 0.08, 0.06);
      toast('POWER ON');
    } else {
      pauseAll();
      blip(90, 0.12, 0.05);
      toast('POWER OFF');
    }
    setPlayCap(on && state.playing);
    renderLib();
    updateHud();
  }

  function placeHits() {
    HITS.forEach(function (h) {
      var el = $(h.id);
      if (!el) return;
      el.style.left = h.l + '%';
      el.style.top = h.t + '%';
      el.style.width = h.w + '%';
      el.style.height = h.h + '%';
    });
  }

  function placeAnt() {
    var a = els.ant;
    var mast = els.antMast;
    if (!a || !mast) return;
    a.style.left = '15.15%';
    a.style.top = '16.9%';
    var len = state.ant.len;
    var ang = state.ant.ang;
    mast.style.height = len + 'px';
    mast.style.width = '7px';
    mast.style.marginLeft = '-3.5px';
    mast.style.transform = 'rotate(' + ang + 'deg)';
    var inner = mast.querySelector('.ant-seg');
    if (inner) {
      var extra = Math.max(0, len - 70);
      inner.style.height = extra * 0.55 + 'px';
      inner.style.width = '5px';
    }
  }

  function freqFromAnt() {
    var p = (state.ant.len - MIN_LEN) / (MAX_LEN - MIN_LEN);
    var a = (state.ant.ang - 40) / 80;
    return clamp(FM_MIN + p * 14 + a * 6, FM_MIN, FM_MAX);
  }

  function nearestFromFreq(freq) {
    var best = 0;
    var bd = 99;
    for (var i = 0; i < STATIONS.length; i++) {
      var d = Math.abs(STATIONS[i].freq - freq);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function updateHud() {
    var st = station();
    els.hudFreq.textContent = state.power ? state.freq.toFixed(1) : '--.-';
    if (!state.power) els.hudName.textContent = 'POWER OFF';
    else if (state.playing && state.source === 'lib' && currentLib()) els.hudName.textContent = currentLib().title;
    else if (state.playing) els.hudName.textContent = station().name;
    else els.hudName.textContent = 'READY';
    els.hudMode.textContent = 'PLAYER';
    els.hudVol.textContent = 'VOL ' + Math.round(state.vol * 10);
    els.hudAnt.textContent = 'ANT ' + Math.round(((state.ant.len - MIN_LEN) / (MAX_LEN - MIN_LEN)) * 10);
    els.hud.classList.toggle('off', !state.power);
    var pwr = $('btnPower');
    if (pwr) pwr.classList.toggle('on', state.power);
    $('btnBoom').classList.toggle('on', state.mode === 'boombox');
    $('btnDigital').classList.toggle('on', state.mode === 'player');
    if (els.playerLabel) els.playerLabel.textContent = '';
  }

  function colorCell(t) {
    if (t < 0.18) return '#1430a8';
    if (t < 0.32) return '#1e7cff';
    if (t < 0.46) return '#18e0ff';
    if (t < 0.58) return '#22e060';
    if (t < 0.70) return '#d4e018';
    if (t < 0.82) return '#ff8a18';
    if (t < 0.92) return '#ff3a28';
    return '#d42cff';
  }

  var EGG_NAMES = ['RUNNER', 'SMILE', 'HEART', 'WAVE', 'INVADER', 'GHOST', 'FIRE', 'FISH', 'FACE', 'SCROLL'];

  function stamp(grid, rows, ox, oy, art, on) {
    var r, c;
    for (r = 0; r < art.length; r++) {
      var line = art[r];
      for (c = 0; c < line.length; c++) {
        if (line[c] === '#' || line[c] === '1') {
          var x = ox + c;
          var y = oy + r;
          if (y >= 0 && y < rows && x >= 0 && x < grid[0].length) grid[y][x] = on !== false;
        }
      }
    }
  }

  function eggGrid(cols, rows, now) {
    var grid = [];
    var y, x;
    for (y = 0; y < rows; y++) {
      grid[y] = [];
      for (x = 0; x < cols; x++) grid[y][x] = false;
    }
    var t = now / 1000;
    var egg = state.egg;
    var f;
    if (egg === 0) {
      f = Math.floor(t * 8) % 4;
      var run = [
        ['  #  ', ' ### ', '# # #', '  #  ', ' # # ', '#   #'],
        ['  #  ', ' ### ', '# # #', '  #  ', ' # # ', ' # # '],
        ['  #  ', ' ### ', '# # #', '  #  ', ' # # ', '#   #'],
        ['  #  ', ' ### ', '# # #', '  #  ', '###  ', '  #  ']
      ];
      stamp(grid, rows, 2 + Math.floor((Math.sin(t * 1.4) * 0.5 + 0.5) * (cols - 8)), 4, run[f]);
    } else if (egg === 1) {
      stamp(grid, rows, 6, 2, [
        '  ####  ',
        ' #    # ',
        '# #  # #',
        '#      #',
        '# #  # #',
        '#  ##  #',
        ' #    # ',
        '  ####  '
      ]);
    } else if (egg === 2) {
      var beat = Math.sin(t * 6) > 0;
      stamp(grid, rows, beat ? 5 : 6, beat ? 3 : 4, [
        ' ## ## ',
        '#######',
        '#######',
        ' ##### ',
        '  ###  ',
        '   #   '
      ]);
    } else if (egg === 3) {
      for (x = 0; x < cols; x++) {
        var yy = Math.round((rows / 2 - 1) + Math.sin(x * 0.55 + t * 3) * (rows / 3));
        if (yy >= 0 && yy < rows) grid[yy][x] = true;
        if (yy + 1 >= 0 && yy + 1 < rows) grid[yy + 1][x] = true;
      }
    } else if (egg === 4) {
      f = Math.floor(t * 4) % 2;
      stamp(grid, rows, 6, 3 + (f ? 1 : 0), [
        '  #   #  ',
        '   # #   ',
        '  #####  ',
        ' ## # ## ',
        '#########',
        '# ##### #',
        '# #   # #'
      ]);
    } else if (egg === 5) {
      stamp(grid, rows, 5 + Math.floor(Math.sin(t * 2) * 3), 3, [
        ' ###### ',
        '########',
        '## ## ##',
        '########',
        '########',
        '##    ##',
        ' # ## # '
      ]);
    } else if (egg === 6) {
      for (x = 0; x < cols; x++) {
        var flicker = (Math.sin(x * 1.7 + t * 8) * 0.5 + 0.5);
        var ht = Math.floor(3 + flicker * (rows - 4));
        for (y = rows - ht; y < rows; y++) {
          if ((y + x + Math.floor(t * 10)) % 2 === 0) grid[y][x] = true;
        }
      }
    } else if (egg === 7) {
      var fx = Math.floor((t * 4) % (cols - 7));
      stamp(grid, rows, fx, 5, [
        '  #### ',
        ' ##  ##',
        '#######',
        ' #   # '
      ]);
    } else if (egg === 8) {
      stamp(grid, rows, 4, 2, [
        '  ##########  ',
        ' #          # ',
        '#  ##    ##  #',
        '#  ##    ##  #',
        '#            #',
        '#   #    #   #',
        '#    ####    #',
        ' #          # ',
        '  ##########  '
      ]);
    } else if (egg === 9) {
      var msg = '  DOSWAPZ  PLAY  ';
      var shift = Math.floor(t * 6) % msg.length;
      var row = 6;
      for (x = 0; x < cols; x++) {
        var ch = msg[(x + shift) % msg.length];
        if (ch !== ' ') {
          if (row > 0) grid[row - 1][x] = true;
          grid[row][x] = true;
          if (row + 1 < rows) grid[row + 1][x] = true;
        }
      }
    }
    return grid;
  }

  function drawViz() {
    if (state.mode !== 'player' || !els.vizCtx) return;
    var c = els.viz;
    var g = els.vizCtx;
    var w = c.width;
    var h = c.height;
    g.clearRect(0, 0, w, h);
    var cols = 20;
    var rows = 14;
    var cw = w / cols;
    var rh = h / rows;
    var now = Date.now();
    var levels = new Array(cols);
    var i;
    if (state.power && analyser && vizBuf) {
      analyser.getByteFrequencyData(vizBuf);
      for (i = 0; i < cols; i++) {
        levels[i] = vizBuf[Math.floor(i * vizBuf.length / cols)] / 255;
      }
    } else {
      for (i = 0; i < cols; i++) levels[i] = 0;
    }
    if (state.power && state.playing) {
      for (i = 0; i < cols; i++) {
        levels[i] = Math.max(levels[i], 0.08 + Math.random() * 0.16 * state.vol);
      }
    }
    var eggMap = null;
    if (state.playing && state.playSince && now - state.playSince > 8000) {
      var next = Math.floor((now - state.playSince - 8000) / 9000) % EGG_NAMES.length;
      if (next !== state.egg) {
        state.egg = next;
        toast('VIZ * ' + EGG_NAMES[next]);
      }
      eggMap = eggGrid(cols, rows, now);
    } else {
      state.egg = -1;
    }
    var x, y;
    for (x = 0; x < cols; x++) {
      var n = Math.round(levels[x] * rows);
      for (y = 0; y < rows; y++) {
        var fromBottom = rows - 1 - y;
        var on = fromBottom < n;
        if (eggMap && eggMap[y][x]) on = true;
        if (!on) continue;
        g.fillStyle = colorCell(y / rows);
        g.fillRect(Math.floor(x * cw) + 1, Math.floor(y * rh) + 1, Math.max(1, cw - 2), Math.max(1, rh - 2));
      }
    }
  }

  function fitArt() {
    var view = els.playerView;
    var art = els.playerArt;
    var img = els.playerImg;
    if (!view || !art || !img || !img.naturalWidth) return;
    var vw = view.clientWidth;
    var vh = view.clientHeight;
    var iw = img.naturalWidth;
    var ih = img.naturalHeight;
    var s = Math.min(vw / iw, vh / ih);
    var dw = iw * s;
    var dh = ih * s;
    art.style.left = ((vw - dw) / 2) + 'px';
    art.style.top = ((vh - dh) / 2) + 'px';
    art.style.width = dw + 'px';
    art.style.height = dh + 'px';
    sizeFx();
  }

  var CABLES = [
    [{ x: 0.18, y: 0.00 }, { x: 0.28, y: 0.06 }, { x: 0.38, y: 0.01 }],
    [{ x: 0.34, y: 0.00 }, { x: 0.46, y: 0.08 }, { x: 0.56, y: 0.00 }],
    [{ x: 0.50, y: 0.00 }, { x: 0.58, y: 0.07 }, { x: 0.68, y: 0.00 }],
    [{ x: 0.64, y: 0.00 }, { x: 0.76, y: 0.09 }, { x: 0.88, y: 0.04 }],
    [{ x: 0.78, y: 0.00 }, { x: 0.90, y: 0.12 }, { x: 0.99, y: 0.22 }],
    [{ x: 0.00, y: 0.22 }, { x: 0.06, y: 0.30 }, { x: 0.10, y: 0.42 }],
    [{ x: 0.00, y: 0.40 }, { x: 0.07, y: 0.48 }, { x: 0.11, y: 0.58 }],
    [{ x: 0.00, y: 0.58 }, { x: 0.08, y: 0.66 }, { x: 0.11, y: 0.78 }],
    [{ x: 0.91, y: 0.18 }, { x: 0.97, y: 0.28 }, { x: 1.00, y: 0.40 }],
    [{ x: 0.89, y: 0.48 }, { x: 0.96, y: 0.58 }, { x: 1.00, y: 0.68 }],
    [{ x: 0.86, y: 0.72 }, { x: 0.94, y: 0.82 }, { x: 1.00, y: 0.88 }]
  ];
  var TRACES = [
    [{ x: 0.01, y: 0.12 }, { x: 0.09, y: 0.12 }, { x: 0.09, y: 0.26 }, { x: 0.03, y: 0.26 }, { x: 0.03, y: 0.38 }],
    [{ x: 0.02, y: 0.20 }, { x: 0.07, y: 0.20 }, { x: 0.07, y: 0.48 }, { x: 0.02, y: 0.48 }],
    [{ x: 0.00, y: 0.32 }, { x: 0.11, y: 0.32 }, { x: 0.11, y: 0.44 }, { x: 0.05, y: 0.44 }, { x: 0.05, y: 0.62 }],
    [{ x: 0.01, y: 0.70 }, { x: 0.08, y: 0.70 }, { x: 0.08, y: 0.84 }, { x: 0.02, y: 0.84 }],
    [{ x: 0.00, y: 0.88 }, { x: 0.12, y: 0.88 }, { x: 0.12, y: 0.96 }, { x: 0.04, y: 0.96 }],
    [{ x: 0.88, y: 0.10 }, { x: 0.96, y: 0.10 }, { x: 0.96, y: 0.24 }, { x: 0.90, y: 0.24 }],
    [{ x: 0.90, y: 0.30 }, { x: 0.99, y: 0.30 }, { x: 0.99, y: 0.52 }, { x: 0.92, y: 0.52 }],
    [{ x: 0.91, y: 0.60 }, { x: 0.98, y: 0.60 }, { x: 0.98, y: 0.78 }, { x: 0.90, y: 0.78 }],
    [{ x: 0.14, y: 0.02 }, { x: 0.14, y: 0.08 }, { x: 0.28, y: 0.08 }, { x: 0.28, y: 0.02 }],
    [{ x: 0.72, y: 0.02 }, { x: 0.72, y: 0.09 }, { x: 0.84, y: 0.09 }, { x: 0.84, y: 0.03 }],
    [{ x: 0.20, y: 0.92 }, { x: 0.20, y: 0.98 }, { x: 0.42, y: 0.98 }, { x: 0.42, y: 0.93 }],
    [{ x: 0.58, y: 0.93 }, { x: 0.58, y: 0.99 }, { x: 0.78, y: 0.99 }, { x: 0.78, y: 0.92 }]
  ];

  function makePulse(kind, i) {
    return {
      kind: kind,
      i: i,
      t: Math.random(),
      spd: kind === 'wire' ? 0.0035 + Math.random() * 0.003 : 0.004 + Math.random() * 0.0045,
      wait: i * 120 + Math.random() * 800,
      hue: kind === 'wire' ? (Math.random() < 0.28 ? 'cyan' : 'amber') : 'cyan'
    };
  }

  var fxPulses = [];
  (function seedPulses() {
    fxPulses.push(makePulse('wire', 1));
    fxPulses.push(makePulse('wire', 4));
    fxPulses.push(makePulse('wire', 8));
    fxPulses.push(makePulse('board', 1));
    fxPulses.push(makePulse('board', 6));
    fxPulses.push(makePulse('board', 9));
  })();

  var boardOrbs = [];
  (function seedOrbs() {
    var i;
    for (i = 0; i < 6; i++) {
      var edge = i % 4;
      var x;
      var y;
      if (edge === 0) { x = 0.01 + Math.random() * 0.10; y = 0.08 + Math.random() * 0.84; }
      else if (edge === 1) { x = 0.88 + Math.random() * 0.11; y = 0.08 + Math.random() * 0.84; }
      else if (edge === 2) { x = Math.random() * 0.92; y = 0.01 + Math.random() * 0.09; }
      else { x = Math.random() * 0.92; y = 0.90 + Math.random() * 0.09; }
      boardOrbs.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 0.00022,
        vy: (Math.random() - 0.5) * 0.00018,
        phase: Math.random() * Math.PI * 2,
        spd: 0.008 + Math.random() * 0.012,
        r: 4 + Math.random() * 6,
        hue: Math.random() < 0.4 ? 'amber' : 'cyan'
      });
    }
  })();

  function bezier(p0, p1, p2, t) {
    var u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
    };
  }

  function polyLen(pts) {
    var n = 0;
    var i;
    for (i = 1; i < pts.length; i++) {
      n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return n || 1;
  }

  function alongPoly(pts, t) {
    var target = clamp(t, 0, 1) * polyLen(pts);
    var acc = 0;
    var i;
    for (i = 1; i < pts.length; i++) {
      var d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (acc + d >= target) {
        var u = d ? (target - acc) / d : 0;
        return {
          x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u,
          y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u
        };
      }
      acc += d;
    }
    return pts[pts.length - 1];
  }

  function inCrt(x, y) {
    return x > 0.128 && x < 0.610 && y > 0.138 && y < 0.850;
  }

  function inViz(x, y) {
    return x > 0.618 && x < 0.850 && y > 0.205 && y < 0.575;
  }

  function punchScreens(g, w, h) {
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    roundRect(g, 0.1469 * w, 0.158 * h, 0.4391 * w, 0.670 * h, 22);
    g.fill();
    roundRect(g, 0.6415 * w, 0.2315 * h, 0.1885 * w, 0.322 * h, 8);
    g.fill();
    g.restore();
  }

  function roundRect(g, x, y, rw, rh, r) {
    var rr = Math.min(r, rw / 2, rh / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + rw, y, x + rw, y + rh, rr);
    g.arcTo(x + rw, y + rh, x, y + rh, rr);
    g.arcTo(x, y + rh, x, y, rr);
    g.arcTo(x, y, x + rw, y, rr);
    g.closePath();
  }

  function sizeFx() {
    var art = els.playerArt;
    var c = els.fx;
    if (!art || !c) return;
    var w = Math.max(2, Math.round(art.clientWidth));
    var h = Math.max(2, Math.round(art.clientHeight));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
  }

  function rgbFor(hue) {
    return hue === 'cyan' ? '70, 210, 200' : '255, 168, 64';
  }

  function strokePath(g, w, h, pts, curve, color, alpha, width) {
    g.strokeStyle = 'rgba(' + color + ',' + alpha + ')';
    g.lineWidth = width;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    var i;
    if (curve) {
      var p = bezier(pts[0], pts[1], pts[2], 0);
      g.moveTo(p.x * w, p.y * h);
      for (i = 1; i <= 18; i++) {
        p = bezier(pts[0], pts[1], pts[2], i / 18);
        if (inCrt(p.x, p.y) || inViz(p.x, p.y)) {
          g.stroke();
          g.beginPath();
          continue;
        }
        g.lineTo(p.x * w, p.y * h);
      }
    } else {
      g.moveTo(pts[0].x * w, pts[0].y * h);
      for (i = 1; i < pts.length; i++) {
        if (inCrt(pts[i].x, pts[i].y)) continue;
        g.lineTo(pts[i].x * w, pts[i].y * h);
      }
    }
    g.stroke();
  }

  function drawStreak(g, w, h, at, hue) {
    if (inCrt(at.x, at.y) || inViz(at.x, at.y)) return;
    var px = at.x * w;
    var py = at.y * h;
    var col = rgbFor(hue);
    var grd = g.createRadialGradient(px, py, 0, px, py, 11);
    grd.addColorStop(0, 'rgba(' + col + ',0.72)');
    grd.addColorStop(0.4, 'rgba(' + col + ',0.22)');
    grd.addColorStop(1, 'rgba(' + col + ',0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(px, py, 11, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(' + col + ',0.9)';
    g.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
  }

  function drawFx(now) {
    if (state.mode !== 'player' || !els.fxCtx) return;
    var c = els.fx;
    var g = els.fxCtx;
    var w = c.width;
    var h = c.height;
    if (!w || !h) return;
    g.clearRect(0, 0, w, h);

    var i;
    for (i = 0; i < boardOrbs.length; i++) {
      var orb = boardOrbs[i];
      orb.x += orb.vx;
      orb.y += orb.vy;
      if (orb.x < 0.005 || orb.x > 0.995) orb.vx *= -1;
      if (orb.y < 0.005 || orb.y > 0.995) orb.vy *= -1;
      if (inCrt(orb.x, orb.y) || inViz(orb.x, orb.y)) {
        orb.vx *= -1;
        orb.vy *= -1;
        orb.x += orb.vx * 4;
        orb.y += orb.vy * 4;
        continue;
      }
      orb.phase += orb.spd;
      var oa = 0.10 + 0.22 * (0.5 + 0.5 * Math.sin(orb.phase));
      var ox = orb.x * w;
      var oy = orb.y * h;
      var ocol = rgbFor(orb.hue);
      var og = g.createRadialGradient(ox, oy, 0, ox, oy, orb.r);
      og.addColorStop(0, 'rgba(' + ocol + ',' + oa + ')');
      og.addColorStop(1, 'rgba(' + ocol + ',0)');
      g.fillStyle = og;
      g.beginPath();
      g.arc(ox, oy, orb.r, 0, Math.PI * 2);
      g.fill();
    }

    for (i = 0; i < CABLES.length; i++) strokePath(g, w, h, CABLES[i], true, '255, 168, 64', 0.10, 1.2);
    for (i = 0; i < TRACES.length; i++) strokePath(g, w, h, TRACES[i], false, '70, 210, 200', 0.14, 1.15);

    for (i = 0; i < fxPulses.length; i++) {
      var pulse = fxPulses[i];
      if (now < pulse.wait) continue;
      pulse.t += pulse.spd;
      if (pulse.t > 1.08) {
        var kind = pulse.kind;
        var pool = kind === 'wire' ? CABLES.length : TRACES.length;
        var idx = Math.floor(Math.random() * pool);
        fxPulses[i] = makePulse(kind, idx);
        fxPulses[i].wait = now + 700 + Math.random() * 2200;
        continue;
      }
      var pts = pulse.kind === 'wire' ? CABLES[pulse.i] : TRACES[pulse.i];
      if (!pts) continue;
      var k;
      for (k = 10; k >= 0; k--) {
        var tt = pulse.t - k * 0.018;
        if (tt < 0 || tt > 1) continue;
        var at = pulse.kind === 'wire'
          ? bezier(pts[0], pts[1], pts[2], tt)
          : alongPoly(pts, tt);
        if (k === 0) drawStreak(g, w, h, at, pulse.hue);
        else {
          if (inCrt(at.x, at.y) || inViz(at.x, at.y)) continue;
          g.fillStyle = 'rgba(' + rgbFor(pulse.hue) + ',' + (0.08 + (10 - k) * 0.035) + ')';
          g.fillRect(Math.round(at.x * w) - 1, Math.round(at.y * h) - 1, 2, 2);
        }
      }
    }
    punchScreens(g, w, h);
  }

  function loop() {
    var now = Date.now();
    drawViz();
    drawFx(now);
    raf = requestAnimationFrame(loop);
  }

  function doAct(act) {
    if (state.xform) return;
    if (act === 'power') { setPower(!state.power); return; }
    if (!state.power && act !== 'digital') { toast('POWER OFF'); return; }
    ensureAudio();
    if (act === 'play') { togglePlay(); return; }
    if (act === 'pause') { pauseAll(); toast('PAUSE'); return; }
    if (act === 'stop') { pauseAll(); toast('STOP'); return; }
    if (act === 'rew') {
      if (state.source === 'lib') playLib(state.libI - 1);
      else playStation(state.stationI - 1, 'REW * ' + station().name);
      return;
    }
    if (act === 'ff') {
      if (state.source === 'lib') playLib(state.libI + 1);
      else playStation(state.stationI + 1, 'FF * ' + station().name);
      return;
    }
    if (act === 'rec') { toast('REC ARMED * TRACK MAP LATER'); blip(1400, 0.1, 0.05); return; }
    if (act === 'muteL') {
      state.muteL = !state.muteL;
      $('spkL').classList.toggle('is-mute', state.muteL);
      applyTone();
      toast(state.muteL ? 'LEFT MUTE' : 'LEFT LIVE');
      return;
    }
    if (act === 'muteR') {
      state.muteR = !state.muteR;
      $('spkR').classList.toggle('is-mute', state.muteR);
      applyTone();
      toast(state.muteR ? 'RIGHT MUTE' : 'RIGHT LIVE');
      return;
    }
    if (act === 'phones') {
      state.phones = !state.phones;
      applyTone();
      toast(state.phones ? 'PHONES IN' : 'SPEAKERS');
      return;
    }
    if (act === 'cd') {
      playStation(0, 'CD * ' + STATIONS[0].name);
      return;
    }
    if (act === 'tapeA') {
      playStation(2, 'TAPE A * ' + STATIONS[2].name);
      return;
    }
    if (act === 'digital') { enterDigital(); return; }
    if (act.indexOf('track:') === 0) {
      var n = parseInt(act.split(':')[1], 10);
      playStation(n, 'TRACK ' + (n + 1) + ' * ' + STATIONS[n].name);
    }
  }

  function clearXform() {
    els.xform.classList.remove('is-on');
    ['xfZoom', 'xfDeeper', 'xfShatter', 'xfFill', 'xfArrive'].forEach(function (id) {
      if (els[id]) {
        els[id].style.transition = 'none';
        els[id].style.opacity = '0';
      }
    });
    els.scan.style.opacity = '0';
    els.chroma.style.opacity = '0';
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function fadeLayer(el, start, end, elapsed, hold) {
    if (!el) return;
    if (elapsed < start) { el.style.opacity = '0'; return; }
    if (elapsed >= end) { el.style.opacity = hold ? '1' : '0'; return; }
    var t = (elapsed - start) / (end - start);
    el.style.opacity = String(easeInOut(t));
  }

  function runXform(goingIn) {
    if (xformRaf) cancelAnimationFrame(xformRaf);
    state.xform = true;
    els.xform.classList.add('is-on');
    els.boomView.style.transition = 'none';
    els.playerView.style.transition = 'none';
    var t0 = Date.now();
    var dur = goingIn ? 5200 : 4600;
    toast(goingIn ? 'DIGITAL IN' : 'ZOOM OUT');
    blip(goingIn ? 980 : 320, 0.12, 0.05);

    function tick() {
      var elapsed = Date.now() - t0;
      var p = clamp(elapsed / dur, 0, 1);
      var e = easeInOut(p);
      els.scan.style.opacity = String(p < 0.92 ? 0.25 + e * 0.7 : (1 - p) * 8);
      els.chroma.style.opacity = String(p < 0.9 ? e * 0.75 : (1 - p) * 6);

      if (goingIn) {
        var z = 1 + e * 2.6;
        els.boomView.style.transformOrigin = '56% 56%';
        els.boomView.style.transform = 'scale(' + z + ')';
        els.boomView.style.filter = 'contrast(' + (1 + e * 0.55) + ') saturate(' + (1 + e * 0.45) + ') brightness(' + (1 + e * 0.12) + ')';
        fadeLayer(els.xfZoom, 600, 1400, elapsed, true);
        fadeLayer(els.xfDeeper, 1300, 2200, elapsed, true);
        fadeLayer(els.xfShatter, 2100, 3100, elapsed, true);
        fadeLayer(els.xfFill, 3000, 3800, elapsed, true);
        fadeLayer(els.xfArrive, 3600, 4400, elapsed, true);
        if (elapsed > 3800) {
          els.playerView.classList.add('is-live');
          var pe = easeInOut(clamp((elapsed - 3800) / 1100, 0, 1));
          els.playerView.style.opacity = String(pe);
          els.playerView.style.transform = 'scale(' + (0.18 + pe * 0.82) + ')';
          els.boomView.style.opacity = String(1 - pe);
        }
        if (elapsed > 4300) els.boomView.classList.add('is-gone');
      } else {
        var po = easeInOut(clamp(elapsed / 900, 0, 1));
        els.playerView.style.opacity = String(1 - po);
        els.playerView.style.transform = 'scale(' + (1 - po * 0.82) + ')';
        fadeLayer(els.xfArrive, 0, 700, elapsed, false);
        if (els.xfArrive && elapsed < 900) els.xfArrive.style.opacity = String(1 - po);
        fadeLayer(els.xfFill, 500, 1300, elapsed, false);
        if (els.xfFill && elapsed > 500 && elapsed < 1600) els.xfFill.style.opacity = String(easeInOut(clamp((elapsed - 500) / 400, 0, 1)));
        fadeLayer(els.xfShatter, 1100, 2000, elapsed, false);
        if (els.xfShatter && elapsed > 1100 && elapsed < 2400) els.xfShatter.style.opacity = String(easeInOut(clamp((elapsed - 1100) / 400, 0, 1)));
        fadeLayer(els.xfDeeper, 1800, 2700, elapsed, false);
        if (els.xfDeeper && elapsed > 1800 && elapsed < 3100) els.xfDeeper.style.opacity = String(easeInOut(clamp((elapsed - 1800) / 400, 0, 1)));
        fadeLayer(els.xfZoom, 2500, 3400, elapsed, false);
        if (els.xfZoom && elapsed > 2500 && elapsed < 3800) els.xfZoom.style.opacity = String(easeInOut(clamp((elapsed - 2500) / 400, 0, 1)));
        if (elapsed > 1600) {
          els.boomView.classList.remove('is-gone');
          var be = easeInOut(clamp((elapsed - 1600) / 2600, 0, 1));
          els.boomView.style.opacity = String(be);
          els.boomView.style.transformOrigin = '56% 56%';
          els.boomView.style.transform = 'scale(' + (2.4 - be * 1.4) + ')';
          els.boomView.style.filter = 'contrast(' + (1.4 - be * 0.4) + ')';
        }
        if (elapsed > 2200) els.playerView.classList.remove('is-live');
      }

      if (elapsed < dur) {
        xformRaf = requestAnimationFrame(tick);
        return;
      }
      xformRaf = 0;
      clearXform();
      els.boomView.style.transition = '';
      els.boomView.style.transform = '';
      els.boomView.style.filter = '';
      els.boomView.style.opacity = '';
      els.playerView.style.transition = '';
      els.playerView.style.opacity = '';
      if (goingIn) {
        els.playerView.classList.add('is-live');
        els.playerView.style.transform = 'scale(1)';
        els.boomView.classList.add('is-gone');
        state.mode = 'player';
        if (state.power && !state.playing) playStation(state.stationI);
        toast('MEDIAPLAYER V1.0');
        syncKnob();
        setPlayCap(state.playing);
      } else {
        els.playerView.classList.remove('is-live');
        els.playerView.style.transform = 'scale(0.18)';
        els.boomView.classList.remove('is-gone');
        state.mode = 'boombox';
        toast('BOOM BOX');
      }
      state.xform = false;
      updateHud();
    }
    xformRaf = requestAnimationFrame(tick);
  }

  function enterDigital() {
    if (state.mode === 'player') return;
    state.mode = 'player';
    els.playerView.classList.add('is-live');
    els.playerView.style.transform = 'scale(1)';
    els.playerView.style.opacity = '1';
    els.boomView.classList.add('is-gone');
    els.boomView.style.opacity = '0';
    syncKnob();
    setPlayCap(state.playing);
    renderLib();
    updateHud();
  }

  function exitDigital() {
    toast('BOOM BOX * COMING SOON');
    return;
    if (state.mode !== 'player') return;
    state.mode = 'boombox';
    els.playerView.classList.remove('is-live');
    els.playerView.style.transform = 'scale(1)';
    els.playerView.style.opacity = '';
    els.boomView.classList.remove('is-gone');
    els.boomView.style.opacity = '';
    els.boomView.style.transform = '';
    renderLib();
    updateHud();
  }

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    ensureAudio();
    var t = e.target;
    if (t.closest && t.closest('.bar, .nav, a, .dbtn')) return;

    if (t.classList.contains('ant-mast') || t.closest('.ant')) {
      var r = els.boomView.getBoundingClientRect();
      drag = {
        kind: 'ant',
        mx: r.left + 0.1515 * r.width,
        my: r.top + 0.169 * r.height
      };
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (t.classList.contains('knob') || (t.getAttribute && /vol|bass|treble|tune/.test(t.getAttribute('data-act') || ''))) {
      var act = t.getAttribute('data-act');
      if (act === 'vol' || act === 'bass' || act === 'treble' || act === 'tune') {
        drag = { kind: 'knob', which: act, y: e.clientY, vol: state.vol, bass: state.bass, treble: state.treble, freq: state.freq };
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    if (t.getAttribute && t.getAttribute('data-act') === 'tuner') {
      drag = { kind: 'tuner' };
      moveTuner(e);
      e.preventDefault();
      return;
    }

    if (state.mode === 'boombox' && (!t.classList || !t.classList.contains('hit'))) {
      var box = els.boomView.getBoundingClientRect();
      var px = ((e.clientX - box.left) / box.width * 100).toFixed(2);
      var py = ((e.clientY - box.top) / box.height * 100).toFixed(2);
      els.probe.textContent = 'CLICK ' + px + '  ' + py;
    }
  }

  function moveTuner(e) {
    var el = $('tuner');
    if (!el) return;
    var rect = el.getBoundingClientRect();
    var p = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    state.freq = FM_MIN + p * (FM_MAX - FM_MIN);
    var i = nearestFromFreq(state.freq);
    if (i !== state.stationI || !state.playing) playStation(i);
    else updateHud();
  }

  function onMove(e) {
    if (!drag) return;
    if (drag.kind === 'ant') {
      var dx = e.clientX - drag.mx;
      var dy = e.clientY - drag.my;
      var ang = Math.atan2(dx, -dy) * 180 / Math.PI;
      var dist = Math.hypot(dx, dy);
      state.ant.ang = clamp(ang, 20, 130);
      state.ant.len = clamp(dist, MIN_LEN, MAX_LEN);
      placeAnt();
      state.freq = freqFromAnt();
      updateHud();
      return;
    }
    if (drag.kind === 'tuner') { moveTuner(e); return; }
    if (drag.kind === 'pknob') {
      var ang = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
      var d = ang - drag.lastAng;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      drag.lastAng = ang;
      state.vol = clamp(state.vol + d / 3.1, 0, 1);
      applyTone();
      syncKnob();
      updateHud();
      return;
    }
    if (drag.kind === 'knob') {
      var dy = drag.y - e.clientY;
      if (drag.which === 'vol') {
        state.vol = clamp(drag.vol + dy / 180, 0, 1);
        applyTone();
        syncKnob();
        updateHud();
      } else if (drag.which === 'bass') {
        state.bass = clamp(drag.bass + dy / 12, -12, 12);
        applyTone();
        updateHud();
      } else if (drag.which === 'treble') {
        state.treble = clamp(drag.treble + dy / 12, -12, 12);
        applyTone();
        updateHud();
      } else if (drag.which === 'tune') {
        state.freq = clamp(drag.freq + dy / 18, FM_MIN, FM_MAX);
        var i = nearestFromFreq(state.freq);
        if (i !== state.stationI) playStation(i);
        else updateHud();
      }
    }
  }

  function onUp() {
    if (drag && drag.kind === 'ant' && state.power) {
      state.freq = freqFromAnt();
      playStation(nearestFromFreq(state.freq), 'TUNE * ' + station().name);
    }
    if (drag && drag.kind === 'playkey') {
      if (!state.playing) setPlayCap(false);
    }
    drag = null;
  }

  function bindHits() {
    HITS.forEach(function (h) {
      var el = $(h.id);
      if (!el) return;
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        if (h.act === 'vol' || h.act === 'bass' || h.act === 'treble' || h.act === 'tune' || h.act === 'tuner') return;
        doAct(h.act);
      });
    });
    var pPlay = $('pPlay');
    if (pPlay) {
      pPlay.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
        e.preventDefault();
        setPlayCap(true);
        drag = { kind: 'playkey' };
      });
      pPlay.addEventListener('click', function (e) {
        e.stopPropagation();
        togglePlay();
        setPlayCap(state.playing);
      });
    }
    var pKnob = $('pKnob');
    if (pKnob) {
      pKnob.addEventListener('pointerdown', function (e) {
        var r = pKnob.getBoundingClientRect();
        drag = {
          kind: 'pknob',
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
          lastAng: Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
        };
        e.preventDefault();
        e.stopPropagation();
      });
    }
    var pBack = $('pBack');
    if (pBack) pBack.addEventListener('click', function (e) { e.stopPropagation(); exitDigital(); });
    var pFile = $('pFile');
    if (pFile) {
      pFile.addEventListener('click', function (e) {
        e.stopPropagation();
        state.libArtist = null;
        openLib();
      });
    }
    if (els.libScreen) {
      els.libScreen.addEventListener('click', function (e) {
        var row = e.target.closest('[data-lib], [data-artist], [data-play-i]');
        if (!row) return;
        if (row.getAttribute('data-lib') === 'close') { state.libArtist = null; renderLib(); return; }
        if (row.getAttribute('data-lib') === 'up') { state.libArtist = null; renderLib(); return; }
        if (row.hasAttribute('data-artist')) {
          state.libArtist = parseInt(row.getAttribute('data-artist'), 10);
          renderLib();
          return;
        }
        if (row.hasAttribute('data-play-i')) {
          var ai = parseInt(row.getAttribute('data-play-artist'), 10);
          var ti = parseInt(row.getAttribute('data-play-i'), 10);
          var a = LIBRARY.artists[ai];
          var tr = a && a.tracks[ti];
          if (!tr) return;
          var idx = 0;
          for (var n = 0; n < LIBRARY.list.length; n++) {
            if (LIBRARY.list[n].url === tr.url) { idx = n; break; }
          }
          playLib(idx);
        }
      });
    }
  }

  function bindChrome() {
    $('btnPower').addEventListener('click', function () { setPower(!state.power); });
    $('btnPlay').addEventListener('click', togglePlay);
    $('btnStop').addEventListener('click', function () { pauseAll(); toast('STOP'); });
    $('btnRew').addEventListener('click', function () { doAct('rew'); });
    $('btnFf').addEventListener('click', function () { doAct('ff'); });
    $('btnBoom').addEventListener('click', function () {
      if (state.mode === 'player') exitDigital();
    });
    $('btnDigital').addEventListener('click', function () {
      if (state.mode === 'boombox') enterDigital();
    });
    var btnLib = $('btnLib');
    if (btnLib) {
      btnLib.addEventListener('click', function () {
        state.libArtist = null;
        openLib();
        this.classList.add('on');
      });
    }
    $('btnHits').addEventListener('click', function () {
      document.body.classList.toggle('debug');
      this.classList.toggle('on', document.body.classList.contains('debug'));
      toast(document.body.classList.contains('debug') ? 'HITS ON' : 'HITS OFF');
    });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', function (e) {
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      if (e.key === 'd' || e.key === 'D') {
        document.body.classList.toggle('debug');
        $('btnHits').classList.toggle('on', document.body.classList.contains('debug'));
      }
      if (e.key === 'Escape') {
        if (state.mode === 'player') exitDigital();
      }
      if (e.key === 'Enter' || e.key === 'e' || e.key === 'E') {
        if (state.mode === 'boombox') enterDigital();
      }
      if (e.key === 'ArrowUp') {
        state.ant.len = clamp(state.ant.len + 14, MIN_LEN, MAX_LEN);
        placeAnt();
        state.freq = freqFromAnt();
        updateHud();
      }
      if (e.key === 'ArrowDown') {
        state.ant.len = clamp(state.ant.len - 14, MIN_LEN, MAX_LEN);
        placeAnt();
        state.freq = freqFromAnt();
        updateHud();
      }
      if (e.key === 'ArrowLeft') doAct('rew');
      if (e.key === 'ArrowRight') doAct('ff');
    });
  }

  function init() {
    els = {
      boomView: $('boomView'),
      playerView: $('playerView'),
      playerArt: $('playerArt'),
      playerImg: $('playerImg'),
      toast: $('toast'),
      hud: $('hud'),
      hudFreq: $('hudFreq'),
      hudName: $('hudName'),
      hudMode: $('hudMode'),
      hudVol: $('hudVol'),
      hudAnt: $('hudAnt'),
      probe: $('probe'),
      ant: $('ant'),
      antMast: $('antMast'),
      video: $('deckVideo'),
      viz: $('viz'),
      fx: $('fxLayer'),
      xform: $('xform'),
      xfZoom: $('xfZoom'),
      xfShatter: $('xfShatter'),
      xfArrive: $('xfArrive'),
      scan: $('scan'),
      chroma: $('chroma'),
      playerLabel: $('playerLabel'),
      playCap: $('playCap'),
      knobCap: $('knobCap'),
      xfDeeper: $('xfDeeper'),
      xfFill: $('xfFill'),
      audio: $('deckAudio'),
      libScreen: $('libScreen')
    };
    if (els.viz) els.vizCtx = els.viz.getContext('2d');
    if (els.fx) els.fxCtx = els.fx.getContext('2d');
    sizeFx();
    if (els.playerImg) {
      if (els.playerImg.complete) fitArt();
      els.playerImg.addEventListener('load', fitArt);
    }
    window.addEventListener('resize', fitArt);
    placeHits();
    placeAnt();
    syncKnob();
    document.body.classList.add('is-ready');
    bindHits();
    bindChrome();
    if (els.audio) {
      els.audio.addEventListener('ended', function () {
        if (state.source === 'lib' && state.playing) playLib(state.libI + 1);
      });
    }
    loadLibrary(function () {
      state.libArtist = null;
      renderLib();
      updateHud();
    });
    updateHud();
    [
      IMG + 'player-skin.jpg',
      IMG + 'play.png',
      IMG + 'knob.png'
    ].forEach(function (src) {
      var i = new Image();
      i.src = src;
    });
    loop();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
