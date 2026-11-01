/* Chopper Daddy shop audio. Original tones only. No sample files. */
(function (root) {
  var PIPES = {
    drag: { name: 'Drag Pipes', base: 46, cyl: 1.49, rasp: 220, q: 0.55, noise: 0.42, lope: 9, note: 'Deep open lope' },
    up: { name: 'Upswept Pipes', base: 78, cyl: 1.62, rasp: 680, q: 1.6, noise: 0.2, lope: 14, note: 'Bright crack' },
    shotgun: { name: 'Shotgun Pipes', base: 62, cyl: 1.33, rasp: 340, q: 0.4, noise: 0.7, lope: 7, note: 'Loud wide bark' },
    wrapped: { name: 'Wrapped Pipes', base: 40, cyl: 1.5, rasp: 120, q: 3.2, noise: 0.06, lope: 6, note: 'Muffled rumble' }
  };
  var state = { on: true, ctx: null, master: null, ride: null, brakeAt: 0 };
  try { state.on = root.localStorage.getItem('chopperDaddySound') !== '0'; } catch (e) {}

  function pipe(id) { return PIPES[id] || PIPES.drag; }
  function enabled() { return state.on; }

  function ac() {
    if (!state.ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      state.ctx = new AC();
      state.master = state.ctx.createGain();
      state.master.gain.value = 0.22;
      state.master.connect(state.ctx.destination);
    }
    if (state.ctx.state === 'suspended' && state.ctx.resume) state.ctx.resume();
    return state.ctx;
  }

  function envGain(ctx, when, peak, dur) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + Math.min(0.02, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    g.connect(state.master);
    return g;
  }

  function tone(when, freq, dur, type, peak) {
    var ctx = ac();
    if (!ctx || !state.on) return;
    var o = ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.setValueAtTime(Math.max(20, freq), when);
    if (freq > 40) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.55), when + dur);
    o.connect(envGain(ctx, when, peak, dur));
    o.start(when);
    o.stop(when + dur + 0.02);
  }

  function noise(when, dur, freq, q, peak) {
    var ctx = ac();
    if (!ctx || !state.on) return;
    var frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    var g = envGain(ctx, when, peak, dur);
    src.connect(filter);
    filter.connect(g);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  function wrench(kind) {
    var ctx = ac();
    if (!ctx || !state.on) return;
    var heavy = kind === 'Frames' || kind === 'Engines' || kind === 'Wheels';
    var n = heavy ? 8 : 6;
    var gap = heavy ? 0.085 : 0.052;
    for (var i = 0; i < n; i++) {
      var t = ctx.currentTime + i * gap;
      tone(t, (heavy ? 150 : 210) + i * 28, 0.045, 'square', heavy ? 0.16 : 0.11);
      noise(t, 0.03, 700 + i * 90, 0.7, 0.08);
    }
  }

  function accent(cat) {
    var ctx = ac();
    if (!ctx || !state.on) return;
    var t = ctx.currentTime + 0.28;
    if (cat === 'Frames') tone(t, 62, 0.18, 'sine', 0.2);
    else if (cat === 'Engines') { tone(t, 55, 0.16, 'sawtooth', 0.16); tone(t + 0.12, 48, 0.18, 'sawtooth', 0.14); }
    else if (cat === 'Front End') tone(t, 340, 0.2, 'triangle', 0.1);
    else if (cat === 'Wheels') noise(t, 0.12, 140, 0.6, 0.16);
    else if (cat === 'Tanks') tone(t, 220, 0.16, 'sine', 0.12);
    else tone(t, 720, 0.08, 'triangle', 0.08);
  }

  function bark(id) {
    var ctx = ac();
    if (!ctx || !state.on) return;
    var p = pipe(id);
    var t = ctx.currentTime;
    tone(t, p.base, 0.18, 'sawtooth', 0.2);
    tone(t + 0.09, p.base * p.cyl, 0.16, 'square', 0.12);
    noise(t, 0.22, p.rasp, Math.max(0.4, p.q), 0.05 + p.noise * 0.2);
    noise(t + 0.11, 0.16, p.rasp * 1.3, 0.8, 0.04 + p.noise * 0.12);
  }

  function fit(cat, id) {
    ac();
    if (!state.on) return;
    wrench(cat);
    if (cat === 'Exhaust') bark(id);
    else accent(cat);
  }

  function stopRide() {
    var ride = state.ride;
    state.ride = null;
    if (!ride) return;
    try { ride.o1.stop(); ride.o2.stop(); ride.noise.stop(); } catch (e) {}
    try { ride.g.disconnect(); } catch (e) {}
  }

  function startRide(ctx, id) {
    stopRide();
    var p = pipe(id);
    var g = ctx.createGain();
    g.gain.value = 0.0001;
    g.connect(state.master);
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = p.rasp;
    filter.Q.value = p.q;
    var o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    var o2 = ctx.createOscillator();
    o2.type = 'square';
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(g);
    var frames = Math.max(1, ctx.sampleRate);
    var buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    var noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;
    noiseSrc.loop = true;
    var nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = p.rasp;
    nf.Q.value = 0.7;
    var ng = ctx.createGain();
    ng.gain.value = p.noise;
    noiseSrc.connect(nf);
    nf.connect(ng);
    ng.connect(g);
    o1.start();
    o2.start();
    noiseSrc.start();
    state.ride = { id: id, o1: o1, o2: o2, noise: noiseSrc, g: g, ng: ng, filter: filter, p: p };
  }

  function ride(rpm, id) {
    var ctx = ac();
    if (!ctx || !state.on) { stopRide(); return; }
    var key = PIPES[id] ? id : 'drag';
    if (!state.ride || state.ride.id !== key) startRide(ctx, key);
    var p = state.ride.p;
    var span = 0.7 + Math.min(1.5, Math.max(0, rpm) / 4200);
    var t = ctx.currentTime;
    var lope = 1 + Math.sin(t * p.lope) * 0.07;
    state.ride.o1.frequency.setTargetAtTime(p.base * span, t, 0.06);
    state.ride.o2.frequency.setTargetAtTime(p.base * p.cyl * span, t, 0.06);
    state.ride.filter.frequency.setTargetAtTime(p.rasp * span, t, 0.08);
    state.ride.ng.gain.setTargetAtTime(p.noise * (0.45 + Math.min(1, rpm / 5000)), t, 0.08);
    state.ride.g.gain.setTargetAtTime(0.16 * lope, t, 0.05);
  }

  function brake() {
    var ctx = ac();
    if (!ctx || !state.on) return;
    if (ctx.currentTime < state.brakeAt) return;
    state.brakeAt = ctx.currentTime + 0.16;
    noise(ctx.currentTime, 0.14, 1100, 0.7, 0.1);
  }

  function shift() { var ctx = ac(); if (ctx && state.on) tone(ctx.currentTime, 540, 0.04, 'square', 0.07); }
  function ui() { var ctx = ac(); if (ctx && state.on) tone(ctx.currentTime, 480, 0.03, 'square', 0.05); }
  function deny() { var ctx = ac(); if (ctx && state.on) tone(ctx.currentTime, 110, 0.18, 'sawtooth', 0.14); }
  function pay() {
    var ctx = ac();
    if (!ctx || !state.on) return;
    tone(ctx.currentTime, 660, 0.08, 'square', 0.1);
    tone(ctx.currentTime + 0.09, 880, 0.12, 'square', 0.1);
  }

  function toggle() {
    state.on = !state.on;
    try { root.localStorage.setItem('chopperDaddySound', state.on ? '1' : '0'); } catch (e) {}
    if (!state.on) stopRide();
    else { ac(); ui(); }
    return state.on;
  }

  root.ChopperSound = {
    pipes: PIPES,
    pipe: pipe,
    unlock: ac,
    enabled: enabled,
    toggle: toggle,
    wrench: wrench,
    bark: bark,
    fit: fit,
    ride: ride,
    stopRide: stopRide,
    brake: brake,
    shift: shift,
    ui: ui,
    deny: deny,
    pay: pay
  };
})(typeof window !== 'undefined' ? window : globalThis);
