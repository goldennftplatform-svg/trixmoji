/* DOSWAPZ Past-era interactive mega boom box */
(function () {
  'use strict';

  var IMG = '/assets/images/boombox/';
  var MIN_LEN = 42;
  var MAX_LEN = 240;
  var FM_MIN = 88.0;
  var FM_MAX = 108.0;

  var FRAMES = [
    { id: '000', yaw: 0, src: IMG + 'yaw-000.jpg', operate: true,
      handle: [24, 6, 52, 14], power: [8.8, 30, 3, 6],
      spkL: [13.5, 30, 13, 50], spkR: [73.5, 30, 13, 50],
      knobs: [58, 28, 14, 6],
      face: [27.5, 33, 45, 46, 'none'],
      cd: [30, 8, 40, 28],
      cdWell: [38, 16, 24, 18],
      cdHinge: [32, 0, 36, 16],
      phones: [27.5, 81, 8, 11], mic: [35.5, 81, 8, 11],
      usb0: [44, 81, 13, 11], usb1: [57.5, 81, 16, 11],
      volK: [16.2, 18, 6.4, 12], bassK: [76.0, 18, 6.4, 12], trebK: [83.0, 18, 6.4, 12],
      ants: [{ x: 31.5, y: 16 }, { x: 68.5, y: 16 }] },
    { id: '020', yaw: 20, src: IMG + 'yaw-020.jpg', operate: true,
      handle: [30, 6, 48, 14], power: [38, 30, 2.4, 3],
      spkL: [18, 40, 20, 48], spkR: [74, 42, 13, 40],
      knobs: [50, 34, 16, 6],
      face: [40, 42, 36, 42, 'perspective(1100px) rotateY(-18deg)'],
      cd: [42, 16, 30, 22], usb0: [0, 0, 0, 0], usb1: [0, 0, 0, 0],
      ants: [{ x: 58, y: 8 }, { x: 66, y: 7 }] },
    { id: '040', yaw: 40, src: IMG + 'yaw-040.jpg', operate: true,
      handle: [36, 6, 42, 14], power: [26.5, 30, 3.5, 8],
      spkL: [22, 44, 20, 46], spkR: [74, 46, 14, 38],
      knobs: [52, 36, 18, 6],
      face: [42, 44, 34, 40, 'perspective(1100px) rotateY(-26deg)'],
      cd: [44, 18, 32, 22], usb0: [0, 0, 0, 0], usb1: [0, 0, 0, 0],
      ants: [{ x: 60, y: 8 }, { x: 70, y: 7 }] },
    { id: '090', yaw: 90, src: IMG + 'yaw-090.jpg', operate: false,
      handle: [48, 6, 30, 16], power: [0, 0, 0, 0],
      spkL: [36, 42, 22, 40], spkR: [0, 0, 0, 0],
      knobs: [0, 0, 0, 0],
      face: [0, 0, 0, 0, 'none'],
      cd: [50, 16, 24, 18], usb0: [0, 0, 0, 0], usb1: [0, 0, 0, 0],
      ants: [{ x: 58, y: 8 }, { x: 64, y: 8 }] },
    { id: '140', yaw: 140, src: IMG + 'yaw-140.jpg', operate: false,
      handle: [30, 10, 46, 16], power: [0, 0, 0, 0],
      spkL: [0, 0, 0, 0], spkR: [18, 34, 22, 46],
      knobs: [0, 0, 0, 0],
      face: [0, 0, 0, 0, 'none'],
      cd: [40, 16, 26, 18], usb0: [0, 0, 0, 0], usb1: [0, 0, 0, 0],
      ants: [{ x: 38, y: 12 }, { x: 46, y: 11 }] },
    { id: '270', yaw: 270, src: IMG + 'yaw-270.jpg', operate: false,
      handle: [30, 10, 40, 16], power: [0, 0, 0, 0],
      spkL: [0, 0, 0, 0], spkR: [42, 28, 30, 54],
      knobs: [0, 0, 0, 0],
      face: [0, 0, 0, 0, 'none'],
      cd: [40, 14, 28, 18], usb0: [0, 0, 0, 0], usb1: [0, 0, 0, 0],
      ants: [{ x: 48, y: 10 }, { x: 54, y: 10 }] },
    { id: '320', yaw: 320, src: IMG + 'yaw-320.jpg', operate: true,
      handle: [24, 8, 50, 14], power: [0, 0, 0, 0],
      spkL: [16, 40, 12, 40], spkR: [58, 32, 28, 52],
      knobs: [48, 28, 16, 6],
      face: [24, 36, 38, 46, 'perspective(1100px) rotateY(26deg)'],
      cd: [40, 14, 28, 20], usb0: [0, 0, 0, 0], usb1: [0, 0, 0, 0],
      ants: [{ x: 62, y: 10 }, { x: 70, y: 9 }] },
    { id: 'up', yaw: 40, pitch: 40, src: IMG + 'pitch-up.jpg', operate: true,
      handle: [18, 16, 24, 16], power: [32, 28, 3, 4],
      spkL: [16, 48, 20, 40], spkR: [72, 42, 16, 40],
      knobs: [34, 30, 14, 6],
      face: [38, 38, 36, 44, 'perspective(1100px) rotateY(-26deg) rotateX(12deg)'],
      cd: [38, 6, 36, 32], usb0: [0, 0, 0, 0], usb1: [0, 0, 0, 0],
      ants: [{ x: 72, y: 10 }, { x: 80, y: 12 }] }
  ];

  var STATIONS = [
    { freq: 88.1, name: 'DOSWAPZ LOFI', artist: 'DOSWAPZ', kind: 'video', url: '/assets/media/lofi/doswapz-lofi.mp4' },
    { freq: 91.7, name: 'GARDEN LOOP', artist: 'DOSWAPZ', kind: 'video', url: '/assets/media/lofi/doswapz-lofi-garden.mp4' },
    { freq: 95.3, name: 'BASEMENT MIX', artist: 'DOSWAPZ', kind: 'video', url: '/assets/media/live-sim-lofi.mp4' },
    { freq: 98.7, name: 'LILY PAD', artist: 'DOSWAPZ', kind: 'video', url: '/assets/media/lily-pad.mp4' },
    { freq: 102.5, name: 'AQUA DROP', artist: 'DOSWAPZ', kind: 'video', url: '/assets/media/aqua-drop.mp4' }
  ];

  var FUNC = ['RADIO', 'TAPE A', 'TAPE B', 'CD', 'USB'];

  var state = {
    power: true,
    func: 0,
    vol: 0.72,
    tone: 0,
    muteL: false,
    muteR: false,
    phones: false,
    bass: 0,
    treble: 0,
    eq: [0, 0, 0, 0, 0],
    yaw: 0,
    pitch: 0,
    x: 0,
    y: 0,
    scale: 1,
    ants: [
      { ang: -18, len: 52 },
      { ang: 16, len: 48 }
    ],
    tapes: [
      { url: null, name: '', playing: false },
      { url: null, name: '', playing: false }
    ],
    cd: { tracks: [], i: 0, playing: false, lidOpen: false },
    usb: [
      { tracks: [], i: 0 },
      { tracks: [], i: 0 }
    ],
    usbI: 0,
    usbPlaying: false,
    recDeck: -1,
    station: null,
    freq: 98.7,
    signal: 0.4,
    locked: false
  };

  var els = {};
  var drag = null;
  var ctx = null;
  var master = null;
  var noiseGain = null;
  var noiseSrc = null;
  var noiseFilter = null;
  var humOsc = null;
  var eqNodes = [];
  var bassFilter = null;
  var trebleFilter = null;
  var analyser = null;
  var vuBuf = null;
  var raf = 0;
  var toastTimer = 0;
  var skipTimer = 0;
  var rec = null;
  var recChunks = [];
  var lastStreamUrl = '';
  var holdEnded = false;
  var debug = /[?&]debug=1/.test(location.search);

  function $(id) { return document.getElementById(id); }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function angDiff(a, b) {
    var d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  function box(el, arr) {
    if (!el) return;
    if (!arr || !arr[2] || !arr[3]) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    el.style.left = arr[0] + '%';
    el.style.top = arr[1] + '%';
    el.style.width = arr[2] + '%';
    el.style.height = arr[3] + '%';
  }

  function toast(msg) {
    var t = els.toast;
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1600);
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
    master.gain.value = 1;
    master.connect(ctx.destination);

    bassFilter = ctx.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 120;
    bassFilter.gain.value = 0;
    trebleFilter = ctx.createBiquadFilter();
    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 6500;
    trebleFilter.gain.value = 0;

    var freqs = [60, 250, 1000, 4000, 12000];
    eqNodes = freqs.map(function (f) {
      var b = ctx.createBiquadFilter();
      b.type = 'peaking';
      b.frequency.value = f;
      b.Q.value = 0.9;
      b.gain.value = 0;
      return b;
    });
    bassFilter.connect(trebleFilter);
    trebleFilter.connect(eqNodes[0]);
    for (var i = 0; i < eqNodes.length - 1; i++) eqNodes[i].connect(eqNodes[i + 1]);

    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    vuBuf = new Uint8Array(analyser.frequencyBinCount);
    eqNodes[eqNodes.length - 1].connect(analyser);
    analyser.connect(master);

    noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 900;
    noiseFilter.Q.value = 0.6;
    noiseGain.connect(noiseFilter);
    noiseFilter.connect(bassFilter);

    var n = ctx.sampleRate * 2;
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i2 = 0; i2 < n; i2++) d[i2] = Math.random() * 2 - 1;
    noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;
    noiseSrc.loop = true;
    noiseSrc.connect(noiseGain);
    noiseSrc.start();

    return ctx;
  }

  function stopHum() {
    if (!humOsc) return;
    try { humOsc.stop(); } catch (e) {}
    humOsc = null;
  }

  function setNoise() {
    if (noiseGain) noiseGain.gain.value = 0;
    stopHum();
  }

  function pickFrame() {
    if (state.pitch > 26) {
      for (var i = 0; i < FRAMES.length; i++) if (FRAMES[i].id === 'up') return FRAMES[i];
    }
    var yaw = (state.yaw % 360 + 360) % 360;
    var best = FRAMES[0];
    var bestD = 999;
    for (var j = 0; j < FRAMES.length; j++) {
      if (FRAMES[j].id === 'up') continue;
      var d = angDiff(yaw, FRAMES[j].yaw);
      if (d < bestD) { bestD = d; best = FRAMES[j]; }
    }
    return best;
  }

  function frontCdSrc() {
    if (state.cd.lidOpen) {
      return state.cd.tracks.length ? IMG + 'yaw-000-open-disc.jpg' : IMG + 'yaw-000-open.jpg';
    }
    return IMG + 'yaw-000.jpg';
  }

  function setCdLid(open) {
    if (state.cd.lidOpen === open) return;
    state.cd.lidOpen = open;
    if (open && state.cd.playing) {
      try { els.audio.pause(); } catch (e) {}
      state.cd.playing = false;
      toast('LID OPEN * PAUSED');
    } else {
      toast(open ? 'LID OPEN' : (state.cd.tracks.length ? 'LID CLOSED * READY' : 'LID CLOSED'));
    }
    blip(open ? 560 : 260, 0.08, 0.05);
    applyFrame();
    updateHud();
  }

  function applyFrame() {
    var f = pickFrame();
    var src = f.src;
    var vis = f.id;
    if (f.id === '000') {
      src = frontCdSrc();
      vis = state.cd.lidOpen ? (state.cd.tracks.length ? '000-open-disc' : '000-open') : '000';
    }
    if (els.img.getAttribute('data-id') !== vis) {
      els.img.src = src;
      els.img.setAttribute('data-id', vis);
    }
    box(els.handle, f.handle);
    box(els.power, f.power);
    box(els.spkL, f.spkL);
    box(els.spkR, f.spkR);
    box(els.knobs, f.knobs);
    if (f.id === '000' && state.cd.lidOpen) {
      box(els.cdLid, [0, 0, 0, 0]);
      box(els.cdWell, f.cdWell);
      box(els.cdHinge, f.cdHinge);
    } else {
      box(els.cdLid, f.cd);
      box(els.cdWell, [0, 0, 0, 0]);
      box(els.cdHinge, [0, 0, 0, 0]);
    }
    box(els.usb0, f.usb0);
    box(els.usb1, f.usb1);
    box(els.jackPhones, f.phones);
    box(els.jackMic, f.mic);
    box(els.knobVol, f.volK);
    box(els.knobBass, f.bassK);
    box(els.knobTreble, f.trebK);
    syncDials();
    syncMediaChrome();
    if (f.operate && f.face && f.face[2]) {
      els.face.classList.remove('is-hidden');
      els.face.style.left = f.face[0] + '%';
      els.face.style.top = f.face[1] + '%';
      els.face.style.width = f.face[2] + '%';
      els.face.style.height = f.face[3] + '%';
      els.face.style.transform = f.face[4] || 'none';
      els.face.style.transformOrigin = (f.yaw > 180 ? '100% 50%' : '0% 50%');
    } else {
      els.face.classList.add('is-hidden');
    }
    placeAnts(f);
    var subY = ((state.yaw % 360 + 360) % 360) - f.yaw;
    if (subY > 180) subY -= 360;
    if (subY < -180) subY += 360;
    var subP = f.id === 'up' ? (state.pitch - 40) * 0.2 : state.pitch * 0.18;
    els.radio.style.transform = 'rotateX(' + (-subP) + 'deg) rotateY(' + (-subY * 0.28) + 'deg)';
    els.rig.style.transform = 'translate(' + state.x + 'px, ' + state.y + 'px) scale(' + state.scale + ')';
  }

  function placeAnts(f) {
    f = f || pickFrame();
    for (var i = 0; i < 2; i++) {
      var a = els.ants[i];
      var m = f.ants[i];
      var s = state.ants[i];
      a.style.left = m.x + '%';
      a.style.top = m.y + '%';
      var mast = a.querySelector('.ant-mast');
      var hit = a.querySelector('.ant-hit');
      mast.style.height = s.len + 'px';
      mast.style.transform = 'rotate(' + s.ang + 'deg)';
      hit.style.height = (s.len + 24) + 'px';
      hit.style.bottom = '0';
      hit.style.transform = 'rotate(' + s.ang + 'deg)';
    }
  }

  function freqFromAnts() {
    var a = clamp(state.ants[0].ang, -75, 75);
    var b = clamp(state.ants[1].ang, -75, 75);
    var coarse = FM_MIN + ((a + 75) / 150) * (FM_MAX - FM_MIN);
    var fine = (b / 75) * 1.15;
    return clamp(coarse + fine, FM_MIN, FM_MAX);
  }

  function signalFromAnts() {
    var e = ((state.ants[0].len + state.ants[1].len) / 2 - MIN_LEN) / (MAX_LEN - MIN_LEN);
    return clamp(e, 0, 1);
  }

  function nearestStation(freq) {
    var best = STATIONS[0];
    var bd = 99;
    for (var i = 0; i < STATIONS.length; i++) {
      var d = Math.abs(STATIONS[i].freq - freq);
      if (d < bd) { bd = d; best = STATIONS[i]; }
    }
    return { st: best, delta: bd };
  }

  function setNeedle() {
    var p = (state.freq - FM_MIN) / (FM_MAX - FM_MIN);
    els.needle.style.left = (8 + p * 84) + '%';
  }

  function applyTone() {
    if (bassFilter) bassFilter.gain.value = state.bass;
    if (trebleFilter) trebleFilter.gain.value = state.treble;
    if (eqNodes[0]) eqNodes[0].gain.value = state.eq[0] + state.bass * 0.25;
    if (eqNodes[4]) eqNodes[4].gain.value = state.eq[4] + state.treble * 0.25;
    for (var i = 1; i < 4; i++) {
      if (eqNodes[i]) eqNodes[i].gain.value = state.eq[i];
    }
  }

  function setEqCaps() {
    for (var i = 0; i < 5; i++) {
      var cap = els.eqCaps[i];
      if (!cap) continue;
      var t = 50 - state.eq[i] * 4.1;
      cap.style.top = clamp(t, 8, 92) + '%';
    }
    applyTone();
    syncDials();
  }

  function hookMedia(el) {
    ensureAudio();
    if (!el || el._hooked) return;
    try {
      var src = ctx.createMediaElementSource(el);
      src.connect(bassFilter);
      el._hooked = true;
    } catch (e) {}
  }

  function markDeck() {
    var map = { btnRadio: 0, btnTapeA: 1, btnTapeB: 2, btnCd: 3, btnUsb: 4 };
    Object.keys(map).forEach(function (id) {
      var b = $(id);
      if (b) b.classList.toggle('on', state.func === map[id] && state.power);
    });
    var p = $('btnPower');
    if (p) p.classList.toggle('on', state.power);
  }

  function setFunc(n) {
    n = clamp(n, 0, 4);
    state.func = n;
    markDeck();
    if (n === 0) applyRadio();
    else if (n === 3) playFromList('cd');
    else if (n === 4) playFromList('usb');
    else {
      var t = state.tapes[n - 1];
      if (t && t.url) playTape(n - 1);
      else {
        stopMedia();
        updateHud();
        toast('INSERT TAPE ' + (n === 1 ? 'A' : 'B'));
      }
    }
  }

  function seekStation(dir) {
    ensureAudio();
    state.func = 0;
    markDeck();
    var i = 0;
    if (state.station) {
      for (var s = 0; s < STATIONS.length; s++) {
        if (STATIONS[s].freq === state.station.freq) i = s;
      }
    }
    i = (i + dir + STATIONS.length) % STATIONS.length;
    var freq = STATIONS[i].freq;
    state.ants[0].ang = clamp(((freq - FM_MIN) / (FM_MAX - FM_MIN)) * 150 - 75, -75, 75);
    state.ants[0].len = Math.max(state.ants[0].len, 160);
    state.ants[1].len = Math.max(state.ants[1].len, 140);
    placeAnts();
    applyRadio();
    toast(STATIONS[i].name);
  }

  function syncDials() {
    function rot(el, v, min, max) {
      if (!el) return;
      var p = (v - min) / (max - min);
      el.style.setProperty('--rot', (-120 + p * 240) + 'deg');
    }
    rot(els.knobVol, state.vol, 0, 1);
    rot(els.knobBass, state.bass, -12, 12);
    rot(els.knobTreble, state.treble, -12, 12);
    if (els.rngVol) els.rngVol.value = String(Math.round(state.vol * 100));
    if (els.rngBass) els.rngBass.value = String(Math.round(state.bass));
    if (els.rngTreble) els.rngTreble.value = String(Math.round(state.treble));
  }

  function setVol(v) {
    state.vol = clamp(v, 0, 1);
    syncDials();
    applyRadio();
  }

  function asTrack(s) {
    return { url: s.url, name: s.name, artist: s.artist || '', kind: s.kind || 'video' };
  }

  function armCommunityDecks() {
    var all = STATIONS.map(asTrack);
    if (!all.length) return;
    state.tapes[0] = Object.assign({ playing: false }, asTrack(STATIONS[0]));
    state.tapes[1] = Object.assign({ playing: false }, asTrack(STATIONS[Math.min(2, STATIONS.length - 1)]));
    state.cd.tracks = all.slice();
    state.cd.i = 0;
    var mid = Math.ceil(all.length / 2);
    state.usb[0].tracks = all.slice(0, mid);
    state.usb[1].tracks = all.slice(mid);
    state.usbI = 0;
    syncTapeBtns();
    syncMediaChrome();
  }

  function playItem(item) {
    if (!item || !item.url) return;
    if (item.kind === 'video' || /\.mp4($|\?)/i.test(item.url || '')) {
      playStream({ kind: 'video', url: item.url });
    } else {
      playStream({ kind: 'stream', url: item.url, urls: item.urls || [item.url] });
    }
  }

  function dubToTape(deck) {
    var src = state.station || STATIONS[0];
    if (!src) { toast('NOTHING TO DUB'); return; }
    state.tapes[deck] = Object.assign({ playing: false }, asTrack(src));
    toast('DUBBED -> TAPE ' + (deck ? 'B' : 'A'));
    syncTapeBtns();
    updateHud();
  }

  function updateHud() {
    var freq = els.hudFreq;
    var name = els.hudName;
    var sig = els.hudSig;
    var mode = els.hudMode;
    var vol = els.hudVol;
    var bars = Math.round(state.signal * 6);
    var bar = '';
    for (var i = 0; i < 6; i++) bar += i < bars ? '█' : '░';
    if (!state.power) {
      freq.textContent = '--.-';
      name.textContent = 'POWER OFF';
      sig.textContent = 'SIG ░░░░░░';
      mode.textContent = '----';
      vol.textContent = 'VOL --';
      els.hud.classList.add('off');
      return;
    }
    els.hud.classList.remove('off');
    freq.textContent = state.freq.toFixed(1);
    mode.textContent = FUNC[state.func];
    if (state.func === 0) {
      if (state.station) {
        name.textContent = state.station.artist
          ? (state.station.artist + ' * ' + state.station.name)
          : state.station.name;
      } else {
        name.textContent = 'COMMUNITY RADIO';
      }
    } else if (state.func === 3) {
      var ct = state.cd.tracks[state.cd.i];
      name.textContent = ct ? ('CD ' + (state.cd.i + 1) + '/' + state.cd.tracks.length + ' ' + ct.name) : 'NO DISC';
    } else if (state.func === 4) {
      var ut = usbTracks()[state.usbI];
      name.textContent = ut ? ('USB ' + (state.usbI + 1) + '/' + usbTracks().length + ' ' + ut.name) : 'NO STICK';
    } else {
      var t = state.tapes[state.func - 1];
      name.textContent = t && t.name ? t.name : 'NO TAPE';
    }
    sig.textContent = 'SIG ' + bar;
    vol.textContent = 'VOL ' + Math.round(state.vol * 10);
    if (els.hudBass) els.hudBass.textContent = 'BASS ' + (state.bass > 0 ? '+' : '') + Math.round(state.bass);
    if (els.hudTreble) els.hudTreble.textContent = 'TREB ' + (state.treble > 0 ? '+' : '') + Math.round(state.treble);
    markDeck();
    var list = document.getElementById('stationList');
    if (list) {
      var nodes = list.querySelectorAll('[data-freq]');
      for (var j = 0; j < nodes.length; j++) {
        var f = parseFloat(nodes[j].getAttribute('data-freq'));
        nodes[j].classList.toggle('on', state.locked && state.station && Math.abs(state.station.freq - f) < 0.05);
      }
    }
  }

  function stopMedia() {
    holdEnded = true;
    try { els.audio.pause(); } catch (e) {}
    try { els.video.pause(); } catch (e2) {}
    els.audio.removeAttribute('src');
    els.video.removeAttribute('src');
    lastStreamUrl = '';
    state.tapes[0].playing = false;
    state.tapes[1].playing = false;
    state.cd.playing = false;
    state.usbPlaying = false;
    syncTapeBtns();
    syncMediaChrome();
  }

  function fileTitle(file) {
    return (file.name || 'TRACK').replace(/\.[^.]+$/, '').slice(0, 18).toUpperCase();
  }

  function usbTracks() {
    return state.usb[0].tracks.concat(state.usb[1].tracks);
  }

  function syncMediaChrome() {
    if (!els.cdLid) return;
    els.cdLid.classList.toggle('is-loaded', state.cd.tracks.length > 0);
    els.cdLid.classList.toggle('is-play', state.cd.playing && state.power);
    els.usb0.classList.toggle('is-in', state.usb[0].tracks.length > 0);
    els.usb1.classList.toggle('is-in', state.usb[1].tracks.length > 0);
    if (els.jackPhones) els.jackPhones.classList.toggle('is-on', !!state.phones);
    if (els.jackMic) els.jackMic.classList.toggle('is-on', state.recDeck >= 0);
  }

  function playFromList(kind) {
    var list = kind === 'cd' ? state.cd.tracks : usbTracks();
    var idx = kind === 'cd' ? state.cd.i : state.usbI;
    if (kind === 'cd' && state.cd.lidOpen) {
      toast('CLOSE THE LID');
      return;
    }
    if (!list.length) {
      armCommunityDecks();
      list = kind === 'cd' ? state.cd.tracks : usbTracks();
    }
    if (!list.length) { toast('NO COMMUNITY TRACKS'); return; }
    idx = ((idx % list.length) + list.length) % list.length;
    if (kind === 'cd') state.cd.i = idx; else state.usbI = idx;
    stopMedia();
    state.func = kind === 'cd' ? 3 : 4;
    markDeck();
    var tr = list[idx];
    holdEnded = false;
    playItem(tr);
    if (kind === 'cd') state.cd.playing = true;
    else state.usbPlaying = true;
    syncMediaChrome();
    blip(kind === 'cd' ? 880 : 640, 0.06, 0.05);
    toast(tr.name);
    updateHud();
  }

  function loadTracks(files, sink, label) {
    if (!files || !files.length) return;
    sink.tracks.forEach(function (t) {
      if (t.url && t.url.indexOf('blob:') === 0) URL.revokeObjectURL(t.url);
    });
    sink.tracks = [];
    sink.i = 0;
    for (var i = 0; i < files.length; i++) {
      sink.tracks.push({ url: URL.createObjectURL(files[i]), name: fileTitle(files[i]) });
    }
    toast(label + ' * ' + sink.tracks.length + ' TRACK' + (sink.tracks.length > 1 ? 'S' : ''));
    syncMediaChrome();
    updateHud();
  }

  function nextTrack(dir) {
    if (state.func === 3 && state.cd.tracks.length) {
      state.cd.i = (state.cd.i + dir + state.cd.tracks.length) % state.cd.tracks.length;
      playFromList('cd');
    } else if (state.func === 4 && usbTracks().length) {
      var n = usbTracks().length;
      state.usbI = (state.usbI + dir + n) % n;
      playFromList('usb');
    }
  }

  function playStream(st) {
    if (st.kind === 'video') {
      if (els.video.getAttribute('src') !== st.url) {
        els.audio.removeAttribute('src');
        els.video.src = st.url;
        lastStreamUrl = st.url;
      }
      els.video.loop = true;
      els.video.muted = false;
      els.video.volume = (state.muteL && state.muteR) ? 0 : state.vol;
      els.video.play().catch(function () {});
      return;
    }
    var urls = st.urls || [st.url];
    var want = urls[0];
    if (lastStreamUrl && urls.indexOf(lastStreamUrl) !== -1) want = lastStreamUrl;
    if (els.audio.getAttribute('src') !== want) {
      els.video.removeAttribute('src');
      els.audio.src = want;
      lastStreamUrl = want;
    }
    els.audio.volume = (state.muteL && state.muteR) ? 0 : state.vol;
    els.audio.play().catch(function () {
      if (urls[1] && els.audio.getAttribute('src') !== urls[1]) {
        els.audio.src = urls[1];
        lastStreamUrl = urls[1];
        els.audio.play().catch(function () {});
      }
    });
  }

  function playTape(deck) {
    var t = state.tapes[deck];
    if (!t || !t.url) {
      armCommunityDecks();
      t = state.tapes[deck];
    }
    if (!t || !t.url) { toast('NO TAPE'); return; }
    stopMedia();
    state.func = deck + 1;
    markDeck();
    playItem(t);
    t.playing = true;
    syncTapeBtns();
    blip(520, 0.06, 0.05);
    toast('TAPE ' + (deck ? 'B' : 'A') + ' * ' + t.name);
    updateHud();
  }

  function syncTapeBtns() {
    var aPlay = document.querySelector('[data-deck="0"][data-act="play"]');
    var bPlay = document.querySelector('[data-deck="1"][data-act="play"]');
    if (aPlay) aPlay.classList.toggle('is-on', state.tapes[0].playing);
    if (bPlay) bPlay.classList.toggle('is-on', state.tapes[1].playing);
    els.tapeA.classList.toggle('is-loaded', !!state.tapes[0].url);
    els.tapeB.classList.toggle('is-loaded', !!state.tapes[1].url);
    els.recA.classList.toggle('is-on', state.recDeck === 0);
    els.recB.classList.toggle('is-on', state.recDeck === 1);
  }

  function applyRadio() {
    ensureAudio();
    setNoise();
    state.freq = freqFromAnts();
    state.signal = 1;
    var near = nearestStation(state.freq);
    state.locked = true;
    state.station = near.st;
    if (near.st && Math.abs(state.freq - near.st.freq) > 0.05) {
      state.freq = near.st.freq;
    }
    setNeedle();

    var wantRadio = state.power && state.func === 0;
    if (!state.power) {
      stopMedia();
    } else if (wantRadio && near.st && near.st.kind !== 'noise') {
      playStream(near.st);
    } else if (state.func === 1 || state.func === 2) {
      var t = state.tapes[state.func - 1];
      if (t && t.playing) {
        els.audio.volume = state.vol;
        els.video.volume = state.vol;
      }
    }

    if (els.audio.src && !els.audio.paused) els.audio.volume = state.vol;
    if (els.video.src && !els.video.paused) els.video.volume = state.vol;
    if (master) {
      master.gain.value = (!state.power || (state.muteL && state.muteR)) ? 0 : state.vol;
    }
    applyTone();
    updateHud();
  }

  function setPower(on) {
    state.power = on;
    els.radio.classList.toggle('is-on', on);
    els.radio.classList.toggle('is-off', !on);
    if (on) {
      ensureAudio();
      blip(220, 0.08, 0.06);
    } else {
      stopMedia();
      setNoise(null, 0);
      blip(90, 0.12, 0.05);
    }
    applyRadio();
  }

  function loadTape(deck, file) {
    var t = state.tapes[deck];
    if (t.url && t.url.indexOf('blob:') === 0) URL.revokeObjectURL(t.url);
    t.url = URL.createObjectURL(file);
    t.name = (file.name || 'TAPE').replace(/\.[^.]+$/, '').slice(0, 18).toUpperCase();
    toast('TAPE ' + (deck === 0 ? 'A' : 'B') + ' LOADED');
    syncTapeBtns();
    updateHud();
  }

  function startRec(deck) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('NO MIC');
      return;
    }
    ensureAudio();
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      recChunks = [];
      try {
        rec = new MediaRecorder(stream);
      } catch (e) {
        rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      }
      rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) recChunks.push(ev.data); };
      rec.onstop = function () {
        stream.getTracks().forEach(function (tr) { tr.stop(); });
        var blob = new Blob(recChunks, { type: rec.mimeType || 'audio/webm' });
        var file = new File([blob], 'RECORDED-TAPE-' + (deck === 0 ? 'A' : 'B') + '.webm', { type: blob.type });
        loadTape(deck, file);
        rec = null;
        state.recDeck = -1;
        syncTapeBtns();
        toast('TAKE RECORDED');
      };
      rec.start();
      state.recDeck = deck;
      syncTapeBtns();
      toast('RECORDING TAPE ' + (deck === 0 ? 'A' : 'B'));
      blip(1400, 0.12, 0.05);
    }).catch(function () { toast('MIC BLOCKED'); });
  }

  function stopRec() {
    if (rec && rec.state === 'recording') rec.stop();
  }

  function isMediaPlaying() {
    return (els.audio && els.audio.src && !els.audio.paused) ||
      (els.video && els.video.src && !els.video.paused);
  }

  function transport(act) {
    if (!state.power) { toast('POWER OFF'); return; }
    ensureAudio();
    if (act === 'play') {
      if (state.func === 0) {
        if (isMediaPlaying()) {
          try { els.audio.pause(); } catch (e) {}
          try { els.video.pause(); } catch (e2) {}
          toast('PAUSE');
        } else {
          var st = nearestStation(state.freq).st;
          if (st) playStream(st);
          toast(st ? ('PLAY * ' + st.name) : 'PLAY');
        }
        return;
      }
      if (state.func === 3) {
        if (state.cd.playing) {
          try { els.audio.pause(); } catch (e3) {}
          state.cd.playing = false;
          syncMediaChrome();
          toast('CD PAUSE');
        } else playFromList('cd');
        return;
      }
      if (state.func === 4) {
        if (state.usbPlaying) {
          try { els.audio.pause(); } catch (e4) {}
          state.usbPlaying = false;
          syncMediaChrome();
          toast('USB PAUSE');
        } else playFromList('usb');
        return;
      }
      tapeAction(state.func === 2 ? 1 : 0, 'play');
      return;
    }
    if (act === 'stop') {
      stopRec();
      stopMedia();
      toast('STOP');
      return;
    }
    if (act === 'rew' || act === 'ff') {
      var dir = act === 'ff' ? 1 : -1;
      if (state.func === 0) seekStation(dir);
      else if (state.func === 3 || state.func === 4) nextTrack(dir);
      else tapeAction(state.func === 2 ? 1 : 0, act);
      return;
    }
    if (act === 'rec') tapeAction(state.func === 2 ? 1 : 0, 'rec');
  }

  function renderStations() {
    var list = document.getElementById('stationList');
    if (!list) return;
    list.innerHTML = STATIONS.map(function (s) {
      var label = s.freq.toFixed(1) + ' ' + (s.artist ? s.artist + ' * ' : '') + s.name;
      return '<div data-freq="' + s.freq + '" role="button" tabindex="0">' + label + '</div>';
    }).join('');
  }

  function loadCommunityPlaylist(done) {
    fetch('/assets/data/boombox-playlist.json?v=comm1')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.stations && data.stations.length) STATIONS = data.stations;
        armCommunityDecks();
        renderStations();
        if (done) done();
      })
      .catch(function () {
        armCommunityDecks();
        renderStations();
        if (done) done();
      });
  }

  function tapeAction(deck, act) {
    if (!state.power) { toast('POWER OFF'); return; }
    ensureAudio();
    if (act === 'rec') {
      dubToTape(deck);
      return;
    }
    if (act === 'play') {
      if (state.tapes[deck].playing) {
        els.audio.pause();
        state.tapes[deck].playing = false;
        syncTapeBtns();
        return;
      }
      playTape(deck);
      return;
    }
    if (act === 'stop') {
      stopRec();
      stopMedia();
      blip(180, 0.05, 0.04);
      return;
    }
    if (act === 'rew' || act === 'ff') {
      if (!state.tapes[deck].url) { playTape(deck); return; }
      if (!state.tapes[deck].playing) playTape(deck);
      var dir = act === 'ff' ? 8 : -8;
      skipTimer = setInterval(function () {
        try { els.audio.currentTime = Math.max(0, els.audio.currentTime + dir * 0.25); } catch (e) {}
      }, 80);
    }
  }

  function drawVu() {
    if (!els.vuCtx) return;
    var c = els.vu;
    var g = els.vuCtx;
    var w = c.width;
    var h = c.height;
    g.clearRect(0, 0, w, h);
    var l = 0;
    var r = 0;
    if (state.power) {
      if (analyser && (state.func !== 0 || !state.locked)) {
        analyser.getByteFrequencyData(vuBuf);
        var sum = 0;
        for (var i = 0; i < vuBuf.length; i++) sum += vuBuf[i];
        l = (sum / vuBuf.length) / 180;
      }
      var playing = (!els.audio.paused && els.audio.src) || (!els.video.paused && els.video.src);
      if (playing) {
        l = Math.max(l, 0.22 + Math.random() * 0.55 * state.vol * (state.func === 0 ? state.signal : 1));
      }
      if (state.func === 0 && !state.locked && state.power) {
        l = Math.max(l, 0.08 + Math.random() * 0.2);
      }
      r = l * (0.82 + Math.random() * 0.22);
    }
    if (state.muteL) l = 0;
    if (state.muteR) r = 0;
    function needle(x0, x1, val) {
      var midY = h * 0.55;
      var ang = (-50 + val * 90) * Math.PI / 180;
      var cx = (x0 + x1) / 2;
      var len = h * 0.42;
      g.strokeStyle = '#ffaa33';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx, midY + 6);
      g.lineTo(cx + Math.cos(ang) * len, midY - Math.sin(ang) * len);
      g.stroke();
    }
    needle(w * 0.08, w * 0.48, clamp(l, 0, 1));
    needle(w * 0.52, w * 0.92, clamp(r, 0, 1));
  }

  function loop() {
    drawVu();
    raf = requestAnimationFrame(loop);
  }

  function radioPoint(e) {
    var r = els.radio.getBoundingClientRect();
    var sx = r.width / els.radio.offsetWidth;
    var sy = r.height / els.radio.offsetHeight;
    return {
      x: (e.clientX - r.left) / sx,
      y: (e.clientY - r.top) / sy,
      sx: sx,
      sy: sy
    };
  }

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    ensureAudio();
    var t = e.target;
    if (t.closest && t.closest('.nav, .btn, a, .deck-bar, .dknob')) return;

    if (t.classList.contains('ant-hit') || t.closest('.ant')) {
      var id = parseInt(t.getAttribute('data-ant') || t.closest('.ant').getAttribute('data-ant'), 10);
      var f = pickFrame();
      var r = els.radio.getBoundingClientRect();
      drag = {
        kind: 'ant', id: id,
        mx: r.left + f.ants[id].x / 100 * r.width,
        my: r.top + f.ants[id].y / 100 * r.height
      };
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (t.classList.contains('eq-s')) {
      drag = { kind: 'eq', i: parseInt(t.getAttribute('data-i'), 10), el: t };
      moveEq(e);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (t.classList.contains('tuner') || t.id === 'tuner' || t.id === 'needle') {
      if (state.func !== 0) {
        state.func = 0;
        markDeck();
        toast('RADIO');
      }
      drag = { kind: 'tuner' };
      moveTuner(e);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (t.classList.contains('knob')) {
      drag = { kind: 'knob', which: t.getAttribute('data-k'), y: e.clientY, vol: state.vol, bass: state.bass, treble: state.treble, func: state.func };
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (t.id === 'handle' || t.classList.contains('handle')) {
      drag = { kind: 'move', x: e.clientX, y: e.clientY, ox: state.x, oy: state.y };
      e.preventDefault();
      return;
    }
    if (t.closest && t.closest('.face, .hot.power, .tape-btns, .rec-led, .cd-lid, .cd-hinge, .cd-well, .usb-port, .jack, .tuner, .eq, .knob')) return;

    drag = { kind: 'spin', x: e.clientX, y: e.clientY, yaw: state.yaw, pitch: state.pitch };
    e.preventDefault();
  }

  function moveEq(e) {
    if (!drag || drag.kind !== 'eq') return;
    var rect = drag.el.getBoundingClientRect();
    var p = 1 - (e.clientY - rect.top) / rect.height;
    state.eq[drag.i] = clamp((p - 0.5) * 24, -12, 12);
    setEqCaps();
  }

  function moveTuner(e) {
    var rect = els.tuner.getBoundingClientRect();
    var p = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    var freq = FM_MIN + p * (FM_MAX - FM_MIN);
    var a = ((freq - FM_MIN) / (FM_MAX - FM_MIN)) * 150 - 75;
    state.ants[0].ang = clamp(a, -75, 75);
    placeAnts();
    applyRadio();
  }

  function onMove(e) {
    if (!drag) return;
    if (drag.kind === 'ant') {
      var dx = e.clientX - drag.mx;
      var dy = e.clientY - drag.my;
      var ang = Math.atan2(dx, -dy) * 180 / Math.PI;
      var dist = Math.hypot(dx, dy) / (els.radio.getBoundingClientRect().width / els.radio.offsetWidth);
      state.ants[drag.id].ang = clamp(ang, -80, 80);
      state.ants[drag.id].len = clamp(dist, MIN_LEN, MAX_LEN);
      placeAnts();
      if (state.func === 0) applyRadio();
      else { state.freq = freqFromAnts(); state.signal = signalFromAnts(); setNeedle(); updateHud(); }
      return;
    }
    if (drag.kind === 'eq') { moveEq(e); return; }
    if (drag.kind === 'tuner') { moveTuner(e); return; }
    if (drag.kind === 'knob') {
      var dy = drag.y - e.clientY;
      if (drag.which === 'vol') {
        setVol(drag.vol + dy / 180);
      } else if (drag.which === 'func') {
        var n = clamp(Math.round(drag.func + dy / 55), 0, 4);
        if (n !== state.func) setFunc(n);
      } else if (drag.which === 'bass' || drag.which === 'tone') {
        state.bass = clamp(drag.bass + dy / 12, -12, 12);
        if (els.rngBass) els.rngBass.value = String(state.bass);
        applyTone();
        updateHud();
      } else if (drag.which === 'treble') {
        state.treble = clamp(drag.treble + dy / 12, -12, 12);
        if (els.rngTreble) els.rngTreble.value = String(state.treble);
        applyTone();
        updateHud();
      }
      return;
    }
    if (drag.kind === 'move') {
      state.x = drag.ox + (e.clientX - drag.x);
      state.y = drag.oy + (e.clientY - drag.y);
      applyFrame();
      return;
    }
    if (drag.kind === 'spin') {
      state.yaw = drag.yaw + (e.clientX - drag.x) * 0.45;
      state.pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.22, -8, 48);
      applyFrame();
    }
  }

  function onUp() {
    if (skipTimer) { clearInterval(skipTimer); skipTimer = 0; }
    drag = null;
  }

  function bind() {
    var stage = els.stage;
    stage.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    els.power.addEventListener('click', function (e) {
      e.stopPropagation();
      setPower(!state.power);
    });
    function bindClick(id, fn) {
      var b = $(id);
      if (b) b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    }
    bindClick('btnPower', function () { setPower(!state.power); });
    bindClick('btnRadio', function () { setFunc(0); toast('RADIO'); });
    bindClick('btnTapeA', function () { setFunc(1); });
    bindClick('btnTapeB', function () { setFunc(2); });
    bindClick('btnCd', function () { setFunc(3); });
    bindClick('btnUsb', function () { setFunc(4); });
    bindClick('tunePrev', function () { seekStation(-1); });
    bindClick('tuneNext', function () { seekStation(1); });
    var stationList = document.getElementById('stationList');
    if (stationList) {
      stationList.style.pointerEvents = 'auto';
      stationList.addEventListener('click', function (e) {
        var row = e.target.closest('[data-freq]');
        if (!row) return;
        var freq = parseFloat(row.getAttribute('data-freq'));
        if (!freq) return;
        state.func = 0;
        state.ants[0].ang = clamp(((freq - FM_MIN) / (FM_MAX - FM_MIN)) * 150 - 75, -75, 75);
        placeAnts();
        applyRadio();
        toast(row.textContent.trim());
      });
    }
    document.querySelectorAll('#deckBar [data-act]').forEach(function (b) {
      b.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
        var deck = state.func === 2 ? 1 : 0;
        transport(b.getAttribute('data-act'));
      });
    });
    function bindRange(id, fn) {
      var r = $(id);
      if (!r) return;
      r.addEventListener('input', function () { fn(this); });
    }
    bindRange('rngVol', function (el) { setVol(parseInt(el.value, 10) / 100); });
    bindRange('rngBass', function (el) {
      state.bass = parseInt(el.value, 10);
      applyTone();
      updateHud();
    });
    bindRange('rngTreble', function (el) {
      state.treble = parseInt(el.value, 10);
      applyTone();
      updateHud();
    });

    els.spkL.addEventListener('click', function (e) {
      e.stopPropagation();
      state.muteL = !state.muteL;
      els.spkL.classList.toggle('is-mute', state.muteL);
      toast(state.muteL ? 'LEFT MUTE' : 'LEFT LIVE');
      applyRadio();
    });
    els.spkR.addEventListener('click', function (e) {
      e.stopPropagation();
      state.muteR = !state.muteR;
      els.spkR.classList.toggle('is-mute', state.muteR);
      toast(state.muteR ? 'RIGHT MUTE' : 'RIGHT LIVE');
      applyRadio();
    });

    els.tapeA.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!state.power) return;
      setFunc(1);
    });
    els.tapeB.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!state.power) return;
      setFunc(2);
    });

    document.querySelectorAll('.tape-btns button').forEach(function (b) {
      b.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
        e.preventDefault();
        b.classList.add('is-down');
        tapeAction(parseInt(b.getAttribute('data-deck'), 10), b.getAttribute('data-act'));
      });
      b.addEventListener('pointerup', function () { b.classList.remove('is-down'); });
    });
    els.recA.addEventListener('click', function (e) {
      e.stopPropagation();
      tapeAction(0, 'rec');
    });
    els.recB.addEventListener('click', function (e) {
      e.stopPropagation();
      tapeAction(1, 'rec');
    });
    els.midTape.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!state.power) return;
      if (state.func === 3 && state.cd.tracks.length) { nextTrack(1); return; }
      if (state.func === 4 && usbTracks().length) { nextTrack(1); return; }
      seekStation(1);
    });

    els.cdLid.addEventListener('click', function (e) {
      e.stopPropagation();
      setCdLid(true);
    });
    els.cdHinge.addEventListener('click', function (e) {
      e.stopPropagation();
      setCdLid(false);
    });
    els.cdWell.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!state.power) { toast('POWER OFF'); return; }
      armCommunityDecks();
      toast('COMMUNITY DISC SEATED * CLOSE LID');
      applyFrame();
      return;
    });
    els.cdWell.addEventListener('dblclick', function (e) {
      e.stopPropagation();
      state.cd.tracks.forEach(function (t) {
        if (t.url && t.url.indexOf('blob:') === 0) URL.revokeObjectURL(t.url);
      });
      state.cd.tracks = [];
      state.cd.i = 0;
      if (state.func === 3) stopMedia();
      syncMediaChrome();
      applyFrame();
      toast('CD EJECT');
      updateHud();
    });
    function usbClick(port) {
      return function (e) {
        e.stopPropagation();
        if (!state.power) { toast('POWER OFF'); return; }
        armCommunityDecks();
        state.usbI = port === 0 ? 0 : state.usb[0].tracks.length;
        playFromList('usb');
        toast('USB ' + (port + 1) + ' * COMMUNITY MIX');
      };
    }
    els.jackPhones.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!state.power) { toast('POWER OFF'); return; }
      state.phones = !state.phones;
      els.spkL.classList.toggle('is-mute', state.phones || state.muteL);
      els.spkR.classList.toggle('is-mute', state.phones || state.muteR);
      toast(state.phones ? 'PHONES IN' : 'SPEAKERS');
      syncMediaChrome();
      blip(state.phones ? 980 : 420, 0.05, 0.04);
    });
    els.jackMic.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!state.power) { toast('POWER OFF'); return; }
      if (state.recDeck >= 0) stopRec();
      else startRec(state.func === 2 ? 1 : 0);
    });
    els.usb0.addEventListener('click', usbClick(0));
    els.usb1.addEventListener('click', usbClick(1));
    function usbEject(port) {
      return function (e) {
        e.stopPropagation();
        state.usb[port].tracks.forEach(function (t) {
          if (t.url && t.url.indexOf('blob:') === 0) URL.revokeObjectURL(t.url);
        });
        state.usb[port].tracks = [];
        if (state.func === 4) stopMedia();
        syncMediaChrome();
        toast('USB ' + (port + 1) + ' OUT');
        updateHud();
      };
    }
    els.usb0.addEventListener('dblclick', usbEject(0));
    els.usb1.addEventListener('dblclick', usbEject(1));

    els.stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var next = state.scale * (e.deltaY > 0 ? 0.94 : 1.06);
      state.scale = clamp(next, 0.55, 1.85);
      applyFrame();
    }, { passive: false });

    els.stage.addEventListener('dblclick', function () {
      state.x = 0; state.y = 0; state.scale = 1; state.yaw = 0; state.pitch = 0;
      applyFrame();
      toast('VIEW RESET');
    });

    window.addEventListener('keydown', function (e) {
      if (e.repeat && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.key === ' ') {
        e.preventDefault();
        transport('play');
      }
      if (e.key === '[' || e.key === 'PageUp') { e.preventDefault(); nextTrack(-1); }
      if (e.key === ']' || e.key === 'PageDown') { e.preventDefault(); nextTrack(1); }
      if (e.key === 'ArrowLeft') { state.ants[0].ang = clamp(state.ants[0].ang - 3, -80, 80); placeAnts(); applyRadio(); }
      if (e.key === 'ArrowRight') { state.ants[0].ang = clamp(state.ants[0].ang + 3, -80, 80); placeAnts(); applyRadio(); }
      if (e.key === 'ArrowUp') { state.ants[0].len = clamp(state.ants[0].len + 10, MIN_LEN, MAX_LEN); placeAnts(); applyRadio(); }
      if (e.key === 'ArrowDown') { state.ants[0].len = clamp(state.ants[0].len - 10, MIN_LEN, MAX_LEN); placeAnts(); applyRadio(); }
    });

    els.audio.addEventListener('ended', function () {
      if (holdEnded) { holdEnded = false; return; }
      if (state.func === 3 && state.cd.tracks.length) { nextTrack(1); return; }
      if (state.func === 4 && usbTracks().length) { nextTrack(1); return; }
      state.tapes[0].playing = false;
      state.tapes[1].playing = false;
      state.cd.playing = false;
      state.usbPlaying = false;
      syncTapeBtns();
      syncMediaChrome();
    });
  }

  function preload() {
    FRAMES.forEach(function (f) { var i = new Image(); i.src = f.src; });
    [IMG + 'yaw-000-open.jpg', IMG + 'yaw-000-open-disc.jpg'].forEach(function (src) {
      var i = new Image(); i.src = src;
    });
  }

  function init() {
    els = {
      stage: $('stage'),
      rig: $('rig'),
      radio: $('radio'),
      img: $('radioImg'),
      handle: $('handle'),
      power: $('power'),
      spkL: $('spkL'),
      spkR: $('spkR'),
      knobs: $('knobs'),
      face: $('face'),
      tapeA: $('tapeA'),
      tapeB: $('tapeB'),
      recA: $('recA'),
      recB: $('recB'),
      midTape: $('midTape'),
      tuner: $('tuner'),
      needle: $('needle'),
      vu: $('vuCanvas'),
      toast: $('toast'),
      hud: $('hud'),
      hudFreq: $('hudFreq'),
      hudName: $('hudName'),
      hudSig: $('hudSig'),
      hudMode: $('hudMode'),
      hudVol: $('hudVol'),
      hudBass: $('hudBass'),
      hudTreble: $('hudTreble'),
      rngVol: $('rngVol'),
      rngBass: $('rngBass'),
      rngTreble: $('rngTreble'),
      fileA: $('fileA'),
      fileB: $('fileB'),
      fileAux: $('fileAux'),
      fileCd: $('fileCd'),
      fileUsb0: $('fileUsb0'),
      fileUsb1: $('fileUsb1'),
      cdLid: $('cdLid'),
      cdHinge: $('cdHinge'),
      cdWell: $('cdWell'),
      jackPhones: $('jackPhones'),
      jackMic: $('jackMic'),
      usb0: $('usb0'),
      usb1: $('usb1'),
      knobVol: $('knobVol'),
      knobBass: $('knobBass'),
      knobTreble: $('knobTreble'),
      audio: $('deckAudio'),
      video: $('deckVideo'),
      ants: [$('ant0'), $('ant1')],
      eqCaps: [0, 1, 2, 3, 4].map(function (i) { return $('eqCap' + i); })
    };
    if (els.vu) els.vuCtx = els.vu.getContext('2d');
    if (debug) document.body.classList.add('debug');

    preload();
    setEqCaps();
    applyFrame();
    bind();
    loadCommunityPlaylist(function () {
      setPower(true);
    });
    loop();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
