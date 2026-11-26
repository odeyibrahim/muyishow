// Shared helpers for the staff and rebuild functions. Uses only Node's built-in fetch.
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const reply = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) });

async function sb(path, opt = {}) {
  const r = await fetch(URL_ + path, { ...opt, headers: { apikey: SRV, Authorization: 'Bearer ' + SRV, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  const t = await r.text(); let d; try { d = t ? JSON.parse(t) : null; } catch (e) { d = t; }
  return { ok: r.ok, status: r.status, data: d };
}

// Works out who is calling from their sign-in token, then looks up their role in the staff table.
async function caller(event) {
  if (!URL_ || !SRV) return { error: reply(500, { error: 'The server is not configured yet: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify.' }) };
  const token = String(event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return { error: reply(401, { error: 'Please sign in again.' }) };
  const u = await sb('/auth/v1/user', { headers: { Authorization: 'Bearer ' + token } });
  if (!u.ok || !u.data || !u.data.id) return { error: reply(401, { error: 'Your session has expired. Please sign in again.' }) };
  const s = await sb('/rest/v1/staff?select=role&user_id=eq.' + encodeURIComponent(u.data.id));
  const role = s.ok && s.data && s.data[0] && s.data[0].role;
  if (!role) return { error: reply(403, { error: 'This account is not on the staff list.' }) };
  return { id: u.data.id, role };
}

module.exports = { sb, reply, caller };
