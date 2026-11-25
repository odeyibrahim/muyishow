/**
 * Staff editor (served at /admin).
 * Shares no code with the public site except the content renderer, which powers the live preview.
 * Every action is enforced again by Supabase row-level security, so this page holds no secrets.
 */
(function () {
  'use strict';
  var D = document, W = window;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || D).querySelectorAll(s)); };
  var CFG = W.MSCO_CONFIG || {}, DEF = W.MSCO_DEFAULT || {}, S = W.MSCO_SCHEMA || [];
  var clone = function (o) { return o == null ? o : JSON.parse(JSON.stringify(o)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var sb = null, me = null, role = null, cur = 'hero', saved = {}, data = {}, dirty = {}, hasRow = {}, team = null, prevReady = false;
  var inviteFlow = /type=(invite|recovery)/.test(location.hash);

  function show(id) { ['boot', 'login', 'setpw', 'ed'].forEach(function (x) { $('#' + x).hidden = x !== id; }); }
  function toast(m, ms) { var t = $('#toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(function () { t.style.display = 'none'; }, ms || 3800); }
  function say(id, m, ok) { var e = $(id); e.textContent = m || ''; e.className = 'msg' + (ok ? ' ok' : ''); }

  /* Start */
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || !W.supabase) {
    $('#boot').innerHTML = '<div class="card"><h1>Not connected yet</h1><p>' + (W.supabase ? 'The site has no Supabase address yet. Set SUPABASE_URL and SUPABASE_ANON_KEY in Netlify and redeploy (see README.md).' : 'The sign-in library could not load. Check your connection and refresh.') + '</p></div>';
    return;
  }
  sb = W.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'PASSWORD_RECOVERY') { inviteFlow = true; show('setpw'); } if (ev === 'SIGNED_OUT') { show('login'); } });
  sb.auth.getSession().then(function (r) {
    var s = r.data && r.data.session;
    if (!s) return show('login');
    if (inviteFlow) { show('setpw'); return; }
    enter(s.user);
  });

  /* Sign in */
  $('#lf').addEventListener('submit', function (e) {
    e.preventDefault(); say('#l-m', 'Signing in…', true);
    sb.auth.signInWithPassword({ email: $('#l-e').value.trim(), password: $('#l-p').value }).then(function (r) {
      if (r.error) return say('#l-m', r.error.message === 'Invalid login credentials' ? 'That email and password do not match.' : r.error.message);
      say('#l-m', ''); enter(r.data.user);
    });
  });
  $('#l-f').addEventListener('click', function () {
    var em = $('#l-e').value.trim(); if (!em) return say('#l-m', 'Type your email above first, then press this again.');
    sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + '/admin' }).then(function (r) { say('#l-m', r.error ? r.error.message : 'If that email is on the staff list, a reset link is on its way.', !r.error); });
  });
  $('#pf').addEventListener('submit', function (e) {
    e.preventDefault(); var a = $('#p-1').value, b = $('#p-2').value;
    if (a.length < 8) return say('#p-m', 'Use at least 8 characters.'); if (a !== b) return say('#p-m', 'The two passwords differ.');
    sb.auth.updateUser({ password: a }).then(function (r) {
      if (r.error) return say('#p-m', r.error.message);
      inviteFlow = false; history.replaceState(null, '', location.pathname); sb.auth.getUser().then(function (u) { enter(u.data.user); });
    });
  });
  $('#b-out').addEventListener('click', function () { if (anyDirty() && !confirm('You have unsaved changes. Sign out anyway?')) return; sb.auth.signOut(); });

  /* After sign in */
  function enter(user) {
    me = user;
    sb.from('staff').select('role,email').eq('user_id', user.id).maybeSingle().then(function (r) {
      if (r.error || !r.data) { show('login'); say('#l-m', 'This account is not on the staff list. Ask an administrator to add it.'); sb.auth.signOut(); return; }
      role = r.data.role; $('#who').textContent = user.email + ' · ' + (role === 'admin' ? 'administrator' : 'staff');
      return sb.from('site_content').select('key,value').then(function (c) {
        if (c.error) { show('login'); say('#l-m', 'Could not load the content: ' + c.error.message); return; }
        saved = {}; hasRow = {}; (c.data || []).forEach(function (x) { saved[x.key] = x.value; hasRow[x.key] = true; });
        S.forEach(function (s) { data[s.k] = clone(saved[s.k] != null ? saved[s.k] : DEF[s.k]); });
        buildNav(); show('ed'); choose(cur); sendPreview();
      });
    });
  }

  /* Navigation */
  function secOf(k) { return S.filter(function (s) { return s.k === k; })[0]; }
  function anyDirty() { return Object.keys(dirty).some(function (k) { return dirty[k]; }); }
  function buildNav() {
    var items = S.map(function (s) { return [s.k, s.label]; }); if (role === 'admin') items.push(['__team', 'Team and logins']);
    $('#sel').innerHTML = items.map(function (i) { return '<option value="' + i[0] + '">' + esc(i[1]) + '</option>'; }).join('');
    $('#nav').innerHTML = items.map(function (i) { return (i[0] === '__team' ? '<hr>' : '') + '<button type="button" data-k="' + i[0] + '">' + esc(i[1]) + '</button>'; }).join('');
  }
  $('#nav').addEventListener('click', function (e) { var b = e.target.closest('button[data-k]'); if (b) choose(b.getAttribute('data-k')); });
  $('#sel').addEventListener('change', function () { choose(this.value); });
  function mark() { $$('#nav button').forEach(function (b) { var k = b.getAttribute('data-k'); b.classList.toggle('on', k === cur); b.classList.toggle('dot', !!dirty[k]); }); $('#sel').value = cur; }

  function choose(k) {
    cur = k; mark();
    if (k === '__team') { $('#ptitle').textContent = 'Team and logins'; $('.acts').hidden = true; return renderTeam(); }
    $('.acts').hidden = false; var s = secOf(k); $('#ptitle').textContent = s.label; renderForm(); state();
    if (s.go) post({ type: 'msco-goto', id: s.go });
  }
  function state() {
    var e = $('#state'), d = dirty[cur];
    e.textContent = d ? 'Unsaved changes' : hasRow[cur] ? 'Published' : 'Original text (not edited yet)'; e.className = 'state' + (d ? ' dirty' : '');
    $('#b-sv').disabled = !d; $('#b-rv').disabled = !d; mark();
  }

  /* Form generation */
  function get(obj, path) { return path === '' ? obj : path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj); }
  function put(obj, path, v) { var p = path.split('.'), o = obj; for (var i = 0; i < p.length - 1; i++) { if (o[p[i]] == null) o[p[i]] = {}; o = o[p[i]]; } o[p[p.length - 1]] = v; }
  function join(a, b) { return a === '' ? String(b) : a + '.' + b; }
  function blank(fields) { var o = {}; fields.forEach(function (f) { o[f.k] = f.t === 'paras' ? [] : f.t === 'group' ? blank(f.f) : f.t === 'list' ? [] : ''; }); return o; }

  function fieldHtml(f, val, path) {
    var id = 'f' + Math.random().toString(36).slice(2, 8), p = esc(path), h = f.h ? '<span class="hint">' + esc(f.h) + '</span>' : '';
    if (f.t === 'text') return '<label class="fld">' + esc(f.l) + h + '<input data-p="' + p + '" data-t="text" value="' + esc(val) + '"' + (f.k === 'serif' || f.k === 'sans' ? ' list="fonts"' : '') + '></label>';
    if (f.t === 'long') return '<label class="fld">' + esc(f.l) + h + '<textarea data-p="' + p + '" data-t="text" rows="3">' + esc(val) + '</textarea></label>';
    if (f.t === 'paras') return '<label class="fld">' + esc(f.l) + h + '<textarea data-p="' + p + '" data-t="paras" rows="7">' + esc((val || []).join('\n\n')) + '</textarea></label>';
    if (f.t === 'image') return '<div class="fld"><span class="l">' + esc(f.l) + '</span><div class="img"><img data-pv="' + p + '" src="' + esc(val || '') + '" alt="" onerror="this.style.visibility=\'hidden\'" onload="this.style.visibility=\'visible\'"><div class="c"><input data-p="' + p + '" data-t="text" value="' + esc(val) + '" placeholder="Address of a picture, or upload one"><input type="file" accept="image/*" data-up="' + p + '" id="' + id + '"></div></div></div>';
    if (f.t === 'group') return '<div class="grp"><span class="l">' + esc(f.l) + '</span>' + f.f.map(function (g) { return fieldHtml(g, get(val || {}, g.k), join(path, g.k)); }).join('') + '</div>';
    if (f.t === 'list') return listHtml(f, val || [], path);
    return '';
  }
  function listHtml(f, arr, path) {
    var p = esc(path), noun = f.noun || 'item';
    var items = arr.map(function (it, i) {
      var label = (f.lab && it && it[f.lab]) ? String(it[f.lab]).replace(/\*/g, '').slice(0, 70) : noun + ' ' + (i + 1);
      return '<details class="it"' + (arr.length <= 3 ? ' open' : '') + '><summary><span class="n">' + esc(label) + '</span>' +
        '<button type="button" class="ib" data-act="up" data-p="' + p + '" data-i="' + i + '" aria-label="Move up">↑</button><button type="button" class="ib" data-act="dn" data-p="' + p + '" data-i="' + i + '" aria-label="Move down">↓</button><button type="button" class="ib" data-act="del" data-p="' + p + '" data-i="' + i + '" aria-label="Delete">✕</button></summary>' +
        '<div class="body">' + f.f.map(function (g) { return fieldHtml(g, it[g.k], join(path, i + '.' + g.k)); }).join('') + '</div></details>';
    }).join('');
    return '<div class="lst">' + (f.l ? '<span class="l">' + esc(f.l) + '</span>' : '') + (f.h ? '<span class="hint">' + esc(f.h) + '</span>' : '') + items + '<button type="button" class="sm" data-act="add" data-p="' + p + '">+ Add ' + esc(noun) + '</button></div>';
  }
  function renderForm() {
    var s = secOf(cur), y = scrollY, html;
    if (s.root === 'list') html = listHtml({ f: s.f, lab: s.lab, noun: s.noun, l: '' }, data[cur] || [], '');
    else html = s.f.map(function (f) { return fieldHtml(f, get(data[cur] || {}, f.k), f.k); }).join('');
    $('#form').innerHTML = html + '<datalist id="fonts"><option>Instrument Serif</option><option>Newsreader</option><option>Cormorant Garamond</option><option>Playfair Display</option><option>Source Serif 4</option><option>Instrument Sans</option><option>Inter</option></datalist>';
    scrollTo(0, y);
  }

  function change(k) { dirty[k] = true; state(); sendPreviewSoon(); }
  $('#form').addEventListener('input', function (e) {
    var el = e.target, p = el.getAttribute('data-p'); if (p == null || el.type === 'file') return;
    var v = el.value; if (el.getAttribute('data-t') === 'paras') v = v.split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (cur && secOf(cur).root === 'list' && p !== '') put(data[cur], p, v); else put(data[cur], p, v);
    var im = el.closest('.img'); if (im) { var pv = $('img', im); pv.src = v; }
    change(cur);
  });
  $('#form').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var act = b.getAttribute('data-act'), p = b.getAttribute('data-p'), i = +b.getAttribute('data-i');
    var s = secOf(cur), arr, fields;
    if (p === '' ) { arr = data[cur]; fields = s.f; }
    else { arr = get(data[cur], p); fields = findList(s.f, p.replace(/\.\d+\./g, '.').replace(/^\d+\./, '')); if (!arr) { arr = []; put(data[cur], p, arr); } }
    if (act === 'add') arr.push(blank(fields || []));
    if (act === 'del') { if (!confirm('Delete this entry?')) return; arr.splice(i, 1); }
    if (act === 'up' && i > 0) { var t = arr[i]; arr[i] = arr[i - 1]; arr[i - 1] = t; }
    if (act === 'dn' && i < arr.length - 1) { var u = arr[i]; arr[i] = arr[i + 1]; arr[i + 1] = u; }
    change(cur); renderForm();
  });
  function findList(fields, path) {
    var parts = path.split('.'), f = fields, node = null;
    for (var i = 0; i < parts.length; i++) { node = f.filter(function (x) { return x.k === parts[i]; })[0]; if (!node) return null; f = node.f || []; }
    return node && node.f;
  }

  /* Images */
  function shrink(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader(); r.onerror = rej;
      r.onload = function () {
        var i = new Image(); i.onerror = rej;
        i.onload = function () {
          var s = Math.min(1, 1800 / Math.max(i.width, i.height)), c = D.createElement('canvas'); c.width = Math.round(i.width * s); c.height = Math.round(i.height * s);
          c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); c.toBlob(function (b) { b ? res(b) : rej(); }, 'image/jpeg', 0.84);
        }; i.src = r.result;
      }; r.readAsDataURL(file);
    });
  }
  $('#form').addEventListener('change', function (e) {
    var el = e.target, p = el.getAttribute && el.getAttribute('data-up'); if (!p || !el.files[0]) return;
    toast('Uploading…', 15000);
    shrink(el.files[0]).then(function (blob) {
      var path = cur + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '.jpg';
      return sb.storage.from('site-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false }).then(function (r) {
        if (r.error) throw r.error; var url = sb.storage.from('site-images').getPublicUrl(path).data.publicUrl;
        put(data[cur], p, url); change(cur); renderForm(); toast('Picture added. Remember to save.');
      });
    }).catch(function (err) { toast('Upload failed: ' + ((err && err.message) || 'could not read that picture')); });
  });

  /* Save / undo / reset */
  $('#b-sv').addEventListener('click', function () {
    var k = cur, btn = this; btn.disabled = true; btn.textContent = 'Saving…';
    sb.from('site_content').upsert({ key: k, value: data[k] }).then(function (r) {
      btn.textContent = 'Save and publish';
      if (r.error) { btn.disabled = false; return toast('Not saved: ' + r.error.message, 7000); }
      saved[k] = clone(data[k]); hasRow[k] = true; dirty[k] = false; state(); toast('Saved. It is live on the site now.');
    });
  });
  $('#b-rv').addEventListener('click', function () { data[cur] = clone(saved[cur] != null ? saved[cur] : DEF[cur]); dirty[cur] = false; renderForm(); state(); sendPreview(); });
  $('#b-df').addEventListener('click', function () { if (!confirm('Put the original wording back for this section? You can still undo before saving.')) return; data[cur] = clone(DEF[cur]); dirty[cur] = true; renderForm(); state(); sendPreview(); });
  addEventListener('beforeunload', function (e) { if (anyDirty()) { e.preventDefault(); e.returnValue = ''; } });

  /* Preview */
  function post(m) { var f = $('#pv'); if (f && f.contentWindow && prevReady) f.contentWindow.postMessage(m, location.origin); }
  function sendPreview() { var c = clone(DEF); Object.keys(data).forEach(function (k) { c[k] = clone(data[k]); }); c._built = 'preview'; post({ type: 'msco-preview', content: c }); }
  var tmr; function sendPreviewSoon() { clearTimeout(tmr); tmr = setTimeout(sendPreview, 350); }
  addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.type === 'msco-ready') { prevReady = true; sendPreview(); var s = secOf(cur); if (s && s.go) post({ type: 'msco-goto', id: s.go }); } });
  $('#b-pv').addEventListener('click', function () { $('#prev').classList.add('open'); sendPreview(); });
  $('#pv-x').addEventListener('click', function () { $('#prev').classList.remove('open'); });
  $('.pbar').addEventListener('click', function (e) { var b = e.target.closest('[data-w]'); if (!b) return; $$('.pbar [data-w]').forEach(function (x) { x.classList.toggle('on', x === b); }); $('#prev').setAttribute('data-w', b.getAttribute('data-w')); });
  $('#prev').setAttribute('data-w', 'phone');

  /* Rebuild (optional) */
  function fn(name, body) {
    return sb.auth.getSession().then(function (r) {
      var t = r.data.session && r.data.session.access_token;
      return fetch('/.netlify/functions/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body || {}) })
        .then(function (x) { return x.json().catch(function () { return {}; }).then(function (j) { if (!x.ok) throw new Error(j.error || ('Error ' + x.status)); return j; }); });
    });
  }
  $('#b-rb').addEventListener('click', function () {
    if (anyDirty() && !confirm('You have unsaved changes, which will not be included. Continue?')) return;
    fn('rebuild').then(function () { toast('Refreshing. This takes about a minute and changes nothing visitors see.'); }).catch(function (e) { toast(e.message, 6000); });
  });

  /* Team (administrators only) */
  function renderTeam() {
    $('#form').innerHTML = '<p class="hint">Staff sign in at this address with their email and password. Administrators can also manage this list.</p><div class="team" id="tl">Loading…</div>';
    fn('staff', { action: 'list' }).then(function (j) { team = j.staff || []; drawTeam(); }).catch(function (e) { $('#tl').innerHTML = '<p class="msg">' + esc(e.message) + '</p><p class="hint">This panel needs the Netlify functions and the SUPABASE_SERVICE_ROLE_KEY setting (see README.md).</p>'; });
  }
  function drawTeam() {
    var rows = team.map(function (t) {
      var self = me && t.user_id === me.id;
      return '<div class="trow" data-u="' + esc(t.user_id) + '"><span class="e">' + esc(t.email) + (self ? ' (you)' : '') + '</span>' +
        '<select data-a="role"' + (self ? ' disabled' : '') + '><option value="staff"' + (t.role === 'staff' ? ' selected' : '') + '>Staff</option><option value="admin"' + (t.role === 'admin' ? ' selected' : '') + '>Administrator</option></select>' +
        '<button class="sm" data-a="pw" type="button">New password</button>' + (self ? '' : '<button class="sm" data-a="rm" type="button">Remove</button>') + '</div>';
    }).join('');
    $('#tl').innerHTML = rows + '<form class="addbox" id="addf" autocomplete="off"><h3>Add someone</h3><label>Email<input id="a-e" type="email" required></label><label>Starting password<input id="a-p" type="text" minlength="8" required><span class="hint">At least 8 characters. Tell them in person or by phone, and ask them to change it after signing in.</span></label>' +
      '<label>Access<select id="a-r"><option value="staff">Staff: can edit the site</option><option value="admin">Administrator: can also manage the team</option></select></label><p class="msg" id="a-m"></p><button class="btn" type="submit">Add to team</button></form>';
  }
  $('#form').addEventListener('submit', function (e) {
    if (e.target.id !== 'addf') return; e.preventDefault();
    fn('staff', { action: 'create', email: $('#a-e').value.trim(), password: $('#a-p').value, role: $('#a-r').value })
      .then(function (j) { team = j.staff; drawTeam(); toast('Added.'); }).catch(function (er) { say('#a-m', er.message); });
  });
  $('#form').addEventListener('change', function (e) {
    var s = e.target; if (s.getAttribute && s.getAttribute('data-a') === 'role') {
      var u = s.closest('.trow').getAttribute('data-u'); fn('staff', { action: 'role', user_id: u, role: s.value }).then(function (j) { team = j.staff; toast('Access updated.'); }).catch(function (er) { toast(er.message, 6000); drawTeam(); });
    }
  });
  $('#form').addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b || b.tagName !== 'BUTTON' || cur !== '__team') return;
    var u = b.closest('.trow').getAttribute('data-u');
    if (b.getAttribute('data-a') === 'rm') { if (!confirm('Remove this person? They will no longer be able to sign in.')) return; fn('staff', { action: 'remove', user_id: u }).then(function (j) { team = j.staff; drawTeam(); toast('Removed.'); }).catch(function (er) { toast(er.message, 6000); }); }
    if (b.getAttribute('data-a') === 'pw') { var p = prompt('New password for this person (at least 8 characters):'); if (!p) return; fn('staff', { action: 'password', user_id: u, password: p }).then(function () { toast('Password changed.'); }).catch(function (er) { toast(er.message, 6000); }); }
  });
})();
