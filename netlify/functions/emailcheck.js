// Checks the domain's DNS for the records the email setup needs and says, in plain words, what is missing.
// Staff only. Results reflect DNS as seen from Netlify, which can lag a few minutes behind a change.
const dns = require('dns').promises;
const { reply, caller } = require('./_lib');

const txt = async (name) => { try { return (await dns.resolveTxt(name)).map((r) => r.join('')); } catch (e) { return []; } };
const cname = async (name) => { try { return await dns.resolveCname(name); } catch (e) { return []; } };
const mx = async (name) => { try { return await dns.resolveMx(name); } catch (e) { return []; } };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'POST only' });
  const me = await caller(event); if (me.error) return me.error;
  let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}
  const d = String(b.domain || '').toLowerCase().replace(/^www\./, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return reply(400, { error: 'That does not look like a domain name.' });

  const [mxs, root, dm, dk, sendMx, sendTxt] = await Promise.all([mx(d), txt(d), txt('_dmarc.' + d), txt('resend._domainkey.' + d), mx('send.' + d), txt('send.' + d)]);
  const spf = root.filter((t) => /^v=spf1\b/i.test(t));
  const hosts = mxs.map((m) => m.exchange.toLowerCase());
  const checks = [
    { id: 'mx', label: 'Incoming mail is routed to ImprovMX', ok: hosts.some((h) => h.includes('improvmx')),
      fix: 'Add two MX records on the domain (name @): mx1.improvmx.com priority 10, and mx2.improvmx.com priority 20. Remove any other MX records on @.' },
    { id: 'spf1', label: 'The domain has exactly one SPF record', ok: spf.length === 1,
      fix: spf.length > 1 ? 'Merge the SPF records into one. A domain may only have one.' : 'Add a TXT record on @: v=spf1 include:spf.improvmx.com ~all' },
    { id: 'spf2', label: 'SPF allows ImprovMX', ok: spf.length === 1 && /spf\.improvmx\.com/.test(spf[0]),
      fix: 'The SPF record on @ should read: v=spf1 include:spf.improvmx.com ~all' },
    { id: 'dkim', label: 'Resend DKIM signing is published', ok: dk.some((t) => /p=/.test(t)),
      fix: 'In Resend (Domains) add your domain, then publish the TXT record named resend._domainkey exactly as Resend shows it.' },
    { id: 'send', label: 'Resend sending subdomain is published', ok: sendMx.some((m) => /amazonses/i.test(m.exchange)) && sendTxt.some((t) => /amazonses/i.test(t)),
      fix: 'Publish the two records Resend shows for the "send" subdomain: an MX record and an SPF TXT record, both named send.' },
    { id: 'dmarc', label: 'A DMARC policy exists', ok: dm.some((t) => /^v=DMARC1/i.test(t)),
      fix: 'Add a TXT record named _dmarc with: v=DMARC1; p=none; rua=mailto:info@' + d }
  ];
  return reply(200, { domain: d, checks, allOk: checks.every((c) => c.ok) });
};
