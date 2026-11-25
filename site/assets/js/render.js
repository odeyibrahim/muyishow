/* Turns content (JSON) into HTML. Shared by the build script (Node), the live site and the admin preview,
   so all three always agree. No dependencies. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.MSCO_RENDER = api;
})(this, function () {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* *word* becomes italic; line breaks kept */
  function ih(s) { return esc(s).replace(/\*([^*\n]+)\*/g, '<em>$1</em>').replace(/\n/g, '<br>'); }
  function plain(s) { return String(s == null ? '' : s).replace(/\*/g, ''); }
  function arr(a) { return Array.isArray(a) ? a : []; }
  function safeUrl(u) { u = String(u || '').trim(); return /^(https?:\/\/|assets\/|\/|mailto:|tel:|#)/.test(u) ? u : ''; }
  function paras(a, cls) { return arr(a).filter(Boolean).map(function (p) { return '<p' + (cls ? ' class="' + cls + '"' : '') + '>' + ih(p) + '</p>'; }).join(''); }

  /* Headline: each word wrapped once, at build time, so there is nothing to split (and nothing to clash) at run time. */
  function title(tag, s, cls) {
    var out = [], i = 0, em = false;
    String(s || '').split(/(\*)/).forEach(function (part) {
      if (part === '*') { em = !em; return; }
      part.split(/\s+/).forEach(function (w) {
        if (!w) return;
        out.push('<span class="wd" style="--d:' + Math.min(i * 55, 440) + 'ms"><i' + (em ? ' class="it"' : '') + '>' + esc(w) + '</i></span>');
        i++;
      });
    });
    return '<' + tag + ' class="' + (cls ? cls + ' ' : '') + 'rt">' + out.join(' ') + '</' + tag + '>';
  }

  function img(src, alt, fb, extra) {
    return '<img src="' + esc(safeUrl(src)) + '" alt="' + esc(alt || '') + '"' + (fb ? ' data-fb="' + fb + '"' : '') + ' loading="lazy" decoding="async"' + (extra || '') + '>';
  }

  var FONT_QS = {
    'Instrument Serif': 'Instrument+Serif:ital@0;1', 'Newsreader': 'Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;1,6..72,300;1,6..72,400',
    'Source Serif 4': 'Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400', 'Cormorant Garamond': 'Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400',
    'Playfair Display': 'Playfair+Display:ital,wght@0,400;1,400', 'Instrument Sans': 'Instrument+Sans:wght@400;500', 'Inter': 'Inter:wght@400;500'
  };
  function clean(n) { return String(n || '').replace(/[^\w \-]/g, '').trim(); }
  function fontHref(t) {
    t = t || {}; var a = clean(t.serif) || 'Instrument Serif', b = clean(t.sans) || 'Instrument Sans';
    var q = function (n) { return FONT_QS[n] || n.replace(/ +/g, '+'); };
    return 'https://fonts.googleapis.com/css2?family=' + q(a) + (q(a) !== q(b) ? '&family=' + q(b) : '') + '&display=swap';
  }
  function fontCss(t) {
    t = t || {}; var a = clean(t.serif) || 'Instrument Serif', b = clean(t.sans) || 'Instrument Sans';
    return ":root{--serif:'" + a + "',Georgia,serif;--sans:'" + b + "',system-ui,sans-serif}";
  }

  var NAV = [['practice', 'Practice'], ['firm', 'The firm'], ['principal', 'Principal'], ['counsel', 'Of Counsel'], ['insights', 'Insights'], ['referral', 'Referral desk']];
  var ICON_CALL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>';

  function header(c) {
    var s = c.site || {};
    var links = NAV.map(function (n) { return '<a href="#' + n[0] + '" data-spy="' + n[0] + '">' + n[1] + '</a>'; }).join('');
    var menu = NAV.concat([['contact', 'Contact']]).map(function (n, i) { return '<a href="#' + n[0] + '" style="--n:' + i + '"><span class="i">' + n[1] + '</span></a>'; }).join('');
    return '<header class="hd"><div class="w bar"><a class="logo" href="#top" aria-label="' + esc(s.name) + ', home"><span class="mk" aria-hidden="true"></span><span>' + esc(s.name) + '</span></a>' +
      '<nav class="dn" aria-label="Primary">' + links + '</nav>' +
      '<div class="hr"><a class="hp" href="tel:' + esc(s.tel) + '" aria-label="Call the firm on ' + esc(s.phone) + '">' + ICON_CALL + '<span>Call</span></a><a class="btn hc" href="#contact">Contact</a>' +
      '<button class="mb" id="mb" type="button" aria-expanded="false" aria-controls="nv">Menu</button></div></div></header>' +
      '<nav id="nv" aria-label="Menu">' + menu + '<div class="nvs">' + esc(s.phone) + '<br><a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a></div></nav>';
  }

  function hero(c) {
    var h = c.hero || {};
    return '<section class="hero" id="top"><img class="hbg" src="' + esc(safeUrl(h.img)) + '" data-fb="hero" alt="" fetchpriority="high"><div class="w hin">' +
      title('h1', h.title, 'big') + '<p class="lead rv">' + ih(h.lead) + '</p>' +
      '<div class="btns rv"><a class="btn" href="#practice">' + esc(h.cta1 || 'Practice areas') + '</a><a class="btn o" href="#contact">' + esc(h.cta2 || 'Contact') + '</a></div>' +
      '<p class="note hn rv">' + ih(h.note) + '</p></div></section>';
  }

  function facts(c) {
    return '<section class="facts" aria-label="At a glance"><div class="w"><dl>' + arr(c.facts).map(function (f) {
      return '<div class="rv"><dt>' + esc(f.v) + '</dt><dd>' + ih(f.l) + '</dd></div>';
    }).join('') + '</dl></div></section>';
  }

  function practice(c) {
    var w = c.what || {}, p = c.practice || {};
    var cards = arr(w.featured).map(function (f, i) {
      return '<article class="fc2 rv"><span class="sn">0' + (i + 1) + '</span><h3>' + ih(f.h) + '</h3><p class="prob">' + ih(f.prob) + '</p><p class="soft">' + ih(f.body) + '</p></article>';
    }).join('');
    var acc = arr(p.items).map(function (it) {
      return '<details name="pa"><summary><span>' + ih(it.b) + '</span></summary><p>' + ih(it.s) + '</p></details>';
    }).join('');
    return '<section class="sect" id="practice"><div class="w"><div class="sh">' + title('h2', w.title) + '<p class="soft rv">' + ih(w.intro) + '</p></div>' +
      '<div class="cards">' + cards + '</div>' +
      '<h3 class="mini rv">' + esc(p.title || 'All practice areas') + '</h3><div class="acc rv">' + acc + '</div></div></section>';
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
    return '<section class="sect dark" id="firm"><div class="w"><div class="sp"><div><p class="stmt rt-s rv">' + ih(st.text) + '</p><div class="sp-t rv">' + paras(st.body) + '</div></div>' +
      (st.img ? '<figure class="fig rv">' + img(st.img, st.alt, 'colo') + '</figure>' : '') + '</div>' +
      '<div class="tw rv"><h2 class="mini2">' + esc(f.title || 'The firm') + '</h2>' + t + '</div></div></section>';
  }

  function principal(c) {
    var p = c.principal || {}, b = arr(p.body);
    var first = b.slice(0, 1), rest = b.slice(1);
    return '<section class="sect" id="principal"><div class="w pr"><figure class="pf rv">' + img(p.img, p.alt, '') + '</figure><div class="pt">' +
      '<p class="k rv">' + esc(p.title || 'The Principal') + '</p>' + title('h2', p.name) + '<p class="soft cr rv">' + ih(p.creds) + '</p><p class="lead2 rv">' + ih(p.lead) + '</p>' +
      '<div class="rv">' + paras(first) + (rest.length ? '<details class="more"><summary><span class="mo">Read more</span><span class="ml">Show less</span></summary>' + paras(rest) + '</details>' : '') + '</div></div></div></section>';
  }

  function counsel(c) {
    var k = c.counsel || {};
    var rows = arr(k.items).map(function (x, i) {
      return '<li class="rv"><button type="button" class="cr2" data-dlg="counsel:' + i + '">' + img(x.img, x.name, '', ' width="56" height="70"') +
        '<span class="ct"><b>' + ih(x.name) + '</b><small>' + ih(x.areas) + '</small></span><span class="pl" aria-hidden="true">+</span></button></li>';
    }).join('');
    return '<section class="sect tint" id="counsel"><div class="w"><div class="sh">' + title('h2', k.title) + '<p class="soft rv">' + ih(k.intro) + '</p></div><ul class="cl">' + rows + '</ul></div></section>';
  }

  function process(c) {
    var p = c.process || {};
    return '<section class="sect sand" id="how"><div class="w"><div class="sh">' + title('h2', p.title) + '<p class="soft rv">' + ih(p.intro) + '</p></div><ol class="eng">' +
      arr(p.steps).map(function (s, i) { return '<li class="rv"><span class="sn">' + (i + 1) + '</span><h3>' + ih(s.h) + '</h3><p>' + ih(s.p) + '</p></li>'; }).join('') + '</ol></div></section>';
  }

  function insights(c) {
    var n = c.insights || {};
    var rows = arr(n.items).map(function (p, i) {
      var inner = img(p.img, '', p.id, ' width="150" height="100"') + '<span class="pc"><small>' + esc(p.date) + (p.link ? ' · ' + esc(p.src || 'External') : '') + '</small><b>' + ih(p.title) + '</b></span>';
      return p.link ? '<li class="rv"><a class="po" href="' + esc(safeUrl(p.link)) + '" target="_blank" rel="noopener">' + inner + '</a></li>'
        : '<li class="rv"><button type="button" class="po" data-dlg="post:' + i + '">' + inner + '</button></li>';
    }).join('');
    return '<section class="sect" id="insights"><div class="w"><div class="sh">' + title('h2', n.title) + '<p class="soft rv">' + ih(n.intro) + '</p></div><ul class="pl2">' + rows + '</ul></div></section>';
  }

  function referral(c) {
    var r = c.referral || {};
    return '<section class="sect dark" id="referral"><div class="w rf"><div>' + title('h2', r.title) + '<p class="lead2 rv">' + ih(r.lead) + '</p><p class="rv">' + ih(r.body) + '</p>' +
      '<p class="rv"><a class="btn" href="#contact-referral" data-open-tab="referral">' + esc(r.cta || 'Submit a referral') + '</a></p></div>' +
      '<ul class="ri">' + arr(r.items).map(function (i) { return '<li class="rv"><b>' + ih(i.b) + '</b><span>' + ih(i.s) + '</span></li>'; }).join('') + '</ul></div></section>';
  }

  function form(name, fields, btn, note, nl) {
    var f = fields.map(function (x) {
      var ctl = x.t === 'ta' ? '<textarea name="' + x.n + '"' + (x.r ? ' required' : '') + ' rows="4"></textarea>'
        : x.t === 'sel' ? '<select name="' + x.n + '">' + x.o.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select>'
        : '<input name="' + x.n + '" type="' + (x.t || 'text') + '"' + (x.r ? ' required' : '') + ' autocomplete="' + (x.a || 'off') + '">';
      return '<label class="' + (x.w ? 'wide' : '') + '">' + x.l + ctl + '</label>';
    }).join('');
    return '<form name="' + name + '" method="POST" data-netlify="true" netlify-honeypot="bot-field" novalidate><input type="hidden" name="form-name" value="' + name + '">' +
      '<p class="hpot" aria-hidden="true"><label>Leave empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p><div class="fg">' + f + '</div>' +
      '<button class="btn" type="submit">' + btn + '</button><p class="note">' + ih(note) + ' See our <a href="#privacy">privacy notice</a>.</p><p class="fm" role="status"></p></form>';
  }

  function contact(c) {
    var s = c.site || {}, k = c.contact || {}, o = c.offices || {}, r = c.referral || {};
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
      return '<article class="of"><div class="oi">' + img(x.img, x.alt, x.key) + '</div><div class="ot"><p class="k">' + esc(x.role) + '</p><h3>' + ih(x.name) + '</h3><p>' + ih(x.address) + '</p><p class="soft">' + ih(x.blurb) + '</p>' +
        '<p class="ol"><a class="btn o" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&amp;query=' + q + '">Directions</a><button type="button" class="btn o" data-map="' + q + '" data-title="' + esc(x.name) + '">Map</button></p></div></article>';
    }).join('');
    return '<section class="sect" id="contact"><div class="w"><div class="ct2"><div>' + title('h2', k.title) + '<p class="lead2 rv">' + ih(k.lead) + '</p>' +
      '<p class="cd rv"><a href="tel:' + esc(s.tel) + '">' + esc(s.phone) + '</a><br><a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a><br>' + esc(s.web) + '</p>' +
      '<p class="note rv">Foreign counsel: use the Referral desk tab.</p></div><div class="rv">' + t + '</div></div>' +
      '<h3 class="mini rv">' + esc(o.title || 'Offices') + '</h3><div class="offs">' + offs + '</div></div></section>';
  }

  function footer(c) {
    var s = c.site || {};
    return '<footer class="ft"><div class="w"><div class="fa"><a class="ftb" href="#top"><span class="mk" aria-hidden="true"></span><span class="ffn">' + esc(s.name) + '</span></a>' +
      '<p class="ftt">' + esc(s.tagline) + '</p><p class="fl"><a href="tel:' + esc(s.tel) + '">' + esc(s.phone) + '</a><a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a></p></div>' +
      '<p class="fz">' + ih(s.disclaimer) + '</p><p class="fr"><span>© <span data-yr>' + new Date().getFullYear() + '</span> ' + esc(s.name) + '. All rights reserved.</span><span><a href="#privacy">Privacy notice</a><a href="#top">Back to top</a></span></p></div></footer>' +
      '<div class="dock" aria-label="Quick contact"><a href="tel:' + esc(s.tel) + '">' + ICON_CALL + 'Call</a><a class="dk2" href="#contact">Send an enquiry</a></div>';
  }

  function page(c) {
    return header(c) + '<main id="main">' + hero(c) + facts(c) + practice(c) + firm(c) + principal(c) + counsel(c) + process(c) + insights(c) + referral(c) + contact(c) + '</main>' + footer(c);
  }

  /* Content of the pop-up dialog, by kind */
  function dialog(c, kind, i) {
    if (kind === 'counsel') {
      var x = arr((c.counsel || {}).items)[i]; if (!x) return '';
      return '<div class="dc">' + img(x.img, x.name, '', ' width="96" height="120"') + '<div><h3>' + ih(x.name) + '</h3><p class="k">' + ih(x.areas) + '</p></div></div><p>' + ih(x.bio) + '</p>' + (arr(x.full).length ? '<h4>Full profile</h4>' + paras(x.full) : '');
    }
    if (kind === 'post') {
      var p = arr((c.insights || {}).items)[i]; if (!p) return '';
      return '<p class="k">' + esc(p.date) + '</p><h3>' + ih(p.title) + '</h3>' + (p.img ? '<figure class="dfig">' + img(p.img, '', p.id) + '</figure>' : '') + paras(p.body);
    }
    if (kind === 'privacy') {
      var v = c.privacy || {};
      return '<h3>Privacy notice</h3><p class="soft">' + esc(v.updated) + '</p>' + arr(v.sections).map(function (s) { return '<h4>' + ih(s.h) + '</h4><p>' + ih(s.p) + '</p>'; }).join('');
    }
    if (kind === 'map') return '';
    return '';
  }

  function jsonld(c) {
    var s = c.site || {}, o = arr((c.offices || {}).items);
    var d = { '@context': 'https://schema.org', '@type': 'LegalService', name: s.name, url: s.origin, email: s.email, telephone: s.tel,
      address: o.map(function (x) { return { '@type': 'PostalAddress', streetAddress: x.address, addressCountry: 'NG' }; }) };
    return '<script type="application/ld+json">' + JSON.stringify(d).replace(/</g, '\\u003c') + '</script>';
  }

  return { esc: esc, ih: ih, plain: plain, page: page, dialog: dialog, fontHref: fontHref, fontCss: fontCss, jsonld: jsonld, NAV: NAV };
});
