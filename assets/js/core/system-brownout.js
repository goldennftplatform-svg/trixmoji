/* DOSWAPZ - random CRT power-loss (~2/hour), blank screen then recovery ping */
window.DOSWAPZ_BROWNOUT = (function () {
 'use strict';

 var KEY = 'doswapz_brownout_times';
 var MAX_PER_HOUR = 2;
 var HOUR_MS = 60 * 60 * 1000;

 var MESSAGES = [
 'SECURITY BREACH RESOLVED - SYSTEM RESTORED',
 'ALIEN INVASION DIVERTED - RESUMING OPERATIONS',
 'TIMELINE STABILIZED - CAUSALITY REATTACHED',
 'POND0X INTRUSION NEUTRALIZED',
 'GHOST IN THE SHELL CONTAINED',
 'DOS KERNEL PANIC RECOVERED',
 'QUANTUM DECOHERENCE CANCELLED',
 'FBI CYBER DIVISION: FALSE ALARM',
 'H4RB1NG3R MIRROR REALIGNED',
 'MEMPOOL ANOMALY PURGED'
 ];

 var scheduled = false;

 function recentTimes() {
 var now = Date.now();
 try {
 var raw = sessionStorage.getItem(KEY);
 var list = raw ? JSON.parse(raw) : [];
 return list.filter(function (t) { return now - t < HOUR_MS; });
 } catch (e) {
 return [];
 }
 }

 function recordEvent() {
 var list = recentTimes();
 list.push(Date.now());
 try {
 sessionStorage.setItem(KEY, JSON.stringify(list));
 } catch (e) {}
 }

 function canRun() {
 if (document.hidden) return false;
 if (document.getElementById('eraTravelOverlay') &&
 document.getElementById('eraTravelOverlay').classList.contains('era-travel-active')) {
 return false;
 }
 return recentTimes().length < MAX_PER_HOUR;
 }

 function ensureLayers() {
 var blackout = document.getElementById('dosBrownoutBlack');
 if (!blackout) {
 blackout = document.createElement('div');
 blackout.id = 'dosBrownoutBlack';
 blackout.className = 'dos-brownout-black';
 blackout.setAttribute('aria-hidden', 'true');
 document.body.appendChild(blackout);
 }
 var ping = document.getElementById('dosBrownoutPing');
 if (!ping) {
 ping = document.createElement('div');
 ping.id = 'dosBrownoutPing';
 ping.className = 'dos-brownout-ping';
 ping.setAttribute('aria-live', 'polite');
 document.body.appendChild(ping);
 }
 return { blackout: blackout, ping: ping };
 }

 function pickMessage() {
 return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
 }

 function runBrownout() {
 if (!canRun()) {
 scheduleNext();
 return;
 }

 recordEvent();
 var layers = ensureLayers();
 var msg = pickMessage();
 var offMs = 800 + Math.floor(Math.random() * 1200);

 layers.blackout.classList.add('dos-brownout-active');
 document.body.classList.add('dos-brownout-running');

 window.setTimeout(function () {
 layers.blackout.classList.remove('dos-brownout-active');
 document.body.classList.remove('dos-brownout-running');
 layers.ping.textContent = msg;
 layers.ping.classList.add('dos-brownout-ping-show');
 document.body.classList.add('dos-brownout-glitch');

 window.setTimeout(function () {
 layers.ping.classList.remove('dos-brownout-ping-show');
 document.body.classList.remove('dos-brownout-glitch');
 }, 1400 + Math.floor(Math.random() * 600));
 }, offMs);

 scheduleNext();
 }

 function scheduleNext() {
 if (scheduled) return;
 scheduled = true;

 var delay = (12 + Math.random() * 28) * 60 * 1000;
 if (recentTimes().length >= MAX_PER_HOUR) {
 delay = HOUR_MS - (Date.now() - recentTimes()[0]) + (5 + Math.random() * 20) * 60 * 1000;
 }

 window.setTimeout(function () {
 scheduled = false;
 runBrownout();
 }, Math.max(60000, delay));
 }

 function init() {
 var path = window.location.pathname.replace(/\/+$/, '') || '/index.html';
 if (path === '/index.html' || path === '/') return;

 window.setTimeout(scheduleNext, (3 + Math.random() * 12) * 60 * 1000);

 document.addEventListener('visibilitychange', function () {
 if (!document.hidden && !scheduled && canRun()) scheduleNext();
 });
 }

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', init);
 } else {
 init();
 }

 return { scheduleNext: scheduleNext };
})();