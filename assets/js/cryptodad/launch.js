/* DOSWAPZ - $DOSWAPZ launch animation (colorful batch + CRT) */
window.DOSWAPZ_LAUNCH = (function () {
 'use strict';

 var BASE = '/assets/images/cryptodad_colorful/';
 var GREEN = '/assets/images/cryptodad/';

 var SLIDES = [
 { src: BASE + '11.jpg', caption: 'CRYPTO DAD - SYSTEM ONLINE', mood: 'hero', ms: 3400 },
 { src: BASE + '14.jpg', caption: 'FTWR - FOLLOW THE WHITE RABBIT', mood: 'hero', ms: 2800 },
 { src: BASE + '6Nwah.jpg', caption: 'DOSWAPZ NODE SYNC', mood: 'hero', ms: 2600 },
 { src: BASE + '7.jpg', caption: 'HEAT RISING', mood: 'heat', ms: 2200 },
 { src: GREEN + 'heat_high.jpg', caption: 'STAY CALM OR BURN', mood: 'heat', ms: 2400 },
 { src: BASE + '3.jpg', caption: 'DEGEN MOMENT', mood: 'heat', ms: 2000 },
 { src: BASE + '18.jpg', caption: 'FAMILY STAT RECOVERING', mood: 'warm', ms: 2600 },
 { src: BASE + '22.jpg', caption: 'TOP DAD ENERGY', mood: 'warm', ms: 2800 },
 { src: GREEN + 'good_ending.jpg', caption: 'GOOD ENDING PATH', mood: 'warm', ms: 3000 },
 { src: BASE + '12.jpg', caption: 'MONTAGE - BATCH 01', mood: 'montage', ms: 1400 },
 { src: BASE + '9.jpg', caption: 'MONTAGE - BATCH 02', mood: 'montage', ms: 1200 },
 { src: BASE + '03jJK.jpg', caption: 'MONTAGE - BATCH 03', mood: 'montage', ms: 1200 },
 { src: BASE + '21.jpg', caption: 'MONTAGE - BATCH 04', mood: 'montage', ms: 1200 },
 { src: BASE + '5.jpg', caption: 'MONTAGE - BATCH 05', mood: 'montage', ms: 1200 },
 { src: BASE + '16.jpg', caption: 'MONTAGE - BATCH 06', mood: 'montage', ms: 1200 },
 { src: BASE + '22.jpg', caption: '$DOSWAPZ - TRIX 26 AUG 2026', mood: 'hero', ms: 4200 }
 ];

 var idx = 0;
 var timer = null;
 var running = false;
 var reduced = false;

 function $(id) {
 return document.getElementById(id);
 }

 function setMood(mood) {
 var stage = $('launchStage');
 if (!stage) return;
 stage.className = 'launch-stage mood-' + (mood || 'hero');
 }

 function setCaption(text) {
 var cap = $('launchCaption');
 if (cap) cap.textContent = text || '';
 }

 function flashGlitch() {
 var flash = $('launchGlitchFlash');
 if (!flash || reduced) return;
 flash.classList.remove('on');
 void flash.offsetWidth;
 flash.classList.add('on');
 setTimeout(function () {
 flash.classList.remove('on');
 }, 180);
 }

 function showSlide(i) {
 var slide = SLIDES[i];
 if (!slide) return;

 var a = $('launchImgA');
 var b = $('launchImgB');
 if (!a || !b) return;

 var front = a.classList.contains('front') ? a : b;
 var back = front === a ? b : a;

 back.src = slide.src;
 back.onload = function () {
 back.classList.add('front');
 front.classList.remove('front');
 };

 setMood(slide.mood);
 setCaption(slide.caption);
 flashGlitch();
 }

 function nextSlide() {
 idx = (idx + 1) % SLIDES.length;
 showSlide(idx);
 scheduleNext();
 }

 function scheduleNext() {
 if (timer) clearTimeout(timer);
 if (!running) return;
 var ms = SLIDES[idx] && SLIDES[idx].ms ? SLIDES[idx].ms : 2500;
 timer = setTimeout(nextSlide, ms);
 }

 function start() {
 if (running) return;
 running = true;
 idx = 0;
 showSlide(0);
 scheduleNext();
 }

 function stop() {
 running = false;
 if (timer) clearTimeout(timer);
 timer = null;
 }

 function goToken() {
 stop();
 var dest = '/classic/pages/cryptodad/token.html';
 if (window.FTWR_CONFIG && window.FTWR_CONFIG.trixTokenUrl) {
 dest = '/classic/pages/cryptodad/token.html';
 }
 if (window.DOSWAPZ_TRANSITION) {
 window.DOSWAPZ_TRANSITION.navigate(dest);
 } else {
 window.location.href = dest;
 }
 }

 function initReduced() {
 reduced = true;
 var a = $('launchImgA');
 if (a) {
 a.src = BASE + '11.jpg';
 a.classList.add('front');
 }
 setCaption('$DOSWAPZ - TRIX 26 AUG 2026');
 setMood('hero');
 }

 function bindUi() {
 var skip = $('launchSkip');
 var enter = $('launchEnter');
 if (skip) skip.addEventListener('click', goToken);
 if (enter) enter.addEventListener('click', goToken);
 }

 function init() {
 reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 bindUi();
 if (reduced) {
 initReduced();
 return;
 }
 start();
 }

 return { init: init, stop: stop };
})();

document.addEventListener('DOMContentLoaded', function () {
 if (window.DOSWAPZ_LAUNCH) DOSWAPZ_LAUNCH.init();
});