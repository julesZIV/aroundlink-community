-- Bucket de stockage public pour les logos d'organisations.
-- Lecture publique, upload/modif/suppression réservés aux admins.
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do update set public = true;

-- Lecture publique des logos
drop policy if exists "org_logos_read" on storage.objects;
create policy "org_logos_read"
  on storage.objects for select
  using (bucket_id = 'org-logos');

-- Upload / update / delete réservés aux admins
drop policy if exists "org_logos_admin_insert" on storage.objects;
create policy "org_logos_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'org-logos' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.app_role = 'admin'));

drop policy if exists "org_logos_admin_update" on storage.objects;
create policy "org_logos_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'org-logos' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.app_role = 'admin'));

drop policy if exists "org_logos_admin_delete" on storage.objects;
create policy "org_logos_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'org-logos' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.app_role = 'admin'));
