(function () {
 'use strict';

 var VOICEMAILS = [
 {
 id: 'vm1',
 label: 'MSG 001 - KID',
 date: 'MAR 14 1987 2:47 AM',
 text: "Hey kid... it's Dad. Listen. Buy the dip. I mean it. I'll pay child support soon. Probably. Don't tell Mom I'm calling from a payphone."
 },
 {
 id: 'vm2',
 label: 'MSG 002 - MOM',
 date: 'APR 02 1987 11:03 PM',
 text: "Mom took the kids. Portfolio's down ninety four percent. Still holding though. Diamond hands run in the family. Tell your sister I love her."
 },
 {
 id: 'vm3',
 label: 'MSG 003 - BELIZE',
 date: 'MAY 19 1987 4:11 AM',
 text: "If you're getting this message I'm probably in Belize. Or jail. Send SOL to the fridge magnet address. Not financial advice. Beep."
 },
 {
 id: 'vm4',
 label: 'MSG 004 - BIG TONY',
 date: 'JUN 01 1987 9:22 PM',
 text: "Tony called again. Said Tuesday. I said Tuesday when the chart pumps. He didn't laugh. Hide the Nintendo. Love you."
 },
 {
 id: 'vm5',
 label: 'MSG 005 - HODL',
 date: 'JUL 04 1987 1:58 AM',
 text: "Happy Fourth. I'm watching a static channel down here in the basement. Feels like home. Remember. Never sell the top. Or the bottom. Just never sell."
 }
 ];

 var RADIO_CHANNELS = [
 { id: 0, label: 'CH 1', name: 'HODL FM', freq: '88.1', tone: 95, q: 0.4, hum: 60, gain: 0.22 },
 { id: 1, label: 'CH 2', name: 'DIP STATIC', freq: '91.7', tone: 420, q: 1.2, hum: 0, gain: 0.28 },
 { id: 2, label: 'CH 3', name: 'MOON HISS', freq: '97.3', tone: 1800, q: 2.1, hum: 0, gain: 0.32 },
 { id: 3, label: 'CH 4', name: 'RUG WAVES', freq: '101.9', tone: 640, q: 0.7, hum: 120, gain: 0.26, wobble: 3.2 },
 { id: 4, label: 'CH 5', name: 'BASEMENT AM', freq: '106.5', tone: 3200, q: 3.5, hum: 0, gain: 0.35 }
 ];

 var audioCtx = null;
 var radioNodes = null;
 var phoneStatic = null;
 var activeRadio = -1;
 var vmPlaying = false;
 var staticAnim = null;

 function getAudio() {
 if (!audioCtx) {
 audioCtx = new (window.AudioContext || window.webkitAudioContext)();
 }
 if (audioCtx.state === 'suspended') {
 audioCtx.resume();
 }
 return audioCtx;
 }

 function makeNoiseBuffer(ctx, seconds) {
 var len = ctx.sampleRate * seconds;
 var buf = ctx.createBuffer(1, len, ctx.sampleRate);
 var data = buf.getChannelData(0);
 for (var i = 0; i < len; i++) {
 data[i] = Math.random() * 2 - 1;
 }
 return buf;
 }

 function stopRadio() {
 if (!radioNodes) return;
 try {
 radioNodes.noise.stop();
 if (radioNodes.humOsc) radioNodes.humOsc.stop();
 if (radioNodes.lfo) radioNodes.lfo.stop();
 } catch (e) { /* already stopped */ }
 radioNodes = null;
 activeRadio = -1;
 document.querySelectorAll('.radio-btn').forEach(function (b) {
 b.classList.remove('tuned');
 });
 var disp = document.getElementById('radioDisplay');
 if (disp) disp.textContent = '--- STATIC ---';
 }

 function startRadioChannel(ch) {
 stopRadio();
 var ctx = getAudio();
 var cfg = RADIO_CHANNELS[ch];
 if (!cfg) return;

 var noise = ctx.createBufferSource();
 noise.buffer = makeNoiseBuffer(ctx, 4);
 noise.loop = true;

 var band = ctx.createBiquadFilter();
 band.type = 'bandpass';
 band.frequency.value = cfg.tone;
 band.Q.value = cfg.q;

 var gain = ctx.createGain();
 gain.gain.value = cfg.gain;

 noise.connect(band);
 band.connect(gain);
 gain.connect(ctx.destination);

 var humOsc = null;
 var lfo = null;

 if (cfg.hum) {
 humOsc = ctx.createOscillator();
 humOsc.type = 'sine';
 humOsc.frequency.value = cfg.hum;
 var humGain = ctx.createGain();
 humGain.gain.value = 0.04;
 humOsc.connect(humGain);
 humGain.connect(gain);
 humOsc.start();
 }

 if (cfg.wobble) {
 lfo = ctx.createOscillator();
 lfo.type = 'sine';
 lfo.frequency.value = cfg.wobble;
 var lfoGain = ctx.createGain();
 lfoGain.gain.value = cfg.tone * 0.35;
 lfo.connect(lfoGain);
 lfoGain.connect(band.frequency);
 lfo.start();
 }

 noise.start();
 radioNodes = { noise: noise, humOsc: humOsc, lfo: lfo };
 activeRadio = ch;

 document.querySelectorAll('.radio-btn').forEach(function (b, i) {
 b.classList.toggle('tuned', i === ch);
 });

 var disp = document.getElementById('radioDisplay');
 if (disp) {
 disp.textContent = cfg.freq + ' MHz ' + cfg.name + ' [NO SIGNAL]';
 }
 }

 function startPhoneStatic() {
 if (phoneStatic) return;
 var ctx = getAudio();
 var noise = ctx.createBufferSource();
 noise.buffer = makeNoiseBuffer(ctx, 2);
 noise.loop = true;

 var hp = ctx.createBiquadFilter();
 hp.type = 'highpass';
 hp.frequency.value = 200;

 var lp = ctx.createBiquadFilter();
 lp.type = 'lowpass';
 lp.frequency.value = 3400;

 var gain = ctx.createGain();
 gain.gain.value = 0.08;

 noise.connect(hp);
 hp.connect(lp);
 lp.connect(gain);
 gain.connect(ctx.destination);
 noise.start();
 phoneStatic = { noise: noise, gain: gain };
 }

 function stopPhoneStatic() {
 if (!phoneStatic) return;
 try { phoneStatic.noise.stop(); } catch (e) { /* */ }
 phoneStatic = null;
 }

 function crackle() {
 var ctx = getAudio();
 var buf = makeNoiseBuffer(ctx, 0.05);
 var src = ctx.createBufferSource();
 src.buffer = buf;
 var g = ctx.createGain();
 g.gain.value = 0.15 + Math.random() * 0.2;
 var lp = ctx.createBiquadFilter();
 lp.type = 'lowpass';
 lp.frequency.value = 1200 + Math.random() * 2000;
 src.connect(lp);
 lp.connect(g);
 g.connect(ctx.destination);
 src.start();
 src.stop(ctx.currentTime + 0.05);
 }

 function playVoicemail(vm) {
 if (vmPlaying) return;
 if (!window.speechSynthesis) {
 alert('Speech not supported in this browser. Read the tape: ' + vm.text);
 return;
 }
 getAudio();
 vmPlaying = true;
 startPhoneStatic();

 var crackleIv = setInterval(crackle, 400 + Math.random() * 900);

 var utter = new SpeechSynthesisUtterance(vm.text);
 utter.rate = 0.88;
 utter.pitch = 0.72;
 utter.volume = 0.95;

 var voices = speechSynthesis.getVoices();
 var male = voices.find(function (v) {
 return /male|david|mark|james|google us english/i.test(v.name);
 }) || voices.find(function (v) { return v.lang.indexOf('en') === 0; });
 if (male) utter.voice = male;

 utter.onstart = function () {
 if (phoneStatic) phoneStatic.gain.gain.value = 0.045;
 };
 utter.onend = utter.onerror = function () {
 clearInterval(crackleIv);
 stopPhoneStatic();
 vmPlaying = false;
 document.querySelectorAll('.vm-btn').forEach(function (b) { b.disabled = false; });
 };

 document.querySelectorAll('.vm-btn').forEach(function (b) { b.disabled = true; });
 speechSynthesis.cancel();
 speechSynthesis.speak(utter);
 }

 function startCrtVideo() {
 var video = document.getElementById('crtVideo');
 if (!video) return;
 video.loop = true;
 video.muted = true;
 video.volume = 0;
 var p = video.play();
 if (p && p.catch) {
 p.catch(function () { /* autoplay blocked until click */ });
 }
 }

 function initCrt() {
 var screen = document.getElementById('crtScreen');
 var staticCanvas = document.getElementById('crtStatic');
 var video = document.getElementById('crtVideo');
 if (!screen || !staticCanvas) return;

 startCrtVideo();

 var ctx = staticCanvas.getContext('2d');
 var w = staticCanvas.width;
 var h = staticCanvas.height;
 var staticLevel = 0.35;

 function drawStatic() {
 var imgData = ctx.createImageData(w, h);
 var d = imgData.data;
 for (var i = 0; i < d.length; i += 4) {
 var v = Math.random() * 255 * staticLevel;
 d[i] = v * 0.9;
 d[i + 1] = v;
 d[i + 2] = v * 1.1;
 d[i + 3] = 180 * staticLevel;
 }
 ctx.putImageData(imgData, 0, 0);
 }

 function burstStatic(ms) {
 staticLevel = 0.85;
 setTimeout(function () { staticLevel = 0.35; }, ms);
 }

 function maybeRoll() {
 screen.classList.remove('roll');
 void screen.offsetWidth;
 screen.classList.add('roll');
 }

 function loop() {
 drawStatic();
 staticAnim = requestAnimationFrame(loop);
 }
 loop();

 if (video) {
 video.addEventListener('ended', function () {
 video.currentTime = 0;
 video.play();
 });
 }

 setInterval(function () {
 if (Math.random() < 0.25) burstStatic(80 + Math.random() * 150);
 }, 1100);

 setInterval(function () {
 if (Math.random() < 0.12) maybeRoll();
 }, 5000);
 }

 function buildVoicemailList() {
 var list = document.getElementById('vmList');
 if (!list) return;
 VOICEMAILS.forEach(function (vm) {
 var row = document.createElement('div');
 row.className = 'vm-row';
 row.innerHTML =
 '<div class="vm-meta"><span class="vm-label">' + vm.label + '</span>' +
 '<span class="vm-date">' + vm.date + '</span></div>' +
 '<button type="button" class="vm-btn" data-id="' + vm.id + '"> PLAY TAPE</button>';
 list.appendChild(row);
 row.querySelector('.vm-btn').addEventListener('click', function () {
 playVoicemail(vm);
 });
 });
 }

 function buildRadio() {
 var row = document.getElementById('radioTuners');
 if (!row) return;
 RADIO_CHANNELS.forEach(function (ch, i) {
 var btn = document.createElement('button');
 btn.type = 'button';
 btn.className = 'radio-btn';
 btn.innerHTML = '<span class="rb-ch">' + ch.label + '</span><span class="rb-name">' + ch.name + '</span>';
 btn.addEventListener('click', function () {
 if (activeRadio === i) {
 stopRadio();
 } else {
 startRadioChannel(i);
 }
 });
 row.appendChild(btn);
 });

 var off = document.getElementById('radioOff');
 if (off) off.addEventListener('click', stopRadio);
 }

 function mpcHref() {
 var p = (location.pathname || '').toLowerCase();
 if (p.indexOf('/orbit') === 0 || /\/present$/.test(p.replace(/\/+$/, ''))) return '/basement/mpc/present';
 return '/basement/mpc/past';
 }

 function initMpcEgg() {
 var ch = document.querySelector('.crt-ch');
 var knobs = document.querySelectorAll('.crt-knob');
 var screen = document.getElementById('crtScreen');
 if (!ch || !screen) return;
 var clicks = 0;

 var style = document.createElement('style');
 style.textContent =
 '.crt-ch{cursor:pointer;z-index:6;position:relative}' +
 '.crt-ch:hover{color:#ffee88;text-shadow:0 0 8px #ffaa00}' +
 '.crt-knob{cursor:pointer}' +
 '.crt-knob:first-child:hover{box-shadow:0 0 10px #ffaa00}' +
 '.mpc-egg-pads{position:absolute;inset:18% 22%;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;z-index:5;pointer-events:none;opacity:0;transition:opacity .25s}' +
 '.mpc-egg-pads.on{opacity:.85}' +
 '.mpc-egg-pads i{background:rgba(230,226,216,.35);border:1px solid rgba(255,220,160,.45);border-radius:3px;box-shadow:0 0 6px rgba(255,180,80,.25)}' +
 '.mpc-egg-toast{position:absolute;left:8px;right:8px;bottom:28px;z-index:7;text-align:center;color:#ffe08a;letter-spacing:2px;font-size:15px;text-shadow:0 0 8px #ffaa00;opacity:0;transition:opacity .2s}' +
 '.mpc-egg-toast.on{opacity:1}';
 document.head.appendChild(style);

 var pads = document.createElement('div');
 pads.className = 'mpc-egg-pads';
 pads.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>';
 screen.appendChild(pads);
 var toast = document.createElement('div');
 toast.className = 'mpc-egg-toast';
 toast.textContent = 'CH 04 · SOMETHING IN THE STATIC';
 screen.appendChild(toast);

 function openMpc() {
 location.href = mpcHref();
 }

 function bump() {
 clicks += 1;
 if (clicks === 1) {
 ch.textContent = 'CH 04';
 pads.classList.add('on');
 toast.classList.add('on');
 screen.style.cursor = 'pointer';
 } else {
 toast.textContent = 'MPC2000XL FOUND';
 setTimeout(openMpc, 280);
 }
 }

 ch.title = 'change channel';
 ch.addEventListener('click', function (e) {
 e.stopPropagation();
 bump();
 });
 screen.addEventListener('click', function () {
 if (clicks >= 1) bump();
 });
 if (knobs[0]) {
 knobs[0].title = 'click';
 knobs[0].addEventListener('click', function (e) {
 e.stopPropagation();
 bump();
 });
 }
 }

 function init() {
 buildVoicemailList();
 buildRadio();
 initCrt();
 initMpcEgg();

 if (window.speechSynthesis) {
 speechSynthesis.getVoices();
 window.speechSynthesis.onvoiceschanged = function () {
 speechSynthesis.getVoices();
 };
 }

 document.body.addEventListener('click', function once() {
 getAudio();
 startCrtVideo();
 document.body.removeEventListener('click', once);
 }, { once: true });
 }

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', init);
 } else {
 init();
 }
})();