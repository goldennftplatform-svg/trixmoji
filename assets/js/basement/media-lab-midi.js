/* Basement Media Lab — MIDI sound library
 * Web Audio instrument bank + on-screen keyboard + Web MIDI in.
 * No soundfont files. Each patch is a distinct synth so it runs local.
 */
(function () {
  'use strict';

  var KEYS = 25; /* two octaves + top C */
  var BASE_C = 48; /* C3 */
  var COMP_MAP = {
    z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11,
    q: 12, 2: 13, w: 14, 3: 15, e: 16, r: 17, 5: 18, t: 19, 6: 20, y: 21, 7: 22, u: 23, i: 24
  };

  var octave = 0;
  var patchId = 'piano';
  var vel = 0.85;
  var ctx = null;
  var master = null;
  var voices = {};
  var capturing = false;
  var capStart = 0;
  var capEvents = [];
  var midiAccess = null;
  var statusEl = null;

  function audio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function freqOf(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function envGain(ac, t, a, d, s, r, peak, dest) {
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t + a);
    if (s != null) {
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, s), t + a + d);
    } else {
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }
    g.connect(dest);
    return g;
  }

  function osc(ac, type, f, detune) {
    var o = ac.createOscillator();
    o.type = type;
    o.frequency.value = f;
    if (detune) o.detune.value = detune;
    return o;
  }

  function noiseBuf(ac, seconds) {
    var n = Math.floor(ac.sampleRate * seconds);
    var buf = ac.createBuffer(1, n, ac.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function startNoise(ac, dest, t, dur, filterType, hz, gain) {
    var src = ac.createBufferSource();
    src.buffer = noiseBuf(ac, Math.max(0.02, dur));
    var f = ac.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = hz;
    var g = ac.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function voiceStop(v, t, release) {
    if (!v || v.dead) return;
    v.dead = true;
    var now = t;
    try {
      if (v.gain) {
        v.gain.gain.cancelScheduledValues(now);
        v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), now);
        v.gain.gain.exponentialRampToValueAtTime(0.0001, now + (release || 0.12));
      }
      (v.oscs || []).forEach(function (o) {
        try {
          o.stop(now + (release || 0.12) + 0.02);
        } catch (e) {}
      });
    } catch (e) {}
  }

  function makeVoice(playFn) {
    return function (ac, dest, midi, velo, t) {
      return playFn(ac, dest, freqOf(midi), velo, t, midi);
    };
  }

  var PATCHES = [
    { id: 'piano', name: 'PIANO', group: 'KEYS', color: '#ffe8a0', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.004, 1.15, null, 0, v * 0.55, dest);
      var o1 = osc(ac, 'sine', f); o1.connect(g);
      var o2 = osc(ac, 'triangle', f * 2); var g2 = ac.createGain(); g2.gain.value = 0.18; o2.connect(g2); g2.connect(g);
      startNoise(ac, g, t, 0.03, 'highpass', 4000, v * 0.12);
      o1.start(t); o2.start(t); o1.stop(t + 1.4); o2.stop(t + 1.4);
      return { gain: g, oscs: [o1, o2] };
    })},
    { id: 'rhodes', name: 'RHODES', group: 'KEYS', color: '#ffcc66', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.006, 1.4, null, 0, v * 0.45, dest);
      var car = osc(ac, 'sine', f);
      var mod = osc(ac, 'sine', f * 2);
      var mg = ac.createGain(); mg.gain.value = f * 1.6;
      mod.connect(mg); mg.connect(car.frequency);
      car.connect(g);
      ostart(car, mod, t, 1.6);
      return { gain: g, oscs: [car, mod] };
    })},
    { id: 'organ', name: 'ORGAN', group: 'KEYS', color: '#88ffaa', sustain: true, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.02, 0.05, v * 0.28, 0.18, v * 0.35, dest);
      var o1 = osc(ac, 'sine', f);
      var o2 = osc(ac, 'sine', f * 2);
      var o3 = osc(ac, 'sine', f * 3);
      var mix = ac.createGain(); mix.gain.value = 1;
      o1.connect(mix); var h2 = ac.createGain(); h2.gain.value = 0.55; o2.connect(h2); h2.connect(mix);
      var h3 = ac.createGain(); h3.gain.value = 0.22; o3.connect(h3); h3.connect(mix);
      mix.connect(g);
      o1.start(t); o2.start(t); o3.start(t);
      return { gain: g, oscs: [o1, o2, o3], release: 0.18 };
    })},
    { id: 'clavi', name: 'CLAVI', group: 'KEYS', color: '#ff88cc', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.001, 0.18, null, 0, v * 0.4, dest);
      var o = osc(ac, 'square', f);
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 10, t); lp.frequency.exponentialRampToValueAtTime(f * 2, t + 0.12);
      o.connect(lp); lp.connect(g);
      o.start(t); o.stop(t + 0.28);
      return { gain: g, oscs: [o] };
    })},
    { id: 'bass', name: 'FINGER BASS', group: 'BASS', color: '#66ccff', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.005, 0.35, null, 0, v * 0.7, dest);
      var o = osc(ac, 'sine', f);
      var o2 = osc(ac, 'triangle', f); var g2 = ac.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(g);
      o.connect(g);
      o.start(t); o2.start(t); o.stop(t + 0.5); o2.stop(t + 0.5);
      return { gain: g, oscs: [o, o2] };
    })},
    { id: '808bass', name: '808 BASS', group: 'BASS', color: '#ff66cc', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.003, 0.85, null, 0, v * 0.95, dest);
      var o = osc(ac, 'sine', f * 2.2);
      o.frequency.setValueAtTime(Math.max(40, f * 2.4), t);
      o.frequency.exponentialRampToValueAtTime(Math.max(28, f * 0.7), t + 0.14);
      o.connect(g);
      o.start(t); o.stop(t + 0.95);
      return { gain: g, oscs: [o] };
    })},
    { id: 'reese', name: 'REESE', group: 'BASS', color: '#7788ff', sustain: true, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.03, 0.12, v * 0.32, 0.2, v * 0.42, dest);
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 1.4;
      var o1 = osc(ac, 'sawtooth', f, -8);
      var o2 = osc(ac, 'sawtooth', f, 9);
      o1.connect(lp); o2.connect(lp); lp.connect(g);
      o1.start(t); o2.start(t);
      return { gain: g, oscs: [o1, o2], release: 0.22 };
    })},
    { id: 'square', name: 'SQUARE LEAD', group: 'LEADS', color: '#00ff41', sustain: true, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.01, 0.05, v * 0.22, 0.1, v * 0.3, dest);
      var o = osc(ac, 'square', f);
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2800;
      o.connect(lp); lp.connect(g);
      o.start(t);
      return { gain: g, oscs: [o], release: 0.1 };
    })},
    { id: 'saw', name: 'SAW LEAD', group: 'LEADS', color: '#ffaa00', sustain: true, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.012, 0.08, v * 0.24, 0.14, v * 0.34, dest);
      var o = osc(ac, 'sawtooth', f);
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1800, t); lp.frequency.linearRampToValueAtTime(4200, t + 0.18);
      o.connect(lp); lp.connect(g);
      o.start(t);
      return { gain: g, oscs: [o], release: 0.14 };
    })},
    { id: 'bell', name: 'FM BELL', group: 'LEADS', color: '#aaddff', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.002, 1.8, null, 0, v * 0.4, dest);
      var car = osc(ac, 'sine', f);
      var mod = osc(ac, 'sine', f * 3.5);
      var mg = ac.createGain(); mg.gain.setValueAtTime(f * 4, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.8);
      mod.connect(mg); mg.connect(car.frequency); car.connect(g);
      ostart(car, mod, t, 2.0);
      return { gain: g, oscs: [car, mod] };
    })},
    { id: 'strings', name: 'STRINGS', group: 'PADS', color: '#cc99ff', sustain: true, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.22, 0.25, v * 0.18, 0.4, v * 0.26, dest);
      var o1 = osc(ac, 'sawtooth', f, -6);
      var o2 = osc(ac, 'sawtooth', f, 7);
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
      o1.connect(lp); o2.connect(lp); lp.connect(g);
      o1.start(t); o2.start(t);
      return { gain: g, oscs: [o1, o2], release: 0.45 };
    })},
    { id: 'choir', name: 'CHOIR', group: 'PADS', color: '#ffddee', sustain: true, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.18, 0.2, v * 0.16, 0.35, v * 0.22, dest);
      var o = osc(ac, 'triangle', f);
      var f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 600; f1.Q.value = 4;
      var f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1100; f2.Q.value = 4;
      o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g);
      o.start(t);
      return { gain: g, oscs: [o], release: 0.4 };
    })},
    { id: 'pad', name: 'WARM PAD', group: 'PADS', color: '#88e0d0', sustain: true, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.28, 0.3, v * 0.2, 0.5, v * 0.28, dest);
      var o = osc(ac, 'triangle', f);
      var o2 = osc(ac, 'sine', f * 0.5);
      var mix = ac.createGain(); mix.gain.value = 1;
      o.connect(mix); var g2 = ac.createGain(); g2.gain.value = 0.35; o2.connect(g2); g2.connect(mix);
      mix.connect(g);
      o.start(t); o2.start(t);
      return { gain: g, oscs: [o, o2], release: 0.5 };
    })},
    { id: 'nylon', name: 'NYLON', group: 'PLUCK', color: '#ddbb88', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var period = Math.max(20, Math.floor(ac.sampleRate / f));
      var buf = ac.createBuffer(1, period, ac.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < period; i++) d[i] = Math.random() * 2 - 1;
      var src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(6500, f * 8);
      var g = envGain(ac, t, 0.002, 0.9, null, 0, v * 0.5, dest);
      src.connect(lp); lp.connect(g);
      src.start(t); src.stop(t + 1.1);
      return { gain: g, oscs: [src] };
    })},
    { id: 'kalimba', name: 'KALIMBA', group: 'PLUCK', color: '#ffee88', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.001, 0.7, null, 0, v * 0.5, dest);
      var o = osc(ac, 'sine', f);
      var o2 = osc(ac, 'sine', f * 4.2); var hg = ac.createGain(); hg.gain.value = 0.12; o2.connect(hg); hg.connect(g);
      o.connect(g);
      o.start(t); o2.start(t); o.stop(t + 0.85); o2.stop(t + 0.4);
      return { gain: g, oscs: [o, o2] };
    })},
    { id: 'brass', name: 'BRASS', group: 'HORNS', color: '#ff9944', sustain: true, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.05, 0.1, v * 0.22, 0.16, v * 0.32, dest);
      var o = osc(ac, 'sawtooth', f);
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.exponentialRampToValueAtTime(2400, t + 0.08);
      o.connect(lp); lp.connect(g);
      o.start(t);
      return { gain: g, oscs: [o], release: 0.16 };
    })},
    { id: 'flute', name: 'FLUTE', group: 'HORNS', color: '#bbffee', sustain: true, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.06, 0.1, v * 0.18, 0.14, v * 0.24, dest);
      var o = osc(ac, 'sine', f);
      o.connect(g);
      startNoise(ac, g, t, 0.08, 'bandpass', f * 2, v * 0.08);
      o.start(t);
      return { gain: g, oscs: [o], release: 0.14 };
    })},
    { id: 'cowbell', name: 'COWBELL', group: 'PERC', color: '#dddd66', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.001, 0.22, null, 0, v * 0.4, dest);
      var o1 = osc(ac, 'square', 540);
      var o2 = osc(ac, 'square', 800);
      o1.connect(g); o2.connect(g);
      o1.start(t); o2.start(t); o1.stop(t + 0.28); o2.stop(t + 0.28);
      return { gain: g, oscs: [o1, o2] };
    })},
    { id: 'wood', name: 'WOODBLOCK', group: 'PERC', color: '#cc8866', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.001, 0.07, null, 0, v * 0.5, dest);
      var o = osc(ac, 'sine', Math.max(400, f * 2));
      o.connect(g);
      startNoise(ac, g, t, 0.03, 'bandpass', 1800, v * 0.3);
      o.start(t); o.stop(t + 0.1);
      return { gain: g, oscs: [o] };
    })},
    { id: 'laser', name: 'LASER', group: 'PERC', color: '#66ffff', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.001, 0.28, null, 0, v * 0.4, dest);
      var o = osc(ac, 'square', f * 4);
      o.frequency.setValueAtTime(f * 6, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, f * 0.5), t + 0.22);
      o.connect(g);
      o.start(t); o.stop(t + 0.3);
      return { gain: g, oscs: [o] };
    })},
    { id: 'epiano', name: 'E.PIANO', group: 'KEYS', color: '#ffe0aa', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.004, 1.1, null, 0, v * 0.42, dest);
      var car = osc(ac, 'sine', f);
      var mod = osc(ac, 'sine', f * 1.5);
      var mg = ac.createGain(); mg.gain.value = f * 0.9;
      mod.connect(mg); mg.connect(car.frequency); car.connect(g);
      ostart(car, mod, t, 1.3);
      return { gain: g, oscs: [car, mod] };
    })},
    { id: 'sub', name: 'SUB', group: 'BASS', color: '#4466ff', sustain: true, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.02, 0.08, v * 0.55, 0.18, v * 0.7, dest);
      var o = osc(ac, 'sine', Math.max(28, f * 0.5));
      o.connect(g); o.start(t);
      return { gain: g, oscs: [o], release: 0.2 };
    })},
    { id: 'acid', name: 'ACID', group: 'LEADS', color: '#99ff33', sustain: true, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.004, 0.06, v * 0.22, 0.08, v * 0.32, dest);
      var o = osc(ac, 'sawtooth', f);
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 12;
      lp.frequency.setValueAtTime(280, t); lp.frequency.exponentialRampToValueAtTime(3200, t + 0.12);
      o.connect(lp); lp.connect(g); o.start(t);
      return { gain: g, oscs: [o], release: 0.1 };
    })},
    { id: 'harp', name: 'HARPSICHORD', group: 'PLUCK', color: '#e8d6a0', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.001, 0.35, null, 0, v * 0.38, dest);
      var o = osc(ac, 'square', f);
      var o2 = osc(ac, 'square', f * 2); var h = ac.createGain(); h.gain.value = 0.2; o2.connect(h); h.connect(g);
      o.connect(g); o.start(t); o2.start(t); o.stop(t + 0.45); o2.stop(t + 0.45);
      return { gain: g, oscs: [o, o2] };
    })},
    { id: 'kick', name: '808 KICK', group: 'DRUMS', color: '#ff4466', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.001, 0.42, null, 0, v * 0.95, dest);
      var o = osc(ac, 'sine', 160);
      o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.08);
      o.connect(g); o.start(t); o.stop(t + 0.5);
      return { gain: g, oscs: [o] };
    })},
    { id: 'snare', name: 'SNARE', group: 'DRUMS', color: '#ffccaa', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.001, 0.16, null, 0, v * 0.55, dest);
      var o = osc(ac, 'triangle', 180);
      o.connect(g); o.start(t); o.stop(t + 0.18);
      startNoise(ac, g, t, 0.14, 'highpass', 1800, v * 0.5);
      return { gain: g, oscs: [o] };
    })},
    { id: 'hat', name: 'CLOSED HAT', group: 'DRUMS', color: '#ddeeff', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.001, 0.05, null, 0, v * 0.35, dest);
      startNoise(ac, g, t, 0.06, 'highpass', 7000, v * 0.7);
      return { gain: g, oscs: [] };
    })},
    { id: 'openhat', name: 'OPEN HAT', group: 'DRUMS', color: '#cceeff', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.001, 0.28, null, 0, v * 0.32, dest);
      startNoise(ac, g, t, 0.28, 'highpass', 6000, v * 0.55);
      return { gain: g, oscs: [] };
    })},
    { id: 'clap', name: 'CLAP', group: 'DRUMS', color: '#ff99aa', sustain: false, play: makeVoice(function (ac, dest, f, v, t) {
      var g = envGain(ac, t, 0.001, 0.18, null, 0, v * 0.45, dest);
      startNoise(ac, g, t, 0.04, 'bandpass', 1400, v * 0.7);
      startNoise(ac, g, t + 0.02, 0.12, 'bandpass', 1800, v * 0.5);
      return { gain: g, oscs: [] };
    })}
  ];

  function ostart(a, b, t, dur) {
    a.start(t); b.start(t);
    if (dur) { a.stop(t + dur); b.stop(t + dur); }
  }

  function currentPatch() {
    for (var i = 0; i < PATCHES.length; i++) if (PATCHES[i].id === patchId) return PATCHES[i];
    return PATCHES[0];
  }

  function setStatus(msg) {
    if (!statusEl) statusEl = document.getElementById('midiStatus');
    if (statusEl) statusEl.textContent = msg || '';
  }

  function noteOn(midi, velo, from) {
    audio();
    midi = Math.max(0, Math.min(127, midi | 0));
    velo = typeof velo === 'number' ? velo : vel;
    noteOff(midi, true);
    var patch = currentPatch();
    var t = ctx.currentTime;
    var v = patch.play(ctx, master, midi, velo, t);
    voices[midi] = { voice: v, patch: patch, midi: midi };
    if (capturing) {
      capEvents.push({ type: 'on', midi: midi, vel: velo, t: t - capStart, patch: patch.id });
    }
    paintKey(midi, true);
    if (from !== 'mouse') setStatus(patch.name + ' · ' + midiName(midi) + (capturing ? ' · REC' : ''));
  }

  function noteOff(midi, silent) {
    var slot = voices[midi];
    if (!slot) return;
    var t = ctx ? ctx.currentTime : 0;
    voiceStop(slot.voice, t, slot.voice && slot.voice.release);
    delete voices[midi];
    if (capturing && !silent) {
      capEvents.push({ type: 'off', midi: midi, t: t - capStart, patch: slot.patch.id });
    }
    paintKey(midi, false);
  }

  function allOff() {
    Object.keys(voices).forEach(function (k) { noteOff(parseInt(k, 10), true); });
  }

  function midiName(n) {
    var names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return names[n % 12] + (Math.floor(n / 12) - 1);
  }

  function keyMidi(i) {
    return BASE_C + octave * 12 + i;
  }

  function paintKey(midi, on) {
    var el = document.querySelector('.midi-key[data-midi="' + midi + '"]');
    if (el) el.classList.toggle('is-down', !!on);
  }

  function injectStyles() {
    if (document.getElementById('midiLibCss')) return;
    var s = document.createElement('style');
    s.id = 'midiLibCss';
    s.textContent =
      '#midiLibrary{margin-top:8px;}' +
      '.midi-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;}' +
      '.midi-groups{display:flex;flex-direction:column;gap:6px;margin-bottom:8px;}' +
      '.midi-group{display:flex;flex-wrap:wrap;gap:4px;align-items:center;}' +
      '.midi-group-lab{font-size:10px;letter-spacing:2px;color:#8866aa;width:52px;flex:0 0 52px;}' +
      '.midi-patch{font-family:inherit;font-size:11px;letter-spacing:0.5px;border:1px solid #553377;background:#100018;color:#ccbbdd;padding:3px 7px;cursor:pointer;border-radius:999px;}' +
      '.midi-patch.is-on{color:#12001a;background:var(--p, #ff66cc);border-color:var(--p,#ff66cc);box-shadow:0 0 8px var(--p,#ff66cc);}' +
      '.midi-kb{display:flex;height:92px;user-select:none;touch-action:none;position:relative;margin:8px 0;background:#0a0510;border:1px solid #442266;padding:6px 6px 0;}' +
      '.midi-key{flex:1 1 0;position:relative;border:1px solid #222;border-bottom:3px solid #111;background:linear-gradient(#f6f0e4,#d8d0c4);cursor:pointer;border-radius:0 0 4px 4px;}' +
      '.midi-key.is-black{flex:0 0 0;width:0;}' +
      '.midi-key.black{position:absolute;width:3.1%;height:58%;top:6px;background:linear-gradient(#222,#000);border:1px solid #000;z-index:2;border-radius:0 0 3px 3px;}' +
      '.midi-key.is-down{filter:brightness(0.72);}' +
      '.midi-key.black.is-down{background:#6644aa;}' +
      '.midi-status{font-size:12px;color:#888;letter-spacing:1px;flex:1 1 140px;}' +
      '.midi-btn{font-family:inherit;font-size:13px;letter-spacing:1px;border:2px solid #ff66cc;background:#12001a;color:#ff66cc;padding:3px 8px;cursor:pointer;}' +
      '.midi-btn:hover{background:#1a0033;color:#fff;}' +
      '.midi-btn.is-rec{border-color:#ff3333;color:#ff3333;background:#220000;}' +
      '.midi-oct{color:#66ccff;font-size:13px;letter-spacing:1px;}' +
      '.midi-hint{font-size:11px;color:#665577;margin:0 0 6px;letter-spacing:0.5px;}';
    document.head.appendChild(s);
  }

  function groups() {
    var g = [];
    var map = {};
    PATCHES.forEach(function (p) {
      if (!map[p.group]) { map[p.group] = []; g.push(p.group); }
      map[p.group].push(p);
    });
    return g.map(function (name) { return { name: name, patches: map[name] }; });
  }

  function blackOffset(i) {
    /* white-key index among 15 whites in 2 octaves + C */
    var pc = i % 12;
    if (pc !== 1 && pc !== 3 && pc !== 6 && pc !== 8 && pc !== 10) return null;
    var whitesBefore = 0;
    for (var k = 0; k < i; k++) {
      var p = k % 12;
      if (p !== 1 && p !== 3 && p !== 6 && p !== 8 && p !== 10) whitesBefore++;
    }
    var whiteW = 100 / 15;
    return (whitesBefore * whiteW) - whiteW * 0.32;
  }

  function buildKeyboard(html) {
    var whites = '';
    var blacks = '';
    for (var i = 0; i < KEYS; i++) {
      var midi = keyMidi(i);
      var pc = i % 12;
      var black = pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
      if (black) {
        var left = blackOffset(i);
        blacks += '<button type="button" class="midi-key black" data-midi="' + midi + '" style="left:' + left + '%" aria-label="' + midiName(midi) + '"></button>';
      } else {
        whites += '<button type="button" class="midi-key" data-midi="' + midi + '" aria-label="' + midiName(midi) + '"></button>';
      }
    }
    return '<div class="midi-kb" id="midiKb">' + whites + blacks + '</div>';
  }

  function renderPatches() {
    return groups().map(function (g) {
      return '<div class="midi-group"><span class="midi-group-lab">' + g.name + '</span>' +
        g.patches.map(function (p) {
          return '<button type="button" class="midi-patch' + (p.id === patchId ? ' is-on' : '') +
            '" data-patch="' + p.id + '" style="--p:' + p.color + '">' + p.name + '</button>';
        }).join('') + '</div>';
    }).join('');
  }

  function buildUI() {
    injectStyles();
    var root = document.getElementById('midiLibrary');
    if (!root) {
      var shell = document.querySelector('.studio-shell');
      if (!shell) return;
      root = document.createElement('div');
      root.id = 'midiLibrary';
      root.className = 'studio-col studio-midi';
      shell.appendChild(root);
    }
    root.innerHTML =
      '<div class="studio-col-title" style="color:#66ffaa">MIDI LIBRARY · 30 SOUNDS</div>' +
      '<p class="midi-hint">Pick a sound · Z–M / Q–I computer keys · plug a MIDI keyboard · REC a take · SEND → track</p>' +
      '<div class="midi-head">' +
      '<button type="button" class="midi-btn" id="midiOctDown">OCT −</button>' +
      '<span class="midi-oct" id="midiOctLab">C' + (3 + octave) + '</span>' +
      '<button type="button" class="midi-btn" id="midiOctUp">OCT +</button>' +
      '<button type="button" class="midi-btn" id="midiInBtn">MIDI IN</button>' +
      '<label class="midi-oct">VEL <input id="midiVel" type="range" min="20" max="100" value="85" style="width:80px;vertical-align:middle"></label>' +
      '<button type="button" class="midi-btn" id="midiRecBtn">● REC TAKE</button>' +
      '<label class="beat-send-wrap" style="border-color:#66ffaa">' +
      '<span class="beat-send-label" style="color:#66ffaa">SEND →</span>' +
      '<select id="midiSendTrack" class="beat-send-select"><option value="0">TR 1</option><option value="1">TR 2</option><option value="2">TR 3</option><option value="3">TR 4</option><option value="4">TR 5</option><option value="5">TR 6</option><option value="6">TR 7</option><option value="7">TR 8</option></select>' +
      '<button type="button" class="midi-btn" id="midiSendBtn">⬇ SEND</button>' +
      '</label>' +
      '<span class="midi-status" id="midiStatus">30 patches · click a sound, then a key</span>' +
      '</div>' +
      '<div class="midi-groups" id="midiGroups">' + renderPatches() + '</div>' +
      buildKeyboard();

    statusEl = document.getElementById('midiStatus');
    bind(root);
  }

  function rebuildKeyboard() {
    var kb = document.getElementById('midiKb');
    if (!kb) return;
    kb.outerHTML = buildKeyboard();
    bindKeys(document.getElementById('midiLibrary'));
    var lab = document.getElementById('midiOctLab');
    if (lab) lab.textContent = 'C' + (3 + octave);
  }

  function bindKeys(root) {
    if (!root) return;
    var down = false;
    function fromEl(el, on) {
      if (!el) return;
      var m = parseInt(el.getAttribute('data-midi'), 10);
      if (isNaN(m)) return;
      if (on) noteOn(m, vel, 'mouse');
      else noteOff(m);
    }
    root.querySelectorAll('.midi-key').forEach(function (key) {
      key.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        key.setPointerCapture(e.pointerId);
        down = true;
        fromEl(key, true);
      });
      key.addEventListener('pointerup', function () { fromEl(key, false); down = false; });
      key.addEventListener('pointercancel', function () { fromEl(key, false); down = false; });
      key.addEventListener('pointerenter', function () { if (down) fromEl(key, true); });
      key.addEventListener('pointerleave', function () { if (down) fromEl(key, false); });
    });
  }

  function bind(root) {
    root.addEventListener('click', function (e) {
      var p = e.target.closest('.midi-patch');
      if (p) {
        patchId = p.getAttribute('data-patch');
        root.querySelectorAll('.midi-patch').forEach(function (b) {
          b.classList.toggle('is-on', b.getAttribute('data-patch') === patchId);
        });
        noteOn(keyMidi(12), vel, 'preview');
        setTimeout(function () { noteOff(keyMidi(12)); }, 280);
        setStatus(currentPatch().name + ' loaded');
        return;
      }
      if (e.target.id === 'midiOctDown') { octave = Math.max(-2, octave - 1); allOff(); rebuildKeyboard(); }
      if (e.target.id === 'midiOctUp') { octave = Math.min(3, octave + 1); allOff(); rebuildKeyboard(); }
      if (e.target.id === 'midiInBtn') enableMidiIn();
      if (e.target.id === 'midiRecBtn') toggleCapture();
      if (e.target.id === 'midiSendBtn') sendTake();
    });
    bindKeys(root);
    var velEl = document.getElementById('midiVel');
    if (velEl) {
      velEl.addEventListener('input', function () {
        vel = Math.max(0.2, Math.min(1, Number(velEl.value) / 100));
      });
    }
  }

  function enableMidiIn() {
    if (!navigator.requestMIDIAccess) {
      setStatus('This browser has no Web MIDI. Use the on-screen keys or Z–M / Q–I.');
      return;
    }
    navigator.requestMIDIAccess({ sysex: false }).then(function (access) {
      midiAccess = access;
      function hook() {
        var n = 0;
        access.inputs.forEach(function (input) {
          n++;
          input.onmidimessage = onMidiMessage;
        });
        setStatus(n ? ('MIDI IN · ' + n + ' port' + (n > 1 ? 's' : '')) : 'MIDI IN open · plug a keyboard');
      }
      access.onstatechange = hook;
      hook();
    }).catch(function () {
      setStatus('MIDI permission denied.');
    });
  }

  function onMidiMessage(ev) {
    var d = ev.data;
    if (!d || d.length < 2) return;
    var cmd = d[0] & 0xf0;
    var note = d[1];
    var velocity = d.length > 2 ? d[2] : 0;
    if (cmd === 0x90 && velocity > 0) noteOn(note, velocity / 127, 'midi');
    else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) noteOff(note);
  }

  function toggleCapture() {
    audio();
    var btn = document.getElementById('midiRecBtn');
    if (capturing) {
      capturing = false;
      allOff();
      capEvents.push({ type: 'end', t: ctx.currentTime - capStart });
      if (btn) btn.classList.remove('is-rec');
      if (btn) btn.textContent = '● REC TAKE';
      setStatus('Take in memory · ' + capEvents.filter(function (e) { return e.type === 'on'; }).length + ' notes · SEND → a track');
      return;
    }
    capEvents = [];
    capStart = ctx.currentTime;
    capturing = true;
    if (btn) btn.classList.add('is-rec');
    if (btn) btn.textContent = '■ STOP TAKE';
    setStatus('Recording MIDI take… play now');
  }

  async function sendTake() {
    var sel = document.getElementById('midiSendTrack');
    var dest = sel ? parseInt(sel.value, 10) : 0;
    if (capturing) toggleCapture();
    var notes = capEvents.filter(function (e) { return e.type === 'on'; });
    if (!notes.length) {
      setStatus('REC a take first, then SEND.');
      return;
    }
    if (!window.DOSWAPZ_MULTITRACK || !window.DOSWAPZ_MULTITRACK.layBufferOnTrack) {
      setStatus('Track board not ready — refresh.');
      return;
    }
    setStatus('Rendering MIDI take…');
    try {
      var buffer = await renderTake();
      var name = currentPatch().name + ' TAKE';
      window.DOSWAPZ_MULTITRACK.layBufferOnTrack(dest, buffer, name);
      setStatus(name + ' → TR' + (dest + 1));
    } catch (err) {
      console.error(err);
      setStatus('Could not render MIDI take.');
    }
  }

  async function renderTake() {
    var events = capEvents.slice();
    var end = 0;
    events.forEach(function (e) { if (e.t > end) end = e.t; });
    end = Math.max(0.6, end + 0.6);
    var sr = 44100;
    var OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var offline = new OfflineCtx(2, Math.ceil(sr * end), sr);
    var dest = offline.destination;
    var live = {};
    var savedPatch = patchId;
    events.forEach(function (e) {
      if (e.type === 'on') {
        var p = PATCHES.filter(function (x) { return x.id === e.patch; })[0] || currentPatch();
        patchId = p.id;
        live[e.midi] = p.play(offline, dest, e.midi, e.vel || vel, e.t);
      } else if (e.type === 'off' && live[e.midi]) {
        voiceStop(live[e.midi], e.t, live[e.midi].release);
        delete live[e.midi];
      }
    });
    Object.keys(live).forEach(function (k) { voiceStop(live[k], end - 0.05, 0.08); });
    patchId = savedPatch;
    return offline.startRendering();
  }

  var heldComp = {};
  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    var idx = COMP_MAP[e.key.toLowerCase()];
    if (idx == null) return;
    e.preventDefault();
    var midi = keyMidi(idx);
    heldComp[e.key.toLowerCase()] = midi;
    noteOn(midi, vel, 'comp');
  });
  window.addEventListener('keyup', function (e) {
    var k = e.key.toLowerCase();
    if (heldComp[k] != null) {
      noteOff(heldComp[k]);
      delete heldComp[k];
    }
  });
  window.addEventListener('blur', function () { allOff(); });

  window.DOSWAPZ_MIDI = {
    patches: PATCHES,
    noteOn: noteOn,
    noteOff: noteOff
  };

  function boot() { buildUI(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
