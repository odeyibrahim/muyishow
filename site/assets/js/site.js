/**
 * Public site behaviour.
 * The page is rendered at build time; this script adds interaction (menu, tabs, dialogs, forms),
 * reveal-on-scroll, optional smooth scrolling, and swaps in newer content from Supabase when it exists.
 */
(function () {
  'use strict';
  var D = document, W = window, H = D.documentElement;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || D).querySelectorAll(s)); };
  var R = W.MSCO_RENDER, CFG = W.MSCO_CONFIG || {}, app = $('#app'), dlg = $('#dlg');
  if (!app || !R) { W.MSCO_READY = true; return; }
  W.MSCO_READY = true;

  var PREVIEW = /[?&]preview=1/.test(location.search);
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var content = {};
  try { content = JSON.parse($('#msco-content').textContent); } catch (e) { content = W.MSCO_DEFAULT || {}; }
  var lenis = null, io = null, spy = null, ioContact = null, menuOpen = false, lastFocus = null;

  /* Reveal-on-scroll */
  function visible(el) { var r = el.getBoundingClientRect(); return r.top < innerHeight * 0.98 && r.bottom > 0; }
  function prepare(instant) {
    if (io) io.disconnect();
    var els = $$('.rv, .rt', app);
    $$('.cl,.eng,.pl2,.ri,.cards,dl', app).forEach(function (g) { $$('.rv', g).forEach(function (e, i) { e.style.setProperty('--i', i); }); });
    if (!H.classList.contains('anim')) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
    els.forEach(function (e) { if (instant && visible(e)) e.classList.add('in'); else io.observe(e); });
  }
  /* Fallback: anything on screen that is still hidden after a moment is shown */
  function sweep() { $$('.rv:not(.in), .rt:not(.in)', app).forEach(function (e) { if (visible(e)) e.classList.add('in'); }); }
  setTimeout(sweep, 2200); setTimeout(sweep, 5000); addEventListener('load', function () { setTimeout(sweep, 400); });

  /* Images */
  function fbSwap(img) {
    var k = img.getAttribute('data-fb'); if (!k || img.getAttribute('data-done')) return;
    img.setAttribute('data-done', '1'); img.src = 'assets/img/fb-' + k + '.svg';
  }
  function checkImgs() { $$('img[data-fb]', app).forEach(function (i) { if (i.complete && i.naturalWidth === 0) fbSwap(i); }); }
  app.addEventListener('error', function (e) { if (e.target && e.target.tagName === 'IMG') fbSwap(e.target); }, true);
  dlg.addEventListener('error', function (e) { if (e.target && e.target.tagName === 'IMG') fbSwap(e.target); }, true);

  /* Rendering and content */
  function applyHead(c) {
    var s = c.site || {};
    if (s.title) D.title = s.title;
    [['meta[name=description]', s.description], ['meta[property="og:title"]', s.title], ['meta[property="og:description"]', s.description], ['meta[name="twitter:title"]', s.title], ['meta[name="twitter:description"]', s.description]]
      .forEach(function (m) { var el = $(m[0]); if (el && m[1]) el.setAttribute('content', m[1]); });
    var fl = $('#fonts'); if (fl) { var h = R.fontHref(c.theme); if (fl.getAttribute('href') !== h) fl.setAttribute('href', h); }
    var fv = $('#font-vars'); if (fv) fv.textContent = R.fontCss(c.theme);
  }
  function render(c, instant) {
    var y = scrollY;
    content = c; app.innerHTML = R.page(c); applyHead(c);
    $$('[data-yr]', app).forEach(function (n) { n.textContent = new Date().getFullYear(); });
    wire(); prepare(instant); checkImgs();
    if (instant) scrollTo(0, y);
  }
  function wire() {
    if (spy) spy.disconnect(); if (ioContact) ioContact.disconnect();
    var links = {}; $$('.dn a[data-spy]', app).forEach(function (a) { links[a.getAttribute('data-spy')] = a; });
    spy = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { Object.keys(links).forEach(function (k) { var on = k === x.target.id; links[k].classList.toggle('on', on); if (on) links[k].setAttribute('aria-current', 'true'); else links[k].removeAttribute('aria-current'); }); } });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(links).forEach(function (k) { var s = D.getElementById(k); if (s) spy.observe(s); });
    var ct = $('#contact', app);
    if (ct) { ioContact = new IntersectionObserver(function (es) { es.forEach(function (x) { H.classList.toggle('at-contact', x.isIntersecting); }); }, { threshold: 0.12 }); ioContact.observe(ct); }
    var nv = $('#nv'); if (nv) nv.setAttribute('data-lenis-prevent', '');
  }

  function merge(base, rows) {
    var out = JSON.parse(JSON.stringify(base));
    rows.forEach(function (r) { if (r && r.key && r.value != null) out[r.key] = r.value; });
    return out;
  }
  function typing() { return $$('form input, form textarea', app).some(function (i) { return i.value && i.type !== 'hidden'; }); }
  function loadRemote() {
    if (PREVIEW || !CFG.supabaseUrl || !CFG.supabaseAnonKey || !W.fetch) return;
    var ck = 'msco_c2', built = content._built || '';
    try {
      var cached = JSON.parse(localStorage.getItem(ck) || 'null');
      if (cached && cached.b === built && JSON.stringify(cached.c) !== JSON.stringify(content)) render(cached.c, true);
    } catch (e) {}
    var ac = W.AbortController ? new AbortController() : null, to = setTimeout(function () { if (ac) ac.abort(); }, 7000);
    fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/site_content?select=key,value', { headers: { apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + CFG.supabaseAnonKey }, signal: ac && ac.signal })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (rows) {
        clearTimeout(to); if (!rows || !rows.length) return;
        var m = merge(content, rows); m._built = built;
        try { localStorage.setItem(ck, JSON.stringify({ b: built, c: m })); } catch (e) {}
        if (JSON.stringify(m) !== JSON.stringify(content) && !typing()) render(m, true);
      }).catch(function () { clearTimeout(to); });
  }

  /* Scrolling */
  function go(id, hard) {
    var el = D.getElementById(id); if (!el) return false;
    var y = el.getBoundingClientRect().top + scrollY - 64;
    if (lenis && !hard) lenis.scrollTo(Math.max(0, y), { duration: 1.2 }); else scrollTo({ top: Math.max(0, y), behavior: hard || RM ? 'auto' : 'smooth' });
    return true;
  }
  function initLenis() {
    if (!W.Lenis || RM || PREVIEW || !matchMedia('(pointer:fine)').matches) return;
    try {
      lenis = new W.Lenis({ duration: 1.1, smoothWheel: true });
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
    } catch (e) { lenis = null; }
  }
  function stopScroll(on) { if (lenis) { on ? lenis.stop() : lenis.start(); } }

  /* Mobile menu */
  function menu(open) {
    menuOpen = open; var nv = $('#nv'), mb = $('#mb'); if (!nv) return;
    nv.classList.toggle('open', open); H.classList.toggle('nav-open', open);
    if (mb) { mb.setAttribute('aria-expanded', open); mb.textContent = open ? 'Close' : 'Menu'; }
    D.body.style.overflow = open ? 'hidden' : ''; stopScroll(open);
    if (open) { var first = $('#nv a'); if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 60); } else if (mb && D.activeElement && nv.contains(D.activeElement)) mb.focus({ preventScroll: true });
  }
  addEventListener('resize', function () { if (menuOpen && innerWidth >= 1080) menu(false); });

  /* Tabs */
  function selectTab(group, key, focus) {
    var g = $('[data-tabs="' + group + '"]', app); if (!g) return;
    $$('[role=tab]', g).forEach(function (t) { var on = t.getAttribute('data-tab') === key; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    $$('[role=tabpanel]', g).forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== key; });
  }

  /* Dialog */
  function openDlg(html, hash) {
    if (!dlg.open) lastFocus = D.activeElement;
    $('#dlg-c').innerHTML = html; $$('img[data-fb]', dlg).forEach(function (i) { if (i.complete && i.naturalWidth === 0) fbSwap(i); });
    if (!dlg.open) dlg.showModal(); $('.dlg-b', dlg).scrollTop = 0; stopScroll(true);
    if (hash) history.replaceState(null, '', location.pathname + location.search + '#' + hash);
  }
  function closeDlg() { if (dlg.open) dlg.close(); }
  dlg.addEventListener('close', function () {
    $('#dlg-c').innerHTML = ''; stopScroll(false);
    if (lastFocus && lastFocus.focus && D.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    if (/^#(privacy|post-)/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('.dlg-x')) closeDlg(); });
  dlg.setAttribute('data-lenis-prevent', '');

  function openFromHash() {
    var h = location.hash.replace('#', '');
    if (h === 'privacy') { openDlg(R.dialog(content, 'privacy'), 'privacy'); return true; }
    if (h.indexOf('post-') === 0) {
      var items = (content.insights || {}).items || [], i = items.map(function (p) { return p.id; }).indexOf(h.slice(5));
      if (i > -1 && !items[i].link) { openDlg(R.dialog(content, 'post', i), h); return true; }
    }
    if (h === 'contact-referral') { selectTab('ct', 'referral'); setTimeout(function () { go('contact', true); }, 60); return true; }
    return false;
  }

  /* Forms */
  function submitForm(f) {
    var msg = $('.fm', f), bad = $$('[required]', f).filter(function (i) { return !i.value.trim() || (i.type === 'email' && !/^\S+@\S+\.\S+$/.test(i.value)); });
    msg.className = 'fm';
    if (bad.length) { msg.className = 'fm err'; msg.textContent = 'Please complete the highlighted fields' + (bad[0].type === 'email' ? ' with a valid email address.' : '.'); bad[0].focus(); return; }
    if (PREVIEW) { msg.textContent = 'Preview only: nothing is sent.'; return; }
    var btn = $('button[type=submit]', f); btn.disabled = true; msg.textContent = 'Sending…';
    var fields = {}; new FormData(f).forEach(function (v, k) { if (k !== 'form-name' && k !== 'bot-field') fields[k] = v; });
    var ok = function () { msg.textContent = 'Thank you. We have your message and will reply promptly.'; f.reset(); };
    fetch('/.netlify/functions/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ form: f.getAttribute('name'), fields: fields, 'bot-field': f.elements['bot-field'] ? f.elements['bot-field'].value : '' }) })
      .then(function (r) {
        if (r.ok) return ok();
        if (r.status === 400 || r.status === 429) return r.json().then(function (j) { throw new Error(j.error || 'Please check the form.'); });
        throw new Error('fallback');
      })
      .catch(function (err) {
        if (err.message !== 'fallback' && err.message !== 'Failed to fetch' && !/NetworkError|Load failed/.test(err.message)) { msg.className = 'fm err'; msg.textContent = err.message; return; }
        /* The function is unavailable: use Netlify Forms instead. */
        return fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(f)).toString() })
          .then(function (r) { if (!r.ok) throw new Error(r.status); ok(); });
      })
      .catch(function () { msg.className = 'fm err'; msg.innerHTML = 'That did not send. Please email us at <a href="mailto:' + R.esc((content.site || {}).email) + '">' + R.esc((content.site || {}).email) + '</a>.'; })
      .then(function () { btn.disabled = false; });
  }

  /* Event delegation (survives re-renders) */
  D.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('#mb')) { menu(!menuOpen); return; }
    var d = t.closest('[data-dlg]');
    if (d) { var p = d.getAttribute('data-dlg').split(':'); openDlg(R.dialog(content, p[0], +p[1]), p[0] === 'post' ? 'post-' + (((content.insights || {}).items || [])[+p[1]] || {}).id : ''); return; }
    var m = t.closest('[data-map]');
    if (m) { openDlg('<h3 id="dlg-t">' + R.esc(m.getAttribute('data-title')) + '</h3><iframe title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=' + m.getAttribute('data-map') + '&z=16&output=embed"></iframe>'); return; }
    var tab = t.closest('[role=tab]');
    if (tab) { selectTab(tab.closest('[data-tabs]').getAttribute('data-tabs'), tab.getAttribute('data-tab')); return; }
    var a = t.closest('a[href^="#"]');
    if (a) {
      var h = a.getAttribute('href').slice(1);
      if (PREVIEW) { e.preventDefault(); return; }
      var wasMenu = menuOpen; if (wasMenu) menu(false);
      if (h === 'privacy') { e.preventDefault(); openDlg(R.dialog(content, 'privacy'), 'privacy'); return; }
      if (a.hasAttribute('data-open-tab')) { e.preventDefault(); selectTab('ct', a.getAttribute('data-open-tab')); go('contact'); history.pushState(null, '', '#contact'); return; }
      if (h === 'top' || D.getElementById(h)) { e.preventDefault(); if (h === 'top') { lenis ? lenis.scrollTo(0) : scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }); } else go(h, wasMenu); history.pushState(null, '', '#' + h); }
    }
  });
  D.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menuOpen) { menu(false); return; }
    var tab = e.target.closest && e.target.closest('[role=tab]');
    if (tab && /^(ArrowLeft|ArrowRight|Home|End)$/.test(e.key)) {
      var list = $$('[role=tab]', tab.parentNode), i = list.indexOf(tab);
      i = e.key === 'ArrowRight' ? (i + 1) % list.length : e.key === 'ArrowLeft' ? (i - 1 + list.length) % list.length : e.key === 'Home' ? 0 : list.length - 1;
      e.preventDefault(); selectTab(tab.closest('[data-tabs]').getAttribute('data-tabs'), list[i].getAttribute('data-tab'), true);
    }
  });
  D.addEventListener('submit', function (e) { var f = e.target.closest('form[data-netlify]'); if (f) { e.preventDefault(); submitForm(f); } });
  addEventListener('hashchange', function () { if (!PREVIEW) openFromHash(); });

  /* Admin preview */
  if (PREVIEW) {
    addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data) return;
      if (e.data.type === 'msco-preview') render(e.data.content, true);
      if (e.data.type === 'msco-goto') { var el = D.getElementById(e.data.id); if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - 64, behavior: 'auto' }); }
    });
    if (parent !== W) parent.postMessage({ type: 'msco-ready' }, location.origin);
  }

  /* Start */
  initLenis(); wire(); prepare(false); checkImgs(); applyHead(content);
  if (!PREVIEW) { openFromHash(); loadRemote(); }
})();
