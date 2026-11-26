/**
 * Runs before first paint. Enables reveal-on-scroll styles only when the browser supports them,
 * and shows everything if the main script has not started within a few seconds.
 */
(function () {
  var d = document.documentElement;
  var rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pv = /[?&]preview=1/.test(location.search);
  if ('IntersectionObserver' in window && !rm && !pv) d.classList.add('anim');
  setTimeout(function () { if (!window.MSCO_READY) d.classList.remove('anim'); }, 4500);
})();
