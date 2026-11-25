/* Runs before first paint. Sets only the flag the stylesheet needs for reveals.
   If the main script never reports in, everything is shown rather than left hidden. */
(function () {
  var d = document.documentElement;
  var rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pv = /[?&]preview=1/.test(location.search);
  if ('IntersectionObserver' in window && !rm && !pv) d.classList.add('anim');
  setTimeout(function () { if (!window.MSCO_READY) d.classList.remove('anim'); }, 4500);
})();
