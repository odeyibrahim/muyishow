# Muyi Sowemimo & Co. — website and staff editor

A single-page law-firm website with a separate staff editor at `/admin`. It is hosted on Netlify. Content, staff logins, pictures and saved enquiries live in Supabase. Enquiries are emailed through Resend; mail to the firm's addresses is forwarded to Gmail by ImprovMX.

**What is in this folder** is everything Netlify needs: `site/` (the website and `/admin`), `netlify/functions/` (staff management, the contact form, the email check), `scripts/build.js` and `netlify.toml`. Nothing else is required.

**Setup takes about 45 minutes, in this order:** Supabase → Netlify → email → first sign-in.

---

## 1. Supabase

1. Create a free project at supabase.com. Choose a region close to your visitors (Europe or South Africa).
2. Open **SQL Editor → New query**, paste the whole SQL block below, and press **Run**. It is safe to run twice.
3. **Authentication → Users → Add user → Create new user.** Enter your email and a password, and tick **Auto Confirm User**.
4. Run this in the SQL Editor (put your own email in) to make yourself the first administrator:
   ```sql
   insert into public.staff (user_id, email, role)
   select id, email, 'admin' from auth.users where email = 'you@example.com'
   on conflict (user_id) do update set role = 'admin';
   ```
5. **Project Settings → API.** Keep these three values for step 2: **Project URL**, **anon public** key, **service_role** key. The service_role key is secret: it goes only into Netlify's environment variables, never into a file.
6. **Authentication → URL Configuration.** Set *Site URL* to your live address, for example `https://www.muyi-sowemimolegal.com`, and add `https://www.muyi-sowemimolegal.com/admin` under *Redirect URLs*. This makes password-reset links return to the right place.

<details>
<summary>The SQL for step 2 (click to open)</summary>

```sql
-- Muyi Sowemimo & Co. — Supabase setup.
-- Paste the whole file into Supabase → SQL Editor → Run. Safe to run again.

-- 1. Who may edit: one row per staff login -----------------------------------------------------
create table if not exists public.staff (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;

create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.staff where user_id = auth.uid()) $$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.staff where user_id = auth.uid() and role = 'admin') $$;

grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- A signed-in person can see their own staff row; administrators can see all.
-- Nobody can write this table from the browser: adding and removing people goes through the
-- Netlify function (which uses the service key) or the SQL at the bottom of this file.
drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- 2. Site content: one row per section. Anyone may read; only staff may write -----------------
create table if not exists public.site_content (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.site_content enable row level security;

drop policy if exists content_read   on public.site_content;
drop policy if exists content_insert on public.site_content;
drop policy if exists content_update on public.site_content;
drop policy if exists content_delete on public.site_content;
create policy content_read   on public.site_content for select to anon, authenticated using (true);
create policy content_insert on public.site_content for insert to authenticated with check (public.is_staff());
create policy content_update on public.site_content for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy content_delete on public.site_content for delete to authenticated using (public.is_admin());

create or replace function public.touch_content() returns trigger language plpgsql security definer set search_path = public as
$$ begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists trg_touch_content on public.site_content;
create trigger trg_touch_content before insert or update on public.site_content for each row execute function public.touch_content();

-- 3. Pictures uploaded from the editor --------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images', 'site-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880;

drop policy if exists img_read   on storage.objects;
drop policy if exists img_insert on storage.objects;
drop policy if exists img_update on storage.objects;
drop policy if exists img_delete on storage.objects;
create policy img_read   on storage.objects for select to anon, authenticated using (bucket_id = 'site-images');
create policy img_insert on storage.objects for insert to authenticated with check (bucket_id = 'site-images' and public.is_staff());
create policy img_update on storage.objects for update to authenticated using (bucket_id = 'site-images' and public.is_staff());
create policy img_delete on storage.objects for delete to authenticated using (bucket_id = 'site-images' and public.is_staff());

-- 4. Your first administrator ------------------------------------------------------------------
-- a) Supabase → Authentication → Users → Add user → "Create new user". Type your email and a password,
--    and tick "Auto Confirm User".
-- b) Replace the email below with yours, remove the two leading dashes on the three lines, and Run.
--
-- insert into public.staff (user_id, email, role)
-- select id, email, 'admin' from auth.users where email = 'you@example.com'
-- on conflict (user_id) do update set role = 'admin';

-- 5. Enquiries and email settings -------------------------------------------------------------
-- Enquiries are written by the Netlify "contact" function (service key). Staff can read and tick them off.
create table if not exists public.enquiries (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  form       text not null,
  name       text,
  email      text,
  phone      text,
  message    text,
  data       jsonb not null default '{}'::jsonb,
  emailed    boolean not null default false,
  handled    boolean not null default false
);
alter table public.enquiries enable row level security;
drop policy if exists enq_read   on public.enquiries;
drop policy if exists enq_update on public.enquiries;
create policy enq_read   on public.enquiries for select to authenticated using (public.is_staff());
create policy enq_update on public.enquiries for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- Who receives enquiries, and the automatic reply. One row only (id = 1). Never readable by the public.
create table if not exists public.mail_settings (
  id          int primary key check (id = 1),
  recipients  text[] not null default '{}',
  ack_enabled boolean not null default true,
  ack_subject text not null default 'We have received your message',
  ack_body    text not null default 'Thank you for contacting us. We have received your message and will reply promptly.',
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);
alter table public.mail_settings enable row level security;
drop policy if exists mail_read  on public.mail_settings;
drop policy if exists mail_write on public.mail_settings;
drop policy if exists mail_upd   on public.mail_settings;
create policy mail_read  on public.mail_settings for select to authenticated using (public.is_staff());
create policy mail_write on public.mail_settings for insert to authenticated with check (public.is_admin());
create policy mail_upd   on public.mail_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
```

</details>

---

## 2. Netlify

Netlify's drag-and-drop box does not run the build or the functions, so deploy one of these ways:

- **Recommended:** put this folder in a GitHub repository, then in Netlify choose *Add new site → Import an existing project*. The settings come from `netlify.toml`; leave the build fields as they are.
- **Or** with the Netlify CLI, from this folder: `netlify deploy --build --prod`.

Then open **Site configuration → Environment variables** and add:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL from step 1.5 |
| `SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (secret) |
| `RESEND_API_KEY` | from step 3.1 below |
| `MAIL_FROM` | the address enquiries are sent from, for example `info@muyi-sowemimolegal.com` |
| `MAIL_FROM_NAME` | optional; default `Muyi Sowemimo & Co.` |
| `MAIL_TO` | optional backup recipients, separated by commas. Normal recipients are set in the editor. |
| `BUILD_HOOK_URL` | optional. *Build & deploy → Build hooks → Add*, paste its URL. Powers the "Refresh search copy" button. |

Redeploy once after adding them (**Deploys → Trigger deploy**).

**Domain.** Under **Domain management** add your domain and let Netlify manage its DNS (point your registrar's nameservers at Netlify). All the email records in step 3 are added in the same place: **Domains → your domain → DNS records**.

---

## 3. Email (free)

Two jobs, two free services:

- **Receiving:** ImprovMX forwards `info@` and `admin@` on your domain to your two Gmail inboxes. It needs only MX records, so DNS can stay on Netlify.
- **Sending:** Resend sends the website's enquiry emails and lets Gmail send *as* your domain addresses.

Both dashboards occasionally change wording. Always copy the exact record values they show you; the values below are what they showed at the time of writing.

### 3.1 Resend (sending)

1. Create an account at resend.com → **Domains → Add Domain**. Enter your domain and choose the region closest to you.
2. Resend lists DNS records (a DKIM `TXT` named `resend._domainkey`, plus an `MX` and a `TXT` for the `send` subdomain). Add each in Netlify DNS exactly as shown, then press **Verify** in Resend.
3. **API Keys → Create API Key.** Name it `website`, permission *Sending access*, then copy it. Put it in Netlify as `RESEND_API_KEY` (step 2).
4. Create a second key named `gmail` the same way. You will use it in step 3.3.

### 3.2 ImprovMX (receiving)

1. Create an account at improvmx.com and add your domain.
2. Add the aliases: `info` → your first Gmail address, `admin` → your second Gmail address. (Use as many aliases as you like; an alias can also point to both Gmail addresses.)
3. In Netlify DNS add:

| Type | Name | Value | Priority |
|---|---|---|---|
| MX | `@` | `mx1.improvmx.com` | 10 |
| MX | `@` | `mx2.improvmx.com` | 20 |
| TXT | `@` | `v=spf1 include:spf.improvmx.com ~all` | |

   Remove any other MX records on `@`. A domain may have only one SPF record.
4. Add one more record to help your mail avoid spam folders:

| Type | Name | Value |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:info@yourdomain.com` |

5. Press **Check my DNS** in ImprovMX. Send a test email to `info@yourdomain.com`; it should arrive in Gmail.

### 3.3 Send from Gmail as your domain address

In each Gmail account: **Settings → See all settings → Accounts and Import → Send mail as → Add another email address.**

1. Name: the firm's name. Email: `info@yourdomain.com` (or `admin@`). Untick *Treat as an alias* only if you want separate replies.
2. SMTP server `smtp.resend.com`, port `465`, secured with SSL. Username `resend`. Password: the `gmail` API key from step 3.1.
3. Gmail sends a confirmation code to that address. ImprovMX forwards it to the same inbox; enter the code.

When you reply to a website enquiry, choose the domain address in the *From* line.

---

## 4. First sign-in

1. Go to `yourdomain.com/admin` and sign in with the email and password from step 1.3.
2. **Email settings → Send enquiries to:** enter the two Gmail addresses (one per line) and **Save**. Press **Check now** to confirm the DNS records. Anything missing is listed with the record to add.
3. **Firm details:** confirm the phone, email, website address and *Full website address*. The last one feeds search engines and share cards.
4. Send yourself a test through the website's contact form. It should appear under **Enquiries** and arrive in both inboxes.

If email is not set up yet, enquiries still arrive in **Enquiries** in the editor, and visitors still receive a confirmation on screen.

---

## 5. Using the editor

- Choose a section on the left, edit, and press **Save and publish**. It is live for everyone at once. The preview on the right (the **Preview** button on a phone) shows changes before you save.
- Put `*asterisks*` around a word to italicise it, as in the headlines.
- **Undo changes** drops unsaved edits. **Original text** restores the wording the site shipped with.
- Pictures: upload from a picture field (resized automatically) or paste an address.
- The Principal and Of Counsel sections show no photographs until you add some. Upload a portrait in each field when you have them.
- **Team and logins** (administrators): add staff with an email and starting password, change access, reset a password or remove someone.
- **Forgot password?** on the sign-in page sends a reset link.

## 6. Search and sharing

The build writes everything search engines and social platforms look for: page title and description, canonical address, Open Graph and Twitter cards with a 1200×630 share image, schema.org `LegalService` data for both offices and the practice areas, `robots.txt`, `sitemap.xml` and a web manifest. `/admin` is excluded from search. After launch, submit `https://yourdomain.com/sitemap.xml` in Google Search Console.

## 7. Folder map

```
netlify.toml                 build and security settings
scripts/build.js             build step: bakes the latest content into the page
site/index.html              the page (regenerated on every deploy)
site/404.html                not-found page
site/assets/                 styles, scripts, images
site/admin/                  the staff editor
netlify/functions/staff.js       team management (administrators)
netlify/functions/contact.js     contact forms: save, email, acknowledge
netlify/functions/emailcheck.js  DNS check for the email setup
netlify/functions/rebuild.js     optional "Refresh search copy"
```
