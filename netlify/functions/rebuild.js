// Lets signed-in staff re-bake the static copy of the site (what search engines and no-JavaScript visitors see).
// Edits already go live for everyone the moment they are saved; this only refreshes the baked copy.
const { reply, caller } = require('./_lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'POST only' });
  const me = await caller(event); if (me.error) return me.error;
  const hook = process.env.BUILD_HOOK_URL;
  if (!hook) return reply(501, { error: 'Not set up: add a Netlify build hook as BUILD_HOOK_URL (see SETUP.md). Edits still go live without it.' });
  const r = await fetch(hook, { method: 'POST' });
  return r.ok ? reply(200, { ok: true }) : reply(502, { error: 'Netlify did not accept the request.' });
};
