/* FTWR - inline white pixel rabbit next to TRIX / FTWR mentions */
window.FTWR_RABBIT = (function () {
 'use strict';

 var FRAMES = [
 [
 '..WW....',
 '.WWWW...',
 '.WBBW...',
 '.WWWW...',
 'WWWWWW..',
 '..WW.WW.',
 '..W..W..',
 '...WW...'
 ],
 [
 'WW..WW..',
 '.WWWW...',
 '.WBBW...',
 '.WWWW...',
 'WWWWWW..',
 '..WW.WW.',
 '..W..W..',
 '...WW...'
 ]
 ];

 var WORD_RE = /\b(TRIX|FTWR|Trix|Ftwr|ftwr|trix)\b/g;

 function buildSvg(frame) {
 var rects = [];
 for (var r = 0; r < frame.length; r++) {
 for (var c = 0; c < frame[r].length; c++) {
 var ch = frame[r][c];
 if (ch === 'W') {
 rects.push('<rect x="' + c + '" y="' + r + '" width="1" height="1" fill="#ffffff"/>');
 } else if (ch === 'B') {
 rects.push('<rect x="' + c + '" y="' + r + '" width="1" height="1" fill="#000000"/>');
 }
 }
 }
 return (
 '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges">' +
 rects.join('') +
 '</svg>'
 );
 }

 var svgDataUrls = FRAMES.map(function (frame) {
 return 'data:image/svg+xml,' + encodeURIComponent(buildSvg(frame));
 });

 function injectStyleVar() {
 document.documentElement.style.setProperty('--ftwr-rabbit-icon-url', 'url("' + svgDataUrls[0] + '")');
 document.documentElement.style.setProperty('--ftwr-rabbit-icon-url-alt', 'url("' + svgDataUrls[1] + '")');
 }

 function shouldSkip(textNode) {
 var parent = textNode.parentElement;
 if (!parent) return true;
 var tag = parent.tagName;
 if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA' || tag === 'OPTION') {
 return true;
 }
 if (parent.closest('.ftwr-rabbit-skip, .ftwr-rabbit-icon, .ftwr-word, select, script, style')) {
 return true;
 }
 return false;
 }

 function makeIcon() {
 var icon = document.createElement('span');
 icon.className = 'ftwr-rabbit-icon';
 icon.setAttribute('aria-hidden', 'true');
 return icon;
 }

 function decorateTextNode(textNode) {
 if (shouldSkip(textNode)) return;

 var text = textNode.nodeValue;
 if (!WORD_RE.test(text)) return;
 WORD_RE.lastIndex = 0;

 var frag = document.createDocumentFragment();
 var last = 0;
 var match;
 var re = /\b(TRIX|FTWR|Trix|Ftwr|ftwr|trix)\b/g;

 while ((match = re.exec(text)) !== null) {
 if (match.index > last) {
 frag.appendChild(document.createTextNode(text.slice(last, match.index)));
 }
 var wrap = document.createElement('span');
 wrap.className = 'ftwr-word';
 wrap.appendChild(makeIcon());
 wrap.appendChild(document.createTextNode(match[0]));
 frag.appendChild(wrap);
 last = re.lastIndex;
 }

 if (last < text.length) {
 frag.appendChild(document.createTextNode(text.slice(last)));
 }

 textNode.parentNode.replaceChild(frag, textNode);
 }

 function decorate(root) {
 root = root || document.body;
 if (!root) return;

 var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
 var nodes = [];
 while (walker.nextNode()) nodes.push(walker.currentNode);
 nodes.forEach(decorateTextNode);
 }

 function init() {
 injectStyleVar();
 decorate();
 }

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', init);
 } else {
 init();
 }

 return {
 decorate: decorate,
 svgDataUrls: svgDataUrls,
 makeIcon: makeIcon
 };
})();