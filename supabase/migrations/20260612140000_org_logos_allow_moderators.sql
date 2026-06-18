-- Les modérateurs peuvent aussi gérer les logos d'organisations (table + storage).
-- (Avant : réservé aux admins.)

-- Table org_logos
drop policy if exists org_logos_admin_insert on public.org_logos;
create policy org_logos_admin_insert on public.org_logos for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.app_role in ('admin','moderator')));

drop policy if exists org_logos_admin_update on public.org_logos;
create policy org_logos_admin_update on public.org_logos for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.app_role in ('admin','moderator')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.app_role in ('admin','moderator')));

drop policy if exists org_logos_admin_delete on public.org_logos;
create policy org_logos_admin_delete on public.org_logos for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.app_role in ('admin','moderator')));

-- Bucket de stockage org-logos
drop policy if exists "org_logos_admin_insert" on storage.objects;
create policy "org_logos_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'org-logos' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.app_role in ('admin','moderator')));

drop policy if exists "org_logos_admin_update" on storage.objects;
create policy "org_logos_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'org-logos' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.app_role in ('admin','moderator')));

drop policy if exists "org_logos_admin_delete" on storage.objects;
create policy "org_logos_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'org-logos' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.app_role in ('admin','moderator')));
