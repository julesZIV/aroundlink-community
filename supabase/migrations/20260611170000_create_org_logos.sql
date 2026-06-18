-- Logos d'organisations / institutions, gérés par les admins.
-- Clé = nom d'institution normalisé (lower + trim) pour matcher le regroupement par nom.
create table if not exists public.org_logos (
  name_key   text primary key,
  name       text not null,
  logo_url   text not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.org_logos enable row level security;

-- Lecture : tout le monde (community publique)
drop policy if exists org_logos_public_read on public.org_logos;
create policy org_logos_public_read
  on public.org_logos for select
  using (true);

-- Écriture (insert/update/delete) : admins uniquement
drop policy if exists org_logos_admin_insert on public.org_logos;
create policy org_logos_admin_insert
  on public.org_logos for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.app_role = 'admin'));

drop policy if exists org_logos_admin_update on public.org_logos;
create policy org_logos_admin_update
  on public.org_logos for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.app_role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.app_role = 'admin'));

drop policy if exists org_logos_admin_delete on public.org_logos;
create policy org_logos_admin_delete
  on public.org_logos for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.app_role = 'admin'));
