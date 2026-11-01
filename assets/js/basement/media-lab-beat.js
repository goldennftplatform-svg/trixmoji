/* Basement Media Lab - 8-track 808-style step sequencer */
(function () {
 'use strict';

 var STEPS = 16;
 var EXPORT_BARS = 4;
 var TRACKS = [
 { id: 'kick', label: '808 KICK', color: '#ff66cc' },
 { id: 'snare', label: 'SNARE', color: '#00ff41' },
 { id: 'clap', label: 'CLAP', color: '#ffff00' },
 { id: 'ch', label: 'CH HAT', color: '#66ccff' },
 { id: 'oh', label: 'OH HAT', color: '#cc88ff' },
 { id: 'ltom', label: 'LOW TOM', color: '#ff8800' },
 { id: 'mtom', label: 'MID TOM', color: '#88ff88' },
 { id: 'rim', label: 'RIM/CB', color: '#ff4444' }
 ];

 var grid = {};
 var ctx = null;
 var playing = false;
 var exporting = false;
 var stepIdx = 0;
 var timer = null;
 var bpm = 96;

 /* 10 sample beats — ★ SAMPLE picks one at random after clear */
 var SAMPLE_BEATS = [
  { id: 1, name: 'BOOM BAP', bpm: 92, grid: {
    kick: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
    clap: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], ch:   [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,0],
    oh:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1], ltom: [0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
    mtom: [0,0,0,1, 0,0,0,0, 0,0,0,0, 0,1,0,0], rim:  [0,1,0,0, 0,0,0,1, 0,1,0,0, 0,0,0,0]
  }},
  { id: 2, name: 'TRAP HATS', bpm: 140, grid: {
    kick: [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    clap: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1], ch:   [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
    oh:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0], ltom: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    mtom: [0,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0], rim:  [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,0,0]
  }},
  { id: 3, name: 'LOFI SWING', bpm: 84, grid: {
    kick: [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    clap: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0], ch:   [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    oh:   [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1], ltom: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,1,0,0],
    mtom: [0,0,0,1, 0,0,0,0, 0,0,0,0, 0,0,0,0], rim:  [0,1,0,0, 0,1,0,0, 0,1,0,0, 0,0,0,0]
  }},
  { id: 4, name: 'FOUR ON FLOOR', bpm: 124, grid: {
    kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    clap: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], ch:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    oh:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0], ltom: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    mtom: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], rim:  [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0]
  }},
  { id: 5, name: 'DNB BREAK', bpm: 174, grid: {
    kick: [1,0,0,0, 0,0,1,0, 0,1,0,0, 0,0,0,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    clap: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0], ch:   [1,1,0,1, 1,0,1,1, 0,1,1,0, 1,1,0,1],
    oh:   [0,0,1,0, 0,0,0,0, 1,0,0,0, 0,0,1,0], ltom: [0,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0],
    mtom: [0,0,0,1, 0,0,0,0, 0,0,0,0, 0,0,0,1], rim:  [0,1,0,0, 0,1,0,0, 0,0,1,0, 0,1,0,0]
  }},
  { id: 6, name: 'REGGAETON', bpm: 96, grid: {
    kick: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    clap: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0], ch:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    oh:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1], ltom: [0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
    mtom: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,1,0,0], rim:  [0,1,0,0, 0,1,0,0, 0,1,0,0, 0,0,1,0]
  }},
  { id: 7, name: 'PHONK', bpm: 130, grid: {
    kick: [1,0,0,0, 1,0,0,1, 1,0,0,0, 1,0,0,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    clap: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0], ch:   [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1],
    oh:   [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], ltom: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
    mtom: [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,0,0], rim:  [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,0,1]
  }},
  { id: 8, name: 'HALFTIME', bpm: 70, grid: {
    kick: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0], snare:[0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    clap: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0], ch:   [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,1],
    oh:   [0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0], ltom: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
    mtom: [0,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0], rim:  [0,0,1,0, 0,0,1,0, 0,0,0,0, 0,1,0,0]
  }},
  { id: 9, name: 'AFROBEAT', bpm: 105, grid: {
    kick: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,1,0,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    clap: [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,0,0], ch:   [1,0,1,1, 0,1,0,1, 1,0,1,0, 1,1,0,1],
    oh:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0], ltom: [0,0,0,0, 0,1,0,0, 0,0,0,0, 0,0,0,0],
    mtom: [0,0,0,0, 0,0,0,0, 0,1,0,0, 0,0,0,0], rim:  [0,1,0,0, 0,0,0,1, 0,0,0,1, 0,0,0,0]
  }},
  { id: 10, name: 'STRIPPED 808', bpm: 100, grid: {
    kick: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    clap: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], ch:   [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    oh:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1], ltom: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    mtom: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], rim:  [0,0,0,1, 0,0,0,0, 0,0,0,1, 0,0,0,0]
  }}
 ];
 var lastSampleId = -1;

 function emptyGrid() {
  var g = {};
  TRACKS.forEach(function (t) {
   g[t.id] = new Array(STEPS).fill(false);
  });
  return g;
 }

 function pickRandomSample() {
  var pick;
  var guard = 0;
  do {
   pick = SAMPLE_BEATS[Math.floor(Math.random() * SAMPLE_BEATS.length)];
   guard++;
  } while (pick.id === lastSampleId && guard < 12);
  lastSampleId = pick.id;
  return pick;
 }

 function loadSampleGrid(sample) {
  sample = sample || pickRandomSample();
  TRACKS.forEach(function (t) {
   var row = (sample.grid && sample.grid[t.id]) || [];
   grid[t.id] = [];
   for (var s = 0; s < STEPS; s++) {
    grid[t.id][s] = !!row[s];
   }
  });
  bpm = sample.bpm || 96;
  return sample;
 }

 grid = emptyGrid();
 loadSampleGrid(SAMPLE_BEATS[0]);

 function audio() {
 if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
 if (ctx.state === 'suspended') ctx.resume();
 return ctx;
 }

 function env(ac, t, a, d, g) {
 var n = ac.createGain();
 n.gain.setValueAtTime(0.0001, t);
 n.gain.exponentialRampToValueAtTime(g, t + a);
 n.gain.exponentialRampToValueAtTime(0.0001, t + d);
 return n;
 }

 function playKick(ac, t) {
 var o = ac.createOscillator();
 var g = env(ac, t, 0.002, 0.42, 1.1);
 o.type = 'sine';
 o.frequency.setValueAtTime(165, t);
 o.frequency.exponentialRampToValueAtTime(42, t + 0.09);
 o.connect(g);
 g.connect(ac.destination);
 o.start(t);
 o.stop(t + 0.45);
 }

 function playSnare(ac, t) {
 var len = Math.floor(ac.sampleRate * 0.18);
 var buf = ac.createBuffer(1, len, ac.sampleRate);
 var d = buf.getChannelData(0);
 for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
 var src = ac.createBufferSource();
 src.buffer = buf;
 var bp = ac.createBiquadFilter();
 bp.type = 'bandpass';
 bp.frequency.value = 1800;
 var g = env(ac, t, 0.001, 0.16, 0.85);
 src.connect(bp);
 bp.connect(g);
 g.connect(ac.destination);
 src.start(t);
 src.stop(t + 0.2);
 }

 function playClap(ac, t) {
 [0, 0.012, 0.024].forEach(function (off) {
 var len = Math.floor(ac.sampleRate * 0.04);
 var buf = ac.createBuffer(1, len, ac.sampleRate);
 var d = buf.getChannelData(0);
 for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
 var src = ac.createBufferSource();
 src.buffer = buf;
 var g = env(ac, t + off, 0.001, 0.08, 0.55);
 src.connect(g);
 g.connect(ac.destination);
 src.start(t + off);
 src.stop(t + off + 0.1);
 });
 }

 function playHat(ac, t, open) {
 var len = Math.floor(ac.sampleRate * (open ? 0.14 : 0.04));
 var buf = ac.createBuffer(1, len, ac.sampleRate);
 var d = buf.getChannelData(0);
 for (var i = 0; i < len; i++) {
 d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, open ? 1.2 : 2.4);
 }
 var src = ac.createBufferSource();
 src.buffer = buf;
 var hp = ac.createBiquadFilter();
 hp.type = 'highpass';
 hp.frequency.value = 7000;
 var g = env(ac, t, 0.001, open ? 0.12 : 0.035, open ? 0.35 : 0.22);
 src.connect(hp);
 hp.connect(g);
 g.connect(ac.destination);
 src.start(t);
 src.stop(t + (open ? 0.16 : 0.05));
 }

 function playTom(ac, t, freq) {
 var o = ac.createOscillator();
 var g = env(ac, t, 0.002, 0.22, 0.7);
 o.type = 'sine';
 o.frequency.setValueAtTime(freq, t);
 o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.08);
 o.connect(g);
 g.connect(ac.destination);
 o.start(t);
 o.stop(t + 0.25);
 }

 function playRim(ac, t) {
 var o = ac.createOscillator();
 var g = env(ac, t, 0.001, 0.06, 0.5);
 o.type = 'square';
 o.frequency.value = 820;
 o.connect(g);
 g.connect(ac.destination);
 o.start(t);
 o.stop(t + 0.08);
 }

 function trigger(id, t, ac) {
 var context = ac || audio();
 if (id === 'kick') playKick(context, t);
 else if (id === 'snare') playSnare(context, t);
 else if (id === 'clap') playClap(context, t);
 else if (id === 'ch') playHat(context, t, false);
 else if (id === 'oh') playHat(context, t, true);
 else if (id === 'ltom') playTom(context, t, 110);
 else if (id === 'mtom') playTom(context, t, 165);
 else if (id === 'rim') playRim(context, t);
 }

 function stepDuration() {
 return (60 / bpm) / 4;
 }

 function barDuration() {
 return STEPS * stepDuration();
 }

 function hasNotes() {
 return TRACKS.some(function (tr) {
 return grid[tr.id].some(Boolean);
 });
 }

 function stamp() {
 var d = new Date();
 return d.getFullYear() +
 String(d.getMonth() + 1).padStart(2, '0') +
 String(d.getDate()).padStart(2, '0') + '-' +
 String(d.getHours()).padStart(2, '0') +
 String(d.getMinutes()).padStart(2, '0');
 }

 function downloadBlob(blob, filename) {
 var url = URL.createObjectURL(blob);
 var a = document.createElement('a');
 a.href = url;
 a.download = filename;
 a.rel = 'noopener';
 document.body.appendChild(a);
 a.click();
 a.remove();
 setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
 }

 function audioBufferToWav(buffer) {
 var channels = buffer.numberOfChannels;
 var sampleRate = buffer.sampleRate;
 var samples = buffer.length;
 var bitDepth = 16;
 var blockAlign = channels * (bitDepth / 8);
 var byteRate = sampleRate * blockAlign;
 var dataSize = samples * blockAlign;
 var out = new ArrayBuffer(44 + dataSize);
 var view = new DataView(out);
 var offset = 0;

 function writeStr(s) {
 for (var i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
 offset += s.length;
 }

 writeStr('RIFF');
 view.setUint32(offset, 36 + dataSize, true); offset += 4;
 writeStr('WAVE');
 writeStr('fmt ');
 view.setUint32(offset, 16, true); offset += 4;
 view.setUint16(offset, 1, true); offset += 2;
 view.setUint16(offset, channels, true); offset += 2;
 view.setUint32(offset, sampleRate, true); offset += 4;
 view.setUint32(offset, byteRate, true); offset += 4;
 view.setUint16(offset, blockAlign, true); offset += 2;
 view.setUint16(offset, bitDepth, true); offset += 2;
 writeStr('data');
 view.setUint32(offset, dataSize, true); offset += 4;

 var chData = [];
 for (var c = 0; c < channels; c++) chData.push(buffer.getChannelData(c));

 for (var i = 0; i < samples; i++) {
 for (var ch = 0; ch < channels; ch++) {
 var sample = Math.max(-1, Math.min(1, chData[ch][i]));
 view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
 offset += 2;
 }
 }

 return out;
 }

 function schedulePattern(ac, startOffset, bars) {
 var stepDur = stepDuration();
 var barDur = barDuration();
 for (var bar = 0; bar < bars; bar++) {
 for (var s = 0; s < STEPS; s++) {
 var t = startOffset + bar * barDur + s * stepDur;
 TRACKS.forEach(function (tr) {
 if (grid[tr.id][s]) trigger(tr.id, t, ac);
 });
 }
 }
 }

 function paintStep(el, on) {
 if (!el) return;
 var col = el.getAttribute('data-color') || '#ff66cc';
 el.style.setProperty('--track-color', col);
 el.classList.toggle('beat-step-on', !!on);
 if (on) {
  el.style.setProperty('background', col, 'important');
  el.style.setProperty('background-color', col, 'important');
  el.style.setProperty('border-color', col, 'important');
  el.style.setProperty('box-shadow', '0 0 10px ' + col, 'important');
 } else {
  el.style.setProperty('background', '#0a0a0a', 'important');
  el.style.setProperty('background-color', '#0a0a0a', 'important');
  el.style.setProperty('border-color', '#444', 'important');
  el.style.setProperty('box-shadow', 'none', 'important');
 }
 }

 function setSaveStatus(msg) {
 var el = document.getElementById('beatSaveStatus');
 if (el) el.textContent = msg || '';
 }

 function setSaveBusy(busy) {
 exporting = busy;
 ['beatSaveWavBtn', 'beatSavePatternBtn'].forEach(function (id) {
 var btn = document.getElementById(id);
 if (btn) btn.disabled = busy;
 });
 }

 async function exportWav() {
 if (exporting) return;
 if (!hasNotes()) {
 setSaveStatus('Program at least one step before saving.');
 return;
 }

 var wasPlaying = playing;
 if (playing) stop();
 setSaveBusy(true);
 setSaveStatus('Rendering WAV...');

 try {
 var stepDur = stepDuration();
 var barDur = barDuration();
 var tail = 0.65;
 var totalDur = EXPORT_BARS * barDur + tail;
 var sampleRate = 44100;
 var frames = Math.ceil(sampleRate * totalDur);
 var OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
 if (!OfflineCtx) throw new Error('OfflineAudioContext not supported');

 var offline = new OfflineCtx(2, frames, sampleRate);
 schedulePattern(offline, 0, EXPORT_BARS);

 var rendered = await offline.startRendering();
 var wav = audioBufferToWav(rendered);
 var filename = 'doswapz-beat-' + bpm + 'bpm-' + stamp() + '.wav';
 downloadBlob(new Blob([wav], { type: 'audio/wav' }), filename);
 setSaveStatus('Saved ' + filename + ' (' + EXPORT_BARS + ' bars).');
 if (wasPlaying) start();
 } catch (err) {
 setSaveStatus('Export failed - try again.');
 console.error('beat export', err);
 } finally {
 setSaveBusy(false);
 }
 }

 function exportPattern() {
 if (!hasNotes()) {
 setSaveStatus('Program at least one step before saving.');
 return;
 }

 var payload = {
 format: 'doswapz-beat-v1',
 bpm: bpm,
 steps: STEPS,
 tracks: TRACKS.map(function (tr) { return tr.id; }),
 grid: grid,
 exportedAt: new Date().toISOString()
 };
 var filename = 'doswapz-beat-pattern-' + bpm + 'bpm-' + stamp() + '.json';
 downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), filename);
 setSaveStatus('Saved ' + filename + ' - reload anytime with LOAD.');
 }

 function applyPattern(data) {
 if (!data || data.format !== 'doswapz-beat-v1' || !data.grid) return false;
 TRACKS.forEach(function (tr) {
 var row = data.grid[tr.id];
 if (!Array.isArray(row)) return;
 for (var s = 0; s < STEPS; s++) {
 grid[tr.id][s] = !!row[s];
 }
 });
 if (typeof data.bpm === 'number' && data.bpm >= 70 && data.bpm <= 140) {
 bpm = Math.round(data.bpm);
 var bpmEl = document.getElementById('beatBpm');
 var bpmVal = document.getElementById('beatBpmVal');
 if (bpmEl) bpmEl.value = String(bpm);
 if (bpmVal) bpmVal.textContent = String(bpm);
 }
 var root = document.getElementById('beatSequencer');
 if (root) {
 root.querySelectorAll('.beat-step').forEach(function (el) {
 var tid = el.getAttribute('data-track');
 var si = parseInt(el.getAttribute('data-step'), 10);
 var col = el.getAttribute('data-color') || '#ff66cc';
 var on = !!(grid[tid] && grid[tid][si]);
 paintStep(el, on);
 });
 }
 return true;
 }

 function loadPatternFile(file) {
 if (!file) return;
 var reader = new FileReader();
 reader.onload = function () {
 try {
 var data = JSON.parse(String(reader.result || ''));
 if (applyPattern(data)) {
 stop();
 setSaveStatus('Loaded ' + file.name);
 } else {
 setSaveStatus('Not a valid DOSWAPZ beat pattern file.');
 }
 } catch (e) {
 setSaveStatus('Could not read pattern file.');
 }
 };
 reader.readAsText(file);
 }

 function tick() {
 var ac = audio();
 var t = ac.currentTime + 0.02;
 TRACKS.forEach(function (tr) {
 if (grid[tr.id][stepIdx]) trigger(tr.id, t, ac);
 });
 highlightStep(stepIdx);
 stepIdx = (stepIdx + 1) % STEPS;
 }

 function highlightStep(idx) {
 document.querySelectorAll('.beat-step').forEach(function (el) {
 el.classList.toggle('beat-step-active', parseInt(el.getAttribute('data-step'), 10) === idx);
 });
 }

 function start() {
 if (playing) return;
 playing = true;
 audio();
 var ms = stepDuration() * 1000;
 tick();
 timer = setInterval(tick, ms);
 var btn = document.getElementById('beatPlayBtn');
 if (btn) btn.textContent = '■ STOP';
 }

 function stop() {
 playing = false;
 if (timer) clearInterval(timer);
 timer = null;
 stepIdx = 0;
 highlightStep(-1);
 var btn = document.getElementById('beatPlayBtn');
 if (btn) btn.textContent = '▶ PLAY';
 }

 function buildUI() {
 var root = document.getElementById('beatSequencer');
 if (!root) return;
 var hint = document.getElementById('beatBootHint');
 if (hint) hint.remove();

 var html = '<div class="beat-toolbar">' +
 '<button type="button" class="beat-btn" id="beatPlayBtn">▶ PLAY</button>' +
 '<label class="beat-bpm">BPM <input type="range" id="beatBpm" min="70" max="140" value="' + bpm + '"> <span id="beatBpmVal">' + bpm + '</span></label>' +
 '<button type="button" class="beat-btn beat-btn-sample" id="beatSampleBtn" title="Load 1 of 10 random sample beats">★ SAMPLE</button>' +
 '<label class="beat-send-wrap" title="Pick which multi-track lane receives this beat">' +
 '<span class="beat-send-label">SEND →</span>' +
 '<select id="beatSendTrack" class="beat-send-select" aria-label="Destination track">' +
 '<option value="0">TR 1</option>' +
 '<option value="1">TR 2</option>' +
 '<option value="2">TR 3</option>' +
 '<option value="3">TR 4</option>' +
 '<option value="4">TR 5</option>' +
 '<option value="5">TR 6</option>' +
 '<option value="6">TR 7</option>' +
 '<option value="7">TR 8</option>' +
 '</select>' +
 '<button type="button" class="beat-btn beat-btn-send" id="beatSendBtn">⬇ SEND</button>' +
 '</label>' +
 '<button type="button" class="beat-btn beat-btn-save" id="beatSaveWavBtn">⬇ SAVE WAV</button>' +
 '<button type="button" class="beat-btn" id="beatSavePatternBtn">SAVE PATTERN</button>' +
 '<label class="beat-btn beat-btn-load" for="beatLoadInput">LOAD</label>' +
 '<input type="file" id="beatLoadInput" accept=".json,application/json" hidden>' +
 '<button type="button" class="beat-btn" id="beatClearBtn">CLEAR</button>' +
 '<span class="beat-save-status" id="beatSaveStatus">Program pads · ★ SAMPLE · pick track · ⬇ SEND</span>' +
 '</div><div class="beat-grid">';

 TRACKS.forEach(function (tr) {
 html += '<div class="beat-row" style="--track-color:' + tr.color + '">' +
 '<span class="beat-swatch" style="background:' + tr.color + ';background-color:' + tr.color + '" aria-hidden="true"></span>' +
 '<span class="beat-label" style="color:' + tr.color + '">' + tr.label + '</span><div class="beat-steps">';
 for (var s = 0; s < STEPS; s++) {
 var on = grid[tr.id][s];
 var onClass = on ? ' beat-step-on' : '';
 html += '<button type="button" class="beat-step' + onClass + '" data-track="' + tr.id +
 '" data-step="' + s + '" data-color="' + tr.color + '" aria-label="' + tr.label +
 ' step ' + (s + 1) + '" style="--track-color:' + tr.color + '"></button>';
 }
 html += '</div></div>';
 });
 html += '</div>';
 root.innerHTML = html;
 root.querySelectorAll('.beat-step').forEach(function (el) {
  var tid = el.getAttribute('data-track');
  var si = parseInt(el.getAttribute('data-step'), 10);
  paintStep(el, !!(grid[tid] && grid[tid][si]));
 });

 root.addEventListener('click', function (e) {
 var step = e.target.closest('.beat-step');
 if (step) {
 var tid = step.getAttribute('data-track');
 var si = parseInt(step.getAttribute('data-step'), 10);
 var col = step.getAttribute('data-color') || '#ff66cc';
 grid[tid][si] = !grid[tid][si];
 paintStep(step, grid[tid][si]);
 if (!playing) trigger(tid, audio().currentTime + 0.01);
 return;
 }
 if (e.target.id === 'beatPlayBtn') {
 if (playing) stop(); else start();
 }
 if (e.target.id === 'beatClearBtn') {
 TRACKS.forEach(function (tr) { grid[tr.id].fill(false); });
 root.querySelectorAll('.beat-step').forEach(function (el) {
 paintStep(el, false);
 });
 stop();
 setSaveStatus('Cleared. Hit ★ SAMPLE for a random beat (10 styles).');
 }
 if (e.target.id === 'beatSampleBtn') {
 stop();
 var picked = loadSampleGrid();
 var bpmElS = document.getElementById('beatBpm');
 var bpmValS = document.getElementById('beatBpmVal');
 if (bpmElS) bpmElS.value = String(bpm);
 if (bpmValS) bpmValS.textContent = String(bpm);
 root.querySelectorAll('.beat-step').forEach(function (el) {
  var tid = el.getAttribute('data-track');
  var si = parseInt(el.getAttribute('data-step'), 10);
  paintStep(el, !!(grid[tid] && grid[tid][si]));
 });
 setSaveStatus('SAMPLE ' + picked.id + '/10 · ' + picked.name + ' @ ' + bpm + ' BPM · hit PLAY');
 }
 if (e.target.id === 'beatSendBtn') {
  stop();
  if (!hasNotes()) {
   setSaveStatus('Program at least one step (or ★ SAMPLE) before SEND.');
   return;
  }
  var trackSel = document.getElementById('beatSendTrack');
  var dest = trackSel ? parseInt(trackSel.value, 10) : 0;
  if (isNaN(dest) || dest < 0 || dest > 7) dest = 0;
  var destLabel = 'TR' + (dest + 1);
  if (window.DOSWAPZ_MULTITRACK && window.DOSWAPZ_MULTITRACK.layFromBeatMaker) {
   setSaveStatus('Sending pattern to ' + destLabel + '…');
   window.DOSWAPZ_MULTITRACK.layFromBeatMaker(dest).then(function () {
    setSaveStatus('Sent to ' + destLabel + ' · arm another track and ● RECORD to overdub');
   }).catch(function () {
    setSaveStatus('Send failed — try ★ SAMPLE on the track board.');
   });
  } else {
   setSaveStatus('Track board not ready — refresh the page.');
  }
  return;
 }
 if (e.target.id === 'beatSaveWavBtn') {
 exportWav();
 }
 if (e.target.id === 'beatSavePatternBtn') {
 exportPattern();
 }
 });

 var loadInput = document.getElementById('beatLoadInput');
 if (loadInput) {
 loadInput.addEventListener('change', function () {
 var file = loadInput.files && loadInput.files[0];
 loadPatternFile(file);
 loadInput.value = '';
 });
 }

 var bpmEl = document.getElementById('beatBpm');
 if (bpmEl) {
 bpmEl.addEventListener('input', function () {
 bpm = parseInt(bpmEl.value, 10) || 92;
 var val = document.getElementById('beatBpmVal');
 if (val) val.textContent = String(bpm);
 if (playing) {
 stop();
 start();
 }
 });
 }
 }

 /* Public API for multi-track board */
 window.DOSWAPZ_BEAT = {
  getBpm: function () { return bpm; },
  getSteps: function () { return STEPS; },
  isPlaying: function () { return playing; },
  stop: stop,
  start: start,
  getPattern: function () {
   var g = {};
   TRACKS.forEach(function (t) {
    g[t.id] = (grid[t.id] || []).map(function (v) { return v ? 1 : 0; });
   });
   return { bpm: bpm, steps: STEPS, grid: g, tracks: TRACKS.map(function (t) { return t.id; }) };
  },
  hasNotes: hasNotes
 };

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', buildUI);
 } else {
 buildUI();
 }
})();