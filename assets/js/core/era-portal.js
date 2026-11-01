/* DOSWAPZ Time Machine - past (classic) * present (orbit) * future (pearl)
   RULE: each era stays true to its time.
   - /classic/*  → PAST shell + PAST hub
   - /orbit/*    → PRESENT shell + PRESENT hub
   - /future/*   → FUTURE
   Link clicks are rewritten to stay inside the current era when a twin page exists.
   EXCEPTION: Past / Present / Future timeline controls always jump to that era hub.
*/
window.DOSWAPZ_ERA = (function () {
 'use strict';

 var KEY = 'doswapz_era';
 var PORTAL = '/portal.html';
 var HUB_PAST = '/past';
 var HUB_ORBIT_BUBBLES = '/present';
 var HUB_PRESENT_TEST = '/orbit/test-hub.html';
 var HUB_ORBIT = HUB_ORBIT_BUBBLES;
 var HUB_FUTURE = '/future';
 var FILE_HUB_PAST = '/classic/hub.html';
 var FILE_HUB_ORBIT = '/orbit/hub.html';
 var FILE_HUB_FUTURE = '/future/hub.html';

 /* Classic-only game trees (no full orbit twin). Present opens them via /orbit wrappers. */
 var CLASSIC_ONLY = [
  '/classic/pages/cryptodad/',
  '/classic/pages/basement/cryptomom/',
  '/classic/pages/tbb/',
  '/classic/pages/ape-chamber/'
 ];

 var ERA_SWITCH_IDS = {
  railPast: 'past',
  railPresent: 'orbit',
  railFuture: 'future',
  eraPast: 'past',
  eraPresent: 'orbit',
  eraFuture: 'future',
  hubExitPast: 'past',
  hubExitPresent: 'orbit',
  hubExitFuture: 'future',
  hubMapPast: 'past',
  hubMapPresent: 'orbit',
  hubMapFuture: 'future',
  crumbPast: 'past',
  crumbPresent: 'orbit',
  crumbFuture: 'future',
  pickPast: 'past',
  pickPresent: 'orbit',
  pickFuture: 'future',
  dosEraPast: 'past',
  dosEraPresent: 'orbit',
  dosEraFuture: 'future'
 };

 function normalize(era) {
  if (era === 'present') return 'orbit';
  if (era === 'past' || era === 'orbit' || era === 'future') return era;
  return 'past';
 }

 function get() {
  try {
   return normalize(localStorage.getItem(KEY) || 'past');
  } catch (e) {
   return 'past';
  }
 }

 function set(era) {
  era = normalize(era);
  try {
   localStorage.setItem(KEY, era);
  } catch (e) {}
  return era;
 }

 function isPast() { return get() === 'past'; }
 function isOrbit() { return get() === 'orbit'; }
 function isPresent() { return get() === 'orbit'; }
 function isFuture() { return get() === 'future'; }

 function pathOf(url) {
  if (!url) return '';
  try {
   if (url.indexOf('http') === 0) {
    var u = new URL(url, location.origin);
    if (u.origin !== location.origin) return '';
    return u.pathname;
   }
  } catch (e) {}
  var p = String(url).split('?')[0].split('#')[0];
  if (p.charAt(0) !== '/') {
   try {
    p = new URL(p, location.href).pathname;
   } catch (e2) {
    return p;
   }
  }
  return p;
 }

 function stripPath(path) {
  if (!path) return '';
  return String(path).replace(/\/+$/, '') || '/';
 }

 function isClassicOnly(path) {
  if (!path) return false;
  if (eraFromPrettyPath(path)) path = prettyToFile(path);
  for (var i = 0; i < CLASSIC_ONLY.length; i++) {
   var prefix = CLASSIC_ONLY[i];
   if (path.indexOf(prefix) === 0) return true;
   var asFile = prefix.replace(/\/$/, '.html');
   if (path === asFile) return true;
  }
  return false;
 }

 function shouldSkipOrbit(path) {
  return isClassicOnly(path);
 }

 function toOrbitPath(classicPath) {
  if (!classicPath || classicPath.indexOf('/classic/pages/') !== 0) return classicPath;
  /* Present wrappers for classic-only games */
  if (classicPath.indexOf('/classic/pages/cryptodad/') === 0) {
   return '/orbit/pages/cryptodad/' + classicPath.slice('/classic/pages/cryptodad/'.length);
  }
  if (classicPath.indexOf('/classic/pages/basement/cryptomom/') === 0) {
   return '/orbit/pages/basement/cryptomom/' + classicPath.slice('/classic/pages/basement/cryptomom/'.length);
  }
  if (classicPath.indexOf('/classic/pages/tbb/') === 0) {
   return '/orbit/pages/tbb/' + classicPath.slice('/classic/pages/tbb/'.length);
  }
  return '/orbit/pages' + classicPath.slice('/classic/pages'.length);
 }

 function toClassicPath(anyPath) {
  if (!anyPath) return anyPath;
  if (anyPath.indexOf('/orbit/pages/cryptodad/') === 0) {
   return '/classic/pages/cryptodad/' + anyPath.slice('/orbit/pages/cryptodad/'.length);
  }
  if (anyPath.indexOf('/orbit/pages/basement/cryptomom/') === 0) {
   return '/classic/pages/basement/cryptomom/' + anyPath.slice('/orbit/pages/basement/cryptomom/'.length);
  }
  if (anyPath.indexOf('/orbit/pages/tbb/') === 0) {
   return '/classic/pages/tbb/' + anyPath.slice('/orbit/pages/tbb/'.length);
  }
  if (anyPath.indexOf('/orbit/pages/') === 0) {
   return '/classic/pages' + anyPath.slice('/orbit/pages'.length);
  }
  if (anyPath === '/orbit/hub.html') return HUB_PAST;
  return anyPath;
 }

 function hubPath() {
  var e = get();
  if (e === 'future') return HUB_FUTURE;
  if (e === 'orbit') return HUB_ORBIT;
  return HUB_PAST;
 }

 function hubFor(era) {
  era = normalize(era);
  if (era === 'future') return HUB_FUTURE;
  if (era === 'orbit') return HUB_ORBIT;
  return HUB_PAST;
 }

 function labelFor(era) {
  era = normalize(era || get());
  if (era === 'future') return 'FUTURE';
  if (era === 'orbit') return 'PRESENT';
  return 'PAST';
 }

 /** Map a path to an era when it is clearly a timeline hub/root. */
 function eraFromHubPath(path) {
  path = stripPath(path);
  if (!path) return null;
  if (path === '/past' || path === FILE_HUB_PAST || path === '/classic/hub' || path === '/hub.html' || path === '/hub') {
   return 'past';
  }
  if (path === '/present' || path === FILE_HUB_ORBIT || path === '/orbit/hub' || path === HUB_PRESENT_TEST) {
   return 'orbit';
  }
  if (path === '/future' || path === FILE_HUB_FUTURE || path === '/future/hub') {
   return 'future';
  }
  return null;
 }

 function splitQsHash(href) {
  var raw = String(href || '');
  var qs = '';
  var hash = '';
  var qi = raw.indexOf('?');
  var hi = raw.indexOf('#');
  if (qi >= 0) qs = hi >= 0 && hi > qi ? raw.slice(qi, hi) : raw.slice(qi);
  if (hi >= 0) hash = raw.slice(hi);
  return { qs: qs, hash: hash };
 }

 /** /classic/pages/geoffwatch.html → /geoffwatch/past */
 function fileToPretty(path) {
  path = stripPath(path);
  if (!path) return path;
  if (path === FILE_HUB_PAST || path === '/classic/hub' || path === '/hub.html' || path === '/hub') return HUB_PAST;
  if (path === FILE_HUB_ORBIT || path === '/orbit/hub' || path === HUB_PRESENT_TEST) return HUB_ORBIT;
  if (path === FILE_HUB_FUTURE || path === '/future/hub') return HUB_FUTURE;
  if (path === '/harbinger.html') return '/harbinger/past';
  var m = path.match(/^\/(classic|orbit)\/pages\/(.+)$/);
  if (!m) return path;
  var era = m[1] === 'orbit' ? 'present' : 'past';
  var rest = m[2].replace(/\/index\.html$/i, '').replace(/\.html$/i, '').replace(/\/$/, '');
  if (!rest) return path;
  return '/' + rest + '/' + era;
 }

 function prettyToFile(path) {
  path = stripPath(path);
  if (path === HUB_PAST) return FILE_HUB_PAST;
  if (path === HUB_ORBIT) return FILE_HUB_ORBIT;
  if (path === HUB_FUTURE) return FILE_HUB_FUTURE;
  var m = path.match(/^\/(.+)\/(past|present)$/);
  if (!m) return path;
  var root = m[2] === 'present' ? '/orbit/pages/' : '/classic/pages/';
  return root + m[1] + '.html';
 }

 function eraFromPrettyPath(path) {
  path = stripPath(path);
  if (path === HUB_PAST) return 'past';
  if (path === HUB_ORBIT) return 'orbit';
  if (path === HUB_FUTURE) return 'future';
  if (/\/past$/.test(path) && path !== '/past') return 'past';
  if (/\/present$/.test(path) && path !== '/present') return 'orbit';
  return null;
 }

 function toPrettyHref(href) {
  var path = pathOf(href);
  if (!path) return href;
  if (path.indexOf('/docs') === 0 || path.indexOf('/api') === 0 || path.indexOf('/assets') === 0) return href;
  if (path === PORTAL || path === '/portal') return href;
  var pretty = fileToPretty(path);
  if (!pretty || pretty === path) return href;
  var extra = splitQsHash(href);
  return pretty + extra.qs + extra.hash;
 }

 /** Lock era from the actual URL so Past/Present/Future cannot drift. */
 function lockFromLocation(pathname) {
  pathname = pathname || (location && location.pathname) || '';
  pathname = pathname.replace(/\/+$/, '') || '/';
  var prettyEra = eraFromPrettyPath(pathname);
  if (prettyEra) return set(prettyEra);
  if (pathname.indexOf('/future') === 0) return set('future');
  if (pathname.indexOf('/orbit') === 0) return set('orbit');
  if (pathname.indexOf('/classic') === 0) return set('past');
  if (pathname === '/portal.html' || pathname === '/portal') return get();
  return get();
 }

 /**
  * Rewrite an internal href so it stays true to the current era.
  * Past → classic twins; Present → orbit twins (incl. game wrappers).
  * Never used for intentional era-switch controls.
  */
 function pathForCurrentEra(href) {
  var path = pathOf(href);
  if (!path) return href;
  var era = get();
  var extra = splitQsHash(href);
  var qs = extra.qs;
  var hash = extra.hash;
  var prettyEra = eraFromPrettyPath(path);
  var filePath = prettyEra ? prettyToFile(path) : path;

  if (era === 'past') {
   if (path === HUB_ORBIT || path === FILE_HUB_ORBIT || path === '/orbit/hub') {
    return HUB_PAST + qs + hash;
   }
   if (filePath.indexOf('/orbit/pages/') === 0 || prettyEra === 'orbit') {
    return fileToPretty(toClassicPath(filePath)) + qs + hash;
   }
   if (filePath.indexOf('/classic/pages/') === 0 || prettyEra === 'past') {
    return fileToPretty(filePath) + qs + hash;
   }
   if (path === FILE_HUB_PAST || path === '/classic/hub' || path === '/hub.html') return HUB_PAST + qs + hash;
   return href;
  }

  if (era === 'orbit') {
   if (path === HUB_PAST || path === FILE_HUB_PAST || path === '/classic/hub' || path === '/hub.html') {
    return HUB_ORBIT + qs + hash;
   }
   if (filePath.indexOf('/classic/pages/') === 0 || prettyEra === 'past') {
    if (isClassicOnly(filePath)) return fileToPretty(filePath) + qs + hash;
    return fileToPretty(toOrbitPath(filePath)) + qs + hash;
   }
   if (filePath.indexOf('/orbit/pages/') === 0 || prettyEra === 'orbit') {
    return fileToPretty(filePath) + qs + hash;
   }
   if (path === FILE_HUB_ORBIT || path === '/orbit/hub') return HUB_ORBIT + qs + hash;
   return href;
  }

  return href;
 }

 function loadTransition(cb) {
  if (window.DOSWAPZ_ERA_TRANSITION && typeof DOSWAPZ_ERA_TRANSITION.run === 'function') {
   cb();
   return;
  }
  var existing = document.querySelector('script[src*="era-transition.js"]');
  if (existing) {
   existing.addEventListener('load', cb);
   existing.addEventListener('error', cb);
   /* already in-flight or cached-but-not-evaled */
   window.setTimeout(cb, 80);
   return;
  }
  var s = document.createElement('script');
  s.src = '/assets/js/core/era-transition.js?v=20260815glitch';
  s.onload = cb;
  s.onerror = cb;
  (document.head || document.documentElement).appendChild(s);
 }

 function travelTo(era, dest) {
  era = normalize(era);
  dest = dest || hubFor(era);
  set(era);

  function play() {
   if (window.DOSWAPZ_ERA_TRANSITION && typeof DOSWAPZ_ERA_TRANSITION.run === 'function') {
    try {
     DOSWAPZ_ERA_TRANSITION.run(era, dest);
     window.setTimeout(function () {
      try {
       var here = stripPath(location.pathname);
       var want = stripPath(pathOf(dest));
       if (here && want && here !== want) {
        window.location.href = dest;
       }
      } catch (e2) {
       window.location.href = dest;
      }
     }, 6800);
     return;
    } catch (e3) {
     window.location.href = dest;
     return;
    }
   }
   window.location.href = dest;
  }

  loadTransition(play);
 }

 function selectFromPortal(era) {
  era = normalize(era);
  var dest = hubFor(era);
  /* Always glitch when leaving the Time Machine — even back into the era you were in */
  travelTo(era, dest);
 }

 function goPortal() {
  window.location.href = PORTAL;
 }

 /** Resolve which era a control wants (null if not an era switch). */
 function resolveEraFromAnchor(a) {
  if (!a) return null;

  var dataEra = a.getAttribute('data-era');
  if (dataEra) return normalize(dataEra);

  var id = a.id || '';
  if (ERA_SWITCH_IDS[id]) return ERA_SWITCH_IDS[id];

  if (a.classList && (a.classList.contains('era-switch') || a.classList.contains('tm-past') || a.classList.contains('tm-present') || a.classList.contains('tm-future'))) {
   if (a.classList.contains('tm-past') || a.classList.contains('era-past')) return 'past';
   if (a.classList.contains('tm-present') || a.classList.contains('era-present')) return 'orbit';
   if (a.classList.contains('tm-future') || a.classList.contains('era-future')) return 'future';
  }

  /* Explicit timeline rails / nav.era always switch eras by hub href */
  if (a.closest && a.closest('.era-rail, nav.era, #dosEraRail, .dos-era-rail')) {
   var hubEra = eraFromHubPath(pathOf(a.getAttribute('href')));
   if (hubEra) return hubEra;
  }

  /* Text label PAST / PRESENT / FUTURE pointing at a hub = timeline jump */
  var text = (a.textContent || '').replace(/\s+/g, ' ').trim();
  text = text.replace(/^[◇◎✦★◆\u25C7\u25CE\u25C6\u25C8]+\s*/i, '');
  var hrefEra = eraFromHubPath(pathOf(a.getAttribute('href')));
  if (hrefEra) {
   if (/^past$/i.test(text)) return 'past';
   if (/^present$/i.test(text)) return 'orbit';
   if (/^future$/i.test(text)) return 'future';
  }

  return null;
 }

 function handleEraSwitch(a, e) {
  var era = resolveEraFromAnchor(a);
  if (!era) return false;
  if (e) {
   e.preventDefault();
   e.stopPropagation();
  }
  var dest = hubFor(era);
  var href = a.getAttribute('href');
  var hrefEra = eraFromHubPath(pathOf(href));
  if (hrefEra === era && href && href.charAt(0) !== '#') {
   /* Prefer canonical hub path, keep any intentional query only if hub-like */
   dest = hubFor(era);
  }
  /* Same era: hard reload hub without long glitch */
  if (get() === era && stripPath(location.pathname) === stripPath(dest)) {
   return true;
  }
  if (get() === era) {
   window.location.href = dest;
   return true;
  }
  travelTo(era, dest);
  return true;
 }

 /** Keep in-page navigation inside the active era. */
 function installLinkGuard() {
  if (window.__DOSWAPZ_ERA_LINK_GUARD__) return;
  window.__DOSWAPZ_ERA_LINK_GUARD__ = true;
  document.addEventListener('click', function (e) {
   if (e.defaultPrevented) return;
   if (e.button !== 0) return;
   if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

   /* Buttons on the time machine portal */
   var btn = e.target && e.target.closest ? e.target.closest('button[data-era], button.tm-past, button.tm-present, button.tm-future, button#pickPast, button#pickPresent, button#pickFuture') : null;
   if (btn) {
    var bEra = btn.getAttribute('data-era');
    if (!bEra) {
     if (btn.id === 'pickPast' || btn.classList.contains('tm-past')) bEra = 'past';
     else if (btn.id === 'pickPresent' || btn.classList.contains('tm-present')) bEra = 'orbit';
     else if (btn.id === 'pickFuture' || btn.classList.contains('tm-future')) bEra = 'future';
    }
    if (bEra) {
     e.preventDefault();
     selectFromPortal(bEra);
     return;
    }
   }

   var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
   if (!a) return;
   if (a.target && a.target !== '' && a.target !== '_self') return;

   /* Present hub bubbles own their click so one press can pop, then navigate. */
   if (a.classList.contains('hollow-btn') || a.classList.contains('bubble')) return;

   /* Timeline switches always win — never rewrite to stay in-era */
   if (handleEraSwitch(a, e)) return;

   if (a.getAttribute('data-no-era') != null) return;
   if (a.getAttribute('data-plain') != null) return;
   if (a.closest && a.closest('#field, .float-field, .era-rail, #bubbleLayer, #dosEraRail, nav.era')) return;
   var href = a.getAttribute('href');
   if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0 || href.indexOf('mailto:') === 0) return;
   // don't rewrite portal / external
   var path = pathOf(href);
   if (!path) return;
   if (path === PORTAL || path === '/portal' || path === '/portal.html') return;
   if (path.indexOf('/docs') === 0) return;

   var next = pathForCurrentEra(href);
   if (next && next !== href) {
    e.preventDefault();
    window.location.href = next;
   }
  }, true);
 }

 function wireKnownEraControls() {
  var ids = Object.keys(ERA_SWITCH_IDS);
  for (var i = 0; i < ids.length; i++) {
   var el = document.getElementById(ids[i]);
   if (!el) continue;
   if (el.getAttribute('data-era-wired') != null) continue;
   el.setAttribute('data-era-wired', '1');
   el.setAttribute('data-era', ERA_SWITCH_IDS[ids[i]]);
   if (el.tagName === 'A') {
    el.setAttribute('data-no-era', '');
    el.setAttribute('data-plain', '');
    el.setAttribute('data-no-transition', 'true');
    el.setAttribute('href', hubFor(ERA_SWITCH_IDS[ids[i]]));
   }
  }

  /* Any leftover [data-era] anchors get correct href */
  var nodes = document.querySelectorAll('a[data-era], button[data-era]');
  for (var j = 0; j < nodes.length; j++) {
   var n = nodes[j];
   var era = normalize(n.getAttribute('data-era'));
   if (n.tagName === 'A') {
    n.setAttribute('href', hubFor(era));
    n.setAttribute('data-no-era', '');
    n.setAttribute('data-plain', '');
    n.setAttribute('data-no-transition', 'true');
   }
  }
 }

 function shouldInjectRail() {
  if (!document.body) return false;
  if (document.body.getAttribute('data-no-era-rail') != null) return false;
  if (document.getElementById('dosEraRail')) return false;
  /* Page already has its own timeline rail — do not double-stack */
  if (document.querySelector('nav.era-rail, .era-rail, nav.era')) return false;
  if (document.body.classList.contains('hub-bubbles')) return false;
  var p = stripPath((location && location.pathname) || '/');
  /* Portal already is the full time machine UI */
  if (p === '/portal.html' || p === '/portal') return false;
  /* Splash is enter only */
  if (p === '/' || p === '/index.html') return false;
  return true;
 }

 function injectEraRail() {
  if (!shouldInjectRail()) return;
  try {
   if (!document.querySelector('link[data-doswapz-shell-css], link[href*="doswapz-shell.css"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/css/doswapz-shell.css?v=20260809chrome3';
    link.setAttribute('data-doswapz-shell-css', '1');
    (document.head || document.documentElement).appendChild(link);
   }
  } catch (e0) {}

  var cur = get();
  var nav = document.createElement('nav');
  nav.id = 'dosEraRail';
  nav.className = 'dos-era-rail';
  nav.setAttribute('aria-label', 'Timeline eras');
  nav.innerHTML =
   '<a href="' + HUB_PAST + '" id="dosEraPast" class="era-switch' + (cur === 'past' ? ' here' : '') + '" data-era="past" data-no-era data-plain data-no-transition="true">PAST</a>' +
   '<a href="' + HUB_ORBIT + '" id="dosEraPresent" class="era-switch' + (cur === 'orbit' ? ' here' : '') + '" data-era="orbit" data-no-era data-plain data-no-transition="true">PRESENT</a>' +
   '<a href="' + HUB_FUTURE + '" id="dosEraFuture" class="era-switch' + (cur === 'future' ? ' here' : '') + '" data-era="future" data-no-era data-plain data-no-transition="true">FUTURE</a>' +
   '<a href="' + PORTAL + '" class="tm" data-no-era data-plain data-no-transition="true" title="Time Machine">TIME</a>';
  document.body.appendChild(nav);
  document.body.classList.add('has-dos-era-rail');
 }

 function rewriteDocumentHrefs() {
  try {
   var nodes = document.querySelectorAll('a[href]');
   for (var i = 0; i < nodes.length; i++) {
    var a = nodes[i];
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0 || href.indexOf('mailto:') === 0) continue;
    if (a.target && a.target !== '' && a.target !== '_self') continue;
    var next = toPrettyHref(href);
    if (next && next !== href) a.setAttribute('href', next);
   }
  } catch (e1) {}
 }

 function prettyReplaceState() {
  try {
   var here = stripPath(location.pathname);
   var pretty = fileToPretty(here);
   if (!pretty || pretty === here) return;
   var next = pretty + (location.search || '') + (location.hash || '');
   window.history.replaceState(window.history.state, '', next);
  } catch (e2) {}
 }

 function bootUi() {
  try {
   lockFromLocation();
   prettyReplaceState();
   rewriteDocumentHrefs();
   installLinkGuard();
   wireKnownEraControls();
   injectEraRail();
  } catch (e) {}
 }

 // Auto-lock as soon as this file loads
 try {
  lockFromLocation();
  if (document.readyState === 'loading') {
   document.addEventListener('DOMContentLoaded', bootUi);
  } else {
   bootUi();
  }
 } catch (e) {}

 return {
  KEY: KEY,
  get: get,
  set: set,
  normalize: normalize,
  isPast: isPast,
  isOrbit: isOrbit,
  isPresent: isPresent,
  isFuture: isFuture,
  hubPath: hubPath,
  hubFor: hubFor,
  labelFor: labelFor,
  eraFromHubPath: eraFromHubPath,
  toOrbitPath: toOrbitPath,
  toClassicPath: toClassicPath,
  shouldSkipOrbit: shouldSkipOrbit,
  isClassicOnly: isClassicOnly,
  lockFromLocation: lockFromLocation,
  fileToPretty: fileToPretty,
  prettyToFile: prettyToFile,
  toPrettyHref: toPrettyHref,
  pathForCurrentEra: pathForCurrentEra,
  selectFromPortal: selectFromPortal,
  travelTo: travelTo,
  goPortal: goPortal,
  installLinkGuard: installLinkGuard,
  wireKnownEraControls: wireKnownEraControls,
  injectEraRail: injectEraRail,
  HUB_PAST: HUB_PAST,
  HUB_ORBIT: HUB_ORBIT,
  HUB_ORBIT_BUBBLES: HUB_ORBIT_BUBBLES,
  HUB_PRESENT_TEST: HUB_PRESENT_TEST,
  HUB_FUTURE: HUB_FUTURE,
  PORTAL: PORTAL
 };
})();
