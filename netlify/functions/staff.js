// Team management for administrators: list, add, change access, set a password, remove.
// The browser never holds the service key; this function checks the caller is an administrator first.
const { sb, reply, caller } = require('./_lib');

async function list() {
  const s = await sb('/rest/v1/staff?select=user_id,email,role,created_at&order=created_at.asc');
  return s.ok ? s.data : [];
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'POST only' });
  const me = await caller(event); if (me.error) return me.error;
  if (me.role !== 'admin') return reply(403, { error: 'Only administrators can manage the team.' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { error: 'Bad request' }); }
  const a = b.action;

  if (a === 'list') return reply(200, { staff: await list() });

  if (a === 'create') {
    const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || ''), role = b.role === 'admin' ? 'admin' : 'staff';
    if (!/^\S+@\S+\.\S+$/.test(email)) return reply(400, { error: 'That email address does not look right.' });
    if (pw.length < 8) return reply(400, { error: 'The password needs at least 8 characters.' });
    let uid, r = await sb('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password: pw, email_confirm: true }) });
    if (r.ok) uid = r.data.id;
    else if (r.status === 422 || /already/i.test(JSON.stringify(r.data))) {
      const all = await sb('/auth/v1/admin/users?per_page=1000'); const hit = all.ok && (all.data.users || []).find(u => (u.email || '').toLowerCase() === email);
      if (!hit) return reply(400, { error: 'That email is already registered but could not be found.' });
      uid = hit.id; await sb('/auth/v1/admin/users/' + uid, { method: 'PUT', body: JSON.stringify({ password: pw, email_confirm: true }) });
    } else return reply(400, { error: (r.data && (r.data.msg || r.data.message)) || 'Could not create that login.' });
    const w = await sb('/rest/v1/staff?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: uid, email, role }) });
    if (!w.ok) return reply(500, { error: 'The login was created but could not be added to the staff list.' });
    return reply(200, { staff: await list() });
  }

  const uid = String(b.user_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return reply(400, { error: 'Bad request' });

  if (a === 'role') {
    if (uid === me.id) return reply(400, { error: 'You cannot change your own access.' });
    const role = b.role === 'admin' ? 'admin' : 'staff';
    const w = await sb('/rest/v1/staff?user_id=eq.' + uid, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ role }) });
    return w.ok ? reply(200, { staff: await list() }) : reply(500, { error: 'Could not update access.' });
  }
  if (a === 'password') {
    const pw = String(b.password || ''); if (pw.length < 8) return reply(400, { error: 'The password needs at least 8 characters.' });
    const w = await sb('/auth/v1/admin/users/' + uid, { method: 'PUT', body: JSON.stringify({ password: pw }) });
    return w.ok ? reply(200, { ok: true }) : reply(500, { error: 'Could not change the password.' });
  }
  if (a === 'remove') {
    if (uid === me.id) return reply(400, { error: 'You cannot remove yourself.' });
    const w = await sb('/auth/v1/admin/users/' + uid, { method: 'DELETE' });   // the staff row goes with it
    return w.ok ? reply(200, { staff: await list() }) : reply(500, { error: 'Could not remove that person.' });
  }
  return reply(400, { error: 'Unknown action' });
};
