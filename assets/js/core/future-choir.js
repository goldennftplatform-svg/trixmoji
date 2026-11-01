/* Soft angelic choir pad - deep + high voices with delayed wash (Web Audio) */
window.DOSWAPZ_FUTURE_CHOIR = (function () {
 'use strict';

 var ctx = null;
 var master = null;
 var nodes = [];
 var started = false;

 function ensure() {
 if (ctx) return ctx;
 var AC = window.AudioContext || window.webkitAudioContext;
 if (!AC) return null;
 ctx = new AC();

 master = ctx.createGain();
 master.gain.value = 0.0001;

 // Soft compressor so peaks stay heavenly, not harsh
 var comp = ctx.createDynamicsCompressor();
 comp.threshold.value = -28;
 comp.knee.value = 24;
 comp.ratio.value = 3;
 comp.attack.value = 0.05;
 comp.release.value = 0.4;

 // Delay feedback for weird delayed voices
 var delay = ctx.createDelay(2.5);
 delay.delayTime.value = 0.42;
 var fb = ctx.createGain();
 fb.gain.value = 0.38;
 var delayFilter = ctx.createBiquadFilter();
 delayFilter.type = 'lowpass';
 delayFilter.frequency.value = 2400;
 delayFilter.Q.value = 0.4;

 var wet = ctx.createGain();
 wet.gain.value = 0.45;
 var dry = ctx.createGain();
 dry.gain.value = 0.55;

 master.connect(dry);
 master.connect(delay);
 delay.connect(delayFilter);
 delayFilter.connect(fb);
 fb.connect(delay);
 delayFilter.connect(wet);

 dry.connect(comp);
 wet.connect(comp);
 comp.connect(ctx.destination);

 return ctx;
 }

 function voice(freq, type, gainVal, detune) {
 var o = ctx.createOscillator();
 var g = ctx.createGain();
 var f = ctx.createBiquadFilter();
 o.type = type || 'sine';
 o.frequency.value = freq;
 o.detune.value = detune || 0;
 f.type = 'lowpass';
 f.frequency.value = freq * 4.5;
 f.Q.value = 0.7;
 g.gain.value = gainVal;
 o.connect(f);
 f.connect(g);
 g.connect(master);
 o.start();
 nodes.push(o, g, f);
 return { o: o, g: g };
 }

 function start() {
 if (started) {
 if (ctx && ctx.state === 'suspended') ctx.resume();
 return;
 }
 if (!ensure()) return;
 started = true;

 // Deep choir foundation
 voice(55, 'sine', 0.06, -6);
 voice(82.5, 'triangle', 0.035, 4);
 voice(110, 'sine', 0.04, -3);

 // Mid ethereal
 voice(220, 'sine', 0.028, 8);
 voice(277.18, 'triangle', 0.02, -12); // C#5-ish
 voice(329.63, 'sine', 0.018, 5);

 // High angelic partials
 voice(440, 'sine', 0.012, -7);
 voice(554.37, 'sine', 0.01, 11);
 voice(659.25, 'triangle', 0.008, -4);
 voice(880, 'sine', 0.006, 15);

 // Slow LFO on master for breathing
 var lfo = ctx.createOscillator();
 var lfoG = ctx.createGain();
 lfo.frequency.value = 0.07;
 lfoG.gain.value = 0.012;
 lfo.connect(lfoG);
 lfoG.connect(master.gain);
 lfo.start();
 nodes.push(lfo, lfoG);

 // Fade in gently
 var now = ctx.currentTime;
 master.gain.cancelScheduledValues(now);
 master.gain.setValueAtTime(0.0001, now);
 master.gain.exponentialRampToValueAtTime(0.11, now + 4.5);

 if (ctx.state === 'suspended') ctx.resume();
 }

 function swell() {
 if (!ctx || !master) return;
 var now = ctx.currentTime;
 var cur = master.gain.value || 0.08;
 master.gain.cancelScheduledValues(now);
 master.gain.setValueAtTime(cur, now);
 master.gain.linearRampToValueAtTime(Math.min(0.16, cur * 1.4), now + 0.8);
 master.gain.linearRampToValueAtTime(0.1, now + 3.2);
 }

 function stop() {
 if (!ctx || !master) return;
 var now = ctx.currentTime;
 master.gain.cancelScheduledValues(now);
 master.gain.setValueAtTime(master.gain.value, now);
 master.gain.exponentialRampToValueAtTime(0.0001, now + 2);
 }

 return { start: start, swell: swell, stop: stop, ensure: ensure };
})();
