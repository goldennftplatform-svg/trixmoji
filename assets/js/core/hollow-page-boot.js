/* Uniform void-shell boot for orbit inner pages */
function hollowPageBoot(title) {
 DOSWAPZ_ERA.set('orbit');
 hollowMandelBg('bg', ['#000', '#020204', '#040408', '#080810', '#0a0a12'], { opacity: 0.1, speed: 0.00002, fast: true });
 hollowStars(48);
 hollowOrbit('field', HOLLOW_PAGE_FLOATER_ORBIT, HOLLOW_PAGE_FLOATER_OPTS);
 document.addEventListener('mousemove', function (e) {
 var g = document.getElementById('cursorGhost');
 if (g) { g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px'; }
 });
 DOSWAPZ_GLITCH.init({
 screen: '#screen',
 content: '#content',
 extraContent: '#orbitPanel',
 titleEl: '#orbitTitle',
 titleText: title,
 interval: 620,
 letterInterval: 2200
 });
 // Edge aqua drop (every 2 min) - load once
 if (!document.querySelector('script[data-aqua-drop]')) {
 var s = document.createElement('script');
 s.src = '/assets/js/core/aqua-drop.js?v=drip2';
 s.setAttribute('data-aqua-drop', '1');
 document.body.appendChild(s);
 }
}