/* DEGEN KOL FIGHTER '85 - cheesy distorted arcade SFX (Web Audio) */
window.KOL_FIGHTER_SFX = (function () {
 'use strict';

 let ctx = null;
 let noiseBuf = null;
 const lastAt = {};

 function ensure() {
 if (!ctx) {
 const AC = window.AudioContext || window.webkitAudioContext;
 if (!AC) return null;
 ctx = new AC();
 }
 if (ctx.state === 'suspended') ctx.resume();
 return ctx;
 }

 function noiseBuffer(seconds) {
 const c = ensure();
 if (!c) return null;
 if (!noiseBuf || noiseBuf.duration < seconds) {
 const len = (c.sampleRate * seconds) | 0;
 noiseBuf = c.createBuffer(1, len, c.sampleRate);
 const d = noiseBuf.getChannelData(0);
 for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
 }
 return noiseBuf;
 }

 function distortion(amount) {
 const shaper = ctx.createWaveShaper();
 const n = 256;
 const curve = new Float32Array(n);
 const k = 2 + amount * 18;
 for (let i = 0; i < n; i++) {
 const x = (i * 2) / (n - 1) - 1;
 curve[i] = Math.tanh(k * x);
 }
 shaper.curve = curve;
 shaper.oversample = 'none';
 return shaper;
 }

 function outChain(gainVal, crush) {
 const pre = ctx.createGain();
 pre.gain.value = gainVal;
 const crushNode = distortion(crush || 4);
 const lp = ctx.createBiquadFilter();
 lp.type = 'lowpass';
 lp.frequency.value = 3200;
 lp.Q.value = 0.6;
 const post = ctx.createGain();
 post.gain.value = 0.85;
 pre.connect(crushNode);
 crushNode.connect(lp);
 lp.connect(post);
 post.connect(ctx.destination);
 return { in: pre, out: post };
 }

 function canPlay(id, ms) {
 const now = performance.now();
 if (lastAt[id] && now - lastAt[id] < (ms || 55)) return false;
 lastAt[id] = now;
 return true;
 }

 function tone(freqStart, freqEnd, dur, type, gain, crush) {
 const c = ensure();
 if (!c) return;
 const t0 = c.currentTime;
 const osc = c.createOscillator();
 osc.type = type || 'square';
 osc.frequency.setValueAtTime(freqStart, t0);
 if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + dur);
 const chain = outChain(gain || 0.22, crush);
 osc.connect(chain.in);
 osc.start(t0);
 osc.stop(t0 + dur + 0.02);
 }

 function noiseBurst(dur, freq, gain, crush) {
 const c = ensure();
 if (!c) return;
 const t0 = c.currentTime;
 const src = c.createBufferSource();
 src.buffer = noiseBuffer(dur + 0.05);
 const bp = c.createBiquadFilter();
 bp.type = 'bandpass';
 bp.frequency.value = freq || 900;
 bp.Q.value = 1.2;
 const chain = outChain(gain || 0.18, crush || 6);
 src.connect(bp);
 bp.connect(chain.in);
 src.start(t0);
 src.stop(t0 + dur);
 }

 function arpeggio(notes, step, gain) {
 const c = ensure();
 if (!c) return;
 const t0 = c.currentTime;
 notes.forEach(function (freq, i) {
 const osc = c.createOscillator();
 osc.type = 'square';
 osc.frequency.value = freq;
 const g = c.createGain();
 g.gain.setValueAtTime(0.0001, t0 + i * step);
 g.gain.exponentialRampToValueAtTime(gain || 0.14, t0 + i * step + 0.01);
 g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * step + step * 0.9);
 const crushNode = distortion(5);
 osc.connect(g);
 g.connect(crushNode);
 crushNode.connect(ctx.destination);
 osc.start(t0 + i * step);
 osc.stop(t0 + i * step + step);
 });
 }

 function coin() {
 if (!canPlay('coin', 120)) return;
 tone(1800, 2400, 0.05, 'square', 0.16, 3);
 setTimeout(function () { tone(2400, 3200, 0.06, 'square', 0.14, 3); }, 70);
 noiseBurst(0.04, 4000, 0.06, 8);
 }

 function punch() {
 if (!canPlay('punch', 70)) return;
 tone(420, 180, 0.07, 'square', 0.2, 7);
 noiseBurst(0.05, 1400, 0.12, 9);
 }

 function kick() {
 if (!canPlay('kick', 70)) return;
 tone(220, 70, 0.1, 'sawtooth', 0.24, 8);
 noiseBurst(0.08, 320, 0.16, 10);
 }

 function special() {
 if (!canPlay('special', 140)) return;
 tone(880, 220, 0.14, 'sawtooth', 0.2, 9);
 noiseBurst(0.1, 600, 0.14, 11);
 setTimeout(function () { tone(660, 990, 0.06, 'square', 0.12, 6); }, 60);
 }

 function throwSfx() {
 if (!canPlay('throw', 100)) return;
 tone(300, 120, 0.12, 'square', 0.18, 7);
 noiseBurst(0.06, 500, 0.1, 8);
 }

 function whiff() {
 if (!canPlay('whiff', 90)) return;
 tone(280, 90, 0.14, 'triangle', 0.12, 5);
 setTimeout(function () { tone(160, 60, 0.16, 'triangle', 0.1, 4); }, 90);
 }

 function hit(kind) {
 if (!canPlay('hit', 45)) return;
 const heavy = kind === 'heavy' || kind === 'special' || kind === 'throw';
 noiseBurst(heavy ? 0.09 : 0.05, heavy ? 700 : 1100, heavy ? 0.2 : 0.14, 12);
 tone(heavy ? 180 : 320, heavy ? 90 : 140, heavy ? 0.1 : 0.06, 'square', heavy ? 0.18 : 0.12, 10);
 }

 function block() {
 if (!canPlay('block', 60)) return;
 tone(1200, 800, 0.04, 'square', 0.14, 6);
 noiseBurst(0.03, 2200, 0.08, 7);
 }

 function hurt() {
 if (!canPlay('hurt', 80)) return;
 tone(520, 160, 0.09, 'sawtooth', 0.15, 8);
 }

 function jump() {
 if (!canPlay('jump', 120)) return;
 tone(180, 520, 0.1, 'square', 0.14, 5);
 noiseBurst(0.03, 1800, 0.05, 4);
 }

 function land() {
 if (!canPlay('land', 80)) return;
 tone(140, 60, 0.07, 'square', 0.16, 9);
 noiseBurst(0.06, 280, 0.14, 10);
 }

 function ko() {
 if (!canPlay('ko', 400)) return;
 tone(880, 110, 0.55, 'square', 0.2, 7);
 noiseBurst(0.2, 400, 0.1, 8);
 }

 function roundWin() {
 if (!canPlay('roundWin', 300)) return;
 arpeggio([523, 659, 784, 1047], 0.09, 0.13);
 }

 function roundLose() {
 if (!canPlay('roundLose', 300)) return;
 arpeggio([392, 330, 262, 196], 0.11, 0.12);
 }

 function gameOver() {
 if (!canPlay('gameOver', 800)) return;
 arpeggio([220, 196, 165, 131, 98], 0.16, 0.15);
 setTimeout(function () { noiseBurst(0.25, 200, 0.12, 9); }, 500);
 }

 function victory() {
 if (!canPlay('victory', 800)) return;
 arpeggio([262, 330, 392, 523, 659, 784], 0.1, 0.14);
 setTimeout(function () { tone(1047, 1318, 0.2, 'square', 0.12, 6); }, 650);
 }

 function vs() {
 if (!canPlay('vs', 200)) return;
 tone(440, 440, 0.08, 'square', 0.12, 4);
 setTimeout(function () { tone(330, 220, 0.12, 'square', 0.14, 6); }, 100);
 }

 function fight() {
 if (!canPlay('fight', 200)) return;
 tone(660, 990, 0.06, 'square', 0.16, 5);
 noiseBurst(0.04, 1500, 0.1, 7);
 }

 function summon() {
 if (!canPlay('summon', 200)) return;
 tone(120, 440, 0.18, 'sawtooth', 0.14, 9);
 noiseBurst(0.12, 350, 0.12, 10);
 }

 function attackActive(kind) {
 if (kind === 'high' || kind === 'med') punch();
 else if (kind === 'low' || kind === 'heavy') kick();
 else if (kind === 'special') special();
 else if (kind === 'throw') throwSfx();
 }

 function init() {
 ensure();
 }

 return {
 init, coin, punch, kick, special, throw: throwSfx, whiff, hit, block, hurt,
 jump, land, ko, roundWin, roundLose, gameOver, victory, vs, fight, summon, attackActive
 };
})();