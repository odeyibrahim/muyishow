/**
 * Content renderer.
 * Converts the site's content (JSON) into pages. The same file runs in Node (build step),
 * in the browser (live content updates) and in the admin preview, so all three always agree.
 *
 *   routes(content)                  -> every page of the site: { key, param, path }
 *   view(content, key, param, origin) -> one page: { title, description, app, schema, ... }
 *
 * Inline markup in content: *word* renders in italics; a line break is kept.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.MSCO_RENDER = api;
})(this, function () {
  'use strict';

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ih(s) { return esc(s).replace(/\*([^*\n]+)\*/g, '<em>$1</em>').replace(/\n/g, '<br>'); }
  function plain(s) { return String(s == null ? '' : s).replace(/\*/g, ''); }
  function arr(a) { return Array.isArray(a) ? a : []; }
  function asset(u) { u = String(u || '').trim(); return /^assets\//.test(u) ? '/' + u : u; }
  function safeUrl(u) { u = asset(u); return /^(https?:\/\/|\/|mailto:|tel:|#)/.test(u) ? u : ''; }
  function paras(a, cls) { return arr(a).filter(Boolean).map(function (p) { return '<p' + (cls ? ' class="' + cls + '"' : '') + '>' + ih(p) + '</p>'; }).join(''); }
  function isoDate(s) { var d = new Date(s + ' UTC'); return isNaN(d) ? '' : d.toISOString().slice(0, 10); }
  function slugify(s) { return plain(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70); }
  function trim(s, n) { s = plain(s).replace(/\s+/g, ' ').trim(); if (s.length <= n) return s; return s.slice(0, n).replace(/\s+\S*$/, '') + '…'; }
  function find(list, fn) { for (var i = 0; i < list.length; i++) if (fn(list[i], i)) return list[i]; return null; }

  /** A heading whose words are wrapped once, at build time, so the reveal needs no script-side splitting. */
  function heading(tag, s, cls, id) {
    var out = [], i = 0, em = false;
    String(s || '').split(/(\*)/).forEach(function (part) {
      if (part === '*') { em = !em; return; }
      part.split(/\s+/).forEach(function (w) {
        if (!w) return;
        out.push('<span class="wd" style="--d:' + Math.min(i * 55, 440) + 'ms"><i' + (em ? ' class="it"' : '') + '>' + esc(w) + '</i></span>');
        i++;
      });
    });
    return '<' + tag + (id ? ' id="' + id + '"' : '') + ' class="' + (cls ? cls + ' ' : '') + 'rt">' + out.join(' ') + '</' + tag + '>';
  }
  /** Stock photos are requested at a size that suits the screen, which keeps phones fast and scrolling smooth. */
  function srcset(u, sizes) {
    if (!/^https:\/\/images\.unsplash\.com\//.test(u) || !/[?&]w=\d+/.test(u)) return '';
    return ' srcset="' + [480, 800, 1200, 1800].map(function (w) { return esc(u.replace(/([?&]w=)\d+/, '$1' + w)) + ' ' + w + 'w'; }).join(', ') + '" sizes="' + (sizes || '(max-width:760px) 100vw, 50vw') + '"';
  }
  function img(src, alt, fb, extra) {
    var u = safeUrl(src);
    return '<img src="' + esc(u) + '"' + srcset(u) + ' alt="' + esc(alt || '') + '"' + (fb ? ' data-fb="' + fb + '"' : '') + ' loading="lazy" decoding="async"' + (extra || '') + '>';
  }
  function eyebrow(t) { return '<p class="k eb rv">' + esc(t) + '</p>'; }
  function section(id, cls, inner) {
    return '<section class="sect' + (cls ? ' ' + cls : '') + '" id="' + id + '" aria-labelledby="' + id + '-h">' + inner + '</section>';
  }

  /* ---------- fonts ---------- */
  var FONT_QS = {
    'Instrument Serif': 'Instrument+Serif:ital@0;1',
    'Newsreader': 'Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;1,6..72,300;1,6..72,400',
    'Source Serif 4': 'Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400',
    'Cormorant Garamond': 'Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400',
    'Playfair Display': 'Playfair+Display:ital,wght@0,400;1,400',
    'Instrument Sans': 'Instrument+Sans:wght@400;500',
    'Inter': 'Inter:wght@400;500'
  };
  function cleanName(n) { return String(n || '').replace(/[^\w \-]/g, '').trim(); }
  function customFonts(t) { return arr((t || {}).custom).filter(function (f) { return cleanName(f.name) && /^https:\/\//.test(f.url || ''); }); }
  function isCustom(t, name) { return customFonts(t).some(function (f) { return cleanName(f.name).toLowerCase() === name.toLowerCase(); }); }
  /** Google Fonts stylesheet address for the chosen families, or '' when both fonts are uploaded files. */
  function fontHref(t) {
    t = t || {}; var names = [cleanName(t.serif) || 'Instrument Serif', cleanName(t.sans) || 'Instrument Sans'], seen = {}, fam = [];
    names.forEach(function (n) { if (isCustom(t, n) || seen[n]) return; seen[n] = 1; fam.push('family=' + (FONT_QS[n] || n.replace(/ +/g, '+'))); });
    return fam.length ? 'https://fonts.googleapis.com/css2?' + fam.join('&') + '&display=swap' : '';
  }
  function fontFormat(u) { u = u.split('?')[0].toLowerCase(); return /\.woff2$/.test(u) ? 'woff2' : /\.woff$/.test(u) ? 'woff' : /\.otf$/.test(u) ? 'opentype' : 'truetype'; }
  /** Font variables, plus @font-face rules for any fonts uploaded in the editor. */
  function fontCss(t) {
    t = t || {}; var a = cleanName(t.serif) || 'Instrument Serif', b = cleanName(t.sans) || 'Instrument Sans';
    var faces = customFonts(t).map(function (f) { return "@font-face{font-family:'" + cleanName(f.name) + "';src:url('" + String(f.url).replace(/['\\\s]/g, '') + "') format('" + fontFormat(f.url) + "');font-display:swap}"; }).join('');
    return faces + ":root{--serif:'" + a + "',Georgia,serif;--sans:'" + b + "',system-ui,sans-serif}";
  }
  function fontLink(t) { var h = fontHref(t); return h ? '<link id="fonts" rel="stylesheet" href="' + esc(h) + '">' : ''; }

  /* ---------- routes ---------- */
  function slugs(c) {
    return {
      practice: arr((c.what || {}).featured).map(function (f) { return slugify(f.slug || f.h); }),
      counsel: arr((c.counsel || {}).items).map(function (x) { return slugify(x.slug || x.name); }),
      posts: arr((c.insights || {}).items).map(function (p) { return p.link ? '' : slugify(p.slug || p.id || p.title); }),
      offices: arr((c.offices || {}).items).map(function (o) { return slugify(o.slug || o.key || o.name); })
    };
  }
  function routes(c) {
    var s = slugs(c), r = [{ key: 'home', path: '/' }, { key: 'principal', path: '/principal/' }];
    s.practice.forEach(function (x) { r.push({ key: 'practice', param: x, path: '/practice/' + x + '/' }); });
    s.counsel.forEach(function (x) { r.push({ key: 'counsel', param: x, path: '/counsel/' + x + '/' }); });
    r.push({ key: 'insights', path: '/insights/' });
    s.posts.forEach(function (x) { if (x) r.push({ key: 'post', param: x, path: '/insights/' + x + '/' }); });
    s.offices.forEach(function (x) { r.push({ key: 'office', param: x, path: '/offices/' + x + '/' }); });
    r.push({ key: 'privacy', path: '/privacy/' });
    return r;
  }
  function pathOf(c, key, param) { var m = find(routes(c), function (r) { return r.key === key && (r.param || '') === (param || ''); }); return m ? m.path : '/'; }

  /* ---------- shared parts ---------- */
  var NAV = [['practice', 'Practice'], ['firm', 'The firm'], ['principal', 'Principal'], ['counsel', 'Of Counsel'], ['referral', 'Referral desk'], ['insights', 'Insights']];
  var ICON_CALL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>';

  /** base is '' on the home page (in-page anchors) and '/' elsewhere (links back to the home sections). */
  function header(c, base) {
    var s = c.site || {};
    var links = NAV.map(function (n) { return '<a href="' + base + '#' + n[0] + '" data-spy="' + n[0] + '">' + n[1] + '</a>'; }).join('');
    var menu = NAV.concat([['contact', 'Contact']]).map(function (n, i) { return '<a href="' + base + '#' + n[0] + '" style="--n:' + i + '"><span class="i">' + n[1] + '</span></a>'; }).join('');
    return '<header class="hd"><div class="w bar"><a class="logo" href="' + (base ? '/' : '#top') + '" aria-label="' + esc(s.name) + ', home"><span class="mk" aria-hidden="true"></span><span>' + esc(s.name) + '</span></a>' +
      '<nav class="dn" aria-label="Primary">' + links + '</nav>' +
      '<div class="hr"><a class="hp" href="tel:' + esc(s.tel) + '" aria-label="Call the firm on ' + esc(s.phone) + '">' + ICON_CALL + '<span>Call</span></a><a class="btn hc" href="' + base + '#contact">Contact</a>' +
      '<button class="mb" id="mb" type="button" aria-expanded="false" aria-controls="nv">Menu</button></div></div></header>' +
      '<nav id="nv" aria-label="Menu">' + menu + '<div class="nvs">' + esc(s.phone) + '<br><a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a></div></nav>';
  }

  function footer(c, base) {
    var s = c.site || {}, offs = arr((c.offices || {}).items), sl = slugs(c);
    var offCols = offs.map(function (x, i) {
      return '<div><p class="k">' + esc(x.role) + ' · ' + ih(x.name) + '</p><address>' + ih(x.address) + '</address><p class="fol"><a href="https://www.google.com/maps/search/?api=1&amp;query=' + encodeURIComponent(x.mapQuery || x.address) + '" target="_blank" rel="noopener">Directions<span class="sr"> to the ' + esc(plain(x.name)) + ' office (opens in a new tab)</span></a><a href="/offices/' + sl.offices[i] + '/">Office page</a></p></div>';
    }).join('');
    return '<footer class="ft"><div class="w"><div class="fg4">' +
      '<div class="fa"><a class="ftb" href="' + (base ? '/' : '#top') + '" aria-label="' + esc(s.name) + ', home"><span class="mk" aria-hidden="true"></span><span class="ffn">' + esc(s.name) + '</span></a><p class="ftt">' + esc(s.tagline) + '</p><p><a class="btn" href="' + base + '#contact">Send an enquiry</a></p></div>' +
      '<nav class="fc" aria-label="The firm"><p class="k">The firm</p><a href="' + base + '#firm">Legacy &amp; values</a><a href="/principal/">The Principal</a><a href="' + base + '#counsel">Of Counsel</a><a href="/insights/">Insights</a></nav>' +
      '<nav class="fc" aria-label="Our work"><p class="k">Our work</p><a href="' + base + '#practice">Practice areas</a><a href="' + base + '#referral">Referral desk</a><a href="' + base + '#contact">Offices</a><a href="' + base + '#contact">Contact</a></nav>' +
      '<div class="fc"><p class="k">Speak to us</p><a class="fbig" href="tel:' + esc(s.tel) + '">' + esc(s.phone) + '</a><a class="fbig" href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a></div></div>' +
      '<div class="fo">' + offCols + '</div>' +
      '<p class="fz">' + ih(s.disclaimer) + '</p><p class="fr"><span>© <span data-yr>' + new Date().getFullYear() + '</span> ' + esc(s.name) + (/\.$/.test(s.name || '') ? '' : '.') + ' All rights reserved.</span><span><a href="/privacy/">Privacy notice</a><a href="' + (base ? '/' : '#top') + '">Back to top</a></span></p></div></footer>' +
      '<nav class="dock" aria-label="Quick contact"><a href="tel:' + esc(s.tel) + '">' + ICON_CALL + 'Call</a><a class="dk2" href="' + base + '#contact">Send an enquiry</a></nav>';
  }

  function crumbs(list) {
    return '<nav class="bc" aria-label="Breadcrumb"><ol>' + list.map(function (b, i) {
      return '<li>' + (i < list.length - 1 ? '<a href="' + b[1] + '">' + esc(b[0]) + '</a>' : '<span aria-current="page">' + esc(b[0]) + '</span>') + '</li>';
    }).join('') + '</ol></nav>';
  }

  /** Top band of every inner page. */
  function pageHead(trail, eb, h1, lead) {
    return '<section class="ph-hero" aria-labelledby="top-h"><div class="w">' + crumbs(trail) + (eb ? '<p class="k eb">' + esc(eb) + '</p>' : '') + heading('h1', h1, 'big sub', 'top-h') + (lead ? '<p class="lead rv">' + ih(lead) + '</p>' : '') + '</div></section>';
  }

  /** Closing call to action on inner pages. */
  function cta(c, text) {
    var s = c.site || {};
    return '<section class="sect dark cta" aria-label="Contact"><div class="w cta-in"><div><h2 class="mini2h">Discuss a matter with us</h2><p class="lead2">' + ih(text || 'The principal reads every enquiry.') + '</p></div><div class="cta-a"><a class="btn" href="/#contact">Send an enquiry</a><p><a href="tel:' + esc(s.tel) + '">' + esc(s.phone) + '</a><br><a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a></p></div></div></section>';
  }

  /* ---------- home sections ---------- */
  function hero(c) {
    var h = c.hero || {};
    return '<section class="hero" id="top" aria-labelledby="top-h"><img class="hbg" src="' + esc(safeUrl(h.img)) + '" data-fb="hero" alt="" width="2000" height="1333" fetchpriority="high"><div class="w hin">' +
      heading('h1', h.title, 'big', 'top-h') + '<p class="lead rv">' + ih(h.lead) + '</p>' +
      '<div class="btns rv"><a class="btn" href="#practice">' + esc(h.cta1 || 'Practice areas') + '</a><a class="btn o" href="#contact">' + esc(h.cta2 || 'Contact') + '</a></div>' +
      '<p class="note hn rv">' + ih(h.note) + '</p></div></section>';
  }

  function facts(c) {
    return '<section class="facts" aria-label="The firm at a glance"><div class="w"><dl>' + arr(c.facts).map(function (f) {
      return '<div class="rv"><dt>' + esc(f.v) + '</dt><dd>' + ih(f.l) + '</dd></div>';
    }).join('') + '</dl></div></section>';
  }

  function practice(c) {
    var w = c.what || {}, p = c.practice || {}, items = arr(p.items), half = Math.ceil(items.length / 2), sl = slugs(c).practice;
    var cards = arr(w.featured).map(function (f, i) {
      return '<article class="fc2 rv"><span class="sn" aria-hidden="true">0' + (i + 1) + '</span><h3><a href="/practice/' + sl[i] + '/">' + ih(f.h) + '</a></h3><p class="prob">' + ih(f.prob) + '</p><p class="soft">' + ih(f.body) + '</p><p class="more-l"><a href="/practice/' + sl[i] + '/">Read more<span class="sr"> about ' + esc(plain(f.h)) + '</span></a></p></article>';
    }).join('');
    var col = function (list) {
      return '<div class="ac">' + list.map(function (it) { return '<details name="practice-area"><summary>' + ih(it.b) + '</summary><p>' + ih(it.s) + '</p></details>'; }).join('') + '</div>';
    };
    return section('practice', '', '<div class="w"><div class="sh"><div>' + eyebrow('Practice') + heading('h2', w.title, '', 'practice-h') + '</div><p class="soft rv">' + ih(w.intro) + '</p></div>' +
      '<div class="cards">' + cards + '</div>' +
      '<h3 class="mini rv">' + esc(p.title || 'All practice areas') + '</h3><div class="acc rv">' + col(items.slice(0, half)) + col(items.slice(half)) + '</div></div>');
  }

  function tabs(id, list) {
    var bar = list.map(function (t, i) {
      return '<button type="button" role="tab" id="' + id + '-t' + i + '" aria-controls="' + id + '-p' + i + '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '" data-tab="' + t.k + '">' + esc(t.label) + '</button>';
    }).join('');
    var panes = list.map(function (t, i) {
      return '<div role="tabpanel" class="pane" id="' + id + '-p' + i + '" aria-labelledby="' + id + '-t' + i + '" data-pane="' + t.k + '"' + (i ? ' hidden' : '') + '>' + t.html + '</div>';
    }).join('');
    return '<div class="tabs" data-tabs="' + id + '"><div class="tablist" role="tablist">' + bar + '</div>' + panes + '</div>';
  }

  function firm(c) {
    var f = c.firm || {}, l = f.legacy || {}, a = f.abuja || {}, v = f.values || {}, st = c.statement || {};
    var t = tabs('firm', [
      { k: 'legacy', label: l.tab || 'Legacy', html: '<h3>' + ih(l.title) + '</h3>' + (l.lead ? '<p class="lead2">' + ih(l.lead) + '</p>' : '') + paras(l.body) },
      { k: 'abuja', label: a.tab || 'Why Abuja', html: '<h3>' + ih(a.title) + '</h3>' + paras(a.body) },
      { k: 'values', label: v.tab || 'What we value', html: '<h3>' + ih(v.title) + '</h3><ul class="vals">' + arr(v.items).map(function (i) { return '<li><b>' + ih(i.b) + '</b><span>' + ih(i.s) + '</span></li>'; }).join('') + '</ul><p class="note">' + ih(v.note) + '</p>' }
    ]);
    return section('firm', 'dark', '<div class="w">' + eyebrow(f.title || 'The firm') +
      '<h2 id="firm-h" class="stmt rv">' + ih(st.text) + '</h2>' +
      '<div class="sp-g"><div class="sp-t rv">' + paras(st.body) + '</div>' + (st.img ? '<figure class="fig rv">' + img(st.img, st.alt, 'colo', ' width="600" height="750"') + '</figure>' : '') + '</div>' +
      '<div class="tw rv">' + t + '</div></div>');
  }

  function principal(c) {
    var p = c.principal || {}, b = arr(p.body);
    var head = eyebrow(p.title || 'The Principal') + heading('h2', p.name, '', 'principal-h') + '<p class="soft cr rv">' + ih(p.creds) + '</p>';
    var text = '<p class="lead2 rv">' + ih(p.lead) + '</p><div class="rv">' + paras(b.slice(0, 1)) + '<p class="more-l"><a href="/principal/">Read the full profile</a></p></div>';
    if (p.img) return section('principal', '', '<div class="w pr"><figure class="pf rv">' + img(p.img, p.alt, '', ' width="1400" height="1050"') + '</figure><div class="pt">' + head + text + '</div></div>');
    return section('principal', '', '<div class="w pr solo"><div class="pt">' + head + '</div><div class="pt">' + text + '</div></div>');
  }

  function counsel(c) {
    var k = c.counsel || {}, sl = slugs(c).counsel;
    var rows = arr(k.items).map(function (x, i) {
      return '<li class="rv"><a class="cr2" href="/counsel/' + sl[i] + '/">' + (x.img ? img(x.img, '', '', ' width="56" height="70"') : '') +
        '<span class="ct"><b>' + ih(x.name) + '</b><small>' + ih(x.areas) + '</small></span><span class="pl" aria-hidden="true">→</span></a></li>';
    }).join('');
    return section('counsel', 'tint', '<div class="w"><div class="sh"><div>' + eyebrow('Of Counsel') + heading('h2', k.title, '', 'counsel-h') + '</div><p class="soft rv">' + ih(k.intro) + '</p></div><ul class="cl" aria-label="Of Counsel">' + rows + '</ul></div>');
  }

  function process(c) {
    var p = c.process || {};
    return section('how', 'sand', '<div class="w"><div class="sh"><div>' + eyebrow('How we work') + heading('h2', p.title, '', 'how-h') + '</div><p class="soft rv">' + ih(p.intro) + '</p></div><ol class="eng">' +
      arr(p.steps).map(function (s, i) { return '<li class="rv"><span class="sn" aria-hidden="true">' + (i + 1) + '</span><h3>' + ih(s.h) + '</h3><p>' + ih(s.p) + '</p></li>'; }).join('') + '</ol></div>');
  }

  function postRows(c, limit) {
    var items = arr((c.insights || {}).items), sl = slugs(c).posts;
    return arr(items).slice(0, limit || items.length).map(function (p, i) {
      var dt = isoDate(p.date), when = dt ? '<time datetime="' + dt + '">' + esc(p.date) + '</time>' : esc(p.date);
      var inner = img(p.img, '', p.id, ' width="150" height="100"') + '<span class="pc"><small>' + when + (p.link ? ' · ' + esc(p.src || 'External') : '') + '</small><b>' + ih(p.title) + '</b></span>';
      return p.link ? '<li class="rv"><a class="po" href="' + esc(safeUrl(p.link)) + '" target="_blank" rel="noopener">' + inner + '<span class="sr"> (opens in a new tab)</span></a></li>'
        : '<li class="rv"><a class="po" href="/insights/' + sl[i] + '/">' + inner + '</a></li>';
    }).join('');
  }

  /** Insights as a large title on the dark stage with a framed ivory sheet; used on the home page and the index. */
  function insightsStage(c, full) {
    var n = c.insights || {};
    return '<section class="stage" id="insights" aria-labelledby="insights-h"><div class="w">' + heading(full ? 'h1' : 'h2', n.title || 'Insights', 'ins-t', 'insights-h') + '</div>' +
      '<div class="w"><div class="sheet"><p class="lead2 rv">' + ih(n.intro) + '</p><ul class="pl2" aria-label="Articles">' + postRows(c, full ? 0 : 3) + '</ul>' +
      (full ? '' : '<p class="rv"><a class="btn" href="/insights/">All insights</a></p>') + '</div></div></section>';
  }

  function referral(c) {
    var r = c.referral || {};
    return section('referral', 'dark', '<div class="w rf"><div>' + eyebrow('For foreign counsel') + heading('h2', r.title, '', 'referral-h') + '<p class="lead2 rv">' + ih(r.lead) + '</p><p class="rv">' + ih(r.body) + '</p>' +
      '<p class="rv"><a class="btn" href="#contact-referral" data-open-tab="referral">' + esc(r.cta || 'Submit a referral') + '</a> <a class="btn o" href="/practice/' + slugs(c).practice.slice(-1)[0] + '/">About the desk</a></p></div>' +
      '<ul class="ri">' + arr(r.items).map(function (i) { return '<li class="rv"><b>' + ih(i.b) + '</b><span>' + ih(i.s) + '</span></li>'; }).join('') + '</ul></div>');
  }

  function form(name, fields, btn, note) {
    var f = fields.map(function (x) {
      var ctl = x.t === 'ta' ? '<textarea name="' + x.n + '"' + (x.r ? ' required aria-required="true"' : '') + ' rows="4"></textarea>'
        : x.t === 'sel' ? '<select name="' + x.n + '">' + x.o.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select>'
        : '<input name="' + x.n + '" type="' + (x.t || 'text') + '"' + (x.r ? ' required aria-required="true"' : '') + ' autocomplete="' + (x.a || 'off') + '">';
      return '<label class="' + (x.w ? 'wide' : '') + '">' + x.l + ctl + '</label>';
    }).join('');
    return '<form name="' + name + '" method="POST" data-netlify="true" netlify-honeypot="bot-field" novalidate><input type="hidden" name="form-name" value="' + name + '">' +
      '<p class="hpot" aria-hidden="true"><label>Leave this empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p><div class="fg">' + f + '</div>' +
      '<button class="btn" type="submit">' + btn + '</button><p class="note">' + ih(note) + ' See our <a href="/privacy/">privacy notice</a>.</p><p class="fm" role="status" aria-live="polite"></p></form>';
  }

  function officeCard(c, x, i) {
    var q = encodeURIComponent(x.mapQuery || x.address), sl = slugs(c).offices;
    return '<article class="of"><div class="oi">' + img(x.img, x.alt, x.key, ' width="1000" height="563"') + '</div><div class="ot"><p class="k">' + esc(x.role) + '</p><h3><a href="/offices/' + sl[i] + '/">' + ih(x.name) + '</a></h3><address>' + ih(x.address) + '</address><p class="soft">' + ih(x.blurb) + '</p>' +
      '<p class="ol"><a class="btn o" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&amp;query=' + q + '" aria-label="Directions to the ' + esc(plain(x.name)) + ' office (opens in a new tab)">Directions</a>' +
      '<a class="btn o" href="/offices/' + sl[i] + '/" aria-label="About the ' + esc(plain(x.name)) + ' office">Office page</a></p></div></article>';
  }

  function contact(c) {
    var s = c.site || {}, k = c.contact || {}, o = c.offices || {};
    var enq = form('Enquiry', [
      { n: 'Name', l: 'Name', r: 1, a: 'name' }, { n: 'Phone', l: 'Phone', t: 'tel', a: 'tel' }, { n: 'Email', l: 'Email', t: 'email', r: 1, a: 'email', w: 1 },
      { n: 'Message', l: 'Your message', t: 'ta', r: 1, w: 1 }], 'Send enquiry', k.enquiryNote);
    var ref = form('Referral', [
      { n: 'Name', l: 'Name', r: 1, a: 'name' }, { n: 'Firm', l: 'Firm', r: 1, a: 'organization' }, { n: 'Email', l: 'Email', t: 'email', r: 1, a: 'email', w: 1 },
      { n: 'Jurisdiction', l: 'Jurisdiction' }, { n: 'Urgency', l: 'Urgency', t: 'sel', o: ['Routine', 'Time-sensitive', 'Urgent'] },
      { n: 'Matter', l: 'Matter summary', t: 'ta', r: 1, w: 1 }], 'Submit referral', k.referralNote);
    var t = tabs('ct', [{ k: 'enquiry', label: 'Enquiry', html: enq }, { k: 'referral', label: 'Referral desk', html: ref }]);
    var offs = arr(o.items).map(function (x, i) { return officeCard(c, x, i); }).join('');
    return section('contact', '', '<div class="w"><div class="ct2"><div>' + eyebrow('Contact') + heading('h2', k.title, '', 'contact-h') + '<p class="lead2 rv">' + ih(k.lead) + '</p>' +
      '<p class="cd rv"><a href="tel:' + esc(s.tel) + '">' + esc(s.phone) + '</a><br><a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a><br>' + esc(s.web) + '</p>' +
      '<p class="note rv">Foreign counsel: please use the Referral desk tab.</p></div><div class="rv">' + t + '</div></div>' +
      '<h3 class="mini rv">' + esc(o.title || 'Offices') + '</h3><div class="offs">' + offs + '</div></div>');
  }

  /* ---------- inner pages ---------- */
  function related(c, names) {
    var items = arr((c.practice || {}).items);
    return arr(names).map(function (n) { return find(items, function (it) { return plain(it.b).toLowerCase() === plain(n).toLowerCase(); }); }).filter(Boolean);
  }

  function practicePage(c, param) {
    var sl = slugs(c).practice, i = sl.indexOf(param), f = arr((c.what || {}).featured)[i];
    if (!f) return null;
    var rel = related(c, f.related), others = arr((c.what || {}).featured).map(function (x, j) { return j === i ? '' : '<li><a href="/practice/' + sl[j] + '/">' + ih(x.h) + '</a></li>'; }).join('');
    var body = pageHead([['Home', '/'], ['Practice', '/#practice'], [plain(f.h), '']], 'Practice · Nigeria', f.h, f.prob) +
      '<section class="sect"><div class="w art-g"><div class="art"><h2 class="mini2h2">What we do</h2><p class="lead2">' + ih(f.body) + '</p>' + paras(f.more) +
      (rel.length ? '<h2 class="mini2h2">Related areas of practice</h2><ul class="rel">' + rel.map(function (r) { return '<li><b>' + ih(r.b) + '</b><span>' + ih(r.s) + '</span></li>'; }).join('') + '</ul>' : '') + '</div>' +
      '<aside class="aside" aria-label="More from the practice"><p class="k">More from the practice</p><ul class="alist">' + others + '<li><a href="/#practice">All practice areas</a></li><li><a href="/principal/">The Principal</a></li><li><a href="/#counsel">Of Counsel</a></li></ul></aside></div></section>' +
      process(c) + cta(c, 'Tell us about your matter. ' + (((c.contact || {}).lead) || ''));
    return { app: body, title: f.seoTitle || plain(f.h) + ' in Nigeria | ' + (c.site || {}).name, description: f.seoDesc || trim(f.prob + ' ' + f.body, 155), trail: [['Home', '/'], ['Practice', '/#practice'], [plain(f.h), '']], type: 'practice', item: f };
  }

  function principalPage(c) {
    var p = c.principal || {}, seo = (c.seo || {}).principal || {};
    var body = pageHead([['Home', '/'], ['The Principal', '']], p.title || 'The Principal', p.name, p.creds) +
      '<section class="sect"><div class="w art-g"><div class="art">' + (p.img ? '<figure class="cfig wide">' + img(p.img, p.alt || p.name, '', ' width="1000" height="750"') + '</figure>' : '') + '<p class="lead2">' + ih(p.lead) + '</p>' + paras(p.body) + '</div>' +
      '<aside class="aside" aria-label="Related"><p class="k">The firm</p><ul class="alist"><li><a href="/#firm">Legacy &amp; values</a></li><li><a href="/#counsel">Of Counsel</a></li><li><a href="/#practice">Practice areas</a></li><li><a href="/insights/">Insights</a></li></ul></aside></div></section>' + cta(c);
    return { app: body, title: seo.title || plain(p.name) + ', Principal | ' + (c.site || {}).name, description: seo.description || trim(p.lead, 155), trail: [['Home', '/'], ['The Principal', '']], type: 'principal' };
  }

  function counselPage(c, param) {
    var sl = slugs(c).counsel, i = sl.indexOf(param), x = arr((c.counsel || {}).items)[i];
    if (!x) return null;
    var others = arr((c.counsel || {}).items).map(function (y, j) { return j === i ? '' : '<li><a href="/counsel/' + sl[j] + '/">' + ih(y.name) + '</a></li>'; }).join('');
    var body = pageHead([['Home', '/'], ['Of Counsel', '/#counsel'], [plain(x.name), '']], 'Of Counsel', x.name, x.areas) +
      '<section class="sect"><div class="w art-g"><div class="art">' + (x.img ? '<figure class="cfig">' + img(x.img, x.name, '', ' width="320" height="400"') + '</figure>' : '') + '<p class="lead2">' + ih(x.bio) + '</p>' + paras(x.full) + '</div>' +
      '<aside class="aside" aria-label="Of Counsel"><p class="k">Of Counsel</p><ul class="alist">' + others + '<li><a href="/#counsel">All Of Counsel</a></li><li><a href="/principal/">The Principal</a></li></ul></aside></div></section>' + cta(c);
    return { app: body, title: x.seoTitle || plain(x.name) + ', Of Counsel | ' + (c.site || {}).name, description: x.seoDesc || trim(x.areas + '. ' + x.bio, 155), trail: [['Home', '/'], ['Of Counsel', '/#counsel'], [plain(x.name), '']], type: 'counsel', item: x };
  }

  function insightsPage(c) {
    var seo = (c.seo || {}).insights || {};
    var body = '<div class="ins-top">' + crumbs([['Home', '/'], ['Insights', '']]) + '</div>' + insightsStage(c, true) + cta(c);
    return { app: body, title: seo.title || 'Insights | ' + (c.site || {}).name, description: seo.description || trim((c.insights || {}).intro, 155), trail: [['Home', '/'], ['Insights', '']], type: 'insights' };
  }

  function postPage(c, param) {
    var sl = slugs(c).posts, i = sl.indexOf(param), p = arr((c.insights || {}).items)[i];
    if (!p || p.link) return null;
    var more = arr((c.insights || {}).items).map(function (y, j) { return (j === i || y.link) ? '' : '<li><a href="/insights/' + sl[j] + '/">' + ih(y.title) + '</a></li>'; }).join('');
    var body = pageHead([['Home', '/'], ['Insights', '/insights/'], [trim(p.title, 48), '']], p.date, p.title, '') +
      '<section class="sect"><div class="w art-g"><article class="art">' + (p.img ? '<figure class="dfig">' + img(p.img, '', p.id, ' width="1000" height="600"') + '</figure>' : '') + paras(p.body) + '</article>' +
      '<aside class="aside" aria-label="More insights"><p class="k">More insights</p><ul class="alist">' + more + '<li><a href="/insights/">All insights</a></li></ul></aside></div></section>' + cta(c, 'Questions about this? Speak to the principal.');
    return { app: body, title: p.seoTitle || plain(p.title) + ' | ' + (c.site || {}).name, description: p.seoDesc || trim(arr(p.body)[0], 155), trail: [['Home', '/'], ['Insights', '/insights/'], [trim(p.title, 48), '']], type: 'post', item: p };
  }

  function officePage(c, param) {
    var sl = slugs(c).offices, i = sl.indexOf(param), x = arr((c.offices || {}).items)[i];
    if (!x) return null;
    var q = encodeURIComponent(x.mapQuery || x.address), s = c.site || {};
    var body = pageHead([['Home', '/'], ['Offices', '/#contact'], [plain(x.name), '']], x.role, plain(x.name) + ' office', x.blurb) +
      '<section class="sect"><div class="w art-g"><div class="art"><h2 class="mini2h2">Visit us</h2><address class="big-addr">' + ih(x.address) + '</address>' +
      '<p><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&amp;query=' + q + '">Get directions<span class="sr"> (opens in a new tab)</span></a></p>' +
      '<p>Call <a href="tel:' + esc(s.tel) + '">' + esc(s.phone) + '</a> or write to <a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a> to arrange a meeting.</p>' +
      '<div class="mapw"><iframe title="Map of the ' + esc(plain(x.name)) + ' office" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=' + q + '&amp;z=16&amp;output=embed"></iframe></div></div>' +
      '<aside class="aside" aria-label="Offices"><p class="k">Offices</p><ul class="alist">' + arr((c.offices || {}).items).map(function (y, j) { return j === i ? '' : '<li><a href="/offices/' + sl[j] + '/">' + ih(y.name) + ' office</a></li>'; }).join('') + '<li><a href="/#practice">Practice areas</a></li><li><a href="/principal/">The Principal</a></li></ul></aside></div></section>' + cta(c);
    return { app: body, title: x.seoTitle || 'Law Firm in ' + plain(x.name) + ' | ' + s.name, description: x.seoDesc || trim(x.blurb + ' ' + x.address, 155), trail: [['Home', '/'], ['Offices', '/#contact'], [plain(x.name), '']], type: 'office', item: x };
  }

  function privacyPage(c) {
    var v = c.privacy || {}, seo = (c.seo || {}).privacy || {};
    var body = pageHead([['Home', '/'], ['Privacy notice', '']], '', 'Privacy notice', v.updated) +
      '<section class="sect"><div class="w"><div class="art legal">' + arr(v.sections).map(function (s) { return '<h2 class="mini2h2">' + ih(s.h) + '</h2><p>' + ih(s.p) + '</p>'; }).join('') + '</div></div></section>';
    return { app: body, title: seo.title || 'Privacy notice | ' + (c.site || {}).name, description: seo.description || 'How ' + (c.site || {}).name + ' handles personal information.', trail: [['Home', '/'], ['Privacy notice', '']], type: 'privacy' };
  }

  function homePage(c) {
    var seo = (c.seo || {}).home || {}, s = c.site || {};
    var body = hero(c) + facts(c) + practice(c) + firm(c) + principal(c) + counsel(c) + referral(c) + process(c) + insightsStage(c, false) + contact(c);
    return { app: body, title: seo.title || s.title, description: seo.description || s.description, trail: [], type: 'home' };
  }

  /* ---------- structured data ---------- */
  function schema(c, v, path, origin) {
    var s = c.site || {}, o = arr((c.offices || {}).items), pr = c.principal || {}, sl = slugs(c);
    origin = (origin || s.origin || '').replace(/\/$/, '');
    var FIRM = origin + '/#firm', url = origin + path;
    var firm = {
      '@type': 'LegalService', '@id': FIRM, name: s.name, url: origin + '/', description: s.description, email: s.email, telephone: s.phone,
      logo: origin + '/assets/img/icon-512.png', image: origin + '/assets/img/og-share.png', areaServed: { '@type': 'Country', name: 'Nigeria' },
      knowsAbout: arr((c.practice || {}).items).map(function (i) { return plain(i.b); }),
      founder: { '@id': origin + '/principal/#person' },
      location: o.map(function (x, i) { return { '@type': 'LegalService', name: s.name + ', ' + plain(x.name), url: origin + '/offices/' + sl.offices[i] + '/', address: { '@type': 'PostalAddress', streetAddress: String(x.address || '').replace(/\n/g, ', '), addressLocality: plain(x.name), addressCountry: 'NG' } }; }),
      contactPoint: { '@type': 'ContactPoint', contactType: 'enquiries', telephone: s.phone, email: s.email, areaServed: 'NG', availableLanguage: 'English' }
    };
    if (arr(s.sameAs).length) firm.sameAs = arr(s.sameAs);
    var g = [firm, { '@type': 'WebSite', '@id': origin + '/#site', url: origin + '/', name: s.name, inLanguage: 'en-NG', publisher: { '@id': FIRM } }];
    var person = function (name, title, id, extra) { var p = { '@type': 'Person', '@id': id, name: plain(name), jobTitle: title, worksFor: { '@id': FIRM } }; for (var k in extra) p[k] = extra[k]; return p; };
    if (v.type === 'principal') g.push({ '@type': 'ProfilePage', '@id': url + '#page', url: url, name: v.title, mainEntity: { '@id': url + '#person' } }, person(pr.name, 'Principal', url + '#person', { description: plain(pr.lead), alumniOf: [{ '@type': 'CollegeOrUniversity', name: 'Cardiff University' }, { '@type': 'CollegeOrUniversity', name: 'University of Essex' }] }));
    else g.push(person(pr.name, 'Principal', origin + '/principal/#person', { url: origin + '/principal/' }));
    if (v.type === 'counsel') g.push(person(v.item.name, 'Of Counsel', url + '#person', { url: url, description: plain(v.item.areas) }));
    if (v.type === 'practice') g.push({ '@type': 'Service', '@id': url + '#service', name: plain(v.item.h), serviceType: plain(v.item.h), description: plain(v.item.prob + ' ' + v.item.body), provider: { '@id': FIRM }, areaServed: { '@type': 'Country', name: 'Nigeria' }, url: url });
    if (v.type === 'post') g.push({ '@type': 'Article', '@id': url + '#article', headline: plain(v.item.title), datePublished: isoDate(v.item.date) || undefined, inLanguage: 'en-NG', mainEntityOfPage: url, author: { '@id': FIRM }, publisher: { '@id': FIRM }, image: /^https?:/.test(v.item.img || '') ? v.item.img : origin + '/assets/img/og-share.png', description: v.description });
    if (v.type === 'office') g.push({ '@type': 'LegalService', '@id': url + '#office', name: s.name + ', ' + plain(v.item.name), url: url, telephone: s.phone, email: s.email, parentOrganization: { '@id': FIRM }, hasMap: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(v.item.mapQuery || v.item.address), address: { '@type': 'PostalAddress', streetAddress: String(v.item.address || '').replace(/\n/g, ', '), addressLocality: plain(v.item.name), addressCountry: 'NG' } });
    if (v.type === 'insights') g.push({ '@type': 'CollectionPage', '@id': url + '#page', url: url, name: v.title, hasPart: arr((c.insights || {}).items).map(function (p, i) { return p.link ? null : { '@type': 'Article', headline: plain(p.title), url: origin + '/insights/' + sl.posts[i] + '/' }; }).filter(Boolean) });
    if (v.trail && v.trail.length > 1) g.push({ '@type': 'BreadcrumbList', itemListElement: v.trail.map(function (b, i) { return { '@type': 'ListItem', position: i + 1, name: b[0], item: b[1] ? origin + (b[1] === '/' ? '/' : b[1]) : url }; }) });
    return '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@graph': g }).replace(/</g, '\\u003c') + '</script>';
  }

  /* ---------- public API ---------- */
  var BUILDERS = { home: homePage, principal: principalPage, practice: practicePage, counsel: counselPage, insights: insightsPage, post: postPage, office: officePage, privacy: privacyPage };

  /** One complete page: markup for #app plus the title, description and structured data for the <head>. */
  function view(c, key, param, origin) {
    var v = (BUILDERS[key] || homePage)(c, param);
    if (!v) { key = 'home'; param = ''; v = homePage(c); }
    var base = key === 'home' ? '' : '/', path = pathOf(c, key, param);
    v.app = header(c, base) + '<main id="main" tabindex="-1">' + v.app + '</main>' + footer(c, base);
    v.path = path; v.key = key; v.param = param || '';
    v.ld = schema(c, v, path, origin);
    return v;
  }

  return { esc: esc, ih: ih, plain: plain, routes: routes, view: view, fontHref: fontHref, fontCss: fontCss, fontLink: fontLink, slugify: slugify, NAV: NAV };
});
