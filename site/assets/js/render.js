/**
 * Content renderer.
 * Converts the site's content (JSON) into HTML. The same file runs in Node (build step),
 * in the browser (live content updates) and in the admin preview, so all three always agree.
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
  function safeUrl(u) { u = String(u || '').trim(); return /^(https?:\/\/|assets\/|\/|mailto:|tel:|#)/.test(u) ? u : ''; }
  function paras(a, cls) { return arr(a).filter(Boolean).map(function (p) { return '<p' + (cls ? ' class="' + cls + '"' : '') + '>' + ih(p) + '</p>'; }).join(''); }
  function isoDate(s) { var d = new Date(s + ' UTC'); return isNaN(d) ? '' : d.toISOString().slice(0, 10); }

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

  function img(src, alt, fb, extra) {
    return '<img src="' + esc(safeUrl(src)) + '" alt="' + esc(alt || '') + '"' + (fb ? ' data-fb="' + fb + '"' : '') + ' loading="lazy" decoding="async"' + (extra || '') + '>';
  }

  function eyebrow(t) { return '<p class="k eb rv">' + esc(t) + '</p>'; }

  /** Wraps a block of content in a labelled landmark. The heading inside must carry id="<id>-h". */
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
  function fontHref(t) {
    t = t || {}; var a = cleanName(t.serif) || 'Instrument Serif', b = cleanName(t.sans) || 'Instrument Sans';
    var q = function (n) { return FONT_QS[n] || n.replace(/ +/g, '+'); };
    return 'https://fonts.googleapis.com/css2?family=' + q(a) + (q(a) !== q(b) ? '&family=' + q(b) : '') + '&display=swap';
  }
  function fontCss(t) {
    t = t || {}; var a = cleanName(t.serif) || 'Instrument Serif', b = cleanName(t.sans) || 'Instrument Sans';
    return ":root{--serif:'" + a + "',Georgia,serif;--sans:'" + b + "',system-ui,sans-serif}";
  }

  /* ---------- page parts ---------- */
  var NAV = [['practice', 'Practice'], ['firm', 'The firm'], ['principal', 'Principal'], ['counsel', 'Of Counsel'], ['insights', 'Insights'], ['referral', 'Referral desk']];
  var ICON_CALL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>';

  function header(c) {
    var s = c.site || {};
    var links = NAV.map(function (n) { return '<a href="#' + n[0] + '" data-spy="' + n[0] + '">' + n[1] + '</a>'; }).join('');
    var menu = NAV.concat([['contact', 'Contact']]).map(function (n, i) { return '<a href="#' + n[0] + '" style="--n:' + i + '"><span class="i">' + n[1] + '</span></a>'; }).join('');
    return '<header class="hd"><div class="w bar"><a class="logo" href="#top" aria-label="' + esc(s.name) + ', back to top"><span class="mk" aria-hidden="true"></span><span>' + esc(s.name) + '</span></a>' +
      '<nav class="dn" aria-label="Primary">' + links + '</nav>' +
      '<div class="hr"><a class="hp" href="tel:' + esc(s.tel) + '" aria-label="Call the firm on ' + esc(s.phone) + '">' + ICON_CALL + '<span>Call</span></a><a class="btn hc" href="#contact">Contact</a>' +
      '<button class="mb" id="mb" type="button" aria-expanded="false" aria-controls="nv">Menu</button></div></div></header>' +
      '<nav id="nv" aria-label="Menu">' + menu + '<div class="nvs">' + esc(s.phone) + '<br><a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a></div></nav>';
  }

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
    var w = c.what || {}, p = c.practice || {}, items = arr(p.items), half = Math.ceil(items.length / 2);
    var cards = arr(w.featured).map(function (f, i) {
      return '<article class="fc2 rv"><span class="sn" aria-hidden="true">0' + (i + 1) + '</span><h3>' + ih(f.h) + '</h3><p class="prob">' + ih(f.prob) + '</p><p class="soft">' + ih(f.body) + '</p></article>';
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
      { k: 'legacy', label: l.tab || 'Legacy', html: '<h3>' + ih(l.title) + '</h3><p class="lead2">' + ih(l.lead) + '</p>' + paras(l.body) },
      { k: 'abuja', label: a.tab || 'Why Abuja', html: '<h3>' + ih(a.title) + '</h3>' + paras(a.body) },
      { k: 'values', label: v.tab || 'What we value', html: '<h3>' + ih(v.title) + '</h3><ul class="vals">' + arr(v.items).map(function (i) { return '<li><b>' + ih(i.b) + '</b><span>' + ih(i.s) + '</span></li>'; }).join('') + '</ul><p class="note">' + ih(v.note) + '</p>' }
    ]);
    return section('firm', 'dark', '<div class="w">' + eyebrow(f.title || 'The firm') +
      '<div class="sp"><div><h2 id="firm-h" class="stmt rv">' + ih(st.text) + '</h2>' + (arr(st.body).length ? '<div class="sp-t rv">' + paras(st.body) + '</div>' : '') + '</div>' +
      (st.img ? '<figure class="fig rv">' + img(st.img, st.alt, 'colo', ' width="600" height="750"') + '</figure>' : '') + '</div>' +
      '<div class="tw rv">' + t + '</div></div>');
  }

  function principal(c) {
    var p = c.principal || {}, b = arr(p.body), rest = b.slice(1);
    var head = eyebrow(p.title || 'The Principal') + heading('h2', p.name, '', 'principal-h') + '<p class="soft cr rv">' + ih(p.creds) + '</p>';
    var text = '<p class="lead2 rv">' + ih(p.lead) + '</p><div class="rv">' + paras(b.slice(0, 1)) +
      (rest.length ? '<details class="more"><summary><span class="mo">Read more</span><span class="ml">Show less</span></summary>' + paras(rest) + '</details>' : '') + '</div>';
    if (p.img) return section('principal', '', '<div class="w pr"><figure class="pf rv">' + img(p.img, p.alt, '', ' width="1400" height="1050"') + '</figure><div class="pt">' + head + text + '</div></div>');
    return section('principal', '', '<div class="w pr solo"><div class="pt">' + head + '</div><div class="pt">' + text + '</div></div>');
  }

  function counsel(c) {
    var k = c.counsel || {};
    var rows = arr(k.items).map(function (x, i) {
      return '<li class="rv"><button type="button" class="cr2" data-dlg="counsel:' + i + '" aria-haspopup="dialog">' + (x.img ? img(x.img, '', '', ' width="56" height="70"') : '') +
        '<span class="ct"><b>' + ih(x.name) + '</b><small>' + ih(x.areas) + '</small></span><span class="pl" aria-hidden="true">+</span><span class="sr">Read profile</span></button></li>';
    }).join('');
    return section('counsel', 'tint', '<div class="w"><div class="sh"><div>' + eyebrow('Of Counsel') + heading('h2', k.title, '', 'counsel-h') + '</div><p class="soft rv">' + ih(k.intro) + '</p></div><ul class="cl" aria-label="Of Counsel">' + rows + '</ul></div>');
  }

  function process(c) {
    var p = c.process || {};
    return section('how', 'sand', '<div class="w"><div class="sh"><div>' + eyebrow('How we work') + heading('h2', p.title, '', 'how-h') + '</div><p class="soft rv">' + ih(p.intro) + '</p></div><ol class="eng">' +
      arr(p.steps).map(function (s, i) { return '<li class="rv"><span class="sn" aria-hidden="true">' + (i + 1) + '</span><h3>' + ih(s.h) + '</h3><p>' + ih(s.p) + '</p></li>'; }).join('') + '</ol></div>');
  }

  function insights(c) {
    var n = c.insights || {};
    var rows = arr(n.items).map(function (p, i) {
      var dt = isoDate(p.date), when = dt ? '<time datetime="' + dt + '">' + esc(p.date) + '</time>' : esc(p.date);
      var inner = img(p.img, '', p.id, ' width="150" height="100"') + '<span class="pc"><small>' + when + (p.link ? ' · ' + esc(p.src || 'External') : '') + '</small><b>' + ih(p.title) + '</b></span>';
      return p.link ? '<li class="rv"><a class="po" href="' + esc(safeUrl(p.link)) + '" target="_blank" rel="noopener">' + inner + '<span class="sr"> (opens in a new tab)</span></a></li>'
        : '<li class="rv"><button type="button" class="po" data-dlg="post:' + i + '" aria-haspopup="dialog">' + inner + '</button></li>';
    }).join('');
    return section('insights', '', '<div class="w"><div class="sh"><div>' + eyebrow('Insights') + heading('h2', n.title, '', 'insights-h') + '</div><p class="soft rv">' + ih(n.intro) + '</p></div><ul class="pl2" aria-label="Articles">' + rows + '</ul></div>');
  }

  function referral(c) {
    var r = c.referral || {};
    return section('referral', 'dark', '<div class="w rf"><div>' + eyebrow('For foreign counsel') + heading('h2', r.title, '', 'referral-h') + '<p class="lead2 rv">' + ih(r.lead) + '</p><p class="rv">' + ih(r.body) + '</p>' +
      '<p class="rv"><a class="btn" href="#contact-referral" data-open-tab="referral">' + esc(r.cta || 'Submit a referral') + '</a></p></div>' +
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
      '<button class="btn" type="submit">' + btn + '</button><p class="note">' + ih(note) + ' See our <a href="#privacy">privacy notice</a>.</p><p class="fm" role="status" aria-live="polite"></p></form>';
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
    var offs = arr(o.items).map(function (x) {
      var q = encodeURIComponent(x.mapQuery || x.address);
      return '<article class="of"><div class="oi">' + img(x.img, x.alt, x.key, ' width="1000" height="563"') + '</div><div class="ot"><p class="k">' + esc(x.role) + '</p><h3>' + ih(x.name) + '</h3><address>' + ih(x.address) + '</address><p class="soft">' + ih(x.blurb) + '</p>' +
        '<p class="ol"><a class="btn o" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&amp;query=' + q + '" aria-label="Directions to the ' + esc(plain(x.name)) + ' office (opens in a new tab)">Directions</a>' +
        '<button type="button" class="btn o" data-map="' + q + '" data-title="' + esc(plain(x.name)) + '" aria-haspopup="dialog" aria-label="Show the ' + esc(plain(x.name)) + ' office on a map">Map</button></p></div></article>';
    }).join('');
    return section('contact', '', '<div class="w"><div class="ct2"><div>' + eyebrow('Contact') + heading('h2', k.title, '', 'contact-h') + '<p class="lead2 rv">' + ih(k.lead) + '</p>' +
      '<p class="cd rv"><a href="tel:' + esc(s.tel) + '">' + esc(s.phone) + '</a><br><a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a><br>' + esc(s.web) + '</p>' +
      '<p class="note rv">Foreign counsel: please use the Referral desk tab.</p></div><div class="rv">' + t + '</div></div>' +
      '<h3 class="mini rv">' + esc(o.title || 'Offices') + '</h3><div class="offs">' + offs + '</div></div>');
  }

  function footer(c) {
    var s = c.site || {};
    return '<footer class="ft"><div class="w"><div class="fa"><a class="ftb" href="#top" aria-label="' + esc(s.name) + ', back to top"><span class="mk" aria-hidden="true"></span><span class="ffn">' + esc(s.name) + '</span></a>' +
      '<p class="ftt">' + esc(s.tagline) + '</p><p class="fl"><a href="tel:' + esc(s.tel) + '">' + esc(s.phone) + '</a><a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a></p></div>' +
      '<p class="fz">' + ih(s.disclaimer) + '</p><p class="fr"><span>© <span data-yr>' + new Date().getFullYear() + '</span> ' + esc(s.name) + '. All rights reserved.</span><span><a href="#privacy">Privacy notice</a><a href="#top">Back to top</a></span></p></div></footer>' +
      '<nav class="dock" aria-label="Quick contact"><a href="tel:' + esc(s.tel) + '">' + ICON_CALL + 'Call</a><a class="dk2" href="#contact">Send an enquiry</a></nav>';
  }

  function page(c) {
    return header(c) + '<main id="main" tabindex="-1">' + hero(c) + facts(c) + practice(c) + firm(c) + principal(c) + counsel(c) + process(c) + insights(c) + referral(c) + contact(c) + '</main>' + footer(c);
  }

  /** Content of the pop-up dialog. kind: counsel | post | privacy */
  function dialog(c, kind, i) {
    if (kind === 'counsel') {
      var x = arr((c.counsel || {}).items)[i]; if (!x) return '';
      return '<div class="dc">' + (x.img ? img(x.img, '', '', ' width="84" height="105"') : '') + '<div><h3 id="dlg-t">' + ih(x.name) + '</h3><p class="k">' + ih(x.areas) + '</p></div></div><p>' + ih(x.bio) + '</p>' + (arr(x.full).length ? '<h4>Full profile</h4>' + paras(x.full) : '');
    }
    if (kind === 'post') {
      var p = arr((c.insights || {}).items)[i]; if (!p) return '';
      return '<p class="k">' + esc(p.date) + '</p><h3 id="dlg-t">' + ih(p.title) + '</h3>' + (p.img ? '<figure class="dfig">' + img(p.img, '', p.id) + '</figure>' : '') + paras(p.body);
    }
    if (kind === 'privacy') {
      var v = c.privacy || {};
      return '<h3 id="dlg-t">Privacy notice</h3><p class="soft">' + esc(v.updated) + '</p>' + arr(v.sections).map(function (s) { return '<h4>' + ih(s.h) + '</h4><p>' + ih(s.p) + '</p>'; }).join('');
    }
    return '';
  }

  /** schema.org structured data, so search engines can show the firm, its offices and practice areas. */
  function jsonld(c, origin) {
    var s = c.site || {}, o = arr((c.offices || {}).items), pr = c.principal || {};
    origin = (origin || s.origin || '').replace(/\/$/, '');
    var org = {
      '@type': 'LegalService', '@id': origin + '/#firm', name: s.name, url: origin + '/', description: s.description,
      email: s.email, telephone: s.phone, logo: origin + '/assets/img/icon-512.png', image: origin + '/assets/img/og-share.png', areaServed: { '@type': 'Country', name: 'Nigeria' },
      knowsAbout: arr((c.practice || {}).items).map(function (i) { return plain(i.b); }),
      founder: { '@type': 'Person', name: plain(pr.name), jobTitle: 'Principal' },
      location: o.map(function (x) {
        return { '@type': 'LegalService', name: s.name + ', ' + plain(x.name), address: { '@type': 'PostalAddress', streetAddress: String(x.address || '').replace(/\n/g, ', '), addressLocality: plain(x.name), addressCountry: 'NG' } };
      }),
      contactPoint: { '@type': 'ContactPoint', contactType: 'enquiries', telephone: s.phone, email: s.email, areaServed: 'NG', availableLanguage: 'English' }
    };
    var site = { '@type': 'WebSite', '@id': origin + '/#site', url: origin + '/', name: s.name, inLanguage: 'en-NG', publisher: { '@id': origin + '/#firm' } };
    return '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@graph': [org, site] }).replace(/</g, '\\u003c') + '</script>';
  }

  return { esc: esc, ih: ih, plain: plain, page: page, dialog: dialog, fontHref: fontHref, fontCss: fontCss, jsonld: jsonld, NAV: NAV };
});
