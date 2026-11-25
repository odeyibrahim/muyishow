# Muyi Sowemimo & Co. — website and staff editor

A single-page law-firm website with a separate staff editor at `/admin`. Hosted on Netlify; content, logins and pictures live in Supabase.

## Overview

- `/` is one page: hero, practice areas, the firm (tabs), principal, Of Counsel (compact list, full profile opens on tap), how an engagement runs, insights, referral desk, contact and offices. The privacy notice opens from the footer (`/#privacy`).
- `/admin` is a separate app for staff. Nothing on the public page links to it, and none of its code is loaded by the public site.
- Edits are saved to Supabase and appear for every visitor straight away. Netlify also bakes the latest content into the page whenever you deploy, so search engines and slow connections see it too.

## 1. Supabase (about 5 minutes)

1. Create a project at supabase.com. Choose a region close to Nigeria's users (Europe or South Africa work well).
2. **SQL Editor** → paste the whole of `supabase/schema.sql` → **Run**.
3. **Authentication → Users → Add user → Create new user.** Enter your email and a password, tick **Auto Confirm User**.
4. Back in the SQL Editor, run this with your email (it makes you the first administrator):
   ```sql
   insert into public.staff (user_id, email, role)
   select id, email, 'admin' from auth.users where email = 'you@example.com'
   on conflict (user_id) do update set role = 'admin';
   ```
5. **Project Settings → API.** Copy three values: the **Project URL**, the **anon public** key, and the **service_role** key. The service_role key is secret: it goes only into Netlify (step 2), never into any file.
6. **Authentication → URL Configuration:** set *Site URL* to your live address (for example `https://www.muyi-sowemimolegal.com`) and add `https://www.muyi-sowemimolegal.com/admin` under *Redirect URLs*. This makes password-reset emails come back to the right place.

## 2. Netlify

Netlify's drag-and-drop box does not run the build step or the functions, so connect the folder properly:

- **Recommended:** put this folder in a GitHub repository → Netlify → *Add new site → Import from Git*. The settings come from `netlify.toml`.
- **Or** with the Netlify CLI from this folder: `netlify deploy --build --prod`.

Then, in **Site configuration → Environment variables**, add:

| Name | Value | Needed for |
|---|---|---|
| `SUPABASE_URL` | Project URL | the site and the editor |
| `SUPABASE_ANON_KEY` | anon public key | the site and the editor |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | the Team panel (adding and removing staff) |
| `BUILD_HOOK_URL` | *optional.* Site configuration → Build & deploy → Build hooks → add one, paste its URL | the "Refresh search copy" button |

Redeploy once after adding them (*Deploys → Trigger deploy*).

**Enquiry forms** use Netlify Forms. After the first deploy they appear under *Forms* (`Enquiry` and `Referral`). Add an email notification there: *Forms → Form notifications → Add notification → Email*, one for each form.

## 3. Using the editor

Go to `yourdomain.com/admin` and sign in with email and password.

- Pick a section on the left, edit, press **Save and publish**. It is live immediately for everyone. The preview on the right (or the **Preview** button on a phone) shows your changes before you save.
- Put `*asterisks*` around a word to set it in italics, as in the original headlines.
- **Undo changes** drops unsaved edits. **Original text** puts back the wording the site shipped with.
- Pictures: upload from the picture field (they are resized automatically), or paste an address.
- **Team and logins** (administrators only): add staff with an email and a starting password, change their access, set a new password, or remove them. Staff can edit content; administrators can also manage the team.
- **Forgot password?** on the sign-in page sends a reset link.

## 4. Before launch

- Replace the **Principal's photo** (Principal section). The one in the original file is a landscape view of a lake, so it is cropped to fit; a portrait works better.
- Check the **Firm details** section (phone, email, website address). The website address is used by search engines.
- Of Counsel portraits are the original placeholder illustrations. Upload real photos when you have them.

## Developing locally

`node scripts/build.js` rebuilds `site/index.html`. Without the Supabase variables it uses the built-in content in `site/assets/js/content.default.js`. Any static server on the `site` folder will do, for example `npx serve site`.

## Project layout

```
site/index.html            built page (regenerated on every deploy)
site/404.html              not-found page
site/site.webmanifest      web app manifest (generated)
site/sitemap.xml           sitemap (generated)
site/assets/js/render.js   turns content into HTML (shared by the build, the site and the admin preview)
site/assets/js/site.js     public behaviour: menu, tabs, dialogs, forms, reveals, live content
site/admin/                the staff app (index.html, admin.js, schema.js, admin.css)
scripts/build.js           Netlify build step
netlify/functions/         staff.js (team management), rebuild.js (optional)
supabase/schema.sql        tables, security rules, image storage
```

## Search and sharing

The build writes everything search engines and social platforms look for: page title and description, canonical address, Open Graph and Twitter cards (with a 1200×630 share image), schema.org `LegalService` data covering both offices and the practice areas, `robots.txt`, `sitemap.xml` and a web manifest. The editor is excluded from search (`noindex`, `Disallow: /admin/`). After launch, submit `https://your-domain/sitemap.xml` in Google Search Console.

Keep **Firm details → Full website address** correct in the editor: it feeds the canonical address, sitemap and share cards.

## Tests

`tests/behave.py` drives the built site and the editor in a headless browser (Python with Playwright installed): `python3 tests/behave.py`.
