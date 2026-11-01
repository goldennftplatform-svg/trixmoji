/* Present-era shell for classic-held games (Crypto Dad / FTWR / etc).
   Present URL (/orbit/...) locks era = PRESENT. Game runs embedded classic art.
   Parent chrome (Hub / Time machine) stays Present-true. */
(function () {
  'use strict';
  try {
    if (window.DOSWAPZ_ERA) {
      if (DOSWAPZ_ERA.lockFromLocation) DOSWAPZ_ERA.lockFromLocation();
      else if (DOSWAPZ_ERA.set) DOSWAPZ_ERA.set('orbit');
    } else {
      localStorage.setItem('doswapz_era', 'orbit');
    }
  } catch (e) {}
})();
