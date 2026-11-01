/**
 * HAIR FORCE ONE — original 1980s synth tracks
 * Deliberately NOT the real Village People melodies (copyright-safe originals).
 * Parody titles only; all notes composed for this game.
 */
window.HFO_MUSIC = (() => {
  "use strict";

  let ctx = null;
  let master = null;
  let playing = false;
  let schedTimer = null;
  let nextNoteTime = 0;
  let step = 0;
  let currentSong = null;
  let songGain = null;

  const LOOKAHEAD = 0.08;
  const SCHEDULE_AHEAD = 0.2;

  // ---- Songs: original patterns (16th-note steps) ----
  // bass/lead are MIDI-ish pitch numbers (relative, not real charts)
  const SONGS = [
    {
      id: "wmca",
      title: "W.M.C.A.",
      subtitle: "off-brand club banger",
      bpm: 118,
      // Original disco loop — not Y-M-C-A
      bass: [36, 0, 36, 0, 39, 0, 36, 0, 41, 0, 39, 0, 36, 0, 34, 0],
      lead: [60, 0, 63, 0, 67, 67, 0, 65, 63, 0, 60, 0, 58, 0, 60, 0],
      chords: [48, 0, 0, 0, 53, 0, 0, 0, 55, 0, 0, 0, 53, 0, 48, 0],
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1],
    },
    {
      id: "masho",
      title: "MASHO MAN",
      subtitle: "detuned gym synth",
      bpm: 124,
      bass: [38, 0, 38, 38, 0, 38, 41, 0, 43, 0, 43, 41, 0, 38, 36, 0],
      lead: [62, 62, 0, 65, 0, 67, 0, 65, 62, 0, 60, 0, 62, 65, 0, 0],
      chords: [50, 0, 0, 50, 0, 0, 53, 0, 55, 0, 0, 53, 0, 0, 50, 0],
      kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      hat: [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1],
    },
    {
      id: "navy",
      title: "IN DA NAVY?",
      subtitle: "wrong-notes flotilla",
      bpm: 112,
      bass: [35, 0, 0, 35, 38, 0, 35, 0, 40, 0, 0, 38, 35, 0, 33, 0],
      lead: [59, 0, 62, 64, 0, 62, 0, 59, 57, 0, 59, 0, 62, 0, 64, 64],
      chords: [47, 0, 0, 0, 50, 0, 0, 0, 52, 0, 0, 0, 50, 0, 47, 0],
      kick: [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1],
    },
    {
      id: "gowest",
      title: "GO WES-ISH",
      subtitle: "synthwave wrong-way",
      bpm: 108,
      bass: [33, 0, 33, 0, 36, 0, 38, 0, 40, 0, 38, 0, 36, 0, 33, 33],
      lead: [57, 0, 60, 0, 64, 0, 60, 57, 0, 55, 0, 57, 60, 0, 64, 0],
      chords: [45, 0, 0, 0, 48, 0, 0, 0, 52, 0, 0, 0, 50, 0, 0, 0],
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0],
    },
  ];

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.55;
      // mild 80s chorus-ish delay
      const delay = ctx.createDelay(0.5);
      delay.delayTime.value = 0.09;
      const fb = ctx.createGain();
      fb.gain.value = 0.18;
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      master.connect(ctx.destination);
      master.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function envGain(t, a, d, s, r, peak = 0.2) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(peak * s, 0.0001), t + a + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r);
    return g;
  }

  function playKick(t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.2);
  }

  function playSnare(t) {
    const bufSize = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    noise.connect(bp);
    bp.connect(g);
    g.connect(master);
    noise.start(t);
    noise.stop(t + 0.13);
  }

  function playHat(t, open = false) {
    const bufSize = Math.floor(ctx.sampleRate * (open ? 0.08 : 0.03));
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(open ? 0.12 : 0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.08 : 0.03));
    noise.connect(hp);
    hp.connect(g);
    g.connect(master);
    noise.start(t);
    noise.stop(t + 0.09);
  }

  // Detuned dual-saw = cheap 80s polysynth
  function playSynth(midi, t, dur, type, peak, detune = 8) {
    if (!midi) return;
    const f = midiToFreq(midi);
    const g = envGain(t, 0.01, 0.08, 0.45, Math.max(dur - 0.05, 0.05), peak);
    g.connect(master);

    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = type;
    o2.type = type;
    o1.frequency.setValueAtTime(f, t);
    o2.frequency.setValueAtTime(f, t);
    o2.detune.setValueAtTime(detune, t);
    // slight pitch wobble = "off-tune" charm
    o1.detune.setValueAtTime(-6, t);
    o1.detune.linearRampToValueAtTime(6, t + dur);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, t);
    filter.frequency.exponentialRampToValueAtTime(900, t + dur);

    o1.connect(filter);
    o2.connect(filter);
    filter.connect(g);
    o1.start(t);
    o2.start(t);
    o1.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  function playBass(midi, t) {
    if (!midi) return;
    const f = midiToFreq(midi);
    const o = ctx.createOscillator();
    const g = envGain(t, 0.005, 0.05, 0.5, 0.08, 0.28);
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f, t);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500, t);
    o.connect(filter);
    filter.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.22);
  }

  // Hit SFX kept separate so scoring still beeps
  function sfx(kind) {
    ensure();
    const t = ctx.currentTime;
    if (kind === "perfect") {
      playSynth(84, t, 0.1, "square", 0.12, 4);
      playSynth(88, t + 0.04, 0.08, "square", 0.08, 4);
    } else if (kind === "great") {
      playSynth(76, t, 0.09, "square", 0.1, 5);
    } else if (kind === "good") {
      playSynth(67, t, 0.08, "triangle", 0.08, 3);
    } else {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(60, t + 0.15);
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 0.17);
    }
  }

  function scheduleStep(song, stepIndex, time) {
    const i = stepIndex % 16;
    if (song.kick[i]) playKick(time);
    if (song.snare[i]) playSnare(time);
    if (song.hat[i]) playHat(time, i % 8 === 7);
    playBass(song.bass[i], time);
    playSynth(song.chords[i], time, 0.35, "sawtooth", 0.06, 12);
    playSynth(song.lead[i], time, 0.18, "square", 0.09, 10);
  }

  function scheduler() {
    if (!playing || !currentSong) return;
    const secondsPerStep = 60 / currentSong.bpm / 4; // 16th notes
    while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
      scheduleStep(currentSong, step, nextNoteTime);
      nextNoteTime += secondsPerStep;
      step++;
    }
    schedTimer = setTimeout(scheduler, LOOKAHEAD * 1000);
  }

  function list() {
    return SONGS.map((s) => ({
      id: s.id,
      title: s.title,
      subtitle: s.subtitle,
      bpm: s.bpm,
    }));
  }

  function get(id) {
    return SONGS.find((s) => s.id === id) || SONGS[0];
  }

  function play(id) {
    ensure();
    stop();
    currentSong = get(id);
    step = 0;
    nextNoteTime = ctx.currentTime + 0.05;
    playing = true;
    scheduler();
    return currentSong;
  }

  function stop() {
    playing = false;
    if (schedTimer) {
      clearTimeout(schedTimer);
      schedTimer = null;
    }
  }

  return { list, get, play, stop, sfx, ensure };
})();
