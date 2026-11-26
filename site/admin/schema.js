/* Describes every editable section, so the editor forms are generated rather than hand-built.
   t = text | long | paras (blank line between paragraphs) | image | group | list. */
window.MSCO_SCHEMA = (function () {
  var T = function (k, l, h) { return { k: k, l: l, t: 'text', h: h }; };
  var L = function (k, l, h) { return { k: k, l: l, t: 'long', h: h }; };
  var P = function (k, l, h) { return { k: k, l: l, t: 'paras', h: h || 'Leave a blank line between paragraphs.' }; };
  var I = function (k, l) { return { k: k, l: l, t: 'image' }; };
  var G = function (k, l, f) { return { k: k, l: l, t: 'group', f: f }; };
  var LS = function (k, l, f, lab, noun, h) { return { k: k, l: l, t: 'list', f: f, lab: lab, noun: noun, h: h }; };
  var EM = 'Put *asterisks* around words to set them in italics.';
  return [
    { k: 'site', label: 'Firm details', go: 'top', f: [T('name', 'Firm name'), T('tagline', 'Tagline (footer)'), T('phone', 'Phone, as shown'), T('tel', 'Phone, for dialling', 'No spaces, with country code. Example: +2348134548298'), T('email', 'Email'), T('web', 'Website address, as shown'), T('origin', 'Full website address', 'Used for search engines. Example: https://www.example.com'), T('title', 'Browser tab title'), L('description', 'Search engine description'), L('disclaimer', 'Footer disclaimer')] },
    { k: 'theme', label: 'Fonts', go: 'top', f: [T('serif', 'Headline font', 'Any name from fonts.google.com, typed exactly. Suggestions: Instrument Serif, Newsreader, Cormorant Garamond, Playfair Display, Source Serif 4'), T('sans', 'Body font', 'Suggestions: Instrument Sans, Inter, Source Serif 4')] },
    { k: 'hero', label: 'Top of the page', go: 'top', f: [T('title', 'Headline', EM), L('lead', 'Opening paragraph'), L('note', 'Smaller line (hidden on phones)'), T('cta1', 'First button'), T('cta2', 'Second button'), I('img', 'Background photo')] },
    { k: 'facts', label: 'Key facts', go: 'top', root: 'list', f: [T('v', 'Figure'), L('l', 'Caption')], lab: 'v', noun: 'fact' },
    { k: 'what', label: 'What we do (cards)', go: 'practice', f: [T('title', 'Heading'), L('intro', 'Introduction'), LS('featured', 'Featured areas', [T('h', 'Name'), L('prob', 'The problem, in one line'), L('body', 'What we do')], 'h', 'area')] },
    { k: 'practice', label: 'All practice areas', go: 'practice', f: [T('title', 'Heading'), LS('items', 'Areas', [T('b', 'Name'), L('s', 'Description')], 'b', 'area')] },
    { k: 'statement', label: 'Big statement', go: 'firm', f: [L('text', 'Statement', EM), P('body', 'Supporting paragraphs (optional)'), I('img', 'Photo (wide screens only)'), T('alt', 'Photo description')] },
    { k: 'firm', label: 'The firm (tabs)', go: 'firm', f: [T('title', 'Small heading'), G('legacy', 'Tab 1', [T('tab', 'Tab label'), T('title', 'Heading'), L('lead', 'Opening paragraph'), P('body', 'Paragraphs')]), G('abuja', 'Tab 2', [T('tab', 'Tab label'), T('title', 'Heading'), P('body', 'Paragraphs')]), G('values', 'Tab 3', [T('tab', 'Tab label'), T('title', 'Heading'), LS('items', 'Values', [T('b', 'Name'), L('s', 'Description')], 'b', 'value'), L('note', 'Footnote')])] },
    { k: 'principal', label: 'The Principal', go: 'principal', f: [T('title', 'Small heading'), T('name', 'Name'), T('creds', 'Qualifications'), L('lead', 'Opening paragraph'), P('body', 'Paragraphs', 'The first paragraph shows; the rest sit behind "Read more" on the page.'), I('img', 'Photo (optional; none is shown until one is added)'), T('alt', 'Photo description')] },
    { k: 'counsel', label: 'Of Counsel', go: 'counsel', f: [T('title', 'Heading'), L('intro', 'Introduction'), LS('items', 'People', [T('name', 'Name'), L('areas', 'Areas of practice'), L('bio', 'Short profile'), P('full', 'Full profile (optional)', 'Opens when the visitor taps the name.'), I('img', 'Portrait (optional)')], 'name', 'person')] },
    { k: 'process', label: 'How an engagement runs', go: 'how', f: [T('title', 'Heading'), L('intro', 'Introduction'), LS('steps', 'Steps', [T('h', 'Step'), L('p', 'Description')], 'h', 'step')] },
    { k: 'insights', label: 'Insights', go: 'insights', f: [T('title', 'Heading'), L('intro', 'Introduction'), LS('items', 'Posts', [T('id', 'Short name for the link', 'Letters and numbers only, no spaces. Example: tax-regime'), T('date', 'Date shown'), L('title', 'Title'), I('img', 'Photo'), P('body', 'Post text'), T('link', 'Link to another site (optional)', 'If you fill this in, the post opens that site instead of showing the text.'), T('src', 'Name of that site (optional)')], 'title', 'post')] },
    { k: 'referral', label: 'Referral desk', go: 'referral', f: [T('title', 'Heading'), L('lead', 'Opening line'), L('body', 'Paragraph'), T('cta', 'Button'), LS('items', 'What we offer', [T('b', 'Name'), L('s', 'Description')], 'b', 'item')] },
    { k: 'offices', label: 'Offices', go: 'contact', f: [T('title', 'Heading'), LS('items', 'Offices', [T('key', 'Short name', 'Used for the fallback picture: abuja or abeokuta.'), T('name', 'City'), T('role', 'Role'), L('address', 'Address'), T('mapQuery', 'Address for the map'), L('blurb', 'Short description'), I('img', 'Photo'), T('alt', 'Photo description')], 'name', 'office')] },
    { k: 'contact', label: 'Contact', go: 'contact', f: [T('title', 'Heading'), L('lead', 'Introduction'), L('enquiryNote', 'Note under the enquiry form'), L('referralNote', 'Note under the referral form')] },
    { k: 'privacy', label: 'Privacy notice', go: null, f: [T('updated', 'Last updated line'), LS('sections', 'Sections', [T('h', 'Heading'), L('p', 'Text')], 'h', 'section')] }
  ];
})();
