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
