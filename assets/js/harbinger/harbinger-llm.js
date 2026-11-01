/**
 * H4RB1NG3R - finite protocol oracle.
 * Answers come from harbinger-briefing.js only (surface how-DOSWAPZ-works).
 * Cloud uplink is not used for replies.
 */
window.HARBINGER_LLM = (function () {
 'use strict';

 var MAX_HISTORY = 10;
 var busy = false;
 var history = [];
 var els = {};

 function $(id) {
 return document.getElementById(id);
 }

 function setStatus(text, kind) {
 if (!els.status) return;
 // Online: keep the ask prompt only - no tech noise
 els.status.textContent = text || 'ASK THE HARBINGER';
 els.status.className = 'hb-llm-status' + (kind ? ' ' + kind : '');
 }

 function appendLine(role, text) {
 if (!els.log) return;
 var p = document.createElement('p');
 p.className = 'hb-chat-line ' + role;
 p.textContent = text;
 els.log.appendChild(p);
 els.log.scrollTop = els.log.scrollHeight;
 }

 function setBusy(on) {
 busy = !!on;
 if (els.input) els.input.disabled = !!on;
 if (els.send) els.send.disabled = !!on;
 }

 function enableInput() {
 if (els.input) {
 els.input.disabled = false;
 els.input.placeholder = 'ask the harbinger...';
 }
 if (els.send) els.send.disabled = false;
 }

 function pushHistory(role, content) {
 history.push({ role: role, content: content });
 if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
 }

 async function onSubmit(e) {
 if (e && e.preventDefault) e.preventDefault();
 if (busy || !els.input) return;
 var text = (els.input.value || '').trim();
 if (!text) return;

 els.input.value = '';
 appendLine('user', '> ' + text);
 setBusy(true);

 var brief = window.HARBINGER_BRIEFING && window.HARBINGER_BRIEFING.answer
  ? window.HARBINGER_BRIEFING.answer(text)
  : 'That sits above my paygrade. Protocol questions only.';
 pushHistory('user', text);
 pushHistory('assistant', brief);
 appendLine('harbinger', brief);
 setBusy(false);
 if (els.input) els.input.focus();
 }

 function bindUi(ids) {
 ids = ids || {};
 els.status = $(ids.status || 'hbLlmStatus');
 els.log = $(ids.log || 'hbChatLog');
 els.input = $(ids.input || 'hbChatInput');
 els.send = $(ids.send || 'hbChatSend');
 els.form = $(ids.form || 'hbChatForm');

 if (els.form) els.form.addEventListener('submit', onSubmit);
 else if (els.send) els.send.addEventListener('click', onSubmit);
 document.querySelectorAll('.hb-quick').forEach(function (btn) {
  btn.addEventListener('click', function () {
    if (!els.input) return;
    els.input.value = btn.getAttribute('data-q') || btn.textContent;
    onSubmit({ preventDefault: function () {} });
  });
 });

 enableInput();
 setStatus('PROTOCOL CLEARANCE * SURFACE ONLY', 'online');
 if (els.log && !els.log.childNodes.length && window.HARBINGER_BRIEFING && window.HARBINGER_BRIEFING.greeting) {
  appendLine('harbinger', window.HARBINGER_BRIEFING.greeting);
 }
 if (els.input) els.input.focus();
 }

 return {
 bindUi: bindUi,
 clearHistory: function () {
 history = [];
 },
 getMode: function () {
 return 'protocol';
 }
 };
})();
