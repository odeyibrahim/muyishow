// Receives the website's enquiry and referral forms.
//  1. saves the message to Supabase, so nothing is lost even if email fails;
//  2. emails it to the firm's inboxes through Resend (replying goes straight to the sender);
//  3. sends the visitor an automatic acknowledgement.
// If this function is unavailable, the site falls back to Netlify Forms.
const { sb, reply } = require('./_lib');

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.MAIL_FROM || '';
const FROM_NAME = process.env.MAIL_FROM_NAME || 'Muyi Sowemimo & Co.';
const FALLBACK_TO = (process.env.MAIL_TO || '').split(/[,;\s]+/).filter(Boolean);

const hits = new Map(); // best-effort limit: 6 messages per address per 10 minutes
function limited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 600000);
  list.push(now); hits.set(ip, list); return list.length > 6;
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

async function send({ to, replyTo, subject, text, html }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${FROM_NAME.replace(/[<>"]/g, '')} <${FROM}>`, to, reply_to: replyTo, subject, text, html })
  });
  return r.ok;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'POST only' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { error: 'Bad request' }); }
  if (b['bot-field']) return reply(200, { ok: true });                                    // honeypot: pretend success
  const ip = (event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (limited(ip)) return reply(429, { error: 'Too many messages. Please try again later.' });

  const form = b.form === 'Referral' ? 'Referral' : 'Enquiry', f = b.fields || {};
  const name = clip(f.Name, 120), email = clip(f.Email, 200), phone = clip(f.Phone, 60);
  const message = clip(f.Message || f.Matter, 5000);
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !message) return reply(400, { error: 'Please complete the required fields.' });
  const data = {}; Object.keys(f).slice(0, 20).forEach((k) => { data[clip(k, 40)] = clip(f[k], 5000); });

  // 1. save
  const saved = await sb('/rest/v1/enquiries', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ form, name, email, phone, message, data }) });

  // 2. notify the firm
  let emailed = false;
  if (RESEND_KEY && FROM) {
    let to = FALLBACK_TO, ack = { on: true, subject: 'We have received your message', body: 'Thank you for contacting us. We have received your message and will reply promptly.' };
    const s = await sb('/rest/v1/mail_settings?id=eq.1&select=recipients,ack_enabled,ack_subject,ack_body');
    if (s.ok && s.data && s.data[0]) {
      const r = s.data[0]; if ((r.recipients || []).length) to = r.recipients;
      ack = { on: r.ack_enabled, subject: r.ack_subject || ack.subject, body: r.ack_body || ack.body };
    }
    const rows = Object.keys(data).map((k) => `<tr><td style="padding:6px 14px 6px 0;color:#6f5b5c;vertical-align:top">${esc(k)}</td><td style="padding:6px 0">${esc(data[k]).replace(/\n/g, '<br>')}</td></tr>`).join('');
    if (to.length) {
      emailed = await send({
        to, replyTo: `${name.replace(/[<>",]/g, '')} <${email}>`, subject: `[${form}] ${name}`,
        text: Object.keys(data).map((k) => `${k}: ${data[k]}`).join('\n'),
        html: `<div style="font:15px/1.5 Arial,sans-serif;color:#2a1418"><p><b>New ${form.toLowerCase()} from the website</b></p><table>${rows}</table><p style="color:#6f5b5c;font-size:13px">Reply to this email to answer ${esc(name)} directly.</p></div>`
      });
    }
    // 3. acknowledge the visitor
    if (ack.on && emailed) {
      await send({
        to: [email], replyTo: to[0] || FROM, subject: ack.subject, text: `${ack.body}\n\n${FROM_NAME}`,
        html: `<div style="font:15px/1.6 Arial,sans-serif;color:#2a1418"><p>${esc(ack.body).replace(/\n/g, '<br>')}</p><p style="color:#6f5b5c">${esc(FROM_NAME)}</p></div>`
      });
    }
    if (saved.ok && emailed) await sb('/rest/v1/enquiries?email=eq.' + encodeURIComponent(email) + '&created_at=gte.' + encodeURIComponent(new Date(Date.now() - 60000).toISOString()), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ emailed: true }) });
  }
  if (!saved.ok && !emailed) return reply(502, { error: 'Could not deliver the message.' });
  return reply(200, { ok: true, saved: saved.ok, emailed });
};
